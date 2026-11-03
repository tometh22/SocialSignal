import type { Express, Request, RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { escapeLike } from "./utils/pagination";

export function registerSearchRoutes(app: Express, requireAuth: RequestHandler, accessibleProjects: (req: Request) => Promise<number[] | null>) {
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 200) : "";
      if (q.length < 2) return res.json([]);
      const user = req.user!;
      const admin = user.isAdmin || user.role === "admin";
      const allowed = (permission: string) => admin || user.permissions?.includes(permission);
      const operations = allowed("operations");
      const term = `%${escapeLike(q)}%`;
      const results: Array<Record<string, unknown>> = [];
      // Bounded independent searches; no business amounts or documents are downloaded.
      if (allowed("crm")) {
        const clients = await db.execute(sql`SELECT id, name, contact_name subtitle FROM clients
          WHERE name ILIKE ${term} OR contact_name ILIKE ${term} OR contact_email ILIKE ${term} ORDER BY name,id LIMIT 10`);
        results.push(...clients.rows.map((row: any) => ({ id: `client-${row.id}`, type: "client", title: row.name, subtitle: row.subtitle,
          url: allowed("projects") ? `/client-summary/${row.id}` : "/clients" })));
      }
      if (operations || allowed("projects") || allowed("task_manager")) {
        const ids = await accessibleProjects(req);
        const projects = await db.execute(sql`SELECT p.id, COALESCE(p.name,q.project_name,'Proyecto') name, c.name subtitle, p.status
          FROM active_projects p LEFT JOIN quotations q ON q.id=p.quotation_id LEFT JOIN clients c ON c.id=p.client_id
          WHERE (${ids === null} OR p.id=ANY(${sql.param(ids ?? [])}::int[]))
            AND (COALESCE(p.name,q.project_name,'') ILIKE ${term} OR c.name ILIKE ${term} OR p.id::text=${q})
          ORDER BY COALESCE(p.name,q.project_name),p.id LIMIT 10`);
        results.push(...projects.rows.map((row: any) => ({ id: `project-${row.id}`, type: "project", title: row.name, subtitle: row.subtitle, status: row.status, url: `/tasks/projects/${row.id}` })));
      }
      if (allowed("quotations")) {
        const quotes = await db.execute(sql`SELECT q.id,q.project_name name,c.name subtitle,q.status FROM quotations q JOIN clients c ON c.id=q.client_id
          WHERE q.archived_at IS NULL AND (q.project_name ILIKE ${term} OR c.name ILIKE ${term} OR q.id::text=${q}) ORDER BY q.id DESC LIMIT 10`);
        results.push(...quotes.rows.map((row: any) => ({ id: `quotation-${row.id}`, type: "quotation", title: row.name, subtitle: row.subtitle, status: row.status, url: `/quotations/${row.id}` })));
      }
      if (operations) {
        const deliverables = await db.execute(sql`SELECT d.id,d.name,c.name subtitle FROM deliverables d JOIN clients c ON c.id=d.client_id
          WHERE d.name ILIKE ${term} OR c.name ILIKE ${term} OR d.delivery_month ILIKE ${term} ORDER BY d.id DESC LIMIT 10`);
        results.push(...deliverables.rows.map((row: any) => ({ id: `deliverable-${row.id}`, type: "deliverable", title: row.name, subtitle: row.subtitle, url: `/edit-deliverable/${row.id}` })));
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.json(results.sort((a, b) => Number(String(b.title).toLowerCase() === q.toLowerCase()) - Number(String(a.title).toLowerCase() === q.toLowerCase())));
    } catch (error) {
      console.error("Search failed", error);
      res.status(500).json({ message: "No se pudo completar la búsqueda" });
    }
  });
}
