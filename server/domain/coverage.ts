/**
 * Excel MAESTRO Coverage Metrics Calculator
 * 
 * Calculates comprehensive data coverage metrics between Excel MAESTRO and project catalog.
 * Tracks mapping success, orphan rows, and period-specific coverage for health monitoring.
 */

import type { IStorage } from "../storage";
import { db } from "../db";
import { projectAliases } from "@shared/schema";
import { eq } from "drizzle-orm";

// ==================== COVERAGE METRICS TYPES ====================

export interface OrphanExample {
  clientName: string;
  projectName: string;
  period: string;
  recordType: 'sales' | 'costs';
  amount?: number;
}

export interface CoverageMetrics {
  // Catalog totals
  catalogTotal: number;
  catalogActiveProjects: number;
  
  // Excel MAESTRO totals 
  excelProjectsDistinct: number;
  excelClientsDistinct: number;
  excelRecordsTotal: number;
  
  // Mapping success metrics
  mappedProjects: number;
  aliasesActive: number;
  coverageRatio: number; // mappedProjects / catalogActiveProjects
  
  // Period-specific metrics
  periodProjectsWithActivity: number;
  periodCoverageRatio: number; // periodProjectsWithActivity / catalogActiveProjects
  
  // Quality metrics
  orphanRows: number;
  orphanExamples: OrphanExample[];
  
  // Metadata
  fxMonth: string; // Currency period used
  lastImportAt: Date | null;
  calculatedAt: Date;
}

// ==================== COVERAGE CALCULATOR ====================

export class CoverageCalculator {
  constructor(private storage: IStorage) {}
  
