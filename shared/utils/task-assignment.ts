/** The actor is recorded only when they assign a new person, not when editing dates/text. */
export function assignmentActor(
  current: { assigneeId?: number | null; collaboratorIds?: number[] | null; assignedBy?: number | null },
  updates: { assigneeId?: number | null; collaboratorIds?: number[] | null },
  actorId: number,
): number | null {
  const assignee = updates.assigneeId === undefined ? current.assigneeId : updates.assigneeId;
  const collaborators = updates.collaboratorIds === undefined ? current.collaboratorIds ?? [] : updates.collaboratorIds ?? [];
  if (assignee != null && assignee !== current.assigneeId) return actorId;
  if (collaborators.some(id => !(current.collaboratorIds ?? []).includes(id))) return actorId;
  if (assignee == null && collaborators.length === 0) return null;
  return current.assignedBy ?? null;
}

export function isDelegatedToOthers(task: { assigneeId?: number | null; collaboratorIds?: number[] | null }, personnelId: number | null): boolean {
  return [task.assigneeId, ...(task.collaboratorIds ?? [])].some(id => id != null && id !== personnelId);
}
