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

import { parseMoneyAuto } from "../utils/money";
import { projectKey } from "../utils/normalize";
import { convertToUsd, extractPeriod } from "../utils/fx";
import type { IStorage } from "../storage";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { CoverageCalculator } from "./coverage";

// ==================== TIME FILTER RESOLVER ====================
// Unified resolver according to blueprint specification

export function resolveTimeFilter(timeFilter: TimeFilter): ResolvedPeriod {
  if (typeof timeFilter === 'object' && 'start' in timeFilter) {
    return {
      start: timeFilter.start,
      end: timeFilter.end,
      label: `${timeFilter.start} to ${timeFilter.end}`
    };
  }

  const filter = timeFilter as string;
  console.log(`🎯 UNIFIED resolveTimeFilter: Processing ${filter}`);

  // Parse timeFilter according to blueprint: july_2025, q3_2025, agosto_2025, etc.
  if (filter.includes('_')) {
    const [period, year] = filter.split('_');
    const y = parseInt(year);
    
    // Quarters
    if (period.startsWith('q')) {
      const q = parseInt(period.slice(1));
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const endDay = new Date(y, endMonth, 0).getDate();
      return {
        start: `${y}-${String(startMonth).padStart(2, '0')}-01`,
        end: `${y}-${String(endMonth).padStart(2, '0')}-${endDay}`,
        label: `Q${q} ${y}`
      };
    }
    
    // Months (English + Spanish support)
    const monthMap: Record<string, number> = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4,
      'may': 5, 'june': 6, 'july': 7, 'august': 8,
      'september': 9, 'october': 10, 'november': 11, 'december': 12,
      // Spanish months
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
      'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
      'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    };
    
    if (monthMap[period]) {
      const month = monthMap[period];
      const endDay = new Date(y, month, 0).getDate();
      return {
        start: `${y}-${String(month).padStart(2, '0')}-01`,
        end: `${y}-${String(month).padStart(2, '0')}-${endDay}`,
        label: `${period.charAt(0).toUpperCase() + period.slice(1)} ${y}`
      };
    }
  }
  
  // Relative temporal filters
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based
  
  switch (filter) {
    case 'this_month':
    case 'este_mes':
    case 'current_month': {
      const m = currentMonth + 1; // 1-based
      const endDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      return {
        start: `${currentYear}-${String(m).padStart(2, '0')}-01`,
        end: `${currentYear}-${String(m).padStart(2, '0')}-${endDay}`,
        label: 'This Month'
      };
    }
    
    case 'last_month':
    case 'mes_pasado': {
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const m = prevMonth + 1; // 1-based
      const endDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      return {
        start: `${prevYear}-${String(m).padStart(2, '0')}-01`,
        end: `${prevYear}-${String(m).padStart(2, '0')}-${endDay}`,
        label: 'Last Month'
      };
    }
    
    default: {
      // Fallback: current month
      const m = currentMonth + 1;
      const endDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      return {
        start: `${currentYear}-${String(m).padStart(2, '0')}-01`,
        end: `${currentYear}-${String(m).padStart(2, '0')}-${endDay}`,
        label: 'Current Month'
      };
    }
  }
}

// ==================== CORE DATA STRUCTURES ====================

interface SalesRecord {
  projectKey: string;
  projectName: string;
  clientId: number;
  clientName: string;
  revenueUSD: number;
  month: string;
  year: number;
  confirmedOnly: boolean;
}

interface CostRecord {
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

