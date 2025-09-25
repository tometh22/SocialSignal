/**
 * 🚀 FX CACHE Y TIPOS DE CAMBIO POR PERÍODO
 * Cache en memoria + acceso a DB/configuración
 */

import { getFxRate } from '../../utils/fx'; // Reutilizar la lógica existente

// Cache en memoria simple
const cache = new Map<string, number>(); // key: period "YYYY-MM" -> fx

/**
 * Obtiene el tipo de cambio para un período con cache
 * @param period PeriodKey "YYYY-MM"
 * @returns ARS/USD exchange rate
 */
export async function getFx(period: string): Promise<number> {
  if (cache.has(period)) {
    return cache.get(period)!;
  }
  
  // Reutilizar la lógica existente de getFxRate
  const fx = getFxRate(period);
  
  if (!fx || fx <= 0) {
    throw new Error(`FX no disponible para período ${period}`);
  }
  
  cache.set(period, fx);
  return fx;
}

/**
 * Limpia el cache (útil para testing)
 */
export function clearFxCache(): void {
  cache.clear();
}

/**
 * Obtiene todos los tipos de cambio en cache (debug)
 */
export function getFxCacheStats(): Record<string, number> {
  return Object.fromEntries(cache);
}