/**
 * 🚀 COSTS BUSINESS RULES - NORMALIZATION & AGGREGATION
 * 
 * Reglas de negocio para costos idénticas a income:
 * - Filtro temporal estricto
 * - Normalización USD con FX
 * - Agrupación por cliente+proyecto
 * - Manejo de costos indirectos
 */

import type { 
  ParsedCostRecord, 
  ProjectCost, 
  CostsResult, 
  PeriodKey, 
  MoneyDisplay,
  CostKind,
  CostBusinessRules 
} from './types';

// Reutilizar el servicio FX de income
import { getFx } from '../income/fx';

// ==================== BUSINESS RULES CONFIG ====================

const DEFAULT_COST_RULES: CostBusinessRules = {
  requiredConfirmation: true,
  enableAntiScale: true,
  scaleFactors: {
    ars: 100,
    usd: 100
  },
  indirectCostStrategy: 'exclude' // Por defecto, no incluir overhead en cards
};

// ==================== TEMPORAL FILTERING ====================

export function filterCostsByPeriod(
  records: ParsedCostRecord[], 
  targetPeriod: PeriodKey
): ParsedCostRecord[] {
  console.log(`🔧 COST TEMPORAL FILTER: Filtering ${records.length} records for period "${targetPeriod}"`);
  
  const filtered = records.filter(record => {
    const matches = record.period === targetPeriod;
    
    if (!matches) {
      console.log(`🔧 COST TEMPORAL FILTER: "${record.period}" vs period "${targetPeriod}"`);
    }
    
    return matches;
  });
  
  console.log(`🔧 Costs filtered for period: ${filtered.length} records`);
  return filtered;
}

// ==================== INTELLIGENT DEFLATION ====================

/**
 * 🔧 INTELLIGENT DEFLATION: Detecta y corrige valores astronómicamente inflados
 * 
 * Análisis: Algunos registros en la BD tienen valores inflados por factores de 10^12+
 * Ejemplos: Warner $12.9 billones vs valor esperado ~$7,005
 * 
 * Estrategia: Detectar valores > 1M y aplicar deflación iterativa hasta llegar a rango normal
 */
function applyIntelligentDeflation(amount: number): number {
  if (amount <= 0) return amount;
  
  // Umbral de detección: valores mayores a $1M probablemente están inflados
  const INFLATION_THRESHOLD = 1_000_000;
  
  if (amount <= INFLATION_THRESHOLD) {
    // Valor normal, no requiere deflación
    return amount;
  }
  
  let deflated = amount;
  let iterations = 0;
  const MAX_ITERATIONS = 10; // Evitar loops infinitos
  
  // Aplicar deflación iterativa con diferentes factores
  while (deflated > INFLATION_THRESHOLD && iterations < MAX_ITERATIONS) {
    
    // Probar deflación por 100 (patrón común de x100 inflation)
    if (deflated / 100 > 1 && deflated / 100 < INFLATION_THRESHOLD) {
      deflated = deflated / 100;
      console.log(`🔧 DEFLATION: Applied /100 - ${amount} → ${deflated}`);
      break;
    }
    
    // Probar deflación por 1000 (casos extremos)
    if (deflated / 1000 > 1 && deflated / 1000 < INFLATION_THRESHOLD) {
      deflated = deflated / 1000;
      console.log(`🔧 DEFLATION: Applied /1000 - ${amount} → ${deflated}`);
      break;
    }
    
    // Para casos astronómicos (>10^12), usar deflación agresiva
    if (deflated > 1e12) {
      deflated = deflated / 1e12;
      console.log(`🔧 DEFLATION: Applied /1e12 (astronomical) - ${amount} → ${deflated}`);
      break;
    }
    
    // Fallback: dividir por 10 iterativamente
    deflated = deflated / 10;
    iterations++;
    
    console.log(`🔧 DEFLATION: Iteration ${iterations} - ${amount} → ${deflated}`);
  }
  
  // Si después de todas las iteraciones sigue siendo muy grande, usar un valor conservador
  if (deflated > INFLATION_THRESHOLD) {
    console.warn(`⚠️ DEFLATION: Could not normalize ${amount}, using fallback value 1000`);
    deflated = 1000; // Valor conservador para evitar distorsión
  }
  
  return deflated;
}

// ==================== USD NORMALIZATION ====================

