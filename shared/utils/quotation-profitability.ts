import { calculateGrossMarginPercentage } from './quotation-commercial';

export function quotedOperationalCost(quotation: {
  baseCost?: number | null; complexityAdjustment?: number | null;
  toolsCost?: number | null; platformCost?: number | null; additionalDeliverableCost?: number | null;
}): number {
  return ['baseCost', 'complexityAdjustment', 'toolsCost', 'platformCost', 'additionalDeliverableCost']
    .reduce((sum, key) => sum + (Number(quotation[key as keyof typeof quotation]) || 0), 0);
}

/** An empty ledger is missing evidence, not a realized 100% gross margin. */
export function quotationProfitability(input: {
  entries: Array<{ hours: number | null; totalCost: number | null }>;
  quotedHours: number; quotedCost: number; revenue: number;
  currency: string | null; exchangeRate: number;
}) {
  const realHours = input.entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const realCostARS = input.entries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
  const hasActualCosts = input.entries.length > 0 && input.entries.every(entry => entry.totalCost != null && Number.isFinite(entry.totalCost));
  const hasValidExchangeRate = Number.isFinite(input.exchangeRate) && input.exchangeRate > 0;
  const realCost = !hasActualCosts || (input.currency === 'USD' && !hasValidExchangeRate) ? null
    : input.currency === 'USD' ? realCostARS / input.exchangeRate : realCostARS;
  const plannedGrossMargin = calculateGrossMarginPercentage(input.revenue, input.quotedCost);
  const actualGrossMargin = realCost != null && input.revenue > 0
    ? calculateGrossMarginPercentage(input.revenue, realCost) : null;
  return {
    realHours, realCost, quotedHours: input.quotedHours, quotedCost: input.quotedCost,
    revenue: input.revenue, plannedGrossMargin, actualGrossMargin,
    marginDelta: actualGrossMargin == null ? null : Math.round((actualGrossMargin - plannedGrossMargin) * 10) / 10,
    hasActualCosts, currency: input.currency,
  };
}
