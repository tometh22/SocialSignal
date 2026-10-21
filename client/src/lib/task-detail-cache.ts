type TaskOwner = {
  assigneeId?: number | null;
  assigneeName?: string | null;
  hoursOwnerId?: number | null;
  hoursOwnerName?: string | null;
};

/** A changed assignment invalidates the derived hours owner immediately. */
export function mergeTaskAssignment<T extends TaskOwner>(current: T, updates: Partial<T>, people: Array<{ id: number; name: string }>): T {
  const merged = { ...current, ...updates };
  if (updates.assigneeId === undefined) return merged;
  const name = people.find(person => person.id === updates.assigneeId)?.name ?? null;
  return { ...merged, assigneeName: name, hoursOwnerId: updates.assigneeId, hoursOwnerName: name };
}
