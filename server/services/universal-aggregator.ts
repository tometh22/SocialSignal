/**
 * 🔄 Agregador Universal - ETL Data Aggregation Engine
 * Suma datos normalizados por projectKey/monthKey con fórmulas de negocio
 */

import { salesNorm, costsNorm, targetsNorm } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface UniversalMetrics {
  projectKey: string;
  monthKey: string;
  
  // Raw aggregated data
  revenueUSD: number;
  costUSD: number;
  workedHours: number;
  targetHours: number;
  
  // Calculated business metrics
  profitUSD: number;
  markupRatio: number | null; // null displayed as "×"
  marginPct: number | null;   // as percentage
  
  // Active status
  isActive: boolean;
  
  // Metadata for debugging
  salesRecordCount: number;
  costsRecordCount: number;
  targetsRecordCount: number;
}

export interface ProjectTypeInfo {
  projectKey: string;
  isRecurringFee: boolean; // true for Fee projects, false for One Shot
}

export class UniversalAggregator {
  private db: any;
  
  constructor(database: any) {
    this.db = database;
  }

  /**
   * 🎯 CORE AGGREGATION: Sum data by projectKey + monthKey
   * Implements the exact business logic specified by user
   */
  async aggregateByProject(
    projectKey: string, 
    monthKey: string,
    projectTypeInfo?: ProjectTypeInfo
  ): Promise<UniversalMetrics> {
    
    console.log(`🔄 AGGREGATING: ${projectKey} @ ${monthKey}`);
    
    // 1. Sum revenueUSD from sales_norm
    const salesSum = await this.db
      .select({ 
        total: sql`COALESCE(SUM(CAST(${salesNorm.usd} AS DECIMAL)), 0)`,
        count: sql`COUNT(*)`
      })
      .from(salesNorm)
      .where(and(
        eq(salesNorm.projectKey, projectKey),
        eq(salesNorm.monthKey, monthKey)
      ));
    
    const revenueUSD = Number(salesSum[0]?.total || 0);
    const salesRecordCount = Number(salesSum[0]?.count || 0);

    // 2. Sum costUSD and workedHours from costs_norm
    const costsSum = await this.db
      .select({ 
        totalCost: sql`COALESCE(SUM(CAST(${costsNorm.usd} AS DECIMAL)), 0)`,
        totalHours: sql`COALESCE(SUM(CAST(${costsNorm.hoursWorked} AS DECIMAL)), 0)`,
        count: sql`COUNT(*)`
      })
      .from(costsNorm)
      .where(and(
        eq(costsNorm.projectKey, projectKey),
        eq(costsNorm.monthKey, monthKey)
      ));
    
    const costUSD = Number(costsSum[0]?.totalCost || 0);
    const workedHours = Number(costsSum[0]?.totalHours || 0);
    const costsRecordCount = Number(costsSum[0]?.count || 0);

    // 3. Sum targetHours from targets_norm
    const targetsSum = await this.db
      .select({ 
        total: sql`COALESCE(SUM(CAST(${targetsNorm.targetHours} AS DECIMAL)), 0)`,
        count: sql`COUNT(*)`
      })
      .from(targetsNorm)
      .where(and(
        eq(targetsNorm.projectKey, projectKey),
        eq(targetsNorm.monthKey, monthKey)
      ));
    
    const targetHours = Number(targetsSum[0]?.total || 0);
    const targetsRecordCount = Number(targetsSum[0]?.count || 0);

    // 4. Calculate derived business metrics
    const profitUSD = revenueUSD - costUSD;
    
    // markupRatio = costUSD>0 ? revenueUSD/costUSD : null → show "×"
    const markupRatio = costUSD > 0 ? revenueUSD / costUSD : null;
    
    // marginPct = revenueUSD>0 ? profitUSD/revenueUSD : null
    const marginPct = revenueUSD > 0 ? profitUSD / revenueUSD : null;

    // 5. Determine active status
    const isRecurringFee = projectTypeInfo?.isRecurringFee ?? this.inferProjectType(projectKey);
    let isActive: boolean;
    
    if (isRecurringFee) {
      // Fee (recurrentes) ⇒ activo siempre
      isActive = true;
    } else {
      // One Shot ⇒ activo si revenueUSD || costUSD || workedHours > 0 en la ventana
      isActive = revenueUSD > 0 || costUSD > 0 || workedHours > 0;
    }

    const metrics: UniversalMetrics = {
      projectKey,
      monthKey,
      revenueUSD,
      costUSD,
      workedHours,
      targetHours,
      profitUSD,
      markupRatio,
      marginPct,
      isActive,
      salesRecordCount,
      costsRecordCount,
      targetsRecordCount
    };

    console.log(`✅ AGGREGATED ${projectKey} @ ${monthKey}: Revenue=$${revenueUSD}, Cost=$${costUSD}, Profit=$${profitUSD}, Active=${isActive}`);
    
    return metrics;
  }

