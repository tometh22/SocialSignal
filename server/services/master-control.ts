import { pool } from "../db";
import { controlCheck, type MasterControlReport } from "../../shared/master-control";
import { masterDetailTotals } from "../domain/master-control-totals";
import { ReadCache } from "../utils/read-cache";
import { createSheetsClient } from "./direct-sheets-dashboard";
import { getMasterScenarioSnapshot } from "./financial-master-scenario";
import { buildMasterDashboard } from "./financial-master-dashboard";
import { getPeriodSource } from "./finance-period-source";
import { getMonthlyReconciliation } from "./monthly-reconciliation";

const SPREADSHEET_ID = "1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc";
type Rows = unknown[][];
export { masterDetailTotals };
const tabsCache = new ReadCache<{ activo: Rows; pasivo: Rows; cash: Rows }>(60_000, 1);
const readTabs = () => tabsCache.get("tabs", async () => {
  const response = await createSheetsClient().spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID, ranges: ["'Activo'!A:Q", "'Pasivo'!A:O", "'CashFlow'!A:Q"], valueRenderOption: "UNFORMATTED_VALUE",
  }, { timeout: 30_000 });
  const [activo, pasivo, cash] = (response.data.valueRanges ?? []).map(range => (range.values ?? []) as Rows);
  return { activo: activo ?? [], pasivo: pasivo ?? [], cash: cash ?? [] };
});

const USD = `COALESCE(monto_total_usd::float8, monto_usd::float8, monto_ars::float8/NULLIF(cotizacion::float8,0), 0)`;
const PENDING = (flag: string) => `COALESCE(CASE WHEN currency='ARS' THEN outstanding_amount::float8/NULLIF(cotizacion::float8,0) ELSE outstanding_amount::float8 END, CASE WHEN ${flag} THEN 0 ELSE ${USD} END)`;
const LIQUID = `lower(translate(COALESCE(tipo_activo,''),'íÍ','iI'))`;

/**
 * Compares, for a month reported by the Máster, what Mind shows on each Finance
 * page with the Máster detail ("sync" checks), and the Máster summary with its own
 * detail ("master" checks). Months that belong to Mind return no checks.
 */
