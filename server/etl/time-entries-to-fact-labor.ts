/**
 * ETL: time_entries → fact_labor_month
 * Builds the star-schema labor table from manually entered hours (app mode).
 * Uses identical upsert pattern to sot-etl.ts so all downstream analytics work unchanged.
 */

import { db } from '../db';
import {
  timeEntries, personnel, roles, activeProjects, clients, quotations,
  exchangeRates, systemConfig, factLaborMonth, tasks, taskTimeEntries,
  financialClosePeriods,
} from '@shared/schema';
import { eq, and, gte, lte, or, isNull, inArray, sql, like } from 'drizzle-orm';
import { canon, generateProjectKey } from '../utils/normalize';
import { hourFingerprint } from "@shared/utils/hours-reconciliation";
import { ensurePeriod } from './sot-etl';

export interface BuildFactLaborResult {
  periodKey: string;
  inserted: number;
  updated: number;
  deleted: number;
  errors: string[];
  executionTimeMs: number;
  preview?: Array<{ projectId: number; personnelId: number; hours: number; costARS: number; costUSD: number | null; pendingRate: boolean; pendingFx: boolean }>;
}

type LaborRunner = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;

interface Aggregate {
  projectId: number;
  personnelId: number;
  clientName: string;
  projectName: string;
  personnelName: string;
  roleName: string | null;
  totalHours: number;
  billableHours: number;
  totalCostARS: number;
  totalCostUSD: number;
  pendingFx: boolean;
  rateSum: number;
  rateCount: number;
  fromTask: boolean;
  pendingRate: boolean;
}

/**
 * Reads the app-mode cutover date from systemConfig.
 * Returns the YYYY-MM string stored in the 'description' field of the
 * 'app_mode_cutover_date' row, or null if not set.
 */
export async function getCutoverDate(runner: LaborRunner = db): Promise<string | null> {
  const row = await runner
    .select({ description: systemConfig.description })
    .from(systemConfig)
    .where(eq(systemConfig.configKey, 'app_mode_cutover_date'))
    .limit(1)
    .then((r: any[]) => r[0]);
  return row?.description ?? null;
}

export async function buildFactLaborFromTimeEntries(periodKey: string, force?: boolean): Promise<BuildFactLaborResult> {
  return db.transaction(async tx => buildFactLaborInTransaction(periodKey, tx, force));
}

