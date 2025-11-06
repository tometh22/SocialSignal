import { db } from "../db";
import { factLaborMonth, aggProjectMonth, dimPeriod } from "@shared/schema";
import { sql, desc, or, gt } from "drizzle-orm";

export interface PeriodInfo {
  periodKey: string;
  year: number;
  month: number;
  hasData: boolean;
}

export interface AvailablePeriodsResult {
  defaultPeriod: string | null;
  availablePeriods: PeriodInfo[];
}

/**
 * Detecta si un período tiene datos reales (no vacío)
 * Un período se considera "real" cuando tiene:
 * - Horas Asana > 0
 * - Revenue > 0
 * - Costos > 0
 * - Personnel count > 0
 */
async function getPeriodWithData(periodKey: string): Promise<boolean> {
  // Check fact_labor_month for hours
  const laborData = await db
    .select({
      totalHours: sql<number>`COALESCE(SUM(${factLaborMonth.asanaHours}), 0)`,
    })
    .from(factLaborMonth)
    .where(sql`${factLaborMonth.periodKey} = ${periodKey}`);

  if (laborData.length > 0 && Number(laborData[0].totalHours) > 0) {
    return true;
  }

  // Check agg_project_month for revenue/costs
  const aggData = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${aggProjectMonth.viewConsolidadaRevenue}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(${aggProjectMonth.totalCostUSD}), 0)`,
    })
    .from(aggProjectMonth)
    .where(sql`${aggProjectMonth.periodKey} = ${periodKey}`);

  if (aggData.length > 0) {
    const revenue = Number(aggData[0].totalRevenue);
    const cost = Number(aggData[0].totalCost);
    if (revenue > 0 || cost > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Resuelve los períodos disponibles y el período por defecto (último con datos)
 */
export async function resolveAvailablePeriods(): Promise<AvailablePeriodsResult> {
  // Get all distinct periods from both fact tables, ordered descending
  const periodsFromFact = await db
    .selectDistinct({
      periodKey: factLaborMonth.periodKey,
    })
    .from(factLaborMonth);

  const periodsFromAgg = await db
    .selectDistinct({
      periodKey: aggProjectMonth.periodKey,
    })
    .from(aggProjectMonth);

  // Combine and deduplicate
  const allPeriodKeys = new Set<string>();
  periodsFromFact.forEach(p => allPeriodKeys.add(p.periodKey));
  periodsFromAgg.forEach(p => allPeriodKeys.add(p.periodKey));

  // Sort descending (newest first)
  const sortedPeriods = Array.from(allPeriodKeys).sort().reverse();

  // For each period, check if it has real data
  const periodsWithStatus: PeriodInfo[] = [];
  let defaultPeriod: string | null = null;

  for (const periodKey of sortedPeriods) {
    const hasData = await getPeriodWithData(periodKey);
    
    // Extract year and month from periodKey (format: YYYY-MM)
    const [year, month] = periodKey.split('-').map(Number);
    
    periodsWithStatus.push({
      periodKey,
      year,
      month,
      hasData,
    });

    // Set default to the first period with data
    if (!defaultPeriod && hasData) {
      defaultPeriod = periodKey;
    }
  }

  return {
    defaultPeriod,
    availablePeriods: periodsWithStatus,
  };
}

/**
 * Obtiene el período por defecto (último con datos) de forma optimizada
 * Si no hay ningún período con datos, devuelve el más reciente disponible
 */
export async function getDefaultPeriod(): Promise<string | null> {
  // Get all periods with any data, ordered descending
  const periodsWithLabor = await db
    .select({
      periodKey: factLaborMonth.periodKey,
      totalHours: sql<number>`SUM(${factLaborMonth.asanaHours})`,
    })
    .from(factLaborMonth)
    .groupBy(factLaborMonth.periodKey)
    .having(gt(sql`SUM(${factLaborMonth.asanaHours})`, 0))
    .orderBy(desc(factLaborMonth.periodKey));

  if (periodsWithLabor.length > 0) {
    return periodsWithLabor[0].periodKey;
  }

  const periodsWithAgg = await db
    .select({
      periodKey: aggProjectMonth.periodKey,
      totalRevenue: sql<number>`SUM(${aggProjectMonth.viewConsolidadaRevenue})`,
    })
    .from(aggProjectMonth)
    .groupBy(aggProjectMonth.periodKey)
    .having(gt(sql`SUM(${aggProjectMonth.viewConsolidadaRevenue})`, 0))
    .orderBy(desc(aggProjectMonth.periodKey));

  if (periodsWithAgg.length > 0) {
    return periodsWithAgg[0].periodKey;
  }

  // Fallback: return the most recent period in dim_period
  const mostRecent = await db
    .select({ periodKey: dimPeriod.periodKey })
    .from(dimPeriod)
    .orderBy(desc(dimPeriod.periodKey))
    .limit(1);

  return mostRecent.length > 0 ? mostRecent[0].periodKey : null;
}
