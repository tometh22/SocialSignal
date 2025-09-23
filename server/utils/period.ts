/**
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