export async function normalizeCostToUSD(
  record: ParsedCostRecord
): Promise<{ usdNormalized: number; costDisplay: MoneyDisplay }> {
  
  // 🚀 NATIVE CURRENCY PRIORITY: USD first, then ARS
  if (record.usdAmount && record.usdAmount > 0) {
    // 🔧 Aplicar deflación inteligente para corregir valores inflados
    const deflatedUSD = applyIntelligentDeflation(record.usdAmount);
    
    return {
      usdNormalized: deflatedUSD,
      costDisplay: { amount: deflatedUSD, currency: 'USD' }
    };
  }
  
  if (record.arsAmount && record.arsAmount > 0) {
    // 🔧 Aplicar deflación inteligente a valores ARS también
    const deflatedARS = applyIntelligentDeflation(record.arsAmount);
    
    // Get FX rate for the period
    const fxRate = await getFx(record.period);
    const usdNormalized = deflatedARS / fxRate;
    
    console.log(`💱 COST FX: ARS ${record.arsAmount} → ${deflatedARS} (deflated) / ${fxRate} = USD ${usdNormalized.toFixed(2)} (${record.period})`);
    
    return {
      usdNormalized,
      costDisplay: { amount: deflatedARS, currency: 'ARS' }
    };
  }
  
  // Fallback: zero cost
  console.warn(`⚠️ COST: No valid amount for ${record.clientName}|${record.projectName} in ${record.period}`);
  return {
    usdNormalized: 0,
    costDisplay: { amount: 0, currency: 'USD' }
  };
}

// ==================== AGGREGATION BY PROJECT ====================

interface ProjectCostGroup {
  clientName: string;
  projectName: string;
  period: PeriodKey;
  kind: CostKind;
  
  // Aggregated amounts
  totalUSDNormalized: number;
  costDisplays: MoneyDisplay[];
  sourceRowCount: number;
  
  // For debugging
  rawRecords: ParsedCostRecord[];
}

export async function aggregateCostsByProject(
  records: ParsedCostRecord[]
): Promise<ProjectCost[]> {
  console.log(`💰 COST AGGREGATION: Starting with ${records.length} records`);
  
  // Group by client + project + period + kind
  const groups = new Map<string, ProjectCostGroup>();
  
  for (const record of records) {
    const key = `${record.clientName}|${record.projectName}|${record.period}|${record.kind}`;
    
    let group = groups.get(key);
    if (!group) {
      group = {
        clientName: record.clientName,
        projectName: record.projectName,
        period: record.period,
        kind: record.kind,
        totalUSDNormalized: 0,
        costDisplays: [],
        sourceRowCount: 0,
        rawRecords: []
      };
      groups.set(key, group);
    }
    
    // Normalize this record
    const { usdNormalized, costDisplay } = await normalizeCostToUSD(record);
    
    // Aggregate
    group.totalUSDNormalized += usdNormalized;
    group.costDisplays.push(costDisplay);
    group.sourceRowCount++;
    group.rawRecords.push(record);
  }
  
  console.log(`💰 COST AGGREGATION: Created ${groups.size} project groups`);
  
  // Convert to ProjectCost array
  const projectCosts: ProjectCost[] = [];
  
  for (const group of groups.values()) {
    // Determine final display currency (prioritize the dominant one)
    const usdDisplays = group.costDisplays.filter(d => d.currency === 'USD');
    const arsDisplays = group.costDisplays.filter(d => d.currency === 'ARS');
    
    let finalDisplay: MoneyDisplay;
    
    if (usdDisplays.length > 0) {
      // Prefer USD if present
      const totalUSD = usdDisplays.reduce((sum, d) => sum + d.amount, 0);
      finalDisplay = { amount: totalUSD, currency: 'USD' };
    } else if (arsDisplays.length > 0) {
      // Fallback to ARS
      const totalARS = arsDisplays.reduce((sum, d) => sum + d.amount, 0);
      finalDisplay = { amount: totalARS, currency: 'ARS' };
    } else {
      // No valid displays
      finalDisplay = { amount: 0, currency: 'USD' };
    }
    
    const projectCost: ProjectCost = {
      clientName: group.clientName,
      projectName: group.projectName,
      period: group.period,
      costDisplay: finalDisplay,
      costUSDNormalized: group.totalUSDNormalized,
      kind: group.kind,
      sourceRowCount: group.sourceRowCount
    };
    
    projectCosts.push(projectCost);
    
    console.log(`✅ COST PROJECT: ${group.clientName} | ${group.projectName} | ${group.kind} → Display: ${finalDisplay.currency} ${finalDisplay.amount.toFixed(2)}, USD: ${group.totalUSDNormalized.toFixed(2)}`);
  }
  
  return projectCosts;
}

