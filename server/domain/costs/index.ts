/**
 * 🚀 COSTS SOURCE OF TRUTH (SoT) - API PÚBLICA
 * 
 * API principal para el sistema de costos:
 * - GET /api/costs?period=YYYY-MM
 * - GET /api/projects/:id/costs?period=YYYY-MM  
 * - GET /api/portfolio/costs?period=YYYY-MM
 */

import type { 
  CostsResult, 
  ProjectCost, 
  PortfolioCostSummary, 
  PeriodKey 
} from './types';

import { getCostData, getCostDataForProject } from './data-access';
import { processCostsForPeriod } from './business-rules';

// ==================== PUBLIC API ====================

/**
 * Obtiene costos agregados por proyecto para un período
 */
export async function getCostsForPeriod(period: PeriodKey): Promise<CostsResult> {
  console.log(`🚀 COSTS SoT: Getting costs for period ${period}`);
  
  try {
    // Fetch all cost data
    const allCostRecords = await getCostData();
    
    // Process for the specific period
    const result = await processCostsForPeriod(allCostRecords, period);
    
    console.log(`✅ COSTS SoT: Returned ${result.projects.length} projects, total ${result.portfolioCostUSD.toFixed(2)} USD`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ COSTS SoT: Error getting costs for period ${period}:`, error);
    throw error;
  }
}

/**
 * Obtiene costos de un proyecto específico para un período
 */
export async function getCostsForProject(
  clientName: string, 
  projectName: string, 
  period: PeriodKey
): Promise<ProjectCost | null> {
  
  console.log(`🚀 COSTS SoT: Getting costs for project "${clientName}" - "${projectName}" in ${period}`);
  
  try {
    // Get all costs for the period
    const periodResult = await getCostsForPeriod(period);
    
    // Find the specific project
    const projectCost = periodResult.projects.find(p => 
      p.clientName.toLowerCase() === clientName.toLowerCase() &&
      p.projectName.toLowerCase() === projectName.toLowerCase()
    );
    
    if (projectCost) {
      console.log(`✅ COSTS SoT: Found project cost - ${projectCost.costDisplay.currency} ${projectCost.costDisplay.amount}`);
    } else {
      console.log(`⚠️ COSTS SoT: No costs found for project`);
    }
    
    return projectCost || null;
    
  } catch (error) {
    console.error(`❌ COSTS SoT: Error getting project costs:`, error);
    throw error;
  }
}

/**
 * Obtiene resumen de costos del portfolio para un período
 */
export async function getPortfolioCosts(period: PeriodKey): Promise<PortfolioCostSummary> {
  console.log(`🚀 COSTS SoT: Getting portfolio costs for ${period}`);
  
  try {
    const result = await getCostsForPeriod(period);
    
    const directCosts = result.projects.filter(p => p.kind === 'Directo');
    const indirectCosts = result.projects.filter(p => p.kind === 'Indirecto');
    
    const directCostsUSD = directCosts.reduce((sum, p) => sum + p.costUSDNormalized, 0);
    const indirectCostsUSD = indirectCosts.reduce((sum, p) => sum + p.costUSDNormalized, 0);
    
    const summary: PortfolioCostSummary = {
      period,
      portfolioCostUSD: result.portfolioCostUSD,
      directCostsUSD,
      indirectCostsUSD,
      projectCount: result.projects.length
    };
    
    console.log(`✅ COSTS SoT: Portfolio summary - Total: ${summary.portfolioCostUSD.toFixed(2)} USD, Projects: ${summary.projectCount}`);
    
    return summary;
    
  } catch (error) {
    console.error(`❌ COSTS SoT: Error getting portfolio costs:`, error);
    throw error;
  }
}

// ==================== INTEGRATION HELPERS ====================

/**
 * Integración con el agregador de proyectos activos
 * Retorna métricas de costo para un proyecto específico
 */
export async function getProjectCostMetrics(
  clientName: string,
  projectName: string,
  period: PeriodKey
): Promise<{ costDisplay: any; costUSDNormalized: number } | null> {
  
  const projectCost = await getCostsForProject(clientName, projectName, period);
  
  if (!projectCost) {
    return null;
  }
  
  return {
    costDisplay: projectCost.costDisplay,
    costUSDNormalized: projectCost.costUSDNormalized
  };
}

// ==================== DEBUGGING & UTILITIES ====================

/**
 * Debug: listar todos los proyectos con costos
 */
export async function debugAllProjectCosts(period: PeriodKey): Promise<void> {
  console.log(`🔍 COSTS DEBUG: Listing all project costs for ${period}`);
  
  try {
    const result = await getCostsForPeriod(period);
    
    console.log(`📊 COSTS DEBUG: Found ${result.projects.length} projects with costs:`);
    
    for (const project of result.projects) {
      console.log(`  • ${project.clientName} | ${project.projectName} | ${project.kind} → ${project.costDisplay.currency} ${project.costDisplay.amount.toFixed(2)} (USD ${project.costUSDNormalized.toFixed(2)})`);
    }
    
    console.log(`💰 Total Portfolio: ${result.portfolioCostUSD.toFixed(2)} USD`);
    
  } catch (error) {
    console.error('❌ COSTS DEBUG: Error:', error);
  }
}

/**
 * Validación rápida del sistema de costos
 */
export async function validateCostSystem(period: PeriodKey): Promise<boolean> {
  console.log(`🔍 COSTS VALIDATION: Testing system for ${period}`);
  
  try {
    // Test 1: Get period costs
    const periodResult = await getCostsForPeriod(period);
    console.log(`✅ Test 1: Period costs - ${periodResult.projects.length} projects`);
    
    // Test 2: Get portfolio costs
    const portfolioResult = await getPortfolioCosts(period);
    console.log(`✅ Test 2: Portfolio costs - ${portfolioResult.portfolioCostUSD.toFixed(2)} USD`);
    
    // Test 3: Validate totals match
    const calculatedTotal = periodResult.projects.reduce((sum, p) => sum + p.costUSDNormalized, 0);
    const tolerance = 0.01;
    const totalsMatch = Math.abs(calculatedTotal - portfolioResult.portfolioCostUSD) < tolerance;
    
    if (!totalsMatch) {
      console.error(`❌ Test 3: Totals mismatch - Period: ${calculatedTotal}, Portfolio: ${portfolioResult.portfolioCostUSD}`);
      return false;
    }
    
    console.log(`✅ Test 3: Totals match within tolerance`);
    
    console.log(`🎉 COSTS VALIDATION: All tests passed for ${period}`);
    return true;
    
  } catch (error) {
    console.error(`❌ COSTS VALIDATION: Failed for ${period}:`, error);
    return false;
  }
}