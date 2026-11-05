import express, { type RequestHandler } from "express";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerTrainingRoutes } from "../server/routes-training";
import { trainingMigrationSql } from "../server/migrations/training";
import { trainingLessons } from "../server/content/training-catalog";

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
  version = 1,
) =>
  req(`/lessons/${id}/progress`, user, {
    step,
    version,
    ...(answer === undefined ? {} : { answer }),
  });
const curriculum = (id = "bienvenida") =>
  trainingLessons.find((l) => l.id === id)!;

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
  it("rejects anonymous, inaccessible lessons and forged ownership; returns no solutions", async () => {
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
    expect(lesson.practice).not.toHaveProperty("answer");
    expect(lesson.check).not.toHaveProperty("feedback");
  });
  it("persists unsuccessful answers, validates completion, resumes and preserves completion on replay", async () => {
    const lesson = curriculum();
    await submit("learn");
    let result = await (await submit("practice", "wrong")).json();
    expect(result.feedback.correct).toBe(false);
    expect(result.progress.completedAt).toBeNull();
    expect(
      (await (await req("/lessons/bienvenida")).json()).progress.answers
        .practice,
    ).toBe("wrong");
    await submit("practice", lesson.practice.answer);
    result = await (await submit("check", lesson.check.answer)).json();
    expect(result.progress.completedAt).not.toBeNull();
    const completedAt = result.progress.completedAt;
    expect(
      (await (await submit("check", "wrong")).json()).progress.completedAt,
    ).toBe(completedAt);
    expect(
      (await (await req("/lessons/bienvenida", "2")).json()).progress
        .completedSteps,
    ).toEqual([]);
    expect(
      (await (await req()).json()).lessons.find(
        (l: any) => l.id === "bienvenida",
      ).progress.completedAt,
    ).toBe(completedAt);
    await req("/invitation", "1", { dismissed: true });
    expect((await (await req()).json()).invitationDismissed).toBe(true);
    expect((await (await req("", "2")).json()).invitationDismissed).toBe(false);
  });
  it("does not lose completed steps when tabs submit concurrently", async () => {
    const lesson = curriculum();
    const responses = await Promise.all([
      submit("learn"),
      submit("practice", lesson.practice.answer),
      submit("check", lesson.check.answer),
    ]);
    expect(responses.every((r) => r.ok)).toBe(true);
    const detail = await (await req("/lessons/bienvenida")).json();
    expect(detail.progress.completedSteps).toEqual([
      "learn",
      "practice",
      "check",
    ]);
    expect(detail.progress.completedAt).not.toBeNull();
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
  it("keeps version history and rejects attempts submitted against an old version", async () => {
    const lesson = curriculum();
    await submit("learn");
    await submit("practice", lesson.practice.answer);
    await submit("check", lesson.check.answer);
    const previous = lesson.version;
    try {
      lesson.version = previous + 1;
      const detail = await (await req("/lessons/bienvenida")).json();
      expect(detail.needsUpdate).toBe(true);
      expect(detail.progress.completedSteps).toEqual([]);
      expect((await submit("learn")).status).toBe(409);
      expect(
        (await submit("learn", undefined, "1", "bienvenida", lesson.version))
          .ok,
      ).toBe(true);
      const rows = await pool.query(
        "SELECT version,completed_at FROM training_progress WHERE user_id=1 AND lesson_id=$1 ORDER BY version",
        [lesson.id],
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0].completed_at).not.toBeNull();
      expect(rows.rows[1].completed_at).toBeNull();
    } finally {
      lesson.version = previous;
    }
  });
});