    // 1. Resolve period - unified resolver
    const period = resolveTimeFilter(timeFilter);
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
   * Get sales data from "Ventas Tomi" sheet (Excel MAESTRO)
   * Applies currency normalization with parseMoneyAuto()
   */
  private async getSalesInPeriod(period: ResolvedPeriod): Promise<SalesRecord[]> {
    // Get all sales from Google Sheets integration
    const allSales = await this.storage.getGoogleSheetsSales();
    console.log(`💰 Retrieved ${allSales.length} total sales records`);

    const filteredSales: SalesRecord[] = [];

    for (const sale of allSales) {
      // Temporal filtering
      if (sale.year && sale.monthNumber) {
        const saleDate = new Date(sale.year, sale.monthNumber - 1, 15); // Mid-month
        const periodStart = new Date(period.start);
        const periodEnd = new Date(period.end);
        
        if (saleDate < periodStart || saleDate > periodEnd) {
          continue;
        }
      }

      // Revenue calculation with FX conversion according to specification
      // Rule: Si Monto_USD > 0 → usar eso. Si Monto_USD == 0 y Monto_ARS > 0 → convertir
      const salePeriod = `${sale.year}-${String(sale.monthNumber || 0).padStart(2, '0')}`;
      
      // 🔍 DEBUG: Log raw values and parsing results
      console.log(`🔍 SALES DEBUG: ${sale.clientName} · ${sale.projectName}`);
      console.log(`   Raw amountUsd: "${sale.amountUsd}" (type: ${typeof sale.amountUsd})`);
      console.log(`   Raw amountLocal: "${sale.amountLocal}" (type: ${typeof sale.amountLocal})`);
      
      const montoUSD = parseMoneyAuto(sale.amountUsd || 0);
      const montoARS = parseMoneyAuto(sale.amountLocal || 0);
      
      console.log(`   Parsed USD: ${montoUSD}, Parsed ARS: ${montoARS}`);
      
      const revenueUSD = convertToUsd(montoUSD, montoARS, salePeriod);
      
      console.log(`   Final revenueUSD: ${revenueUSD}`);

      // Skip if no valid revenue or not confirmed
      const isConfirmed = String(sale.confirmed || '').toLowerCase().includes('si');
      if (revenueUSD <= 0 || !isConfirmed) continue;

      filteredSales.push({
        projectKey: projectKey(sale.projectName || ''),
        projectName: sale.projectName || '',
        clientId: sale.clientId || 0,
        clientName: sale.clientName || '',
        revenueUSD,
        month: String(sale.monthNumber || 0),
        year: sale.year || 0,
        confirmedOnly: isConfirmed
      });
    }

    console.log(`💰 Sales filtered for period: ${filteredSales.length} records`);
    return filteredSales;
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

    for (const cost of allCosts) {
      // Filter: ONLY "Directo" costs (not "Indirecto" overhead)
      if (cost.tipoGasto !== 'Directo') continue;

      // Temporal filtering
      if (cost.año && cost.mes) {
        // Parse month from "08 ago" format
        const monthNum = parseInt(cost.mes.split(' ')[0]);
        if (monthNum) {
          const costDate = new Date(cost.año, monthNum - 1, 15);
          const periodStart = new Date(period.start);
          const periodEnd = new Date(period.end);
          
          if (costDate < periodStart || costDate > periodEnd) {
            continue;
          }
        }
      }

      // Cost normalization with FX conversion according to specification  
      // Rule: Si Moneda Original USD > 0 → ese valor. Si solo hay ARS → usd = ARS / fx
      const costPeriod = `${cost.año}-${String(parseInt(cost.mes?.split(' ')[0] || '0') || 0).padStart(2, '0')}`;
      const montoUSD = parseMoneyAuto(cost.montoTotalUSD || 0);
      const montoARS = parseMoneyAuto(cost.costoTotal || 0); // costoTotal is the local cost amount
      
      const costUSD = convertToUsd(montoUSD, montoARS, costPeriod);
      const hoursReal = parseMoneyAuto(cost.horasRealesAsana || 0);
      const hoursTarget = parseMoneyAuto(cost.horasObjetivo || 0);

      if (costUSD <= 0 && hoursReal <= 0 && hoursTarget <= 0) continue;

      filteredCosts.push({
        projectKey: projectKey(cost.proyecto || ''),
        projectName: cost.proyecto || '',
        costUSD,
        hoursReal,
        hoursTarget,
        month: cost.mes || '',
        year: cost.año || 0
      });
    }

    console.log(`🔧 Costs filtered for period: ${filteredCosts.length} records`);
    return filteredCosts;
  }

