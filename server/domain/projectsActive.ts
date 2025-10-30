/**
 * UNIFIED BACKEND AGGREGATOR FOR "PROYECTOS ACTIVOS" PAGE
 * 
 * Implements the blueprint specification for a single source of truth:
 * - Single TimeFilter → ResolvedPeriod resolver
 * - Data from "Ventas Tomi" and "Costos directos e indirectos" (Excel MAESTRO)
 * - Merge by projectKey() normalization
 * - Exact formula calculations
 * - Portfolio summary by reduction (guarantees invariants)
 */

import { 
  TimeFilter, 
  ResolvedPeriod, 
  ProjectMetrics, 
  ProjectFlags, 
  PortfolioSummary,
  ActiveProjectItem,
  ActiveProjectsResponse,
  projectAliases
} from "@shared/schema";

import { resolvePeriod } from "@shared/utils/timePeriod";

import { parseMoneyUnified } from "../utils/money";
import { canon, generateProjectKey, generateCanonicalFields } from "../utils/normalize";
import { convertToUsd, extractPeriod } from "../utils/fx";
import { monthKeyFromSpanish } from "../services/dates";
import type { IStorage } from "../storage";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { CoverageCalculator } from "./coverage";
import { aggregateIncome, type DualNormalizedIncome } from "../services/sales";
import { aggregateFinancialProjects } from "./financial-aggregator";

// ==================== TIME FILTER RESOLVER ====================
// Unified resolver according to blueprint specification

/**
 * 🎯 UNIFIED TEMPORAL RESOLVER - Using shared architecture
 * @deprecated Use resolvePeriod directly from @shared/utils/timePeriod
 */
export function resolveTimeFilter(timeFilter: TimeFilter): ResolvedPeriod {
  console.log(`🎯 UNIFIED resolveTimeFilter: Processing ${JSON.stringify(timeFilter)}`);
  return resolvePeriod(timeFilter);
}

// ==================== CORE DATA STRUCTURES ====================

interface SalesRecord {
  clientCanon: string;
  projectCanon: string;
  projectKey: string;
  projectName: string;
  clientId: number;
  clientName: string;
  revenueUSD: number;
  month: string;
  year: number;
  confirmedOnly: boolean;
  // 🚀 NUEVOS CAMPOS DUALES - Plan Quirúrgico
  displayCurrency?: "ARS" | "USD";
  revenueDisplay?: number;
  revenueUSDNormalized?: number;
}

interface CostRecord {
  clientCanon: string;
  projectCanon: string;
  projectKey: string;
  projectName: string;
  costUSD: number;
  hoursReal: number;
  hoursTarget: number;
  month: string;
  year: number;
  // 🚀 DUAL CURRENCY FIELDS
  displayCurrency?: "ARS" | "USD";
  costDisplay?: number;
  costUSDNormalized?: number;
}

interface ProjectData {
  projectId: number;
  clientId: number;
  projectName: string;
  clientName: string;
  projectKey: string;
  sales: SalesRecord[];
  costs: CostRecord[];
  quotation?: any; // Include quotation data for project type mapping
}

// ==================== DATA AGGREGATION ENGINE ====================

export class ActiveProjectsAggregator {
  constructor(private storage: IStorage) {}

