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

  // Proyección y Balance 60 días
  proyeccionResultado: number;
  balance60Dias: number;

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

  // Diagnostic info (helps debug data issues)
  _debug?: {
    requestedPeriod: string;
    effectivePeriod: string;
    hasPnlData: boolean;
    dataSource: string;
  };
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
  proyeccionResultado: number;
  balance60Dias: number;
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

  // Use the requested period directly — no fallback to a different period.
  // If the period has partial data (balance but no P&L), we show what we have.
  // P&L fallback sources (income_sot, fact_cost_month) are still tried for the SAME period.
  const effectivePeriod = periodKey;

  // 1. Fetch current period from monthly_financial_summary
  const { rows: [current] } = await pool.query(`
    SELECT * FROM monthly_financial_summary
    WHERE period_key = $1
  `, [effectivePeriod]);

  if (!current) {
    console.warn(`[UnifiedDashboard] No data in MFS for period ${effectivePeriod}. Available: ${availablePeriods.join(', ')}`);
    // Return an empty shell for the requested period so the frontend can still render
    // The P&L fallback logic below will try alternative data sources
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

  // === Build P&L cascade ===
  // Primary source: MFS (from "Resumen Ejecutivo" sheet)
  let ventasMes = num(current?.facturacion_total);
  let ebitOperativo = num(current?.ebit_operativo);
  let beneficioNeto = num(current?.beneficio_neto);
  let markup = num(current?.markup_promedio);
  const impuestosUsa = num(current?.impuestos_usa);
  const ivaCompras = num(current?.iva_compras);
  let costosDirectos = num(current?.costos_directos);
  let costosIndirectos = num(current?.costos_indirectos);

  // === FALLBACK: When MFS has no P&L, compute from alternative tables ===
  if (ventasMes === 0) {
    console.log(`[UnifiedDashboard] MFS has no P&L for ${effectivePeriod}, trying fallback sources...`);

    // Fallback ventas: income_sot (confirmed revenue)
    const { rows: salesRows } = await pool.query(`
      SELECT COALESCE(SUM(revenue_usd), 0) as total_ventas
      FROM income_sot
      WHERE month_key = $1 AND confirmed = true
    `, [effectivePeriod]);
    const fallbackVentas = parseFloat(salesRows[0]?.total_ventas) || 0;

    // If income_sot empty, try google_sheets_sales
    if (fallbackVentas === 0) {
      const { rows: gsSalesRows } = await pool.query(`
        SELECT COALESCE(SUM(CAST(amount_usd AS numeric)), 0) as total_ventas
        FROM google_sheets_sales
        WHERE month_key = $1 AND status != 'proyectado'
      `, [effectivePeriod]);
      ventasMes = parseFloat(gsSalesRows[0]?.total_ventas) || 0;
    } else {
      ventasMes = fallbackVentas;
    }

    // Fallback costos: fact_cost_month
    const { rows: costRows } = await pool.query(`
      SELECT
        COALESCE(SUM(CAST(direct_usd AS numeric)), 0) as direct,
        COALESCE(SUM(CAST(indirect_usd AS numeric)), 0) as indirect
      FROM fact_cost_month
      WHERE period_key = $1
    `, [effectivePeriod]);
    const fallbackDirectos = parseFloat(costRows[0]?.direct) || 0;
    const fallbackIndirectos = parseFloat(costRows[0]?.indirect) || 0;

    // If fact_cost_month empty, try direct_costs table
    if (fallbackDirectos === 0) {
      const { rows: dcRows } = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(tipo_gasto) = 'directo' THEN CAST(monto_total_usd AS numeric) ELSE 0 END), 0) as direct,
          COALESCE(SUM(CASE WHEN LOWER(tipo_gasto) != 'directo' THEN CAST(monto_total_usd AS numeric) ELSE 0 END), 0) as indirect
        FROM direct_costs
        WHERE month_key = $1
      `, [effectivePeriod]);
      costosDirectos = parseFloat(dcRows[0]?.direct) || 0;
      costosIndirectos = parseFloat(dcRows[0]?.indirect) || 0;
    } else {
      costosDirectos = fallbackDirectos;
      costosIndirectos = fallbackIndirectos;
    }

    // Compute EBIT and derived metrics from fallback data
    // ONLY compute EBIT if we actually have ventas — otherwise costos alone produce misleading negative EBIT
    if (ventasMes > 0) {
      ebitOperativo = ventasMes - costosDirectos - costosIndirectos;
      markup = costosDirectos > 0 ? Math.round((ventasMes / costosDirectos) * 100) / 100 : 0;
      beneficioNeto = ebitOperativo - impuestosUsa; // approximate
      console.log(`[UnifiedDashboard] Fallback P&L: Ventas=$${ventasMes}, Directos=$${costosDirectos}, Indirectos=$${costosIndirectos}, EBIT=$${ebitOperativo}`);
    } else {
      // No ventas found in any fallback source — don't fabricate negative EBIT from costs alone
      console.log(`[UnifiedDashboard] Fallback: No ventas found for ${effectivePeriod}. Costs exist (D=$${costosDirectos}, I=$${costosIndirectos}) but won't compute EBIT without ventas.`);
      // Reset costs too — showing costs without ventas is misleading in the P&L cascade
      costosDirectos = 0;
      costosIndirectos = 0;
    }
  }

  // If MFS had ventas but no costs, derive from Markup and EBIT
  if (ventasMes > 0 && costosDirectos === 0 && markup > 0) {
    costosDirectos = Math.round((ventasMes / markup) * 100) / 100;
  }
  // If costosDirectos has a value but costosIndirectos is 0, and we have markup,
  // check if costosDirectos is actually the COMBINED costs (from "Costos Cerrados USD" column).
  // Split using markup: real direct = ventas/markup, indirect = remainder.
  if (ventasMes > 0 && costosDirectos > 0 && costosIndirectos === 0 && markup > 0) {
    const derivedDirect = Math.round((ventasMes / markup) * 100) / 100;
    if (derivedDirect < costosDirectos * 0.8) {
      // costosDirectos is likely combined costs — split it
      console.log(`[UnifiedDashboard] Splitting combined costs: total=${costosDirectos}, derivedDirect=${derivedDirect} (from markup=${markup})`);
      costosIndirectos = Math.round((ventasMes - derivedDirect - ebitOperativo) * 100) / 100;
      costosDirectos = derivedDirect;
    } else {
      // costosDirectos is truly just direct — derive indirect from the gap
      costosIndirectos = Math.round((ventasMes - costosDirectos - ebitOperativo) * 100) / 100;
    }
  }

  const margenBruto = ventasMes - costosDirectos;

  // Impuestos: derive from EBIT - Beneficio Neto (matches Looker implicit calculation)
  // Sanity check: if the derived "impuestos" exceeds 2x |EBIT|, the Sheet data is inconsistent
  // (likely beneficioNeto includes provisions/adjustments beyond taxes) — fall back to impuestosUsa
  let impuestos = impuestosUsa;
  if (ventasMes > 0 && ebitOperativo !== 0) {
    const derivedImpuestos = ebitOperativo - beneficioNeto;
    if (derivedImpuestos >= 0 && (Math.abs(ebitOperativo) === 0 || derivedImpuestos <= Math.abs(ebitOperativo) * 2)) {
      impuestos = derivedImpuestos;
    } else {
      console.warn(`[UnifiedDashboard] Impuestos sanity check failed: derived=${derivedImpuestos}, EBIT=${ebitOperativo}, beneficio=${beneficioNeto}. Using impuestosUsa=${impuestosUsa}`);
    }
  }

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

  // Proyección y Balance 60 días
  const proyeccionResultado = num(current?.proyeccion_resultado);
  const balance60Dias = num(current?.balance_60_dias);

  // Margen from sheet (prefer sheet values over calculated when available)
  const sheetMargenOperativo = num(current?.margen_operativo);
  const sheetMargenNeto = num(current?.margen_neto);

  // Burn & Runway
  const burnRate = costosDirectos + costosIndirectos + impuestosUsa;
  const runway = burnRate > 0 ? Math.round((cajaTotal / burnRate) * 10) / 10 : 0;

  // Variations
  function variation(currentVal: number, prevVal: number | undefined): number | null {
    const p = num(prevVal);
    if (p === 0) return null;
    return Math.round(((currentVal - p) / Math.abs(p)) * 10000) / 100;
  }

  // Trends: enrich with fallback P&L for periods missing it
  // First, batch-fetch fallback data for periods with no ventas in MFS
  const periodsNeedingFallback = trendRows
    .filter(r => !r.facturacion_total || parseFloat(r.facturacion_total) === 0)
    .map(r => r.period_key);

  const fallbackPL: Record<string, { ventas: number; directos: number; indirectos: number }> = {};
  if (periodsNeedingFallback.length > 0) {
    // Batch query income_sot
    const { rows: fbSales } = await pool.query(`
      SELECT month_key, COALESCE(SUM(revenue_usd), 0) as total
      FROM income_sot
      WHERE month_key = ANY($1) AND confirmed = true
      GROUP BY month_key
    `, [periodsNeedingFallback]);
    for (const r of fbSales) {
      fallbackPL[r.month_key] = { ventas: parseFloat(r.total) || 0, directos: 0, indirectos: 0 };
    }

    // If income_sot didn't have data, try google_sheets_sales
    const stillMissing = periodsNeedingFallback.filter(p => !fallbackPL[p] || fallbackPL[p].ventas === 0);
    if (stillMissing.length > 0) {
      const { rows: gsSales } = await pool.query(`
        SELECT month_key, COALESCE(SUM(CAST(amount_usd AS numeric)), 0) as total
        FROM google_sheets_sales
        WHERE month_key = ANY($1) AND status != 'proyectado'
        GROUP BY month_key
      `, [stillMissing]);
      for (const r of gsSales) {
        fallbackPL[r.month_key] = { ventas: parseFloat(r.total) || 0, directos: 0, indirectos: 0 };
      }
    }

    // Batch query fact_cost_month
    const { rows: fbCosts } = await pool.query(`
      SELECT period_key,
        COALESCE(SUM(CAST(direct_usd AS numeric)), 0) as direct,
        COALESCE(SUM(CAST(indirect_usd AS numeric)), 0) as indirect
      FROM fact_cost_month
      WHERE period_key = ANY($1)
      GROUP BY period_key
    `, [periodsNeedingFallback]);
    for (const r of fbCosts) {
      if (!fallbackPL[r.period_key]) fallbackPL[r.period_key] = { ventas: 0, directos: 0, indirectos: 0 };
      fallbackPL[r.period_key].directos = parseFloat(r.direct) || 0;
      fallbackPL[r.period_key].indirectos = parseFloat(r.indirect) || 0;
    }

    // If fact_cost_month empty, try direct_costs
    const costsStillMissing = periodsNeedingFallback.filter(p => !fallbackPL[p] || (fallbackPL[p].directos === 0));
    if (costsStillMissing.length > 0) {
      const { rows: dcRows } = await pool.query(`
        SELECT month_key,
          COALESCE(SUM(CASE WHEN LOWER(tipo_gasto) = 'directo' THEN CAST(monto_total_usd AS numeric) ELSE 0 END), 0) as direct,
          COALESCE(SUM(CASE WHEN LOWER(tipo_gasto) != 'directo' THEN CAST(monto_total_usd AS numeric) ELSE 0 END), 0) as indirect
        FROM direct_costs
        WHERE month_key = ANY($1)
        GROUP BY month_key
      `, [costsStillMissing]);
      for (const r of dcRows) {
        if (!fallbackPL[r.month_key]) fallbackPL[r.month_key] = { ventas: 0, directos: 0, indirectos: 0 };
        fallbackPL[r.month_key].directos = parseFloat(r.direct) || 0;
        fallbackPL[r.month_key].indirectos = parseFloat(r.indirect) || 0;
      }
    }
  }

  // Build trends (reversed to chronological order)
  const trends: MonthlyTrend[] = trendRows.reverse().map(row => {
    let rv = num(row.facturacion_total);
    let cd = num(row.costos_directos);
    let ci = num(row.costos_indirectos);
    let mk = num(row.markup_promedio);
    let ebit = num(row.ebit_operativo);
    let bn = num(row.beneficio_neto);

    // Apply fallback if MFS has no P&L for this period
    const fb = fallbackPL[row.period_key];
    if (rv === 0 && fb && fb.ventas > 0) {
      rv = fb.ventas;
      cd = fb.directos;
      ci = fb.indirectos;
      ebit = rv - cd - ci;
      mk = cd > 0 ? Math.round((rv / cd) * 100) / 100 : 0;
      bn = ebit; // approximate (no tax info from fallback)
    }

    // Derive costs from markup & EBIT when available
    if (cd === 0 && mk > 0 && rv > 0) cd = Math.round((rv / mk) * 100) / 100;
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
      margenOperativoPct: num(row.margen_operativo) !== 0 ? num(row.margen_operativo) : pct(ebit, rv),
      margenNetoPct: num(row.margen_neto) !== 0 ? num(row.margen_neto) : pct(bn, rv),
      cashflowNeto: num(row.cashflow_neto),
      cajaTotal: num(row.caja_total),
      totalActivo: num(row.total_activo),
      totalPasivo: num(row.total_pasivo),
      balanceNeto: num(row.balance_neto) || (num(row.total_activo) - num(row.total_pasivo)),
      proyeccionResultado: num(row.proyeccion_resultado),
      balance60Dias: num(row.balance_60_dias),
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
    margenOperativoPct: sheetMargenOperativo !== 0 ? sheetMargenOperativo : pct(ebitOperativo, ventasMes),
    impuestos,
    beneficioNeto,
    margenNetoPct: sheetMargenNeto !== 0 ? sheetMargenNeto : pct(beneficioNeto, ventasMes),
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

    // Proyección y Balance 60 días
    proyeccionResultado,
    balance60Dias,

    // Derived
    burnRate,
    runway,

    // Variations
    ventasVariation: variation(ventasMes, prev?.facturacion_total),
    ebitVariation: variation(ebitOperativo, prev?.ebit_operativo),
    beneficioVariation: variation(beneficioNeto, prev?.beneficio_neto),
    cashflowVariation: variation(cashflowNeto, prev?.cashflow_neto),

    trends,
    availablePeriods: availablePeriods.includes(periodKey)
      ? availablePeriods
      : [periodKey, ...availablePeriods].sort().reverse(),

    _debug: {
      requestedPeriod: periodKey,
      effectivePeriod,
      hasPnlData: ventasMes > 0,
      dataSource: ventasMes > 0
        ? (num(current?.facturacion_total) > 0 ? 'MFS (Resumen Ejecutivo)' : 'fallback (income_sot/google_sheets_sales)')
        : 'no P&L data found',
    },
  };
}
