import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import * as schema from "../shared/schema";
import { capacityPlanningMigrationSql } from "../server/migrations/capacity-planning";
const setup = vi.hoisted(() => ({ url: process.env.CAPACITY_TEST_DATABASE_URL || process.env.FINANCIAL_TEST_DATABASE_URL, schema: `capacity_planning_test_${process.pid}` }));
if (setup.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(setup.url).hostname)) throw new Error("Only a local test database is allowed");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg"); const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: setup.url, options: `-c search_path=${setup.schema}`, max: 2 });
  return { pool, db: drizzle(pool) };
});
import { pool, db } from "../server/db";
import { effectiveCapacityEstimatesQuery, loadCapacityPlanning, saveCapacityMode, saveCapacityGroup, saveCapacityExtra, moveCapacitySectionEstimates } from "../server/services/capacity-planning";
const ops = { userId: 1, personnelId: null, isOperations: true };
const member = { userId: 2, personnelId: 1, isOperations: false };
const other = { userId: 3, personnelId: 3, isOperations: false };
const weekStart = "2026-11-02";
const group = (scope: "project" | "section", estimatedHours: number, extra = {}) => ({ projectId: 1, personnelId: 1, weekStart, scope, sectionName: scope === "section" ? "Base" : "", estimatedHours, ...extra });

it("keeps the runtime migration identical to the SQL migration", () => {
  expect(capacityPlanningMigrationSql).toBe(readFileSync("migrations/0092_capacity_planning.sql", "utf8"));
});

