import type { Express, RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { requirePermission } from "./middleware/requirePermission";

// Only these fixed views are addressable. Never interpolate a view supplied by a client.
const views = {
  "pnl-mensual": "vw_looker_pnl_mensual",
  "proyectos-mensual": "vw_looker_proyectos_mensual",
  "costos-mensual": "vw_looker_costos_mensual",
  "equipo-mensual": "vw_looker_equipo_mensual",
  cashflow: "vw_looker_cashflow",
  "revenue-por-cliente": "vw_looker_revenue_por_cliente",
};

export function registerBiRoutes(app: Express, pool: Pick<Pool, "query">, requireAuth: RequestHandler) {
  const authorize: RequestHandler = (req, res, next) => {
    const token = process.env.BI_ACCESS_TOKEN;
    const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (token && supplied) {
      const expectedBytes = Buffer.from(token);
      const actualBytes = Buffer.from(supplied);
      if (actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)) return next();
      res.status(401).json({ message: "Credencial BI inválida" });
      return;
    }
    requireAuth(req, res, () => requirePermission("finance")(req, res, next));
  };
  for (const [route, view] of Object.entries(views)) {
    app.get(`/api/bi/${route}`, authorize, async (_req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      try { res.json((await pool.query(`SELECT * FROM ${view}`)).rows); }
      catch (error) {
        console.error("BI query failed", error);
        res.status(500).json({ message: "No se pudo consultar el reporte" });
      }
    });
  }
}
