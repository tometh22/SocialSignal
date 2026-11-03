import { NATIVE_DASHBOARD_SQL } from "../domain/financial-dashboard-query";
import { ReadCache } from "../utils/read-cache";
import { onAppEvent } from "./app-events";
import { pool } from "../db";
import { aggregateMonths, type MonthData } from "./direct-sheets-dashboard";
import { getRevenueByBasis } from "./revenue-basis";

const num = (value: unknown): number | null => value == null ? null : Number(value);

function selectDashboardRows(
  allData: MonthData[],
  filterYear?: number, filterMonth?: number, filterQuarter?: number, filterYearTotal?: boolean,
  filterStartYear?: number, filterStartMonth?: number, filterEndYear?: number, filterEndMonth?: number,
) {
  const available = allData.map((row) => row.periodKey);
  let filtered: MonthData | null = null;
  if (filterYear && filterYearTotal) {
    const months = allData.filter((row) => row.year === filterYear).sort((a, b) => a.month - b.month);
    filtered = aggregateMonths(months, `${filterYear}-YTD`, `Año ${filterYear}`, filterYear, months.at(-1)?.month ?? 12);
    if (filtered) {
      (filtered as any)._ytdLastMonthLabel = months.at(-1)?.monthLabel;
      (filtered as any)._ytdMonthCount = months.length;
      filtered.mesesCerrados = months.filter((row) => row.cierre).length;
      filtered.mesesProyectados = months.filter((row) => !row.cierre).length;
    }
  } else if (filterYear && filterQuarter) {
    const start = (filterQuarter - 1) * 3 + 1;
    const months = allData.filter((row) => row.year === filterYear && row.month >= start && row.month <= start + 2);
    filtered = aggregateMonths(months, `${filterYear}-Q${filterQuarter}`, `Q${filterQuarter} ${filterYear}`, filterYear, start);
    if (filtered) (filtered as any)._closedMonthCount = months.filter((row) => row.cierre).length;
  } else if (filterStartYear && filterStartMonth && filterEndYear && filterEndMonth) {
    const start = `${filterStartYear}-${String(filterStartMonth).padStart(2, "0")}`;
    const end = `${filterEndYear}-${String(filterEndMonth).padStart(2, "0")}`;
    const months = allData.filter((row) => row.periodKey >= start && row.periodKey <= end);
    filtered = aggregateMonths(months, `${start}:${end}`, `${start} → ${end}`, filterEndYear, filterEndMonth);
    if (filtered) (filtered as any)._rangeMonthCount = months.length;
  } else if (filterYear && filterMonth) {
    filtered = allData.find((row) => row.periodKey === `${filterYear}-${String(filterMonth).padStart(2, "0")}`) ?? null;
  }
  if (!filtered && allData.length) filtered = allData.at(-1) ?? null;
  return { data: allData, filtered, available };
}

