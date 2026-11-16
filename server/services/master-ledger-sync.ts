import { and, eq, isNotNull, sql } from "drizzle-orm";
import { cashflowTransactions, provisionEntries } from "@shared/schema";
import { db } from "../db";
import { parseCashflowSnapshot, parseProvisionMatrix, type CashflowSnapshotRow } from "../domain/ledger-snapshot";
import { createSheetsClient } from "./direct-sheets-dashboard";
import { getMasterScenarioSnapshot } from "./financial-master-scenario";
import { buildMasterDashboard } from "./financial-master-dashboard";
import { getMasterSourcedPeriods } from "./finance-period-source";
import { googleSheetsWorkingService } from "./googleSheetsWorking";

const SPREADSHEET_ID = "1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc";

export type MasterLedgerSyncReport = {
  periods: string[];
  results: Record<string, { activo: string; pasivo: string; cashflow: string; provisions: string }>;
  warnings: string[];
};

const money2 = (value: unknown) => value == null || value === "" ? "" : Number(value).toFixed(2);
const day = (value: unknown) => value ? new Date(value as any).toISOString().slice(0, 10) : "";

/**
 * Keeps Mind's ledgers equal to the Master for every month the Master still reports
 * (see finance-period-source). Reads each tab once, compares per month and only
 * rewrites months whose Master content changed. Rows created in Mind are never
 * touched; months that already belong to Mind are never imported.
 */
export async function syncMasterLedger(options: { periods?: string[]; from?: string; to?: string } = {}): Promise<MasterLedgerSyncReport> {
  const masterPeriods = await getMasterSourcedPeriods();
  const requested = options.periods ?? masterPeriods.filter(period => (!options.from || period >= options.from) && (!options.to || period <= options.to));
  const periods = requested.filter(period => masterPeriods.includes(period));
  const warnings = requested.filter(period => !masterPeriods.includes(period)).map(period => `${period}: el mes ya se informa desde Mind; no se importa del Máster.`);
  const report: MasterLedgerSyncReport = { periods, results: {}, warnings };
  if (!periods.length) return report;

  const sheets = createSheetsClient();
  const [formatted, unformatted, snapshot] = await Promise.all([
    sheets.spreadsheets.values.batchGet({ spreadsheetId: SPREADSHEET_ID, ranges: ["Activo!A:Z", "Pasivo!A:Z"] }, { timeout: 30_000 }),
    sheets.spreadsheets.values.batchGet({ spreadsheetId: SPREADSHEET_ID, ranges: ["'CashFlow'!A:Q", "'Provisión pasivo'!A:Z"], valueRenderOption: "UNFORMATTED_VALUE" }, { timeout: 30_000 }),
    getMasterScenarioSnapshot(),
  ]);
  const [activoValues, pasivoValues] = (formatted.data.valueRanges ?? []).map(range => (range.values ?? []) as unknown[][]);
  const [cashValues, provisionValues] = (unformatted.data.valueRanges ?? []).map(range => (range.values ?? []) as unknown[][]);

  const resumen = buildMasterDashboard(snapshot, periods);
  const provisionBalances = new Map(resumen.map(month => [month.periodKey, month.pasivoFacturacionAdelantada ?? null]));
  const years = [...new Set(periods.map(period => Number(period.slice(0, 4))))];
  const provisionMatrix = provisionValues?.length
    ? parseProvisionMatrix(provisionValues, provisionBalances, { candidateYears: [Math.min(...years) - 2, Math.min(...years) - 1, ...years] })
    : { ok: false as const, reason: "La pestaña Provisión pasivo está vacía" };
  if (!provisionMatrix.ok) warnings.push(`Provisiones: ${provisionMatrix.reason}`);
  else for (const row of provisionMatrix.mismatched) if (periods.includes(row.periodKey)) {
    warnings.push(`${row.periodKey}: la matriz de Provisión pasivo suma USD ${row.matrixUsd.toFixed(2)} y el Resumen informa USD ${row.resumenUsd.toFixed(2)}; no se importa.`);
  }

  for (const period of periods) {
    const [activo, pasivo] = await Promise.all([
      activoValues?.length ? googleSheetsWorkingService.importActivoEntries(null, period, activoValues) : Promise.resolve({ errors: ["Activo vacío"], unchanged: false, inserted: 0 }),
      pasivoValues?.length ? googleSheetsWorkingService.importPasivoEntries(null, period, pasivoValues) : Promise.resolve({ errors: ["Pasivo vacío"], unchanged: false, inserted: 0 }),
    ]);
    const describe = (result: { errors: string[]; unchanged?: boolean; inserted: number }) => result.errors.some(error => /contained no valid rows/.test(error)) ? "sin datos en el Máster" : result.errors.length ? `error: ${result.errors.join("; ")}` : result.unchanged ? "sin cambios" : `${result.inserted} filas`;
    let cashflow = "sin datos";
    if (cashValues?.length) {
      const parsed = parseCashflowSnapshot(cashValues, period);
      cashflow = parsed.rows.length ? await replaceCashflow(period, parsed.rows) : "sin movimientos en el Máster";
    }
    let provisions = "sin datos";
    if (provisionMatrix.ok && provisionMatrix.rows.has(period)) provisions = await replaceProvisions(period, provisionMatrix.rows.get(period)!);
    report.results[period] = { activo: describe(activo), pasivo: describe(pasivo), cashflow, provisions };
  }
  return report;
}

