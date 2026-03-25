/**
 * FX Resolver Universal - Motor único de tipos de cambio por período
 * Cache por (projectId, period) con TTL 10 min según plan
 */

interface FXRate {
  period: string; // "yyyy-mm"
  usdToArs: number;
  arsToUsd: number;
  source: 'cotizaciones' | 'costos_median' | 'config_fallback';
  timestamp: Date;
}

// Cache en memoria con TTL
const fxCache = new Map<string, { rate: FXRate; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

/**
 * Resuelve FX único por período para consistencia universal
 * @param period - Período en formato "yyyy-mm" (ej: "2025-08")
 * @param projectId - ID del proyecto para cache específico
 * @returns Promise<FXRate>
 */
export async function resolveFX(period: string, projectId?: string): Promise<FXRate> {
  const cacheKey = `fx_${period}_${projectId || 'global'}`;
  
  // 1. Verificar cache
  const cached = fxCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    console.log(`💱 FX Cache hit for ${period}: ${cached.rate.usdToArs} (${cached.rate.source})`);
    return cached.rate;
  }

  try {
    // 2. Método 1: Buscar en tabla Cotizaciones por yyyy-mm
    const cotizacionesFX = await tryGetFromCotizaciones(period);
    if (cotizacionesFX) {
      const rate: FXRate = {
        period,
        usdToArs: cotizacionesFX,
        arsToUsd: safeInverse(cotizacionesFX),
        source: 'cotizaciones',
        timestamp: new Date()
      };
      
      // Cache con TTL
      fxCache.set(cacheKey, { rate, expiry: Date.now() + CACHE_TTL });
      console.log(`💱 FX from Cotizaciones for ${period}: ${rate.usdToArs}`);
      return rate;
    }

    // 3. Método 2: Mediana de costos del proyecto-mes
    if (projectId) {
      const costosFX = await tryGetFromCostosMedian(period, projectId);
      if (costosFX) {
        const rate: FXRate = {
          period,
          usdToArs: costosFX,
          arsToUsd: safeInverse(costosFX),
          source: 'costos_median',
          timestamp: new Date()
        };
        
        fxCache.set(cacheKey, { rate, expiry: Date.now() + CACHE_TTL });
        console.log(`💱 FX from Costos median for ${period}: ${rate.usdToArs}`);
        return rate;
      }
    }

    // 4. Fallback: Config por defecto
    const fallbackRate = getFallbackFX(period);
    const rate: FXRate = {
      period,
      usdToArs: fallbackRate,
      arsToUsd: safeInverse(fallbackRate),
      source: 'config_fallback',
      timestamp: new Date()
    };
    
    fxCache.set(cacheKey, { rate, expiry: Date.now() + CACHE_TTL });
    console.log(`💱 FX fallback for ${period}: ${rate.usdToArs}`);
    return rate;

  } catch (error) {
    console.error(`❌ Error resolving FX for ${period}:`, error);
    
    // Fallback en caso de error
    const fallbackRate = getFallbackFX(period);
    return {
      period,
      usdToArs: fallbackRate,
      arsToUsd: safeInverse(fallbackRate),
      source: 'config_fallback',
      timestamp: new Date()
    };
  }
}

/**
 * Intenta obtener FX de tabla Cotizaciones
 */
async function tryGetFromCotizaciones(period: string): Promise<number | null> {
  try {
    // TODO: Implementar query a tabla cotizaciones
    // SELECT rate FROM cotizaciones WHERE period = 'yyyy-mm' ORDER BY date DESC LIMIT 1
    console.log(`🔍 FX: Buscando en Cotizaciones para ${period}...`);
    return null; // Temporalmente null hasta implementar
  } catch (error) {
    console.warn(`⚠️ Error getting FX from Cotizaciones: ${error}`);
    return null;
  }
}

/**
 * Intenta obtener FX de mediana de costos del proyecto
 */
async function tryGetFromCostosMedian(period: string, projectId: string): Promise<number | null> {
  try {
    // TODO: Implementar query de mediana de costos
    // SELECT MEDIAN(tipoCambio) FROM directCosts WHERE period = 'yyyy-mm' AND projectId = x
    console.log(`🔍 FX: Calculando mediana de costos para ${period}, proyecto ${projectId}...`);
    return null; // Temporalmente null hasta implementar
  } catch (error) {
    console.warn(`⚠️ Error getting FX from costs median: ${error}`);
    return null;
  }
}

/**
 * Fallback FX basado en configuración
 */
function getFallbackFX(period: string): number {
  // Extraer año del período
  const year = parseInt(period.split('-')[0]);

  // Configuración FX por año (estimada)
  const fallbackRates: { [year: number]: number } = {
    2023: 900,
    2024: 1200,
    2025: 1350,
    2026: 1500
  };

  return fallbackRates[year] || 1350; // Default 2025
}

/** Safe inverse: prevents division by zero in FX calculations */
function safeInverse(rate: number): number {
  if (!rate || !Number.isFinite(rate) || rate === 0) return 0;
  return 1 / rate;
}

/**
 * Limpiar cache (útil para testing)
 */
export function clearFXCache(): void {
  fxCache.clear();
  console.log('🗑️ FX Cache cleared');
}

/**
 * Obtener estadísticas del cache
 */
export function getFXCacheStats(): { size: number; keys: string[] } {
  return {
    size: fxCache.size,
    keys: Array.from(fxCache.keys())
  };
}