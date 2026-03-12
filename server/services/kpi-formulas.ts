import { pool } from '../db';

/**
 * CENTRALIZED KPI FORMULAS
 * 
 * This file contains ALL official KPI formulas for the Executive Dashboard.
 * Each view (Operativo, Económico, Financiero) uses specific formulas.
 * 
 * DATA SOURCES:
 * - Devengado: fact_rc_month.revenue_usd (sum)
 * - Directos: fact_cost_month.direct_usd (sum)
 * - Overhead: fact_cost_month.indirect_usd (sum)
 * - Provisiones: fact_cost_month.provisions_usd (sum)
 * - Facturado: monthly_financial_summary.facturacion_total
 * - Caja/Activo/Pasivo: monthly_financial_summary (snapshots)
 * - Horas: fact_labor_month
 * - Cash In/Out: cash_movements
 */

// =====================================================
// PERIOD VALIDATION
// =====================================================

export function validatePeriodKey(periodKey: string): { valid: boolean; error?: string } {
  if (!periodKey || typeof periodKey !== 'string') {
    return { valid: false, error: 'period_key is required and must be a string' };
  }
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return { valid: false, error: `Invalid period_key format: "${periodKey}" (expected YYYY-MM)` };
  }
  const month = parseInt(match[2]);
  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid month ${month} in period_key "${periodKey}" (must be 01-12)` };
  }
  const year = parseInt(match[1]);
  if (year < 2020 || year > 2030) {
    return { valid: false, error: `Suspicious year ${year} in period_key "${periodKey}"` };
  }
  return { valid: true };
}

// =====================================================
// DATA FETCHERS - Single Source of Truth
// =====================================================

export interface PeriodData {
  devengadoUsd: number;
  directosUsd: number;
  overheadUsd: number;
  provisionesUsd: number;
  facturadoUsd: number;
  horasTotales: number;
  horasFacturables: number;
  personasActivas: number;
  proyectosActivos: number;
  cashInUsd: number;
  cashOutUsd: number;
  cajaTotalUsd: number;
  activoTotalUsd: number;
  pasivoTotalUsd: number;
}

export async function fetchDevengado(periodKeys: string[]): Promise<number> {
  const { rows: [data] } = await pool.query(`
    SELECT COALESCE(SUM(revenue_usd), 0) as devengado_usd
    FROM fact_rc_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  return parseFloat(data?.devengado_usd || '0');
}