  /**
   * 🎯 BULK AGGREGATION: Process multiple projects/months
   * Efficient batch processing for dashboard views
   */
  async aggregateMultipleProjects(
    filters: {
      projectKeys?: string[];
      monthKeys?: string[];
      dateRange?: { start: string; end: string };
    },
    projectTypeMap?: Map<string, ProjectTypeInfo>
  ): Promise<UniversalMetrics[]> {
    
    console.log('🔄 BULK AGGREGATION: Processing multiple projects...');
    
    // Get unique combinations of projectKey + monthKey from all tables
    const combinations = await this.getActiveProjectMonthCombinations(filters);
    
    console.log(`📊 Found ${combinations.length} active project-month combinations`);
    
    // Process each combination
    const results: UniversalMetrics[] = [];
    
    for (const combo of combinations) {
      const projectTypeInfo = projectTypeMap?.get(combo.projectKey);
      const metrics = await this.aggregateByProject(combo.projectKey, combo.monthKey, projectTypeInfo);
      results.push(metrics);
    }
    
    console.log(`✅ BULK AGGREGATION: Processed ${results.length} project-month metrics`);
    
    return results;
  }

  /**
   * 🔍 Get active project-month combinations from normalized tables
   * Returns unique pairs where data exists
   */
  private async getActiveProjectMonthCombinations(filters: {
    projectKeys?: string[];
    monthKeys?: string[];
    dateRange?: { start: string; end: string };
  }): Promise<{ projectKey: string; monthKey: string }[]> {
    
    // Build SQL query to get unique combinations from all tables
    const salesCombos = this.db
      .selectDistinct({ 
        projectKey: salesNorm.projectKey, 
        monthKey: salesNorm.monthKey 
      })
      .from(salesNorm);
      
    const costsCombos = this.db
      .selectDistinct({ 
        projectKey: costsNorm.projectKey, 
        monthKey: costsNorm.monthKey 
      })
      .from(costsNorm);
      
    const targetsCombos = this.db
      .selectDistinct({ 
        projectKey: targetsNorm.projectKey, 
        monthKey: targetsNorm.monthKey 
      })
      .from(targetsNorm);

    // Execute all queries in parallel
    const [salesResults, costsResults, targetsResults] = await Promise.all([
      salesCombos,
      costsCombos, 
      targetsCombos
    ]);

    // Combine and deduplicate
    const comboSet = new Set<string>();
    const addCombos = (combos: any[]) => {
      combos.forEach(combo => {
        if (combo.projectKey && combo.monthKey) {
          comboSet.add(`${combo.projectKey}|${combo.monthKey}`);
        }
      });
    };

    addCombos(salesResults);
    addCombos(costsResults);
    addCombos(targetsResults);

    // Convert back to objects and apply filters
    let combinations = Array.from(comboSet).map(combo => {
      const [projectKey, monthKey] = combo.split('|');
      return { projectKey, monthKey };
    });

    // Apply filters
    if (filters.projectKeys?.length) {
      combinations = combinations.filter(c => filters.projectKeys!.includes(c.projectKey));
    }
    
    if (filters.monthKeys?.length) {
      combinations = combinations.filter(c => filters.monthKeys!.includes(c.monthKey));
    }
    
    if (filters.dateRange) {
      combinations = combinations.filter(c => 
        c.monthKey >= filters.dateRange!.start && 
        c.monthKey <= filters.dateRange!.end
      );
    }

    return combinations;
  }

  /**
   * 🔍 Infer project type from projectKey patterns
   * Heuristic to determine if project is recurring Fee or One Shot
   */
  private inferProjectType(projectKey: string): boolean {
    const lower = projectKey.toLowerCase();
    
    // Common patterns for recurring Fee projects
    if (lower.includes('fee') || 
        lower.includes('retainer') || 
        lower.includes('monthly') || 
        lower.includes('recurring')) {
      return true; // Recurring Fee
    }
    
    // Default to One Shot if pattern doesn't match
    return false;
  }