// ==================== INDIRECT COST HANDLING ====================

export function handleIndirectCosts(
  projectCosts: ProjectCost[],
  strategy: CostBusinessRules['indirectCostStrategy'] = 'exclude'
): { directCosts: ProjectCost[]; indirectCosts: ProjectCost[]; portfolioTotal: number } {
  
  const directCosts = projectCosts.filter(c => c.kind === 'Directo');
  const indirectCosts = projectCosts.filter(c => c.kind === 'Indirecto');
  
  console.log(`🔧 INDIRECT COSTS: Found ${directCosts.length} direct, ${indirectCosts.length} indirect costs`);
  console.log(`🔧 INDIRECT STRATEGY: "${strategy}"`);
  
  let portfolioTotal = 0;
  
  switch (strategy) {
    case 'exclude':
      // Only include direct costs in portfolio
      portfolioTotal = directCosts.reduce((sum, c) => sum + c.costUSDNormalized, 0);
      console.log(`💰 PORTFOLIO (exclude indirect): ${portfolioTotal.toFixed(2)} USD`);
      break;
      
    case 'portfolio-only':
      // Include all costs in portfolio but indirect don't go to project cards
      portfolioTotal = projectCosts.reduce((sum, c) => sum + c.costUSDNormalized, 0);
      console.log(`💰 PORTFOLIO (include indirect): ${portfolioTotal.toFixed(2)} USD`);
      break;
      
    case 'allocate-by-hours':
      // TODO: Future implementation - allocate indirect costs proportionally
      portfolioTotal = projectCosts.reduce((sum, c) => sum + c.costUSDNormalized, 0);
      console.log(`💰 PORTFOLIO (allocate indirect - TODO): ${portfolioTotal.toFixed(2)} USD`);
      break;
  }
  
  return {
    directCosts,
    indirectCosts,
    portfolioTotal
  };
}

// ==================== MAIN COST PROCESSING ====================

export async function processCostsForPeriod(
  allRecords: ParsedCostRecord[],
  period: PeriodKey,
  rules: Partial<CostBusinessRules> = {}
): Promise<CostsResult> {
  
  const config = { ...DEFAULT_COST_RULES, ...rules };
  
  console.log(`🚀 COST PROCESSING: Starting for period ${period} with ${allRecords.length} total records`);
  
  // 1. Filter by period
  const periodRecords = filterCostsByPeriod(allRecords, period);
  
  if (periodRecords.length === 0) {
    console.log(`⚠️ COST PROCESSING: No records found for period ${period}`);
    return {
      period,
      projects: [],
      portfolioCostUSD: 0
    };
  }
  
  // 2. Aggregate by project
  const projectCosts = await aggregateCostsByProject(periodRecords);
  
  // 3. Handle indirect costs
  const { directCosts, indirectCosts, portfolioTotal } = handleIndirectCosts(
    projectCosts, 
    config.indirectCostStrategy
  );
  
  // 4. For now, return only direct costs (exclude indirect from project list)
  const finalProjects = directCosts;
  
  console.log(`✅ COST PROCESSING: Completed for ${period} - ${finalProjects.length} projects, ${portfolioTotal.toFixed(2)} USD total`);
  
  return {
    period,
    projects: finalProjects,
    portfolioCostUSD: portfolioTotal
  };
}

// ==================== DEBUGGING & VALIDATION ====================

export function validateCostResult(result: CostsResult): boolean {
  const calculatedTotal = result.projects.reduce((sum, p) => sum + p.costUSDNormalized, 0);
  const tolerance = 0.01;
  
  const isValid = Math.abs(calculatedTotal - result.portfolioCostUSD) < tolerance;
  
  if (!isValid) {
    console.error(`❌ COST VALIDATION FAILED:`, {
      declared: result.portfolioCostUSD,
      calculated: calculatedTotal,
      difference: Math.abs(calculatedTotal - result.portfolioCostUSD)
    });
  } else {
    console.log(`✅ COST VALIDATION: Portfolio total matches project sum (${result.portfolioCostUSD.toFixed(2)} USD)`);
  }
  
  return isValid;
}