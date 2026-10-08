import { db } from "../db";
import { tasks, taskTimeEntries, asanaTimeEntries } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

export async function deleteEmptyTaskTrees(projectId: number, selectedIds: number[]) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(293, ${projectId})`);
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
  });
}