/** Mismo contrato del dashboard histórico, pero alimentado sólo por Mind. */
async function loadNativeExecutiveDashboard(
  filterYear?: number, filterMonth?: number, filterQuarter?: number, filterYearTotal?: boolean,
  filterStartYear?: number, filterStartMonth?: number, filterEndYear?: number, filterEndMonth?: number,
) {
  const { rows } = await pool.query(`
    WITH cutover AS (
      SELECT description AS period_key FROM system_config WHERE config_key='app_mode_cutover_date' AND description IS NOT NULL
    )
    SELECT m.*, COALESCE(c.status='CLOSED', false) AS is_closed
    FROM monthly_financial_summary m
    LEFT JOIN financial_close_periods c ON c.period_key=m.period_key
    WHERE NOT EXISTS (SELECT 1 FROM cutover)
       OR m.period_key < (SELECT period_key FROM cutover)
       OR c.status='CLOSED'
    ORDER BY m.period_key
  `);
  const { rows: liveRows } = await pool.query(NATIVE_DASHBOARD_SQL);
  const dataByPeriod = new Map<string, MonthData>(rows.map((row: any) => [row.period_key, {
    periodKey: row.period_key, year: Number(row.year), month: Number(row.month_number),
    monthLabel: row.month_label || row.period_key, cierre: Boolean(row.is_closed || row.cierre_date),
    ventasDelMes: num(row.facturacion_total), ebitOperativo: num(row.ebit_operativo), beneficioNeto: num(row.beneficio_neto),
    margenOperativo: num(row.margen_operativo), margenNeto: num(row.margen_neto), markup: num(row.markup_promedio),
    proyeccionResultado: num(row.proyeccion_resultado), activoLiquido: num(row.caja_total), activoMedPlazo: num(row.inversiones),
    clientesACobrar: num(row.cuentas_cobrar_usd), activoTotal: num(row.total_activo), pasivoImpuestosUSA: num(row.impuestos_usa),
    pasivoFacturacionAdelantada: num(row.pasivo_facturacion_adelantada), pasivoProveedores: num(row.cuentas_pagar_usd),
    pasivoTotal: num(row.total_pasivo), balanceNeto: num(row.balance_neto), cashflow: num(row.cashflow_neto), cashflow60Dias: num(row.balance_60_dias),
  }]));
  for (const row of liveRows) {
    if (row.is_closed && dataByPeriod.has(row.period_key)) continue;
    const revenue = Number(row.facturacion_total) || 0;
    const direct = Number(row.costos_directos) || 0;
    const operationalDirect = Number(row.costos_directos_operativos) || 0;
    const indirect = Number(row.costos_indirectos) || 0;
    const provisionExpense = Number(row.gasto_provisiones) || 0;
    const provisionLiability = Number(row.provision_liability) || 0;
    const cash = (Number(row.opening_cash) || 0) + (Number(row.cumulative_cashflow) || 0);
    const receivables = Number(row.cuentas_cobrar_usd) || 0;
    const payables = Number(row.cuentas_pagar_usd) || 0;
    const ebit = revenue - direct - indirect;
    const benefit = ebit - provisionExpense;
    const [year, month] = row.period_key.split("-").map(Number);
    dataByPeriod.set(row.period_key, {
      periodKey: row.period_key, year, month, monthLabel: row.period_key, cierre: Boolean(row.is_closed),
      ventasDelMes: revenue, ebitOperativo: ebit, beneficioNeto: benefit,
      margenOperativo: revenue ? ebit / revenue * 100 : null, margenNeto: revenue ? benefit / revenue * 100 : null,
      markup: operationalDirect ? revenue / operationalDirect : null, proyeccionResultado: benefit,
      activoLiquido: cash, activoMedPlazo: null, clientesACobrar: receivables,
      activoTotal: cash + receivables, pasivoImpuestosUSA: null, pasivoFacturacionAdelantada: provisionLiability,
      pasivoProveedores: payables, pasivoTotal: payables + provisionLiability,
      balanceNeto: cash + receivables - payables - provisionLiability, cashflow: Number(row.cashflow_neto) || 0, cashflow60Dias: null,
    });
  }
  const data = [...dataByPeriod.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  return selectDashboardRows(data, filterYear, filterMonth, filterQuarter, filterYearTotal, filterStartYear, filterStartMonth, filterEndYear, filterEndMonth);
}

export async function getNativeProjectionSummary(year: number) {
  const periods = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const [basis, costs, closed] = await Promise.all([
    getRevenueByBasis(periods, { includePipeline: true, weightByProbability: true }),
    pool.query(`
      SELECT p.period_key,
        COALESCE(NULLIF(f.direct_usd+f.indirect_usd,0), e.estimated, 0)::float total
      FROM unnest($1::text[]) p(period_key)
      LEFT JOIN fact_cost_month f ON f.period_key=p.period_key
      LEFT JOIN LATERAL (SELECT sum(monto_total_usd)::numeric estimated FROM fact_estimated_cost_month WHERE month_key=p.period_key) e ON true
    `, [periods]),
    pool.query(`SELECT c.period_key,m.facturacion_total,m.costos_directos,m.costos_indirectos,m.ebit_operativo
      FROM financial_close_periods c LEFT JOIN monthly_financial_summary m ON m.period_key=c.period_key
      WHERE c.period_key=ANY($1::text[]) AND c.status='CLOSED'`, [periods]),
  ]);
  const costByPeriod = new Map(costs.rows.map((row: any) => [row.period_key, Number(row.total) || 0]));
  const closedByPeriod = new Map(closed.rows.map((row: any) => [row.period_key, row]));
  const months = basis.map((row) => {
    const snapshot: any = closedByPeriod.get(row.periodKey);
    const revenue = snapshot ? Number(snapshot.facturacion_total) || 0 : row.devengado;
    const cost = snapshot ? (Number(snapshot.costos_directos) || 0) + (Number(snapshot.costos_indirectos) || 0) : costByPeriod.get(row.periodKey) ?? 0;
    const result = snapshot ? Number(snapshot.ebit_operativo) || revenue - cost : revenue - cost;
    return { periodKey: row.periodKey, monthLabel: row.periodKey, cierre: Boolean(snapshot), facturacion: revenue, costos: cost, resultado: result };
  });
  const series = (key: "facturacion" | "costos" | "resultado") => {
    const ejecutado = months.filter((row) => row.cierre).reduce((sum, row) => sum + row[key], 0);
    const proyectado = months.filter((row) => !row.cierre).reduce((sum, row) => sum + row[key], 0);
    return { ejecutado, proyectado, total: ejecutado + proyectado };
  };
  return { year, facturacion: series("facturacion"), costos: series("costos"), resultado: series("resultado"), months, meses: months, mesesCerrados: months.filter((row) => row.cierre).length, mesesProyectados: months.filter((row) => !row.cierre).length };
}

const dashboardCache = new ReadCache<Awaited<ReturnType<typeof loadNativeExecutiveDashboard>>>(10_000, 24);
export function invalidateNativeDashboard() { dashboardCache.clear(); }
onAppEvent(event => { if (event.topic === "cache") invalidateNativeDashboard(); });
export function fetchNativeExecutiveDashboard(...args: Parameters<typeof loadNativeExecutiveDashboard>) {
  // The SQL data is independent of the selected period: share its work across filters.
  return dashboardCache.get("native", () => loadNativeExecutiveDashboard()).then(result =>
    selectDashboardRows(result.data, ...args));
}
