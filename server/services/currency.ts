// Servicio de conversión y normalización de monedas
import { db } from '../db';
import { exchangeRates } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export type CurrencyCode = 'ARS' | 'USD';

interface IncomeRecord {
  currency: string;
  amountLocal: number;
  amountUsd?: number;
  month: string;
  year: number;
}

interface CostRecord {
  costoTotal: number;
  montoTotalUSD?: number;
  mes: string;
  año: number;
}

interface ExchangeRate {
  period: string;
  rate: number;
  source: string;
}

/**
 * Selecciona la moneda de análisis basada en los ingresos del proyecto
 * Lógica:
 * - Si todos los ingresos están en una sola moneda → usar esa moneda
 * - Si hay mezcla de monedas → usar USD como estándar
 * - Si no hay ingresos → usar USD por defecto
 */
export function pickAnalysisCurrency(incomes: IncomeRecord[], fallback: CurrencyCode = 'USD'): CurrencyCode {
  if (!incomes || incomes.length === 0) {
    return fallback;
  }

  // Obtener todas las monedas únicas de los ingresos
  const currencies = new Set(incomes.map(income => income.currency?.toUpperCase()));
  
  // Si todas están en ARS, usar ARS
  if (currencies.size === 1 && currencies.has('ARS')) {
    return 'ARS';
  }
  
  // Si todas están en USD, usar USD
  if (currencies.size === 1 && currencies.has('USD')) {
    return 'USD';
  }
  
  // Si hay mezcla o moneda desconocida, usar USD como estándar
  return 'USD';
}

/**
 * Obtiene la tasa de cambio para un período específico desde la base de datos
 * Busca tasas reales por año/mes, con fallback a la más reciente disponible
 */
export async function getPeriodRate(period: string): Promise<ExchangeRate> {
  try {
    // Parsear período: puede ser "MM_YYYY", "MM MMM", "month_year", etc.
    let year: number;
    let month: number;
    
    if (period.includes('_')) {
      const [monthStr, yearStr] = period.split('_');
      month = parseInt(monthStr);
      year = parseInt(yearStr);
    } else {
      // Fallback para otros formatos - usar fecha actual
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    
    // Buscar tasa específica para el año/mes
    const specificRate = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.year, year),
          eq(exchangeRates.month, month),
          eq(exchangeRates.isActive, true)
        )
      )
      .orderBy(desc(exchangeRates.createdAt))
      .limit(1);
    
    if (specificRate.length > 0) {
      return {
        period,
        rate: parseFloat(specificRate[0].rate.toString()),
        source: specificRate[0].source || 'database'
      };
    }
    
    // Si no hay tasa específica, buscar la más reciente disponible
    const latestRate = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.isActive, true))
      .orderBy(desc(exchangeRates.year), desc(exchangeRates.month))
      .limit(1);
    
    if (latestRate.length > 0) {
      return {
        period,
        rate: parseFloat(latestRate[0].rate.toString()),
        source: `fallback_${latestRate[0].year}-${latestRate[0].month}`
      };
    }
    
    // Último fallback: tasa por defecto
    return {
      period,
      rate: 1300, // ARS por USD - fallback histórico
      source: 'hardcoded_fallback'
    };
    
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // En caso de error, usar tasa por defecto
    return {
      period,
      rate: 1300, // ARS por USD
      source: 'error_fallback'
    };
  }
}

/**
 * Normaliza un ingreso a la moneda objetivo
 */
export async function normalizeIncomeTo(targetCurrency: CurrencyCode, income: IncomeRecord, rate?: ExchangeRate): Promise<number> {
  const sourceCurrency = income.currency?.toUpperCase() as CurrencyCode;
  
  // Si ya está en la moneda objetivo, devolverla directamente
  if (sourceCurrency === targetCurrency) {
    return income.amountLocal;
  }
  
  // Si tenemos el valor en USD y lo necesitamos
  if (targetCurrency === 'USD' && income.amountUsd) {
    return income.amountUsd;
  }
  
  // Si tenemos USD y necesitamos ARS
  if (sourceCurrency === 'USD' && targetCurrency === 'ARS') {
    const exchangeRate = rate || await getPeriodRate(`${income.month}_${income.year}`);
    return income.amountLocal * exchangeRate.rate;
  }
  
  // Si tenemos ARS y necesitamos USD
  if (sourceCurrency === 'ARS' && targetCurrency === 'USD') {
    const exchangeRate = rate || await getPeriodRate(`${income.month}_${income.year}`);
    return income.amountLocal / exchangeRate.rate;
  }
  
  // Por defecto, devolver el valor local
  return income.amountLocal;
}

/**
 * Normaliza un costo a la moneda objetivo
 * CORREGIDO: Los costos del Excel MAESTRO vienen en USD, necesitan conversión a ARS
 */