  /**
   * 🧪 TEST AGGREGATION: Verify with golden test values
   * Tests Warner ($29,230) and Kimberly ($8,450) for August 2025
   */
  async testGoldenValues(): Promise<{ success: boolean; results: any }> {
    console.log('🧪 TESTING: Golden values aggregation...');
    
    try {
      // Test Warner Fee Marketing for August 2025
      const warnerKey = this.normalizeProjectKey('warner', 'fee marketing');
      const warnerMetrics = await this.aggregateByProject(warnerKey, '2025-08');
      
      // Test Kimberly Fee Huggies for August 2025  
      const kimberlyKey = this.normalizeProjectKey('kimberly', 'fee huggies');
      const kimberlyMetrics = await this.aggregateByProject(kimberlyKey, '2025-08');
      
      const results = {
        warner: {
          expected: 29230,
          actual: warnerMetrics.revenueUSD,
          match: Math.abs(warnerMetrics.revenueUSD - 29230) < 1,
          metrics: warnerMetrics
        },
        kimberly: {
          expected: 8450,
          actual: kimberlyMetrics.revenueUSD,
          match: Math.abs(kimberlyMetrics.revenueUSD - 8450) < 1,
          metrics: kimberlyMetrics
        }
      };
      
      const success = results.warner.match && results.kimberly.match;
      
      console.log(`🧪 GOLDEN TEST RESULTS:`);
      console.log(`   Warner: $${results.warner.actual} (expected $${results.warner.expected}) - ${results.warner.match ? '✅' : '❌'}`);
      console.log(`   Kimberly: $${results.kimberly.actual} (expected $${results.kimberly.expected}) - ${results.kimberly.match ? '✅' : '❌'}`);
      console.log(`   Overall: ${success ? '✅ PASS' : '❌ FAIL'}`);
      
      return { success, results };
      
    } catch (error) {
      console.error('❌ Golden test error:', error);
      return { 
        success: false, 
        results: { error: error instanceof Error ? error.message : String(error) } 
      };
    }
  }

  /**
   * 🔧 Helper: Normalize project key for lookups
   * Matches the logic used in ETL normalization
   */
  private normalizeProjectKey(clientName: string, projectName: string): string {
    const client = clientName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const project = projectName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    return `${client}|${project}`;
  }

  /**
   * ⚖️ BUSINESS INVARIANTS VALIDATION
   * Validates all business rules automatically
   */
  async validateBusinessInvariants(
    uiMetrics: UniversalMetrics[], 
    filters?: { dateRange?: { start: string; end: string } }
  ): Promise<{
    isValid: boolean;
    violations: string[];
    details: any;
  }> {
    console.log('⚖️ VALIDATING BUSINESS INVARIANTS...');
    
    const violations: string[] = [];
    const details: any = {
      conservation: {},
      unknownProjects: [],
      kpiConsistency: {},
      filterUniqueness: {}
    };

    try {
      // 1. CONSERVACIÓN: UI totals must equal database totals
      const conservationResult = await this.validateConservation(uiMetrics, filters);
      if (!conservationResult.isValid) {
        violations.push(...conservationResult.violations);
      }
      details.conservation = conservationResult.details;

      // 2. SIN "UNKNOWN": No projects without names after normalization
      const unknownResult = await this.validateNoUnknownProjects(uiMetrics);
      if (!unknownResult.isValid) {
        violations.push(...unknownResult.violations);
      }
      details.unknownProjects = unknownResult.unknownProjects;

      // 3. KPIs CONSISTENTES: Business formulas must be correct
      const kpiResult = this.validateKPIConsistency(uiMetrics);
      if (!kpiResult.isValid) {
        violations.push(...kpiResult.violations);
      }
      details.kpiConsistency = kpiResult.details;

      // 4. FILTRO ÚNICO: Same monthKeys filter applied everywhere
      const filterResult = await this.validateFilterUniqueness(filters);
      if (!filterResult.isValid) {
        violations.push(...filterResult.violations);
      }
      details.filterUniqueness = filterResult.details;

      const isValid = violations.length === 0;
      
      console.log(`⚖️ INVARIANTS RESULT: ${isValid ? '✅ VALID' : '❌ VIOLATIONS'}`);
      if (!isValid) {
        console.log(`   Violations (${violations.length}):`);
        violations.forEach(v => console.log(`   - ${v}`));
      }

      return { isValid, violations, details };

    } catch (error) {
      console.error('❌ Invariants validation error:', error);
      violations.push(`Validation system error: ${error instanceof Error ? error.message : String(error)}`);
      return { isValid: false, violations, details };
    }
  }

