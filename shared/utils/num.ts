/**
 * Función universal para parsear números desde strings con formatos variados
 * Maneja: ES/US, miles, moneda, paréntesis negativos
 * 
 * Ejemplos:
 * - $1,234.56 → 1234.56
 * - 1.234,56 → 1234.56  
 * - 1 234,56 → 1234.56
 * - (1.234,56) → -1234.56
 * - 10,000 → 10000
 * - 10.000 → 10000
 */
export const parseDec = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  // Limpio símbolos y espacios, dejo dígitos, coma, punto, paréntesis y signo
  let s = String(v).trim()
    .replace(/\s+/g, "")
    .replace(/[$€£%]/g, "");

  // Paréntesis = negativo
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");

  // Detecto separador decimal por el ÚLTIMO (.,) del string
  const lastDot   = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const hasDot    = lastDot   !== -1;
  const hasComma  = lastComma !== -1;

  if (hasDot && hasComma) {
    // El que aparece más a la derecha es el decimal; el otro es miles
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    s = s.split(thousandSep).join("");     // saco miles
    if (decimalSep === ",") s = s.replace(",", "."); // normalizo decimal
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    // Si el separador aparece más de una vez → casi seguro miles
    const count = (s.match(new RegExp("\\" + sep, "g")) || []).length;
    if (count > 1) {
      s = s.split(sep).join("");
    } else {
      // única ocurrencia: si hay 1–2 dígitos detrás ⇒ decimal
      const tail = s.split(sep)[1] ?? "";
      if (tail.length <= 2) {
        if (sep === ",") s = s.replace(",", ".");
      } else {
        s = s.split(sep).join("");
      }
    }
  }
  
  const n = Number(s);
  const result = neg ? -n : n;
  return Number.isFinite(result) ? result : 0;
};

/**
 * Redondea horas al múltiplo de 15 minutos más cercano (0.25h).
 * Garantiza que el registro mínimo sea un cuarto de hora.
 */
export const roundToQuarterHour = (hours: number): number => {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 4) / 4;
};

/**
 * Normaliza mes desde string/número a número 1-12
 * Ejemplos: "jul" → 7, "ene" → 1, "01 ene" → 1, "08 ago" → 8, 7 → 7
 */
export const normMonth = (m: string | number): number => {
  const map: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12
  };
  
  if (typeof m === "number") return m;
  
  const str = m.toString().toLowerCase().trim();
  
  // Manejar formato "DD mmm" (ej: "01 ene", "08 ago")
  if (/^\d{1,2}\s+[a-z]{3}/.test(str)) {
    const monthPart = str.split(/\s+/)[1];
    return map[monthPart] ?? 0;
  }
  
  // Formato tradicional "mmm" (ej: "ene", "ago")
  const k = str.slice(0, 3);
  return map[k] ?? Number(str) ?? 0;
};