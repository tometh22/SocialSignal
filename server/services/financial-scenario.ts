import { pool } from '../db';
import { getNativeProjectionSummary } from './financial-native-dashboard';
import { isBrokenNetProfit } from './direct-sheets-dashboard';
import { normalizeScenarioText, roundScenarioMoney, type FinancialScenario, type ScenarioCost } from '../../shared/financial-scenario';

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

// Same distinction as the imported operating-cost ledger: fiscal items affect
// net profit, not EBIT. Keep the remaining taxes/provisions fixed in a scenario.
const netOnlyCategories = new Set([
  'impuestos arg', 'impuestos usa', 'intereses oxean', 'provision pasivo',
  'equipo bono', 'board bono', 'administracion finanzas bono', 'bonos total',
]);

function toCost(row: ScenarioCostRow, source: ScenarioCost['source']): ScenarioCost {
  const concept = row.detalle || row.vendor_name || 'Sin concepto';
  const category = row.subtipo_costo || 'Sin categoría';
  let amount = row.amount_usd == null ? null : Number(row.amount_usd);
  if (amount != null && !Number.isFinite(amount)) amount = null;
  // Imported Itecsa/Estudio Contable amounts include VAT; the operating ledger nets it out.
  if (amount != null && !row.has_net_amount && (source === 'estimate' || row.source === 'excel')
    && (normalizeScenarioText(concept).includes('itecsa') || normalizeScenarioText(category) === 'estudio contable')) {
    amount /= 1.21;
  }
  const explicitOperating = row.cost_treatment === 'direct' || row.cost_treatment === 'indirect';
  const fiscal = !explicitOperating && (row.cost_treatment === 'provision' || netOnlyCategories.has(normalizeScenarioText(category))
    || /\b(provision|impuesto|impuestos|iva ventas|iva compras|ajuste contable)\b/.test(normalizeScenarioText(`${concept} ${category}`)));
  return {
    id: `${source}:${row.id}`, periodKey: row.period_key, concept,
    description: [...new Set([row.concepto, row.descripcion, row.vendor_name].filter(Boolean))].join(' · '),
    category, date: row.fecha ?? null, source,
    amountUsd: amount == null ? null : roundScenarioMoney(amount), impact: fiscal ? 'net' : 'operating',
  };
}

/** Use posted detail instead of its estimated supplier/category total, never both. */
export function buildScenarioCosts(
  months: Array<{ periodKey: string; fuenteFacturacion: string }>,
  ledger: ScenarioCostRow[], estimates: ScenarioCostRow[],
): ScenarioCost[] {
  const sources = new Map(months.map(month => [month.periodKey, month.fuenteFacturacion]));
  const bucket = (row: ScenarioCostRow) => JSON.stringify([
    row.period_key, normalizeScenarioText(row.detalle || row.vendor_name || ''), normalizeScenarioText(row.subtipo_costo || ''),
  ]);
  const actual = ledger.filter(row => sources.has(row.period_key) && row.cost_treatment !== 'balance_only'
    && (sources.get(row.period_key) !== 'master' || row.source === 'excel'));
  const actualBuckets = new Set(actual.map(bucket));
  const planned = estimates.filter(row => sources.get(row.period_key) === 'master' && !actualBuckets.has(bucket(row)));
  return [...actual.map(row => toCost(row, 'ledger')), ...planned.map(row => toCost(row, 'estimate'))]
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey) || a.concept.localeCompare(b.concept) || a.id.localeCompare(b.id));
}

export async function getFinancialScenario(year: number): Promise<FinancialScenario> {
  const [projection, summaries, ledger, estimates] = await Promise.all([
    getNativeProjectionSummary(year),
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
    pool.query(`SELECT id,month_key period_key,detalle,subtipo_costo,puesto descripcion,monto_total_usd amount_usd
      FROM fact_estimated_cost_month WHERE month_key LIKE $1`, [`${year}-%`]),
  ]);
  const netByPeriod = new Map(summaries.rows.map(row => [row.period_key, row]));
  const months = projection.meses.map(month => {
    const summary = netByPeriod.get(month.periodKey);
    let net: number | null = null;
    if (month.fuenteFacturacion === 'master' || month.fuenteFacturacion === 'cierre') {
      net = summary?.beneficio_neto == null ? null : Number(summary.beneficio_neto);
      if (month.costos !== 0 && isBrokenNetProfit(net, summary?.facturacion_total == null ? null : Number(summary.facturacion_total),
        summary?.margen_neto == null ? null : Number(summary.margen_neto))) net = null;
    } else if (summary?.provisions_usd != null) {
      net = month.resultado - Number(summary.provisions_usd);
    }
    return { periodKey: month.periodKey, monthLabel: month.monthLabel, revenueUsd: month.facturacion,
      costUsd: month.costos, ebitUsd: month.resultado, netProfitUsd: net != null && Number.isFinite(net) ? roundScenarioMoney(net) : null };
  });
  return { year, months, costs: buildScenarioCosts(projection.meses, ledger.rows, estimates.rows) };
}