describe.skipIf(!setup.url)("capacity planning with PostgreSQL", () => {
  let admin: Client;
  const tables = [schema.users, schema.personnel, schema.clients, schema.quotations, schema.activeProjects, schema.tasks, schema.taskWeeklyEstimates, schema.taskProjectMembers];
  const query = (text: string, values?: unknown[]) => pool.query(text, values);
  const total = async () => (await db.execute(effectiveCapacityEstimatesQuery({ dateFrom: weekStart, dateTo: weekStart }))).rows.reduce((sum, row) => sum + Number(row.estimatedHours), 0);
  beforeAll(async () => {
    admin = new Client({ connectionString: setup.url }); await admin.connect(); await admin.query(`CREATE SCHEMA ${setup.schema}`);
    const dialect = new PgDialect();
    for (const table of tables) {
      const config = getTableConfig(table);
      const columns = config.columns.map(column => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : value === undefined ? undefined : typeof value === "number" || typeof value === "boolean" ? String(value) : `'${(Array.isArray(value) && column.getSQLType().endsWith("[]") ? `{${value.join(",")}}` : typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
        return `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}${defaultSql ? ` DEFAULT ${defaultSql}` : ""}`;
      });
      await query(`CREATE TABLE "${config.name}" (${columns.join(",")})`);
    }
    await query("ALTER TABLE task_weekly_estimates ADD UNIQUE(task_id,week_start)");
    // Start from the pre-feature schema, so ADD COLUMN and its defaults are exercised.
    await query("ALTER TABLE active_projects DROP COLUMN capacity_estimation_mode; ALTER TABLE task_weekly_estimates DROP COLUMN is_extra");
    await query(capacityPlanningMigrationSql); await query(capacityPlanningMigrationSql);
  });
  beforeEach(async () => {
    await query(`TRUNCATE ${tables.map(table => getTableConfig(table).name).join(",")},capacity_group_estimates RESTART IDENTITY CASCADE`);
    await query(`INSERT INTO users(id,email) VALUES(1,'ops@example.test'),(2,'member@example.test'),(3,'other@example.test');
      INSERT INTO personnel(id,name,email) VALUES(1,'Member','member@example.test'),(2,'Teammate','teammate@example.test'),(3,'Other','other@example.test');
      INSERT INTO clients(id,name) VALUES(1,'Client');
      INSERT INTO active_projects(id,name,client_id,status,task_section_names) VALUES(1,'Project',1,'active','["Base","Empty"]'),(2,'Empty project',1,'active','[]'),(3,'Private',1,'active','[]');
      INSERT INTO task_project_members(project_id,personnel_id,role) VALUES(1,1,'member'),(1,2,'member'),(2,1,'member'),(3,3,'member');
      INSERT INTO tasks(id,title,project_id,assignee_id,status,section_name) VALUES(1,'Base task',1,1,'todo','Base'),(2,'Extra task',1,1,'todo','Base'),(3,'Teammate task',1,2,'todo','Base');
      INSERT INTO task_weekly_estimates(task_id,week_start,estimated_hours) VALUES(1,'2026-11-02',10),(2,'2026-11-02',2);`);
  });
  afterAll(async () => { await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${setup.schema} CASCADE`); await admin.end(); } });

  it("preserves task planning by default and adds each task only once", async () => {
    expect(await total()).toBe(12);
    await saveCapacityExtra(2, weekStart, true, member);
    expect(await total()).toBe(12);
    await query(capacityPlanningMigrationSql);
    expect(await total()).toBe(12);
  });
  it("counts only the selected base plus explicit extras across mode changes", async () => {
    await saveCapacityExtra(2, weekStart, true, member);
    await saveCapacityMode(1, "section", ops);
    await saveCapacityGroup(group("section", 16), member);
    expect(await total()).toBe(18);
    await saveCapacityMode(1, "project", ops);
    await saveCapacityGroup(group("project", 30), member);
    expect(await total()).toBe(32);
    await saveCapacityMode(1, "task", ops); expect(await total()).toBe(12);
    await saveCapacityMode(1, "section", ops); expect(await total()).toBe(18);
    expect((await query("SELECT count(*)::int AS n FROM capacity_group_estimates")).rows[0].n).toBe(2);
  });
  it("upserts without duplication, removes zero groups and isolates weeks", async () => {
    await saveCapacityMode(1, "project", ops);
    await saveCapacityGroup(group("project", 30), member); await saveCapacityGroup(group("project", 20), member);
    expect(await total()).toBe(20);
    await saveCapacityGroup(group("project", 40, { weekStart: "2026-11-09" }), member);
    expect(await total()).toBe(20);
    await saveCapacityGroup(group("project", 0), member); expect(await total()).toBe(0);
  });
  it("rejects other owners, nonmembers and mode changes by ordinary members", async () => {
    await expect(saveCapacityMode(1, "project", member)).rejects.toMatchObject({ status: 403 });
    await saveCapacityMode(1, "project", ops);
    await expect(saveCapacityGroup(group("project", 20, { personnelId: 2 }), member)).rejects.toMatchObject({ status: 403 });
    await expect(saveCapacityGroup(group("project", 20), other)).rejects.toMatchObject({ status: 403 });
    await expect(saveCapacityGroup(group("project", 20, { personnelId: 3 }), ops)).rejects.toMatchObject({ status: 400 });
    await expect(saveCapacityExtra(3, weekStart, true, member)).rejects.toMatchObject({ status: 403 });
    expect(await total()).toBe(0);
  });
  it("rejects stale scopes, foreign sections, invalid dates and inactive projects", async () => {
    await expect(saveCapacityGroup(group("project", 20), member)).rejects.toMatchObject({ status: 409 });
    await saveCapacityMode(1, "section", ops);
    await expect(saveCapacityGroup(group("section", 20, { sectionName: "Foreign" }), member)).rejects.toMatchObject({ status: 400 });
    await expect(saveCapacityGroup(group("section", 20, { weekStart: "2026-11-03" }), member)).rejects.toThrow();
    await query("UPDATE active_projects SET status='completed' WHERE id=1");
    await expect(saveCapacityGroup(group("section", 20), member)).rejects.toMatchObject({ status: 409 });
  });
  it("returns assigned empty projects and keeps teammates' estimates private", async () => {
    await saveCapacityMode(1, "project", ops); await saveCapacityGroup(group("project", 20), member);
    await saveCapacityGroup(group("project", 7, { personnelId: 2 }), ops);
    const planning = await loadCapacityPlanning(weekStart, member);
    expect(planning.projects.map(project => project.id)).toEqual([2, 1]);
    expect(planning.tasks.every(task => task.personnelId === 1)).toBe(true);
    expect(planning.groups).toHaveLength(1);
    expect(planning.groups[0].estimatedHours).toBe(20);
    expect((await loadCapacityPlanning(weekStart, other)).projects.map(project => project.id)).toEqual([3]);
    expect((await loadCapacityPlanning(weekStart, ops)).groups).toHaveLength(2);
  });
  it("keeps section estimates when sections are renamed or merged into General", async () => {
    await saveCapacityMode(1, "section", ops); await saveCapacityGroup(group("section", 20), member);
    await db.transaction(tx => moveCapacitySectionEstimates(tx, 1, "Base", "General"));
    expect(await total()).toBe(20);
    await saveCapacityGroup(group("section", 5), member);
    await db.transaction(tx => moveCapacitySectionEstimates(tx, 1, "Base", "General"));
    const planning = await loadCapacityPlanning(weekStart, member);
    expect(planning.groups).toMatchObject([{ sectionName: "General", estimatedHours: 25 }]);
  });
  it("uses week overlap for reports without spreading project hours into sections", async () => {
    await saveCapacityMode(1, "project", ops); await saveCapacityGroup(group("project", 20), member);
    const rows = (await db.execute(effectiveCapacityEstimatesQuery({ dateFrom: "2026-11-08", dateTo: "2026-11-08" }))).rows;
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ sectionName: null, taskId: null, estimatedHours: 20 });
    expect((await db.execute(effectiveCapacityEstimatesQuery({ dateFrom: "2026-11-09", dateTo: "2026-11-09" }))).rows).toHaveLength(0);
  });
});