/** Shared with reconciliation so snapshots and monthly facts commit together. */
export async function buildFactLaborInTransaction(periodKey: string, runner: LaborRunner, force?: boolean, options: { dryRun?: boolean; costOverrides?: Map<string, { hourlyRateAtTime: number | null; totalCost: number | null; exchangeRateId: number | null }> } = {}): Promise<BuildFactLaborResult> {
  await runner.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
  const [mode] = await runner.select({ value: systemConfig.configValue }).from(systemConfig)
    .where(eq(systemConfig.configKey, 'hours_data_source')).for('share');
  if (mode?.value !== 1) throw new Error('El origen de horas es Excel; la conciliación automática sólo está habilitada para app.');
  const startTime = Date.now();
  const errors: string[] = [];

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error(`Invalid periodKey: ${periodKey}. Expected YYYY-MM.`);
  }

  // Cutover date guard: refuse to overwrite periods before the cutover date
  const cutoverDate = await getCutoverDate(runner);
  if (cutoverDate && periodKey < cutoverDate) {
    throw new Error(
      `Period ${periodKey} is before cutover date ${cutoverDate}. Set cutover date earlier or use Excel mode for historical periods.`,
    );
  }
  const close = await runner.select({ status: financialClosePeriods.status })
    .from(financialClosePeriods)
    .where(eq(financialClosePeriods.periodKey, periodKey))
    .limit(1)
    .then((rows: any[]) => rows[0]);
  if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) {
    throw new Error(`El período financiero ${periodKey} está ${close?.status === "CLOSED" ? "cerrado" : "en revisión"}; reabrilo antes de reconstruir costos laborales.`);
  }

  const [yearStr, monthStr] = periodKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const startDate = new Date(`${periodKey}-01T00:00:00Z`);
  const endDate = new Date(Date.UTC(year, month, 1) - 1);

  // Ensure dim_period FK exists
  if (!options.dryRun) await ensurePeriod(periodKey, runner);

  // Resolve FX for the period
  const fxRow = await runner
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.year, year),
        eq(exchangeRates.month, month),
        eq(exchangeRates.isActive, true),
      ),
    )
    .limit(1)
    .then((r: any[]) => r[0]);

  let periodFx = fxRow ? parseFloat(fxRow.rate.toString()) : 0;

  if (periodFx === 0) {
    const configFx = await runner
      .select({ configValue: systemConfig.configValue })
      .from(systemConfig)
      .where(eq(systemConfig.configKey, 'usd_exchange_rate'))
      .limit(1)
      .then((r: any[]) => r[0]);
    if (configFx?.configValue) periodFx = configFx.configValue;
  }

  // Fetch all time entries for the period with necessary JOINs
  const rows = await runner
    .select({
      id: timeEntries.id,
      projectId: timeEntries.projectId,
      personnelId: timeEntries.personnelId,
      hours: timeEntries.hours,
      entryDate: timeEntries.date,
      description: timeEntries.description,
      totalCost: timeEntries.totalCost,
      exchangeRateId: timeEntries.exchangeRateId,
      hourlyRateAtTime: timeEntries.hourlyRateAtTime,
      billable: timeEntries.billable,
      approved: timeEntries.approved,
      personnelName: personnel.name,
      roleId: personnel.roleId,
      roleName: roles.name,
      clientName: clients.name,
      // Operational project identity takes priority over shared quotations.
      quotationProjectName: quotations.projectName,
      subprojectName: activeProjects.subprojectName,
      projectName: activeProjects.name,
    })
    .from(timeEntries)
    .innerJoin(personnel, eq(timeEntries.personnelId, personnel.id))
    .innerJoin(activeProjects, eq(timeEntries.projectId, activeProjects.id))
    .innerJoin(clients, eq(activeProjects.clientId, clients.id))
    .leftJoin(roles, eq(personnel.roleId, roles.id))
    .leftJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .where(
      and(
        gte(timeEntries.date, startDate),
        lte(timeEntries.date, endDate),
        or(eq(timeEntries.approved, true), isNull(timeEntries.approved)),
        eq(timeEntries.entryType, "hours"),
      ),
    );

  const fxSnapshots = await runner.select({ id: exchangeRates.id, rate: exchangeRates.rate }).from(exchangeRates);
  const snapshotFx = new Map<number, number>(fxSnapshots.map((row: any) => [row.id, Number(row.rate)]));

  // Group by (projectId, personnelId)
  const aggregates = new Map<string, Aggregate>();
  const legacyMatches = new Map<string, number>();
  const entryFingerprint = (row: { projectId: number; personnelId: number; entryDate: Date; hours: number; description: string | null }) => hourFingerprint({ ...row, date: row.entryDate });

  for (const row of rows) {
    const override = options.costOverrides?.get(`legacy:${row.id}`);
    if (override) Object.assign(row, override);
    const fingerprint = entryFingerprint(row);
    legacyMatches.set(fingerprint, (legacyMatches.get(fingerprint) ?? 0) + 1);
    const key = `${row.projectId}::${row.personnelId}`;
    const projectName =
      row.projectName || row.quotationProjectName ||
      row.subprojectName ||
      `proyecto_${row.projectId}`;

    if (!aggregates.has(key)) {
      aggregates.set(key, {
        projectId: row.projectId,
        personnelId: row.personnelId,
        clientName: row.clientName,
        projectName,
        personnelName: row.personnelName,
        roleName: row.roleName ?? null,
        totalHours: 0,
        billableHours: 0,
        totalCostARS: 0,
        totalCostUSD: 0,
        pendingFx: false,
        rateSum: 0,
        rateCount: 0,
        fromTask: false,
        pendingRate: false,
      });
    }

    const agg = aggregates.get(key)!;
    const hours = row.hours ?? 0;
    const cost = row.totalCost ?? 0;
    const rate = row.hourlyRateAtTime ?? 0;

    agg.totalHours += hours;
    if (row.billable === true) agg.billableHours += hours;
    agg.totalCostARS += cost;
    const entryFx = row.exchangeRateId != null ? snapshotFx.get(row.exchangeRateId) ?? 0 : periodFx;
    if (entryFx > 0) agg.totalCostUSD += cost / entryFx; else agg.pendingFx = true;
    if (row.totalCost == null || row.hourlyRateAtTime == null || !(row.hourlyRateAtTime > 0)) agg.pendingRate = true;
    if (rate > 0) {
      agg.rateSum += rate;
      agg.rateCount += 1;
    }
  }

  // Also fold in hours logged against tasks (PM module). Only tasks linked to a
  // real active project participate; internal/own-project tasks have no client
  // and are excluded from fact_labor_month.
  const taskRows = await runner
    .select({
      id: taskTimeEntries.id,
      projectId: tasks.projectId,
      personnelId: taskTimeEntries.personnelId,
      hours: taskTimeEntries.hours,
      entryDate: taskTimeEntries.date,
      description: taskTimeEntries.description,
      totalCost: taskTimeEntries.totalCost,
      exchangeRateId: taskTimeEntries.exchangeRateId,
      hourlyRateAtTime: taskTimeEntries.hourlyRateAtTime,
      billable: taskTimeEntries.billable,
      personnelName: personnel.name,
      roleName: roles.name,
      clientName: clients.name,
      quotationProjectName: quotations.projectName,
      subprojectName: activeProjects.subprojectName,
      projectName: activeProjects.name,
    })
    .from(taskTimeEntries)
    .innerJoin(tasks, eq(taskTimeEntries.taskId, tasks.id))
    .innerJoin(personnel, eq(taskTimeEntries.personnelId, personnel.id))
    .innerJoin(activeProjects, eq(tasks.projectId, activeProjects.id))
    .innerJoin(clients, eq(activeProjects.clientId, clients.id))
    .leftJoin(roles, eq(personnel.roleId, roles.id))
    .leftJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .where(
      and(
        gte(taskTimeEntries.date, startDate),
        lte(taskTimeEntries.date, endDate),
      ),
    );

  for (const row of taskRows) {
    const override = options.costOverrides?.get(`task:${row.id}`);
    if (override) Object.assign(row, override);
    if (row.projectId == null) continue;
    // A user can enter the same work from the legacy hours screen and the
    // Tasks module. Keep the legacy row as the canonical one when the two
    // entries have the same project/person/day/hours/description fingerprint.
    const fingerprint = entryFingerprint({ ...row, projectId: row.projectId });
    const matchCount = legacyMatches.get(fingerprint) ?? 0;
    if (matchCount > 0) { legacyMatches.set(fingerprint, matchCount - 1); continue; }
    const key = `${row.projectId}::${row.personnelId}`;
    const projectName =
      row.projectName || row.quotationProjectName ||
      row.subprojectName ||
      `proyecto_${row.projectId}`;

    if (!aggregates.has(key)) {
      aggregates.set(key, {
        projectId: row.projectId,
        personnelId: row.personnelId,
        clientName: row.clientName,
        projectName,
        personnelName: row.personnelName,
        roleName: row.roleName ?? null,
        totalHours: 0,
        billableHours: 0,
        totalCostARS: 0,
        totalCostUSD: 0,
        pendingFx: false,
        rateSum: 0,
        rateCount: 0,
        fromTask: false,
        pendingRate: false,
      });
    }

    const agg = aggregates.get(key)!;
    const hours = row.hours ?? 0;
    const cost = row.totalCost ?? 0;
    const rate = row.hourlyRateAtTime ?? 0;

    agg.totalHours += hours;
    if (row.billable === true) agg.billableHours += hours;
    agg.totalCostARS += cost;
    const entryFx = row.exchangeRateId != null ? snapshotFx.get(row.exchangeRateId) ?? 0 : periodFx;
    if (entryFx > 0) agg.totalCostUSD += cost / entryFx; else agg.pendingFx = true;
    if (row.totalCost == null || row.hourlyRateAtTime == null || !(row.hourlyRateAtTime > 0)) agg.pendingRate = true;
    if (rate > 0) {
      agg.rateSum += rate;
      agg.rateCount += 1;
    }
    agg.fromTask = true;
  }

  if (options.dryRun) return {
    periodKey, inserted: 0, updated: 0, deleted: 0, errors: [], executionTimeMs: Date.now() - startTime,
    preview: [...aggregates.values()].map(agg => ({ projectId: agg.projectId, personnelId: agg.personnelId, hours: agg.totalHours, costARS: agg.totalCostARS, costUSD: agg.pendingFx && agg.totalCostUSD === 0 ? null : agg.totalCostUSD, pendingRate: agg.pendingRate, pendingFx: agg.pendingFx })),
  };

  let inserted = 0;
  let updated = 0;
  let deleted = 0;

  // Remove app-owned facts that no longer have any source entries. Without
  // this, deleting the final entry for a project/person left a stale monthly
  // cost forever because the upsert loop simply had nothing to process.
  const aggregateKeys = new Set(
    Array.from(aggregates.values()).map((agg) => `${agg.projectId}::${agg.personnelId}`),
  );
  const existingAppFacts = await runner
    .select({
      id: factLaborMonth.id,
      projectId: factLaborMonth.projectId,
      personId: factLaborMonth.personId,
    })
    .from(factLaborMonth)
    .where(and(
      eq(factLaborMonth.periodKey, periodKey),
      sql`${factLaborMonth.flags} @> '["source_app"]'::jsonb`,
    ));
  const staleFactIds = existingAppFacts
    .filter((fact: any) => fact.personId == null || !aggregateKeys.has(`${fact.projectId}::${fact.personId}`))
    .map((fact: any) => fact.id);
  if (staleFactIds.length > 0) {
    const removed = await runner
      .delete(factLaborMonth)
      .where(inArray(factLaborMonth.id, staleFactIds))
      .returning({ id: factLaborMonth.id });
    deleted = removed.length;
  }

  for (const agg of aggregates.values()) {
    try {
      const clientKey = canon(agg.clientName);
      const projectKey = generateProjectKey(agg.clientName, agg.projectName);
      const personKey = canon(agg.personnelName);
      const avgRate = agg.rateCount > 0 ? agg.rateSum / agg.rateCount : 0;
      const costUSD = agg.totalCostUSD;

      const flags: string[] = ['source_app'];
      if (agg.fromTask) flags.push('source_task');
      if (agg.pendingFx) flags.push('missing_fx', 'partial_cost');
      if (agg.pendingRate) flags.push('missing_rate', 'partial_cost');
      flags.push('no_target_hours');

      const values = {
        projectId: agg.projectId,
        personId: agg.personnelId,
        periodKey,
        clientKey,
        projectKey,
        personKey,
        targetHours: '0',
        asanaHours: agg.totalHours.toFixed(2),
        billingHours: agg.billableHours.toFixed(2),
        hourlyRateARS: avgRate > 0 ? avgRate.toFixed(2) : null,
        costARS: agg.totalCostARS.toFixed(2),
        costUSD: costUSD > 0 || !agg.pendingFx ? costUSD.toFixed(2) : null,
        fx: periodFx > 0 ? periodFx.toFixed(4) : null,
        roleName: agg.roleName,
        flags,
        unresolvedPerson: false,
        sourceRowId: `app_${periodKey}_${agg.projectId}_${agg.personnelId}`,
      };

      // Check if row exists to track inserted vs updated
      const existing = await runner
        .select({ id: factLaborMonth.id })
        .from(factLaborMonth)
        .where(
          and(
            eq(factLaborMonth.projectId, agg.projectId),
            eq(factLaborMonth.personKey, personKey),
            eq(factLaborMonth.periodKey, periodKey),
          ),
        )
        .limit(1)
        .then((r: any[]) => r[0]);

      await runner
        .insert(factLaborMonth)
        .values(values)
        .onConflictDoUpdate({
          target: [factLaborMonth.projectId, factLaborMonth.personKey, factLaborMonth.periodKey],
          set: {
            personId: values.personId,
            asanaHours: values.asanaHours,
            billingHours: values.billingHours,
            hourlyRateARS: values.hourlyRateARS,
            costARS: values.costARS,
            costUSD: values.costUSD,
            fx: values.fx,
            roleName: values.roleName,
            flags: values.flags,
            sourceRowId: values.sourceRowId,
            loadedAt: new Date(),
          },
        });

      if (existing) {
        updated++;
      } else {
        inserted++;
      }
    } catch (err) {
      const msg = `Error upserting project=${agg.projectId} person=${agg.personnelId}: ${String(err)}`;
      throw new Error(msg);
    }
  }

  await runner.update(taskTimeEntries).set({ costSyncPending: false }).where(and(gte(taskTimeEntries.date, startDate), lte(taskTimeEntries.date, endDate)));
  await runner.delete(systemConfig).where(like(systemConfig.configKey, `task_cost_sync:${periodKey}:%`));
  return {
    periodKey,
    inserted,
    updated,
    deleted,
    errors,
    executionTimeMs: Date.now() - startTime,
  };
}
