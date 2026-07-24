export type WeeklyEstimateLike = {
  taskId: number;
  weekStart: string;
  estimatedHours: number;
};

export type EstimateRange = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

function civilDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function addCivilDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** A weekly estimate participates when any day of its Monday-Sunday week is in the range. */
export function weeklyEstimateOverlapsRange(
  weekStart: string,
  range: EstimateRange = {},
): boolean {
  const weekStartKey = civilDateKey(weekStart);
  if (!weekStartKey) return false;
  const weekEndKey = addCivilDays(weekStartKey, 6);
  const fromKey = civilDateKey(range.dateFrom);
  const toKey = civilDateKey(range.dateTo);
  if (fromKey && weekEndKey < fromKey) return false;
  if (toKey && weekStartKey > toKey) return false;
  return true;
}

export function aggregateWeeklyEstimatesByTask(
  estimates: WeeklyEstimateLike[],
  range: EstimateRange = {},
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const estimate of estimates) {
    if (!weeklyEstimateOverlapsRange(estimate.weekStart, range)) continue;
    totals.set(
      estimate.taskId,
      (totals.get(estimate.taskId) ?? 0) + Number(estimate.estimatedHours || 0),
    );
  }
  return totals;
}