export async function getMasterControl(period: string): Promise<MasterControlReport> {
  const checkedAt = new Date().toISOString();
  const source = await getPeriodSource(period);
  if (source === "mind") return { period, source, checkedAt, checks: [], pending: [] };
  const [snapshot, tabs, reconciliation] = await Promise.all([getMasterScenarioSnapshot(), readTabs(), getMonthlyReconciliation(period).catch(() => null)]);
  const resumen = buildMasterDashboard(snapshot, [period])[0];
  const detail = masterDetailTotals(tabs, period);
  const { rows: [mind] } = await pool.query(`SELECT
      (SELECT COALESCE(sum(${USD}),0) FROM activo_entries WHERE period_key=$1 AND voided_at IS NULL AND source='excel' AND ${LIQUID} NOT IN ('activo liquido','mediano plazo'))::float8 receivables,
      (SELECT COALESCE(sum(${PENDING("cobrado_al_cierre")}),0) FROM activo_entries WHERE period_key=$1 AND voided_at IS NULL AND source='excel' AND ${LIQUID} NOT IN ('activo liquido','mediano plazo'))::float8 receivables_pending,
      (SELECT COALESCE(sum(${USD}),0) FROM activo_entries WHERE period_key=$1 AND voided_at IS NULL AND source='excel' AND ${LIQUID}='activo liquido')::float8 bank,
      (SELECT COALESCE(sum(${USD}),0) FROM pasivo_entries WHERE period_key=$1 AND voided_at IS NULL AND source='excel')::float8 payables,
      (SELECT COALESCE(sum(${PENDING("pagado_al_cierre")}),0) FROM pasivo_entries WHERE period_key=$1 AND voided_at IS NULL AND source='excel')::float8 payables_pending,
      (SELECT COALESCE(sum(CASE WHEN tipo_movimiento='Ingreso' THEN monto_usd::float8 ELSE 0 END),0) FROM cashflow_transactions WHERE period_key=$1 AND voided_at IS NULL AND source='excel')::float8 cash_in,
      (SELECT COALESCE(sum(CASE WHEN tipo_movimiento='Egreso' THEN monto_usd::float8 ELSE 0 END),0) FROM cashflow_transactions WHERE period_key=$1 AND voided_at IS NULL AND source='excel')::float8 cash_out,
      (SELECT COALESCE(sum(remaining_amount::float8),0) FROM provision_entries WHERE period_key=$1 AND import_batch IS NOT NULL)::float8 provisions`, [period]);
  const resync = "Mind se actualiza solo cada 30 minutos. Si sigue distinto después de esa espera, avisá: puede haber un cambio de formato en la planilla.";
  const checks = [
    controlCheck({ id: "receivables", kind: "sync", label: "Facturas por cobrar", hint: resync, expectedLabel: "Pestaña Activo", expectedUsd: detail.receivables, actualLabel: "Por cobrar en Mind", actualUsd: mind.receivables }),
    controlCheck({ id: "receivables-pending", kind: "sync", label: "Facturas sin cobrar", hint: resync, expectedLabel: "Pestaña Activo", expectedUsd: detail.receivablesPending, actualLabel: "Pendiente en Mind", actualUsd: mind.receivables_pending }),
    controlCheck({ id: "payables", kind: "sync", label: "Cuentas por pagar", hint: resync, expectedLabel: "Pestaña Pasivo", expectedUsd: detail.payables, actualLabel: "Por pagar en Mind", actualUsd: mind.payables }),
    controlCheck({ id: "payables-pending", kind: "sync", label: "Cuentas sin pagar", hint: resync, expectedLabel: "Pestaña Pasivo", expectedUsd: detail.payablesPending, actualLabel: "Pendiente en Mind", actualUsd: mind.payables_pending }),
    controlCheck({ id: "bank", kind: "sync", label: "Saldo en bancos", hint: resync, expectedLabel: "Resumen: activo líquido", expectedUsd: resumen?.activoLiquido ?? null, actualLabel: "Caja en Mind", actualUsd: mind.bank }),
    controlCheck({ id: "cash-in", kind: "sync", label: "Ingresos de caja", hint: resync, expectedLabel: "Pestaña CashFlow", expectedUsd: detail.cashIn, actualLabel: "Caja en Mind", actualUsd: mind.cash_in }),
    controlCheck({ id: "cash-out", kind: "sync", label: "Egresos de caja", hint: resync, expectedLabel: "Pestaña CashFlow", expectedUsd: detail.cashOut, actualLabel: "Caja en Mind", actualUsd: mind.cash_out }),
    controlCheck({ id: "provisions", kind: "sync", label: "Provisiones", hint: "Si difiere, revisá en la pestaña Provisión pasivo que la suma del mes coincida con el Resumen Ejecutivo.", expectedLabel: "Resumen: provisión", expectedUsd: resumen?.pasivoFacturacionAdelantada ?? null, actualLabel: "Provisiones en Mind", actualUsd: mind.provisions }),
    controlCheck({ id: "master-receivables", kind: "master", label: "Clientes a cobrar del Resumen", hint: "En el Resumen Ejecutivo el importe está escrito a mano. Debería ser igual a la suma de las facturas sin cobrar del mes en la pestaña Activo.", expectedLabel: "Facturas sin cobrar (Activo)", expectedUsd: detail.receivablesPending, actualLabel: "Resumen Ejecutivo", actualUsd: resumen?.clientesACobrar ?? null }),
    controlCheck({ id: "master-payables", kind: "master", label: "Proveedores a pagar del Resumen", hint: "En el Resumen Ejecutivo el importe está escrito a mano. Debería ser igual a lo que falta pagar en la pestaña Pasivo, sin impuestos de Estados Unidos ni provisiones (que el Resumen muestra aparte).", expectedLabel: "Sin pagar (Pasivo)", expectedUsd: detail.payablesPendingOperating, actualLabel: "Resumen Ejecutivo", actualUsd: resumen?.pasivoProveedores ?? null }),
    controlCheck({ id: "master-cashflow", kind: "master", label: "Cashflow del Resumen", hint: "El Resumen Ejecutivo debería ser ingresos menos egresos de la pestaña CashFlow del mes.", expectedLabel: "Pestaña CashFlow", expectedUsd: detail.cashIn - detail.cashOut, actualLabel: "Resumen Ejecutivo", actualUsd: resumen?.cashflow ?? null }),
  ];
  if (reconciliation) checks.push(controlCheck({ id: "sales", kind: "master", label: "Ventas del detalle", hint: "Las ventas por proyecto deberían sumar lo mismo que el Resumen Ejecutivo.", expectedLabel: "Resumen Ejecutivo", expectedUsd: reconciliation.totals.summarySalesUsd, actualLabel: "Proyectos del mes", actualUsd: reconciliation.totals.salesUsd }));
  // Informational notes (rows that are not expenses) are not pending work.
  return { period, source, checkedAt, checks, pending: (reconciliation?.warnings ?? []).filter(warning => !/no representan gastos/.test(warning)) };
}
