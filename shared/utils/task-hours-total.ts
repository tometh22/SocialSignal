/** loggedHours includes descendants. Sum only the highest visible nodes. */
export function sumTaskLoggedHours<T extends { id: number; parentTaskId?: number | null; loggedHours?: number | null }>(tasks: T[]): number {
  const ids = new Set(tasks.map(task => task.id));
  return tasks.reduce((sum, task) => sum + (task.parentTaskId && ids.has(task.parentTaskId) ? 0 : Number(task.loggedHours ?? 0)), 0);
}
