
export type HourRecord = { projectId: number | null; personnelId: number; date: Date | string; hours: number; description?: string | null };
/** Entry dates are civil dates (legacy midnight and app timestamps included), never instants. */
export function hoursCivilDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}
export function hourFingerprint(entry: HourRecord): string {
  const date = hoursCivilDate(entry.date);
  return [entry.projectId, entry.personnelId, date, Number(entry.hours).toFixed(4), (entry.description ?? "").trim().toLowerCase()].join("|");
}
/** Match only across sources, one-to-one. Repeated work within either source remains valid. */
export function reconcileHourSources<T extends HourRecord, L extends HourRecord>(task: T[], legacy: L[]): Array<T | L> {
  const remaining = new Map<string, number>();
  for (const entry of legacy) {
    const key = hourFingerprint(entry);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return [...legacy, ...task.filter(entry => {
    const key = hourFingerprint(entry), count = remaining.get(key) ?? 0;
    if (!count) return true;
    remaining.set(key, count - 1);
    return false;
  })];
}

