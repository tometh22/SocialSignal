// Keep formula imports side-effect free for unit tests. Database access is
// loaded only when a data fetcher actually runs.
const pool = {
  query: async (queryText: string, values?: unknown[]) => {
    const { pool: databasePool } = await import("../db");
    return databasePool.query(queryText, values);
  },
};

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
 * - Cash In/Out: cashflow_transactions
 */

// =====================================================
// PERIOD VALIDATION
// =====================================================

export function validatePeriodKey(periodKey: string): { valid: boolean; error?: string } {
  if (!periodKey || typeof periodKey !== 'string') {
    return { valid: false, error: 'period_key es obligatorio y debe ser un string' };
  }
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return { valid: false, error: `Formato de period_key inválido: "${periodKey}" (se espera YYYY-MM)` };
  }
  const month = parseInt(match[2]);
  if (month < 1 || month > 12) {
    return { valid: false, error: `Mes inválido ${month} en period_key "${periodKey}" (debe ser 01-12)` };
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

/** Cost model used only by Operations: worked hours valued at historical rate. */
export async function fetchOperationalDirectCosts(periodKeys: string[]): Promise<number> {
  const { rows: [data] } = await pool.query(`
    SELECT COALESCE(SUM(cost_usd), 0) as direct_usd
    FROM fact_labor_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  return parseFloat(data?.direct_usd || '0');
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
  facturadoSource: 'monthly_financial_summary' | 'revenue_events' | 'financial_sot' | 'none';
  warnings: string[];
}

export async function fetchFinancialSummary(periodKey: string): Promise<FinancialSummaryResult> {
  const warnings: string[] = [];

  const { rows: [data] } = await pool.query(`
    WITH cutover AS (SELECT description period_key FROM system_config WHERE config_key='app_mode_cutover_date' AND description IS NOT NULL)
    SELECT m.facturacion_total, m.caja_total, m.total_activo, m.total_pasivo
    FROM monthly_financial_summary m
    LEFT JOIN financial_close_periods c ON c.period_key=m.period_key
    WHERE m.period_key = $1
      AND (NOT EXISTS (SELECT 1 FROM cutover) OR m.period_key < (SELECT period_key FROM cutover) OR c.status='CLOSED')
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
    const { rows: [nativeData] } = await pool.query(`
      SELECT COALESCE(SUM(amount_usd::numeric), 0) as total_revenue
      FROM revenue_events
      WHERE invoice_period = $1 AND status <> 'cancelled'
    `, [periodKey]);
    const nativeRevenue = parseFloat(nativeData?.total_revenue || '0');
    if (nativeRevenue > 0) {
      facturadoSource = 'revenue_events';
      facturado = nativeRevenue;
    } else {
      const { rows: [sotData] } = await pool.query(`
        WITH cutover AS (SELECT description period_key FROM system_config WHERE config_key='app_mode_cutover_date' AND description IS NOT NULL)
        SELECT COALESCE(SUM(revenue_usd::numeric),0) AS total_revenue
        FROM financial_sot
        WHERE month_key=$1 AND (NOT EXISTS (SELECT 1 FROM cutover) OR month_key < (SELECT period_key FROM cutover))
      `, [periodKey]);
      const sotRevenue = parseFloat(sotData?.total_revenue || '0');
      if (sotRevenue > 0) {
        facturadoSource = 'financial_sot';
        facturado = sotRevenue;
      } else {
        facturadoSource = 'none';
        warnings.push(`⚠️ Facturado: ninguna fuente tiene datos para ${periodKey}`);
        console.warn(`⚠️ [Finanzas] Sin datos de facturado para ${periodKey} en ninguna fuente`);
      }
    }
  }

  let liveCaja = cajaTotalRaw;
  let liveActivo = activoTotal;
  let livePasivo = pasivoTotal;
  if (cajaTotalIsNull) {
    const { rows: [live] } = await pool.query(`
      WITH fx AS (
        SELECT COALESCE((SELECT rate::numeric FROM exchange_rates WHERE year=left($1,4)::int AND month=right($1,2)::int AND is_active=true ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 1),1) rate
      ), cash AS (
        SELECT COALESCE(sum(CASE WHEN tipo_movimiento='Ingreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) WHEN tipo_movimiento='Egreso' AND transfer_group_id IS NULL THEN -COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END),0) total
        FROM cashflow_transactions WHERE period_key<=$1 AND source<>'excel' AND voided_at IS NULL
      ), opening AS (
        SELECT COALESCE(sum(CASE WHEN currency='ARS' THEN opening_balance/(SELECT rate FROM fx) ELSE opening_balance END),0) total FROM financial_accounts WHERE is_active=true
      ), receivables AS (
        SELECT COALESCE(sum(CASE WHEN currency='ARS' THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END),0) total FROM activo_entries WHERE period_key<=$1 AND voided_at IS NULL
      ), payables AS (
        SELECT COALESCE(sum(CASE WHEN currency='ARS' THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END),0) total FROM pasivo_entries WHERE period_key<=$1 AND voided_at IS NULL
      ), provisions AS (
        SELECT COALESCE(sum(CASE WHEN currency='ARS' THEN COALESCE(remaining_amount,0)/(SELECT rate FROM fx) ELSE COALESCE(remaining_amount,0) END),0) total FROM provision_entries WHERE period_key<=$1 AND status IN ('APPROVED','ACTIVE')
      )
      SELECT (opening.total+cash.total)::float caja, (opening.total+cash.total+receivables.total)::float activo, (payables.total+provisions.total)::float pasivo
      FROM opening,cash,receivables,payables,provisions
    `, [periodKey]);
    liveCaja = Number(live?.caja ?? 0);
    liveActivo = Number(live?.activo ?? 0);
    livePasivo = Number(live?.pasivo ?? 0);
    warnings.push(`Caja, Activo y Pasivo calculados en vivo desde el ledger de Mind para ${periodKey}`);
  }

  return {
    facturado,
    cajaTotal: liveCaja ?? 0,
    cajaTotalIsNull,
    activoTotal: liveActivo,
    pasivoTotal: livePasivo,
    facturadoSource,
    warnings,
  };
}

export async function fetchCashMovements(periodKeys: string[]): Promise<{ cashIn: number; cashOut: number }> {
  const { rows: [data] } = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'Ingreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd::numeric,monto_ars::numeric/NULLIF(cotizacion::numeric,0),0) ELSE 0 END), 0) as cash_in_usd,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'Egreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd::numeric,monto_ars::numeric/NULLIF(cotizacion::numeric,0),0) ELSE 0 END), 0) as cash_out_usd
    FROM cashflow_transactions
    WHERE period_key = ANY($1) AND voided_at IS NULL
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
    cajaTotal: 'Saldos de cuentas + movimientos conciliados en Mind',
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
  directos: 'fact_cost_month.direct_usd (factura aprobada para contratos fijos; horas × tarifa para freelance)',
  directosOperativos: 'fact_labor_month.cost_usd (horas × tarifa histórica)',
  overhead: 'fact_cost_month.indirect_usd',
  provisiones: 'fact_cost_month.provisions_usd',
  facturado: 'revenue_events / snapshot financiero de Mind',
  cajaTotal: 'ledger de Mind / snapshot de cierre',
  activoTotal: 'ledger de Mind / snapshot de cierre',
  pasivoTotal: 'ledger de Mind / snapshot de cierre',
  horas: 'fact_labor_month',
  cash: 'cashflow_transactions',
} as const;
