/**
 * 🚀 API PÚBLICA DEL DOMINIO DE INGRESOS - SINGLE SOURCE OF TRUTH
 * Exporta funciones canónicas que usa toda la aplicación
 */

import { fetchSalesRawForPeriod, countActiveProjects } from './data-access';
import { buildIncomeResult } from './business-rules';
import type { PeriodKey, IncomeResult, ProjectIncome, PortfolioIncome } from './types';

// Re-export de tipos para conveniencia
export type { PeriodKey, IncomeResult, ProjectIncome, PortfolioIncome, MoneyDisplay } from './types';

/**
 * 🚀 FUNCIÓN PRINCIPAL: Obtiene ingresos completos por período
 * Esta es la función que deben usar todas las pantallas
 */
export async function getIncomeByPeriod(period: PeriodKey): Promise<IncomeResult> {
  console.log(`🚀 INCOME SoT: getIncomeByPeriod(${period}) called`);
  
  const rows = await fetchSalesRawForPeriod(period);
  const totalProjects = await countActiveProjects();
  
  return buildIncomeResult(period, rows, totalProjects);
}

/**
 * 🚀 FUNCIÓN ESPECÍFICA: Obtiene ingresos de un proyecto específico
 */
export async function getIncomeByProject(projectId: number, period: PeriodKey): Promise<ProjectIncome> {
  console.log(`🚀 INCOME SoT: getIncomeByProject(${projectId}, ${period}) called`);
  
  const { projects } = await getIncomeByPeriod(period);
  const project = projects.find(p => p.projectId === projectId);
  
  return project ?? {
    projectId,
    clientName: '',
    projectName: '',
    revenueDisplay: { amount: 0, currency: 'USD' },
    revenueUSDNormalized: 0,
    records: []
  };
}

/**
 * 🚀 FUNCIÓN DE RESUMEN: Obtiene solo el resumen del portfolio
 */
export async function getPortfolioIncome(period: PeriodKey): Promise<PortfolioIncome> {
  console.log(`🚀 INCOME SoT: getPortfolioIncome(${period}) called`);
  
  const { summary } = await getIncomeByPeriod(period);
  return summary;
}