  /**
   * MAIN AGGREGATION METHOD - Single source of truth
   * Follows blueprint specification exactly
   */
  async getActiveProjectsUnified(timeFilter: TimeFilter, onlyActiveInPeriod: boolean = false): Promise<ActiveProjectsResponse> {
    console.log(`🚀 UNIFIED AGGREGATOR: Processing timeFilter=${JSON.stringify(timeFilter)}, onlyActiveInPeriod=${onlyActiveInPeriod}`);

    // 1. Resolve period - unified shared resolver
    const period = resolvePeriod(timeFilter);
    console.log(`📅 Period resolved: ${period.start} → ${period.end} (${period.label})`);

    // 2. Get base project list
    const allProjects = await this.storage.getActiveProjects();
    console.log(`📊 Base projects retrieved: ${allProjects.length}`);

    // 3. Get unified data from Excel MAESTRO sources
    const salesData = await this.getSalesInPeriod(period);
    const costsData = await this.getCostsInPeriod(period);
    console.log(`📊 Data retrieved: ${salesData.length} sales records, ${costsData.length} cost records`);

    // 4. Merge by projectId - bulletproof deduplication to avoid ARS/USD mixing
    const { projects: projectsData, orphanRows } = await this.mergeProjectData(allProjects, salesData, costsData);
    console.log(`📊 Projects merged: ${projectsData.length} with data, ${orphanRows} orphan rows (debug only)`);

    // 5. Calculate metrics for each project - exact formulas
    const projectItems = await this.calculateProjectMetrics(projectsData, period);
    console.log(`📊 Metrics calculated for ${projectItems.length} projects`);

    // 6. Filter by activity if requested
    const filteredProjects = onlyActiveInPeriod 
      ? projectItems.filter(p => p.flags.hasSales || p.flags.hasCosts || p.flags.hasHours)
      : projectItems;
    console.log(`📊 Final projects: ${filteredProjects.length} (filtered: ${onlyActiveInPeriod})`);

    // 7. Calculate portfolio summary by REDUCTION (guarantees invariants)
    const portfolioSummary = this.calculatePortfolioSummary(filteredProjects);
    console.log(`🔍 DEBUG PORTFOLIO SUMMARY:`, JSON.stringify(portfolioSummary, null, 2));

    // 8. Verify invariants according to blueprint
    this.verifyInvariants(filteredProjects, portfolioSummary);

    // 9. Calculate Excel MAESTRO coverage metrics for health monitoring
    let coverageMetrics = null;
    try {
      const coverageCalculator = new CoverageCalculator(this.storage);
      coverageMetrics = await coverageCalculator.calculateCoverage(timeFilter);
      console.log(`📊 COVERAGE: Integrated into aggregator response - ${(coverageMetrics.coverageRatio * 100).toFixed(1)}% coverage`);
    } catch (error) {
      console.error(`⚠️ COVERAGE: Error calculating coverage metrics for aggregator:`, error);
    }

    // Return structure according to user specification
    return {
      period: {
        start: period.start,
        end: period.end,
        label: period.label,
        // 🚀 DUAL-CURRENCY FIELDS AT PORTFOLIO LEVEL
        displayCurrency: portfolioSummary.displayCurrency,
        revenueDisplay: portfolioSummary.revenueDisplay
      },
      summary: {
        periodRevenueUSD: portfolioSummary.periodRevenueUSD,
        periodCostUSD: portfolioSummary.periodCostUSD,
        periodProfitUSD: portfolioSummary.periodProfitUSD,
        periodWorkedHours: portfolioSummary.periodWorkedHours,
        activeProjects: portfolioSummary.activeProjects,
        totalProjects: portfolioSummary.totalProjects,
        efficiencyFrac: portfolioSummary.efficiencyFrac,
        markupRatio: portfolioSummary.markupRatio
      },
      projects: filteredProjects
    };
  }

  /**
   * 🚀 FINANCIAL SOT: Get sales data from financial_sot (Rendimiento Cliente)
   * Single Source of Truth - Only shows data loaded in "Rendimiento Cliente" Google Sheets tab
   */
  private async getSalesInPeriod(period: ResolvedPeriod): Promise<SalesRecord[]> {
    console.log(`🚀 FINANCIAL SOT: Using financial_sot for period ${period.start} → ${period.end}`);
    
    try {
      // Convert period to monthKey format (YYYY-MM)
      const monthKey = period.start.substring(0, 7); // "2025-08-01" → "2025-08"
      console.log(`🎯 FINANCIAL SOT: Requesting data for period "${monthKey}"`);
      
      // Get financial data from financial_sot (Rendimiento Cliente)
      const financialProjects = await aggregateFinancialProjects(monthKey);
      console.log(`🎯 FINANCIAL SOT: Retrieved ${financialProjects.length} projects`);
      
      // Convert to SalesRecord format for compatibility
      const filteredSales: SalesRecord[] = [];
      
      for (const project of financialProjects) {
        // Generate canonical fields for ETL consistency
        const canonicalFields = generateCanonicalFields(project.clientName, project.projectName);
        
        const salesRecord: SalesRecord & {
          displayCurrency?: "ARS" | "USD";
          revenueDisplay?: number;
          revenueUSDNormalized?: number;
        } = {
          clientCanon: canonicalFields.clientCanon,
          projectCanon: canonicalFields.projectCanon,
          projectKey: canonicalFields.projectKey,
          projectName: project.projectName,
          clientId: 0, // Will be resolved later in merge
          clientName: project.clientName,
          revenueUSD: project.metrics.revenueUSDNormalized,
          month: monthKey.substring(5, 7),   // Extract month from period
          year: parseInt(monthKey.substring(0, 4)), // Extract year from period
          confirmedOnly: true, // All records from financial_sot are confirmed
          
          // 🚀 DUAL CURRENCY: Native currency display + USD normalized
          displayCurrency: project.currencyNative,
          revenueDisplay: project.metrics.revenueDisplay,
          revenueUSDNormalized: project.metrics.revenueUSDNormalized
        };
        
        filteredSales.push(salesRecord);
        
        console.log(`💰 FINANCIAL SOT RECORD: ${project.clientName}|${project.projectName} → Display: ${project.currencyNative} ${project.metrics.revenueDisplay}, USD: ${project.metrics.revenueUSDNormalized}`);
      }

      console.log(`💰 FINANCIAL SOT: ${filteredSales.length} records from Rendimiento Cliente`);
      return filteredSales;
      
    } catch (error) {
      console.error(`❌ FINANCIAL SOT ERROR in getSalesInPeriod:`, error);
      console.error(`❌ FINANCIAL SOT ERROR stack:`, error instanceof Error ? error.stack : 'No stack trace');
      return []; // Return empty array on error
    }
  }

