export type QuotationActualEntry = {
  projectId: number; personnelId: number; entryDate: Date | string;
  hours: number; description: string | null; totalCost: number | null;
};

/** Match mirrored legacy/task rows one-to-one. A separate entry in either ledger is still work. */
export function mergeQuotationActualEntries(legacy: QuotationActualEntry[], task: QuotationActualEntry[]) {
  const fingerprint = (entry: QuotationActualEntry) => JSON.stringify([
    entry.projectId, entry.personnelId, new Date(entry.entryDate).toISOString().slice(0, 10),
    Number(entry.hours).toFixed(4), (entry.description ?? "").trim().toLowerCase(),
  ]);
  const remaining = new Map<string, number>();
  legacy.forEach(entry => {
    const key = fingerprint(entry);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  });
  return [...legacy, ...task.filter(entry => {
    const key = fingerprint(entry);
    const matches = remaining.get(key) ?? 0;
    if (!matches) return true;
    remaining.set(key, matches - 1);
    return false;
  })];
}
