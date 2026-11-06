import { pool } from '../db';
import { loadFinancialProjection } from './financial-projection';
import { isBrokenNetProfit } from './direct-sheets-dashboard';
import { roundScenarioMoney, type FinancialScenario, type ScenarioCost } from '../../shared/financial-scenario';

export interface ScenarioCostRow {
  id: number;
  period_key: string;
  detalle: string | null;
  concepto?: string | null;
  descripcion?: string | null;
  vendor_name?: string | null;
  subtipo_costo: string | null;
  fecha?: string | null;
  amount_usd: number | string | null;
  cost_treatment?: string;
  source?: string;
  has_net_amount?: boolean;
}

function toCost(row: ScenarioCostRow, source: 'ledger'): ScenarioCost {
  const concept = row.detalle || row.vendor_name || 'Sin concepto';
  const category = row.subtipo_costo || 'Sin categoría';
  let amount = row.amount_usd == null ? null : Number(row.amount_usd);
  if (amount != null && !Number.isFinite(amount)) amount = null;
  // Native rollups treat unclassified liabilities as indirect costs; only an
  // explicit provision belongs below EBIT. Do not apply imported VAT/category rules.
  const fiscal = row.cost_treatment === 'provision';
  return {
    id: `${source}:${row.id}`, periodKey: row.period_key, concept,
    description: [...new Set([row.concepto, row.descripcion, row.vendor_name].filter(Boolean))].join(' · '),
    category, date: row.fecha ?? null, source,
    amountUsd: amount, impact: fiscal ? 'net' : 'operating',
  };
}

/** Only native periods use liabilities; Master periods have their own reconciled source. */
export function buildNativeScenarioCosts(
  months: Array<{ periodKey: string; fuenteFacturacion: string }>, ledger: ScenarioCostRow[],
): ScenarioCost[] {
  const periods = new Set(months.filter(month => month.fuenteFacturacion !== 'master').map(month => month.periodKey));
  return ledger.filter(row => periods.has(row.period_key) && row.cost_treatment !== 'balance_only')
    .map(row => toCost(row, 'ledger'));
}

export async function getFinancialScenario(year: number): Promise<FinancialScenario> {
  const [loaded, summaries, ledger] = await Promise.all([
    loadFinancialProjection(year),
    pool.query(`SELECT p.period_key,m.beneficio_neto,m.facturacion_total,m.margen_neto,f.provisions_usd
      FROM unnest($1::text[]) p(period_key)
      LEFT JOIN monthly_financial_summary m USING(period_key)
      LEFT JOIN fact_cost_month f USING(period_key)`,
    [Array.from({ length: 12 }, (_, month) => `${year}-${String(month + 1).padStart(2, '0')}`)]),
    pool.query(`SELECT id,period_key,detalle,concepto,descripcion,vendor_name,subtipo_costo,
        to_char(fecha_emision,'YYYY-MM-DD') fecha,source,cost_treatment,net_amount IS NOT NULL AS has_net_amount,
        CASE WHEN net_amount IS NOT NULL THEN
          CASE WHEN currency='USD' THEN net_amount WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) END
          ELSE COALESCE(monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0)) END AS amount_usd
      FROM pasivo_entries WHERE period_key LIKE $1 AND voided_at IS NULL AND cost_treatment <> 'balance_only'`, [`${year}-%`]),
  ]);
  const { projection, master, sourceReadAt } = loaded;
  const masterMonths = new Map(master?.months.map(month => [month.periodKey, month]));
  const netByPeriod = new Map(summaries.rows.map(row => [row.period_key, row]));
  const months = projection.meses.map(month => {
    const masterMonth = masterMonths.get(month.periodKey);
    if (masterMonth) return masterMonth;
    const summary = netByPeriod.get(month.periodKey);
    let net: number | null = null;
    if (month.fuenteFacturacion === 'cierre') {
      net = summary?.beneficio_neto == null ? null : Number(summary.beneficio_neto);
      if (month.costos !== 0 && isBrokenNetProfit(net, summary?.facturacion_total == null ? null : Number(summary.facturacion_total),
        summary?.margen_neto == null ? null : Number(summary.margen_neto))) net = null;
    } else if (summary?.provisions_usd != null) {
      net = month.resultado - Number(summary.provisions_usd);
    }
    return { periodKey: month.periodKey, monthLabel: month.monthLabel, revenueUsd: month.facturacion,
      costUsd: month.costos, ebitUsd: month.resultado, netProfitUsd: net != null && Number.isFinite(net) ? roundScenarioMoney(net) : null };
  });
  const nativeMonths = projection.meses.filter(month => month.fuenteFacturacion !== 'master');
  const costs = [...(master?.costs ?? []), ...buildNativeScenarioCosts(nativeMonths, ledger.rows)]
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey) || a.concept.localeCompare(b.concept) || a.id.localeCompare(b.id));
  return { year, months, costs, sourceReadAt, warnings: master?.warnings ?? [] };
}
