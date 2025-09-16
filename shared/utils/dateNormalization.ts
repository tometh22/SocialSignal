/**
 * Utilidades para normalización de fechas y períodos
 * Convierte valores en español/inglés a formatos estandarizados
 */

const SPANISH_MONTHS: Record<string, number> = {
  // Español abreviado
  'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
  // Español completo
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
  // Inglés abreviado  
  'jan': 1, 'apr': 4, 'aug': 8, 'dec': 12,
  // Inglés completo
  'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
  'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
  // Variantes españolas
  'set': 9, 'setiembre': 9
};

/**
 * Normaliza un valor de mes (string o número) a número 1-12
 * Soporta español, inglés, abreviado y completo
 */
export function normalizeMonth(monthValue: string | number): number {
  if (typeof monthValue === 'number') {
    return monthValue >= 1 && monthValue <= 12 ? monthValue : 1;
  }
  
  const normalizedKey = monthValue.toLowerCase().trim();
  return SPANISH_MONTHS[normalizedKey] || 1;
}

/**
 * Construye un período en formato YYYY-MM
 */
export function buildPeriod(year: number | string, month: number | string): string {
  const normalizedYear = typeof year === 'string' ? parseInt(year) : year;
  const normalizedMonth = typeof month === 'string' ? normalizeMonth(month) : month;
  
  const mm = normalizedMonth.toString().padStart(2, '0');
  return `${normalizedYear}-${mm}`;
}

/**
 * Crea una fecha del primer día del mes para comparaciones de rango
 */
export function buildPeriodDate(year: number | string, month: number | string): Date {
  const normalizedYear = typeof year === 'string' ? parseInt(year) : year;
  const normalizedMonth = typeof month === 'string' ? normalizeMonth(month) : month;
  
  return new Date(normalizedYear, normalizedMonth - 1, 1);
}

/**
 * Extrae año y mes de un período YYYY-MM
 */
export function parsePeriod(period: string): { year: number; month: number } {
  const [yearStr, monthStr] = period.split('-');
  return {
    year: parseInt(yearStr),
    month: parseInt(monthStr)
  };
}