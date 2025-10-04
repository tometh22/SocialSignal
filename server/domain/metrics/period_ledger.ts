import { getMonthlyFx } from "../shared/exchange";
import { getIncomeRows, getCostRows } from "../shared/sot";
import { canonicalizeKey } from "../shared/strings";

export type Currency = "ARS" | "USD";

export type LedgerRow = {
  projectKey: string;
  currencyNative: Currency;
  revenueDisplay: number;
  costDisplay: number;
  revenueUSD: number;
  costUSD: number;
  flags: string[];
};

export async function getPeriodLedger(period: string, opts?: { fresh?: boolean }): Promise<LedgerRow[]> {
  const [income, costs] = await Promise.all([
    getIncomeRows(period, opts),
    getCostRows(period, opts),
  ]);

  const map = new Map<string, LedgerRow>();

  for (const r of income) {
    const k = canonicalizeKey(r.projectKey);
    const curr: Currency = r.currency ?? "ARS";
    const row: LedgerRow = map.get(k) ?? {
      projectKey: k,
      currencyNative: curr,
      revenueDisplay: 0,
      costDisplay: 0,
      revenueUSD: 0,
      costUSD: 0,
      flags: []
    };
    row.currencyNative = curr;
    row.revenueDisplay += r.revenueDisplay ?? 0;
    row.revenueUSD += r.revenueUSD ?? 0;
    if (r.flags?.length) row.flags.push(...r.flags);
    map.set(k, row);
  }

  for (const c of costs) {
    const k = canonicalizeKey(c.projectKey);
    const curr: Currency = c.currency ?? "ARS";
    const row: LedgerRow = map.get(k) ?? {
      projectKey: k,
      currencyNative: curr,
      revenueDisplay: 0,
      costDisplay: 0,
      revenueUSD: 0,
      costUSD: 0,
      flags: []
    };
    row.currencyNative = curr;
    row.costDisplay += c.costDisplay ?? 0;
    row.costUSD += c.costUSD ?? 0;
    if (c.flags?.length) row.flags.push(...c.flags);
    map.set(k, row);
  }

  const fx = await getMonthlyFx(period).catch(() => null);
  const out = [...map.values()];
  if (fx) out.forEach(r => r.flags.push(`FX_USED:${fx}`));
  return out;
}

export function computeKpis(r: LedgerRow) {
  const rev = r.revenueUSD || 0;
  const cst = r.costUSD || 0;
  return {
    revenueUSD: rev,
    costUSD: cst,
    profitUSD: rev - cst,
    markup: cst ? rev / cst : NaN,
    margin: rev ? (rev - cst) / rev : NaN,
    revenueDisplay: r.revenueDisplay,
    costDisplay: r.costDisplay,
    currencyNative: r.currencyNative,
    flags: r.flags
  };
}

export async function getProjectsSummary(period: string, opts?: { fresh?: boolean }) {
  const L = await getPeriodLedger(period, opts);
  return L.map(r => ({
    projectKey: r.projectKey,
    currencyNative: r.currencyNative,
    metrics: {
      revenueDisplay: r.revenueDisplay,
      costDisplay: r.costDisplay,
      revenueUSDNormalized: r.revenueUSD,
      costUSDNormalized: r.costUSD,
      ...kpiFrom(r)
    },
    anomaly: r.flags?.length ? r.flags : undefined
  }));

  function kpiFrom(x: LedgerRow) {
    const rev = x.revenueUSD || 0;
    const cst = x.costUSD || 0;
    return {
      markup: cst ? rev / cst : NaN,
      margin: rev ? (rev - cst) / rev : NaN
    };
  }
}

export async function getProjectSummary(projectKey: string, period: string, opts?: { fresh?: boolean }) {
  const L = await getPeriodLedger(period, opts);
  const r = L.find(x => x.projectKey === canonicalizeKey(projectKey));
  return r ? computeKpis(r) : null;
}
