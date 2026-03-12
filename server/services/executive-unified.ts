import { pool } from '../db';

/**
 * UNIFIED EXECUTIVE DASHBOARD
 *
 * Reads EXCLUSIVELY from monthly_financial_summary (synced from Google Sheets "Resumen Ejecutivo").
 * Uses the SAME formulas as Looker Studio to ensure numbers match exactly.
 *
 * Looker Formulas (canonical):
 * - Ventas del mes = facturacion_total (sin IVA)
 * - EBIT Utilidad Operativa = Ventas - Costos (sin impuestos ARG/USA e intereses)
 *   which is: facturacion_total - costos_directos - costos_indirectos
 * - Margen Operativo = EBIT / Ventas × 100
 * - Markup = Ventas / Costos Directos
 * - Beneficio Neto = beneficio_neto (from Sheet, EBIT - impuestos)
 * - Margen Neto = Beneficio Neto / Ventas × 100
 * - Cashflow = cashflow_neto (from Sheet)
 */

export interface UnifiedDashboardData {
  // Period info
  periodKey: string;
  year: number;
  monthNumber: number;
  monthLabel: string | null;

  // P&L Cascade
  ventasMes: number;
  costosDirectos: number;
  margenBruto: number;
  margenBrutoPct: number;
  costosIndirectos: number;
  ebitOperativo: number;
  margenOperativoPct: number;
  impuestos: number;
  beneficioNeto: number;
  margenNetoPct: number;
  markup: number;

  // Balance
  totalActivo: number;
  totalPasivo: number;
  balanceNeto: number;
  cajaTotal: number;
  inversiones: number;
  cuentasCobrarUsd: number;
  cuentasPagarUsd: number;

  // Cashflow
  cashflowNeto: number;
  cashflowIngresos: number;
  cashflowEgresos: number;

  // Provisiones (informativo)
  ivaCompras: number;
  impuestosUsa: number;
  facturacionAdelantada: number;

  // Derived
  burnRate: number;
  runway: number;

  // Variations vs previous month
  ventasVariation: number | null;
  ebitVariation: number | null;
  beneficioVariation: number | null;
  cashflowVariation: number | null;

  // 12-month trends
  trends: MonthlyTrend[];

  // Available periods
  availablePeriods: string[];
}

export interface MonthlyTrend {
  periodKey: string;
  monthLabel: string | null;
  ventasMes: number;
  costosDirectos: number;
  costosIndirectos: number;
  ebitOperativo: number;
  beneficioNeto: number;
  markup: number;
  margenOperativoPct: number;
  margenNetoPct: number;
  cashflowNeto: number;
  cajaTotal: number;
  totalActivo: number;
  totalPasivo: number;
  balanceNeto: number;
}

function num(val: any): number {
  return parseFloat(val) || 0;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal places
}