  /**
   * 🚀 FINANCIAL SOT: Get costs data from financial_sot (Rendimiento Cliente)
   * Single Source of Truth - Uses same data source as sales
   */
  private async getCostsInPeriod(period: ResolvedPeriod): Promise<CostRecord[]> {
    console.log(`🚀 FINANCIAL SOT COSTS: Using financial_sot for period ${period.start} → ${period.end}`);
    
    try {
      // Convert period to monthKey format (YYYY-MM)
      const monthKey = period.start.substring(0, 7); // "2025-08-01" → "2025-08"
      console.log(`🎯 FINANCIAL SOT COSTS: Requesting data for period "${monthKey}"`);
      
      // Get financial data from financial_sot (Rendimiento Cliente) - same source as sales
      const financialProjects = await aggregateFinancialProjects(monthKey);
      console.log(`🎯 FINANCIAL SOT COSTS: Retrieved ${financialProjects.length} projects`);
      
      // Convert to CostRecord format for compatibility
      const filteredCosts: CostRecord[] = [];
      
      for (const project of financialProjects) {
        // Generate canonical fields for ETL consistency
        const canonicalFields = generateCanonicalFields(project.clientName, project.projectName);
        
        const costRecord: CostRecord = {
          clientCanon: canonicalFields.clientCanon,
          projectCanon: canonicalFields.projectCanon,
          projectKey: canonicalFields.projectKey,
          projectName: project.projectName,
          costUSD: project.metrics.costUSDNormalized,
          hoursReal: 0, // Hours not tracked in financial_sot
          hoursTarget: 0, // Hours not tracked in financial_sot
          month: monthKey.substring(5, 7),   // Extract month from period
          year: parseInt(monthKey.substring(0, 4)), // Extract year from period
          
          // 🚀 DUAL CURRENCY: Native currency display + USD normalized
          displayCurrency: project.currencyNative,
          costDisplay: project.metrics.costDisplay,
          costUSDNormalized: project.metrics.costUSDNormalized
        };
        
        filteredCosts.push(costRecord);
        
        console.log(`💰 FINANCIAL SOT COST RECORD: ${project.clientName}|${project.projectName} → Display: ${project.currencyNative} ${project.metrics.costDisplay}, USD: ${project.metrics.costUSDNormalized}`);
      }

      console.log(`💰 FINANCIAL SOT COSTS: ${filteredCosts.length} records from Rendimiento Cliente`);
      return filteredCosts;
      
    } catch (error) {
      console.error(`❌ FINANCIAL SOT COSTS ERROR in getCostsInPeriod:`, error);
      console.error(`❌ FINANCIAL SOT COSTS ERROR stack:`, error instanceof Error ? error.stack : 'No stack trace');
      return []; // Return empty array on error
    }
  }

  /**
   * Merge project data by canonical key "cliente|proyecto" (blueprint end-to-end)
   * Groups everything by normalized cliente|proyecto to eliminate duplicates and misattributions
   */
  private async mergeProjectData(allProjects: any[], salesData: SalesRecord[], costsData: CostRecord[]): Promise<{ projects: ProjectData[], orphanRows: number }> {
    const projectsMap = new Map<string, ProjectData>();
    let orphanCount = 0;

    console.log(`🔧 BULLETPROOF DEDUPLICATION: Starting with ${allProjects.length} catalog projects`);

    // Create canonical key mapping from projects catalog
    const projectIdToCanonicalKey = new Map<number, string>();
    
    for (const project of allProjects) {
      // DEBUG: Check what data we actually have
      console.log(`🔧 DEBUG PROJECT: id=${project.id}, name=${project.name}, quotation.projectName=${project.quotation?.projectName}`);
      
      // Use quotation.projectName as the actual project name (not project.name which is NULL)
      const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
      // Get client name from quotation.client (correct structure from storage)
      const clientName = project.quotation?.client?.name || '';
      console.log(`🔧 DEBUG CLIENT: projectId=${project.id}, clientName="${clientName}", quotation.client=${JSON.stringify(project.quotation?.client)}`);
      
      // Generate canonical fields for ETL consistency
      const canonicalFields = generateCanonicalFields(clientName, actualProjectName);
      projectIdToCanonicalKey.set(project.id, canonicalFields.projectKey);
      
      projectsMap.set(canonicalFields.projectKey, {
        projectId: project.id,
        clientId: project.clientId || 0,
        projectName: actualProjectName,
        clientName: clientName,
        projectKey: canonicalFields.projectKey,
        sales: [],
        costs: [],
        quotation: project.quotation // Include quotation for project type mapping
      });
    }

    // Map sales data: canonical key first, alias fallback (hybrid approach)
    console.log(`💰 Mapping ${salesData.length} sales records with hybrid approach...`);
    for (const sale of salesData) {
      const canonicalKey = generateProjectKey(sale.clientName, sale.projectName);
      let projectData = projectsMap.get(canonicalKey);
      let mappingMethod = "exact";
      
      // If exact canonical key fails, try alias fallback
      if (!projectData) {
        const projectId = await this.resolveProjectIdFromName(sale.projectName, sale.clientName, allProjects);
        if (projectId && projectIdToCanonicalKey.has(projectId)) {
          const aliasCanonicalKey = projectIdToCanonicalKey.get(projectId);
          projectData = projectsMap.get(aliasCanonicalKey!);
          mappingMethod = "alias";
        }
      }
      
      if (projectData) {
        projectData.sales.push(sale);
        console.log(`✅ Mapped sale "${sale.clientName}|${sale.projectName}" → key "${canonicalKey}" (${mappingMethod})`);
      } else {
        orphanCount++;
        console.log(`⚠️ ORPHAN SALE: "${canonicalKey}" - no matching key found`);
      }
    }

    // Map costs data: use projectKey from Costs SoT for exact matching
    console.log(`🔧 Mapping ${costsData.length} cost records using projectKey...`);
    for (const cost of costsData) {
      // Use the projectKey that comes from Costs SoT (already normalized and includes client+project)
      const costProjectKey = cost.projectKey;
      let projectData = projectsMap.get(costProjectKey);
      let mappingMethod = "exact";
      
      // If exact projectKey fails, try alias fallback (for legacy compatibility)
      if (!projectData) {
        // Extract client and project from projectKey for alias lookup
        // projectKey format: "clientCanon|projectCanon"
        const parts = costProjectKey.split('|');
        const clientPart = parts[0] || '';
        const projectPart = parts[1] || cost.projectName;
        
        const projectId = await this.resolveProjectIdFromName(projectPart, clientPart, allProjects);
        if (projectId && projectIdToCanonicalKey.has(projectId)) {
          const aliasCanonicalKey = projectIdToCanonicalKey.get(projectId);
          projectData = projectsMap.get(aliasCanonicalKey!);
          mappingMethod = "alias";
        }
      }
      
      if (projectData) {
        projectData.costs.push(cost);
        console.log(`✅ Mapped cost "${cost.projectKey}" → project "${projectData.projectName}" (${mappingMethod})`);
      } else {
        orphanCount++;
        console.log(`⚠️ ORPHAN COST: "${cost.projectKey}" - no matching project found`);
      }
    }

    console.log(`🔧 BULLETPROOF DEDUPLICATION: Completed with ${orphanCount} orphan rows`);
    
    return { 
      projects: Array.from(projectsMap.values()),
      orphanRows: orphanCount
    };
  }

