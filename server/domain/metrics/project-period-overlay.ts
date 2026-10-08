import type { FinancialProjectMetrics } from "../view-aggregator";

/** Replace every financial alias together so consumers cannot prefer stale legacy values. */
export function withProjectPeriodMetrics<T extends object>(previous: T, period: FinancialProjectMetrics) {
  const current = period.metrics;
  return {
    ...previous,
    revenueDisplay: { amount: current.revenueDisplay, currency: period.currencyNative },
    costDisplay: { amount: current.costDisplay, currency: period.currencyNative },
    revenueUSD: current.revenueUSDNormalized,
    revenueUSDNormalized: current.revenueUSDNormalized,
    costUSD: current.costUSDNormalized,
    costUSDNormalized: current.costUSDNormalized,
    profitUSD: current.profitUSD,
    markupRatio: current.markup,
    markup: current.markup,
    marginFrac: current.margin,
    margin: current.margin,
    workedHours: current.totalHours,
    totalHours: current.totalHours,
  };
}
