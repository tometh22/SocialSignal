/** Read-only sensitivity analysis. Selecting a cost never changes a ledger. */
export interface ScenarioMonth {
  periodKey: string;
  monthLabel: string;
  revenueUsd: number;
  costUsd: number;
  ebitUsd: number;
  netProfitUsd: number | null;
}

export interface ScenarioCost {
  id: string;
  periodKey: string;
  concept: string;
  description: string;
  category: string;
  date: string | null;
  source: 'ledger' | 'estimate';
  amountUsd: number | null;
  impact: 'operating' | 'net';
}

export interface FinancialScenario {
  year: number;
  months: ScenarioMonth[];
  costs: ScenarioCost[];
}

export const roundScenarioMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const normalizeScenarioText = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\bopen ai\b/g, 'openai');

/** Comma-separated expressions are alternatives; words within one expression must all match. */
export function matchesScenarioCost(cost: ScenarioCost, query: string): boolean {
  const expressions = query.split(',').map(normalizeScenarioText).filter(Boolean);
  if (!expressions.length) return true;
  const text = normalizeScenarioText(`${cost.concept} ${cost.description} ${cost.category}`);
  return expressions.some(expression => expression.split(/\s+/).every(word => text.includes(word)));
}

export function calculateFinancialScenario(data: FinancialScenario, selectedIds: Iterable<string>) {
  const wanted = new Set(selectedIds);
  const seen = new Set<string>();
  const periods = new Set(data.months.map(month => month.periodKey));
  const selected = data.costs.filter(cost => {
    if (!wanted.has(cost.id) || seen.has(cost.id) || cost.amountUsd == null || !Number.isFinite(cost.amountUsd)
      || !periods.has(cost.periodKey) || !cost.periodKey.startsWith(`${data.year}-`)) return false;
    seen.add(cost.id);
    return true;
  });
  const months = data.months.map(base => {
    const costs = selected.filter(cost => cost.periodKey === base.periodKey);
    const excludedUsd = roundScenarioMoney(costs.reduce((total, cost) => total + cost.amountUsd!, 0));
    const operatingExcludedUsd = roundScenarioMoney(costs.filter(cost => cost.impact === 'operating')
      .reduce((total, cost) => total + cost.amountUsd!, 0));
    return {
      ...base, excludedUsd, operatingExcludedUsd,
      adjustedCostUsd: roundScenarioMoney(base.costUsd - operatingExcludedUsd),
      adjustedEbitUsd: roundScenarioMoney(base.ebitUsd + operatingExcludedUsd),
      adjustedNetProfitUsd: base.netProfitUsd == null ? null : roundScenarioMoney(base.netProfitUsd + excludedUsd),
    };
  });
  const sum = (pick: (month: typeof months[number]) => number) =>
    roundScenarioMoney(months.reduce((total, month) => total + pick(month), 0));
  const netMonths = months.filter(month => month.netProfitUsd != null);
  return {
    months, selected,
    excludedUsd: sum(month => month.excludedUsd),
    operatingExcludedUsd: sum(month => month.operatingExcludedUsd),
    baseCostUsd: sum(month => month.costUsd),
    adjustedCostUsd: sum(month => month.adjustedCostUsd),
    baseEbitUsd: sum(month => month.ebitUsd),
    adjustedEbitUsd: sum(month => month.adjustedEbitUsd),
    baseNetProfitUsd: netMonths.length ? sum(month => month.netProfitUsd ?? 0) : null,
    adjustedNetProfitUsd: netMonths.length ? sum(month => month.adjustedNetProfitUsd ?? 0) : null,
    netChangeUsd: netMonths.length ? roundScenarioMoney(netMonths.reduce((total, month) => total + month.excludedUsd, 0)) : null,
    netMonthCount: netMonths.length,
    missingNetMonths: months.filter(month => month.netProfitUsd == null).map(month => month.monthLabel),
    negativeCostMonths: months.filter(month => month.adjustedCostUsd < 0).map(month => month.monthLabel),
  };
}
