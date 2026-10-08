import { and, eq, gte, lt, lte, or, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { tasks, taskTimeEntries, timeEntries, systemConfig, financialClosePeriods } from "@shared/schema";
import { resolveCanonicalPersonnelRate } from "./personnel-rate";
import { hoursCivilBoundary } from "./personal-hours";
import { getCutoverDate, buildFactLaborInTransaction } from "../etl/time-entries-to-fact-labor";

export function reconciliationBlockers(period: string, mode: number | null | undefined, cutover: string | null, status?: string) {
  const reasons: string[] = [];
  if (mode !== 1) reasons.push("Origen Excel: no se modifica su contabilidad");
  if (cutover && period < cutover) reasons.push(`Período anterior al corte ${cutover}`);
  if (status === "IN_REVIEW" || status === "CLOSED") reasons.push("Período cerrado o en revisión");
  return reasons;
}

/** Preview by default. A whole period is reconciled atomically; valid snapshots remain untouched. */
export async function reconcileTaskCosts(period: string, apply = false) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Indicá un período YYYY-MM válido");
  const next = new Date(`${period}-01T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  const from = hoursCivilBoundary(`${period}-01`), to = hoursCivilBoundary(next.toISOString().slice(0, 10));
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + period}))`);
    const [mode] = await tx.select({ value: systemConfig.configValue }).from(systemConfig).where(eq(systemConfig.configKey, "hours_data_source")).for("share");
    const [close] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, period)).for("share");
    const blockers = reconciliationBlockers(period, mode?.value, await getCutoverDate(tx), close?.status);
    const taskEntries = await tx.select({ entry: taskTimeEntries, projectId: tasks.projectId }).from(taskTimeEntries).innerJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
      .where(and(gte(taskTimeEntries.date, from), lt(taskTimeEntries.date, to), or(lte(taskTimeEntries.hourlyRateAtTime, 0), isNull(taskTimeEntries.hourlyRateAtTime), isNull(taskTimeEntries.totalCost), eq(taskTimeEntries.costSyncPending, true))))
      .for("update", { of: taskTimeEntries });
    const legacyEntries = await tx.select().from(timeEntries).where(and(
      gte(timeEntries.date, from), lt(timeEntries.date, to), eq(timeEntries.entryType, "hours"),
      or(eq(timeEntries.approved, true), isNull(timeEntries.approved)),
      or(lte(timeEntries.hourlyRateAtTime, 0), isNull(timeEntries.hourlyRateAtTime), isNull(timeEntries.totalCost)),
    )).for("update");
    const entries = [...taskEntries.map(row => ({ ...row, source: "task" as const })), ...legacyEntries.map(entry => ({ entry, projectId: entry.projectId, source: "legacy" as const }))];
    const preview = [];
    for (const { entry, projectId, source } of entries) {
      const validSnapshot = entry.hourlyRateAtTime != null && entry.hourlyRateAtTime > 0 && entry.totalCost != null;
      const rate = validSnapshot ? null : await resolveCanonicalPersonnelRate(entry.personnelId, entry.date);
      const resolvedRate = entry.hourlyRateAtTime != null && entry.hourlyRateAtTime > 0 ? entry.hourlyRateAtTime : rate?.hourlyRateARS ?? null;
      const totalCost = validSnapshot ? entry.totalCost : resolvedRate != null ? entry.hours * resolvedRate : null;
      preview.push({ source, id: entry.id, projectId, hours: entry.hours, preserveSnapshot: validSnapshot, hourlyRateARS: resolvedRate, totalCostARS: totalCost, pending: rate?.error ?? null, exchangeRateId: entry.exchangeRateId ?? rate?.exchangeRateId ?? null });
    }
    if (blockers.length) return { period, applied: false, blockers, entries: preview };
    if (!apply) {
      const costOverrides = new Map(preview.filter(item => item.totalCostARS != null && item.hourlyRateARS != null).map(item => [`${item.source}:${item.id}`, { hourlyRateAtTime: item.hourlyRateARS, totalCost: item.totalCostARS, exchangeRateId: item.exchangeRateId }]));
      const proposed = await buildFactLaborInTransaction(period, tx, undefined, { dryRun: true, costOverrides });
      return { period, applied: false, blockers, entries: preview, proposedMonthlyFacts: proposed.preview ?? [] };
    }
    for (const item of preview) {
      if (item.totalCostARS == null || item.hourlyRateARS == null || item.preserveSnapshot) continue;
      if (item.source === "task") await tx.update(taskTimeEntries).set({ hourlyRateAtTime: item.hourlyRateARS, totalCost: item.totalCostARS, exchangeRateId: item.exchangeRateId }).where(eq(taskTimeEntries.id, item.id));
      else await tx.update(timeEntries).set({ hourlyRateAtTime: item.hourlyRateARS, totalCost: item.totalCostARS, exchangeRateId: item.exchangeRateId }).where(eq(timeEntries.id, item.id));
    }
    const rebuilt = await buildFactLaborInTransaction(period, tx);
    await tx.update(taskTimeEntries).set({ costSyncPending: false }).where(and(gte(taskTimeEntries.date, from), lt(taskTimeEntries.date, to)));
    return { period, applied: true, blockers, entries: preview, rebuilt };
  });
}
