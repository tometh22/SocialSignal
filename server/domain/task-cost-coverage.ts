import { reconcileHourSources, hoursCivilDate } from "@shared/utils/hours-reconciliation";
import { db } from "../db";
import { tasks, taskTimeEntries, timeEntries, exchangeRates, systemConfig } from "@shared/schema";
import { and, eq, gte, lt, isNull, or, sql, like } from "drizzle-orm";
import { hoursCivilBoundary } from "./personal-hours";
import { getHoursDataSource } from "../utils/dataSourceMode";
import { isValidCivilDate } from "@shared/utils/task-civil-date";

export type TaskCostCoverage = { syncPending?: boolean; pendingHours: number; pendingRate: number; pendingFx: number; pendingSync: number; calculatedHours: number };
export type TaskCostPeriod = string | string[] | { start: string; end: string };
export async function taskCostCoverage(period: TaskCostPeriod, projectId?: number): Promise<Map<number, TaskCostCoverage>> {
  const conditions = [], legacyConditions = [eq(timeEntries.entryType, "hours"), or(eq(timeEntries.approved, true), isNull(timeEntries.approved))];
  if (projectId) { conditions.push(eq(tasks.projectId, projectId)); legacyConditions.push(eq(timeEntries.projectId, projectId)); }
  const range = typeof period === "object" && !Array.isArray(period) ? period : null;
  const periods = (Array.isArray(period) ? period : typeof period === "string" ? [period] : []).filter(p => /^\d{4}-\d{2}$/.test(p)).sort();
  if (range) {
    if (!isValidCivilDate(range.start) || !isValidCivilDate(range.end) || range.start > range.end) throw new Error("Rango de costos inválido");
    const from = hoursCivilBoundary(range.start), to = hoursCivilBoundary(range.end, true);
    conditions.push(gte(taskTimeEntries.date, from), lt(taskTimeEntries.date, to));
    legacyConditions.push(gte(timeEntries.date, from), lt(timeEntries.date, to));
  } else if (periods.length) {
    const first = periods[0], last = periods[periods.length - 1];
    const next = new Date(`${last}-01T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
    conditions.push(gte(taskTimeEntries.date, hoursCivilBoundary(`${first}-01`)), lt(taskTimeEntries.date, hoursCivilBoundary(next.toISOString().slice(0, 10))));
    legacyConditions.push(gte(timeEntries.date, hoursCivilBoundary(`${first}-01`)), lt(timeEntries.date, hoursCivilBoundary(next.toISOString().slice(0, 10))));
  }
  const [taskEntries, legacyEntries, rates, [configured], mode] = await Promise.all([
    db.select({ projectId: tasks.projectId, personnelId: taskTimeEntries.personnelId, description: taskTimeEntries.description, exchangeRateId: taskTimeEntries.exchangeRateId, date: taskTimeEntries.date, hours: taskTimeEntries.hours, rate: taskTimeEntries.hourlyRateAtTime, cost: taskTimeEntries.totalCost, pendingSync: taskTimeEntries.costSyncPending }).from(taskTimeEntries).innerJoin(tasks, eq(tasks.id, taskTimeEntries.taskId)).where(and(...conditions)),
    db.select({ projectId: timeEntries.projectId, personnelId: timeEntries.personnelId, description: timeEntries.description, exchangeRateId: timeEntries.exchangeRateId, date: timeEntries.date, hours: timeEntries.hours, rate: timeEntries.hourlyRateAtTime, cost: timeEntries.totalCost, pendingSync: sql<boolean>`false` }).from(timeEntries).where(and(...legacyConditions)),
    db.select().from(exchangeRates),
    db.select({ value: systemConfig.configValue }).from(systemConfig).where(eq(systemConfig.configKey, "usd_exchange_rate")).limit(1),
    getHoursDataSource(),
  ]);
  const fx = new Map(rates.filter(r => r.isActive).map(r => [`${r.year}-${String(r.month).padStart(2, "0")}`, Number(r.rate)]));
  const result = new Map<number, TaskCostCoverage>();
  const snapshotFx = new Map(rates.map(r => [r.id, Number(r.rate)]));
  for (const entry of reconcileHourSources(taskEntries, legacyEntries)) {
    const current = result.get(entry.projectId) ?? { pendingHours: 0, pendingRate: 0, pendingFx: 0, pendingSync: 0, calculatedHours: 0 };
    const missingRate = entry.cost == null || entry.rate == null || !(entry.rate > 0);
    const entryFx = entry.exchangeRateId != null ? snapshotFx.get(entry.exchangeRateId) : fx.get(hoursCivilDate(entry.date).slice(0, 7)) ?? Number(configured?.value);
    const missingFx = !(entryFx != null && entryFx > 0);
    const pendingSync = (mode !== "app" && taskEntries.includes(entry as any)) || entry.pendingSync;
    if (missingRate) current.pendingRate += entry.hours;
    if (missingFx) current.pendingFx += entry.hours;
    if (pendingSync) current.pendingSync += entry.hours;
    if (missingRate || missingFx || pendingSync) current.pendingHours += entry.hours;
    else current.calculatedHours += entry.hours;
    result.set(entry.projectId, current);
  }
  // Survives deletion of a final entry: zero remaining hours can still leave stale facts.
  const pendingPeriods = await db.select({ key: systemConfig.configKey }).from(systemConfig)
    .where(and(like(systemConfig.configKey, 'task_cost_sync:%'), eq(systemConfig.configValue, 1)));
  for (const row of pendingPeriods) {
    const [, pendingPeriod, id] = row.key.split(":");
    const pendingProjectId = Number(id);
    if ((projectId && pendingProjectId !== projectId) || (periods.length && !periods.includes(pendingPeriod)) ||
      (range && (pendingPeriod < range.start.slice(0, 7) || pendingPeriod > range.end.slice(0, 7)))) continue;
    const coverage = result.get(pendingProjectId) ?? { pendingHours: 0, pendingRate: 0, pendingFx: 0, pendingSync: 0, calculatedHours: 0 };
    coverage.syncPending = true;
    result.set(pendingProjectId, coverage);
  }
  return result;
}
