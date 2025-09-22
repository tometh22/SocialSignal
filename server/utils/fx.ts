/**
 * Sistema de conversión FX mensual para ARS→USD
 * Basado en el rediseño operativo del usuario
 */

// Tabla de cotizaciones mensuales ARS/USD
const FX_RATES: Record<string, number> = {
  '2024-12': 1020,
  '2025-01': 1050,
  '2025-02': 1080,
  '2025-03': 1110,
  '2025-04': 1140,
  '2025-05': 1170,
  '2025-06': 1200,
  '2025-07': 1230,
  '2025-08': 1260,
  '2025-09': 1290,
  '2025-10': 1320,
  '2025-11': 1350,
  '2025-12': 1380,
};

const FALLBACK_RATE = 1300; // Cotización fallback si no existe el período

/**
 * Obtiene la cotización ARS/USD para un período específico
 * @param period YYYY-MM format
 * @returns ARS/USD exchange rate
 */
export function getFxRate(period: string): number {
  return FX_RATES[period] || FALLBACK_RATE;
}

/**
 * Convierte ARS a USD usando la cotización del período
 * @param amountARS Monto en pesos argentinos
 * @param period Período en formato YYYY-MM
 * @returns Monto en USD
 */
export function arsToUsd(amountARS: number, period: string): number {
  if (amountARS <= 0) return 0;
  const rate = getFxRate(period);
  return amountARS / rate;
}

/**
 * Convierte un monto de moneda mixta a USD
 * Regla: Si Monto_USD > 0 → usar eso. Si Monto_USD == 0 y Monto_ARS > 0 → convertir
 * @param montoUSD Monto ya en USD
 * @param montoARS Monto en pesos argentinos
 * @param period Período para la conversión
 * @returns Monto total en USD
 */
export function convertToUsd(montoUSD: number, montoARS: number, period: string): number {
  if (montoUSD && montoUSD > 0) {
    return montoUSD;
  }
  if (montoARS && montoARS > 0) {
    return arsToUsd(montoARS, period);
  }
  return 0;
}

/**
 * Extrae el período YYYY-MM de una fecha
 * @param date Fecha en formato YYYY-MM-DD o Date object
 * @returns Período en formato YYYY-MM
 */
export function extractPeriod(date: string | Date): string {
  if (typeof date === 'string') {
    return date.substring(0, 7); // "2025-09-15" -> "2025-09"
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}