  /**
   * Resolve Excel project name to catalog projectId
   * NEW: Uses explicit project_aliases first, then falls back to fuzzy matching
   */
  private async resolveProjectIdFromName(
    projectName: string, 
    clientName: string, 
    catalogProjects: any[]
  ): Promise<number | null> {
    if (!projectName) return null;
    
    try {
      // 1. FIRST: Try explicit alias lookup (bulletproof)
      const alias = await db
        .select()
        .from(projectAliases)
        .where(
          and(
            eq(projectAliases.excelProject, projectName),
            eq(projectAliases.excelClient, clientName || ''),
            eq(projectAliases.isActive, true)
          )
        )
        .limit(1);
      
      if (alias.length > 0) {
        const projectId = alias[0].projectId;
        
        // Update match statistics
        await db
          .update(projectAliases)
          .set({
            lastMatchedAt: new Date(),
            matchCount: alias[0].matchCount + 1
          })
          .where(eq(projectAliases.id, alias[0].id));
        
        console.log(`✅ ALIAS MATCH: "${clientName}" + "${projectName}" → projectId ${projectId} (confidence: ${alias[0].confidence})`);
        return projectId;
      }
      
      // 2. FALLBACK: Fuzzy matching with canonical normalization
      const targetKey = canon(projectName);
      
      // Try exact fuzzy match
      for (const project of catalogProjects) {
        const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
        const catalogKey = canon(actualProjectName);
        if (catalogKey === targetKey) {
          console.log(`✅ FUZZY EXACT: "${projectName}" → "${actualProjectName}" (projectId ${project.id})`);
          
          // Register successful match as alias candidate
          await this.registerAliasCandidate(clientName, projectName, project.id, 1.0, 'exact');
          return project.id;
        }
      }
      
      // Try partial fuzzy match
      for (const project of catalogProjects) {
        const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
        const catalogKey = canon(actualProjectName);
        if (catalogKey.includes(targetKey) || targetKey.includes(catalogKey)) {
          console.log(`🔍 FUZZY PARTIAL: "${projectName}" → "${actualProjectName}" (projectId ${project.id})`);
          
          // Register successful match as alias candidate
          await this.registerAliasCandidate(clientName, projectName, project.id, 0.8, 'partial');
          return project.id;
        }
      }
      
      return null; // No match found - will be tracked as orphan
      
    } catch (error) {
      console.error(`❌ Error resolving project ID for "${clientName}" + "${projectName}":`, error);
      return null;
    }
  }
  
