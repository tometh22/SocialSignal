import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), snapshot: vi.fn(), builder: vi.fn(), dashboard: vi.fn() }));
vi.mock('../server/db', () => ({ pool: { query: mocks.query } }));
vi.mock('../server/services/financial-master-scenario', () => ({ getMasterScenarioSnapshot: mocks.snapshot }));
vi.mock('../server/domain/master-monthly-reconciliation', () => ({ buildMasterMonthlyReconciliation: mocks.builder,
  roundMoney: (value: number) => Math.round(value * 100) / 100 }));
vi.mock('../server/services/financial-native-dashboard', () => ({ fetchNativeExecutiveDashboard: mocks.dashboard }));
import { getMonthlyReconciliation } from '../server/services/monthly-reconciliation';

beforeEach(() => { vi.resetAllMocks(); });
describe('monthly source boundary and native controls', () => {
  it('reads Master without treating imported facts or the hours cutoff as native activity', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: null, native: false }] });
    mocks.snapshot.mockResolvedValue({ readAt: 'now' });
    mocks.builder.mockReturnValue({ source: 'master' });
    expect(await getMonthlyReconciliation('2026-10')).toEqual({ source: 'master' });
    expect(mocks.builder).toHaveBeenCalledWith({ readAt: 'now' }, '2026-10');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  function native(status: string | null, costs: unknown, sales = 1000) {
    mocks.query.mockResolvedValueOnce({ rows: [{ status, native: true }] })
      .mockResolvedValueOnce({ rows: [{ key: 'project:1', client_name: 'Acme', project_name: 'Service',
        project_type: 'fee', revenue: 1000, cost: 200, refs: ['Ingreso #1', 'Costo #1'] }] })
      .mockResolvedValueOnce({ rows: costs ? [costs] : [] });
    mocks.dashboard.mockResolvedValue({ filtered: { ventasDelMes: sales, ebitOperativo: sales - 300 } });
  }
  it('compares native monthly revenue and all operating costs with its dashboard', async () => {
    native(null, { direct_usd: 200, indirect_usd: 100 });
    const report = await getMonthlyReconciliation('2026-10');
    expect(report).toMatchObject({ source: 'mind', status: 'matched', followup: [], totals: {
      salesUsd: 1000, directCostUsd: 200, operatingCostUsd: 300, ebitUsd: 700 } });
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('flags a frozen close that differs from live detail', async () => {
    native('CLOSED', { direct_usd: 200, indirect_usd: 100 }, 1200);
    expect(await getMonthlyReconciliation('2026-10')).toMatchObject({ source: 'cierre', status: 'difference',
      totals: { salesDifferenceUsd: -200 } });
  });
  it('does not turn missing native company costs into a reconciled zero', async () => {
    native(null, null);
    expect(await getMonthlyReconciliation('2026-10')).toMatchObject({ status: 'unavailable',
      totals: { overheadUsd: null, operatingCostUsd: null, costsDifferenceUsd: null } });
  });
});
