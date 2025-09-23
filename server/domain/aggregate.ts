/**
 * 📊 Domain Aggregation Layer
 * Agregación por projectKey, monthKey usando solo *_norm tables
 */

import { db } from '../db';
import { salesNorm, costsNorm, targetsNorm } from '../../shared/schema';
import { sql } from 'drizzle-orm';

export interface ProjectAggregation {
  projectKey: string;
  monthKey: string;
  revenueUSD: number;
  costUSD: number;
  hoursWorked: number;
  profitUSD: number;
  marginPercent: number | null;
  markupRatio: number | null;
}

export interface PortfolioSummary {
  totalRevenueUSD: number;
  totalCostUSD: number;
  totalProfitUSD: number;
  totalHoursWorked: number;
  averageMarginPercent: number | null;
  projectCount: number;
  monthCount: number;
}

/**
 * 🎯 Agregación por projectKey y monthKey
 */
export async function aggregateByProjectMonth(
  projectKeys?: string[],
  monthKeys?: string[]
): Promise<ProjectAggregation[]> {
  try {
    // Construir condiciones WHERE
    let salesWhere = sql`1=1`;
    let costsWhere = sql`1=1`;
    
    if (projectKeys && projectKeys.length > 0) {
      salesWhere = sql`${salesNorm.projectKey} = ANY(${projectKeys})`;
      costsWhere = sql`${costsNorm.projectKey} = ANY(${projectKeys})`;
    }
    
    if (monthKeys && monthKeys.length > 0) {
      salesWhere = sql`${salesWhere} AND ${salesNorm.monthKey} = ANY(${monthKeys})`;
      costsWhere = sql`${costsWhere} AND ${costsNorm.monthKey} = ANY(${monthKeys})`;
    }
    
    // Agregación de ventas
    const salesAgg = await db
      .select({
        projectKey: salesNorm.projectKey,
        monthKey: salesNorm.monthKey,
        totalUSD: sql<number>`sum(${salesNorm.usd}::numeric)`,
      })
      .from(salesNorm)
      .where(salesWhere)
      .groupBy(salesNorm.projectKey, salesNorm.monthKey);
    
    // Agregación de costos
    const costsAgg = await db
      .select({
        projectKey: costsNorm.projectKey,
        monthKey: costsNorm.monthKey,
        totalUSD: sql<number>`sum(${costsNorm.usd}::numeric)`,
        totalHours: sql<number>`sum(COALESCE(${costsNorm.hoursWorked}::numeric, 0))`,
      })
      .from(costsNorm)
      .where(costsWhere)
      .groupBy(costsNorm.projectKey, costsNorm.monthKey);
    
    // Combinar datos
    const combinedMap = new Map<string, ProjectAggregation>();
    
    // Procesar ventas
    for (const sale of salesAgg) {
      const key = `${sale.projectKey}|${sale.monthKey}`;
      combinedMap.set(key, {
        projectKey: sale.projectKey,
        monthKey: sale.monthKey,
        revenueUSD: sale.totalUSD,
        costUSD: 0,
        hoursWorked: 0,
        profitUSD: sale.totalUSD,
        marginPercent: null,
        markupRatio: null,
      });
    }
    
    // Procesar costos
    for (const cost of costsAgg) {
      const key = `${cost.projectKey}|${cost.monthKey}`;
      const existing = combinedMap.get(key);
      
      if (existing) {
        existing.costUSD = cost.totalUSD;
        existing.hoursWorked = cost.totalHours;
        existing.profitUSD = existing.revenueUSD - cost.totalUSD;
      } else {
        combinedMap.set(key, {
          projectKey: cost.projectKey,
          monthKey: cost.monthKey,
          revenueUSD: 0,
          costUSD: cost.totalUSD,
          hoursWorked: cost.totalHours,
          profitUSD: -cost.totalUSD,
          marginPercent: null,
          markupRatio: null,
        });
      }
    }
    
    // Calcular métricas finales
    const results = Array.from(combinedMap.values()).map(item => ({
      ...item,
      marginPercent: item.revenueUSD > 0 ? (item.profitUSD / item.revenueUSD) * 100 : null,
      markupRatio: item.costUSD > 0 ? item.revenueUSD / item.costUSD : null,
    }));
    
    return results.sort((a, b) => {
      const keyA = `${a.projectKey}|${a.monthKey}`;
      const keyB = `${b.projectKey}|${b.monthKey}`;
      return keyA.localeCompare(keyB);
    });
    
  } catch (error) {
    console.error('Error in aggregateByProjectMonth:', error);
    return [];
  }
}

/**
 * 📊 Generar resumen del portfolio
 */
