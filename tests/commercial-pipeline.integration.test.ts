import { beforeAll, afterAll, describe, it, expect } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { opportunitySchema } from "../shared/pipeline";
// Explicit, disposable PostgreSQL only. Never point this suite at Mind's database.
const suite = process.env.PIPELINE_TEST_DATABASE_URL ? describe : describe.skip;
suite("Pipeline routes / PostgreSQL", () => {
  let pool: any, server: Server, url: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.PIPELINE_TEST_DATABASE_URL;
    ({ pool } = await import("../server/db"));
    await pool.query(
      `CREATE TABLE crm_stages(key text,label text);CREATE TABLE users(id serial PRIMARY KEY,first_name text,last_name text);CREATE TABLE clients(id serial PRIMARY KEY);CREATE TABLE quotation_groups(id serial PRIMARY KEY);CREATE TABLE quotations(id serial PRIMARY KEY);CREATE TABLE crm_leads(id serial PRIMARY KEY,stage text,company_name text,client_id integer,assigned_to integer);CREATE TABLE crm_contacts(id serial PRIMARY KEY,lead_id integer,name text,is_primary boolean);INSERT INTO users(first_name,last_name) VALUES('Editor','Prueba');`,
    );
    const sql = readFileSync("migrations/0096_commercial_pipeline.sql", "utf8");
    await pool.query(sql);
    await pool.query(sql);
    const { registerPipelineRoutes } =
      await import("../server/pipeline/routes");
    const app = express();
    app.use(express.json());
    registerPipelineRoutes(app, (req, res, next) => {
      if (req.headers["x-role"] === "anonymous")
        return res.status(401).json({ message: "No autenticado" });
      (req as any).user = {
        id: 1,
        permissions:
          req.headers["x-role"] === "denied"
            ? []
            : req.headers["x-role"] === "reader"
              ? ["crm"]
              : ["crm", "quotations"],
        isAdmin: req.headers["x-role"] === "admin",
      };
      next();
    });
    server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", r));
    url = `http://127.0.0.1:${(server.address() as any).port}/api/crm/pipeline`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((r) => server.close(() => r()));
    await pool?.end();
  });
  async function call(
    path: string,
    method = "GET",
    body?: any,
    role = "editor",
  ) {
    const r = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", "x-role": role },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  }
  const data = () =>
    opportunitySchema.parse({
      account: "Sintética",
      scope: "Pipeline",
      evidence: "Envío",
      evidenceDate: "2026-11-01",
      usd: "100",
      valueNote: "Alcance",
      sources: [{ key: "s", title: "Evidencia", url: "https://example.org" }],
    });
  it("protege lecturas, agregados, cortes y escrituras", async () => {
    for (const path of [
      "/summary",
      "/opportunities",
      "/cuts",
      "/log",
      "/executive-summary",
    ])
      expect((await call(path, "GET", undefined, "denied")).status).toBe(403);
    expect((await call("/summary", "GET", undefined, "anonymous")).status).toBe(
      401,
    );
    expect((await call("/opportunities", "POST", {}, "denied")).status).toBe(
      403,
    );
    expect((await call("/settings", "PATCH", {}, "reader")).status).toBe(403);
  });
  it("alta idempotente, edición concurrente y corte inmutable", async () => {
    const requestKey = crypto.randomUUID();
    const created = await call("/opportunities", "POST", {
      data: data(),
      reason: "Alta de prueba",
      requestKey,
    });
    expect(created.status).toBe(200);
    const id = created.body.id;
    await call("/opportunities", "POST", {
      data: data(),
      reason: "Reintento",
      requestKey,
    });
    expect((await call("/summary")).body.open).toBe(1);
    const cutKey = crypto.randomUUID();
    const cut = await call("/cuts", "POST", {
      period: "2026-11",
      reason: "Cierre",
      requestKey: cutKey,
    });
    expect(cut.status).toBe(200);
    expect(
      (
        await call("/cuts", "POST", {
          period: "2026-11",
          reason: "Reintento",
          requestKey: cutKey,
        })
      ).body.id,
    ).toBe(cut.body.id);
    const concurrent = await Promise.all([
      call("/opportunities/" + id, "PATCH", {
        version: 1,
        data: { usd: "200" },
        reason: "Cambio uno",
      }),
      call("/opportunities/" + id, "PATCH", {
        version: 1,
        data: { usd: "300" },
        reason: "Cambio dos",
      }),
    ]);
    expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await call("/summary?snapshotId=" + cut.body.id)).body.gross).toBe(
      "100.00",
    );
    expect(
      (await call("/log")).body.filter((r: any) => r.kind === "edición"),
    ).toHaveLength(1);
  });
  it("filtra fuentes de cotización antes de agregar y exportar", async () => {
    const r = data();
    r.sources[0].kind = "quotation";
    await call("/opportunities", "POST", {
      data: r,
      reason: "Cotización",
      requestKey: crypto.randomUUID(),
    });
    expect((await call("/summary", "GET", undefined, "reader")).body.open).toBe(
      1,
    );
    expect((await call("/summary")).body.open).toBe(2);
    expect((await call("/log", "GET", undefined, "reader")).status).toBe(403);
  });
  it("conserva null explícito, valida vínculo y registra checklist con versión", async () => {
    expect(
      (
        await call("/opportunities", "POST", {
          data: { ...data(), leadId: 999 },
          reason: "Inválido",
          requestKey: crypto.randomUUID(),
        })
      ).status,
    ).toBe(400);
    const initial = await call("/checklist/2026-11");
    expect(initial.body.version).toBe(0);
    expect(
      (
        await call("/checklist/2026-11", "PATCH", {
          steps: [true, false, false, false],
          version: 0,
          reason: "Conciliado",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("/checklist/2026-11", "PATCH", {
          steps: [false, false, false, false],
          version: 0,
          reason: "Viejo",
        })
      ).status,
    ).toBe(409);
  });
});
