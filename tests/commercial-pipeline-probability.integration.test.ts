import { beforeAll, afterAll, describe, it, expect } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { opportunitySchema, localDay } from "../shared/pipeline";
import { referenceModel } from "../shared/pipeline-probability";
// Explicit, disposable PostgreSQL only. Never point this suite at Mind's database.
const suite = process.env.PIPELINE_TEST_DATABASE_URL ? describe : describe.skip;
suite("Modelo de probabilidad / PostgreSQL", () => {
  let pool: any, server: Server, url: string;
  beforeAll(async () => {
    // Schema propio: comparte la base de CI con las otras suites del pipeline.
    const schema = `pipeline_probability_${process.pid}`;
    const { Client } = await import("pg");
    const admin = new Client({
      connectionString: process.env.PIPELINE_TEST_DATABASE_URL,
    });
    await admin.connect();
    await admin.query(
      `DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`,
    );
    await admin.end();
    const u = new URL(process.env.PIPELINE_TEST_DATABASE_URL!);
    u.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = u.toString();
    ({ pool } = await import("../server/db"));
    await pool.query(
      `CREATE TABLE crm_stages(key text,label text);CREATE TABLE users(id serial PRIMARY KEY,first_name text,last_name text);CREATE TABLE clients(id serial PRIMARY KEY);CREATE TABLE quotation_groups(id serial PRIMARY KEY);CREATE TABLE quotations(id serial PRIMARY KEY, client_id integer, status text);CREATE TABLE crm_leads(id serial PRIMARY KEY,stage text,company_name text,client_id integer,assigned_to integer);CREATE TABLE crm_contacts(id serial PRIMARY KEY,lead_id integer,name text,is_primary boolean);INSERT INTO users(first_name,last_name) VALUES('Tomás','Prueba');`,
    );
    await pool.query(
      readFileSync("migrations/0096_commercial_pipeline.sql", "utf8"),
    );
    const sql = readFileSync(
      "migrations/0099_pipeline_probability_model.sql",
      "utf8",
    );
    await pool.query(sql);
    await pool.query(sql); // idempotente: corre en cada arranque
    const { registerPipelineRoutes } =
      await import("../server/pipeline/routes");
    const app = express();
    app.use(express.json());
    registerPipelineRoutes(app, (req, _res, next) => {
      const role = req.headers["x-role"];
      (req as any).user = {
        id: 1,
        firstName: "Tomás",
        lastName: "Prueba",
        permissions: ["crm", "quotations"],
        isAdmin: role === "admin",
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
  const call = async (
    path: string,
    method = "GET",
    body?: any,
    role = "editor",
  ) => {
    const r = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", "x-role": role },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const data = (patch = {}) =>
    opportunitySchema.parse({
      account: "Sintética",
      scope: "Pipeline",
      stage: "Propuesta",
      status: "Propuesta enviada",
      evidence: "Propuesta enviada",
      evidenceDate: localDay(),
      usd: "10000",
      valueNote: "Cotización",
      sources: [{ key: "s", title: "Evidencia", url: "https://example.org" }],
      ...patch,
    });

  it("siembra la v1 aprobada con los valores de referencia", async () => {
    const m = await call("/methodology");
    expect(m.body).toMatchObject({
      version: 1,
      approvedBy: "Tomás Criado",
      model: referenceModel,
    });
  });
  it("pondera con el modelo, muestra el desglose y registra el cierre para aprender", async () => {
    const created = await call("/opportunities", "POST", {
      data: data({ teamSignals: ["prioridad"] }),
      reason: "Alta",
      requestKey: crypto.randomUUID(),
    });
    expect(created.status).toBe(200);
    const summary = await call("/summary");
    // Propuesta 40 + prioridad 10 = 50% de USD 10.000.
    expect(summary.body).toMatchObject({
      open: 1,
      weighted: "5000.00",
      weightedCoverage: 1,
    });
    const row = (await call("/opportunities")).body.rows[0];
    expect(row.model).toMatchObject({
      probability: 50,
      modelOnly: 40,
      version: 1,
    });
    expect(row.model.parts.map((p: any) => p.key)).toEqual([
      "base",
      "team:prioridad",
    ]);
    expect(row.alerts).not.toContain("Sin probabilidad respaldada");
    expect((await call("/executive-summary")).body.text).toContain(
      "modelo aprobado",
    );

    const closed = await call("/opportunities/" + created.body.id, "PATCH", {
      version: 1,
      data: {
        stage: "Confirmada",
        status: "Confirmada",
        scope: "Cerrada / confirmada",
      },
      reason: "El cliente aprobó la propuesta",
    });
    expect(closed.status).toBe(200);
    const outcome = (await pool.query("SELECT * FROM pipeline_outcomes"))
      .rows[0];
    expect(outcome).toMatchObject({
      result: "won",
      reason: "El cliente aprobó la propuesta",
      stages_reached: ["Propuesta"],
      signals: ["team:prioridad"],
      methodology_version: 1,
    });
    expect(Number(outcome.predicted_final)).toBe(50);
    expect(Number(outcome.predicted_model)).toBe(40);
    const learning = (await call("/learning")).body.learning;
    expect(learning).toMatchObject({
      total: 1,
      won: 1,
      lost: 0,
      signalsReady: false,
    });
    expect(
      learning.stages.find((s: any) => s.stage === "Propuesta"),
    ).toMatchObject({ n: 1, wins: 1 });
  });
  it("solo un admin aprueba una versión nueva, con control de concurrencia", async () => {
    const next = {
      ...referenceModel,
      stageBase: { ...referenceModel.stageBase, Propuesta: 35 },
    };
    const body = {
      model: next,
      basis: "Recalibración con cierres de prueba",
      expectedVersion: 1,
    };
    expect((await call("/methodology", "POST", body)).status).toBe(403);
    expect((await call("/methodology", "POST", body, "admin")).body).toEqual({
      version: 2,
    });
    expect((await call("/methodology", "POST", body, "admin")).status).toBe(
      409,
    );
    const m = await call("/methodology");
    expect(m.body).toMatchObject({ version: 2, approvedBy: "Tomás Prueba" });
    expect(m.body.model.stageBase.Propuesta).toBe(35);
    expect(m.body.history.map((h: any) => h.version)).toEqual([2, 1]);
  });
});
