import { NATIVE_DASHBOARD_SQL } from "../domain/financial-dashboard-query";
import { ReadCache } from "../utils/read-cache";
import { onAppEvent } from "./app-events";
import { pool } from "../db";
import { aggregateMonths, type MonthData } from "./direct-sheets-dashboard";
import { getMasterScenarioSnapshot } from './financial-master-scenario';
import { buildMasterDashboard } from './financial-master-dashboard';
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
  if (!filtered && !filterYear && !filterStartYear && allData.length) filtered = allData.at(-1) ?? null;
  return { data: allData, filtered, available };
}

/** One source per month: closed Mind snapshot, explicit native activity, or Master. */
async function loadNativeExecutiveDashboard(
  filterYear?: number, filterMonth?: number, filterQuarter?: number, filterYearTotal?: boolean,
  filterStartYear?: number, filterStartMonth?: number, filterEndYear?: number, filterEndMonth?: number,
) {
  const { rows } = await pool.query(`
    SELECT m.*, c.status AS native_close_status, COALESCE(c.status='CLOSED', false) AS is_closed,
      EXISTS (SELECT 1 FROM revenue_events r WHERE r.invoice_period=m.period_key AND r.source_tab='mind_intake') AS has_native_revenue
    FROM monthly_financial_summary m
    LEFT JOIN financial_close_periods c ON c.period_key=m.period_key
    ORDER BY m.period_key
  `);
  const { rows: liveRows } = await pool.query(NATIVE_DASHBOARD_SQL);
  // Imported liabilities/cash/facts do not prove that a month has migrated to Mind.
  // Keep the same source boundary as Projection, including cancelled native revenue.
  const masterPeriods = rows.filter(row => row.native_close_status == null && !row.has_native_revenue
    && row.facturacion_total != null).map(row => row.period_key);
  const masterSnapshot = masterPeriods.length ? await getMasterScenarioSnapshot() : null;
  const masterRows = masterSnapshot ? buildMasterDashboard(masterSnapshot, masterPeriods) : [];
  const masterSet = new Set(masterPeriods);
  const dataByPeriod = new Map<string, MonthData>(rows.filter(row => row.is_closed).map((row: any) => [row.period_key, {
    periodKey: row.period_key, year: Number(row.year), month: Number(row.month_number),
    monthLabel: row.month_label || row.period_key, cierre: Boolean(row.is_closed), fuenteDatos: 'cierre',
    ventasDelMes: num(row.facturacion_total), ebitOperativo: num(row.ebit_operativo), beneficioNeto: num(row.beneficio_neto),
    margenOperativo: num(row.margen_operativo), margenNeto: num(row.margen_neto), markup: num(row.markup_promedio),
    proyeccionResultado: num(row.proyeccion_resultado), activoLiquido: num(row.caja_total), activoMedPlazo: num(row.inversiones),
    clientesACobrar: num(row.cuentas_cobrar_usd), activoTotal: num(row.total_activo), pasivoImpuestosUSA: num(row.impuestos_usa),
    pasivoFacturacionAdelantada: num(row.pasivo_facturacion_adelantada), pasivoProveedores: num(row.cuentas_pagar_usd),
    pasivoTotal: num(row.total_pasivo), balanceNeto: num(row.balance_neto), cashflow: num(row.cashflow_neto), cashflow60Dias: num(row.balance_60_dias),
  }]));
  const nativePeriodsPresent = new Set(liveRows.map(row => row.period_key));
  for (const row of rows) {
    if (!row.is_closed && !masterSet.has(row.period_key) && !nativePeriodsPresent.has(row.period_key)) {
      liveRows.push({ period_key: row.period_key, is_closed: false });
    }
  }
  for (const row of liveRows) {
    if (masterSet.has(row.period_key) || (row.is_closed && dataByPeriod.has(row.period_key))) continue;
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
      periodKey: row.period_key, year, month, monthLabel: row.period_key, cierre: Boolean(row.is_closed), fuenteDatos: 'mind',
      ventasDelMes: revenue, ebitOperativo: ebit, beneficioNeto: benefit,
      margenOperativo: revenue ? ebit / revenue * 100 : null, margenNeto: revenue ? benefit / revenue * 100 : null,
      markup: operationalDirect ? revenue / operationalDirect : null, proyeccionResultado: benefit,
      activoLiquido: cash, activoMedPlazo: null, clientesACobrar: receivables,
      activoTotal: cash + receivables, pasivoImpuestosUSA: null, pasivoFacturacionAdelantada: provisionLiability,
      pasivoProveedores: payables, pasivoTotal: payables + provisionLiability,
      balanceNeto: cash + receivables - payables - provisionLiability, cashflow: Number(row.cashflow_neto) || 0, cashflow60Dias: null,
    });
  }
  for (const month of masterRows) dataByPeriod.set(month.periodKey, month);
  const data = [...dataByPeriod.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  return { ...selectDashboardRows(data, filterYear, filterMonth, filterQuarter, filterYearTotal, filterStartYear, filterStartMonth, filterEndYear, filterEndMonth), sourceReadAt: masterSnapshot?.readAt };
}