  /**
   * Register successful fuzzy match as alias candidate for future use
   */
  private async registerAliasCandidate(
    clientName: string, 
    projectName: string, 
    projectId: number, 
    confidence: number,
    matchType: 'exact' | 'partial'
  ): Promise<void> {
    try {
      // Check if alias already exists
      const existing = await db
        .select()
        .from(projectAliases)
        .where(
          and(
            eq(projectAliases.excelProject, projectName),
            eq(projectAliases.excelClient, clientName || ''),
            eq(projectAliases.projectId, projectId)
          )
        )
        .limit(1);
      
      if (existing.length === 0) {
        // Create new alias candidate
        await db.insert(projectAliases).values({
          projectId,
          excelClient: clientName || '',
          excelProject: projectName,
          source: 'auto_detected',
          confidence,
          isActive: true,
          notes: `Auto-detected from ${matchType} fuzzy match`,
          matchCount: 1,
          lastMatchedAt: new Date()
        });
        
        console.log(`📝 NEW ALIAS: Created "${clientName}" + "${projectName}" → ${projectId} (${matchType}, confidence: ${confidence})`);
      }
    } catch (error) {
      console.error(`❌ Error registering alias candidate:`, error);
    }
  }

  /**
   * Calculate metrics for each project using exact formulas from blueprint
   */
  private async calculateProjectMetrics(projectsData: ProjectData[], period: ResolvedPeriod): Promise<ActiveProjectItem[]> {
    const projectItems: ActiveProjectItem[] = [];
    
    console.log(`🚀 CALCULATE METRICS: Starting with ${projectsData.length} projects`);

    for (const projectData of projectsData) {
      console.log(`🔍 PROCESSING PROJECT: ${projectData.projectName} with ${projectData.sales.length} sales`);
      // Calculate aggregated metrics - USING USD NORMALIZED FOR DUAL CURRENCY
      const revenueUSDNormalized = projectData.sales.reduce((sum, sale) => sum + (sale.revenueUSDNormalized || sale.revenueUSD), 0);
      const revenueUSD = revenueUSDNormalized; // Backward compatibility
      const costUSDNormalized = projectData.costs.reduce((sum, cost) => sum + (cost.costUSDNormalized || cost.costUSD), 0);
      const costUSD = costUSDNormalized; // Backward compatibility
      const workedHours = projectData.costs.reduce((sum, cost) => sum + cost.hoursReal, 0);
      const targetHours = projectData.costs.reduce((sum, cost) => sum + cost.hoursTarget, 0);

      // Calculate derived metrics - USING USD NORMALIZED (PLAN QUIRÚRGICO)
      const profitUSD = (revenueUSDNormalized ?? 0) - (costUSD ?? 0);
      const markupRatio = costUSD > 0 ? (revenueUSDNormalized / costUSD) : null; // show as "×"
      const marginFrac = revenueUSDNormalized > 0 ? (profitUSD / revenueUSDNormalized) : null; // 0..1
      const efficiencyFrac = targetHours > 0 ? (workedHours / targetHours) : null; // 0..1

      // Sanity guards and warnings (blueprint end-to-end validation)
      if (markupRatio && markupRatio > 20) {
        console.warn(`⚠️ SANITY: High markup ${markupRatio.toFixed(2)}× for project "${projectData.projectName}"`);
      }
      if (revenueUSDNormalized > 1000000) {
        console.warn(`⚠️ SANITY: Large revenue $${revenueUSDNormalized.toLocaleString()} for project "${projectData.projectName}"`);
      }
      if (Math.abs(costUSD - revenueUSDNormalized) > revenueUSDNormalized * 0.9 && revenueUSDNormalized > 0) {
        console.warn(`⚠️ SANITY: Cost/Revenue mismatch for project "${projectData.projectName}": cost=$${costUSD}, revenue=$${revenueUSDNormalized}`);
      }

      // Calculate flags - USING USD NORMALIZED
      const flags: ProjectFlags = {
        hasSales: (revenueUSDNormalized ?? 0) > 0,
        hasCosts: (costUSD ?? 0) > 0,
        hasHours: (workedHours ?? 0) > 0
      };

      // 🚀 EXTRACT DUAL CURRENCY FIELDS from sales
      let displayCurrency: "ARS" | "USD" | null = null;
      let revenueDisplay = 0;
      
      console.log(`🔍 DUAL EXTRACTION: Project "${projectData.projectName}" has ${projectData.sales.length} sales`);
      
      // Aggregate display values from dual sales records
      for (const sale of projectData.sales) {
        console.log(`🔍 DUAL SALE: displayCurrency=${sale.displayCurrency}, revenueDisplay=${sale.revenueDisplay}`);
        if (sale.displayCurrency && sale.revenueDisplay !== undefined) {
          if (!displayCurrency) {
            displayCurrency = sale.displayCurrency; // Use first currency found
          }
          revenueDisplay += sale.revenueDisplay;
        }
      }
      
      console.log(`🚀 DUAL RESULT: Project "${projectData.projectName}" → displayCurrency=${displayCurrency}, revenueDisplay=${revenueDisplay}`);

      // 🚀 EXTRACT DUAL CURRENCY FIELDS from costs
      let costDisplayCurrency: "ARS" | "USD" | null = null;
      let costDisplayAmount = 0;
      
      console.log(`🔍 DUAL COST EXTRACTION: Project "${projectData.projectName}" has ${projectData.costs.length} costs`);
      
      // Aggregate display values from dual cost records
      for (const cost of projectData.costs) {
        console.log(`🔍 DUAL COST: displayCurrency=${cost.displayCurrency}, costDisplay=${cost.costDisplay}`);
        if (cost.displayCurrency && cost.costDisplay !== undefined) {
          if (!costDisplayCurrency) {
            costDisplayCurrency = cost.displayCurrency; // Use first currency found
          }
          costDisplayAmount += cost.costDisplay;
        }
      }
      
      console.log(`🚀 DUAL COST RESULT: Project "${projectData.projectName}" → costDisplayCurrency=${costDisplayCurrency}, costDisplayAmount=${costDisplayAmount}`);

      // Build metrics object - WITH DUAL CURRENCY SUPPORT (user suggestions implemented)
      const metrics: ProjectMetrics = {
        revenueUSD: revenueUSDNormalized, // For backward compatibility
        revenueUSDNormalized,            // 🚀 Use THIS for all calculations
        costUSD,
        costUSDNormalized,               // 🚀 Use THIS for all calculations
        profitUSD,
        markupRatio,
        marginFrac,
        workedHours,
        targetHours,
        efficiencyFrac,
        // 🚀 STRUCTURED DISPLAY following user suggestions
        revenueDisplay: displayCurrency ? { amount: revenueDisplay, currency: displayCurrency } : undefined,
        costDisplay: costDisplayCurrency ? { amount: costDisplayAmount, currency: costDisplayCurrency } : undefined
      };

      // Get client info
      const client = await this.storage.getClient(projectData.clientId);

      const quotationType = projectData.quotation?.projectType;
      const projectName = projectData.projectName;
      console.log(`🔍 DEBUG: About to map - quotationType="${quotationType}", projectName="${projectName}"`);
      
      const mappedType = this.mapProjectType(quotationType, projectName);
      console.log(`📋 Project "${projectName}": quotation=${!!projectData.quotation}, type mapped to="${mappedType}"`);
      
      // Calculate optional metadata for intelligent visibility
      const projectTypeLabel: 'Fee' | 'Puntual' | undefined = 
        mappedType === 'fee' ? 'Fee' : 
        mappedType === 'one-shot' ? 'Puntual' : 
        undefined;

      // Calculate last activity month from sales and costs
      const activityMonths: string[] = [];
      for (const sale of projectData.sales) {
        const monthKey = `${sale.year}-${String(sale.month).padStart(2, '0')}`;
        if (!activityMonths.includes(monthKey)) activityMonths.push(monthKey);
      }
      for (const cost of projectData.costs) {
        const monthKey = `${cost.year}-${String(cost.month).padStart(2, '0')}`;
        if (!activityMonths.includes(monthKey)) activityMonths.push(monthKey);
      }
      activityMonths.sort();
      const lastActivity = activityMonths.length > 0 ? activityMonths[activityMonths.length - 1] : undefined;

      // For puntual projects, calculate date range from quotation if available
      const startMonthKey = projectData.quotation?.startDate 
        ? projectData.quotation.startDate.substring(0, 7) 
        : activityMonths[0];
      const endMonthKey = projectData.quotation?.endDate 
        ? projectData.quotation.endDate.substring(0, 7) 
        : undefined;
      
      // Determine if finished (inactive status or explicitly marked)
      const isFinished = projectData.quotation?.status === 'completed' || false;
      
      // Determine if one-shot project
      const isOneShot = quotationType === 'one-time' || mappedType === 'one-shot';
      
      // Calculate lifetime metrics for one-shot projects
      let lifetimeRevenueUSD: number | undefined;
      let lifetimeCostUSD: number | undefined;
      let revenuePeriod: string | undefined;
      
      if (isOneShot) {
        try {
          const { factRCMonth, factLaborMonth } = await import('../../shared/schema');
          const { eq, gt, or } = await import('drizzle-orm');
          const db = this.storage['db']; // Access db instance from storage
          
          // Get all revenue records for this project
          const revenueRecords = await db.select({
            periodKey: factRCMonth.periodKey,
            revenueUsd: factRCMonth.revenueUsd
          })
          .from(factRCMonth)
          .where(eq(factRCMonth.projectId, projectData.projectId));
          
          lifetimeRevenueUSD = revenueRecords.reduce((sum, r) => sum + (Number(r.revenueUsd) || 0), 0);
          
          // Find period with revenue
          const revenueRecord = revenueRecords.find(r => Number(r.revenueUsd) > 0);
          revenuePeriod = revenueRecord?.periodKey || undefined;
          
          // Get all cost records for this project
          const costRecords = await db.select({
            costUsd: factLaborMonth.costUsd
          })
          .from(factLaborMonth)
          .where(eq(factLaborMonth.projectId, projectData.projectId));
          
          lifetimeCostUSD = costRecords.reduce((sum, c) => sum + (Number(c.costUsd) || 0), 0);
          
          console.log(`🎯 ONE-SHOT LIFETIME: Project ${projectData.projectId} → Revenue: $${lifetimeRevenueUSD}, Cost: $${lifetimeCostUSD}, Period: ${revenuePeriod}`);
        } catch (error) {
          console.error(`❌ Error calculating lifetime metrics for project ${projectData.projectId}:`, error);
        }
      }

      projectItems.push({
        projectId: projectData.projectId,
        clientId: projectData.clientId,
        name: projectData.projectName,
        type: mappedType,
        status: 'active', // Could be enhanced with actual status
        client: {
          id: projectData.clientId,
          name: projectData.clientName || client?.name || 'Unknown',
          logo: client?.logoUrl || null
        },
        metrics,
        // Map metrics to top-level fields for frontend compatibility - USD NORMALIZED
        revenue: revenueUSDNormalized,
        cost: costUSD,
        profit: profitUSD,
        periodRevenueUSD: revenueUSDNormalized,
        periodCostUSD: costUSD,
        periodProfitUSD: profitUSD,
        flags,
        // 🚀 ENHANCED PERIOD with dual currency fields
        period: {
          ...period,
          displayCurrency,
          revenueDisplay
        },
        // Optional metadata for intelligent visibility
        projectType: projectTypeLabel,
        isOneShot,
        lifetimeRevenueUSD,
        lifetimeCostUSD,
        revenuePeriod,
        startMonthKey,
        endMonthKey,
        lastActivity,
        isFinished,
        supportsRollup: true,  // All projects support rollup queries
        allowFinish: !isFinished  // Can mark as finished if not already finished
      });
      
      // 🔍 DEBUG: Verificar objeto period ANTES del return
      if (projectData.clientName?.toLowerCase().includes('coelsa')) {
        console.log(`🔍 COELSA DEBUG: About to return project with period:`, JSON.stringify({
          ...period,
          displayCurrency,
          revenueDisplay
        }, null, 2));
      }
    }

    return projectItems;
  }

