import { pool } from "../db";
import { addMonths } from "../../shared/finance-native";

/**
 * A month that belongs to Mind (see finance-period-source), computed only from
 * records created in Mind. Mirrors the Máster's Resumen Ejecutivo formulas:
 *
 * - Ventas: confirmed sales of the billing month (estimates never count).
 * - EBIT: ventas − operating costs (direct + indirect), without IVA, IIBB,
 *   Impuestos USA or Intereses Oxean.
 * - Beneficio neto: EBIT − IIBB, Impuestos USA, Intereses Oxean − provision expense.
 * - Balances are as of the last day of the month: invoices minus the payments
 *   applied up to that day, never "outstanding today". Opening balances loaded
 *   for the switch (source 'opening') are part of them; Máster rows never are.
 * - Markup: billing / cost of the projects closed in the month (whole project).
 * - Proyección resultado: EBIT of this month plus the next two (actual when the
 *   month already has data, budget otherwise).
 * - Balance a 60 días: balance neto + sales of the next two months − their costs
 *   without Impuestos USA. Cashflow a 60 días: actual cash of the next two
 *   months once they are over, otherwise receivables minus payables due then.
 */
export type NativeMonth = {
  periodKey: string;
  fxRate: number | null;
  ventas: number;
  costosDirectos: number;
  costosIndirectos: number;
  costosDirectosOperativos: number;
  impuestosYIntereses: number;
  gastoProvisiones: number;
  ebit: number;
  beneficioNeto: number;
  markup: number | null;
  caja: number;
  cajaPorCuenta: Record<string, number>;
  inversiones: number;
  cuentasCobrar: number;
  cuentasPagar: number;
  impuestosUsaPorPagar: number;
  provisiones: number;
  activoTotal: number;
  pasivoTotal: number;
  balanceNeto: number;
  cashflowIngresos: number;
  cashflowEgresos: number;
  cashflowNeto: number;
  proyeccionResultado: number;
  balance60Dias: number;
  cashflow60Dias: number;
  warnings: string[];
};

type Runner = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };
const n = (value: unknown) => Number(value ?? 0) || 0;

/** Rows created in Mind (not imported from the Máster), alive. */
const NATIVE = `COALESCE(source,'') <> 'excel' AND voided_at IS NULL`;
/** Sales that already happened: estimates and budget rows are excluded everywhere. */
export const ACTUAL_SALES = `status <> 'cancelled' AND COALESCE(confirmed, true) AND NOT COALESCE(is_estimate, false) AND COALESCE(source_tab,'') <> 'mind_budget'`;
/** Taxes and interest are below EBIT (Máster: IIBB, Impuestos USA, Intereses Oxean). IVA is never a cost. */
export const TAX_SUBTYPE = `lower(translate(COALESCE(subtipo_costo,''),'ÁÉÍÓÚáéíóú','AEIOUaeiou'))`;
const LIQUID = `lower(translate(COALESCE(tipo_activo,''),'íÍ','iI'))`;
const pasivoUsd = `COALESCE(CASE WHEN currency='ARS' THEN gross_amount/NULLIF(cotizacion,0) ELSE gross_amount END, monto_total_usd, monto_usd, monto_ars/NULLIF(cotizacion,0), 0)`;
const pasivoNetUsd = `COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END, monto_total_usd, monto_usd, monto_ars/NULLIF(cotizacion,0), 0)`;
const activoUsd = `COALESCE(CASE WHEN currency='ARS' THEN gross_amount/NULLIF(cotizacion,0) ELSE gross_amount END, monto_total_usd, monto_usd, monto_ars/NULLIF(cotizacion,0), 0)`;

async function fxFor(runner: Runner, periodKey: string): Promise<number | null> {
  const [year, month] = periodKey.split("-").map(Number);
  const { rows } = await runner.query(`SELECT rate FROM exchange_rates WHERE year=$1 AND month=$2 AND is_active=true
    ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END, updated_at DESC, id DESC LIMIT 1`, [year, month]);
  return rows[0] ? Number(rows[0].rate) : null;
}

