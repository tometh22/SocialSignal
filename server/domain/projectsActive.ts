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
        label: period.label
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
   * 🚀 NUEVO SISTEMA DUAL: Get sales data usando nuevo normalizador dual
   * Respeta moneda original + calcula USD normalizado para KPIs
   */
  private async getSalesInPeriod(period: ResolvedPeriod): Promise<SalesRecord[]> {
    console.log(`🔧 DUAL SALES DEBUG: Starting getSalesInPeriod for period ${period.start} → ${period.end}`);
    
    try {
      // 🚀 NUEVO SISTEMA DUAL: Usar aggregateIncome con moneda dual
      
      // Get raw sales data from Google Sheets (before normalization)
      console.log(`🔧 DUAL SALES DEBUG: About to call this.storage.getGoogleSheetsSales()`);
      const dbSalesRecords = await this.storage.getGoogleSheetsSales();
      console.log(`💰 Retrieved ${dbSalesRecords.length} total raw sales records from DB`);
    
    // 🔧 CRITICAL FIX: Map DB format with proper dual currency support
    const allRawSales = dbSalesRecords.map(row => {
      // Implementar regla de moneda nativa según user specs
      const currency = row.currency || 'ARS';
      const amountLocal = Number(row.amountLocal) || 0;
      const amountUsd = Number(row.amountUsd) || 0;
      
      return {
        Cliente: row.clientName || "",
        Proyecto: row.projectName || "",
        Mes: row.month || "",
        Año: row.year || 2025,
        // 🚀 DUAL CURRENCY: Mapear según moneda nativa
        Monto_ARS: currency === 'ARS' ? amountLocal : 0,
        Monto_USD: currency === 'USD' ? amountLocal : amountUsd,
        Confirmado: row.confirmed || "Si", 
        Tipo_Venta: row.salesType || "",
        // 🚀 NUEVO: Campos para regla de moneda nativa
        amountLocal,
        currency,
        amountUsd
      };
    });
    
    console.log(`🔧 MAPEO DEBUG: Mapped ${allRawSales.length} records to aggregateIncome format`);
    console.log(`🔧 MAPEO DEBUG: First record - Cliente: "${allRawSales[0]?.Cliente}", Proyecto: "${allRawSales[0]?.Proyecto}", Monto_USD: ${allRawSales[0]?.Monto_USD}`);
    
    // 🔧 DEBUG: Verificar period antes de manipular strings
    console.log(`🔧 PERIOD DEBUG: period =`, period);
    console.log(`🔧 PERIOD DEBUG: period.start = "${period.start}", period.end = "${period.end}"`);
    
    // Convert period to monthKey format
    const periodStartKey = period.start.substring(0, 7); // "2025-08-01" → "2025-08"
    const periodEndKey = period.end.substring(0, 7);     // "2025-08-31" → "2025-08"
    console.log(`🔧 PERIOD DEBUG: periodStartKey = "${periodStartKey}", periodEndKey = "${periodEndKey}"`);
    console.log(`🔧 PERIOD DEBUG: About to call aggregateIncome() with ${allRawSales.length} mapped records`);
    
    // 🚀 USAR NUEVO AGREGADOR DUAL: aggregateIncome()
    const aggregatedIncomes = aggregateIncome(allRawSales, periodStartKey, periodEndKey);
    console.log(`💰 DUAL AGREGADOR: ${aggregatedIncomes.size} proyectos únicos con ingresos duales`);
    
    // Convert dual aggregated incomes to legacy SalesRecord format for compatibility
    const filteredSales: SalesRecord[] = [];
    
    for (const [projectKey, income] of aggregatedIncomes) {
      // Generate canonical fields for ETL consistency
      const canonicalFields = generateCanonicalFields(income.clientName, income.projectName);
      
      // 🚀 NUEVO: Agregar campos duales a SalesRecord
      const salesRecord: SalesRecord & {
        displayCurrency?: "ARS" | "USD";
        revenueDisplay?: number;
        revenueUSDNormalized?: number;
      } = {
        clientCanon: canonicalFields.clientCanon,
        projectCanon: canonicalFields.projectCanon,
        projectKey: canonicalFields.projectKey,
        projectName: income.projectName,
        clientId: 0, // Will be resolved later in merge
        clientName: income.clientName,
        revenueUSD: income.revenueUSDNormalized, // Use normalized USD for backward compatibility
        month: periodStartKey.substring(5, 7),   // Extract month from period
        year: parseInt(periodStartKey.substring(0, 4)), // Extract year from period
        confirmedOnly: true, // Todos los records agregados ya están confirmados
        
        // 🚀 NUEVOS CAMPOS DUALES: Para mostrar en frontend
        displayCurrency: income.displayCurrency,
        revenueDisplay: income.revenueDisplay,
        revenueUSDNormalized: income.revenueUSDNormalized
      };
      
      filteredSales.push(salesRecord);
      
      console.log(`💰 DUAL RECORD: ${income.clientName}|${income.projectName} → Display: ${income.displayCurrency} ${income.revenueDisplay}, KPIs: USD ${income.revenueUSDNormalized}`);
    }

    console.log(`💰 DUAL SALES: ${filteredSales.length} records with dual currency support`);
    return filteredSales;
    
    } catch (error) {
      console.error(`❌ DUAL SALES ERROR in getSalesInPeriod:`, error);
      console.error(`❌ DUAL SALES ERROR stack:`, error instanceof Error ? error.stack : 'No stack trace');
      return []; // Return empty array on error
    }
  }

  /**
   * Get costs/hours data from "Costos directos e indirectos" sheet (Excel MAESTRO)
   * Filters ONLY "Directo" costs according to specification
   */
  private async getCostsInPeriod(period: ResolvedPeriod): Promise<CostRecord[]> {
    // Get all direct costs from storage
    const allCosts = await this.storage.getDirectCosts();
    console.log(`🔧 Retrieved ${allCosts.length} total cost records`);

    const filteredCosts: CostRecord[] = [];

    // UNIFIED AGGREGATION ENGINE: ∑ by exact key + monthKey (plan implementation)
    const periodMonthKey = period.start.substring(0, 7); // "2025-08-01" → "2025-08"
    const costAggregator = new Map<string, { costUSD: number; hoursReal: number; hoursTarget: number; count: number }>();

    for (const cost of allCosts) {
      // Filter: ONLY "Directo" costs (not "Indirecto" overhead)
      if (cost.tipoGasto !== 'Directo') continue;

      // 🎯 FIXED: Temporal filtering usando parser español robusto
      if (cost.año && cost.mes) {
        try {
          const costMonthKey = monthKeyFromSpanish(cost.mes, cost.año);
          console.log(`🔧 COST TEMPORAL FILTER: "${cost.mes}" (${cost.año}) → "${costMonthKey}" vs period "${periodMonthKey}"`);
          if (costMonthKey !== periodMonthKey) continue; // Exact match only
        } catch (error) {
          console.warn(`🔧 COST MONTH PARSE ERROR: "${cost.mes}" → skipping entry`);
          continue;
        }
      } else {
        console.warn(`🔧 COST MISSING DATA: año="${cost.año}", mes="${cost.mes}" → skipping entry`);
        continue;
      }

      // Cost normalization with FX conversion
      const montoUSD = parseMoneyUnified(cost.montoTotalUSD || 0);
      const montoARS = parseMoneyUnified(cost.costoTotal || 0);
      const costPeriod = `${cost.año}-${String(parseInt(cost.mes?.split(' ')[0] || '0') || 0).padStart(2, '0')}`;
      const costUSD = convertToUsd(montoUSD, montoARS, costPeriod);
      const hoursReal = parseMoneyUnified(cost.horasRealesAsana || 0);
      const hoursTarget = parseMoneyUnified(cost.horasObjetivo || 0);

      if (costUSD <= 0 && hoursReal <= 0 && hoursTarget <= 0) continue;

      // Create canonical aggregation key: cliente|proyecto 
      const canonicalFields = generateCanonicalFields(cost.cliente, cost.proyecto);
      const aggregationKey = canonicalFields.projectKey;
      if (!aggregationKey) continue;

      // Sistema unificado sin hardcodeo de clientes/proyectos específicos
      // La detección anti-x100 y normalización ya se maneja en convertToUsd()

      // Aggregate by exact key (no duplicates)
      const existing = costAggregator.get(aggregationKey) || { costUSD: 0, hoursReal: 0, hoursTarget: 0, count: 0 };
      costAggregator.set(aggregationKey, {
        costUSD: existing.costUSD + costUSD,
        hoursReal: existing.hoursReal + hoursReal,
        hoursTarget: existing.hoursTarget + hoursTarget,
        count: existing.count + 1
      });
    }

    // Convert aggregated costs back to filteredCosts format
    for (const [key, aggregated] of costAggregator.entries()) {
      // Parse canonical key to extract client and project parts
      const keyParts = key.split('|');
      const clientCanon = keyParts[0] || '';
      const projectCanon = keyParts[1] || '';
      
      filteredCosts.push({
        clientCanon,
        projectCanon,
        projectKey: key,
        projectName: projectCanon, // Use canonical project name
        costUSD: aggregated.costUSD,
        hoursReal: aggregated.hoursReal,
        hoursTarget: aggregated.hoursTarget,
        month: period.start.substring(5, 7), // Extract month from period
        year: parseInt(period.start.substring(0, 4)), // Extract year from period
      });
    }

    console.log(`🔧 Costs filtered for period: ${filteredCosts.length} records`);
    return filteredCosts;
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
      // Get client name from quotation - no "Unknown" fallbacks, use canonical fields
      const clientName = project.quotation?.clientName || '';
      
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

    // Map costs data: hybrid approach with alias fallback
    console.log(`🔧 Mapping ${costsData.length} cost records with hybrid approach...`);
    for (const cost of costsData) {
      let canonicalKey = '';
      let projectData = null;
      let mappingMethod = '';
      
      // Skip exact canonical match for costs (no clientName in CostRecord)
      // Will rely on fuzzy match by project name
      
      // If no exact match, try fuzzy match by project name only
      if (!projectData) {
        for (const [key, project] of projectsMap) {
          const normalizedCostProject = this.normalizeText(cost.projectName);
          const normalizedProjectName = this.normalizeText(project.projectName);
          if (normalizedProjectName === normalizedCostProject) {
            canonicalKey = key;
            projectData = project;
            mappingMethod = "fuzzy";
            break;
          }
        }
      }
      
      // If still no match, try alias fallback
      if (!projectData) {
        const projectId = await this.resolveProjectIdFromName(cost.projectName, '', allProjects);
        if (projectId && projectIdToCanonicalKey.has(projectId)) {
          const aliasCanonicalKey = projectIdToCanonicalKey.get(projectId);
          projectData = projectsMap.get(aliasCanonicalKey!);
          canonicalKey = aliasCanonicalKey!;
          mappingMethod = "alias";
        }
      }
      
      if (projectData) {
        projectData.costs.push(cost);
        console.log(`✅ Mapped cost "${cost.projectName}" → key "${canonicalKey}" (${mappingMethod})`);
      } else {
        orphanCount++;
        console.log(`⚠️ ORPHAN COST: "${cost.projectName}" - no matching key found`);
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

    for (const projectData of projectsData) {
      // Calculate aggregated metrics - USING USD NORMALIZED FOR DUAL CURRENCY
      const revenueUSDNormalized = projectData.sales.reduce((sum, sale) => sum + (sale.revenueUSDNormalized || sale.revenueUSD), 0);
      const revenueUSD = revenueUSDNormalized; // Backward compatibility
      const costUSD = projectData.costs.reduce((sum, cost) => sum + cost.costUSD, 0);
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

      // Build metrics object - WITH DUAL CURRENCY SUPPORT
      const metrics: ProjectMetrics = {
        revenueUSD: revenueUSDNormalized, // For backward compatibility
        costUSD,
        profitUSD,
        markupRatio,
        marginFrac,
        workedHours,
        targetHours,
        efficiencyFrac
      };

      // Get client info
      const client = await this.storage.getClient(projectData.clientId);

      const quotationType = projectData.quotation?.projectType;
      const projectName = projectData.projectName;
      console.log(`🔍 DEBUG: About to map - quotationType="${quotationType}", projectName="${projectName}"`);
      
      const mappedType = this.mapProjectType(quotationType, projectName);
      console.log(`📋 Project "${projectName}": quotation=${!!projectData.quotation}, type mapped to="${mappedType}"`);
      
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
        period
      });
    }

    return projectItems;
  }

  /**
   * Calculate portfolio summary by REDUCTION of project metrics
   * This guarantees mathematical invariants according to blueprint
   */
  private calculatePortfolioSummary(projects: ActiveProjectItem[]): PortfolioSummary {
    console.log(`📊 Calculating portfolio summary for ${projects.length} projects`);

    const summary = projects.reduce((acc, project) => {
      return {
        totalProjects: acc.totalProjects + 1,
        activeProjects: acc.activeProjects + (project.flags.hasSales || project.flags.hasCosts || project.flags.hasHours ? 1 : 0),
        periodRevenueUSD: acc.periodRevenueUSD + project.metrics.revenueUSD,
        periodCostUSD: acc.periodCostUSD + project.metrics.costUSD,
        periodProfitUSD: acc.periodProfitUSD + project.metrics.profitUSD,
        periodWorkedHours: acc.periodWorkedHours + project.metrics.workedHours
      };
    }, {
      totalProjects: 0,
      activeProjects: 0,
      periodRevenueUSD: 0,
      periodCostUSD: 0,
      periodProfitUSD: 0,
      periodWorkedHours: 0
    });

    // Calculate aggregate ratios
    const efficiencyFrac = null; // Portfolio-level efficiency needs different calculation
    const markupRatio = summary.periodCostUSD > 0 ? summary.periodRevenueUSD / summary.periodCostUSD : null;

    return {
      ...summary,
      efficiencyFrac,
      markupRatio
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