  /**
   * Calculate portfolio summary by REDUCTION of project metrics
   * This guarantees mathematical invariants according to blueprint
   */
  private calculatePortfolioSummary(projects: ActiveProjectItem[]): PortfolioSummary {
    console.log(`📊 Calculating portfolio summary for ${projects.length} projects`);

    // 🚀 DUAL-CURRENCY AGGREGATION: Collect portfolio display currency and revenue
    const currencyMap = new Map<string, number>(); // currency → total display revenue
    let portfolioRevenueDisplay = 0;
    let portfolioDisplayCurrency: "ARS" | "USD" | null = null;

    const summary = projects.reduce((acc, project) => {
      // Standard USD metrics aggregation
      const updatedAcc = {
        totalProjects: acc.totalProjects + 1,
        activeProjects: acc.activeProjects + (project.flags.hasSales || project.flags.hasCosts || project.flags.hasHours ? 1 : 0),
        periodRevenueUSD: acc.periodRevenueUSD + project.metrics.revenueUSDNormalized,
        periodCostUSD: acc.periodCostUSD + project.metrics.costUSD,
        periodProfitUSD: acc.periodProfitUSD + project.metrics.profitUSD,
        periodWorkedHours: acc.periodWorkedHours + project.metrics.workedHours
      };

      // 🚀 DUAL-CURRENCY: Aggregate display currency and revenue (using metrics.revenueDisplay per user suggestions)
      if (project.metrics.revenueDisplay && project.metrics.revenueDisplay.amount > 0) {
        const currency = project.metrics.revenueDisplay.currency;
        const currentTotal = currencyMap.get(currency) || 0;
        currencyMap.set(currency, currentTotal + project.metrics.revenueDisplay.amount);
      }

      return updatedAcc;
    }, {
      totalProjects: 0,
      activeProjects: 0,
      periodRevenueUSD: 0,
      periodCostUSD: 0,
      periodProfitUSD: 0,
      periodWorkedHours: 0
    });

    // 🚀 DETERMINE PORTFOLIO DISPLAY CURRENCY: Use majority or USD fallback
    if (currencyMap.size === 1) {
      // All projects use same currency → use that currency
      const firstEntry = currencyMap.entries().next().value;
      if (firstEntry) {
        const [currency, amount] = firstEntry;
        portfolioDisplayCurrency = currency as "ARS" | "USD";
        portfolioRevenueDisplay = amount;
      }
    } else if (currencyMap.size > 1) {
      // Mixed currencies → find the largest by revenue volume
      let maxAmount = 0;
      for (const [currency, amount] of currencyMap.entries()) {
        if (amount > maxAmount) {
          maxAmount = amount;
          portfolioDisplayCurrency = currency as "ARS" | "USD";
          portfolioRevenueDisplay = amount;
        }
      }
      console.log(`📊 MIXED CURRENCIES DETECTED: ${currencyMap.size} currencies, using dominant ${portfolioDisplayCurrency} (${portfolioRevenueDisplay})`);
    }

    // Calculate aggregate ratios
    const efficiencyFrac = null; // Portfolio-level efficiency needs different calculation
    const markupRatio = summary.periodCostUSD > 0 ? summary.periodRevenueUSD / summary.periodCostUSD : null;

    return {
      ...summary,
      efficiencyFrac,
      markupRatio,
      // 🚀 NEW DUAL-CURRENCY FIELDS
      displayCurrency: portfolioDisplayCurrency,
      revenueDisplay: portfolioRevenueDisplay
    };
  }