  /**
   * Calculate comprehensive coverage metrics
   */
  async calculateCoverage(timeFilter?: any): Promise<CoverageMetrics> {
    console.log(`📊 COVERAGE: Starting comprehensive coverage calculation...`);
    
    try {
      // 1. Get catalog metrics
      const { catalogTotal, catalogActiveProjects } = await this.getCatalogMetrics();
      
      // 2. Get Excel MAESTRO metrics
      const excelMetrics = await this.getExcelMetrics(timeFilter);
      
      // 3. Get mapping metrics
      const mappingMetrics = await this.getMappingMetrics();
      
      // 4. Get period-specific activity
      const periodMetrics = await this.getPeriodMetrics(timeFilter);
      
      // 5. Get orphan analysis
      const orphanMetrics = await this.getOrphanMetrics(timeFilter);
      
      // 6. Calculate coverage ratios
      const coverageRatio = catalogActiveProjects > 0 
        ? mappingMetrics.mappedProjects / catalogActiveProjects 
        : 0;
      
      const periodCoverageRatio = catalogActiveProjects > 0
        ? periodMetrics.periodProjectsWithActivity / catalogActiveProjects
        : 0;
      
      const metrics: CoverageMetrics = {
        // Catalog totals
        catalogTotal,
        catalogActiveProjects,
        
        // Excel totals
        excelProjectsDistinct: excelMetrics.projectsDistinct,
        excelClientsDistinct: excelMetrics.clientsDistinct,
        excelRecordsTotal: excelMetrics.recordsTotal,
        
        // Mapping success
        mappedProjects: mappingMetrics.mappedProjects,
        aliasesActive: mappingMetrics.aliasesActive,
        coverageRatio,
        
        // Period activity
        periodProjectsWithActivity: periodMetrics.periodProjectsWithActivity,
        periodCoverageRatio,
        
        // Quality
        orphanRows: orphanMetrics.orphanRows,
        orphanExamples: orphanMetrics.examples,
        
        // Metadata
        fxMonth: this.getFxMonth(timeFilter),
        lastImportAt: await this.getLastImportTimestamp(),
        calculatedAt: new Date()
      };
      
      console.log(`📊 COVERAGE: Calculation complete. Coverage ratio: ${(coverageRatio * 100).toFixed(1)}%`);
      return metrics;
      
    } catch (error) {
      console.error('❌ COVERAGE: Error calculating coverage metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get project catalog metrics
   */
  private async getCatalogMetrics(): Promise<{ catalogTotal: number, catalogActiveProjects: number }> {
    // Get all projects from catalog
    const allProjects = await this.storage.getActiveProjects();
    const catalogTotal = allProjects.length;
    
    // Count active projects (all projects in catalog are considered active for coverage)
    const catalogActiveProjects = allProjects.filter(p => p.status === 'active' || !p.status).length;
    
    console.log(`📊 CATALOG: ${catalogTotal} total projects, ${catalogActiveProjects} active`);
    return { catalogTotal, catalogActiveProjects };
  }
  
  /**
   * Get Excel MAESTRO data metrics
   */
  private async getExcelMetrics(timeFilter?: any): Promise<{
    projectsDistinct: number;
    clientsDistinct: number;
    recordsTotal: number;
  }> {
    // Get sales and costs data from Excel MAESTRO
    const salesData = await this.storage.getGoogleSheetsSales();
    const costsData = await this.storage.getDirectCosts();
    
    // Calculate unique projects and clients
    const allProjects = new Set<string>();
    const allClients = new Set<string>();
    
    salesData.forEach((sale: any) => {
      if (sale.projectName) allProjects.add(sale.projectName);
      if (sale.clientName) allClients.add(sale.clientName);
    });
    
    costsData.forEach((cost: any) => {
      if (cost.proyecto) allProjects.add(cost.proyecto);
      if (cost.cliente) allClients.add(cost.cliente);
    });
    
    const projectsDistinct = allProjects.size;
    const clientsDistinct = allClients.size;
    const recordsTotal = salesData.length + costsData.length;
    
    console.log(`📊 EXCEL: ${projectsDistinct} distinct projects, ${clientsDistinct} distinct clients, ${recordsTotal} total records`);
    return { projectsDistinct, clientsDistinct, recordsTotal };
  }
  
  /**
   * Get alias mapping metrics
   */
  private async getMappingMetrics(): Promise<{
    mappedProjects: number;
    aliasesActive: number;
  }> {
    // Get active aliases
    const aliases = await db
      .select()
      .from(projectAliases)
      .where(eq(projectAliases.isActive, true));
    
    const aliasesActive = aliases.length;
    
    // Count unique projects that have aliases (successfully mapped)
    const mappedProjectIds = new Set(aliases.map(a => a.projectId));
    const mappedProjects = mappedProjectIds.size;
    
    console.log(`📊 MAPPING: ${mappedProjects} projects with aliases, ${aliasesActive} active aliases total`);
    return { mappedProjects, aliasesActive };
  }
  
  /**
   * Get period-specific activity metrics
   */
  private async getPeriodMetrics(timeFilter?: any): Promise<{
    periodProjectsWithActivity: number;
  }> {
    // For now, count projects that have any Excel activity
    // In the future, this could be filtered by the specific time period
    const mappingMetrics = await this.getMappingMetrics();
    
    // For period metrics, use the same as mapped for now
    // This could be enhanced to filter by actual period activity
    const periodProjectsWithActivity = mappingMetrics.mappedProjects;
    
    console.log(`📊 PERIOD: ${periodProjectsWithActivity} projects with activity in period`);
    return { periodProjectsWithActivity };
  }
  
  /**
   * Get orphan rows analysis
   */
  private async getOrphanMetrics(timeFilter?: any): Promise<{
    orphanRows: number;
    examples: OrphanExample[];
  }> {
    const salesData = await this.storage.getGoogleSheetsSales();
    const costsData = await this.storage.getDirectCosts();
    const aliases = await db
      .select()
      .from(projectAliases)
      .where(eq(projectAliases.isActive, true));
    
    // Create lookup map for aliases
    const aliasMap = new Map<string, boolean>();
    aliases.forEach(alias => {
      const key = `${alias.excelClient}:::${alias.excelProject}`;
      aliasMap.set(key, true);
    });
    
    const orphanExamples: OrphanExample[] = [];
    let orphanCount = 0;
    
    // Check sales for orphans
    for (const sale of salesData.slice(0, 20)) { // Limit examples to first 20
      const saleAny = sale as any;
      const key = `${saleAny.clientName || ''}:::${saleAny.projectName || ''}`;
      if (!aliasMap.has(key) && saleAny.projectName) {
        orphanCount++;
        if (orphanExamples.length < 10) { // Max 10 examples
          orphanExamples.push({
            clientName: saleAny.clientName || 'Unknown',
            projectName: saleAny.projectName,
            period: saleAny.period || 'Unknown',
            recordType: 'sales',
            amount: saleAny.montoUSD || saleAny.montoARS
          });
        }
      }
    }
    
    // Check costs for orphans
    for (const cost of costsData.slice(0, 20)) { // Limit examples to first 20
      const costAny = cost as any;
      const key = `${costAny.cliente || ''}:::${costAny.proyecto || ''}`;
      if (!aliasMap.has(key) && costAny.proyecto) {
        orphanCount++;
        if (orphanExamples.length < 10) { // Max 10 examples
          orphanExamples.push({
            clientName: costAny.cliente || 'Unknown',
            projectName: costAny.proyecto,
            period: `${costAny.mes || ''}-${costAny.año || ''}`,
            recordType: 'costs',
            amount: costAny.montoTotalUSD
          });
        }
      }
    }
    
    console.log(`📊 ORPHANS: ${orphanCount} orphan rows detected, ${orphanExamples.length} examples collected`);
    return { orphanRows: orphanCount, examples: orphanExamples };
  }
  
  /**
   * Get current FX month for currency calculations
   */
  private getFxMonth(timeFilter?: any): string {
    // For now, return current month
    // This could be enhanced to return the actual FX period being used
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  /**
   * Get last import timestamp
   */
  private async getLastImportTimestamp(): Promise<Date | null> {
    // This could be enhanced to track actual import timestamps
    // For now, return null or current time
    return new Date(); // Placeholder
  }
}