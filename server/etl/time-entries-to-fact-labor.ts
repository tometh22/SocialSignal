/**
 * ETL: time_entries → fact_labor_month
 * Builds the star-schema labor table from manually entered hours (app mode).
 * Uses identical upsert pattern to sot-etl.ts so all downstream analytics work unchanged.
 */

import { db } from '../db';
import {
  timeEntries, personnel, roles, activeProjects, clients, quotations,
  exchangeRates, systemConfig, factLaborMonth,
} from '@shared/schema';
import { eq, and, gte, lte, or, isNull } from 'drizzle-orm';
import { canon, generateProjectKey } from '../utils/normalize';
import { ensurePeriod } from './sot-etl';

export interface BuildFactLaborResult {
  periodKey: string;
  inserted: number;
  updated: number;
  errors: string[];
  executionTimeMs: number;
}

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
  rateSum: number;
  rateCount: number;
}

export async function buildFactLaborFromTimeEntries(
  periodKey: string,
  force?: boolean,
): Promise<BuildFactLaborResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error(`Invalid periodKey: ${periodKey}. Expected YYYY-MM.`);
  }

  const [yearStr, monthStr] = periodKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Ensure dim_period FK exists
  await ensurePeriod(periodKey);

  // Resolve FX for the period
  const fxRow = await db
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
    .then((r) => r[0]);

  let periodFx = fxRow ? parseFloat(fxRow.rate.toString()) : 0;

  if (periodFx === 0) {
    const configFx = await db
      .select({ configValue: systemConfig.configValue })
      .from(systemConfig)
      .where(eq(systemConfig.configKey, 'usd_exchange_rate'))
      .limit(1)
      .then((r) => r[0]);
    if (configFx?.configValue) periodFx = configFx.configValue;
  }

  // Fetch all time entries for the period with necessary JOINs
  const rows = await db
    .select({
      projectId: timeEntries.projectId,
      personnelId: timeEntries.personnelId,
      hours: timeEntries.hours,
      totalCost: timeEntries.totalCost,
      hourlyRateAtTime: timeEntries.hourlyRateAtTime,
      billable: timeEntries.billable,
      approved: timeEntries.approved,
      personnelName: personnel.name,
      roleId: personnel.roleId,
      roleName: roles.name,
      clientName: clients.name,
      // Project name: prefer quotation name, fallback to subprojectName, then ID-based key
      quotationProjectName: quotations.projectName,
      subprojectName: activeProjects.subprojectName,
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
      ),
    );

  // Group by (projectId, personnelId)
  const aggregates = new Map<string, Aggregate>();

  for (const row of rows) {
    const key = `${row.projectId}::${row.personnelId}`;
    const projectName =
      row.quotationProjectName ||
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
        rateSum: 0,
        rateCount: 0,
      });
    }

    const agg = aggregates.get(key)!;
    const hours = row.hours ?? 0;
    const cost = row.totalCost ?? 0;
    const rate = row.hourlyRateAtTime ?? 0;

    agg.totalHours += hours;
    if (row.billable !== false) agg.billableHours += hours;
    agg.totalCostARS += cost;
    if (rate > 0) {
      agg.rateSum += rate;
      agg.rateCount += 1;
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const agg of aggregates.values()) {
    try {
      const clientKey = canon(agg.clientName);
      const projectKey = generateProjectKey(agg.clientName, agg.projectName);
      const personKey = canon(agg.personnelName);
      const avgRate = agg.rateCount > 0 ? agg.rateSum / agg.rateCount : 0;
      const costUSD = periodFx > 0 ? agg.totalCostARS / periodFx : 0;

      const flags: string[] = ['source_app'];
      if (periodFx === 0) flags.push('missing_fx');
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
        costUSD: costUSD.toFixed(2),
        fx: periodFx > 0 ? periodFx.toFixed(4) : null,
        roleName: agg.roleName,
        flags,
        unresolvedPerson: false,
        sourceRowId: `app_${periodKey}_${agg.projectId}_${agg.personnelId}`,
      };

      // Check if row exists to track inserted vs updated
      const existing = await db
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
        .then((r) => r[0]);

      await db
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
      errors.push(msg);
      console.error('[time-entries-to-fact-labor]', msg);
    }
  }

  return {
    periodKey,
    inserted,
    updated,
    errors,
    executionTimeMs: Date.now() - startTime,
  };
}
