/**
 * 📊 Financial Aggregator - Unified Source of Truth
 * Lee desde financial_sot (Rendimiento Cliente) para proyectos con display nativo y KPIs USD
 */

import { db } from '../db';
import { financialSot } from '../../shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { canonicalizeKey } from './shared/strings';

export interface FinancialProjectMetrics {
  projectKey: string;
  clientName: string;
  projectName: string;
  projectType: string | null;
  currencyNative: 'USD' | 'ARS';
  metrics: {
    revenueDisplay: number;
    costDisplay: number;
    revenueUSDNormalized: number;
    costUSDNormalized: number;
    profitUSD: number;
    margin: number | null;
    markup: number | null;
  };
}

export interface FinancialPeriodSummary {
  periodRevenueUSD: number;
  periodCostUSD: number;
  periodProfitUSD: number;
  activeProjects: number;
  avgMargin: number | null;
  avgMarkup: number | null;
}

/**
 * Detectar si un cliente usa USD nativo (Warner, Kimberly)
 */
function isUSDNative(clientName: string): boolean {
  return /warner|kimberly/i.test(clientName);
}

/**
 * Convertir USD a ARS usando FX del mes
 */
function toARS(usd: number, fx: number): number {
  return usd * fx;
}

/**
 * Agregador de proyectos desde financial_sot
 */
export async function aggregateFinancialProjects(
  monthKey?: string,
  clientNames?: string[]
): Promise<FinancialProjectMetrics[]> {
  try {
    // Construir WHERE conditions
    const conditions = [];
    
    if (monthKey) {
      conditions.push(eq(financialSot.monthKey, monthKey));
    }
    
    if (clientNames && clientNames.length > 0) {
      conditions.push(inArray(financialSot.clientName, clientNames));
    }

    // Query financial_sot
    const rows = await db
      .select()
      .from(financialSot)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    console.log(`📊 FINANCIAL AGGREGATOR: Retrieved ${rows.length} rows from financial_sot`);

    // Procesar cada fila
    const projects: FinancialProjectMetrics[] = rows.map(row => {
      const revenueUSD = Number(row.revenueUsd) || 0;
      const costUSD = Number(row.costUsd) || 0;
      const fx = Number(row.fx) || 1345;
      
      // Determinar moneda nativa
      const currencyNative = isUSDNative(row.clientName) ? 'USD' : 'ARS';
      
      // Calcular display en moneda nativa
      const revenueDisplay = currencyNative === 'USD' ? revenueUSD : toARS(revenueUSD, fx);
      const costDisplay = currencyNative === 'USD' ? costUSD : toARS(costUSD, fx);
      
      // Calcular KPIs en USD normalizado
      const profitUSD = revenueUSD - costUSD;
      const margin = revenueUSD > 0 ? (profitUSD / revenueUSD) : null;
      const markup = costUSD > 0 ? (revenueUSD / costUSD) : null;

      // Crear projectKey canónico
      const projectKey = canonicalizeKey(`${row.clientName}|${row.projectName}`);

      return {
        projectKey,
        clientName: row.clientName,
        projectName: row.projectName,
        projectType: row.projectType,
        currencyNative,
        metrics: {
          revenueDisplay,
          costDisplay,
          revenueUSDNormalized: revenueUSD,
          costUSDNormalized: costUSD,
          profitUSD,
          margin,
          markup,
        },
      };
    });

    console.log(`✅ FINANCIAL AGGREGATOR: Processed ${projects.length} projects`);
    return projects;

  } catch (error) {
    console.error('❌ FINANCIAL AGGREGATOR Error:', error);
    throw error;
  }
}

/**
 * Calcular resumen del período
 */
export async function getFinancialPeriodSummary(
  monthKey?: string
): Promise<FinancialPeriodSummary> {
  try {
    const projects = await aggregateFinancialProjects(monthKey);
    
    const totalRevenueUSD = projects.reduce((sum, p) => sum + p.metrics.revenueUSDNormalized, 0);
    const totalCostUSD = projects.reduce((sum, p) => sum + p.metrics.costUSDNormalized, 0);
    const totalProfitUSD = totalRevenueUSD - totalCostUSD;
    
    const margins = projects
      .map(p => p.metrics.margin)
      .filter((m): m is number => m !== null);
    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
    
    const markups = projects
      .map(p => p.metrics.markup)
      .filter((m): m is number => m !== null);
    const avgMarkup = markups.length > 0 ? markups.reduce((a, b) => a + b, 0) / markups.length : null;

    return {
      periodRevenueUSD: totalRevenueUSD,
      periodCostUSD: totalCostUSD,
      periodProfitUSD: totalProfitUSD,
      activeProjects: projects.length,
      avgMargin,
      avgMarkup,
    };
  } catch (error) {
    console.error('❌ FINANCIAL SUMMARY Error:', error);
    throw error;
  }
}
