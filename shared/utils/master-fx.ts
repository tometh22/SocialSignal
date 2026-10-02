import { parseDec } from "../parse-utils";
import { getBuenosAiresPeriod } from "./fx-periods";
export type MasterFxRate = { mes: string; año: number; month: number; tipoCambio: number; fuente: string; periodKey: string; rateType: "end_of_month" | "estimated"; notes?: string };
const months: Record<string, number> = { ene:1,jan:1,feb:2,mar:3,abr:4,apr:4,may:5,jun:6,jul:7,ago:8,aug:8,sep:9,oct:10,nov:11,dic:12,dec:12 };
const spanish = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export function parseMasterFxRows(rows: unknown[][], now = new Date()): MasterFxRate[] {
  const current = getBuenosAiresPeriod(now); const result: MasterFxRate[] = []; const seen = new Set<string>();
  for (const row of rows) {
    const label = String(row[0] ?? "").toLowerCase();
    const year = Number(label.match(/\b(20\d{2})\b/)?.[1]);
    const monthWord = label.match(/[a-záéíóú]+/)?.[0]?.slice(0,3) ?? "";
    const month = months[monthWord];
    if (!year || !month) continue;
    const rate = parseDec(row[1]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Tipo de cambio inválido: ${label}`);
    const notes = row.slice(2).map(value => String(value ?? "")).join(" ").trim();
    const projected = year * 100 + month >= current.year * 100 + current.month || /prox|proyec|estimad|falta de información/i.test(notes);
    const periodKey = `${year}-${String(month).padStart(2,"0")}`;
    if (seen.has(periodKey)) throw new Error(`Tipo de cambio duplicado: ${periodKey}`);
    seen.add(periodKey);
    result.push({ mes: spanish[month-1], año: year, month, tipoCambio: rate, fuente: projected ? "REM" : "Blue", periodKey, rateType: projected ? "estimated" : "end_of_month", notes });
  }
  return result;
}
