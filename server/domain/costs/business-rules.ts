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

// TCG (Temporal Consistency Guard) para detección de anomalías
import { temporalGuard, AnomalyDecision } from './temporal-guard';
import { getCostData } from './data-access';

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

// ==================== TEMPORAL ANOMALY DETECTION ====================

/**
 * Obtiene historial de costos USD normalizados para un proyecto
 * Lookback: hasta 6 meses anteriores
 */
async function getProjectCostHistory(
  clientName: string,
  projectName: string,
  currentPeriod: PeriodKey
): Promise<number[]> {
  try {
    const allRecords = await getCostData();
    const projectKey = `${clientName}|${projectName}`.toLowerCase();
    
    const history: number[] = [];
    const [year, month] = currentPeriod.split('-').map(Number);
    
    for (let i = 1; i <= 6; i++) {
      let lookbackMonth = month - i;
      let lookbackYear = year;
      
      if (lookbackMonth <= 0) {
        lookbackMonth += 12;
        lookbackYear -= 1;
      }
      
      const lookbackPeriod = `${lookbackYear}-${String(lookbackMonth).padStart(2, '0')}` as PeriodKey;
      
      const periodRecords = allRecords.filter(r => {
        const matchesProject = `${r.clientName}|${r.projectName}`.toLowerCase() === projectKey;
        const matchesPeriod = r.period === lookbackPeriod;
        return matchesProject && matchesPeriod;
      });
      
      if (periodRecords.length > 0) {
        let totalUSD = 0;
        for (const record of periodRecords) {
          const { usdNormalized } = await normalizeCostToUSD(record);
          totalUSD += usdNormalized;
        }
        history.push(totalUSD);
      }
    }
    
    return history;
  } catch (error) {
    console.warn(`⚠️ TCG: Could not get history for ${clientName}|${projectName}:`, error);
    return [];
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
  
  // TCG anomaly detection
  anomalyDecision?: AnomalyDecision;
}

export async function aggregateCostsByProject(
  records: ParsedCostRecord[],
  projectCurrencyMap?: Map<string, 'USD' | 'ARS'>
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
    // 🛡️ TEMPORAL CONSISTENCY GUARD (TCG): Detectar y corregir anomalías temporales
    const projectKey = `${group.clientName}|${group.projectName}`;
    const history = await getProjectCostHistory(group.clientName, group.projectName, group.period);
    
    const fx = await getFx(group.period);
    const arsDisplays = group.costDisplays.filter(d => d.currency === 'ARS');
    const totalARS = arsDisplays.reduce((sum, d) => sum + d.amount, 0);
    const nativeCurrency = totalARS > 0 ? 'ARS' : 'USD';
    const costNative = nativeCurrency === 'ARS' ? totalARS : group.totalUSDNormalized;
    
    const anomalyDecision = temporalGuard({
      projectKey,
      monthKey: group.period,
      nativeCurrency,
      costNative,
      fx,
      montoUSDFromOrigin: nativeCurrency === 'USD' ? group.totalUSDNormalized : null,
      historyUSDNormalized: history
    });
    
    // Aplicar corrección si hay anomalía y autocorrect activado
    let finalUSDNormalized = group.totalUSDNormalized;
    let flags: string[] = [];
    
    if (anomalyDecision.isAnomaly && anomalyDecision.fixedUSD) {
      finalUSDNormalized = anomalyDecision.fixedUSD;
      flags = anomalyDecision.flags;
      console.log(`🔧 TCG AUTOCORRECT: ${projectKey} ${group.period} - ${group.totalUSDNormalized.toFixed(0)} → ${finalUSDNormalized.toFixed(0)} USD`);
    }
    
    group.anomalyDecision = anomalyDecision;
    
    // 🎯 NEW: Determine display currency based on Income SoT revenueDisplay.currency
    const revenueDisplayCurrency = projectCurrencyMap?.get(projectKey) || 'ARS'; // Default to ARS
    
    let finalDisplay: MoneyDisplay;
    
    if (revenueDisplayCurrency === 'USD') {
      // Project revenue is USD → show cost in USD (normalized)
      finalDisplay = { amount: finalUSDNormalized, currency: 'USD' };
      console.log(`💱 COST DISPLAY: ${projectKey} → USD (revenue is USD) = ${finalUSDNormalized.toFixed(2)}`);
    } else {
      // Project revenue is ARS → show cost in ARS (reconstituted from fixed USD)
      const fixedARS = nativeCurrency === 'ARS' && anomalyDecision.fixedUSD 
        ? Math.round(anomalyDecision.fixedUSD * fx)
        : totalARS;
      finalDisplay = { amount: fixedARS, currency: 'ARS' };
      console.log(`💱 COST DISPLAY: ${projectKey} → ARS (revenue is ARS) = ${fixedARS.toFixed(2)}`);
    }
    
    const projectCost: ProjectCost = {
      clientName: group.clientName,
      projectName: group.projectName,
      period: group.period,
      costDisplay: finalDisplay,
      costUSDNormalized: finalUSDNormalized,
      kind: group.kind,
      sourceRowCount: group.sourceRowCount,
      anomaly: anomalyDecision.isAnomaly ? {
        detected: true,
        ratio: anomalyDecision.ratio,
        baselineUSD: anomalyDecision.baselineUSD ?? undefined,
        originalUSD: group.totalUSDNormalized,
        fixedUSD: anomalyDecision.fixedUSD ?? undefined,
        reason: anomalyDecision.reason,
        flags: anomalyDecision.flags
      } : undefined
    };
    
    projectCosts.push(projectCost);
    
    const flagsStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    console.log(`✅ COST PROJECT: ${group.clientName} | ${group.projectName} | ${group.kind} → Display: ${finalDisplay.currency} ${finalDisplay.amount.toFixed(2)}, USD: ${finalUSDNormalized.toFixed(2)}${flagsStr}`);
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
  rules: Partial<CostBusinessRules> = {},
  projectCurrencyMap?: Map<string, 'USD' | 'ARS'>
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
  
  // 2. Aggregate by project (with currency display info from Income SoT)
  const projectCosts = await aggregateCostsByProject(periodRecords, projectCurrencyMap);
  
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