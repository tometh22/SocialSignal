import { db } from "../db";
import { tasks, taskTimeEntries, timeEntries, activeProjects, quotations } from "@shared/schema";
import { and, eq, gte, lt, or, isNull } from "drizzle-orm";
import { reconcileHourSources, hoursCivilDate } from "@shared/utils/hours-reconciliation";
import { civilDateInBuenosAires, currentBuenosAiresWeek } from "@shared/utils/buenos-aires-week";

export function hoursCivilBoundary(day: string, end = false): Date {
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function getPersonalHours(personnelId: number, now = new Date()) {
  const today = civilDateInBuenosAires(now), week = currentBuenosAiresWeek(now);
  const monthFrom = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthFrom}T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthTo = nextMonth.toISOString().slice(0, 10);
  const from = hoursCivilBoundary(week.from < monthFrom ? week.from : monthFrom);
  const end = hoursCivilBoundary(monthTo > week.to ? monthTo : week.to, monthTo <= week.to);
  const [taskRows, legacyRows] = await Promise.all([
    db.select({ id: taskTimeEntries.id, projectId: tasks.projectId, personnelId: taskTimeEntries.personnelId, date: taskTimeEntries.date, hours: taskTimeEntries.hours, description: taskTimeEntries.description })
      .from(taskTimeEntries).innerJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
      .where(and(eq(taskTimeEntries.personnelId, personnelId), gte(taskTimeEntries.date, from), lt(taskTimeEntries.date, end))),
    db.select().from(timeEntries).where(and(eq(timeEntries.personnelId, personnelId), gte(timeEntries.date, from), lt(timeEntries.date, end), or(eq(timeEntries.approved, true), isNull(timeEntries.approved)), eq(timeEntries.entryType, "hours"))),
  ]);
  const entries = reconcileHourSources(taskRows, legacyRows);
  const monthEntries = entries.filter(e => { const day = hoursCivilDate(e.date); return day >= monthFrom && day < monthTo; });
  const projects = await db.select({ id: activeProjects.id, name: activeProjects.name, quotationName: quotations.projectName }).from(activeProjects).leftJoin(quotations, eq(activeProjects.quotationId, quotations.id));
  const names = new Map(projects.map(p => [p.id, p.name || p.quotationName || `Proyecto #${p.id}`]));
  const totals = new Map<number | null, number>();
  for (const entry of monthEntries) totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.hours);
  return {
    weekHours: entries.filter(e => { const day = hoursCivilDate(e.date); return day >= week.from && day <= week.to; }).reduce((sum, e) => sum + e.hours, 0),
    monthHours: monthEntries.reduce((sum, e) => sum + e.hours, 0),
    byProject: [...totals].map(([projectId, hours]) => ({ projectId, projectName: projectId ? names.get(projectId) || `Proyecto #${projectId}` : "Sin proyecto", hours })).sort((a, b) => b.hours - a.hours),
  };
}