/** Sales, operating costs and below-EBIT items of one month. */
async function monthResult(runner: Runner, periodKey: string) {
  const { rows: [row] } = await runner.query(`SELECT
      (SELECT COALESCE(sum(amount_usd),0) FROM revenue_events WHERE invoice_period=$1 AND ${ACTUAL_SALES})::float8 ventas,
      (SELECT COALESCE(direct_usd,0) FROM fact_cost_month WHERE period_key=$1)::float8 directos,
      (SELECT COALESCE(indirect_usd,0) FROM fact_cost_month WHERE period_key=$1)::float8 indirectos,
      (SELECT COALESCE(provisions_usd,0) FROM fact_cost_month WHERE period_key=$1)::float8 provisiones,
      (SELECT count(*) FROM fact_cost_month WHERE period_key=$1)::int has_costs,
      (SELECT COALESCE(sum(cost_usd),0) FROM fact_labor_month WHERE period_key=$1)::float8 labor,
      (SELECT COALESCE(sum(${pasivoNetUsd}),0) FROM pasivo_entries WHERE period_key=$1 AND ${NATIVE}
         AND COALESCE(cost_treatment,'') NOT IN ('balance_only') AND (cost_treatment='tax' OR ${TAX_SUBTYPE} IN ('iibb','impuestos usa','intereses oxean')))::float8 tax_bills,
      (SELECT COALESCE(sum(amount_usd),0) FROM pl_adjustments WHERE period_key=$1 AND type IN ('impuesto','interes')
         AND lower(COALESCE(concept,'')) <> 'iva')::float8 tax_adjustments`, [periodKey]);
  const ventas = n(row.ventas), directos = n(row.directos), indirectos = n(row.indirectos);
  const ebit = ventas - directos - indirectos;
  const impuestos = n(row.tax_bills) + n(row.tax_adjustments);
  return { ventas, directos, indirectos, provisiones: n(row.provisiones), labor: n(row.labor), hasCosts: n(row.has_costs) > 0, ebit, impuestos };
}

/** Budget of a month that has no actual data yet: confirmed + estimated sales minus estimated costs. */
async function monthBudget(runner: Runner, periodKey: string, excludeUsaTax = false) {
  const { rows: [row] } = await runner.query(`SELECT
      (SELECT COALESCE(sum(amount_usd),0) FROM revenue_events WHERE invoice_period=$1 AND status <> 'cancelled')::float8 ventas,
      (SELECT COALESCE(sum(monto_total_usd),0) FROM fact_estimated_cost_month WHERE month_key=$1
         AND lower(translate(COALESCE(detalle,'')||' '||COALESCE(subtipo_costo,''),'ÁÉÍÓÚáéíóú','AEIOUaeiou')) !~ ${excludeUsaTax ? `'(^| )(iva|impuestos usa)( |$)'` : `'(^| )(iva|iibb|impuestos usa|intereses oxean)( |$)'`})::float8 costos`, [periodKey]);
  return { ventas: n(row.ventas), costos: n(row.costos) };
}

