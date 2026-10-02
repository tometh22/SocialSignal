export type TaskOrigin = "all" | "asana" | "native";
export function filterTasksByOrigin<T extends { id: number; parentTaskId?: number | null; asanaTaskGid?: string | null }>(tasks: T[], origin: TaskOrigin): T[] {
  if (origin === "all") return tasks;
  const byId = new Map(tasks.map(task => [task.id, task]));
  const visible = new Set(tasks.filter(task => origin === "asana" ? Boolean(task.asanaTaskGid) : !task.asanaTaskGid).map(task => task.id));
  // Keep ancestor context so a native child of an imported task stays visible.
  for (const id of [...visible]) {
    let task = byId.get(id);
    const visited = new Set<number>();
    while (task?.parentTaskId && !visited.has(task.parentTaskId)) {
      visited.add(task.parentTaskId);
      task = byId.get(task.parentTaskId);
      if (task) visible.add(task.id);
    }
  }
  return tasks.filter(task => visible.has(task.id));
}
