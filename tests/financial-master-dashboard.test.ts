import { describe, expect, it } from 'vitest';
import { buildMasterDashboard } from '../server/services/financial-master-dashboard';
import { aggregateMonths } from '../server/services/direct-sheets-dashboard';
import { dashboardSnapshot, dashboardRow } from './fixtures/master-dashboard';

describe('Master dashboard source mapping', () => {
  it('preserves precision, zero and missing cells; maps balances and cashflow from their own columns', () => {
    const row = dashboardRow(9, 1000.004, 400.004, 0);
    row[4] = null; row[18] = null;
    const [result] = buildMasterDashboard(dashboardSnapshot([row]), ['2026-09']);
    expect(result).toMatchObject({ ventasDelMes: 1000.004, ebitOperativo: 400.004, beneficioNeto: 0,
      margenNeto: 0, fuenteDatos: 'master', activoLiquido: 100, activoMedPlazo: null, clientesACobrar: 300,
      activoTotal: 420, pasivoImpuestosUSA: 10, pasivoFacturacionAdelantada: 30, pasivoProveedores: 50,
      pasivoTotal: 90, balanceNeto: 330, cashflow: -25, cashflow60Dias: 75, markup: null });
  });
  it('excludes unsupported future net, preserves legitimate 100% net, and uses matching revenue in partial margin', () => {
    const rows = [dashboardRow(1), dashboardRow(2, 100, 100, 100), dashboardRow(11, 2000, 400, 2000)];
    const months = buildMasterDashboard(dashboardSnapshot(rows), ['2026-01','2026-02','2026-11']);
    expect(months[1].beneficioNeto).toBe(100);
    expect(months[2].beneficioNeto).toBeNull();
    const result = aggregateMonths(months, '2026', '2026', 2026, 11)!;
    expect(result).toMatchObject({ ventasDelMes: 3100, beneficioNeto: 300, beneficioNetoParcial: true,
      mesesSinBeneficioNeto: ['11 mes'], fuenteDatos: 'master' });
    expect(result.margenNeto).toBeCloseTo(300 / 1100 * 100);
  });
  it('selects the latest complete balance snapshot and reports its actual month', () => {
    const september = dashboardRow(9);
    const october = dashboardRow(10); october[5] = null; october[9] = null; october[6] = 1701; october[10] = 0;
    const months = buildMasterDashboard(dashboardSnapshot([september, october]), ['2026-09','2026-10']);
    expect(aggregateMonths(months, '2026', '2026', 2026, 10)).toMatchObject({
      activoTotal: 420, pasivoTotal: 90, balanceNeto: 330, balancePeriodKey: '2026-09', balanceDesactualizado: true,
    });
  });
  it('interprets closing dates in Argentina rather than treating every future date as closed', () => {
    const january = dashboardRow(1); january[2] = 46053;
    const november = dashboardRow(11); november[2] = 46356;
    const result = buildMasterDashboard(dashboardSnapshot([january,november]), ['2026-01','2026-11'], new Date('2026-11-06T12:00:00Z'));
    expect(result.map(month => month.cierre)).toEqual([true, false]);
  });
  it('does not substitute another month or shifted columns if a source is missing', () => {
    expect(() => buildMasterDashboard(dashboardSnapshot([]), ['2026-01'])).toThrow('Falta');
    const duplicate = dashboardSnapshot([dashboardRow(1),dashboardRow(1)]);
    expect(() => buildMasterDashboard(duplicate, ['2026-01'])).toThrow('duplicado');
    duplicate.summary[0][21] = 'Balance 60 días';
    expect(() => buildMasterDashboard(duplicate, ['2026-01'])).toThrow('columna');
  });
});
