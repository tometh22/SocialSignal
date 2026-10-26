import { pool } from "../db";
import { FINANCIAL_PERIOD, getFinancialCutover } from "./financial-source-policy";

/** Read-only comparison. Imported totals are evidence, never written back to Mind. */
export async function financialTransitionReport(period: string) {
  if (!FINANCIAL_PERIOD.test(period)) throw Object.assign(new Error("Usá YYYY-MM."),{statusCode:400});
  const cutover=await getFinancialCutover();
  const {rows}=await pool.query(`
    SELECT
      (SELECT count(*)::int FROM financial_accounts WHERE is_active AND opening_balance_date IS NOT NULL) accounts,
      (SELECT count(*)::int FROM financial_close_periods WHERE status='CLOSED' AND period_key >= $2) closed_months,
      (SELECT count(*)::int FROM revenue_events WHERE status<>'cancelled' AND invoice_period=$1) revenue_documents,
      (SELECT count(*)::int FROM activo_entries WHERE voided_at IS NULL AND source<>'excel' AND period_key=$1) receivable_documents,
      (SELECT count(*)::int FROM pasivo_entries WHERE voided_at IS NULL AND source<>'excel' AND period_key=$1) payable_documents,
      (SELECT count(*)::int FROM cashflow_transactions WHERE voided_at IS NULL AND source<>'excel' AND period_key=$1) cash_documents,
      (SELECT count(*)::int FROM cashflow_transactions WHERE voided_at IS NULL AND source<>'excel' AND period_key=$1 AND reconciliation_status='unmatched') unmatched_cash,
      (SELECT count(*)::int FROM financial_cost_forecast_month WHERE month_key=$1 AND source='mind') budget_lines,
      (SELECT count(*)::int FROM financial_cost_forecast_month WHERE month_key=$1 AND missing_fx) budget_missing_fx,
      (SELECT count(*)::int FROM exchange_rates WHERE year=left($1,4)::int AND month=right($1,2)::int AND is_active AND rate_type<>'estimated' AND rate>0) observed_fx,
      (SELECT sum(amount_usd)::float FROM revenue_events WHERE status<>'cancelled' AND invoice_period=$1) native_revenue,
      (SELECT sum(revenue_usd)::float FROM income_sot WHERE month_key=$1) legacy_revenue,
      (SELECT (direct_usd+indirect_usd)::float FROM financial_native_cost_month WHERE period_key=$1) native_costs,
      (SELECT sum(monto_total_usd)::float FROM fact_estimated_cost_month WHERE month_key=$1) legacy_budget,
      (SELECT sum(monto_total_usd)::float FROM financial_cost_forecast_month WHERE month_key=$1 AND source='mind') native_budget,
      (SELECT facturacion_total::float FROM monthly_financial_summary WHERE period_key=$1) legacy_summary_revenue,
      (SELECT caja_total::float FROM monthly_financial_summary WHERE period_key=$1) legacy_summary_cash
  `,[period,cutover]);
  const stats=rows[0];
  const checks=[
    {code:"cutover",label:"Fecha de corte configurada",passed:Boolean(cutover),detail:cutover ?? "Pendiente"},
    {code:"accounts",label:"Cuentas y saldos iniciales",passed:stats.accounts>0,detail:`${stats.accounts} cuentas con fecha de saldo inicial. Comparar cada saldo con su extracto.`},
    {code:"revenue",label:"Ingresos cargados en Mind",passed:stats.revenue_documents>0,detail:`${stats.revenue_documents} registros en ${period}. Verificar integridad contra contratos y facturas.`},
    {code:"fx",label:"Cotización observada del mes",passed:stats.observed_fx>0,detail:`${stats.observed_fx} cotizaciones disponibles.`},
    {code:"budget",label:"Presupuesto nativo del mes",passed:stats.budget_lines>0 && stats.budget_missing_fx===0,detail:`${stats.budget_lines} líneas; ${stats.budget_missing_fx} sin cotización.`},
    {code:"cash",label:"Movimientos cargados y conciliados",passed:stats.cash_documents>0 && stats.unmatched_cash===0,detail:`${stats.cash_documents} movimientos; ${stats.unmatched_cash} pendientes de conciliación.`},
    {code:"parallel_closes",label:"Dos cierres de validación",passed:stats.closed_months>=2,detail:`${stats.closed_months} meses cerrados desde el corte. El cierre registrado no reemplaza la aprobación de sus diferencias.`},
  ];
  return {period,cutover,checkedAt:new Date().toISOString(),checks,stats,
    automatedChecksPassed:checks.every(check=>check.passed), requiresFunctionalApproval:true,
    reviewRequired:"Finanzas debe validar documentos, saldos por cuenta, impuestos y diferencias de dos cierres; conservar evidencia de backup y restauración antes de retirar el maestro.",
    comparisonNote:"Los valores importados son una referencia conservada, no un cierre aprobado. Presupuesto y costo real tienen distinta base; una diferencia no se corrige copiando el total."};
}
