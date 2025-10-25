/**
 * VIEW AGGREGATOR
 * 
 * Extrae datos de project_aggregates según la vista seleccionada (original | operativa | usd)
 * 
 * PRIORIDAD DE LECTURA:
 * 1. SoT (fact_labor_month + fact_rc_month) ← PRIMARY SOURCE
 * 2. Legacy project_aggregates ← FALLBACK
 */

import { db } from '../db';
import { projectAggregates, projectPeriods, factLaborMonth, factRCMonth, personnel, type ViewType } from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

interface ViewModelOutput {
  currencyNative: string;
  revenueDisplay: number;
  costDisplay: number;
  cotizacion: number | null;
  markup: number | null;
  margin: number | null;
  budgetUtilization: number | null;
  totalWorkedHours: number;
  totalAsanaHours?: number;  // 🎯 3-hours architecture
  totalBillingHours?: number;  // 🎯 3-hours architecture
  estimatedHours: number;
  teamBreakdown: any[];
  flags: string[];
}

/**
 * 🎯 SINGLE SOURCE OF TRUTH (SoT) READER
 * 
 * Lee directamente de fact_labor_month + fact_rc_month (Star Schema)
 * Retorna ViewModel completo con summary, quotation, actuals, metrics
 */
async function getProjectPeriodViewFromSoT(
  projectId: number,
  periodKey: string,
  view: ViewType = 'operativa'
): Promise<ViewModelOutput | null> {
  
  console.log(`🔍 [SoT Reader] Querying fact_labor_month + fact_rc_month for project=${projectId}, period=${periodKey}`);
  
  // 1) Team breakdown con JOIN a personnel
  const teamRows = await db
    .select({
      personId: factLaborMonth.personId,
      personName: personnel.name,
      roleName: factLaborMonth.roleName,
      targetHours: factLaborMonth.targetHours,
      asanaHours: factLaborMonth.asanaHours,
      billingHours: factLaborMonth.billingHours,
      hourlyRateARS: factLaborMonth.hourlyRateARS,
      fx: factLaborMonth.fx,
      costARS: factLaborMonth.costARS,
      costUSD: factLaborMonth.costUSD,
      flags: factLaborMonth.flags
    })
    .from(factLaborMonth)
    .leftJoin(personnel, eq(personnel.id, factLaborMonth.personId))
    .where(
      and(
        eq(factLaborMonth.projectId, projectId),
        eq(factLaborMonth.periodKey, periodKey)
      )
    )
    .orderBy(personnel.name);

  // 2) Totales agregados (labor)
  const totalsResult = await db
    .select({
      targetHours: sql<string>`COALESCE(SUM(CAST(${factLaborMonth.targetHours} AS NUMERIC)), 0)`,
      asanaHours: sql<string>`COALESCE(SUM(CAST(${factLaborMonth.asanaHours} AS NUMERIC)), 0)`,
      billingHours: sql<string>`COALESCE(SUM(CAST(${factLaborMonth.billingHours} AS NUMERIC)), 0)`,
      costARS: sql<string>`COALESCE(SUM(CAST(${factLaborMonth.costARS} AS NUMERIC)), 0)`,
      costUSD: sql<string>`COALESCE(SUM(CAST(${factLaborMonth.costUSD} AS NUMERIC)), 0)`
    })
    .from(factLaborMonth)
    .where(
      and(
        eq(factLaborMonth.projectId, projectId),
        eq(factLaborMonth.periodKey, periodKey)
      )
    );

  // 3) Rendimiento Cliente (revenue + quote/fx)
  const rcResult = await db
    .select({
      quoteNative: factRCMonth.quoteNative,
      fxRate: factRCMonth.fxRate,
      priceNative: factRCMonth.priceNative, // DEPRECATED
      revenueARS: factRCMonth.revenueARS,
      revenueUSD: factRCMonth.revenueUSD,
      costARS: factRCMonth.costARS,
      costUSD: factRCMonth.costUSD
    })
    .from(factRCMonth)
    .where(
      and(
        eq(factRCMonth.projectId, projectId),
        eq(factRCMonth.periodKey, periodKey)
      )
    )
    .limit(1);

  // Validar si hay datos SoT
  if (teamRows.length === 0 && rcResult.length === 0) {
    console.log(`  ℹ️ [SoT Reader] No data found in SoT tables for project=${projectId}, period=${periodKey}`);
    return null;
  }

  const totals = totalsResult[0] || {
    targetHours: '0',
    asanaHours: '0',
    billingHours: '0',
    costARS: '0',
    costUSD: '0'
  };

  const rc = rcResult[0] || {
    quoteNative: '0',
    fxRate: '0',
    priceNative: '0', // DEPRECATED
    revenueARS: '0',
    revenueUSD: '0',
    costARS: '0',
    costUSD: '0'
  };

  // 4) Determinar moneda y valores de display según la vista seleccionada
  const revenueUSDVal = Number(rc.revenueUSD || 0);
  const revenueARSVal = Number(rc.revenueARS || 0);
  const totalCostARS = Number(totals.costARS);
  const totalCostUSD = Number(totals.costUSD);
  
  // 🎯 LÓGICA DE 3 VISTAS
  let currencyNative: string;
  let costDisplay: number;
  let revenueDisplay: number;
  
  if (view === 'usd') {
    // Vista USD: Siempre mostrar en USD
    currencyNative = 'USD';
    costDisplay = totalCostUSD;
    revenueDisplay = revenueUSDVal;
  } else if (view === 'operativa') {
    // Vista Operativa: Usar moneda nativa del cliente
    // Si hay datos significativos en ARS, es cliente argentino
    const hasARSData = revenueARSVal > revenueUSDVal * 100; // ARS significativamente mayor
    currencyNative = hasARSData ? 'ARS' : 'USD';
    costDisplay = hasARSData ? totalCostARS : totalCostUSD;
    revenueDisplay = hasARSData ? revenueARSVal : revenueUSDVal;
  } else {
    // Vista Original: Datos crudos (priorizar USD por simplicidad)
    currencyNative = 'USD';
    costDisplay = totalCostUSD;
    revenueDisplay = revenueUSDVal;
  }
  
  // ✅ Usar quoteNative (precio/cotización del proyecto) directamente - NO más hotfix
  const cotizacion = Number(rc.quoteNative || 0);
  const fxRate = Number(rc.fxRate || 0);
  
  console.log(`💰 [SoT Reader] quoteNative=${cotizacion}, fxRate=${fxRate}, revenue=${revenueDisplay}, currency=${currencyNative}`);

  // 5) Calcular métricas
  const markup = (costDisplay > 0 && revenueDisplay > 0) 
    ? (revenueDisplay / costDisplay) 
    : null;
    
  const margin = (revenueDisplay > 0) 
    ? ((revenueDisplay - costDisplay) / revenueDisplay) 
    : null;
    
  const budgetUtilization = (cotizacion > 0 && costDisplay > 0)
    ? (costDisplay / cotizacion)
    : null;

  // 6) Mapear team breakdown
  const teamBreakdown = teamRows.map(row => ({
    name: row.personName || `Person ${row.personId}`,
    roleName: row.roleName || 'N/A',
    targetHours: Number(row.targetHours || 0),
    hoursAsana: Number(row.asanaHours || 0),
    hoursBilling: Number(row.billingHours || 0),
    hourlyRateARS: Number(row.hourlyRateARS || 0),
    fx: Number(row.fx || 0),
    costARS: Number(row.costARS || 0),
    costUSD: Number(row.costUSD || 0),
    flags: row.flags || []
  }));

  const totalAsanaHours = Number(totals.asanaHours);
  const totalBillingHours = Number(totals.billingHours);
  const estimatedHours = Number(totals.targetHours);

  const result: ViewModelOutput = {
    currencyNative,
    revenueDisplay,
    costDisplay,
    cotizacion: cotizacion > 0 ? cotizacion : null,
    markup,
    margin,
    budgetUtilization,
    totalWorkedHours: totalAsanaHours,
    totalAsanaHours,
    totalBillingHours,
    estimatedHours,
    teamBreakdown,
    flags: []
  };

  console.log(`✅ [SoT Reader] SUCCESS: team=${teamBreakdown.length}, totalBillingHours=${totalBillingHours.toFixed(2)}, costDisplay=${costDisplay.toFixed(2)} ${currencyNative}`);

  return result;
}