export async function generatePortfolioSummary(
  projectKeys?: string[],
  monthKeys?: string[]
): Promise<PortfolioSummary> {
  try {
    const aggregations = await aggregateByProjectMonth(projectKeys, monthKeys);
    
    const totals = aggregations.reduce(
      (acc, item) => ({
        totalRevenueUSD: acc.totalRevenueUSD + item.revenueUSD,
        totalCostUSD: acc.totalCostUSD + item.costUSD,
        totalProfitUSD: acc.totalProfitUSD + item.profitUSD,
        totalHoursWorked: acc.totalHoursWorked + item.hoursWorked,
        projectCount: acc.projectCount,
        monthCount: acc.monthCount,
      }),
      {
        totalRevenueUSD: 0,
        totalCostUSD: 0,
        totalProfitUSD: 0,
        totalHoursWorked: 0,
        projectCount: 0,
        monthCount: 0,
      }
    );
    
    // Contar proyectos únicos y meses únicos
    const uniqueProjects = new Set(aggregations.map(a => a.projectKey));
    const uniqueMonths = new Set(aggregations.map(a => a.monthKey));
    
    const averageMarginPercent = totals.totalRevenueUSD > 0 
      ? (totals.totalProfitUSD / totals.totalRevenueUSD) * 100 
      : null;
    
    return {
      ...totals,
      projectCount: uniqueProjects.size,
      monthCount: uniqueMonths.size,
      averageMarginPercent,
    };
    
  } catch (error) {
    console.error('Error in generatePortfolioSummary:', error);
    return {
      totalRevenueUSD: 0,
      totalCostUSD: 0,
      totalProfitUSD: 0,
      totalHoursWorked: 0,
      averageMarginPercent: null,
      projectCount: 0,
      monthCount: 0,
    };
  }
}

/**
 * 🔍 Obtener proyectos activos en un período
 */
export async function getActiveProjectKeys(monthKeys?: string[]): Promise<string[]> {
  try {
    let where = sql`1=1`;
    
    if (monthKeys && monthKeys.length > 0) {
      where = sql`${salesNorm.monthKey} = ANY(${monthKeys}) OR ${costsNorm.monthKey} = ANY(${monthKeys})`;
    }
    
    // Proyectos con ventas en el período
    const salesProjects = await db
      .selectDistinct({ projectKey: salesNorm.projectKey })
      .from(salesNorm)
      .where(monthKeys && monthKeys.length > 0 ? 
        sql`${salesNorm.monthKey} = ANY(${monthKeys})` : sql`1=1`);
    
    // Proyectos con costos en el período
    const costsProjects = await db
      .selectDistinct({ projectKey: costsNorm.projectKey })
      .from(costsNorm)
      .where(monthKeys && monthKeys.length > 0 ? 
        sql`${costsNorm.monthKey} = ANY(${monthKeys})` : sql`1=1`);
    
    // Combinar y deduplicar
    const allProjects = new Set([
      ...salesProjects.map(p => p.projectKey),
      ...costsProjects.map(p => p.projectKey)
    ]);
    
    return Array.from(allProjects).sort();
    
  } catch (error) {
    console.error('Error in getActiveProjectKeys:', error);
    return [];
  }
}

/**
 * 📅 Obtener meses disponibles
 */
export async function getAvailableMonthKeys(): Promise<string[]> {
  try {
    // Meses con ventas
    const salesMonths = await db
      .selectDistinct({ monthKey: salesNorm.monthKey })
      .from(salesNorm);
    
    // Meses con costos
    const costsMonths = await db
      .selectDistinct({ monthKey: costsNorm.monthKey })
      .from(costsNorm);
    
    // Combinar y deduplicar
    const allMonths = new Set([
      ...salesMonths.map(m => m.monthKey),
      ...costsMonths.map(m => m.monthKey)
    ]);
    
    return Array.from(allMonths).sort();
    
  } catch (error) {
    console.error('Error in getAvailableMonthKeys:', error);
    return [];
  }
}

/**
 * 🎯 Agregación completa con filtros de período
 */
export async function aggregateWithPeriodFilter(
  periodMonthKeys: string[]
): Promise<{
  summary: PortfolioSummary;
  projects: ProjectAggregation[];
  activeProjectKeys: string[];
}> {
  try {
    const activeProjectKeys = await getActiveProjectKeys(periodMonthKeys);
    const projects = await aggregateByProjectMonth(activeProjectKeys, periodMonthKeys);
    const summary = await generatePortfolioSummary(activeProjectKeys, periodMonthKeys);
    
    return {
      summary,
      projects,
      activeProjectKeys,
    };
    
  } catch (error) {
    console.error('Error in aggregateWithPeriodFilter:', error);
    return {
      summary: {
        totalRevenueUSD: 0,
        totalCostUSD: 0,
        totalProfitUSD: 0,
        totalHoursWorked: 0,
        averageMarginPercent: null,
        projectCount: 0,
        monthCount: 0,
      },
      projects: [],
      activeProjectKeys: [],
    };
  }
}