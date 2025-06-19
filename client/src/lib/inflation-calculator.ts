/**
 * Utilidades para cálculo de inflación argentina y proyección de costos
 */

export interface InflationCalculationResult {
  originalCost: number;
  projectedCost: number;
  inflationApplied: number;
  monthsToProject: number;
}

/**
 * Calcula la proyección de costo con inflación compuesta basada en datos históricos
 */
export function calculateAutomaticInflationProjection(
  baseCost: number,
  monthlyInflationRates: number[], // Array de tasas mensuales históricas
  startDate: Date,
  currentDate: Date = new Date()
): InflationCalculationResult {
  const monthsToProject = getMonthsDifference(currentDate, startDate);
  
  if (monthsToProject <= 0) {
    return {
      originalCost: baseCost,
      projectedCost: baseCost,
      inflationApplied: 0,
      monthsToProject: 0
    };
  }

  // Calcular promedio de inflación mensual de los últimos 12 meses
  const recentRates = monthlyInflationRates.slice(-12);
  const averageMonthlyRate = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
  
  // Aplicar inflación compuesta mensual
  const projectedCost = baseCost * Math.pow(1 + averageMonthlyRate, monthsToProject);
  const inflationApplied = ((projectedCost - baseCost) / baseCost) * 100;
  
  return {
    originalCost: baseCost,
    projectedCost,
    inflationApplied,
    monthsToProject
  };
}

/**
 * Calcula la proyección con inflación manual
 */
export function calculateManualInflationProjection(
  baseCost: number,
  manualInflationRate: number, // Tasa total proyectada (ej: 0.30 = 30%)
  startDate: Date,
  currentDate: Date = new Date()
): InflationCalculationResult {
  const monthsToProject = getMonthsDifference(currentDate, startDate);
  
  if (monthsToProject <= 0) {
    return {
      originalCost: baseCost,
      projectedCost: baseCost,
      inflationApplied: 0,
      monthsToProject: 0
    };
  }

  // Aplicar la tasa de inflación directamente
  const projectedCost = baseCost * (1 + manualInflationRate);
  const inflationApplied = manualInflationRate * 100;
  
  return {
    originalCost: baseCost,
    projectedCost,
    inflationApplied,
    monthsToProject
  };
}

/**
 * Calcula la diferencia en meses entre dos fechas
 */
function getMonthsDifference(startDate: Date, endDate: Date): number {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  return yearDiff * 12 + monthDiff;
}

/**
 * Convierte USD a ARS con tipo de cambio
 */
export function convertUSDToARS(usdAmount: number, exchangeRate: number): number {
  return usdAmount * exchangeRate;
}

/**
 * Convierte ARS a USD con tipo de cambio
 */
export function convertARSToUSD(arsAmount: number, exchangeRate: number): number {
  return arsAmount / exchangeRate;
}

/**
 * Formatea un monto en pesos argentinos
 */
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea un monto en dólares
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Obtiene la fecha mínima para selección (hoy)
 */
export function getMinimumProjectDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Obtiene una fecha por defecto (3 meses desde hoy)
 */
export function getDefaultProjectDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().split('T')[0];
}

/**
 * Calcula el promedio de inflación anual basado en datos mensuales
 */
export function calculateAnnualInflationFromMonthly(monthlyRates: number[]): number {
  if (monthlyRates.length === 0) return 0;
  
  // Inflación compuesta anual = (1 + tasa_mensual)^12 - 1
  const averageMonthlyRate = monthlyRates.reduce((sum, rate) => sum + rate, 0) / monthlyRates.length;
  return Math.pow(1 + averageMonthlyRate, 12) - 1;
}