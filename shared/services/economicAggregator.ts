/**
 * Economic Aggregator Universal - Motor único de agregación económica
 * Centraliza lógica: ingresos/costos/margen según plan
 */

import { resolveFX } from './fxResolver.js';

export interface IncomeRecord {
  id: number;
  period: string; // "yyyy-mm"
  amountUSD?: number;
  amountARS?: number;
  currency: 'USD' | 'ARS';
  type: 'fee' | 'oneshot';
  status: 'completada' | 'activa' | 'proyectada';
  confirmed: boolean;
}

export interface CostRecord {
  id: number;
  period: string; // "yyyy-mm"
  persona: string;
  horasReales: number; // L
  valorHoraARS: number;
  costARS?: number;
  costUSD?: number;
  projectId: string;
}

export interface EconomicAggregation {
  period: string;
  ingresos: {
    totalUSD: number;
    totalARS: number;
    currency: 'USD' | 'ARS'; // Moneda principal análisis
    byType: { [type: string]: { count: number; usd: number; ars: number } };
  };
  costos: {
    totalUSD: number;
    totalARS: number;
    currency: 'USD' | 'ARS'; // Moneda principal análisis
    byPerson: { [persona: string]: { horas: number; usd: number; ars: number } };
  };
  margen: {
    marginUSD: number; // ingresos_usd - costos_usd
    marginARS: number; // ingresos_ars - costos_ars
    markup: number;    // ingresos_usd / costos_usd
    roi: number;       // (margin_usd / costos_usd) * 100
  };
  fx: {
    period: string;
    rate: number;
    source: string;
  };
}

/**
 * Agregador económico universal según plan
 * @param incomes - Array de ingresos del período
 * @param costs - Array de costos del período  
 * @param period - Período "yyyy-mm"
 * @param projectId - ID proyecto para FX específico
 */
export async function aggregateEconomics(
  incomes: IncomeRecord[],
  costs: CostRecord[],
  period: string,
  projectId?: string
): Promise<EconomicAggregation> {
  
  console.log(`💰 AGGREGATOR: Processing ${incomes.length} incomes, ${costs.length} costs for ${period}`);

  // 1. Resolver FX único para el período
  const fxRate = await resolveFX(period, projectId);

  // 2. Agregar ingresos
  const ingresosAgg = await aggregateIncomes(incomes, fxRate);
  
  // 3. Agregar costos
  const costosAgg = await aggregateCosts(costs, fxRate);

  // 4. Calcular margen/ROI/markup
  const margenAgg = calculateMargins(ingresosAgg, costosAgg);

  // 5. Determinar moneda principal de análisis
  const analysisCurrency = determineAnalysisCurrency(incomes, costs);

  const result: EconomicAggregation = {
    period,
    ingresos: { ...ingresosAgg, currency: analysisCurrency },
    costos: { ...costosAgg, currency: analysisCurrency },
    margen: margenAgg,
    fx: {
      period: fxRate.period,
      rate: fxRate.usdToArs,
      source: fxRate.source
    }
  };

  console.log(`💰 AGGREGATOR Result: Ingresos=${ingresosAgg.totalUSD} USD, Costos=${costosAgg.totalUSD} USD, Markup=${margenAgg.markup.toFixed(2)}`);
  return result;
}

/**
 * Agregar ingresos con normalización USD/ARS
 */
async function aggregateIncomes(incomes: IncomeRecord[], fxRate: any) {
  let totalUSD = 0;
  let totalARS = 0;
  const byType: { [type: string]: { count: number; usd: number; ars: number } } = {};

  for (const income of incomes) {
    let ingresoUSD = 0;
    let ingresoARS = 0;

    // Lógica de normalización según plan
    if (income.amountUSD && income.amountUSD > 0) {
      // Si Monto_USD>0: ingreso_usd = Monto_USD; ingreso_ars = Monto_USD * FX(periodo)
      ingresoUSD = income.amountUSD;
      ingresoARS = income.amountUSD * fxRate.usdToArs;
    } else if (income.amountARS && income.amountARS > 0) {
      // Si Monto_USD=0 y Monto_ARS>0: ingreso_ars = Monto_ARS; ingreso_usd = Monto_ARS / FX(periodo)
      ingresoARS = income.amountARS;
      ingresoUSD = income.amountARS / fxRate.usdToArs;
    }

    totalUSD += ingresoUSD;
    totalARS += ingresoARS;

    // Agregar por tipo
    const type = income.type || 'fee';
    if (!byType[type]) {
      byType[type] = { count: 0, usd: 0, ars: 0 };
    }
    byType[type].count++;
    byType[type].usd += ingresoUSD;
    byType[type].ars += ingresoARS;
  }

  return { totalUSD, totalARS, byType };
}

/**
 * Agregar costos con normalización USD/ARS
 */
async function aggregateCosts(costs: CostRecord[], fxRate: any) {
  let totalUSD = 0;
  let totalARS = 0;
  const byPerson: { [persona: string]: { horas: number; usd: number; ars: number } } = {};

  for (const cost of costs) {
    // Lógica de cálculo según plan: costo_ars = L * Valor_Hora_ARS
    const costoARS = cost.horasReales * cost.valorHoraARS;
    const costoUSD = costoARS / fxRate.usdToArs;

    totalUSD += costoUSD;
    totalARS += costoARS;

    // Agregar por persona
    const persona = cost.persona;
    if (!byPerson[persona]) {
      byPerson[persona] = { horas: 0, usd: 0, ars: 0 };
    }
    byPerson[persona].horas += cost.horasReales;
    byPerson[persona].usd += costoUSD;
    byPerson[persona].ars += costoARS;
  }

  return { totalUSD, totalARS, byPerson };
}

/**
 * Calcular márgenes según plan
 */
function calculateMargins(ingresos: any, costos: any) {
  const marginUSD = ingresos.totalUSD - costos.totalUSD;
  const marginARS = ingresos.totalARS - costos.totalARS;
  
  // markup = ingresos_usd / costos_usd (según plan)
  const markup = costos.totalUSD > 0 ? ingresos.totalUSD / costos.totalUSD : 0;
  
  // roi = (margin_usd / costos_usd) * 100
  const roi = costos.totalUSD > 0 ? (marginUSD / costos.totalUSD) * 100 : 0;

  return { marginUSD, marginARS, markup, roi };
}

/**
 * Determinar moneda principal de análisis
 */
function determineAnalysisCurrency(incomes: IncomeRecord[], costs: CostRecord[]): 'USD' | 'ARS' {
  const usdIncomes = incomes.filter(i => i.currency === 'USD').length;
  const arsIncomes = incomes.filter(i => i.currency === 'ARS').length;
  
  // Si mayoría de ingresos en USD, usar USD; sino ARS
  return usdIncomes >= arsIncomes ? 'USD' : 'ARS';
}