export async function getUnifiedDashboard(periodKey: string): Promise<UnifiedDashboardData> {
  // 1. Fetch current period from monthly_financial_summary
  const { rows: [current] } = await pool.query(`
    SELECT * FROM monthly_financial_summary
    WHERE period_key = $1
  `, [periodKey]);

  // 2. Fetch previous period for variations
  const [year, month] = periodKey.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevPeriodKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  const { rows: [prev] } = await pool.query(`
    SELECT * FROM monthly_financial_summary
    WHERE period_key = $1
  `, [prevPeriodKey]);

  // 3. Fetch 12 months of trends
  const { rows: trendRows } = await pool.query(`
    SELECT * FROM monthly_financial_summary
    WHERE period_key <= $1
    ORDER BY period_key DESC
    LIMIT 12
  `, [periodKey]);

  // 4. Fetch available periods
  const { rows: periodRows } = await pool.query(`
    SELECT period_key FROM monthly_financial_summary
    WHERE facturacion_total IS NOT NULL OR total_activo IS NOT NULL
    ORDER BY period_key DESC
  `);

  // === Build P&L cascade from MFS (matching Looker exactly) ===
  const ventasMes = num(current?.facturacion_total);
  const costosDirectos = num(current?.costos_directos);
  const costosIndirectos = num(current?.costos_indirectos);
  const impuestosUsa = num(current?.impuestos_usa);
  const ivaCompras = num(current?.iva_compras);

  const margenBruto = ventasMes - costosDirectos;
  // EBIT = Ventas - Costos (sin impuestos) — matches Looker definition
  const ebitOperativo = num(current?.ebit_operativo) || (ventasMes - costosDirectos - costosIndirectos);
  const beneficioNeto = num(current?.beneficio_neto) || (ebitOperativo - impuestosUsa);
  const markup = num(current?.markup_promedio) || (costosDirectos > 0 ? ventasMes / costosDirectos : 0);

  const impuestos = ventasMes > 0 ? ebitOperativo - beneficioNeto : 0;

  // Balance
  const totalActivo = num(current?.total_activo);
  const totalPasivo = num(current?.total_pasivo);
  const balanceNeto = num(current?.balance_neto) || (totalActivo - totalPasivo);
  const cajaTotal = num(current?.caja_total);
  const inversiones = num(current?.inversiones);
  const cuentasCobrarUsd = num(current?.cuentas_cobrar_usd);
  const cuentasPagarUsd = num(current?.cuentas_pagar_usd);

  // Cashflow
  const cashflowNeto = num(current?.cashflow_neto);
  const cashflowIngresos = num(current?.cashflow_ingresos);
  const cashflowEgresos = num(current?.cashflow_egresos);

  // Provisiones
  const facturacionAdelantada = num(current?.pasivo_facturacion_adelantada);

  // Burn & Runway
  const burnRate = costosDirectos + costosIndirectos + impuestosUsa;
  const runway = burnRate > 0 ? Math.round((cajaTotal / burnRate) * 10) / 10 : 0;

  // Variations
  function variation(currentVal: number, prevVal: number | undefined): number | null {
    const p = num(prevVal);
    if (p === 0) return null;
    return Math.round(((currentVal - p) / Math.abs(p)) * 10000) / 100;
  }

  // Trends (reversed to chronological order)
  const trends: MonthlyTrend[] = trendRows.reverse().map(row => {
    const rv = num(row.facturacion_total);
    const cd = num(row.costos_directos);
    const ci = num(row.costos_indirectos);
    const ebit = num(row.ebit_operativo) || (rv - cd - ci);
    const bn = num(row.beneficio_neto);
    return {
      periodKey: row.period_key,
      monthLabel: row.month_label,
      ventasMes: rv,
      costosDirectos: cd,
      costosIndirectos: ci,
      ebitOperativo: ebit,
      beneficioNeto: bn,
      markup: cd > 0 ? Math.round((rv / cd) * 100) / 100 : 0,
      margenOperativoPct: pct(ebit, rv),
      margenNetoPct: pct(bn, rv),
      cashflowNeto: num(row.cashflow_neto),
      cajaTotal: num(row.caja_total),
      totalActivo: num(row.total_activo),
      totalPasivo: num(row.total_pasivo),
      balanceNeto: num(row.balance_neto) || (num(row.total_activo) - num(row.total_pasivo)),
    };
  });

  return {
    periodKey,
    year,
    monthNumber: month,
    monthLabel: current?.month_label || null,

    // P&L Cascade
    ventasMes,
    costosDirectos,
    margenBruto,
    margenBrutoPct: pct(margenBruto, ventasMes),
    costosIndirectos,
    ebitOperativo,
    margenOperativoPct: pct(ebitOperativo, ventasMes),
    impuestos,
    beneficioNeto,
    margenNetoPct: pct(beneficioNeto, ventasMes),
    markup: Math.round(markup * 100) / 100,

    // Balance
    totalActivo,
    totalPasivo,
    balanceNeto,
    cajaTotal,
    inversiones,
    cuentasCobrarUsd,
    cuentasPagarUsd,

    // Cashflow
    cashflowNeto,
    cashflowIngresos,
    cashflowEgresos,

    // Provisiones
    ivaCompras,
    impuestosUsa,
    facturacionAdelantada,

    // Derived
    burnRate,
    runway,

    // Variations
    ventasVariation: variation(ventasMes, prev?.facturacion_total),
    ebitVariation: variation(ebitOperativo, prev?.ebit_operativo),
    beneficioVariation: variation(beneficioNeto, prev?.beneficio_neto),
    cashflowVariation: variation(cashflowNeto, prev?.cashflow_neto),

    trends,
    availablePeriods: periodRows.map(r => r.period_key),
  };
}