export async function fetchCosts(periodKeys: string[]): Promise<{ directos: number; overhead: number; provisiones: number }> {
  const { rows: [data] } = await pool.query(`
    SELECT 
      COALESCE(SUM(direct_usd), 0) as direct_usd,
      COALESCE(SUM(indirect_usd), 0) as indirect_usd,
      COALESCE(SUM(provisions_usd), 0) as provisions_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  return {
    directos: parseFloat(data?.direct_usd || '0'),
    overhead: parseFloat(data?.indirect_usd || '0'),
    provisiones: parseFloat(data?.provisions_usd || '0'),
  };
}

export async function fetchHours(periodKeys: string[]): Promise<{ total: number; billable: number; peopleActive: number }> {
  const { rows: [data] } = await pool.query(`
    SELECT 
      COALESCE(SUM(asana_hours), 0) as total_hours,
      COALESCE(SUM(billing_hours), 0) as billable_hours,
      COUNT(DISTINCT person_id) FILTER (WHERE asana_hours > 0) as people_active
    FROM fact_labor_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  return {
    total: parseFloat(data?.total_hours || '0'),
    billable: parseFloat(data?.billable_hours || '0'),
    peopleActive: parseInt(data?.people_active || '0'),
  };
}

export async function fetchProjectsActive(): Promise<number> {
  const { rows: [data] } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE status = 'active' AND parent_project_id IS NULL) as active
    FROM active_projects
  `);
  return parseInt(data?.active || '0');
}

export interface FinancialSummaryResult {
  facturado: number;
  cajaTotal: number;
  cajaTotalIsNull: boolean;
  activoTotal: number;
  pasivoTotal: number;
  facturadoSource: 'monthly_financial_summary' | 'fact_rc_month' | 'financial_sot' | 'none';
  warnings: string[];
}

export async function fetchFinancialSummary(periodKey: string): Promise<FinancialSummaryResult> {
  const warnings: string[] = [];

  const { rows: [data] } = await pool.query(`
    SELECT facturacion_total, caja_total, total_activo, total_pasivo
    FROM monthly_financial_summary
    WHERE period_key = $1
  `, [periodKey]);

  let facturado = parseFloat(data?.facturacion_total || '0');
  // FIX: caja_total puede ser negativo (sobregiro bancario válido)
  // null = dato faltante, 0 = saldo cero, -X = sobregiro
  const cajaTotalRaw = data?.caja_total != null ? parseFloat(data.caja_total) : null;
  const cajaTotalIsNull = cajaTotalRaw == null;
  const activoTotal = parseFloat(data?.total_activo || '0');
  const pasivoTotal = parseFloat(data?.total_pasivo || '0');

  let facturadoSource: FinancialSummaryResult['facturadoSource'] = 'monthly_financial_summary';

  // Fallback para facturado con WARNINGS explícitos
  if (facturado === 0) {
    const { rows: [rcData] } = await pool.query(`
      SELECT COALESCE(SUM(revenue_usd::numeric), 0) as total_revenue
      FROM fact_rc_month
      WHERE period_key = $1
    `, [periodKey]);
    const rcRevenue = parseFloat(rcData?.total_revenue || '0');
    if (rcRevenue > 0) {
      facturadoSource = 'fact_rc_month';
      warnings.push(`⚠️ Facturado: monthly_financial_summary vacío, usando fact_rc_month ($${rcRevenue.toFixed(2)})`);
      console.warn(`⚠️ [Finanzas] Facturado fallback a fact_rc_month para ${periodKey}: $${rcRevenue.toFixed(2)}`);
      facturado = rcRevenue;
    } else {
      const { rows: [sotData] } = await pool.query(`
        SELECT COALESCE(SUM(revenue_usd::numeric), 0) as total_revenue
        FROM financial_sot
        WHERE month_key = $1
      `, [periodKey]);
      const sotRevenue = parseFloat(sotData?.total_revenue || '0');
      if (sotRevenue > 0) {
        facturadoSource = 'financial_sot';
        warnings.push(`⚠️ Facturado: ambas fuentes principales vacías, usando financial_sot ($${sotRevenue.toFixed(2)})`);
        console.warn(`⚠️ [Finanzas] Facturado fallback a financial_sot para ${periodKey}: $${sotRevenue.toFixed(2)}`);
        facturado = sotRevenue;
      } else {
        facturadoSource = 'none';
        warnings.push(`⚠️ Facturado: ninguna fuente tiene datos para ${periodKey}`);
        console.warn(`⚠️ [Finanzas] Sin datos de facturado para ${periodKey} en ninguna fuente`);
      }
    }
  }

  if (cajaTotalIsNull) {
    warnings.push(`⚠️ Caja total: dato no disponible en monthly_financial_summary para ${periodKey}`);
  }

  return {
    facturado,
    cajaTotal: cajaTotalRaw ?? 0,
    cajaTotalIsNull,
    activoTotal,
    pasivoTotal,
    facturadoSource,
    warnings,
  };
}

export async function fetchCashMovements(periodKeys: string[]): Promise<{ cashIn: number; cashOut: number }> {
  const { rows: [data] } = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_usd::numeric ELSE 0 END), 0) as cash_in_usd,
      COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_usd::numeric ELSE 0 END), 0) as cash_out_usd
    FROM cash_movements
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  return {
    cashIn: parseFloat(data?.cash_in_usd || '0'),
    cashOut: parseFloat(data?.cash_out_usd || '0'),
  };
}

// =====================================================
// KPI CALCULATION FORMULAS
// =====================================================

/**
 * OPERATIVO VIEW - Team productivity (NO overhead, NO provisiones)
 * 
 * Fórmulas:
 * - EBIT Operativo = Devengado - Directos
 * - Margen Operativo = EBIT Operativo / Devengado
 * - Markup = Devengado / Directos
 * - Tarifa Efectiva = Devengado / Horas Facturables
 * - % Facturable = Horas Facturables / Horas Totales
 */
export interface OperativoKPIs {
  devengadoUsd: number;
  directosUsd: number;
  ebitOperativoUsd: number;
  margenOperativoPct: number;
  markupOperativo: number;
  tarifaEfectivaUsd: number;
  horasFacturablesPct: number;
  horasTrabajadas: number;
  personasActivas: number;
  proyectosActivos: number;
}

export function calculateOperativoKPIs(
  devengado: number,
  directos: number,
  horasTotal: number,
  horasFacturables: number,
  personasActivas: number,
  proyectosActivos: number
): OperativoKPIs {
  const ebitOperativo = devengado - directos;
  const margenOperativo = devengado > 0 ? (ebitOperativo / devengado) * 100 : 0;
  const markup = directos > 0 ? devengado / directos : 0;
  const tarifaEfectiva = horasFacturables > 0 ? devengado / horasFacturables : 0;
  const horasFacturablesPct = horasTotal > 0 ? (horasFacturables / horasTotal) * 100 : 0;

  return {
    devengadoUsd: devengado,
    directosUsd: directos,
    ebitOperativoUsd: ebitOperativo,
    margenOperativoPct: margenOperativo,
    markupOperativo: markup,
    tarifaEfectivaUsd: tarifaEfectiva,
    horasFacturablesPct,
    horasTrabajadas: horasTotal,
    personasActivas,
    proyectosActivos,
  };
}

/**
 * ECONÓMICO VIEW - Real operating result (includes overhead, NO provisiones)
 * 
 * Fórmulas:
 * - EBIT Económico = Devengado - Directos - Overhead
 * - Margen Económico = EBIT Económico / Devengado
 * - Overhead % Total = Overhead / (Directos + Overhead)
 */
export interface EconomicoKPIs {
  devengadoUsd: number;
  directosUsd: number;
  overheadUsd: number;
  ebitEconomicoUsd: number;
  margenEconomicoPct: number;
  overheadRatioPct: number;
  personasActivas: number;
  proyectosActivos: number;
}

export function calculateEconomicoKPIs(
  devengado: number,
  directos: number,
  overhead: number,
  personasActivas: number,
  proyectosActivos: number
): EconomicoKPIs {
  const ebitEconomico = devengado - directos - overhead;
  const margenEconomico = devengado > 0 ? (ebitEconomico / devengado) * 100 : 0;
  const totalCosts = directos + overhead;
  const overheadRatio = totalCosts > 0 ? (overhead / totalCosts) * 100 : 0;

  return {
    devengadoUsd: devengado,
    directosUsd: directos,
    overheadUsd: overhead,
    ebitEconomicoUsd: ebitEconomico,
    margenEconomicoPct: margenEconomico,
    overheadRatioPct: overheadRatio,
    personasActivas,
    proyectosActivos,
  };
}

/**
 * FINANCIERO VIEW - Accounting result (includes EVERYTHING)
 * 
 * Fórmulas:
 * - EBIT Contable = Facturado - Directos - Overhead - Provisiones
 * - Burn Rate = Directos + Overhead + Provisiones
 * - Margen Contable = EBIT Contable / Facturado
 * - Cash Flow Neto = Cash In - Cash Out
 * - Patrimonio = Activo - Pasivo
 * - Runway = Caja Total / Burn Rate
 */
export interface FinancieroKPIs {
  facturadoUsd: number;
  directosUsd: number;
  overheadUsd: number;
  provisionesUsd: number;
  totalContableUsd: number;
  ebitContableUsd: number;
  margenContablePct: number;
  burnRateUsd: number;
  cashInUsd: number;
  cashOutUsd: number;
  cashFlowNetoUsd: number;
  cajaTotalUsd: number;
  activoTotalUsd: number;
  pasivoTotalUsd: number;
  patrimonioUsd: number;
  runwayMeses: number;
  personasActivas: number;
  proyectosActivos: number;
}

export function calculateFinancieroKPIs(
  facturado: number,
  directos: number,
  overhead: number,
  provisiones: number,
  cashIn: number,
  cashOut: number,
  cajaTotal: number,
  activoTotal: number,
  pasivoTotal: number,
  personasActivas: number,
  proyectosActivos: number
): FinancieroKPIs {
  const totalContable = directos + overhead + provisiones;
  const ebitContable = facturado - totalContable;
  const margenContable = facturado > 0 ? (ebitContable / facturado) * 100 : 0;
  const burnRate = totalContable;
  const cashFlowNeto = cashIn - cashOut;
  const patrimonio = activoTotal - pasivoTotal;
  const runway = burnRate > 0 ? cajaTotal / burnRate : 0;

  return {
    facturadoUsd: facturado,
    directosUsd: directos,
    overheadUsd: overhead,
    provisionesUsd: provisiones,
    totalContableUsd: totalContable,
    ebitContableUsd: ebitContable,
    margenContablePct: margenContable,
    burnRateUsd: burnRate,
    cashInUsd: cashIn,
    cashOutUsd: cashOut,
    cashFlowNetoUsd: cashFlowNeto,
    cajaTotalUsd: cajaTotal,
    activoTotalUsd: activoTotal,
    pasivoTotalUsd: pasivoTotal,
    patrimonioUsd: patrimonio,
    runwayMeses: runway,
    personasActivas,
    proyectosActivos,
  };
}

// =====================================================
// VALIDATION - Coherence tests
// =====================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateKPICoherence(
  devengado: number,
  directos: number,
  overhead: number,
  provisiones: number,
  facturado: number,
  ebitOperativo: number,
  ebitEconomico: number,
  ebitContable: number,
  burnRate: number,
  activo: number,
  pasivo: number,
  patrimonio: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // EBIT Operativo = Devengado - Directos
  const expectedEbitOp = devengado - directos;
  if (Math.abs(ebitOperativo - expectedEbitOp) > 0.01) {
    errors.push(`EBIT Operativo mismatch: ${ebitOperativo} != ${expectedEbitOp}`);
  }

  // EBIT Económico = Devengado - Directos - Overhead
  const expectedEbitEco = devengado - directos - overhead;
  if (Math.abs(ebitEconomico - expectedEbitEco) > 0.01) {
    errors.push(`EBIT Económico mismatch: ${ebitEconomico} != ${expectedEbitEco}`);
  }

  // EBIT Contable = Facturado - Directos - Overhead - Provisiones
  const expectedEbitCont = facturado - directos - overhead - provisiones;
  if (Math.abs(ebitContable - expectedEbitCont) > 0.01) {
    errors.push(`EBIT Contable mismatch: ${ebitContable} != ${expectedEbitCont}`);
  }

  // Burn Rate = Directos + Overhead + Provisiones
  const expectedBurnRate = directos + overhead + provisiones;
  if (Math.abs(burnRate - expectedBurnRate) > 0.01) {
    errors.push(`Burn Rate mismatch: ${burnRate} != ${expectedBurnRate}`);
  }

  // Patrimonio = Activo - Pasivo
  const expectedPatrimonio = activo - pasivo;
  if (Math.abs(patrimonio - expectedPatrimonio) > 0.01) {
    errors.push(`Patrimonio mismatch: ${patrimonio} != ${expectedPatrimonio}`);
  }

  // Warnings for suspicious values
  if (devengado < 0) warnings.push('Devengado is negative');
  if (ebitOperativo < 0 && devengado > 0) warnings.push('EBIT Operativo negative with positive Devengado');
  if (burnRate > facturado * 1.5) warnings.push('Burn Rate exceeds 150% of Facturado');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =====================================================
// FORMULA DESCRIPTIONS (for tooltips)
// =====================================================

export const FORMULA_DESCRIPTIONS = {
  operativo: {
    view: 'Productividad del equipo. Solo devengado y costos directos.',
    ebit: 'Devengado − Directos (sin overhead ni provisiones)',
    margen: 'EBIT Operativo / Devengado',
    markup: 'Devengado / Directos',
    tarifa: 'Devengado / Horas facturables',
    horasFacturables: 'Horas facturables / Horas totales',
  },
  economico: {
    view: 'Resultado operativo real. Incluye overhead. Sin provisiones.',
    ebit: 'Devengado − Directos − Overhead',
    margen: 'EBIT Económico / Devengado',
    overheadRatio: 'Overhead / (Directos + Overhead)',
  },
  financiero: {
    view: 'Resultado contable + caja. Incluye provisiones e impuestos.',
    ebit: 'Facturado − Directos − Overhead − Provisiones',
    margen: 'EBIT Contable / Facturado',
    burnRate: 'Directos + Overhead + Provisiones',
    cajaTotal: 'Snapshot del Excel Maestro',
    cashFlow: 'Cash In − Cash Out',
    patrimonio: 'Activo − Pasivo',
    runway: 'Caja Total / Burn Rate',
  },
} as const;

// =====================================================
// DATA FRESHNESS CHECK
// =====================================================

export async function checkDataFreshness(): Promise<{
  lastPeriodKey: string | null;
  isStale: boolean;
  staleDays: number;
  warning: string | null;
}> {
  const { rows: [data] } = await pool.query(`
    SELECT MAX(period_key) as last_period
    FROM fact_cost_month
    WHERE direct_usd IS NOT NULL
  `);
  const lastPeriodKey = data?.last_period || null;
  if (!lastPeriodKey) {
    return { lastPeriodKey: null, isStale: true, staleDays: 999, warning: 'No hay datos financieros cargados' };
  }

  const [year, month] = lastPeriodKey.split('-').map(Number);
  const lastDate = new Date(year, month - 1, 28); // end of that month approx
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const staleDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isStale = staleDays > 45; // data older than 45 days is stale

  return {
    lastPeriodKey,
    isStale,
    staleDays,
    warning: isStale ? `Datos financieros desactualizados: último período ${lastPeriodKey} (${staleDays} días)` : null,
  };
}

export const DATA_SOURCES = {
  devengado: 'fact_rc_month.revenue_usd',
  directos: 'fact_cost_month.direct_usd',
  overhead: 'fact_cost_month.indirect_usd',
  provisiones: 'fact_cost_month.provisions_usd',
  facturado: 'monthly_financial_summary.facturacion_total',
  cajaTotal: 'monthly_financial_summary.caja_total',
  activoTotal: 'monthly_financial_summary.total_activo',
  pasivoTotal: 'monthly_financial_summary.total_pasivo',
  horas: 'fact_labor_month',
  cash: 'cash_movements',
} as const;
