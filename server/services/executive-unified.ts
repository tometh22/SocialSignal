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

export async function getUnifiedDashboard(periodKey: string): Promise<UnifiedDashboardData | null> {
  // 0. Fetch available periods from MFS itself
  const { rows: periodRows } = await pool.query(`
    SELECT period_key FROM monthly_financial_summary
    WHERE facturacion_total IS NOT NULL OR total_activo IS NOT NULL OR caja_total IS NOT NULL
    ORDER BY period_key DESC
  `);

  const availablePeriods = periodRows.map(r => r.period_key);

  // If requested period not in MFS, fall back to most recent MFS period
  let effectivePeriod = periodKey;
  if (!availablePeriods.includes(periodKey) && availablePeriods.length > 0) {
    effectivePeriod = availablePeriods[0];
    console.log(`[UnifiedDashboard] Period ${periodKey} not in MFS, falling back to ${effectivePeriod}`);
  }

  // 1. Fetch current period from monthly_financial_summary
  const { rows: [current] } = await pool.query(`
    SELECT * FROM monthly_financial_summary
    WHERE period_key = $1
  `, [effectivePeriod]);

  if (!current) {
    console.warn(`[UnifiedDashboard] No data in MFS for period ${effectivePeriod}. Available: ${availablePeriods.join(', ')}`);
    return null;
  }

  // 2. Fetch previous period for variations
  const [year, month] = effectivePeriod.split('-').map(Number);
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
  `, [effectivePeriod]);

  // (available periods already fetched above)

  // === Build P&L cascade from MFS (matching Looker exactly) ===
  // Primary data: what Resumen Ejecutivo sheet actually provides
  const ventasMes = num(current?.facturacion_total);
  const ebitOperativo = num(current?.ebit_operativo);
  const beneficioNeto = num(current?.beneficio_neto);
  const markup = num(current?.markup_promedio);
  const impuestosUsa = num(current?.impuestos_usa);
  const ivaCompras = num(current?.iva_compras);

  // Derived: costos directos/indirectos are NOT columns in Resumen Ejecutivo sheet
  // Derive them from Markup and EBIT when available
  // Markup = Ventas / Costos Directos → Costos Directos = Ventas / Markup
  let costosDirectos = num(current?.costos_directos);
  if (costosDirectos === 0 && markup > 0 && ventasMes > 0) {
    costosDirectos = Math.round((ventasMes / markup) * 100) / 100;
  }

  // EBIT = Ventas - Directos - Indirectos → Indirectos = Ventas - Directos - EBIT
  let costosIndirectos = num(current?.costos_indirectos);
  if (costosIndirectos === 0 && ventasMes > 0 && costosDirectos > 0) {
    costosIndirectos = Math.round((ventasMes - costosDirectos - ebitOperativo) * 100) / 100;
  }

  const margenBruto = ventasMes - costosDirectos;

  // Impuestos = EBIT - Beneficio Neto (lo que se lleva el fisco)
  const impuestos = (ventasMes > 0 && ebitOperativo !== 0) ? ebitOperativo - beneficioNeto : impuestosUsa;

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
    const mk = num(row.markup_promedio);
    const ebit = num(row.ebit_operativo);
    const bn = num(row.beneficio_neto);
    // Derive costs from markup & EBIT (same logic as current period)
    let cd = num(row.costos_directos);
    if (cd === 0 && mk > 0 && rv > 0) cd = Math.round((rv / mk) * 100) / 100;
    let ci = num(row.costos_indirectos);
    if (ci === 0 && rv > 0 && cd > 0) ci = Math.round((rv - cd - ebit) * 100) / 100;
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
    periodKey: effectivePeriod,
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
