import express, { type RequestHandler } from "express";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerTrainingRoutes } from "../server/routes-training";
import { trainingMigrationSql } from "../server/migrations/training";

const url = process.env.TRAINING_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Training tests require a local isolated database");
const schema = `training_test_${process.pid}`;
const pool = new Pool({
  connectionString: url,
  options: `-c search_path=${schema}`,
  max: 4,
});
let server: Server;
let base: string;
const req = (path = "", user = "1", body?: unknown) =>
  fetch(base + "/api/training" + path, {
    method: body === undefined ? "GET" : "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user": user } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const submit = (
  step: string,
  answer?: unknown,
  user = "1",
  id = "bienvenida",
  version = 2,
) =>
  req(`/lessons/${id}/progress`, user, {
    step,
    version,
    ...(answer === undefined ? {} : { answer }),
  });

describe.skipIf(!url)("training API / PostgreSQL", () => {
  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE users(id INTEGER PRIMARY KEY, role TEXT DEFAULT 'member', is_admin BOOLEAN DEFAULT FALSE, permissions TEXT[] DEFAULT '{}');
      INSERT INTO users(id,permissions) VALUES(1,'{task_manager}'),(2,'{crm}'),(3,'{}');
      UPDATE users SET role='external_provider' WHERE id=3;
      CREATE TABLE external_providers(id INTEGER PRIMARY KEY, user_id INTEGER, active BOOLEAN DEFAULT TRUE, personnel_id INTEGER);
      CREATE TABLE active_projects(id INTEGER PRIMARY KEY, is_finished BOOLEAN, closed_at TIMESTAMP);
      CREATE TABLE provider_project_access(provider_id INTEGER, project_id INTEGER, can_log_hours BOOLEAN);
      INSERT INTO external_providers VALUES(1,3,TRUE,1);
      INSERT INTO active_projects VALUES(1,FALSE,NULL);
      INSERT INTO provider_project_access VALUES(1,1,TRUE);`);
    await pool.query(trainingMigrationSql);
    await pool.query(trainingMigrationSql);
    const app = express();
    app.use(express.json());
    const auth: RequestHandler = (req, res, next) => {
      void pool
        .query(
          'SELECT id,role,is_admin AS "isAdmin",permissions FROM users WHERE id=$1',
          [Number(req.header("x-test-user")) || 0],
        )
        .then(({ rows }) => {
          if (!rows.length) {
            res.status(401).json({ message: "No autenticado" });
            return;
          }
          req.user = rows[0];
          next();
        })
        .catch(next);
    };
    registerTrainingRoutes(app, pool, auth);
    app.use(((error, _req, res, _next) => {
      res.status(500).json({ message: error.message });
    }) as express.ErrorRequestHandler);
    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE training_progress,training_preferences; UPDATE users SET permissions='{task_manager}' WHERE id=1; UPDATE active_projects SET closed_at=NULL; UPDATE provider_project_access SET can_log_hours=TRUE; UPDATE external_providers SET active=TRUE, personnel_id=1",
    );
  });
  afterAll(async () => {
    if (server)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });
  it("rejects anonymous, inaccessible lessons and forged ownership; returns instructions without assessments", async () => {
    expect((await req("", "")).status).toBe(401);
    expect((await req("/lessons/reportes")).status).toBe(404);
    expect((await submit("learn", undefined, "1", "reportes")).status).toBe(
      404,
    );
    expect(
      (
        await req("/lessons/bienvenida/progress", "1", {
          version: 1,
          step: "learn",
          userId: 2,
        })
      ).status,
    ).toBe(400);
    expect(
      (await req("/invitation", "1", { dismissed: true, userId: 2 })).status,
    ).toBe(400);
    const response = await req("/lessons/bienvenida");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const lesson = await response.json();
    expect(lesson).not.toHaveProperty("practice");
    expect(lesson).not.toHaveProperty("check");
    expect(lesson.instructions.length).toBeGreaterThan(2);
  });
  it("serves screenshots only to the authorized session, including provider capabilities", async () => {
    expect((await req("/lessons/bienvenida/media/referencia", "")).status).toBe(
      401,
    );
    expect((await req("/lessons/administracion/media/referencia")).status).toBe(
      404,
    );
    expect((await req("/lessons/horas/media/referencia", "3")).status).toBe(
      404,
    );
    expect((await req("/lessons/bienvenida/media/unknown")).status).toBe(404);
    expect(
      (await req("/lessons/bienvenida/media/%2e%2e%2fadmin.jpg")).status,
    ).toBe(404);
    const image = await req("/lessons/horas/media/referencia");
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/jpeg");
    expect(image.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await image.arrayBuffer()).subarray(0, 3)).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff]),
    );
    expect(
      (await req("/lessons/proveedor-horas/media/referencia", "3")).status,
    ).toBe(200);
    await pool.query("UPDATE provider_project_access SET can_log_hours=FALSE");
    expect(
      (await req("/lessons/proveedor-horas/media/referencia", "3")).status,
    ).toBe(404);
  });
  it("records optional reading, resumes across sessions and preserves the original timestamp", async () => {
    const initial = await (await req("/lessons/bienvenida")).json();
    expect(initial.progress.completedAt).toBeNull();
    // Merely opening a guide does not record reading or require assessment.
    expect(
      (await pool.query("SELECT * FROM training_progress")).rows,
    ).toHaveLength(0);
    const result = await (await submit("learn")).json();
    expect(result.progress.completedAt).toBeTruthy();
    expect(result.progress.completedSteps).toEqual(["learn"]);
    expect(result.progress.answers).toEqual({});
    const completedAt = result.progress.completedAt;
    expect((await (await submit("learn")).json()).progress.completedAt).toBe(
      completedAt,
    );
    expect(
      (await (await req("/lessons/bienvenida", "2")).json()).progress
        .completedSteps,
    ).toEqual([]);
    expect(
      (await (await req()).json()).lessons.find(
        (l: any) => l.id === "bienvenida",
      ).progress.completedAt,
    ).toBe(completedAt);
    expect((await submit("practice", "old answer")).status).toBe(400);
    await req("/invitation", "1", { dismissed: true });
    expect((await (await req()).json()).invitationDismissed).toBe(true);
    expect((await (await req("", "2")).json()).invitationDismissed).toBe(false);
  });
  it("keeps concurrent read markers idempotent", async () => {
    const responses = await Promise.all([
      submit("learn"),
      submit("learn"),
      submit("learn"),
    ]);
    expect(responses.every((r) => r.ok)).toBe(true);
    const detail = await (await req("/lessons/bienvenida")).json();
    expect(detail.progress.completedSteps).toEqual(["learn"]);
    expect(detail.progress.completedAt).toBeTruthy();
    const timestamps = await Promise.all(
      responses.map(async (r) => (await r.json()).progress.completedAt),
    );
    expect(new Set(timestamps).size).toBe(1);
  });
  it("updates permissions and provider capabilities without deleting past progress", async () => {
    await submit("learn", undefined, "1", "horas");
    await pool.query("UPDATE users SET permissions='{crm}' WHERE id=1");
    expect((await req("/lessons/horas")).status).toBe(404);
    expect((await submit("learn", undefined, "1", "horas")).status).toBe(404);
    await pool.query(
      "UPDATE users SET permissions='{task_manager}' WHERE id=1",
    );
    expect(
      (await (await req("/lessons/horas")).json()).progress.completedSteps,
    ).toEqual(["learn"]);
    expect((await req("/lessons/proveedor-horas", "3")).ok).toBe(true);
    for (const change of [
      "UPDATE active_projects SET closed_at=NOW()",
      "UPDATE provider_project_access SET can_log_hours=FALSE",
      "UPDATE external_providers SET personnel_id=NULL",
      "UPDATE external_providers SET active=FALSE",
    ]) {
      await pool.query(
        "UPDATE active_projects SET closed_at=NULL; UPDATE provider_project_access SET can_log_hours=TRUE; UPDATE external_providers SET active=TRUE,personnel_id=1",
      );
      await pool.query(change);
      expect((await req("/lessons/proveedor-horas", "3")).status).toBe(404);
      const catalog = await (await req("", "3")).json();
      expect(catalog.lessons.some((l: any) => l.id === "proveedor-horas")).toBe(
        false,
      );
      expect(catalog.lessons.some((l: any) => l.id === "reportes")).toBe(false);
    }
  });
  it("preserves version 1 exercise history while new guides have their own read marker", async () => {
    const legacy = {
      completedSteps: ["learn", "practice", "check"],
      answers: { practice: "option-1", check: "option-2" },
    };
    await pool.query(
      `INSERT INTO training_progress(user_id,lesson_id,version,state,completed_at) VALUES(1,'bienvenida',1,$1,NOW())`,
      [JSON.stringify(legacy)],
    );
    let detail = await (await req("/lessons/bienvenida")).json();
    expect(detail.needsUpdate).toBe(true);
    expect(detail.progress.completedSteps).toEqual([]);
    expect(
      (await submit("learn", undefined, "1", "bienvenida", 1)).status,
    ).toBe(409);
    expect((await submit("learn")).ok).toBe(true);
    detail = await (await req("/lessons/bienvenida")).json();
    expect(detail.needsUpdate).toBe(false);
    expect(detail.progress.completedAt).toBeTruthy();
    const rows = await pool.query(
      "SELECT version,state,completed_at FROM training_progress WHERE user_id=1 AND lesson_id='bienvenida' ORDER BY version",
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].state).toEqual(legacy);
    expect(rows.rows.every((row) => row.completed_at)).toBe(true);
  });
});
