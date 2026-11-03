/** Personal time is private even inside a shared project. Operations bypasses this projection. */
export function personalTaskHours(value: unknown, personnelId: number | null, ownHours: Map<number, number>, taskOwners: Map<number, number | null>): any {
  if (Array.isArray(value)) return value.filter(row => !row || typeof row !== 'object' || !('personnelId' in row && 'hours' in row) || row.personnelId === personnelId)
    .filter(row => !row || typeof row !== 'object' || !('taskId' in row && 'weekStart' in row) || taskOwners.get(row.taskId) === personnelId)
    .map(row => personalTaskHours(row, personnelId, ownHours, taskOwners));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const row = value as Record<string, any>;
  const out = Object.fromEntries(Object.entries(row).map(([key, item]) => [key, personalTaskHours(item, personnelId, ownHours, taskOwners)]));
  if ('assigneeId' in row && 'title' in row && 'id' in row) {
    delete out.asanaSource;
    if ('loggedHours' in row) out.loggedHours = ownHours.get(row.id) ?? 0;
    if (row.assigneeId !== personnelId) {
      for (const key of ['estimatedHours', 'estimatedHoursTotal', 'estimatedHoursForWeek']) if (key in row) out[key] = 0;
    }
  }
  return out;
}

/** Collect only rows whose personal hours/estimates need projection. Comments need no SQL. */
export function privateTaskIds(value: unknown): number[] {
  const ids = new Set<number>();
  const visit = (item: unknown) => {
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (!item || typeof item !== "object" || item instanceof Date) return;
    const row = item as Record<string, unknown>;
    if (typeof row.id === "number" && "assigneeId" in row && "title" in row) ids.add(row.id);
    if (typeof row.taskId === "number" && ("hours" in row || "weekStart" in row)) ids.add(row.taskId);
    Object.values(row).forEach(visit);
  };
  visit(value);
  return [...ids];
}
