import { getArgentinaPeriodKey } from "@shared/utils/timePeriod";

/** Normalize relative filters before aggregation so all consumers share BA's month. */
export function normalizeProjectTimeFilter(filter: string, now = new Date()): string {
  if (filter !== "this_month" && filter !== "last_month") return filter;
  const month = getArgentinaPeriodKey(now);
  if (filter === "this_month") return month;
  const previous = new Date(`${month}-01T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return previous.toISOString().slice(0, 7);
}
