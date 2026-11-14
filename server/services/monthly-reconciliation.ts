import type { MonthlyReconciliationReport, MonthlyProjectRow } from '../../shared/monthly-reconciliation';
import { buildMasterMonthlyReconciliation, roundMoney } from '../domain/master-monthly-reconciliation';
import { getMasterScenarioSnapshot } from './financial-master-scenario';

const pool = { query: async (query: string, values?: unknown[]) => (await import('../db')).pool.query(query, values) };

/** Exactly the Dashboard/Projection source boundary, not the operational hours cutoff. */
export async function getMonthlyReconciliation(periodKey: string): Promise<MonthlyReconciliationReport> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) throw new Error('Período inválido');
  const { rows: [source] } = await pool.query(`
    SELECT c.status,
      EXISTS(SELECT 1 FROM revenue_events r WHERE r.invoice_period=$1 AND r.source_tab='mind_intake') AS native
    FROM (SELECT $1::text period_key) p LEFT JOIN financial_close_periods c USING(period_key)`, [periodKey]);
  if (source?.status == null && !source?.native) {
    return buildMasterMonthlyReconciliation(await getMasterScenarioSnapshot(), periodKey);
  }
  const [year, month] = periodKey.split('-').map(Number);
  const { fetchNativeExecutiveDashboard } = await import('./financial-native-dashboard');
  const dashboard = await fetchNativeExecutiveDashboard(year, month);
  const summary = dashboard.filtered;
  if (!summary) throw new Error('No hay resumen financiero para conciliar el período');
  const { rows: data } = await pool.query(`
    WITH entries AS (
      SELECT project_id,client_name,project_name,amount_usd::numeric revenue,0::numeric cost,
             'Ingreso #'||id::text ref
      FROM revenue_events WHERE invoice_period=$1 AND status<>'cancelled'
      UNION ALL
      SELECT project_id,NULL,NULL,0,COALESCE(cost_usd,0),'Costo del equipo #'||id::text
      FROM fact_labor_month WHERE period_key=$1
      UNION ALL
      SELECT project_id,NULL,NULL,0,
        COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END,
          monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0),0),'Costo externo #'||id::text
      FROM pasivo_entries WHERE period_key=$1 AND voided_at IS NULL AND cost_treatment='direct'
    ), named AS (
      SELECT CASE WHEN e.project_id IS NOT NULL THEN 'project:'||e.project_id::text
        ELSE 'unassigned:'||COALESCE(e.client_name,'')||':'||COALESCE(e.project_name,'') END key,
        COALESCE(c.name,e.client_name,'Sin asignación') client_name,
        COALESCE(ap.name,q.project_name,e.project_name,'Sin asignación') project_name,
        q.quotation_type project_type,e.revenue,e.cost,e.ref
      FROM entries e LEFT JOIN active_projects ap ON ap.id=e.project_id
      LEFT JOIN clients c ON c.id=ap.client_id LEFT JOIN quotations q ON q.id=ap.quotation_id
    )
    SELECT key,client_name,project_name,project_type,sum(revenue)::float revenue,sum(cost)::float cost,array_agg(ref) refs
    FROM named GROUP BY key,client_name,project_name,project_type ORDER BY sum(revenue) DESC`, [periodKey]);
  const rows: MonthlyProjectRow[] = data.map(row => ({ key: row.key, clientName: row.client_name,
    projectName: row.project_name, projectType: row.project_type, revenueUsd: Number(row.revenue),
    directCostUsd: Number(row.cost), sourceRefs: row.refs }));
  const sales = roundMoney(rows.reduce((sum, row) => sum + row.revenueUsd, 0));
  const direct = roundMoney(rows.reduce((sum, row) => sum + row.directCostUsd!, 0));
  const { rows: [cost] } = await pool.query('SELECT direct_usd,indirect_usd FROM fact_cost_month WHERE period_key=$1', [periodKey]);
  const overhead = cost?.indirect_usd == null ? null : Number(cost.indirect_usd);
  const operating = overhead == null ? null : roundMoney(direct + overhead);
  const expectedCost = summary.ventasDelMes != null && summary.ebitOperativo != null
    ? roundMoney(summary.ventasDelMes - summary.ebitOperativo) : null;
  const salesDifference = summary.ventasDelMes == null ? null : roundMoney(sales - summary.ventasDelMes);
  const costsDifference = operating == null || expectedCost == null ? null : roundMoney(operating - expectedCost);
  return { periodKey, source: source?.status === 'CLOSED' ? 'cierre' : 'mind', readAt: new Date().toISOString(),
    costBasis: cost ? 'actual' : 'unavailable', rows, followup: [], missingFollowup: [],
    totals: { salesUsd: sales, directCostUsd: direct, operatingCostUsd: operating, overheadUsd: overhead,
      ebitUsd: operating == null ? null : roundMoney(sales - operating), summarySalesUsd: summary.ventasDelMes,
      summaryOperatingCostUsd: expectedCost, salesDifferenceUsd: salesDifference, costsDifferenceUsd: costsDifference },
    status: salesDifference == null || costsDifference == null ? 'unavailable'
      : Math.abs(salesDifference) <= 0.02 && Math.abs(costsDifference) <= 0.02 ? 'matched' : 'difference',
    warnings: rows.some(row => row.clientName === 'Sin asignación' || row.projectName === 'Sin asignación')
      ? ['Hay movimientos sin asignación a proyecto. Están incluidos en los totales.'] : [] };
}

