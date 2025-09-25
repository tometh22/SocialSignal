/**
 * 🚀 FX CACHE Y TIPOS DE CAMBIO POR PERÍODO
 * Cache en memoria + acceso a DB/configuración
 */

import { db } from './db-adapter';

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
  
  // Lee de tu tabla "tipo de cambio" por mes; fallback explícito si no existe
  const fx = await db.fx.get(period); // p.ej. 1345 para 2025-08
  if (!fx) throw new Error(`FX no disponible para período ${period}`);
  
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