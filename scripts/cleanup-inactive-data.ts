/**
 * Remove inactive test data without touching the rest of the workspace.
 *
 * The default command is a dry run:
 *   npx tsx scripts/cleanup-inactive-data.ts
 *
 * To actually delete the rows, pass --execute explicitly:
 *   npx tsx scripts/cleanup-inactive-data.ts --execute
 *
 * Statuses are configurable because quotations do not have an `active`
 * status in the application. The defaults match the UI's lifecycle model:
 * - projects: active, on-hold, delivered and invoiced are kept
 * - tasks: todo, in_progress, blocked and in_review are kept
 * - quotations: approved, pending and in-negotiation are kept
 *
 * Examples:
 *   npx tsx scripts/cleanup-inactive-data.ts --project-active-statuses=active
 *   npx tsx scripts/cleanup-inactive-data.ts --quote-active-statuses=approved --execute
 */

import { pool } from "../server/db";

type QueryResultRow = Record<string, unknown>;

// The database contains both English and Spanish lifecycle values. Keep the
// aliases here so a localized value such as "En curso" is not deleted.
const DEFAULT_PROJECT_ACTIVE_STATUSES = [
  "active", "activo", "en curso",
  "on-hold", "en pausa",
  "delivered", "entregado",
  "invoiced", "facturado",
];
const DEFAULT_TASK_ACTIVE_STATUSES = [
  "todo", "pendiente",
  "in_progress", "en progreso",
  "blocked", "bloqueada", "bloqueado",
  "in_review", "en revision", "en revisión",
];
const DEFAULT_QUOTE_ACTIVE_STATUSES = [
  "approved", "aprobada", "aprobado",
  "pending", "pendiente",
  "in-negotiation", "en negociacion", "en negociación",
];

