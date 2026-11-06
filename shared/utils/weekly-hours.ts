import { currentBuenosAiresWeek } from "./buenos-aires-week";
import { hoursCivilDate } from "./hours-reconciliation";

export type WeeklyHours = { week: string; hours: number; estimatedHours: number };

/** Inputs must already share the dashboard's period, person, project and section scope. */
export function summarizeWeeklyHours(
  entries: { date: Date | string; hours: number }[],
  estimates: { weekStart: string; estimatedHours: number }[],
): WeeklyHours[] {
  const weeks = new Map<string, WeeklyHours>();
  const getWeek = (week: string) => {
    if (!weeks.has(week)) weeks.set(week, { week, hours: 0, estimatedHours: 0 });
    return weeks.get(week)!;
  };
  for (const entry of entries) {
    const week = currentBuenosAiresWeek(new Date(`${hoursCivilDate(entry.date)}T12:00:00Z`)).from;
    getWeek(week).hours += Number(entry.hours);
  }
  for (const estimate of estimates) {
    getWeek(estimate.weekStart.slice(0, 10)).estimatedHours += Number(estimate.estimatedHours);
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
}
