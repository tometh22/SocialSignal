import { parseCashflowSnapshot } from "./ledger-snapshot";

type Rows = unknown[][];
const text = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const periodOf = (month: unknown, year: unknown) => {
  const m = Number(String(month ?? "").match(/^\s*(\d{1,2})/)?.[1]);
  const y = Number(year);
  return m >= 1 && m <= 12 && y > 2000 ? `${y}-${String(m).padStart(2, "0")}` : null;
};

/** Sums of the Máster detail tabs for one month, with the same meaning Mind gives each figure. */
export function masterDetailTotals(tabs: { activo: Rows; pasivo: Rows; cash: Rows }, period: string) {
  let receivables = 0, receivablesPending = 0, bank = 0, payables = 0, payablesPending = 0, payablesPendingOperating = 0;
  for (const row of tabs.activo.slice(1)) {
    if (periodOf(row[3], row[4]) !== period) continue;
    const kind = text(row[1]);
    if (kind === "activo liquido") bank += amount(row[16]);
    else if (kind !== "mediano plazo") {
      receivables += amount(row[16]);
      if (!["si", "cobrado"].includes(text(row[5]))) receivablesPending += amount(row[16]);
    }
  }
  for (const row of tabs.pasivo.slice(1)) {
    if (periodOf(row[2], row[3]) !== period) continue;
    payables += amount(row[13]);
    if (text(row[4]).startsWith("pagado")) continue;
    payablesPending += amount(row[13]);
    // The Resumen shows US tax and advance-billing provisions on their own lines.
    if (!["impuestos usa", "provision pasivo"].includes(text(row[1]))) payablesPendingOperating += amount(row[13]);
  }
  const movements = parseCashflowSnapshot(tabs.cash, period).rows;
  const cashIn = movements.filter(row => row.tipoMovimiento === "Ingreso").reduce((sum, row) => sum + Number(row.montoUSD), 0);
  const cashOut = movements.filter(row => row.tipoMovimiento === "Egreso").reduce((sum, row) => sum + Number(row.montoUSD), 0);
  return { receivables, receivablesPending, bank, payables, payablesPending, payablesPendingOperating, cashIn, cashOut, movements: movements.length };
}

