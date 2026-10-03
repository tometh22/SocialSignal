/** Keep the ancestors needed to display matching tasks in a hierarchical list. */
export function filterTaskTree<T extends { id: number; parentTaskId?: number | null; title: string }>(tasks: T[], text: string): T[] {
  const needle = text.trim().toLocaleLowerCase();
  if (!needle) return tasks;
  const byId = new Map(tasks.map(task => [task.id, task]));
  const visible = new Set(tasks.filter(task => task.title.toLocaleLowerCase().includes(needle)).map(task => task.id));
  for (const id of [...visible]) {
    let task = byId.get(id);
    const visited = new Set<number>([id]);
    while (task?.parentTaskId && !visited.has(task.parentTaskId)) {
      visited.add(task.parentTaskId);
      task = byId.get(task.parentTaskId);
      if (task) visible.add(task.id);
    }
  }
  return tasks.filter(task => visible.has(task.id));
}
