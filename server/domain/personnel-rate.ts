import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { exchangeRates, personnelHistoricalCosts, systemConfig } from "@shared/schema";

export type CanonicalPersonnelRate = {
  hourlyRateARS: number | null;
  hourlyRateUSD: number | null;
  exchangeRate: number | null;
  exchangeRateId: number | null;
  sourcePeriod: string | null;
  error: "missing_rate" | "missing_fx" | null;
};

/**
 * Resolves the historical hourly rate in force on a civil date.
 *
 * personnel_historical_costs is the only rate source. A USD-only rate is
 * converted with the active exchange rate for the entry month, falling back to
 * the explicit global USD/ARS configuration when that month has no FX row.
 * Legacy personnel rate columns are never used.
 */
export async function resolveCanonicalPersonnelRate(
  personnelId: number,
  date: Date,
): Promise<CanonicalPersonnelRate> {
  const entryPeriod = date.getFullYear() * 100 + (date.getMonth() + 1);
  const [historicalRate] = await db
    .select({
      year: personnelHistoricalCosts.year,
      month: personnelHistoricalCosts.month,
      hourlyRateARS: personnelHistoricalCosts.hourlyRateARS,
      hourlyRateUSD: personnelHistoricalCosts.hourlyRateUSD,
    })
    .from(personnelHistoricalCosts)
    .where(and(
      eq(personnelHistoricalCosts.personnelId, personnelId),
      eq(personnelHistoricalCosts.isActive, true),
      sql`(${personnelHistoricalCosts.year} * 100 + ${personnelHistoricalCosts.month}) <= ${entryPeriod}`,
    ))
    .orderBy(
      desc(personnelHistoricalCosts.year),
      desc(personnelHistoricalCosts.month),
    )
    .limit(1);

  if (!historicalRate) {
    return {
      hourlyRateARS: null,
      hourlyRateUSD: null,
      exchangeRate: null,
      exchangeRateId: null,
      sourcePeriod: null,
      error: "missing_rate",
    };
  }

  const hourlyRateARS = historicalRate.hourlyRateARS == null
    ? null
    : Number(historicalRate.hourlyRateARS);
  const hourlyRateUSD = historicalRate.hourlyRateUSD == null
    ? null
    : Number(historicalRate.hourlyRateUSD);
  const sourcePeriod = `${historicalRate.year}-${String(historicalRate.month).padStart(2, "0")}`;

  if (hourlyRateARS != null && hourlyRateARS > 0) {
    return {
      hourlyRateARS,
      hourlyRateUSD,
      exchangeRate: null,
      exchangeRateId: null,
      sourcePeriod,
      error: null,
    };
  }

  if (hourlyRateUSD != null && hourlyRateUSD > 0) {
    const [fx] = await db
      .select({ id: exchangeRates.id, rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(and(
        eq(exchangeRates.year, date.getFullYear()),
        eq(exchangeRates.month, date.getMonth() + 1),
        eq(exchangeRates.isActive, true),
      ))
      .limit(1);
    let exchangeRate = fx ? Number(fx.rate) : null;
    if (!(exchangeRate && exchangeRate > 0)) {
      const [globalFx] = await db
        .select({ rate: systemConfig.configValue })
        .from(systemConfig)
        .where(eq(systemConfig.configKey, "usd_exchange_rate"))
        .limit(1);
      exchangeRate = globalFx ? Number(globalFx.rate) : null;
    }
    if (exchangeRate != null && exchangeRate > 0) {
      return {
        hourlyRateARS: hourlyRateUSD * exchangeRate,
        hourlyRateUSD,
        exchangeRate,
        exchangeRateId: fx?.id ?? null,
        sourcePeriod,
        error: null,
      };
    }
    return {
      hourlyRateARS: null,
      hourlyRateUSD,
      exchangeRate: null,
      exchangeRateId: null,
      sourcePeriod,
      error: "missing_fx",
    };
  }

  return {
    hourlyRateARS: null,
    hourlyRateUSD,
    exchangeRate: null,
    exchangeRateId: null,
    sourcePeriod,
    error: "missing_rate",
  };
}

export function canonicalRateErrorMessage(
  result: CanonicalPersonnelRate,
  date: Date,
): string | null {
  if (result.error === "missing_fx") {
    return `No hay cotización activa para ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}.`;
  }
  if (result.error === "missing_rate") {
    return "No hay una tarifa histórica vigente para la persona y fecha seleccionadas.";
  }
  return null;
}
