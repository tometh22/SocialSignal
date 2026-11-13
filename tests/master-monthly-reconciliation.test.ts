import { describe, expect, it } from 'vitest';
import { buildMasterMonthlyReconciliation, monthlyProjectIdentity } from '../server/domain/master-monthly-reconciliation';
import { masterFixture } from './financial-master-scenario.test';
import { defaultReconciliationPeriod } from '../server/services/monthly-reconciliation';

function fixture() {
  const data = masterFixture();
  data.sales = [['Mes Facturación', 'Año Facturación', 'Mes Cobro', 'Año', 'Cliente', 'Proyecto', 'Tipo de proyecto', ...Array(10).fill(''), 'Monto Total USD'],
    ['01 ene', 2026, '02 feb', 2026, 'Acme', 'Contrato', 'Fee', ...Array(10).fill(null), 1000]];
  data.performance = [['Cliente', 'Tipo de proyecto', 'Proyecto', 'Mes', 'Año', 'Cotización', 'Facturación [USD]', 'Costos [USD]', 'Costos [ARS]', 'Estado de proyecto'],
    ['Acme', 'One Shot', 'Trabajo futuro', '01 ene', 2026, 1500, 4000, 5, null, 'Abierto']];
  data.actual[2][9] = 'Contrato'; data.actual[2][10] = 'Acme';
  return data;
}

describe('monthly sources versus cumulative followup', () => {
  it('reconciles monthly sales and operating costs without importing an open future budget', () => {
    const result = buildMasterMonthlyReconciliation(fixture(), '2026-01');
    expect(result.status).toBe('matched');
    expect(result.totals).toMatchObject({ salesUsd: 1000, directCostUsd: 200, overheadUsd: 100, operatingCostUsd: 300,
      ebitUsd: 700, salesDifferenceUsd: 0, costsDifferenceUsd: 0 });
    expect(result.followup[0]).toMatchObject({ budgetUsd: 4000, status: 'open' });
    expect(result.rows).toHaveLength(1);
    expect(result.missingFollowup).toEqual([{ clientName: 'Acme', projectName: 'Contrato', revenueUsd: 1000 }]);
  });
  it('does not convert a moving analysis month into a second monthly sale', () => {
    const data = fixture();
    data.performance![1][3] = '02 feb';
    const january = buildMasterMonthlyReconciliation(data, '2026-01');
    expect(january.totals.salesUsd).toBe(1000);
    expect(january.followup).toHaveLength(0);
    expect(buildMasterMonthlyReconciliation(data, '2026-02').totals.salesUsd).toBe(0);
  });
  it('preserves cost year, refunds, full precision and taxes outside EBIT', () => {
    const data = fixture();
    data.actual.push([...data.actual[2]]);
    data.actual.at(-1)![18] = -0.001;
    data.summary[1][14] = 700.001;
    expect(buildMasterMonthlyReconciliation(data, '2026-01').totals.operatingCostUsd).toBe(300);
  });
  it('shows estimated company costs without inventing project costs or margins', () => {
    const data = fixture(); data.sales![1][0] = '02 feb';
    const report = buildMasterMonthlyReconciliation(data, '2026-02');
    expect(report.costBasis).toBe('estimated');
    expect(report.rows[0].directCostUsd).toBeNull();
    expect(report.totals).toMatchObject({ salesUsd: 1000, operatingCostUsd: 400, ebitUsd: 600, costsDifferenceUsd: 0 });
  });
  it('does not report healthy zero differences for missing or broken sources', () => {
    const data = fixture(); data.actual[2][18] = '#REF!';
    expect(buildMasterMonthlyReconciliation(data, '2026-01')).toMatchObject({ status: 'unavailable', costBasis: 'unavailable' });
    const invalid = fixture(); invalid.sales![1][17] = '#REF!';
    expect(buildMasterMonthlyReconciliation(invalid, '2026-01').totals.salesDifferenceUsd).toBeNull();
    const missing = fixture(); missing.sales = undefined;
    expect(() => buildMasterMonthlyReconciliation(missing, '2026-01')).toThrow('Faltan ventas');
  });
  it('keeps every unassigned cost in the control and exposes it for review', () => {
    const data = fixture(); data.actual[2][9] = ''; data.actual[2][10] = '';
    const report = buildMasterMonthlyReconciliation(data, '2026-01');
    expect(report.totals.directCostUsd).toBe(200);
    expect(report.rows.some(row => row.clientName === 'Sin asignación')).toBe(true);
    expect(report.warnings.some(warning => warning.includes('sin asignación'))).toBe(true);
  });
  it('skips hourless zero-rate preparation rows but preserves unknown projected expenses', () => {
    const data = fixture();
    data.actual.push(['Preparación', 'Administración', '01 ene', '', 2026, 'Indirecto', '', '', '', '', '', '', '', '', 0]);
    expect(buildMasterMonthlyReconciliation(data, '2026-01').status).toBe('matched');
    data.estimates.push(['02 feb', 2026, 2026, 'Bono pendiente', 'Bono', '', ...Array(6).fill(null), null]);
    expect(buildMasterMonthlyReconciliation(data, '2026-02')).toMatchObject({ status: 'unavailable' });
  });
  it('rolls credit costs to the monthly contract without merging different customer projects', () => {
    expect(monthlyProjectIdentity('Warner', 'Fee Insights Rouge').key).toBe(monthlyProjectIdentity('Warner', 'Fee Insights').key);
    expect(monthlyProjectIdentity('BID', 'Cambio Climatico').key).not.toBe(monthlyProjectIdentity('BID', 'Proyecto Nicaragua').key);
    expect(monthlyProjectIdentity('Animal Studio', 'Animal Tracking Workshop').key).toBe(monthlyProjectIdentity('Animal Studio', 'Novo Tracking Workshop').key);
  });
  it('defaults to the last available past month rather than the last forecast', () => {
    expect(defaultReconciliationPeriod(['2026-12', '2026-11', '2026-10'], new Date('2026-11-13T12:00:00Z'))).toBe('2026-10');
  });
});
