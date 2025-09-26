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

// ==================== NO DEFLATION FOR COSTS ====================
// Costos usan valores RAW de la base de datos - sin anti-scale ni deflación

// ==================== USD NORMALIZATION ====================

export async function normalizeCostToUSD(
  record: ParsedCostRecord
): Promise<{ usdNormalized: number; costDisplay: MoneyDisplay }> {
  
  // 🎯 PLAN EXACTO: Moneda & anticorrupción USD (costos)
  const fx = await getFx(record.period); // 1345 en 2025-08
  
  const usdRaw = record.usdAmount;
  const arsRaw = record.arsAmount;
  
  const usdFromArs = (arsRaw !== null && isFinite(arsRaw)) ? arsRaw / fx : null;
  
  // 1) Si USD es astronómico o > 100k, IGNORAR USD y usar ARS/fx
  const usdLooksCorrupt = 
    !usdRaw ||
    !isFinite(usdRaw) ||
    usdRaw > 100_000 ||
    (usdFromArs && isFinite(usdRaw) && Math.abs(usdRaw - usdFromArs) / Math.max(usdRaw, usdFromArs) > 0.35);
  
  if (!usdLooksCorrupt && isFinite(usdRaw) && usdRaw > 0) {
    console.log(`💰 COST USD NATIVE: ${usdRaw} USD (valid USD amount)`);
    return {
      usdNormalized: usdRaw,
      costDisplay: { amount: usdRaw, currency: 'USD' }
    };
  } else if (arsRaw !== null && isFinite(arsRaw) && arsRaw > 0) {
    if (usdRaw && usdRaw > 100_000) {
      console.log(`⚠️ COST USD CORRUPTED: ${usdRaw} USD (too high, using ARS instead)`);
    }
    
    const usdNormalized = arsRaw / fx;
    console.log(`💱 COST FX: ARS ${arsRaw} / ${fx} = USD ${usdNormalized.toFixed(2)} (${record.period})`);
    
    return {
      usdNormalized,
      costDisplay: { amount: arsRaw, currency: 'ARS' }
    };
  } else {
    // skip("no valid amounts") según plan
    console.warn(`⚠️ COST: No valid amount for ${record.clientName}|${record.projectName} in ${record.period}`);
    return {
      usdNormalized: 0,
      costDisplay: { amount: 0, currency: 'USD' }
    };
  }
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