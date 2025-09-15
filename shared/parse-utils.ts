/**
 * Utilidades robustas para parsear números con formatos diversos
 * Maneja: monedas, espacios, paréntesis negativos, decimales con coma
 */

/**
 * Parsea números con formato robusto
 * Ejemplos: "$1,234.56" → 1234.56, "(123,45)" → -123.45, "1.234,56" → 1234.56
 */
export const parseDec = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  
  const s = String(v)
    .replace(/\s+/g, "")        // espacios
    .replace(/\$/g, "")         // símbolos
    .replace(/\./g, "")         // miles
    .replace(/,/g, ".");        // decimales
  
  // (1.234,56) ó (1234,56) como negativo
  const neg = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[()]/g, "")) || 0;
  return neg ? -n : n;
};

/**
 * Normaliza nombres de meses a números
 * Ejemplos: "jul" → 7, "07 ago" → 8, 12 → 12
 */
export const toMonth = (m: string | number): number => {
  const map: Record<string, number> = { 
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 
  };
  if (typeof m === "number") return m;
  const key = m.toString().slice(0, 3).toLowerCase();
  return map[key] ?? Number(m) ?? 0;
};

/**
 * Genera clave de agrupación proyecto-mes normalizada
 * Formato: "projectId|yyyy-mm"
 */
export const generateGroupKey = (projectId: number | string, year: number | string, month: string | number): string => {
  const monthNum = toMonth(month);
  const yearNum = parseDec(year);
  const period = `${yearNum}-${String(monthNum).padStart(2, "0")}`;
  return `${projectId}|${period}`;
};