export async function getNativeProjectionSummary(year: number) {
  const periods = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const [basis, costs, summaries] = await Promise.all([
    getRevenueByBasis(periods, { includePipeline: true, weightByProbability: true }),
    pool.query(`
      SELECT p.period_key,
        COALESCE(NULLIF(f.direct_usd+f.indirect_usd,0), e.estimated, 0)::float total
      FROM unnest($1::text[]) p(period_key)
      LEFT JOIN fact_cost_month f ON f.period_key=p.period_key
      LEFT JOIN LATERAL (SELECT sum(monto_total_usd)::numeric estimated FROM fact_estimated_cost_month WHERE month_key=p.period_key) e ON true
    `, [periods]),
    // El corte operativo no recorta el presupuesto anual ya importado del
    // Máster. Se conserva como base hasta que el mes tenga ingresos o cierre
    // nativos; no se vuelve a importar ni se suma a esos ingresos.
    pool.query(`SELECT p.period_key,m.facturacion_total,m.costos_directos,m.costos_indirectos,m.ebit_operativo,
        c.status='CLOSED' AS is_native_closed,
        CASE WHEN c.status IS NOT NULL THEN c.status='CLOSED'
          ELSE m.cierre_date IS NOT NULL END AS is_closed
      FROM unnest($1::text[]) p(period_key)
      LEFT JOIN financial_close_periods c ON c.period_key=p.period_key
      LEFT JOIN monthly_financial_summary m ON m.period_key=p.period_key
      WHERE c.status='CLOSED' OR (
        m.period_key IS NOT NULL AND c.period_key IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM revenue_events r
          WHERE r.invoice_period=p.period_key AND r.source_tab='mind_intake'
        )
      )`, [periods]),
  ]);
  const costByPeriod = new Map(costs.rows.map((row: any) => [row.period_key, Number(row.total) || 0]));
  const summaryByPeriod = new Map(summaries.rows.map((row: any) => [row.period_key, row]));
  const months = basis.map((row) => {
    // La base anual importada no tiene necesariamente revenue_events ni un
    // cierre nativo. Elegir una sola fuente por mes evita perderla o duplicarla.
    const snapshot: any = summaryByPeriod.get(row.periodKey);
    const snapshotRevenue = num(snapshot?.facturacion_total);
    const snapshotResult = num(snapshot?.ebit_operativo);
    const revenue = snapshotRevenue ?? row.facturacion;
    const fuenteFacturacion = snapshotRevenue != null
      ? snapshot?.is_native_closed ? 'cierre' : 'master'
      : 'mind';
    // Ventas − EBIT conserva la base de costos del resumen histórico.
    const snapshotCost = snapshotRevenue != null && snapshotResult != null
      ? snapshotRevenue - snapshotResult
      : snapshot?.costos_directos != null || snapshot?.costos_indirectos != null
        ? (num(snapshot.costos_directos) ?? 0) + (num(snapshot.costos_indirectos) ?? 0)
        : null;
    const cost = snapshotCost ?? costByPeriod.get(row.periodKey) ?? 0;
    const result = snapshotResult ?? revenue - cost;
    const month = Number(row.periodKey.slice(5));
    const monthName = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
    return { periodKey: row.periodKey, monthLabel: `${String(month).padStart(2, '0')} ${monthName}`, month,
      cierre: Boolean(snapshot?.is_closed), fuenteFacturacion, facturacion: revenue, costos: cost, resultado: result };
  });
  const series = (key: "facturacion" | "costos" | "resultado") => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const ejecutado = round(months.filter((row) => row.cierre).reduce((sum, row) => sum + row[key], 0));
    const proyectado = round(months.filter((row) => !row.cierre).reduce((sum, row) => sum + row[key], 0));
    return { ejecutado, proyectado, total: round(months.reduce((sum, month) => sum + month[key], 0)) };
  };
  return { year, facturacion: series("facturacion"), costos: series("costos"), resultado: series("resultado"), months, meses: months, mesesCerrados: months.filter((row) => row.cierre).length, mesesProyectados: months.filter((row) => !row.cierre).length };
}

const dashboardCache = new ReadCache<Awaited<ReturnType<typeof loadNativeExecutiveDashboard>>>(10_000, 24);
export function invalidateNativeDashboard() { dashboardCache.clear(); }
onAppEvent(event => { if (event.topic === "cache") invalidateNativeDashboard(); });
export function fetchNativeExecutiveDashboard(...args: Parameters<typeof loadNativeExecutiveDashboard>) {
  // The SQL data is independent of the selected period: share its work across filters.
  return dashboardCache.get("native", () => loadNativeExecutiveDashboard()).then(result =>
    ({ ...selectDashboardRows(result.data, ...args), sourceReadAt: result.sourceReadAt }));
}
