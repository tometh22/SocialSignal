/**
 * Sistema de conversión FX mensual para ARS→USD
 * Basado en el rediseño operativo del usuario
 * 🛡️ FIXED: Includes robust currency normalization with anti×100 detection
 */

import { normalizeAmount } from "./money";

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
 * 🛡️ BULLETPROOF Currency Converter with Anti-Corruption Detection
 * Fixed: Applies robust normalization to USD amounts before using them
 * Detects and corrects extreme corruption (trillions from Excel import)
 * @param montoUSD Raw USD amount (possibly corrupted)
 * @param montoARS Monto en pesos argentinos
 * @param period Período para la conversión FX
 * @returns Monto total en USD (sanitized)
 */
export function convertToUsd(montoUSD: number, montoARS: number, period: string): number {
  // 🛡️ STEP 1: Normalize USD amount with anti×100 + extreme corruption detection
  const normalizedUSD = normalizeAmount(montoUSD);
  const normalizedARS = normalizeAmount(montoARS);
  
  // 🚨 STEP 2: Extreme corruption detection (Excel import can produce trillions)
  // If USD amount is suspiciously large compared to ARS equivalent
  if (normalizedUSD > 0 && normalizedARS > 0) {
    const expectedUSDFromARS = arsToUsd(normalizedARS, period);
    const ratio = normalizedUSD / expectedUSDFromARS;
    
    // If USD is >1000x larger than ARS conversion, it's likely corrupted
    if (ratio > 1000) {
      console.log(`🔧 EXTREME CORRUPTION DETECTED: USD ${normalizedUSD} vs ARS-derived ${expectedUSDFromARS.toFixed(2)} (ratio: ${ratio.toFixed(0)}x)`);
      console.log(`   Using ARS conversion instead: ${normalizedARS} ARS → ${expectedUSDFromARS.toFixed(2)} USD`);
      return expectedUSDFromARS;
    }
  }
  
  // 🎯 STEP 3: Standard logic with normalized values
  if (normalizedUSD && normalizedUSD > 0) {
    return normalizedUSD;
  }
  if (normalizedARS && normalizedARS > 0) {
    return arsToUsd(normalizedARS, period);
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