export async function normalizeCostTo(targetCurrency: CurrencyCode, cost: CostRecord, rate?: ExchangeRate): Promise<number> {
  // LÓGICA CORREGIDA: Detectar la moneda original del costo
  const hasUSDValue = cost.montoTotalUSD && cost.montoTotalUSD > 0;
  const isOriginallyUSD = hasUSDValue; // Los datos del Excel MAESTRO vienen en USD
  
  if (targetCurrency === 'ARS') {
    if (isOriginallyUSD) {
      // 🔧 CORRECCIÓN: Convertir USD a ARS
      const exchangeRate = rate || await getPeriodRate(`${cost.mes}_${cost.año}`);
      return cost.montoTotalUSD * exchangeRate.rate;
    } else {
      // Si está en ARS originalmente, usar costoTotal
      return cost.costoTotal;
    }
  }
  
  if (targetCurrency === 'USD') {
    if (hasUSDValue) {
      // Si tenemos valor USD, usarlo directamente
      return cost.montoTotalUSD;
    } else {
      // Convertir desde ARS a USD
      const exchangeRate = rate || await getPeriodRate(`${cost.mes}_${cost.año}`);
      return cost.costoTotal / exchangeRate.rate;
    }
  }
  
  // Por defecto, devolver el valor que tengamos
  return cost.montoTotalUSD || cost.costoTotal;
}

/**
 * Crea estructura de análisis normalizada para un proyecto
 */
export async function createAnalysisStructure(
  incomes: IncomeRecord[], 
  costs: CostRecord[], 
  analysisCurrency?: CurrencyCode
) {
  // Detectar moneda de análisis si no se especifica
  const currency = analysisCurrency || pickAnalysisCurrency(incomes);
  
  // Normalizar ingresos (async)
  const normalizedRevenue = await incomes.reduce(async (sumPromise, income) => {
    const sum = await sumPromise;
    const normalizedAmount = await normalizeIncomeTo(currency, income);
    return sum + normalizedAmount;
  }, Promise.resolve(0));
  
  // Normalizar costos (async)
  const normalizedCosts = await costs.reduce(async (sumPromise, cost) => {
    const sum = await sumPromise;
    const normalizedAmount = await normalizeCostTo(currency, cost);
    return sum + normalizedAmount;
  }, Promise.resolve(0));
  
  // Calcular métricas
  const margin = normalizedRevenue - normalizedCosts;
  const markup = normalizedCosts > 0 ? normalizedRevenue / normalizedCosts : 0;
  const roi = normalizedCosts > 0 ? (margin / normalizedCosts) * 100 : 0;
  
  return {
    currency,
    totals: {
      revenue: normalizedRevenue,
      costs: normalizedCosts,
      margin,
      markup,
      roi
    },
    metadata: {
      incomeRecords: incomes.length,
      costRecords: costs.length,
      hasUsdIncomes: incomes.some(i => i.currency?.toUpperCase() === 'USD'),
      hasArsIncomes: incomes.some(i => i.currency?.toUpperCase() === 'ARS'),
      hasMixedCurrencies: new Set(incomes.map(i => i.currency?.toUpperCase())).size > 1
    }
  };
}

/**
 * Formatea costos para mostrar en ambas monedas en la UI
 */
export async function formatCostsForDisplay(costs: CostRecord[]) {
  const formattedCosts = await Promise.all(
    costs.map(async (cost) => {
      const rate = await getPeriodRate(`${cost.mes}_${cost.año}`);
      return {
        ...cost,
        costoTotalARS: cost.costoTotal,
        costoTotalUSD: cost.montoTotalUSD || (cost.costoTotal / rate.rate),
        // Información adicional para la UI
        hasUsdValue: !!cost.montoTotalUSD,
        isConverted: !cost.montoTotalUSD,
        exchangeRateUsed: rate.rate,
        exchangeRateSource: rate.source
      };
    })
  );
  return formattedCosts;
}

/**
 * Convierte ingresos de Google Sheets a IncomeRecord
 * CORREGIDO: Usa sheet.amount para ARS y sheet.amountUsd para USD
 */
export function convertGoogleSheetsToIncome(sheets: any[]): IncomeRecord[] {
  if (!sheets || !Array.isArray(sheets)) return [];
  
  return sheets.map(sheet => {
    const currency = sheet.currency?.toUpperCase() || 'USD';
    
    // CORRECCIÓN CRÍTICA: Usar el campo correcto según la moneda
    let amountLocal: number;
    let amountUsd: number | undefined;
    
    if (currency === 'ARS') {
      // Para ARS: usar sheet.amountLocal como monto local (CORREGIDO)
      amountLocal = parseFloat(sheet.amountLocal || sheet.amount || 0);
      // Si hay amountUsd, usarlo como valor convertido
      amountUsd = sheet.amountUsd ? parseFloat(sheet.amountUsd) : undefined;
    } else {
      // Para USD: usar sheet.amountUsd como monto local y también como amountUsd
      amountLocal = parseFloat(sheet.amountUsd || sheet.amount || 0);
      amountUsd = parseFloat(sheet.amountUsd || sheet.amount || 0);
    }
    
    return {
      currency,
      amountLocal,
      amountUsd,
      month: sheet.month || '',
      year: parseInt(sheet.year || new Date().getFullYear())
    };
  });
}

/**
 * Convierte costos directos a CostRecord para análisis
 */
export function convertDirectCostsToCostRecord(directCosts: any[]): CostRecord[] {
  if (!directCosts || !Array.isArray(directCosts)) return [];
  
  return directCosts.map(cost => ({
    costoTotal: parseFloat(cost.costoTotal || 0),
    montoTotalUSD: cost.montoTotalUSD ? parseFloat(cost.montoTotalUSD) : undefined,
    mes: cost.mes || '',
    año: parseInt(cost.año || new Date().getFullYear())
  }));
}