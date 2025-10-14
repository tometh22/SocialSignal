/**
 * ETL CONSOLIDADO - Sistema de 3 Vistas (Original, Operativa, USD)
 * 
 * Procesa:
 * 1. financialSot (revenue y costos por proyecto-mes desde "Rendimiento Cliente")
 * 2. directCosts (horas objetivo, horas reales, costos por persona desde "Costos directos e indirectos - Directo")
 * 
 * Genera 3 vistas precalculadas:
 * - Original: Datos raw (puede mezclar monedas)
 * - Operativa: Todo en moneda nativa del cliente (Warner/Kimberly=USD, otros=ARS)
 * - USD: Todo convertido a USD para análisis empresa
 */

import { db } from '../db';
import { 
  projectPeriods, 
  projectAggregates, 
  teamBreakdown,
  activeProjects,
  financialSot,
  directCosts,
  type ViewType
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface RawPeriodData {
  projectKey: string;
  clientName: string;
  projectName: string;
  periodKey: string; // YYYY-MM
  year: number;
  month: number;
  // De financialSot (de columnas de la hoja "Rendimiento Cliente")
  revenueUSD: number; // Facturación (USD) - columna G
  revenueARS: number; // Facturación [ARS] - columna I
  costUSD: number; // Costos (USD) - columna H
  costARS: number; // Costos [ARS] - columna K
  quotation: number | null; // Cotización - columna F (para % presupuesto)
  fxMonth: number;
  // De directCosts
  laborRows: Array<{
    personName: string;
    roleName: string;
    targetHours: number;
    hoursReal: number;
    hourlyRateARS: number;
    costTotal: number; // En ARS generalmente
    costUSD: number;
    hasRealHours: boolean;
  }>;
}

interface ViewData {
  revenue: number;
  cost: number;
  currency: string;
  cotizacion: number | null;
  markup?: number;
  margin?: number;
  budgetUtilization?: number;
  revenueCurrency?: string;
  costCurrency?: string;
}

/**
 * Normaliza nombres para claves canónicas
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[-_/().\s]+/g, ' ') // Normalizar separadores
    .replace(/\s+/g, ' ');
}

/**
 * Determina si el cliente factura en USD
 */
function isUSDClient(clientName: string): boolean {
  const normalized = normalize(clientName);
  return /warner|kimberly/.test(normalized);
}

/**
 * Calcula la vista Original (datos raw tal cual de la hoja)
 */
function computeOriginalView(data: RawPeriodData): ViewData {
  // Mostrar revenue y cost tal cual vienen de la hoja (puede mezclar monedas)
  const revenue = data.revenueUSD || data.revenueARS;
  const revenueCurrency = data.revenueUSD ? 'USD' : 'ARS';
  
  const cost = data.costARS || data.costUSD;
  const costCurrency = data.costARS ? 'ARS' : 'USD';
  
  return {
    revenue,
    revenueCurrency,
    cost,
    costCurrency,
    currency: 'MIXED',
    cotizacion: data.quotation, // Usar cotización de la hoja
  };
}

/**
 * Calcula la vista Operativa (todo en moneda nativa del cliente)
 */
function computeOperativaView(data: RawPeriodData): ViewData {
  const isUSD = isUSDClient(data.clientName);
  
  let revenue: number;
  let cost: number;
  let currency: string;
  let cotizacion: number | null;
  
  if (isUSD) {
    // Cliente USD: usar Facturación (USD) - columna G
    revenue = data.revenueUSD;
    cost = data.costUSD;
    currency = 'USD';
    cotizacion = data.quotation; // Cotización en USD
  } else {
    // Cliente ARS: usar Facturación [ARS] - columna I
    revenue = data.revenueARS;
    cost = data.costARS;
    currency = 'ARS';
    cotizacion = data.quotation; // Cotización en ARS
  }
  
  // Calcular KPIs solo si hay cotización
  const view: ViewData = { revenue, cost, currency, cotizacion };
  
  if (cotizacion && cotizacion > 0 && cost > 0) {
    view.markup = revenue / cost;
    view.margin = (revenue - cost) / revenue;
    view.budgetUtilization = cost / cotizacion;
  }
  
  return view;
}

/**
 * Calcula la vista USD (todo en USD para análisis empresa)
 */
function computeUSDView(data: RawPeriodData): ViewData {
  // Convertir todo a USD
  const revenue = data.revenueUSD || (data.revenueARS / data.fxMonth);
  const cost = data.costUSD || (data.costARS / data.fxMonth);
  const cotizacion = data.quotation ? (isUSDClient(data.clientName) ? data.quotation : data.quotation / data.fxMonth) : null;
  
  const view: ViewData = { 
    revenue, 
    cost, 
    currency: 'USD',
    cotizacion 
  };
  
  if (cotizacion && cotizacion > 0 && cost > 0) {
    view.markup = revenue / cost;
    view.margin = (revenue - cost) / revenue;
    view.budgetUtilization = cost / cotizacion;
  }
  
  return view;
}

/**
 * Procesa un proyecto-período y genera las 3 vistas
 */
export async function processProjectPeriod(periodKey: string) {
  console.log(`📊 Procesando período ${periodKey}...`);
  
  const [year, month] = periodKey.split('-').map(Number);
  
  // 1. Obtener datos de financialSot
  const financialRows = await db.select()
    .from(financialSot)
    .where(eq(financialSot.monthKey, periodKey));
  
  console.log(`  📋 ${financialRows.length} filas de financialSot`);
  
  // 2. Obtener datos de directCosts (solo tipo "Directo")
  const costRows = await db.select()
    .from(directCosts)
    .where(
      and(
        eq(directCosts.monthKey, periodKey),
        eq(directCosts.tipoGasto, 'Directo')
      )
    );
  
  console.log(`  💰 ${costRows.length} filas de directCosts (Directo)`);
  
  // 3. Agrupar por proyecto
  const projectMap = new Map<string, RawPeriodData>();
  
  // Procesar financialSot
  for (const row of financialRows) {
    const key = `${row.clientName}::${row.projectName}`;
    
    projectMap.set(key, {
      projectKey: key,
      clientName: row.clientName,
      projectName: row.projectName,
      periodKey,
      year,
      month,
      revenueUSD: parseFloat(row.revenueUsd || '0'), // Facturación (USD) - columna G
      revenueARS: parseFloat(row.revenueArs || '0'), // Facturación [ARS] - columna I
      costUSD: parseFloat(row.costUsd || '0'), // Costos (USD) - columna H
      costARS: parseFloat(row.costArs || '0'), // Costos [ARS] - columna K
      quotation: parseFloat(row.quotation || '0') || null, // Cotización - columna F
      fxMonth: parseFloat(row.fx || '1345'),
      laborRows: []
    });
  }
  
  // Procesar directCosts - AGRUPAR POR PERSONA+ROL
  const laborMap = new Map<string, Map<string, any>>(); // projectKey -> Map<personRoleKey, laborData>
  
  for (const row of costRows) {
    const key = `${row.cliente}::${row.proyecto}`;
    
    if (!projectMap.has(key)) {
      // Proyecto solo en costos, sin revenue en financialSot
      const fx = parseFloat(row.tipoCambio || row.fxCost || '1345');
      projectMap.set(key, {
        projectKey: key,
        clientName: row.cliente || 'Sin cliente',
        projectName: row.proyecto || 'Sin proyecto',
        periodKey,
        year,
        month,
        revenueUSD: 0,
        revenueARS: 0,
        costUSD: 0,
        costARS: 0,
        quotation: null,
        fxMonth: fx,
        laborRows: []
      });
    }
    
    // Inicializar mapa de labor para este proyecto si no existe
    if (!laborMap.has(key)) {
      laborMap.set(key, new Map());
    }
    
    const projectLaborMap = laborMap.get(key)!;
    const personRoleKey = `${row.persona}||${row.rol || 'N/A'}`;
    
    // Agrupar por persona+rol
    if (!projectLaborMap.has(personRoleKey)) {
      projectLaborMap.set(personRoleKey, {
        personName: row.persona,
        roleName: row.rol || 'N/A',
        targetHours: 0,
        hoursReal: 0,
        hourlyRateARS: parseFloat(row.valorHoraLocalCurrency || '0'),
        costTotal: 0,
        costUSD: 0,
        fx: parseFloat(row.tipoCambio || row.fxCost || '1345'),
        hasRealHours: false
      });
    }
    
    const laborData = projectLaborMap.get(personRoleKey)!;
    
    // Acumular horas y costos
    laborData.targetHours += row.horasObjetivo || 0;
    
    // Preferencia: horasParaFacturacion > horasRealesAsana
    const realHours = row.horasParaFacturacion || row.horasRealesAsana || 0;
    if (realHours > 0) {
      laborData.hasRealHours = true;
      laborData.hoursReal += realHours;
    }
    
    laborData.costTotal += row.costoTotal;
    laborData.costUSD += parseFloat(row.montoTotalUSD || '0');
  }
  
  // Convertir mapas agrupados a laborRows
  for (const [projectKey, projectLaborMap] of laborMap) {
    const data = projectMap.get(projectKey)!;
    
    for (const [personRoleKey, laborData] of projectLaborMap) {
      // Si no hay horas reales, usar targetHours como fallback
      if (!laborData.hasRealHours && laborData.targetHours > 0) {
        laborData.hoursReal = laborData.targetHours;
        // Flag se agregará después
      }
      
      data.laborRows.push({
        personName: laborData.personName,
        roleName: laborData.roleName,
        targetHours: laborData.targetHours,
        hoursReal: laborData.hoursReal,
        hourlyRateARS: laborData.hourlyRateARS,
        costTotal: laborData.costTotal,
        costUSD: laborData.costUSD,
        hasRealHours: laborData.hasRealHours
      });
      
      // Actualizar costUSD total
      data.costUSD += laborData.costUSD;
    }
  }
  
  // 4. Procesar cada proyecto
  for (const [projectKey, data] of projectMap) {
    await processProject(data);
  }
  
  console.log(`✅ Período ${periodKey} procesado: ${projectMap.size} proyectos`);
}

/**
 * Procesa un proyecto individual y genera las 3 vistas
 */
async function processProject(data: RawPeriodData) {
  // 1. Buscar proyecto por quotation.projectName y luego vincular con active_projects
  const quotation = await db.query.quotations.findFirst({
    where: (quotations, { eq }) => eq(quotations.projectName, data.projectName)
  });
  
  if (!quotation) {
    console.log(`  ⚠️ Quotation para proyecto "${data.projectName}" no encontrada, omitiendo...`);
    return;
  }
  
  // 2. Buscar active_project por quotation_id
  const project = await db.query.activeProjects.findFirst({
    where: (activeProjects, { eq }) => eq(activeProjects.quotationId, quotation.id)
  });
  
  if (!project) {
    console.log(`  ⚠️ Active project para quotation #${quotation.id} "${data.projectName}" no encontrado, omitiendo...`);
    return;
  }
  
  const projectId = project.id;
  
  // 2. Crear o actualizar project_period
  const existingPeriod = await db.select()
    .from(projectPeriods)
    .where(
      and(
        eq(projectPeriods.projectId, projectId),
        eq(projectPeriods.periodKey, data.periodKey)
      )
    )
    .limit(1);
  
  let periodId: number;
  
  if (existingPeriod.length === 0) {
    const [newPeriod] = await db.insert(projectPeriods).values({
      projectId,
      periodKey: data.periodKey,
      year: data.year,
      month: data.month,
      fx: data.fxMonth.toString()
    }).returning();
    periodId = newPeriod.id;
  } else {
    periodId = existingPeriod[0].id;
  }
  
  // 3. Calcular datos base
  const laborCostARS = data.laborRows.reduce((sum, r) => sum + r.costTotal, 0);
  
  const baseData = {
    revenue_usd: data.revenueUSD,
    revenue_ars: data.revenueARS,
    cost_usd: data.costUSD,
    cost_ars: laborCostARS || data.costARS,
    quotation_usd: data.quotation,
    quotation_ars: data.quotation ? (isUSDClient(data.clientName) ? data.quotation : data.quotation) : null,
    fx: data.fxMonth
  };
  
  // 4. Calcular quotation y actuals
  const totalTargetHours = data.laborRows.reduce((sum, r) => sum + r.targetHours, 0);
  const totalRealHours = data.laborRows.reduce((sum, r) => sum + r.hoursReal, 0);
  
  const quotationData = {
    totalAmountNative: data.quotation,
    totalAmountUSD: isUSDClient(data.clientName) ? data.quotation : (data.quotation ? data.quotation / data.fxMonth : null),
    estimatedHours: totalTargetHours
  };
  
  // Construir teamBreakdown con validación de horas
  const teamBreakdownData = data.laborRows.map(r => ({
    personnelId: r.personName,
    name: r.personName,
    roleName: r.roleName,
    targetHours: r.targetHours,
    hours: r.hoursReal, // actualHours → hours (según spec)
    hourlyRateARS: r.hourlyRateARS,
    costARS: r.costTotal,
    costUSD: r.costUSD,
    isFromExcel: true,
    usedTargetHoursFallback: !r.hasRealHours && r.targetHours > 0 // Flag para fallback
  }));
  
  const actualsData = {
    totalWorkedHours: totalRealHours,
    totalWorkedCost: data.costUSD,
    teamBreakdown: teamBreakdownData
  };
  
  // 5. Calcular 3 vistas
  const originalView = computeOriginalView(data);
  const operativaView = computeOperativaView(data);
  const usdView = computeUSDView(data);
  
  const currencyNative = isUSDClient(data.clientName) ? 'USD' : 'ARS';
  
  // 6. Validaciones y flags
  const flags: string[] = [];
  
  if (!data.quotation) {
    flags.push('NO_QUOTATION');
  }
  
  // Flag si se usó targetHours como fallback para horas reales
  const hasHoursFallback = teamBreakdownData.some(t => t.usedTargetHoursFallback);
  if (hasHoursFallback) {
    flags.push('HOURS_FALLBACK_TO_TARGET');
  }
  
  // Validaciones de consistencia
  const sumHours = teamBreakdownData.reduce((sum, t) => sum + t.hours, 0);
  const sumTargetHours = teamBreakdownData.reduce((sum, t) => sum + t.targetHours, 0);
  
  if (Math.abs(sumHours - totalRealHours) > 1e-6) {
    console.warn(`  ⚠️ Inconsistencia en horas: Σ teamBreakdown.hours (${sumHours}) !== totalWorkedHours (${totalRealHours})`);
  }
  
  if (Math.abs(sumTargetHours - totalTargetHours) > 1e-6) {
    console.warn(`  ⚠️ Inconsistencia en horas objetivo: Σ teamBreakdown.targetHours (${sumTargetHours}) !== estimatedHours (${totalTargetHours})`);
  }
  
  // 7. Guardar las 3 vistas
  const views: Array<{ type: ViewType; data: ViewData }> = [
    { type: 'original', data: originalView },
    { type: 'operativa', data: operativaView },
    { type: 'usd', data: usdView }
  ];
  
  for (const { type, data: viewData } of views) {
    const existing = await db.select()
      .from(projectAggregates)
      .where(
        and(
          eq(projectAggregates.projectPeriodId, periodId),
          eq(projectAggregates.viewType, type)
        )
      )
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(projectAggregates).values({
        projectPeriodId: periodId,
        viewType: type,
        currencyNative,
        baseData,
        viewData,
        quotationData,
        actualsData,
        flags
      });
    } else {
      await db.update(projectAggregates)
        .set({
          baseData,
          viewData,
          quotationData,
          actualsData,
          flags,
          updatedAt: new Date()
        })
        .where(eq(projectAggregates.id, existing[0].id));
    }
  }
  
  // 8. Guardar team_breakdown (legacy table - mantener para compatibilidad)
  console.log(`  🔧 Limpiando team_breakdown para period ${periodId}...`);
  await db.delete(teamBreakdown).where(eq(teamBreakdown.projectPeriodId, periodId));
  console.log(`  ✅ Team_breakdown limpiado`);
  
  for (const labor of data.laborRows) {
    await db.insert(teamBreakdown).values({
      projectPeriodId: periodId,
      personName: labor.personName,
      roleName: labor.roleName, // 🆕 Usar roleName real desde Excel
      targetHours: labor.targetHours.toString(),
      hoursReal: labor.hoursReal.toString(),
      hourlyRateARS: labor.hourlyRateARS.toString(),
      costARS: labor.costTotal.toString(),
      costUSD: labor.costUSD.toString(),
      isFromExcel: true
    });
  }
  
  console.log(`    ✅ ${data.projectName} (${data.clientName}): 3 vistas guardadas`);
}

/**
 * Endpoint de sincronización manual
 */
export async function syncMonthlyAggregates(periodKey: string) {
  try {
    await processProjectPeriod(periodKey);
    return { success: true, period: periodKey };
  } catch (error) {
    console.error(`❌ Error procesando ${periodKey}:`, error);
    throw error;
  }
}
