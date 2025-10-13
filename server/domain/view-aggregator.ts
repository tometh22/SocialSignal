/**
 * VIEW AGGREGATOR
 * 
 * Extrae datos de project_aggregates según la vista seleccionada (original | operativa | usd)
 */

import { db } from '../db';
import { projectAggregates, projectPeriods, type ViewType } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface ViewModelOutput {
  currencyNative: string;
  revenueDisplay: number;
  costDisplay: number;
  cotizacion: number | null;
  markup: number | null;
  margin: number | null;
  budgetUtilization: number | null;
  totalWorkedHours: number;
  estimatedHours: number;
  teamBreakdown: any[];
  flags: string[];
}

/**
 * Obtiene datos de un proyecto-período según la vista seleccionada
 */
export async function getProjectPeriodView(
  projectId: number,
  periodKey: string,
  view: ViewType = 'operativa'
): Promise<ViewModelOutput | null> {
  
  // 1. Buscar project_period
  const period = await db.select()
    .from(projectPeriods)
    .where(
      and(
        eq(projectPeriods.projectId, projectId),
        eq(projectPeriods.periodKey, periodKey)
      )
    )
    .limit(1);
  
  if (period.length === 0) {
    console.log(`  ⚠️ No period found for project ${projectId}, period ${periodKey}`);
    return null;
  }
  
  const periodId = period[0].id;
  
  // 2. Buscar aggregate para la vista
  const aggregate = await db.select()
    .from(projectAggregates)
    .where(
      and(
        eq(projectAggregates.projectPeriodId, periodId),
        eq(projectAggregates.viewType, view)
      )
    )
    .limit(1);
  
  if (aggregate.length === 0) {
    console.log(`  ⚠️ No aggregate found for period ${periodId}, view ${view}`);
    return null;
  }
  
  const agg = aggregate[0];
  const viewData = agg.viewData as any;
  const quotationData = agg.quotationData as any;
  const actualsData = agg.actualsData as any;
  
  // 3. Mapear a ViewModel unificado
  const result = {
    currencyNative: viewData.currency || agg.currencyNative,
    revenueDisplay: viewData.revenue || 0,
    costDisplay: viewData.cost || 0,
    cotizacion: viewData.cotizacion || quotationData?.totalAmountNative || null,
    markup: viewData.markup || null,
    margin: viewData.margin || null,
    budgetUtilization: viewData.budgetUtilization || null,
    totalWorkedHours: actualsData?.totalWorkedHours || 0,
    estimatedHours: quotationData?.estimatedHours || 0,
    teamBreakdown: actualsData?.teamBreakdown || [],
    flags: agg.flags || []
  };
  
  // 🔒 TRAZAS DE VALIDACIÓN (Punto 8 del checklist)
  console.log(`📊 [VIEW ${view.toUpperCase()}] period=${periodKey} project=${projectId} | ` +
    `rev=${result.revenueDisplay} cost=${result.costDisplay} cur=${result.currencyNative} ` +
    `cotiz=${result.cotizacion} bu=${result.budgetUtilization?.toFixed(2) || 'N/A'}`);
  
  // Validación de consistencia de moneda
  if (view !== 'original' && result.cotizacion) {
    const expectedBU = result.costDisplay / result.cotizacion;
    const actualBU = result.budgetUtilization ?? expectedBU;
    const diff = Math.abs(actualBU - expectedBU);
    if (diff > 1e-6) {
      console.warn(`⚠️ [BE VALIDATION] Budget Utilization inconsistente: expected=${expectedBU.toFixed(4)}, actual=${actualBU.toFixed(4)}, diff=${diff}`);
    }
  }
  
  // Validación de markup
  if (result.markup && result.revenueDisplay && result.costDisplay) {
    const expectedMarkup = result.revenueDisplay / result.costDisplay;
    const diff = Math.abs(result.markup - expectedMarkup);
    if (diff > 0.01) {
      console.warn(`⚠️ [BE VALIDATION] Markup inconsistente: expected=${expectedMarkup.toFixed(4)}, actual=${result.markup.toFixed(4)}, diff=${diff}`);
    }
  }
  
  return result;
}

/**
 * Obtiene lista de proyectos con sus vistas
 */
export async function getProjectsListView(
  projectIds: number[],
  periodKey: string,
  view: ViewType = 'operativa'
): Promise<Map<number, ViewModelOutput>> {
  
  const resultMap = new Map<number, ViewModelOutput>();
  
  for (const projectId of projectIds) {
    const viewModel = await getProjectPeriodView(projectId, periodKey, view);
    if (viewModel) {
      resultMap.set(projectId, viewModel);
    }
  }
  
  return resultMap;
}

/**
 * Mapper de ViewModel (función unificada para lista y detalle)
 */
export function toProjectVM(aggregateData: any, view: ViewType): ViewModelOutput {
  if (!aggregateData) {
    return {
      currencyNative: 'USD',
      revenueDisplay: 0,
      costDisplay: 0,
      cotizacion: null,
      markup: null,
      margin: null,
      budgetUtilization: null,
      totalWorkedHours: 0,
      estimatedHours: 0,
      teamBreakdown: [],
      flags: ['NO_DATA']
    };
  }
  
  const viewData = aggregateData.viewData || {};
  const quotationData = aggregateData.quotationData || {};
  const actualsData = aggregateData.actualsData || {};
  
  return {
    currencyNative: viewData.currency || aggregateData.currencyNative || 'USD',
    revenueDisplay: viewData.revenue || 0,
    costDisplay: viewData.cost || 0,
    cotizacion: viewData.cotizacion || quotationData?.totalAmountNative || null,
    markup: viewData.markup || null,
    margin: viewData.margin || null,
    budgetUtilization: viewData.budgetUtilization || null,
    totalWorkedHours: actualsData?.totalWorkedHours || 0,
    estimatedHours: quotationData?.estimatedHours || 0,
    teamBreakdown: actualsData?.teamBreakdown || [],
    flags: aggregateData.flags || []
  };
}
