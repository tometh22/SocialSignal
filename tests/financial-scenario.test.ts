import { describe, expect, it, vi } from 'vitest';
vi.mock('../server/db', () => ({ pool: { query: vi.fn() } }));
import { calculateFinancialScenario, matchesScenarioCost, type FinancialScenario, type ScenarioCost } from '../shared/financial-scenario';
import { buildNativeScenarioCosts } from '../server/services/financial-scenario';

const cost = (id: string, amountUsd: number | null, periodKey = '2026-01', impact: ScenarioCost['impact'] = 'operating'): ScenarioCost => ({
  id, amountUsd, periodKey, impact, concept: 'Tarjeta USA', description: 'OPENAI API 01/12', category: 'Tecnología', source: 'ledger', date: null,
});
const fixture: FinancialScenario = {
  year: 2026,
  months: [
    { periodKey: '2026-01', monthLabel: '01 ene', revenueUsd: 1000, costUsd: 700, ebitUsd: 300, netProfitUsd: 250 },
    { periodKey: '2026-02', monthLabel: '02 feb', revenueUsd: 1000, costUsd: 500, ebitUsd: 500, netProfitUsd: null },
  ],
  costs: [cost('a', 100), cost('b', 50, '2026-02'), cost('tax', 20, '2026-01', 'net'), cost('refund', -10), cost('pending', null)],
};

describe('financial scenario calculation', () => {
  it('leaves the original intact and adjusts each month once across overlapping selections', () => {
    const original = structuredClone(fixture);
    const result = calculateFinancialScenario(fixture, ['a', 'a', 'b', 'unknown', 'pending']);
    expect(result.excludedUsd).toBe(150);
    expect(result.adjustedCostUsd).toBe(1050);
    expect(result.adjustedEbitUsd).toBe(950);
    expect(result.adjustedNetProfitUsd).toBe(350);
    expect(result.netChangeUsd).toBe(100);
    expect(result.netMonthCount).toBe(1);
    expect(result.missingNetMonths).toEqual(['02 feb']);
    expect(result.months[1].adjustedNetProfitUsd).toBeNull();
    expect(fixture).toEqual(original);
    expect(calculateFinancialScenario(fixture, []).adjustedCostUsd).toBe(1200);
  });

  it('fiscal exclusions affect only net profit and refunds reduce the improvement', () => {
    const result = calculateFinancialScenario(fixture, ['tax', 'refund']);
    expect(result.excludedUsd).toBe(10);
    expect(result.operatingExcludedUsd).toBe(-10);
    expect(result.adjustedCostUsd).toBe(1210);
    expect(result.adjustedEbitUsd).toBe(790);
    expect(result.adjustedNetProfitUsd).toBe(260);
  });

  it('does not invent missing net profit, ignore a valid zero or count costs from another year', () => {
    const data = structuredClone(fixture);
    data.costs.push(cost('old', 9000, '2025-01'));
    data.months[0].netProfitUsd = 0;
    expect(calculateFinancialScenario(data, ['a', 'old']).adjustedNetProfitUsd).toBe(100);
    data.months[0].netProfitUsd = null;
    expect(calculateFinancialScenario(data, ['a']).adjustedNetProfitUsd).toBeNull();
  });

  it('surfaces exclusions above the base without silently capping amounts', () => {
    const result = calculateFinancialScenario({ ...fixture, costs: [cost('large', 800)] }, ['large']);
    expect(result.negativeCostMonths).toEqual(['01 ene']);
    expect(result.months[0].adjustedCostUsd).toBe(-100);
  });

  it('searches card details, accents and several comma-separated concepts', () => {
    expect(matchesScenarioCost(fixture.costs[0], 'api openai')).toBe(true);
    expect(matchesScenarioCost(fixture.costs[0], 'tecnologia')).toBe(true);
    expect(matchesScenarioCost(fixture.costs[0], 'Replit, OpenAI')).toBe(true);
    expect(matchesScenarioCost(fixture.costs[0], 'Neon')).toBe(false);
    expect(matchesScenarioCost({ ...fixture.costs[0], description: 'NEON,TECH 04/01' }, 'neon.tech')).toBe(true);
    expect(matchesScenarioCost({ ...fixture.costs[0], description: 'OPEN AI charge' }, 'OpenAI')).toBe(true);
  });
});

describe('native cost sources', () => {
  const months = [{ periodKey: '2026-01', fuenteFacturacion: 'mind' }, { periodKey: '2026-02', fuenteFacturacion: 'master' }];
  const base = { period_key: '2026-01', detalle: 'Tarjeta USA', subtipo_costo: 'Tarjeta', amount_usd: 100 };
  it('keeps distinct consumptions and excludes Master months and balance-only documents', () => {
    const rows = buildNativeScenarioCosts(months, [
      { ...base, id: 1, source: 'mind_intake', concepto: 'Replit' },
      { ...base, id: 2, source: 'mind_intake', concepto: 'Replit' },
      { ...base, id: 3, period_key: '2026-02', source: 'excel' },
      { ...base, id: 4, cost_treatment: 'balance_only' },
    ]);
    expect(rows.map(row => row.id)).toEqual(['ledger:1', 'ledger:2']);
    expect(rows[0].description).toContain('Replit');
  });
  it('retains missing amounts and does not strip VAT a second time from native rollup amounts', () => {
    const rows = buildNativeScenarioCosts(months, [
      { ...base, id: 1, source: 'excel', amount_usd: null },
      { ...base, id: 2, source: 'excel', detalle: 'Itecsa', amount_usd: 121 },
      { ...base, id: 3, source: 'excel', detalle: 'Itecsa', amount_usd: 100, has_net_amount: true },
    ]);
    expect(rows.find(row => row.id === 'ledger:1')?.amountUsd).toBeNull();
    expect(rows.find(row => row.id === 'ledger:2')?.amountUsd).toBe(121);
    expect(rows.find(row => row.id === 'ledger:3')?.amountUsd).toBe(100);
  });
  it('uses explicit native cost treatment ahead of the imported category mapping', () => {
    const rows = buildNativeScenarioCosts(months, [
      { ...base, id: 1, cost_treatment: 'direct', subtipo_costo: 'Equipo - Bono' },
      { ...base, id: 2, cost_treatment: 'provision' },
      { ...base, id: 3, cost_treatment: 'unclassified', subtipo_costo: 'Impuestos ARG' },
    ]);
    expect(rows.find(row => row.id === 'ledger:1')?.impact).toBe('operating');
    expect(rows.find(row => row.id === 'ledger:2')?.impact).toBe('net');
    expect(rows.find(row => row.id === 'ledger:3')?.impact).toBe('operating');
  });
});
