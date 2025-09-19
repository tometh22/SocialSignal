// services/fx.ts - Utilidades de tipos de cambio DRY

import { parseDec } from './number';
import { TimeFilter } from './time';

/**
 * Obtiene la cotización para una fila específica
 * Prioriza: cotización de fila > FX de período > fallback
 */
export function fxForRow(period: TimeFilter, row: any): number {
  // 1. Prioridad: cotización específica de la fila
  if (row.cotizacion || row.FX || row.fx) {
    const fxFromRow = parseDec(row.cotizacion || row.FX || row.fx);
    if (fxFromRow > 0) return fxFromRow;
  }
  
  // 2. FX del período (debe implementarse con datos históricos)
  const periodFX = getFXSync(period);
  if (periodFX > 0) return periodFX;
  
  // 3. Fallback conservador
  return 1000;
}

/**
 * Obtiene el tipo de cambio promedio para un período
 * TODO: Implementar con datos históricos de exchange_rate_history
 */
export async function getFX(period: TimeFilter): Promise<number> {
  // TODO: Implementar query a exchange_rate_history
  // const avg = await storage.getExchangeRateForPeriod(period.start, period.end);
  // return avg?.rate || 1000;
  
  // Por ahora fallback conservador pero mejor estimado según período
  const year = parseInt(period.start.split('-')[0]);
  if (year >= 2025) return 1300; // Estimado 2025
  if (year >= 2024) return 1200; // Estimado 2024
  return 1000; // Fallback histórico
}

/**
 * Versión síncrona de getFX para compatibilidad
 */
export function getFXSync(period: TimeFilter): number {
  const year = parseInt(period.start.split('-')[0]);
  if (year >= 2025) return 1300; // Estimado 2025
  if (year >= 2024) return 1200; // Estimado 2024
  return 1000; // Fallback histórico
}

/**
 * Calcula rateUSD desde datos de fila
 * rateUSD = row.Valor_Hora_ARS / fxForRow(row)
 * Mapea TODOS los campos posibles de rate
 */
export function rateUSD(period: TimeFilter, row: any): number {
  // Expandir mapeo a TODOS los campos posibles según logs
  const valorHoraARS = parseDec(
    row.Valor_Hora_ARS || 
    row.valor_hora_ars || 
    row.valorHoraPersona ||
    row.valorHoraLocalCurrency ||
    row.rate || 
    row.hourlyRate ||
    0
  );
  
  if (valorHoraARS <= 0) return 0;
  
  const fx = fxForRow(period, row);
  return valorHoraARS / fx;
}