export async function getReconciliationPeriods() {
  const { rows } = await pool.query(`SELECT period_key FROM monthly_financial_summary
    UNION SELECT invoice_period FROM revenue_events WHERE status<>'cancelled'
    UNION SELECT period_key FROM financial_close_periods ORDER BY 1 DESC`);
  return rows.map(row => row.period_key as string);
}

export function defaultReconciliationPeriod(periods: string[], now = new Date()) {
  const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
  return [...periods].sort().reverse().find(period => period < current) ?? [...periods].sort().reverse().find(period => period <= current) ?? periods[0];
}

/** Recurrence uses the same monthly sales, never cumulative project budgets. */
export async function getMonthlyRecurringRevenue(periodKey: string) {
  const report = await getMonthlyReconciliation(periodKey);
  const feeRows = report.rows.filter(row => ['fee', 'recurring', 'always-on', 'always on', 'monitoring'].includes(String(row.projectType ?? '').toLowerCase()));
  const clients = new Map<string, number>();
  for (const row of feeRows) clients.set(row.clientName, (clients.get(row.clientName) ?? 0) + row.revenueUsd);
  const mrr = roundMoney(feeRows.reduce((sum, row) => sum + row.revenueUsd, 0));
  const porCliente = [...clients].map(([clientName, value]) => ({ clientName, mrr: roundMoney(value), arr: roundMoney(value * 12), sharePct: mrr > 0 ? roundMoney(value / mrr * 100) : 0 })).sort((a,b) => b.mrr-a.mrr);
  const periods = (await getReconciliationPeriods()).filter(period => period <= periodKey).slice(0, 12).reverse();
  const previous = await Promise.all(periods.map(period => period === periodKey ? report : getMonthlyReconciliation(period)));
  const serie = previous.map(month => {
    const monthly = roundMoney(month.rows.filter(row => ['fee', 'recurring', 'always-on', 'always on', 'monitoring'].includes(String(row.projectType ?? '').toLowerCase()))
      .reduce((sum, row) => sum + row.revenueUsd, 0));
    return { periodKey: month.periodKey, mrr: monthly, arr: roundMoney(monthly * 12) };
  });
  return { periodKey, mrr, arr: roundMoney(mrr * 12), revenueTotal: report.totals.salesUsd,
    feeSharePct: report.totals.salesUsd > 0 ? roundMoney(mrr / report.totals.salesUsd * 100) : 0,
    clientesFee: clients.size, porCliente, hhi: mrr > 0 ? roundMoney(porCliente.reduce((sum, row) => sum + (row.mrr / mrr) ** 2, 0)) : 0,
    serie, source: report.source, reconciliationStatus: report.status, costBasis: report.costBasis };
}
