import { db } from "../db";
import { tasks, taskTimeEntries, asanaTimeEntries } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

export async function deleteEmptyTaskTrees(projectId: number, selectedIds: number[]) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(293, ${projectId})`);
    return deleteTaskTreesInTransaction(tx, projectId, selectedIds);
  });
}

export async function deleteTaskTreesInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: number,
  selectedIds: number[],
) {
  if (!selectedIds.length) return { deletedTaskIds: [], parentTaskIds: [] };
  const selected = await tx.select().from(tasks).where(inArray(tasks.id, selectedIds)).for("update");
  if (selected.length !== selectedIds.length || selected.some(t => t.projectId !== projectId)) throw Object.assign(new Error("La selección cambió o contiene tareas de otro proyecto"), { status: 409 });
  // FK inserts acquire a key-share lock: FOR UPDATE prevents new time rows
  // until the whole tree has been checked and deleted in this transaction.
  const tree = await tx.execute(sql`WITH RECURSIVE tree AS (SELECT id FROM tasks WHERE id IN (${sql.join(selectedIds.map(id => sql`${id}`), sql`, `)}) UNION SELECT child.id FROM tasks child JOIN tree parent ON child.parent_task_id=parent.id) SELECT t.id, t.parent_task_id FROM tasks t WHERE t.id IN (SELECT id FROM tree) ORDER BY t.id FOR UPDATE`);
  const ids = tree.rows.map((r: any) => Number(r.id));
  const [native, imported] = await Promise.all([
    tx.select({ id: taskTimeEntries.id }).from(taskTimeEntries).where(inArray(taskTimeEntries.taskId, ids)).limit(1),
    tx.select({ id: asanaTimeEntries.gid }).from(asanaTimeEntries).where(inArray(asanaTimeEntries.taskId, ids)).limit(1),
  ]);
  if (native.length || imported.length) throw Object.assign(new Error("No se pueden eliminar tareas o subtareas con horas registradas, incluido el historial importado"), { status: 409 });
  const parents = [...new Set(tree.rows.map((r: any) => Number(r.parent_task_id)).filter(id => id > 0 && !ids.includes(id)))];
  await tx.delete(tasks).where(inArray(tasks.id, ids));
  return { deletedTaskIds: ids, parentTaskIds: parents };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Split a section into deletable task trees and trees that must survive because
 * some task in them has native or imported hours. A tree is a task of the
 * section whose parent is outside it, plus all of its descendants.
 */
export async function planSectionDeletion(tx: Tx, projectId: number, sectionName: string) {
  const { rows } = await tx.execute(sql`WITH RECURSIVE roots AS (
      SELECT t.id FROM tasks t
      WHERE t.project_id=${projectId} AND t.section_name=${sectionName}
        AND (t.parent_task_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM tasks parent WHERE parent.id=t.parent_task_id AND parent.section_name=${sectionName}))
    ), tree AS (
      SELECT id AS root_id, id FROM roots
      UNION SELECT tree.root_id, child.id FROM tasks child JOIN tree ON child.parent_task_id=tree.id
    )
    SELECT tree.root_id, root.title, COUNT(*)::int AS task_count,
      bool_or(EXISTS (SELECT 1 FROM task_time_entries e WHERE e.task_id=tree.id)
        OR EXISTS (SELECT 1 FROM asana_time_entries a WHERE a.task_id=tree.id)) AS has_hours
    FROM tree JOIN tasks root ON root.id=tree.root_id
    GROUP BY tree.root_id, root.title, root.position, root.created_at
    ORDER BY root.position, root.created_at, tree.root_id`);
  const trees = rows.map((row: any) => ({ rootId: Number(row.root_id), title: String(row.title), taskCount: Number(row.task_count), hasHours: Boolean(row.has_hours) }));
  return { deletable: trees.filter(tree => !tree.hasHours), kept: trees.filter(tree => tree.hasHours) };
}