/**
 * Obtiene datos de un proyecto-período según la vista seleccionada
 * 
 * CASCADA DE PRIORIDAD:
 * 1. Intentar SoT (fact_labor_month + fact_rc_month) ← PRIMARY
 * 2. Fallback a project_aggregates ← LEGACY
 */
export async function getProjectPeriodView(
  projectId: number,
  periodKey: string,
  view: ViewType = 'operativa'
): Promise<ViewModelOutput | null> {
  
  // 🎯 PASO 1: Intentar leer desde SoT (Star Schema) PRIMERO
  const fromSoT = await getProjectPeriodViewFromSoT(projectId, periodKey, view);
  if (fromSoT) {
    console.log(`✅ [View Aggregator] Using SoT data for project=${projectId}, period=${periodKey}, view=${view}`);
    return fromSoT;
  }
  
  console.log(`⚠️ [View Aggregator] No SoT data, falling back to legacy project_aggregates`);
  
  // 🔄 PASO 2: Fallback a project_aggregates (legacy)
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
  
  // 🔧 HOTFIX: Hydrate team breakdown with on-the-fly normalization
  const normHours = (x?: number, context?: string): number => {
    if (!Number.isFinite(x as number)) return 0;
    const val = x as number;
    if (val > 500) {
      console.warn(`⚠️ ANTI_×100 APPLIED [${context}]: ${val} → ${val/100} (threshold: 500h)`);
      return val / 100;
    }
    return val;
  };
  
  const fxMes = viewData.currency === 'ARS' && viewData.revenue && (viewData.revenueUsd || viewData.revenueUSD)
    ? viewData.revenue / (viewData.revenueUsd || viewData.revenueUSD)
    : 1345;
  
  const hydrateMember = (m: any) => {
    // Helper: parsea a número válido o retorna null si inválido
    const safeNum = (val: any): number | null => {
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    
    const memberName = m.name || m.personnelId || 'Unknown';
    const targetHours = safeNum(m.targetHours ?? m.estimatedHours) ?? 0;
    
    // hoursAsana con fallbacks múltiples, SIEMPRE normalizar
    // Usar hoursBilling como proxy si no hay hoursAsana directo (los aggregates no guardan hoursAsana separado)
    const hoursAsanaRaw = safeNum(m.hoursAsana) ?? safeNum(m.horasRealesAsana) ?? safeNum(m.hours ?? m.actualHours) ?? safeNum(m.hoursBilling) ?? 0;
    const hoursAsana = normHours(hoursAsanaRaw, `${memberName}.hoursAsana`);
    
    // hoursBilling: horasParaFacturacion → hoursAsana → targetHours
    const billingRaw = safeNum(m.hoursBilling ?? m.horasParaFacturacion);
    const hoursBilling = (() => {
      if (billingRaw && billingRaw > 0) return normHours(billingRaw, `${memberName}.hoursBilling`);
      if (hoursAsana > 0) return hoursAsana; // Ya normalizado arriba
      return targetHours; // Último fallback
    })();
    
    const rateARS = Number(m.hourlyRateARS ?? m.rateARS ?? m.rate ?? 0);
    const costARS = Number(m.costARS ?? (hoursBilling * rateARS || 0));
    const costUSD = Number(m.costUSD ?? (fxMes ? costARS / fxMes : 0));
    
    return {
      ...m,
      targetHours,
      hoursAsana,
      hoursBilling,
      hours: hoursAsana,
      costARS,
      costUSD,
      hourlyRateARS: rateARS,
      estimatedHours: targetHours,
      actualHours: hoursAsana,
      actualCost: costUSD
    };
  };
  
  const rawTeamBreakdown = actualsData?.teamBreakdown || [];
  const teamBreakdown = rawTeamBreakdown.map(hydrateMember);
  
  const totalAsanaHours = teamBreakdown.reduce((sum: number, m: any) => sum + (m.hoursAsana || 0), 0);
  const totalBillingHours = teamBreakdown.reduce((sum: number, m: any) => sum + (m.hoursBilling || 0), 0);
  
  console.log(`🎯 3-HOURS DEBUG: teamCount=${teamBreakdown.length}, totalAsanaHours=${totalAsanaHours}, totalBillingHours=${totalBillingHours}`);
  
  // 3. Mapear a ViewModel unificado
  // 🎯 FIX: Para clientes USD en vista operativa, usar revenue del mes como cotizacion
  const isUSDClient = viewData.currency === 'USD' || agg.currencyNative === 'USD';
  let cotizacion = viewData.cotizacion || quotationData?.totalAmountNative || null;
  
  if (view === 'operativa' && isUSDClient && viewData.revenue) {
    // Use monthly revenue as budget baseline for USD clients (not static quotation or FX)
    cotizacion = viewData.revenue;
    console.log(`💰 VIEW-AGGREGATOR FIX: USD operativa using revenue ${cotizacion} as cotizacion (was ${viewData.cotizacion})`);
  }
  
  // Recalculate budgetUtilization with corrected cotizacion
  const budgetUtilization = cotizacion > 0 && viewData.cost 
    ? viewData.cost / cotizacion 
    : (viewData.budgetUtilization || null);
  
  const result = {
    currencyNative: viewData.currency || agg.currencyNative,
    revenueDisplay: viewData.revenue || 0,
    costDisplay: viewData.cost || 0,
    cotizacion,
    markup: viewData.markup || null,
    margin: viewData.margin || null,
    budgetUtilization,
    totalWorkedHours: actualsData?.totalWorkedHours || totalAsanaHours || 0,
    totalAsanaHours,  // 🎯 NEW
    totalBillingHours,  // 🎯 NEW
    estimatedHours: quotationData?.estimatedHours || 0,
    teamBreakdown,  // 🎯 Now hydrated with normalized hours
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

/**
 * 🎯 STAR SCHEMA AGGREGATOR - Reemplazo de financial_sot
 * 
 * Agrega TODOS los proyectos activos desde fact_labor_month + fact_rc_month
 * Compatible con interfaz FinancialProjectMetrics
 */
export interface FinancialProjectMetrics {
  projectKey: string;
  projectId: number;
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

export async function aggregateProjectsFromStarSchema(
  periodKey: string,
  view: ViewType = 'operativa'
): Promise<FinancialProjectMetrics[]> {
  console.log(`🌟 [Star Schema Aggregator] Fetching projects for period=${periodKey}, view=${view}`);
  
  try {
    // 1) Obtener todos los projectIds únicos del Star Schema para este período
    const projectsInPeriod = await db
      .selectDistinct({ projectId: factRCMonth.projectId })
      .from(factRCMonth)
      .where(eq(factRCMonth.periodKey, periodKey));

    console.log(`  📊 Found ${projectsInPeriod.length} projects in Star Schema for period ${periodKey}`);

    if (projectsInPeriod.length === 0) {
      return [];
    }

    // 2) Para cada proyecto, obtener datos completos con join a activeProjects
    const { activeProjects, clients, quotations } = await import('@shared/schema');
    
    const projectsData = await db
      .select({
        projectId: activeProjects.id,
        clientName: clients.name,
        projectName: quotations.projectName,
        projectType: sql<string>`NULL`
      })
      .from(activeProjects)
      .leftJoin(clients, eq(clients.id, activeProjects.clientId))
      .leftJoin(quotations, eq(quotations.id, activeProjects.quotationId))
      .where(
        inArray(
          activeProjects.id,
          projectsInPeriod.map(p => p.projectId)
        )
      );

    console.log(`  ✅ Retrieved metadata for ${projectsData.length} projects`);

    // 3) Para cada proyecto, obtener ViewModelOutput del Star Schema
    const results: FinancialProjectMetrics[] = [];

    for (const project of projectsData) {
      if (!project.clientName || !project.projectName) {
        console.warn(`  ⚠️ Skipping project ${project.projectId} - missing client/project name`);
        continue;
      }

      const viewData = await getProjectPeriodViewFromSoT(
        project.projectId,
        periodKey,
        view
      );

      if (!viewData) {
        console.warn(`  ⚠️ No Star Schema data for project ${project.projectId}`);
        continue;
      }

      // 4) Convertir a formato FinancialProjectMetrics
      const { canonicalizeKey } = await import('./shared/strings');
      const projectKey = canonicalizeKey(`${project.clientName}|${project.projectName}`);

      // Calcular USD normalizado (para KPIs)
      const revenueUSD = viewData.currencyNative === 'USD' 
        ? viewData.revenueDisplay 
        : viewData.revenueDisplay / (viewData.cotizacion || 1345);
      
      const costUSD = viewData.currencyNative === 'USD'
        ? viewData.costDisplay
        : viewData.costDisplay / (viewData.cotizacion || 1345);

      results.push({
        projectKey,
        projectId: project.projectId,
        clientName: project.clientName,
        projectName: project.projectName,
        projectType: project.projectType,
        currencyNative: viewData.currencyNative as 'USD' | 'ARS',
        metrics: {
          revenueDisplay: viewData.revenueDisplay,
          costDisplay: viewData.costDisplay,
          revenueUSDNormalized: revenueUSD,
          costUSDNormalized: costUSD,
          profitUSD: revenueUSD - costUSD,
          margin: viewData.margin,
          markup: viewData.markup
        }
      });

      console.log(`  ✅ ${projectKey}: ${viewData.currencyNative} ${viewData.revenueDisplay.toFixed(0)} revenue`);
    }

    console.log(`🌟 [Star Schema Aggregator] SUCCESS: ${results.length} projects aggregated`);
    return results;

  } catch (error) {
    console.error('❌ [Star Schema Aggregator] Error:', error);
    throw error;
  }
}
