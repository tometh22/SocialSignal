/**
 * Opening balances for the switchover to Mind, read from the Máster detail of the
 * last Máster month (UNFORMATTED_VALUE rows). Only what is still open at that
 * month end: uncollected invoices, unpaid obligations, bank balances and crypto.
 */
type Rows = unknown[][];
const text = (value: unknown) => String(value ?? "").trim();
const key = (value: unknown) => text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const periodOf = (month: unknown, year: unknown) => {
  const m = Number(String(month ?? "").match(/^\s*(\d{1,2})/)?.[1]);
  const y = Number(year);
  return m >= 1 && m <= 12 && y > 2000 ? `${y}-${String(m).padStart(2, "0")}` : null;
};
const sheetDate = (value: unknown) => typeof value === "number" && value > 20000 ? new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10) : null;

export type OpeningMoney = { currency: "USD" | "ARS"; amount: number; rate: number | null; amountUsd: number };
export type OpeningBank = { name: string } & OpeningMoney;
export type OpeningReceivable = { clientName: string; invoiceNumber: string | null; dueDate: string | null; detail: string | null } & OpeningMoney;
export type OpeningPayable = { detail: string; subtype: string | null; dueDate: string | null; document: string | null } & OpeningMoney;
export type OpeningInvestment = { name: string; amountUsd: number };

const money = (ars: unknown, usd: unknown, rate: unknown, total: unknown): OpeningMoney | null => {
  const amountUsd = num(total) ?? num(usd) ?? (num(ars) != null && num(rate) ? num(ars)! / num(rate)! : null);
  if (amountUsd == null || amountUsd === 0) return null;
  if (num(ars) != null && num(rate)) return { currency: "ARS", amount: num(ars)!, rate: num(rate), amountUsd };
  return { currency: "USD", amount: num(usd) ?? amountUsd, rate: null, amountUsd };
};

export function masterOpeningItems(tabs: { activo: Rows; pasivo: Rows }, asOf: string) {
  const banks: OpeningBank[] = [], receivables: OpeningReceivable[] = [], investments: OpeningInvestment[] = [], payables: OpeningPayable[] = [];
  for (const row of tabs.activo.slice(1)) {
    if (periodOf(row[3], row[4]) !== asOf) continue;
    const kind = key(row[1]);
    const value = money(row[13], row[14], row[15], row[16]);
    if (!value) continue;
    if (kind === "activo liquido") banks.push({ name: text(row[0]) || "Cuenta sin nombre", ...value });
    else if (kind === "mediano plazo") investments.push({ name: text(row[0]) || "Inversión", amountUsd: value.amountUsd });
    else if (!["si", "cobrado"].includes(key(row[5]))) receivables.push({ clientName: text(row[2]) || text(row[10]) || text(row[0]), invoiceNumber: text(row[9]) || null, dueDate: sheetDate(row[12]), detail: text(row[11]) || text(row[0]) || null, ...value });
  }
  for (const row of tabs.pasivo.slice(1)) {
    // Provisions come from the "Provisión pasivo" matrix, not from these rows.
    if (periodOf(row[2], row[3]) !== asOf || key(row[4]).startsWith("pagado") || key(row[1]) === "provision pasivo") continue;
    const value = money(row[10], row[11], row[12], row[13]);
    if (!value) continue;
    payables.push({ detail: text(row[0]) || text(row[7]) || "Obligación", subtype: text(row[1]) || null, dueDate: sheetDate(row[9]), document: text(row[8]) || null, ...value });
  }
  return { banks, receivables, payables, investments };
}
