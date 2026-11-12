import { beforeAll, afterAll, describe, it, expect } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { opportunitySchema } from "../shared/pipeline";
// Explicit, disposable PostgreSQL only. Never point this suite at Mind's database.
const suite = process.env.PIPELINE_TEST_DATABASE_URL ? describe : describe.skip;
suite("Pipeline compartido / PostgreSQL", () => {
  let pool: any, server: Server, base: string;
  const secret = "NOTA-INTERNA-NO-PUBLICAR";
  beforeAll(async () => {
    // Schema propio: la suite comparte la base de CI con la del pipeline (mismas tablas base).
    const schema = `pipeline_share_${process.pid}`;
    const { Client } = await import("pg");
    const admin = new Client({ connectionString: process.env.PIPELINE_TEST_DATABASE_URL });
    await admin.connect();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
    await admin.end();
    const url = new URL(process.env.PIPELINE_TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    ({ pool } = await import("../server/db"));
    await pool.query(
      `CREATE TABLE crm_stages(key text,label text);CREATE TABLE users(id serial PRIMARY KEY,first_name text,last_name text);CREATE TABLE clients(id serial PRIMARY KEY);CREATE TABLE quotation_groups(id serial PRIMARY KEY);CREATE TABLE quotations(id serial PRIMARY KEY);CREATE TABLE crm_leads(id serial PRIMARY KEY,stage text,company_name text,client_id integer,assigned_to integer);CREATE TABLE crm_contacts(id serial PRIMARY KEY,lead_id integer,name text,is_primary boolean);INSERT INTO users(first_name,last_name) VALUES('Editor','Prueba');`,
    );
    await pool.query(readFileSync("migrations/0096_commercial_pipeline.sql", "utf8"));
    const share = readFileSync("migrations/0098_pipeline_share_links.sql", "utf8");
    await pool.query(share);
    await pool.query(share); // idempotente: corre en cada arranque
    const data = opportunitySchema.parse({
      account: "Cuenta sintética",
      scope: "Pipeline",
      stage: "Propuesta",
      status: "Propuesta enviada",
      notes: secret,
      evidence: secret,
      evidenceDate: "2026-11-01",
      sources: [{ key: "s", title: secret, url: "https://example.org/x" }],
    });
    await pool.query(
      "INSERT INTO pipeline_opportunities(import_key,data,version) VALUES('it-1',$1,1)",
      [data],
    );
    const { registerPipelineShareRoutes } = await import("../server/pipeline/share");
    const app = express();
    app.use(express.json());
    registerPipelineShareRoutes(app, (req, res, next) => {
      const role = req.headers["x-role"];
      if (!role) return res.status(401).json({ message: "No autenticado" });
      (req as any).user = {
        id: 1,
        permissions: role === "reader" ? ["crm"] : ["crm", "quotations"],
      };
      next();
    });
    server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((r) => server.close(() => r()));
    await pool?.end();
  });
  const call = async (path: string, method = "GET", body?: any, role?: string) => {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(role ? { "x-role": role } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json() };
  };
  const view = (token: string) => call("/api/public/pipeline", "POST", { token });

  it("solo quien ve la cartera completa puede emitir enlaces", async () => {
    expect((await call("/api/crm/pipeline/share-links", "POST", { label: "Fede" })).status).toBe(401);
    expect((await call("/api/crm/pipeline/share-links", "POST", { label: "Fede" }, "reader")).status).toBe(403);
  });
  it("crea, abre sin sesión, cuenta vistas y deja de abrir al revocar", async () => {
    const created = await call("/api/crm/pipeline/share-links", "POST", { label: "Fede", expiresInDays: 7 }, "editor");
    expect(created.status).toBe(201);
    const token = created.body.path.split("#t=")[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    // Solo se guarda el hash.
    const stored = await pool.query("SELECT token_hash FROM pipeline_share_links WHERE id=$1", [created.body.id]);
    expect(stored.rows[0].token_hash).not.toBe(token);

    const opened = await view(token);
    expect(opened.status).toBe(200);
    expect(opened.headers.get("cache-control")).toBe("no-store");
    expect(opened.headers.get("x-robots-tag")).toContain("noindex");
    expect(opened.body.rows.map((r: any) => r.account)).toEqual(["Cuenta sintética"]);
    expect(JSON.stringify(opened.body)).not.toContain(secret);

    const listed = await call("/api/crm/pipeline/share-links", "GET", undefined, "editor");
    expect(listed.body[0]).toMatchObject({ label: "Fede", viewCount: 1 });
    expect(JSON.stringify(listed.body)).not.toContain(token);

    expect((await call(`/api/crm/pipeline/share-links/${created.body.id}`, "DELETE", undefined, "editor")).status).toBe(204);
    expect((await view(token)).status).toBe(404);
    expect((await call("/api/crm/pipeline/share-links", "GET", undefined, "editor")).body).toEqual([]);
    const log = await pool.query("SELECT kind,reason FROM pipeline_log ORDER BY id");
    expect(log.rows.map((r: any) => r.reason)).toEqual(["Enlace de solo lectura para Fede", "Enlace revocado: Fede"]);
  });
  it("rechaza tokens vencidos, inexistentes o mal formados", async () => {
    const created = await call("/api/crm/pipeline/share-links", "POST", { label: "Vencido" }, "editor");
    const token = created.body.path.split("#t=")[1];
    await pool.query("UPDATE pipeline_share_links SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [created.body.id]);
    expect((await view(token)).status).toBe(404);
    expect((await view("f".repeat(64))).status).toBe(404);
    expect((await view("no-es-un-token")).status).toBe(404);
  });
});