  /**
   * Map quotation.projectType to API contract type with fallback inference
   */
  private mapProjectType(quotationProjectType?: string, projectName?: string): 'fee' | 'one-shot' | 'other' {
    console.log(`🔍 MAPPING PROJECT TYPE: quotation="${quotationProjectType}", project="${projectName}"`);
    
    // Primary mapping from quotation.projectType
    if (quotationProjectType) {
      // Recurrente/Fee types
      if (quotationProjectType === 'fee-mensual' || 
          quotationProjectType === 'always-on' ||
          quotationProjectType === 'recurring') {
        console.log(`✅ Mapped "${quotationProjectType}" → 'fee' (recurrente from quotation)`);
        return 'fee';
      }
      
      // One-shot types
      if (quotationProjectType === 'one-shot' || 
          quotationProjectType === 'One Shot' ||
          quotationProjectType === 'one-time') {
        console.log(`✅ Mapped "${quotationProjectType}" → 'one-shot' (from quotation)`);
        return 'one-shot';
      }
      
      console.log(`⚠️ Unknown quotation.projectType "${quotationProjectType}" - falling back to name inference`);
    }
    
    // BULLETPROOF FALLBACK: Infer from project name for Excel-only projects
    if (projectName) {
      const nameLower = projectName.toLowerCase();
      
      // Infer recurrente if name contains "fee", "mensual", "monthly", "recurrent"
      if (nameLower.includes('fee') || 
          nameLower.includes('mensual') ||
          nameLower.includes('monthly') ||
          nameLower.includes('recurrent')) {
        console.log(`✅ FALLBACK: Inferred "${projectName}" → 'fee' (recurrente from name)`);
        return 'fee';
      }
      
      // Infer one-shot if name contains "one-shot", "project", "campaign"
      if (nameLower.includes('one-shot') ||
          nameLower.includes('project') ||
          nameLower.includes('campaign')) {
        console.log(`✅ FALLBACK: Inferred "${projectName}" → 'one-shot' (from name)`);
        return 'one-shot';
      }
    }
    
    // Default to other if no inference possible
    console.log(`⚠️ No inference possible - defaulting to 'other'`);
    return 'other';
  }

