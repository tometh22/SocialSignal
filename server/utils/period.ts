/**
 * @deprecated Use shared/utils/timePeriod.ts instead.
 * This file is legacy and will be removed in a future version.
 * All new code should import from 'shared/utils/timePeriod.ts'.
 *
 * 📅 Period Resolution Utils
 * Soporte para mes, trimestre y períodos custom con meses en español
 */

export interface Period {
  start: Date;
  end: Date;
  label: string;
}

// Tabla de meses en español con fallback numérico
const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

const MONTHS_ES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * 🎯 Resuelve períodos: mes, trimestre, custom
 */
export function resolvePeriod(periodType: string, year?: number, month?: number, quarter?: number): Period {
  const currentYear = year || new Date().getFullYear();
  
  switch (periodType) {
    case 'month':
      return resolveMonth(currentYear, month || new Date().getMonth() + 1);
      
    case 'quarter':
      return resolveQuarter(currentYear, quarter || Math.ceil((new Date().getMonth() + 1) / 3));
      
    case 'custom':
      // Para custom, se esperan parámetros adicionales
      throw new Error('Custom period requires additional parameters');
      
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * 📅 Resuelve mes específico
 */
function resolveMonth(year: number, month: number): Period {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be 1-12`);
  }
  
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Último día del mes
  
  const monthLabel = MONTHS_ES[month - 1] || month.toString();
  const label = `${monthLabel} ${year}`;
  
  return { start, end, label };
}

/**
 * 📊 Resuelve trimestre
 */
function resolveQuarter(year: number, quarter: number): Period {
  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter: ${quarter}. Must be 1-4`);
  }
  
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  
  const start = new Date(year, startMonth - 1, 1);
  const end = new Date(year, endMonth, 0); // Último día del trimestre
  
  const label = `Q${quarter} ${year}`;
  
  return { start, end, label };
}

/**
 * 🔍 Parsea string de mes español a número
 */
export function parseSpanishMonth(monthStr: string): number {
  const normalized = monthStr.toLowerCase().trim();
  
  // Buscar en meses cortos
  const shortIndex = MONTHS_ES.findIndex(m => m === normalized);
  if (shortIndex !== -1) return shortIndex + 1;
  
  // Buscar en meses completos
  const fullIndex = MONTHS_ES_FULL.findIndex(m => m === normalized);
  if (fullIndex !== -1) return fullIndex + 1;
  
  // Fallback numérico
  const numeric = parseInt(normalized);
  if (!isNaN(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric;
  }
  
  throw new Error(`Cannot parse Spanish month: ${monthStr}`);
}

/**
 * 📅 Convierte Date a monthKey (YYYY-MM)
 */
export function dateToMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 📅 Parsea monthKey (YYYY-MM) a Date
 */
export function monthKeyToDate(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(n => parseInt(n));
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error(`Invalid monthKey format: ${monthKey}. Expected YYYY-MM`);
  }
  return new Date(year, month - 1, 1);
}

/**
 * 🎯 Genera monthKeys en un rango de período
 */
export function getMonthKeysInPeriod(period: Period): string[] {
  const monthKeys: string[] = [];
  const current = new Date(period.start);
  
  while (current <= period.end) {
    monthKeys.push(dateToMonthKey(current));
    current.setMonth(current.getMonth() + 1);
  }
  
  return monthKeys;
}

/**
 * 🔄 Parse timeFilter legacy or new period format
 */
export function parseTimeLegacyOrNew(q: any): { period: string; range: "month" | "quarter" | "year" } {
  const tf = String(q.timeFilter || "");
  
  if (/^\d{4}-\d{2}$/.test(String(q.period || ""))) {
    return { period: String(q.period), range: (q.range as any) || "month" };
  }
  
  // Handle "this-month" and "current_month"
  if (tf === "this-month" || tf === "current_month") {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    return { period: `${y}-${m}`, range: "month" };
  }
  
  // Handle "last-month" and "mes_pasado"
  if (tf === "last-month" || tf === "mes_pasado") {
    const d = new Date();
    let lastMonth = d.getMonth(); // 0-11 (current month)
    let lastMonthYear = d.getFullYear();
    
    // Go back one month
    lastMonth = lastMonth - 1;
    if (lastMonth < 0) {
      lastMonth = 11; // December
      lastMonthYear = lastMonthYear - 1;
    }
    
    const m = String(lastMonth + 1).padStart(2, "0"); // +1 because months are 0-indexed
    return { period: `${lastMonthYear}-${m}`, range: "month" };
  }
  
  // Handle "this-quarter" and "current_quarter"
  if (tf === "this-quarter" || tf === "current_quarter" || tf === "este_trimestre") {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    console.log(`📅 QUARTER FILTER: this-quarter → ${y}-${m} (current month within quarter)`);
    return { period: `${y}-${m}`, range: "quarter" };
  }
  
  // Handle "last-quarter"
  if (tf === "last-quarter" || tf === "last_quarter" || tf === "trimestre_pasado") {
    const d = new Date();
    const currentMonth = d.getMonth(); // 0-11
    const currentQuarter = Math.floor(currentMonth / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
    const prevQuarter = currentQuarter - 1 < 0 ? 3 : currentQuarter - 1;
    const prevQuarterYear = currentQuarter - 1 < 0 ? d.getFullYear() - 1 : d.getFullYear();
    // Last month of previous quarter: Q1=Mar(3), Q2=Jun(6), Q3=Sep(9), Q4=Dec(12)
    const lastMonthOfPrevQuarter = (prevQuarter + 1) * 3;
    const period = `${prevQuarterYear}-${String(lastMonthOfPrevQuarter).padStart(2, "0")}`;
    console.log(`📅 QUARTER FILTER: last-quarter → ${period}`);
    return { period, range: "quarter" };
  }
  
  // Handle month names like "january", "february", etc.
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthIdx = monthNames.indexOf(tf.toLowerCase());
  if (monthIdx >= 0) {
    const y = new Date().getFullYear();
    return { period: `${y}-${String(monthIdx + 1).padStart(2, "0")}`, range: "month" };
  }
  
  if (/^[a-z]+_\d{4}$/i.test(tf)) {
    const [name, year] = tf.split("_");
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthsEs = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    
    let idx = months.indexOf(name.slice(0, 3).toLowerCase());
    if (idx < 0) {
      idx = monthsEs.indexOf(name.toLowerCase());
    }
    
    if (idx >= 0) {
      return { period: `${year}-${String(idx + 1).padStart(2, "0")}`, range: "month" };
    }
  }
  
  const d = new Date();
  return {
    period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    range: "month"
  };
}