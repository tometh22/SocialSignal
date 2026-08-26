/**
 * Sistema de conversión FX mensual para ARS→USD
 * Basado en el rediseño operativo del usuario
 * 🛡️ FIXED: Includes robust currency normalization with anti×100 detection
 */

import { parseMoneyUnified, detectAntiX100Generic } from "./money";
import { fxForMonth } from "../services/fx";

// Tabla de cotizaciones mensuales ARS/USD
/**
 * Obtiene la cotización ARS/USD para un período específico
 * @param period YYYY-MM format
 * @returns ARS/USD exchange rate
 */
export function getFxRate(period: string): number {
  return fxForMonth(period);
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
 * 🛡️ CONVERTIDOR DE MONEDA UNIFICADO CON ANTI-X100 GENÉRICO
 * Usa parser unificado y detección anti-x100 genérica sin hardcodeo de clientes/proyectos
 * @param montoUSD Raw USD amount (possibly corrupted)
 * @param montoARS Monto en pesos argentinos  
 * @param period Período para la conversión FX
 * @returns Monto total en USD (sanitized)
 */
export function convertToUsd(montoUSD: number, montoARS: number, period: string): number {
  // 🛡️ STEP 1: Parser unificado para ambos valores
  const parsedUSD = parseMoneyUnified(montoUSD);
  const parsedARS = parseMoneyUnified(montoARS);
  
  // 🛡️ STEP 2: Detección anti-x100 genérica por fila
  const tipoCambio = getFxRate(period);
  const antiX100Result = detectAntiX100Generic(parsedUSD, parsedARS, tipoCambio);
  let finalUSD = antiX100Result.correctedUSD;
  
  // 🚨 STEP 3: Detección de corrupción extrema (sin hardcodeo de clientes)
  if (parsedUSD > 0 && parsedARS > 0) {
    const expectedUSDFromARS = arsToUsd(parsedARS, period);
    const ratio = finalUSD / expectedUSDFromARS;
    
    // 🔧 EXTREME CORRUPTION (millions/billions): Always use ARS conversion
    if (ratio > 1000000) {
      console.log(`🔧 EXTREME CORRUPTION DETECTED: USD ${finalUSD} vs ARS-derived ${expectedUSDFromARS.toFixed(2)} (ratio: ${ratio.toFixed(0)}x)`);
      console.log(`   Using ARS conversion instead: ${parsedARS} ARS → ${expectedUSDFromARS.toFixed(2)} USD`);
      return expectedUSDFromARS;
    }
    
    // 🎯 SMART DETECTION (1000-1M): Ratios > 1250x always use ARS conversion
    if (ratio > 1250) {
      console.log(`🔧 HIGH CORRUPTION DETECTED: USD ${finalUSD} vs ARS-derived ${expectedUSDFromARS.toFixed(2)} (ratio: ${ratio.toFixed(0)}x)`);
      console.log(`   Using ARS conversion instead: ${parsedARS} ARS → ${expectedUSDFromARS.toFixed(2)} USD`);
      return expectedUSDFromARS;
    }
    
    // 🎯 MODERATE SMART DETECTION (1000-1250x): Check if USD is reasonable business value
    if (ratio > 1000) {
      // If USD amount is in reasonable business range (100-20000), trust it
      if (finalUSD >= 100 && finalUSD <= 20000) {
        console.log(`💡 SMART DETECTION: USD ${finalUSD} is reasonable business value despite ${ratio.toFixed(0)}x ratio - keeping USD`);
        return finalUSD;
      } else {
        console.log(`🔧 HIGH CORRUPTION DETECTED: USD ${finalUSD} vs ARS-derived ${expectedUSDFromARS.toFixed(2)} (ratio: ${ratio.toFixed(0)}x)`);
        console.log(`   Using ARS conversion instead: ${parsedARS} ARS → ${expectedUSDFromARS.toFixed(2)} USD`);
        return expectedUSDFromARS;
      }
    }
    
    // 🔍 MODERATE RATIO (50-1000x): Prefer USD if reasonable
    if (ratio > 50) {
      if (finalUSD >= 50 && finalUSD <= 15000) {
        console.log(`✅ MODERATE RATIO: Keeping USD ${finalUSD} (ratio: ${ratio.toFixed(1)}x, reasonable value)`);
        return finalUSD;
      }
    }
  }
  
  // 🎯 STEP 4: Standard logic with parsed values
  if (finalUSD && finalUSD > 0) {
    return finalUSD;
  }
  if (parsedARS && parsedARS > 0) {
    return arsToUsd(parsedARS, period);
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