  /**
   * Verify mathematical invariants according to blueprint
   * Ensures Σ projects.metrics.revenueUSD === summary.portfolio.periodRevenueUSD
   */
  private verifyInvariants(projects: ActiveProjectItem[], portfolio: PortfolioSummary): void {
    const projectRevenueSum = projects.reduce((sum, p) => sum + p.metrics.revenueUSD, 0);
    const projectHoursSum = projects.reduce((sum, p) => sum + p.metrics.workedHours, 0);
    
    const revenueDiff = Math.abs(projectRevenueSum - portfolio.periodRevenueUSD);
    const hoursDiff = Math.abs(projectHoursSum - portfolio.periodWorkedHours);
    
    console.log(`🔍 INVARIANT CHECK:`);
    console.log(`   Project Revenue Sum: $${projectRevenueSum.toFixed(2)}`);
    console.log(`   Portfolio Revenue:   $${portfolio.periodRevenueUSD.toFixed(2)}`);
    console.log(`   Difference:          $${revenueDiff.toFixed(2)}`);
    console.log(`   Hours Sum:           ${projectHoursSum.toFixed(2)}h`);
    console.log(`   Portfolio Hours:     ${portfolio.periodWorkedHours.toFixed(2)}h`);
    console.log(`   Hours Difference:    ${hoursDiff.toFixed(2)}h`);

    // Allow small rounding differences (< $1 USD, < 0.1 hours)
    if (revenueDiff > 1.0) {
      console.error(`❌ REVENUE INVARIANT VIOLATION: Difference of $${revenueDiff.toFixed(2)} exceeds tolerance`);
    }
    if (hoursDiff > 0.1) {
      console.error(`❌ HOURS INVARIANT VIOLATION: Difference of ${hoursDiff.toFixed(2)}h exceeds tolerance`);
    }
    
    if (revenueDiff <= 1.0 && hoursDiff <= 0.1) {
      console.log(`✅ INVARIANTS VERIFIED: All sums match within tolerance`);
    }
  }

  /**
   * Build canonical key "cliente|proyecto" normalized (blueprint end-to-end)
   */
  private buildCanonicalKey(clientName: string, projectName: string): string {
    const normalizedClient = this.normalizeText(clientName);
    const normalizedProject = this.normalizeText(projectName);
    return `${normalizedClient}|${normalizedProject}`;
  }

  /**
   * Normalize text for consistent matching (blueprint NFKD)
   */
  private normalizeText(text: string): string {
    return (text || '').trim().toLowerCase().normalize('NFKD');
  }
}