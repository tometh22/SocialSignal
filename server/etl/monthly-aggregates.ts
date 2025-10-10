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
  // De financialSot
  revenueUSD: number;
  costUSD: number;
  quotationUSD: number | null;
  fxMonth: number;
  // De directCosts
  laborRows: Array<{
    personName: string;
    targetHours: number;
    hoursReal: number;
    hourlyRateARS: number;
    costTotal: number; // En ARS generalmente
    costUSD: number;
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
 * Calcula la vista Original (datos raw, puede mezclar monedas)
 */
function computeOriginalView(data: RawPeriodData): ViewData {
  // Revenue siempre viene en USD de financialSot
  // Cost puede venir en USD o calcularse desde labor rows en ARS
  
  const laborCostARS = data.laborRows.reduce((sum, r) => sum + r.costTotal, 0);
  
  return {
    revenue: data.revenueUSD,
    revenueCurrency: 'USD',
    cost: laborCostARS || data.costUSD, // Preferir labor rows si existe
    costCurrency: laborCostARS > 0 ? 'ARS' : 'USD',
    currency: 'MIXED',
    cotizacion: null, // No calculable si mezcla monedas
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
    // Cliente USD: usar directamente revenue y cost USD
    revenue = data.revenueUSD;
    cost = data.costUSD;
    currency = 'USD';
    cotizacion = data.quotationUSD;
  } else {
    // Cliente ARS: convertir revenue a ARS, cost ya está en ARS (labor rows)
    revenue = data.revenueUSD * data.fxMonth;
    const laborCostARS = data.laborRows.reduce((sum, r) => sum + r.costTotal, 0);
    cost = laborCostARS || (data.costUSD * data.fxMonth);
    currency = 'ARS';
    cotizacion = data.quotationUSD ? (data.quotationUSD * data.fxMonth) : null;
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
  const revenue = data.revenueUSD;
  const cost = data.costUSD;
  const cotizacion = data.quotationUSD;
  
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
      revenueUSD: parseFloat(row.revenueUsd || '0'),
      costUSD: parseFloat(row.costUsd || '0'),
      quotationUSD: null, // Se podría obtener de otra tabla
      fxMonth: parseFloat(row.fx || '1345'),
      laborRows: []
    });
  }
  
  // Procesar directCosts
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
        costUSD: 0,
        quotationUSD: null,
        fxMonth: fx,
        laborRows: []
      });
    }
    
    const data = projectMap.get(key)!;
    
    // Agregar fila de labor
    data.laborRows.push({
      personName: row.persona,
      targetHours: row.horasObjetivo || 0,
      hoursReal: row.horasParaFacturacion || row.horasRealesAsana,
      hourlyRateARS: parseFloat(row.valorHoraLocalCurrency || '0'),
      costTotal: row.costoTotal,
      costUSD: parseFloat(row.montoTotalUSD || '0')
    });
    
    // Actualizar costUSD total
    data.costUSD += parseFloat(row.montoTotalUSD || '0');
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
  // 1. Buscar proyecto en active_projects por nombre
  const project = await db.select()
    .from(activeProjects)
    .where(eq(activeProjects.subprojectName, data.projectName))
    .limit(1);
  
  if (project.length === 0) {
    console.log(`  ⚠️ Proyecto "${data.projectName}" no encontrado en active_projects, omitiendo...`);
    return;
  }
  
  const projectId = project[0].id;
  
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
    revenue_ars: data.revenueUSD * data.fxMonth,
    cost_usd: data.costUSD,
    cost_ars: laborCostARS,
    quotation_usd: data.quotationUSD,
    quotation_ars: data.quotationUSD ? (data.quotationUSD * data.fxMonth) : null,
    fx: data.fxMonth
  };
  
  // 4. Calcular quotation y actuals
  const totalTargetHours = data.laborRows.reduce((sum, r) => sum + r.targetHours, 0);
  const totalRealHours = data.laborRows.reduce((sum, r) => sum + r.hoursReal, 0);
  
  const quotationData = {
    totalAmountNative: isUSDClient(data.clientName) ? data.quotationUSD : (data.quotationUSD ? data.quotationUSD * data.fxMonth : null),
    totalAmountUSD: data.quotationUSD,
    estimatedHours: totalTargetHours
  };
  
  const actualsData = {
    totalWorkedHours: totalRealHours,
    totalWorkedCost: data.costUSD,
    teamBreakdown: data.laborRows.map(r => ({
      personnelId: r.personName,
      name: r.personName,
      roleName: 'From Excel MAESTRO', // No tenemos rol en directCosts
      targetHours: r.targetHours,
      actualHours: r.hoursReal,
      actualCost: r.costUSD,
      hourlyRateARS: r.hourlyRateARS,
      costARS: r.costTotal,
      isFromExcel: true
    }))
  };
  
  // 5. Calcular 3 vistas
  const originalView = computeOriginalView(data);
  const operativaView = computeOperativaView(data);
  const usdView = computeUSDView(data);
  
  const currencyNative = isUSDClient(data.clientName) ? 'USD' : 'ARS';
  
  // 6. Validaciones y flags
  const flags: string[] = [];
  
  if (!data.quotationUSD) {
    flags.push('NO_QUOTATION');
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
  
  // 8. Guardar team_breakdown
  await db.delete(teamBreakdown).where(eq(teamBreakdown.projectPeriodId, periodId));
  
  for (const labor of data.laborRows) {
    await db.insert(teamBreakdown).values({
      projectPeriodId: periodId,
      personName: labor.personName,
      roleName: 'From Excel MAESTRO',
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
