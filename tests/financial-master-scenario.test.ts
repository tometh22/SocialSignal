import { describe, expect, it } from 'vitest';
import { buildMasterScenario, type MasterScenarioSnapshot } from '../server/services/financial-master-scenario';
import { calculateFinancialScenario, matchesScenarioCost } from '../shared/financial-scenario';

const summaryHeader = ['Mes', 'Año', ...Array(11).fill(''), 'Ventas del mes', 'EBIT Utilidad operativa', 'Beneficio Neto'];
const actualHeader = ['Detalle', 'Subtipo de costo', 'Mes', 'Año Facturación', 'Año', 'Tipo de Costo', 'Costo Marketing', 'Especificación', 'Tipo de proyecto', 'Proyecto', 'Cliente', ...Array(7).fill(''), 'Monto Total USD'];
const estimateHeader = ['Mes', 'Año', 'Año Facturación', 'Detalle', 'Subtipo de costo', 'Puesto', ...Array(6).fill(''), 'Monto Total USD'];
const liabilityHeader = ['Detalle', 'Subtipo', 'Mes', 'Año', ...Array(9).fill(''), 'Monto Total USD'];
export const masterFixture = (): MasterScenarioSnapshot => ({
  summary: [[...summaryHeader], ['01 ene', 2026, ...Array(11).fill(null), 1000, 700, 650],
    ['02 feb', 2026, ...Array(11).fill(null), 1000, 600, 1000]],
  actual: [[...actualHeader],
    ['Tarjeta USA', 'Tarjeta', '01 ene', 2025, 2026, 'Indirecto', 'Sí', 'REPLIT API', '', '', '', ...Array(7).fill(null), 100],
    ['Equipo-Bono', 'Equipo - Bono', '01 ene', null, 2026, 'Directo', '', '', '', '', '', ...Array(7).fill(null), 200],
    ['IIBB', 'Impuestos ARG', '01 ene', null, 2026, 'Indirecto', '', '', '', '', '', ...Array(7).fill(null), 50],
    ['IVA', 'Impuestos ARG', '01 ene', null, 2026, 'Indirecto', '', '', '', '', '', ...Array(7).fill(null), 80],
  ],
  estimates: [[...estimateHeader], ['01 ene', 2026, 2026, 'Tarjeta USA', 'Tarjeta', '', ...Array(6).fill(null), 999],
    ['02 feb', 2026, 2026, 'Tarjeta USA', 'Tarjeta', '', ...Array(6).fill(null), 400]],
  liabilities: [[...liabilityHeader], ['Tarjeta USA', 'Tarjeta', '01 ene', 2026, ...Array(9).fill(null), 5000],
    ['Provisión Pasivo', 'Provisión Pasivo', '01 ene', 2026, ...Array(9).fill(null), 200]],
  readAt: '2026-11-06T12:00:00Z',
});

describe('Master formula reconciliation', () => {
  it('uses the entire actual month without filling missing suppliers from estimates or Pasivo', () => {
    const data = masterFixture();
    data.estimates.push(['01 ene', 2026, 2026, 'Railway', 'Tarjeta', '', ...Array(6).fill(null), 123]);
    const result = buildMasterScenario(data, ['2026-01', '2026-02']);
    expect(result.warnings).toEqual([]);
    expect(result.costs).toHaveLength(5);
    expect(result.costs.find(cost => cost.concept === 'Railway')).toBeUndefined();
    expect(result.costs.filter(cost => cost.periodKey === '2026-02')).toMatchObject([{ amountUsd: 400, source: 'estimate', impact: 'ebit' }]);
    expect(result.months[1].netProfitUsd).toBeNull();
    expect(result.costs.find(cost => matchesScenarioCost(cost, 'Marketing'))?.amountUsd).toBe(100);
  });
  it('respects separate EBIT/net exclusions: IVA neither, IIBB net, bonuses EBIT, provisions net', () => {
    const result = buildMasterScenario(masterFixture(), ['2026-01']);
    expect(result.costs.find(cost => cost.concept === 'IVA')).toBeUndefined();
    expect(result.costs.find(cost => cost.concept === 'IIBB')?.impact).toBe('net');
    expect(result.costs.find(cost => cost.concept === 'Equipo-Bono')?.impact).toBe('ebit');
    const all = calculateFinancialScenario({ year: 2026, ...result }, result.costs.map(cost => cost.id));
    expect(all.adjustedCostUsd).toBe(0);
    expect(all.adjustedEbitUsd).toBe(1000);
    expect(all.adjustedNetProfitUsd).toBe(1000);
    const bonus = result.costs.find(cost => cost.concept === 'Equipo-Bono')!;
    expect(calculateFinancialScenario({ year: 2026, ...result }, [bonus.id]).adjustedNetProfitUsd).toBe(650);
  });
  it('preserves source USD, precision, credits, identical rows and the cost year rather than billing year', () => {
    const data = masterFixture();
    data.actual = [actualHeader,
      ...[60.501, 60.501, -0.002].map(value => ['Itecsa', 'Estudio Contable', '01 ene', 2025, 2026, '', '', 'OPEN AI', '', '', '', ...Array(7).fill(null), value])];
    data.summary[1][14] = 879;
    data.summary[1][15] = 879;
    data.liabilities = [liabilityHeader];
    const result = buildMasterScenario(data, ['2026-01']);
    expect(result.costs).toHaveLength(3);
    expect(result.costs[0].amountUsd).toBe(60.501);
    const scenario = calculateFinancialScenario({ year: 2026, ...result }, result.costs.map(cost => cost.id));
    expect(scenario.excludedUsd).toBe(121);
    expect(scenario.adjustedCostUsd).toBe(0);
    expect(scenario.adjustedNetProfitUsd).toBe(1000);
  });
  it('disables only unreconciled months and never silently invents an amount', () => {
    const data = masterFixture();
    data.actual[1][18] = '#REF!';
    const result = buildMasterScenario(data, ['2026-01', '2026-02']);
    expect(result.warnings).toHaveLength(1);
    expect(result.costs.every(cost => cost.periodKey === '2026-02')).toBe(true);
    expect(result.months[0].netProfitUsd).toBeNull();
  });
  it('keeps a valid zero net and suppresses net when detail no longer agrees', () => {
    const data = masterFixture();
    data.summary[1][15] = 0;
    data.liabilities[2][13] = 850;
    expect(buildMasterScenario(data, ['2026-01']).months[0].netProfitUsd).toBe(0);
    data.liabilities[2][13] = 800;
    const result = buildMasterScenario(data, ['2026-01']);
    expect(result.months[0].netProfitUsd).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.costs).toHaveLength(4);
  });
  it('fails explicitly on changed headers, duplicate summaries or missing base values', () => {
    const data = masterFixture();
    data.actual[0][18] = 'Cotización';
    expect(() => buildMasterScenario(data, ['2026-01'])).toThrow('estructura');
    expect(() => buildMasterScenario(masterFixture(), ['2027-01'])).toThrow('resumen único');
    const duplicate = masterFixture();
    duplicate.summary.push(duplicate.summary[1]);
    expect(() => buildMasterScenario(duplicate, ['2026-01'])).toThrow('resumen único');
    const missing = masterFixture(); missing.summary[1][13] = null;
    expect(() => buildMasterScenario(missing, ['2026-01'])).toThrow('Falta facturación');
  });
});
