import { parseLocalizedDecimal } from "./quotation-pricing";
export function parseRemRows(text: string): Array<{ year: number; month: number; rate: number }> {
  const rows: Array<{ year: number; month: number; rate: number }> = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || /^(a[nñ]o|year)[,;\t]/i.test(line)) return;
    const match = line.match(/^(\d{4})[-,;\t](\d{1,2})[,;\t](.+)$/);
    if (!match) throw new Error(`Fila ${index + 1}: usá año;mes;tasa, por ejemplo 2027;1;1540,25`);
    if (!/^[\d\s.,]+$/.test(match[3])) throw new Error(`Fila ${index + 1}: tasa inválida`);
    const year = Number(match[1]); const month = Number(match[2]); const rate = parseLocalizedDecimal(match[3]);
    if (year < 2020 || year > 2200 || month < 1 || month > 12 || rate == null || rate <= 0) throw new Error(`Fila ${index + 1}: año, mes o tasa inválidos`);
    const key = `${year}-${month}`;
    if (seen.has(key)) throw new Error(`Fila ${index + 1}: el período ${year}-${String(month).padStart(2, "0")} está repetido`);
    seen.add(key); rows.push({ year, month, rate });
  });
  if (!rows.length) throw new Error("Ingresá al menos una proyección REM");
  return rows;
}
