/** El objetivo y todo lo que cuelga de él, a cualquier profundidad. */
export function descendantIds(rootId: number, rows: Array<{ id: number; parentObjectiveId: number | null }>): number[] {
  const childrenOf = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentObjectiveId == null || row.parentObjectiveId === row.id) continue;
    childrenOf.set(row.parentObjectiveId, [...(childrenOf.get(row.parentObjectiveId) ?? []), row.id]);
  }
  const out: number[] = [];
  const seen = new Set<number>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}
