import { isBrokenNetProfit, type MonthData } from './direct-sheets-dashboard';
import { normalizeScenarioText } from '../../shared/financial-scenario';
import type { MasterScenarioSnapshot } from './financial-master-scenario';

/** Map unformatted cells from the same snapshot used by Projection. Blank is not zero. */
export function buildMasterDashboard(snapshot: MasterScenarioSnapshot, periods: string[], now = new Date()): MonthData[] {
  const headers = ['Mes', 'Año', 'Cierre', 'Activo Líquido', 'Activo Mediano Plazo Crypto',
    'Activo Mediano Plazo Clientes a Cobrar', 'Activo Total', 'Pasivo Provisión Impuesto USA',
    'Provisión Pasivo Costos Facturación Adelantada', 'Pasivo Proveedores a pagar', 'Pasivo Total',
    'Balance Neto (Activo-Pasivo)', 'Balance 60 días', 'Ventas del mes', 'EBIT Utilidad operativa',
    'Beneficio Neto', 'Margen operativo', 'Margen Neto', 'MarkUp', 'Proyección resultado', 'Cashflow', 'CashFlow+60días'];
  headers.forEach((name, index) => {
    if (normalizeScenarioText(String(snapshot.summary[0]?.[index] ?? '')) !== normalizeScenarioText(name)) {
      throw new Error(`Cambió la columna ${name} del Resumen Ejecutivo`);
    }
  });
  const wanted = new Set(periods);
  const found = new Set<string>();
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);
  const result: MonthData[] = [];
  for (const row of snapshot.summary.slice(1)) {
    const month = Number(String(row[0] ?? '').match(/^\s*(\d{1,2})\b/)?.[1]);
    const year = Number(row[1]);
    const periodKey = `${year}-${String(month).padStart(2, '0')}`;
    if (!wanted.has(periodKey)) continue;
    if (found.has(periodKey)) throw new Error(`Resumen duplicado del Máster: ${periodKey}`);
    found.add(periodKey);
    const amount = (index: number): number | null => typeof row[index] === 'number' && Number.isFinite(row[index]) ? row[index] as number : null;
    const revenue = amount(13), ebit = amount(14), net = amount(15);
    const margin = amount(17) == null ? null : amount(17)! * 100;
    const brokenNet = revenue != null && ebit != null && revenue !== ebit && isBrokenNetProfit(net, revenue, margin);
    const closeDate = amount(2);
    const cierre = closeDate != null && closeDate > 1
      ? new Date(Date.UTC(1899, 11, 30) + closeDate * 86400000).toISOString().slice(0, 10) <= today
      : ['si', 'true', '1', 'cerrado'].includes(normalizeScenarioText(String(row[2] ?? '')));
    result.push({ periodKey, year, month, monthLabel: String(row[0]), cierre, fuenteDatos: 'master',
      ventasDelMes: revenue, ebitOperativo: ebit, beneficioNeto: brokenNet ? null : net,
      beneficioNetoRoto: brokenNet, margenOperativo: amount(16) == null ? null : amount(16)! * 100,
      margenNeto: brokenNet ? null : margin, markup: amount(18), proyeccionResultado: amount(19),
      activoLiquido: amount(3), activoMedPlazo: amount(4), clientesACobrar: amount(5), activoTotal: amount(6),
      pasivoImpuestosUSA: amount(7), pasivoFacturacionAdelantada: amount(8), pasivoProveedores: amount(9),
      pasivoTotal: amount(10), balanceNeto: amount(11), cashflow: amount(20), cashflow60Dias: amount(21) });
  }
  for (const key of periods) if (!found.has(key)) throw new Error(`Falta el resumen del Máster: ${key}`);
  return result;
}