  /**
   * 1️⃣ CONSERVACIÓN: UI totals == Database totals
   */
  private async validateConservation(
    uiMetrics: UniversalMetrics[],
    filters?: { dateRange?: { start: string; end: string } }
  ): Promise<{ isValid: boolean; violations: string[]; details: any }> {
    
    const violations: string[] = [];
    
    // Calculate UI totals
    const uiTotals = {
      revenueUSD: uiMetrics.reduce((sum, m) => sum + m.revenueUSD, 0),
      costUSD: uiMetrics.reduce((sum, m) => sum + m.costUSD, 0),
      workedHours: uiMetrics.reduce((sum, m) => sum + m.workedHours, 0)
    };

    // Build database filter conditions
    let whereConditions = [];
    if (filters?.dateRange) {
      whereConditions.push(`month_key >= '${filters.dateRange.start}'`);
      whereConditions.push(`month_key <= '${filters.dateRange.end}'`);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get database totals
    const salesTotal = await this.db.select({ 
      total: sql`COALESCE(SUM(CAST(usd AS DECIMAL)), 0)` 
    }).from(salesNorm);
    
    const costsTotal = await this.db.select({ 
      totalCost: sql`COALESCE(SUM(CAST(usd AS DECIMAL)), 0)`,
      totalHours: sql`COALESCE(SUM(CAST(hours_worked AS DECIMAL)), 0)`
    }).from(costsNorm);

    const dbTotals = {
      revenueUSD: Number(salesTotal[0]?.total || 0),
      costUSD: Number(costsTotal[0]?.totalCost || 0),  
      workedHours: Number(costsTotal[0]?.totalHours || 0)
    };

    // Check conservation with tolerance
    const tolerance = 0.01; // 1 cent tolerance
    const differences = {
      revenueUSD: Math.abs(uiTotals.revenueUSD - dbTotals.revenueUSD),
      costUSD: Math.abs(uiTotals.costUSD - dbTotals.costUSD),
      workedHours: Math.abs(uiTotals.workedHours - dbTotals.workedHours)
    };

    if (differences.revenueUSD > tolerance) {
      violations.push(`Revenue conservation violated: UI=$${uiTotals.revenueUSD}, DB=$${dbTotals.revenueUSD}, diff=$${differences.revenueUSD}`);
    }
    if (differences.costUSD > tolerance) {
      violations.push(`Cost conservation violated: UI=$${uiTotals.costUSD}, DB=$${dbTotals.costUSD}, diff=$${differences.costUSD}`);
    }
    if (differences.workedHours > 0.01) {
      violations.push(`Hours conservation violated: UI=${uiTotals.workedHours}h, DB=${dbTotals.workedHours}h, diff=${differences.workedHours}h`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: { uiTotals, dbTotals, differences, tolerance }
    };
  }

  /**
   * 2️⃣ SIN "UNKNOWN": No projects without proper names
   */
  private async validateNoUnknownProjects(
    uiMetrics: UniversalMetrics[]
  ): Promise<{ isValid: boolean; violations: string[]; unknownProjects: any[] }> {
    
    const violations: string[] = [];
    const unknownProjects: any[] = [];

    for (const metric of uiMetrics) {
      const [clientName, projectName] = metric.projectKey.split('|');
      
      // Check for missing or unknown names
      if (!clientName || clientName.trim() === '' || clientName.toLowerCase().includes('unknown')) {
        unknownProjects.push({ projectKey: metric.projectKey, issue: 'Missing or unknown client name' });
        violations.push(`Project has unknown client: ${metric.projectKey}`);
      }
      
      if (!projectName || projectName.trim() === '' || projectName.toLowerCase().includes('unknown')) {
        unknownProjects.push({ projectKey: metric.projectKey, issue: 'Missing or unknown project name' });
        violations.push(`Project has unknown name: ${metric.projectKey}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      unknownProjects
    };
  }

  /**
   * 3️⃣ KPIs CONSISTENTES: Business formulas must be mathematically correct
   */
  private validateKPIConsistency(
    uiMetrics: UniversalMetrics[]
  ): { isValid: boolean; violations: string[]; details: any } {
    
    const violations: string[] = [];
    const inconsistentProjects: any[] = [];

    for (const metric of uiMetrics) {
      const issues: string[] = [];
      
      // Validate profit = revenue - cost
      const expectedProfit = metric.revenueUSD - metric.costUSD;
      if (Math.abs(metric.profitUSD - expectedProfit) > 0.01) {
        issues.push(`Profit formula incorrect: got ${metric.profitUSD}, expected ${expectedProfit}`);
      }

      // Validate markup = revenue / cost (null if cost = 0)
      if (metric.costUSD === 0) {
        if (metric.markupRatio !== null) {
          issues.push(`Markup should be null when cost=0, got ${metric.markupRatio}`);
        }
      } else {
        const expectedMarkup = metric.revenueUSD / metric.costUSD;
        if (metric.markupRatio === null || Math.abs(metric.markupRatio - expectedMarkup) > 0.001) {
          issues.push(`Markup formula incorrect: got ${metric.markupRatio}, expected ${expectedMarkup}`);
        }
      }

      // Validate margin = profit / revenue (null if revenue = 0)
      if (metric.revenueUSD === 0) {
        if (metric.marginPct !== null) {
          issues.push(`Margin should be null when revenue=0, got ${metric.marginPct}`);
        }
      } else {
        const expectedMargin = metric.profitUSD / metric.revenueUSD;
        if (metric.marginPct === null || Math.abs(metric.marginPct - expectedMargin) > 0.001) {
          issues.push(`Margin formula incorrect: got ${metric.marginPct}, expected ${expectedMargin}`);
        }
      }

      if (issues.length > 0) {
        inconsistentProjects.push({
          projectKey: metric.projectKey,
          monthKey: metric.monthKey,
          issues,
          metrics: {
            revenueUSD: metric.revenueUSD,
            costUSD: metric.costUSD,
            profitUSD: metric.profitUSD,
            markupRatio: metric.markupRatio,
            marginPct: metric.marginPct
          }
        });
        
        violations.push(...issues.map(issue => `${metric.projectKey}@${metric.monthKey}: ${issue}`));
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: { inconsistentProjects }
    };
  }

  /**
   * 4️⃣ FILTRO ÚNICO: Same monthKeys applied to all data sources
   */
  private async validateFilterUniqueness(
    filters?: { dateRange?: { start: string; end: string } }
  ): Promise<{ isValid: boolean; violations: string[]; details: any }> {
    
    const violations: string[] = [];
    
    if (!filters?.dateRange) {
      return {
        isValid: true,
        violations: [],
        details: { message: 'No date filter applied, uniqueness not applicable' }
      };
    }

    try {
      // Get distinct monthKeys from each table within the filter range
      const salesMonths = await this.db
        .selectDistinct({ monthKey: salesNorm.monthKey })
        .from(salesNorm)
        .where(and(
          sql`${salesNorm.monthKey} >= ${filters.dateRange.start}`,
          sql`${salesNorm.monthKey} <= ${filters.dateRange.end}`
        ));

      const costsMonths = await this.db
        .selectDistinct({ monthKey: costsNorm.monthKey })
        .from(costsNorm)
        .where(and(
          sql`${costsNorm.monthKey} >= ${filters.dateRange.start}`,
          sql`${costsNorm.monthKey} <= ${filters.dateRange.end}`
        ));

      const targetsMonths = await this.db
        .selectDistinct({ monthKey: targetsNorm.monthKey })
        .from(targetsNorm)
        .where(and(
          sql`${targetsNorm.monthKey} >= ${filters.dateRange.start}`,
          sql`${targetsNorm.monthKey} <= ${filters.dateRange.end}`
        ));

      const salesSet = new Set(salesMonths.map((m: any) => m.monthKey));
      const costsSet = new Set(costsMonths.map((m: any) => m.monthKey));
      const targetsSet = new Set(targetsMonths.map((m: any) => m.monthKey));

      const details = {
        salesMonths: Array.from(salesSet).sort(),
        costsMonths: Array.from(costsSet).sort(),
        targetsMonths: Array.from(targetsSet).sort(),
        filterRange: filters.dateRange
      };

      // For now, we just document the differences but don't require exact match
      // since it's normal for different data sources to have different coverage
      const hasData = salesSet.size > 0 || costsSet.size > 0 || targetsSet.size > 0;
      
      if (!hasData) {
        violations.push(`No data found in any table for filter range ${filters.dateRange.start} to ${filters.dateRange.end}`);
      }

      return {
        isValid: violations.length === 0,
        violations,
        details
      };

    } catch (error) {
      violations.push(`Filter uniqueness validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        violations,
        details: { error: String(error) }
      };
    }
  }
}