function readOption(name: string, fallback: string[]): string[] {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = value?.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed?.length ? parsed : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function sqlStringList(values: string[]): string {
  return values
    .map((value) => value.trim().toLowerCase())
    .map((value) => `'${value.replaceAll("'", "''")}'`)
    .join(", ");
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function asNumber(row: QueryResultRow | undefined, key: string): number {
  return Number(row?.[key] ?? 0);
}

async function main() {
  const execute = hasFlag("execute");
  const projectActiveStatuses = readOption("project-active-statuses", DEFAULT_PROJECT_ACTIVE_STATUSES);
  const taskActiveStatuses = readOption("task-active-statuses", DEFAULT_TASK_ACTIVE_STATUSES);
  const quoteActiveStatuses = readOption("quote-active-statuses", DEFAULT_QUOTE_ACTIVE_STATUSES);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TEMP TABLE cleanup_projects ON COMMIT DROP AS
      SELECT id
      FROM active_projects
      WHERE LOWER(TRIM(COALESCE(status, ''))) NOT IN (${sqlStringList(projectActiveStatuses)})
         OR COALESCE(is_finished, false) = true
    `);

    await client.query(`
      CREATE TEMP TABLE cleanup_tasks ON COMMIT DROP AS
      SELECT t.id
      FROM tasks t
      WHERE LOWER(TRIM(COALESCE(t.status, ''))) NOT IN (${sqlStringList(taskActiveStatuses)})
         OR t.project_id IN (SELECT id FROM cleanup_projects)
    `);

    // Keep a quotation that is still attached to a kept project, even if its
    // own status is stale. This prevents the cleanup from breaking active work.
    await client.query(`
      CREATE TEMP TABLE cleanup_quotations ON COMMIT DROP AS
      SELECT q.id
      FROM quotations q
      WHERE LOWER(TRIM(COALESCE(q.status, ''))) NOT IN (${sqlStringList(quoteActiveStatuses)})
        AND NOT EXISTS (
          SELECT 1
          FROM active_projects p
          WHERE p.quotation_id = q.id
            AND p.id NOT IN (SELECT id FROM cleanup_projects)
        )
    `);

    // Keep these queries sequential: node-postgres clients do not support
    // concurrent queries on the same connection inside one transaction.
    const projectCount = await client.query("SELECT COUNT(*)::int AS count FROM cleanup_projects");
    const taskCount = await client.query("SELECT COUNT(*)::int AS count FROM cleanup_tasks");
    const quoteCount = await client.query("SELECT COUNT(*)::int AS count FROM cleanup_quotations");
    const statusCounts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM project_status_reviews WHERE project_id IN (SELECT id FROM cleanup_projects)) AS project_reviews,
        (SELECT COUNT(*)::int FROM project_review_notes WHERE project_id IN (SELECT id FROM cleanup_projects)) AS project_notes,
        (SELECT COUNT(*)::int FROM status_update_entries WHERE project_id IN (SELECT id FROM cleanup_projects)) AS updates,
        (SELECT COUNT(*)::int FROM status_change_log WHERE project_id IN (SELECT id FROM cleanup_projects)) AS changes,
        (SELECT COUNT(*)::int FROM status_item_proposals WHERE project_id IN (SELECT id FROM cleanup_projects)) AS proposals
    `);
    const customStatusCount = await client.query(
      "SELECT COUNT(*)::int AS count FROM weekly_status_items WHERE room_id IS NOT NULL",
    );

    const projects = asNumber(projectCount.rows[0], "count");
    const tasks = asNumber(taskCount.rows[0], "count");
    const quotations = asNumber(quoteCount.rows[0], "count");
    const statuses = statusCounts.rows[0] as QueryResultRow;
    const customStatuses = asNumber(customStatusCount.rows[0], "count");

    console.log(execute ? "MODO EJECUCIÓN" : "VISTA PREVIA — no se borró ningún registro");
    console.log(`Proyectos candidatos: ${projects}`);
    console.log(`Tareas candidatas: ${tasks}`);
    console.log(`Cotizaciones candidatas: ${quotations}`);
    console.log(
      "Status ligados a esos proyectos: " +
      `reviews=${asNumber(statuses, "project_reviews")}, ` +
      `notas=${asNumber(statuses, "project_notes")}, ` +
      `updates=${asNumber(statuses, "updates")}, ` +
      `cambios=${asNumber(statuses, "changes")}, ` +
      `propuestas=${asNumber(statuses, "proposals")}`,
    );
    console.log(`Status personalizados sin proyecto (no se tocan): ${customStatuses}`);
    console.log(`Estados activos de proyectos: ${projectActiveStatuses.join(", ")}`);
    console.log(`Estados activos de tareas: ${taskActiveStatuses.join(", ")}`);
    console.log(`Estados activos de cotizaciones: ${quoteActiveStatuses.join(", ")}`);

    const sampleProjects = await client.query(`
      SELECT p.id, COALESCE(p.name, q.project_name, '(sin nombre)') AS name, p.status
      FROM active_projects p
      LEFT JOIN quotations q ON q.id = p.quotation_id
      WHERE p.id IN (SELECT id FROM cleanup_projects)
      ORDER BY p.id
      LIMIT 50
    `);
    const sampleQuotes = await client.query(`
      SELECT id, project_name, status
      FROM quotations
      WHERE id IN (SELECT id FROM cleanup_quotations)
      ORDER BY id
      LIMIT 50
    `);
    if (sampleProjects.rows.length) console.table(sampleProjects.rows);
    if (sampleQuotes.rows.length) console.table(sampleQuotes.rows);

    if (!execute) {
      await client.query("ROLLBACK");
      return;
    }

    // Delete task children first. The task foreign keys are cascading in the
    // current schema, but explicit deletes also work on older environments.
    await client.query(`
      DELETE FROM task_time_entries
      WHERE task_id IN (SELECT id FROM cleanup_tasks)
    `);
    await client.query(`
      DELETE FROM task_weekly_estimates
      WHERE task_id IN (SELECT id FROM cleanup_tasks)
    `);
    await client.query(`
      DELETE FROM task_comments
      WHERE task_id IN (SELECT id FROM cleanup_tasks)
    `);
    await client.query(`DELETE FROM tasks WHERE id IN (SELECT id FROM cleanup_tasks)`);

    // Discover every direct FK to active_projects so newer project modules are
    // included automatically. Child projects that remain active are detached.
    await client.query(`
      UPDATE active_projects
      SET parent_project_id = NULL
      WHERE parent_project_id IN (SELECT id FROM cleanup_projects)
    `);
    const projectForeignKeys = await client.query(`
      SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_constraint fk
      JOIN pg_class c ON c.oid = fk.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]
      WHERE fk.contype = 'f'
        AND fk.confrelid = 'active_projects'::regclass
        AND array_length(fk.conkey, 1) = 1
        AND c.relname <> 'active_projects'
    `);
    for (const row of projectForeignKeys.rows as QueryResultRow[]) {
      const table = `${quoteIdentifier(String(row.schema_name))}.${quoteIdentifier(String(row.table_name))}`;
      const column = quoteIdentifier(String(row.column_name));
      await client.query(`DELETE FROM ${table} WHERE ${column} IN (SELECT id FROM cleanup_projects)`);
    }
    await client.query(`DELETE FROM active_projects WHERE id IN (SELECT id FROM cleanup_projects)`);

    // A quotation is deletable only after projects have been removed. As a
    // final guard, refuse to delete if any kept project still references one.
    const remainingQuoteRefs = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM active_projects
      WHERE quotation_id IN (SELECT id FROM cleanup_quotations)
    `);
    if (asNumber(remainingQuoteRefs.rows[0], "count") > 0) {
      throw new Error("Hay proyectos conservados que todavía referencian cotizaciones candidatas");
    }

    // These two tables also have a variant FK, so delete the junction rows
    // before variants regardless of the catalog's FK ordering.
    await client.query(`
      DELETE FROM quotation_team_members
      WHERE quotation_id IN (SELECT id FROM cleanup_quotations)
    `);
    await client.query(`
      DELETE FROM negotiation_history
      WHERE quotation_id IN (SELECT id FROM cleanup_quotations)
    `);
    await client.query(`
      DELETE FROM quotation_variants
      WHERE quotation_id IN (SELECT id FROM cleanup_quotations)
    `);

    const quotationForeignKeys = await client.query(`
      SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_constraint fk
      JOIN pg_class c ON c.oid = fk.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]
      WHERE fk.contype = 'f'
        AND fk.confrelid = 'quotations'::regclass
        AND array_length(fk.conkey, 1) = 1
        AND c.relname <> 'quotations'
    `);
    for (const row of quotationForeignKeys.rows as QueryResultRow[]) {
      const table = `${quoteIdentifier(String(row.schema_name))}.${quoteIdentifier(String(row.table_name))}`;
      const column = quoteIdentifier(String(row.column_name));
      await client.query(`DELETE FROM ${table} WHERE ${column} IN (SELECT id FROM cleanup_quotations)`);
    }
    await client.query(`DELETE FROM quotations WHERE id IN (SELECT id FROM cleanup_quotations)`);

    await client.query("COMMIT");
    console.log("Limpieza completada correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("No se pudo completar la limpieza:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