async function replaceCashflow(period: string, rows: CashflowSnapshotRow[]) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger:cashflow:${period}`}))`);
    const current = await tx.select().from(cashflowTransactions).where(and(eq(cashflowTransactions.periodKey, period), eq(cashflowTransactions.source, "excel")));
    const print = (row: { fecha: unknown; tipoMovimiento: unknown; banco: unknown; detalleOperacion: unknown; montoUSD: unknown; montoARS: unknown }) =>
      [day(row.fecha), row.tipoMovimiento, row.banco ?? "", row.detalleOperacion ?? "", money2(row.montoUSD), money2(row.montoARS)].join("|");
    const before = current.filter(row => !row.voidedAt).map(print).sort();
    const after = rows.map(print).sort();
    if (before.length === after.length && before.every((value, index) => value === after[index]) && current.length === before.length) return "sin cambios";
    await tx.delete(cashflowTransactions).where(and(eq(cashflowTransactions.periodKey, period), eq(cashflowTransactions.source, "excel")));
    // row_hash is unique over date, bank, detail and amounts. Two identical Master
    // rows are two real movements, so repeated ones get a one-second offset.
    const seen = new Map<string, number>();
    const batch = `cashflow_${period}_${Date.now()}`;
    const values = rows.map(row => {
      const key = print(row);
      const occurrence = seen.get(key) ?? 0;
      seen.set(key, occurrence + 1);
      return { ...row, fecha: new Date(row.fecha.getTime() + occurrence * 1000), source: "excel", reconciliationStatus: "matched" as const, importBatch: batch, importedAt: new Date() };
    });
    for (let index = 0; index < values.length; index += 200) await tx.insert(cashflowTransactions).values(values.slice(index, index + 200));
    return `${values.length} movimientos`;
  });
}

/**
 * Master provisions are month-end balances, not movements. Status MASTER keeps them
 * out of every native calculation (those add APPROVED/ACTIVE movements over time).
 */
async function replaceProvisions(period: string, rows: { clienteNombre: string; criterio: string | null; balanceUsd: number }[]) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger:provisions:${period}`}))`);
    const current = await tx.select().from(provisionEntries).where(and(eq(provisionEntries.periodKey, period), isNotNull(provisionEntries.importBatch)));
    const print = (row: { clienteNombre: unknown; criterio: unknown; amount: unknown }) => [row.clienteNombre, row.criterio ?? "", money2(row.amount)].join("|");
    const before = current.map(row => print({ ...row, amount: row.remainingAmount ?? row.montoProvision })).sort();
    const after = rows.map(row => print({ ...row, amount: row.balanceUsd })).sort();
    if (before.length === after.length && before.every((value, index) => value === after[index])) return rows.length ? "sin cambios" : "sin provisiones";
    await tx.delete(provisionEntries).where(and(eq(provisionEntries.periodKey, period), isNotNull(provisionEntries.importBatch)));
    if (rows.length) await tx.insert(provisionEntries).values(rows.map(row => ({
      periodKey: period, clienteNombre: row.clienteNombre, criterio: row.criterio, tipo: "NUEVA_PROVISION",
      montoProvision: String(row.balanceUsd), remainingAmount: String(row.balanceUsd), currency: "USD", status: "MASTER",
      mesAplicacion: period, importBatch: `provision_master_${period}`, importedAt: new Date(),
    })));
    return rows.length ? `${rows.length} provisiones` : "sin provisiones";
  });
}