export async function computeNativeMonth(periodKey: string, options: { runner?: Runner; officialRate?: number; today?: Date } = {}): Promise<NativeMonth> {
  const runner = options.runner ?? pool;
  const warnings: string[] = [];
  const fxRate = options.officialRate ?? await fxFor(runner, periodKey);
  if (!fxRate) warnings.push(`Falta la cotización de ${periodKey}: los saldos en pesos no se pueden convertir.`);
  const endOfMonth = `${addMonths(periodKey, 1)}-01`;
  const result = await monthResult(runner, periodKey);

  // Cash per account as of the end of the month, in the account currency.
  const { rows: accounts } = await runner.query(`SELECT id, name, bank_name, currency, opening_balance::float8 opening, opening_balance_date FROM financial_accounts WHERE is_active=true`);
  const { rows: movements } = await runner.query(`SELECT account_id, lower(COALESCE(banco,'')) banco, tipo_movimiento, moneda, fecha,
      monto_ars::float8 ars, monto_usd::float8 usd, original_amount::float8 original
    FROM cashflow_transactions WHERE ${NATIVE} AND fecha < $1::date AND tipo_movimiento IN ('Ingreso','Egreso')`, [endOfMonth]);
  const cajaPorCuenta: Record<string, number> = {};
  const byLabel = new Map<string, any>();
  for (const account of accounts) for (const label of [account.name, account.bank_name]) if (label) byLabel.set(String(label).toLowerCase(), account);
  const balances = new Map<number, number>(accounts.map((account: any) => [account.id, (account.opening_balance_date == null || new Date(account.opening_balance_date) < new Date(endOfMonth)) ? n(account.opening) : 0]));
  let unassigned = 0;
  for (const movement of movements) {
    const account = movement.account_id ? accounts.find((candidate: any) => candidate.id === movement.account_id) : byLabel.get(movement.banco);
    const sign = movement.tipo_movimiento === "Egreso" ? -1 : 1;
    if (!account) { unassigned += sign * Math.abs(n(movement.usd) || (fxRate ? n(movement.ars) / fxRate : 0)); continue; }
    if (account.opening_balance_date && new Date(movement.fecha) < new Date(account.opening_balance_date)) continue;
    const inAccountCurrency = account.currency === "ARS" ? Math.abs(n(movement.ars) || n(movement.original) || n(movement.usd) * (fxRate ?? 0))
      : account.currency === "USD" ? Math.abs(n(movement.usd) || (fxRate ? n(movement.ars) / fxRate : 0))
      : Math.abs(n(movement.original) || n(movement.usd));
    balances.set(account.id, (balances.get(account.id) ?? 0) + sign * inAccountCurrency);
  }
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0;
    if (account.currency === "ARS") { if (fxRate) cajaPorCuenta[account.name] = balance / fxRate; }
    else if (account.currency === "USD") cajaPorCuenta[account.name] = balance;
    else {
      const eur = await eurRate(runner, periodKey);
      if (eur) cajaPorCuenta[account.name] = balance * eur;
      else warnings.push(`Falta la cotización ${account.currency}→USD de ${periodKey} para la cuenta ${account.name}.`);
    }
  }
  if (Math.abs(unassigned) > 0.005) {
    cajaPorCuenta["Movimientos sin cuenta"] = unassigned;
    warnings.push("Hay movimientos de caja sin cuenta asignada; se suman aparte.");
  }
  const caja = Object.values(cajaPorCuenta).reduce((sum, value) => sum + value, 0);

  const { rows: [balance] } = await runner.query(`SELECT
      (SELECT COALESCE(sum(${activoUsd} - COALESCE((SELECT sum(a.amount_usd) FROM financial_document_applications a WHERE a.activo_entry_id=e.id AND a.voided_at IS NULL AND a.applied_at < $2::date),0)),0)
         FROM activo_entries e WHERE e.period_key <= $1 AND ${NATIVE.replace(/source/g, "e.source").replace("voided_at", "e.voided_at")}
           AND ${LIQUID.replace("tipo_activo", "e.tipo_activo")} NOT IN ('activo liquido','mediano plazo'))::float8 cobrar,
      (SELECT COALESCE(sum(${pasivoUsd} - COALESCE((SELECT sum(a.amount_usd) FROM financial_document_applications a WHERE a.pasivo_entry_id=e.id AND a.voided_at IS NULL AND a.applied_at < $2::date),0)) FILTER (WHERE ${TAX_SUBTYPE} <> 'impuestos usa'),0)
         FROM pasivo_entries e WHERE e.period_key <= $1 AND ${NATIVE.replace(/source/g, "e.source").replace("voided_at", "e.voided_at")})::float8 pagar,
      (SELECT COALESCE(sum(${pasivoUsd} - COALESCE((SELECT sum(a.amount_usd) FROM financial_document_applications a WHERE a.pasivo_entry_id=e.id AND a.voided_at IS NULL AND a.applied_at < $2::date),0)) FILTER (WHERE ${TAX_SUBTYPE} = 'impuestos usa'),0)
         FROM pasivo_entries e WHERE e.period_key <= $1 AND ${NATIVE.replace(/source/g, "e.source").replace("voided_at", "e.voided_at")})::float8 usa,
      (SELECT COALESCE(sum(CASE WHEN m.currency='ARS' THEN m.amount/NULLIF($3::numeric,0) ELSE m.amount END),0)
         FROM provision_movements m JOIN provision_entries p ON p.id=m.provision_id
        WHERE m.period_key <= $1 AND p.status IN ('APPROVED','ACTIVE','RELEASED'))::float8
      + (SELECT COALESCE(sum(CASE WHEN p.currency='ARS' THEN COALESCE(p.monto_provision,0)/NULLIF($3::numeric,0) ELSE COALESCE(p.monto_provision,0) END * CASE WHEN p.tipo='RECUPERO' THEN -1 ELSE 1 END),0)
         FROM provision_entries p WHERE p.period_key <= $1 AND p.status IN ('APPROVED','ACTIVE','RELEASED')
           AND NOT EXISTS (SELECT 1 FROM provision_movements m WHERE m.provision_id=p.id))::float8 provisiones,
      (SELECT COALESCE(sum(v.usd),0) FROM (
         SELECT DISTINCT ON (lower(COALESCE(concepto,''))) ${activoUsd} usd FROM activo_entries
          WHERE period_key <= $1 AND ${NATIVE} AND ${LIQUID} = 'mediano plazo'
          ORDER BY lower(COALESCE(concepto,'')), period_key DESC, id DESC) v)::float8 inversiones,
      (SELECT COALESCE(sum(CASE WHEN tipo_movimiento='Ingreso' THEN abs(COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0), 0)) ELSE 0 END),0)
         FROM cashflow_transactions WHERE period_key=$1 AND ${NATIVE} AND transfer_group_id IS NULL)::float8 ingresos,
      (SELECT COALESCE(sum(CASE WHEN tipo_movimiento='Egreso' THEN abs(COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0), 0)) ELSE 0 END),0)
         FROM cashflow_transactions WHERE period_key=$1 AND ${NATIVE} AND transfer_group_id IS NULL)::float8 egresos`, [periodKey, endOfMonth, fxRate ?? 0]);
  const cuentasCobrar = n(balance.cobrar), cuentasPagar = n(balance.pagar), impuestosUsaPorPagar = n(balance.usa);
  const provisiones = n(balance.provisiones), inversiones = n(balance.inversiones);
  const activoTotal = caja + inversiones + cuentasCobrar;
  const pasivoTotal = cuentasPagar + impuestosUsaPorPagar + provisiones;
  const balanceNeto = activoTotal - pasivoTotal;

  // Markup: projects closed in the month, whole-project billing over cost.
  const { rows: [markup] } = await runner.query(`SELECT COALESCE(sum(r.revenue_usd),0)::float8 revenue, COALESCE(sum(r.cost_usd),0)::float8 cost
    FROM fact_rc_month r JOIN active_projects p ON p.id=r.project_id
    WHERE to_char(COALESCE(p.closed_at, p.completed_date, p.actual_end_date), 'YYYY-MM') = $1 AND r.period_key <= $1`, [periodKey]);

  // Next two months: actual when they already have data, budget otherwise.
  const today = options.today ?? new Date();
  const nextMonths = [addMonths(periodKey, 1), addMonths(periodKey, 2)];
  let proyeccion = result.ebit, ventasProximas = 0, costosProximos = 0;
  for (const next of nextMonths) {
    const actual = await monthResult(runner, next);
    const budget = await monthBudget(runner, next, true);
    const closed = new Date(`${addMonths(next, 1)}-01T00:00:00Z`) <= today && actual.hasCosts;
    if (closed) { proyeccion += actual.ebit; ventasProximas += actual.ventas; costosProximos += actual.directos + actual.indirectos; }
    else {
      const ebitBudget = await monthBudget(runner, next, false);
      proyeccion += ebitBudget.ventas - ebitBudget.costos;
      ventasProximas += budget.ventas; costosProximos += budget.costos;
    }
  }
  const windowStart = `${nextMonths[0]}-01`, windowEnd = `${addMonths(periodKey, 3)}-01`;
  const windowOver = new Date(`${windowEnd}T00:00:00Z`) <= today;
  let cashflow60Dias: number;
  if (windowOver) {
    const { rows: [cash] } = await runner.query(`SELECT COALESCE(sum(CASE WHEN tipo_movimiento='Ingreso' THEN 1 ELSE -1 END * abs(COALESCE(monto_usd, monto_ars/NULLIF(cotizacion,0), 0))),0)::float8 net
      FROM cashflow_transactions WHERE ${NATIVE} AND transfer_group_id IS NULL AND tipo_movimiento IN ('Ingreso','Egreso') AND fecha >= $1::date AND fecha < $2::date`, [windowStart, windowEnd]);
    cashflow60Dias = n(cash.net);
  } else {
    const { rows: [due] } = await runner.query(`SELECT
        (SELECT COALESCE(sum(${activoUsd}),0) FROM activo_entries WHERE ${NATIVE} AND ${LIQUID} NOT IN ('activo liquido','mediano plazo') AND fecha_vencimiento >= $1::date AND fecha_vencimiento < $2::date)::float8 cobrar,
        (SELECT COALESCE(sum(${pasivoUsd}),0) FROM pasivo_entries WHERE ${NATIVE} AND fecha_vencimiento >= $1::date AND fecha_vencimiento < $2::date)::float8 pagar`, [windowStart, windowEnd]);
    cashflow60Dias = n(due.cobrar) - n(due.pagar);
  }

  const cashflowIngresos = n(balance.ingresos), cashflowEgresos = n(balance.egresos);
  return {
    periodKey, fxRate,
    ventas: result.ventas, costosDirectos: result.directos, costosIndirectos: result.indirectos, costosDirectosOperativos: result.labor,
    impuestosYIntereses: result.impuestos, gastoProvisiones: result.provisiones,
    ebit: result.ebit, beneficioNeto: result.ebit - result.impuestos - result.provisiones,
    markup: n(markup.cost) > 0 ? n(markup.revenue) / n(markup.cost) : null,
    caja, cajaPorCuenta, inversiones, cuentasCobrar, cuentasPagar, impuestosUsaPorPagar, provisiones,
    activoTotal, pasivoTotal, balanceNeto,
    cashflowIngresos, cashflowEgresos, cashflowNeto: cashflowIngresos - cashflowEgresos,
    proyeccionResultado: proyeccion, balance60Dias: balanceNeto + ventasProximas - costosProximos, cashflow60Dias,
    warnings,
  };
}

/** USD per EUR for a month, loaded as an exchange rate with rate_type 'eur_usd'. */
async function eurRate(runner: Runner, periodKey: string): Promise<number | null> {
  const [year, month] = periodKey.split("-").map(Number);
  const { rows } = await runner.query(`SELECT rate FROM exchange_rates WHERE year=$1 AND month=$2 AND is_active=true AND rate_type='eur_usd' ORDER BY updated_at DESC LIMIT 1`, [year, month]);
  return rows[0] ? Number(rows[0].rate) : null;
}
