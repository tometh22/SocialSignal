import type { PoolClient } from "pg";
import { pool } from "../db";

export type AdminCleanupSelection = {
  projects?: number[];
  tasks?: number[];
  quotations?: number[];
  statuses?: number[];
};

type DbRow = Record<string, any>;

const MAX_IDS_PER_RESOURCE = 1000;

function normalizeIds(value: unknown, resource: string): number[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${resource} debe ser un array`);
  const ids = [...new Set(value.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error(`${resource} contiene IDs inválidos`);
  }
  if (ids.length > MAX_IDS_PER_RESOURCE) {
    throw new Error(`No se pueden borrar más de ${MAX_IDS_PER_RESOURCE} ${resource} por operación`);
  }
  return ids;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function deleteForeignKeyDependents(
  client: PoolClient,
  referencedTable: string,
  selectionTable: string,
  skipTable: string,
) {
  const foreignKeys = await client.query<DbRow>(
    `
      SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_constraint fk
      JOIN pg_class c ON c.oid = fk.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]
      WHERE fk.contype = 'f'
        AND fk.confrelid = $1::regclass
        AND array_length(fk.conkey, 1) = 1
        AND c.relname <> $2
    `,
    [referencedTable, skipTable],
  );

  let deleted = 0;
  for (const row of foreignKeys.rows) {
    const table = `${quoteIdentifier(String(row.schema_name))}.${quoteIdentifier(String(row.table_name))}`;
    const column = quoteIdentifier(String(row.column_name));
    const result = await client.query(
      `DELETE FROM ${table} WHERE ${column} IN (SELECT id FROM ${quoteIdentifier(selectionTable)})`,
    );
    deleted += result.rowCount ?? 0;
  }
  return deleted;
}

export async function getAdminCleanupInventory() {
  const [projects, tasks, quotations, statuses] = await Promise.all([
    pool.query<DbRow>(`
      SELECT
        p.id,
        COALESCE(NULLIF(p.name, ''), q.project_name, '(sin nombre)') AS name,
        p.status,
        COALESCE(p.is_finished, false) AS "isFinished",
        c.name AS "clientName",
        COUNT(DISTINCT t.id)::int AS "taskCount",
        COUNT(DISTINCT psr.id)::int AS "statusCount"
      FROM active_projects p
      LEFT JOIN quotations q ON q.id = p.quotation_id
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN project_status_reviews psr ON psr.project_id = p.id
      GROUP BY p.id, q.project_name, c.name
      ORDER BY p.id DESC
    `),
    pool.query<DbRow>(`
      SELECT
        t.id,
        t.title,
        t.status,
        t.project_id AS "projectId",
        COALESCE(NULLIF(p.name, ''), q.project_name, '(sin proyecto)') AS "projectName",
        (
          COALESCE(p.is_finished, false)
          OR LOWER(TRIM(COALESCE(p.status, ''))) NOT IN (
            'active', 'activo', 'en curso', 'on-hold', 'en pausa',
            'delivered', 'entregado', 'invoiced', 'facturado'
          )
        ) AS "projectInactive",
        t.created_at AS "createdAt"
      FROM tasks t
      LEFT JOIN active_projects p ON p.id = t.project_id
      LEFT JOIN quotations q ON q.id = p.quotation_id
      ORDER BY t.created_at DESC, t.id DESC
    `),
    pool.query<DbRow>(`
      SELECT
        q.id,
        q.project_name AS "projectName",
        q.status,
        c.name AS "clientName",
        q.created_at AS "createdAt",
        COUNT(DISTINCT p.id)::int AS "projectCount"
      FROM quotations q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN active_projects p ON p.quotation_id = q.id
      GROUP BY q.id, c.name
      ORDER BY q.created_at DESC, q.id DESC
    `),
    pool.query<DbRow>(`
      SELECT
        w.id,
        w.title,
        w.subtitle,
        w.room_id AS "roomId",
        r.name AS "roomName",
        w.health_status AS "healthStatus",
        w.margin_status AS "marginStatus",
        w.team_strain AS "teamStrain",
        w.hidden_from_weekly AS "hiddenFromWeekly",
        w.created_at AS "createdAt"
      FROM weekly_status_items w
      LEFT JOIN review_rooms r ON r.id = w.room_id
      ORDER BY w.created_at DESC, w.id DESC
    `),
  ]);

  return {
    projects: projects.rows,
    tasks: tasks.rows,
    quotations: quotations.rows,
    statuses: statuses.rows,
  };
}

export async function permanentlyDeleteAdminData(selection: AdminCleanupSelection) {
  const projects = normalizeIds(selection.projects, "proyectos");
  const tasks = normalizeIds(selection.tasks, "tareas");
  const quotations = normalizeIds(selection.quotations, "cotizaciones");
  const statuses = normalizeIds(selection.statuses, "status");
  if (!projects.length && !tasks.length && !quotations.length && !statuses.length) {
    throw new Error("Seleccioná al menos un registro para eliminar");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE cleanup_projects (id integer PRIMARY KEY) ON COMMIT DROP");
    await client.query("CREATE TEMP TABLE cleanup_tasks (id integer PRIMARY KEY) ON COMMIT DROP");
    await client.query("CREATE TEMP TABLE cleanup_quotations (id integer PRIMARY KEY) ON COMMIT DROP");
    await client.query("CREATE TEMP TABLE cleanup_statuses (id integer PRIMARY KEY) ON COMMIT DROP");
    await client.query("INSERT INTO cleanup_projects SELECT unnest($1::int[])", [projects]);
    await client.query("INSERT INTO cleanup_tasks SELECT unnest($1::int[])", [tasks]);
    await client.query("INSERT INTO cleanup_quotations SELECT unnest($1::int[])", [quotations]);
    await client.query("INSERT INTO cleanup_statuses SELECT unnest($1::int[])", [statuses]);

    // Custom status items have dependent notes, proposals and updates.
    const statusDependents = await deleteForeignKeyDependents(
      client,
      "weekly_status_items",
      "cleanup_statuses",
      "weekly_status_items",
    );
    const statusResult = await client.query(
      "DELETE FROM weekly_status_items WHERE id IN (SELECT id FROM cleanup_statuses)",
    );

    // Task children are removed explicitly for compatibility with older DBs.
    await client.query("DELETE FROM task_time_entries WHERE task_id IN (SELECT id FROM cleanup_tasks)");
    await client.query("DELETE FROM task_weekly_estimates WHERE task_id IN (SELECT id FROM cleanup_tasks)");
    await client.query("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM cleanup_tasks)");
    const taskResult = await client.query("DELETE FROM tasks WHERE id IN (SELECT id FROM cleanup_tasks)");

    // Projects can own many modules. Discover direct FKs so newly added project
    // tables are included, while active child projects are merely detached.
    await client.query(`
      UPDATE active_projects
      SET parent_project_id = NULL
      WHERE parent_project_id IN (SELECT id FROM cleanup_projects)
    `);
    const projectDependents = await deleteForeignKeyDependents(
      client,
      "active_projects",
      "cleanup_projects",
      "active_projects",
    );
    const projectResult = await client.query(
      "DELETE FROM active_projects WHERE id IN (SELECT id FROM cleanup_projects)",
    );

    const remainingQuoteRefs = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM active_projects
      WHERE quotation_id IN (SELECT id FROM cleanup_quotations)
    `);
    if (Number(remainingQuoteRefs.rows[0]?.count ?? 0) > 0) {
      throw new Error("No se puede borrar una cotización asociada a un proyecto conservado");
    }

    // Variant membership has a second FK to quotation_variants, so remove the
    // junction rows before deleting variants.
    await client.query("DELETE FROM quotation_team_members WHERE quotation_id IN (SELECT id FROM cleanup_quotations)");
    await client.query("DELETE FROM negotiation_history WHERE quotation_id IN (SELECT id FROM cleanup_quotations)");
    await client.query("DELETE FROM quotation_variants WHERE quotation_id IN (SELECT id FROM cleanup_quotations)");
    const quotationDependents = await deleteForeignKeyDependents(
      client,
      "quotations",
      "cleanup_quotations",
      "quotations",
    );
    const quotationResult = await client.query(
      "DELETE FROM quotations WHERE id IN (SELECT id FROM cleanup_quotations)",
    );

    await client.query("COMMIT");
    return {
      projects: projectResult.rowCount ?? 0,
      tasks: taskResult.rowCount ?? 0,
      quotations: quotationResult.rowCount ?? 0,
      statuses: statusResult.rowCount ?? 0,
      relatedRows: projectDependents + quotationDependents + statusDependents,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
