import type { MasterScenarioSnapshot } from '../../server/services/financial-master-scenario';
export const dashboardHeaders = ['Mes', 'Año', 'Cierre', 'Activo Líquido', 'Activo Mediano Plazo Crypto',
  'Activo Mediano Plazo Clientes a Cobrar', 'Activo Total', 'Pasivo Provisión Impuesto USA',
  'Provisión Pasivo Costos Facturación Adelantada', 'Pasivo Proveedores a pagar', 'Pasivo Total',
  'Balance Neto (Activo-Pasivo)', 'Balance 60 días', 'Ventas del mes', 'EBIT Utilidad operativa',
  'Beneficio Neto', 'Margen operativo', 'Margen Neto', 'MarkUp', 'Proyección resultado', 'Cashflow', 'CashFlow+60días'];
export function dashboardRow(month: number, revenue = 1000, ebit = 400, net: number | null = 200) {
  return [`${String(month).padStart(2, '0')} mes`, 2026, null,
    100, 20, 300, 420, 10, 30, 50, 90, 330, 999, revenue, ebit, net,
    ebit / revenue, net == null ? null : net / revenue, 2.5, 500, -25, 75];
}
export function dashboardSnapshot(rows: ReturnType<typeof dashboardRow>[]): MasterScenarioSnapshot {
  return { summary: [[...dashboardHeaders], ...rows], actual: [], estimates: [], liabilities: [], readAt: '2026-11-06T12:00:00Z' };
}