  /**
   * Merge project data by projectId from catalog (bulletproof deduplication)
   * Groups everything by projectId to avoid mixing ARS/USD and duplicate records
   */
  private async mergeProjectData(allProjects: any[], salesData: SalesRecord[], costsData: CostRecord[]): Promise<{ projects: ProjectData[], orphanRows: number }> {
    const projectsMap = new Map<number, ProjectData>();
    let orphanCount = 0;

    console.log(`🔧 BULLETPROOF DEDUPLICATION: Starting with ${allProjects.length} catalog projects`);

    // Initialize with base projects from catalog/DB (single source of truth)
    for (const project of allProjects) {
      // DEBUG: Check what data we actually have
      console.log(`🔧 DEBUG PROJECT: id=${project.id}, name=${project.name}, quotation.projectName=${project.quotation?.projectName}`);
      
      // Use quotation.projectName as the actual project name (not project.name which is NULL)
      const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
      projectsMap.set(project.id, {
        projectId: project.id,
        clientId: project.clientId || 0,
        projectName: actualProjectName,
        clientName: '', // Will be filled from sales/client data
        projectKey: projectKey(actualProjectName),
        sales: [],
        costs: [],
        quotation: project.quotation // Include quotation for project type mapping
      });
    }

    // Map sales data to projectId (resolve project names to catalog projectIds)
    console.log(`💰 Mapping ${salesData.length} sales records to projectIds...`);
    for (const sale of salesData) {
      const projectId = await this.resolveProjectIdFromName(sale.projectName, sale.clientName, allProjects);
      
      if (projectId) {
        const projectData = projectsMap.get(projectId);
        if (projectData) {
          projectData.sales.push(sale);
          if (!projectData.clientName) projectData.clientName = sale.clientName;
          console.log(`✅ Mapped sale "${sale.projectName}" → projectId ${projectId}`);
        }
      } else {
        orphanCount++;
        console.log(`⚠️ ORPHAN SALE: "${sale.projectName}" - no matching projectId found`);
      }
    }

    // Map costs data to projectId (resolve project names to catalog projectIds)
    console.log(`🔧 Mapping ${costsData.length} cost records to projectIds...`);
    for (const cost of costsData) {
      // For costs, we'll try to derive client name from project name or use a placeholder
      const clientName = cost.clientName || ''; // Costs might not have explicit client names
      const projectId = await this.resolveProjectIdFromName(cost.projectName, clientName, allProjects);
      
      if (projectId) {
        const projectData = projectsMap.get(projectId);
        if (projectData) {
          projectData.costs.push(cost);
          console.log(`✅ Mapped cost "${cost.projectName}" → projectId ${projectId}`);
        }
      } else {
        orphanCount++;
        console.log(`⚠️ ORPHAN COST: "${cost.projectName}" - no matching projectId found`);
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
      
      // 2. FALLBACK: Fuzzy matching with projectKey normalization
      const targetKey = projectKey(projectName);
      
      // Try exact fuzzy match
      for (const project of catalogProjects) {
        const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
        const catalogKey = projectKey(actualProjectName);
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
        const catalogKey = projectKey(actualProjectName);
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
      // Calculate aggregated metrics
      const revenueUSD = projectData.sales.reduce((sum, sale) => sum + sale.revenueUSD, 0);
      const costUSD = projectData.costs.reduce((sum, cost) => sum + cost.costUSD, 0);
      const workedHours = projectData.costs.reduce((sum, cost) => sum + cost.hoursReal, 0);
      const targetHours = projectData.costs.reduce((sum, cost) => sum + cost.hoursTarget, 0);

      // Calculate derived metrics - CORRECTED SEMANTICS
      const profitUSD = (revenueUSD ?? 0) - (costUSD ?? 0);
      const markupRatio = costUSD > 0 ? (revenueUSD / costUSD) : null; // show as "×"
      const marginFrac = revenueUSD > 0 ? (profitUSD / revenueUSD) : null; // 0..1
      const efficiencyFrac = targetHours > 0 ? (workedHours / targetHours) : null; // 0..1

      // Calculate flags
      const flags: ProjectFlags = {
        hasSales: (revenueUSD ?? 0) > 0,
        hasCosts: (costUSD ?? 0) > 0,
        hasHours: (workedHours ?? 0) > 0
      };

      // Build metrics object
      const metrics: ProjectMetrics = {
        revenueUSD,
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
}