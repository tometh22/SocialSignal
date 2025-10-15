/**
 * ETL para Single Source of Truth (SoT)
 * Procesa Excel MAESTRO → fact_labor_month + fact_rc_month → agg_project_month
 */

import { db } from '../db';
import { dimPeriod, factLaborMonth, factRCMonth, aggProjectMonth, activeProjects, personnel, projectAliases } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { toPeriodKey, normKey, parseNum, prefer, normHours, needsAntiX100, generateFlags } from './sot-utils';

// ==================== PROJECT ID RESOLVER ====================

/**
 * Cache de mapeo cliente+proyecto → projectId
 */
const PROJECT_CACHE = new Map<string, number | null>();

// Mappings específicos reutilizados del sistema existente
const SPECIFIC_PROJECT_MAPPING: Record<string, number> = {
  'warner_fee marketing': 34,
  'warner_fee insights': 34,
  'kimberly clark_fee huggies': 39,
  'coca-cola_fee marketing': 36,
  'arcos dorados_dashboard': 37,
  'uber_uber taxis': 40,
  'play digital s.a (modo)_fee mensual': 42,
  'play digital s.a (modo)_fee_mensual': 42,
  'coelsa_fee mensual': 43,
  'detroit_fee mensual': 44,
  'vertical media_fee mensual': 41,
};

const CLIENT_ONLY_MAPPING: Record<string, number> = {
  'warner': 34,
  'kimberly clark': 39,
  'coca-cola': 36,
  'arcos dorados': 37,
  'uber': 40,
  'play digital s.a (modo)': 42,
  'coelsa': 43,
  'detroit': 44,
  'vertical media': 41,
};

/**
 * Resuelve projectId desde nombre de cliente y proyecto del Excel
 * Orden de resolución: cache → DB aliases → hardcoded mappings → fuzzy
 */
async function resolveProjectId(clientName: string, projectName: string): Promise<number | null> {
  const cacheKey = `${normKey(clientName)}::${normKey(projectName)}`;
  
  // 0. Check cache first
  if (PROJECT_CACHE.has(cacheKey)) {
    return PROJECT_CACHE.get(cacheKey) || null;
  }
  
  const normalizedClient = normKey(clientName);
  const normalizedProject = normKey(projectName);
  const clientProjectKey = `${normalizedClient}_${normalizedProject}`;
  
  // 1. Try project aliases table (highest priority)
  // Apply same normalization as normKey() for accurate matching
  const alias = await db.query.projectAliases.findFirst({
    where: and(
      eq(projectAliases.isActive, true),
      sql`
        LOWER(
          UNACCENT(
            REGEXP_REPLACE(TRIM(${projectAliases.excelClient}), '\\s+', ' ', 'g')
          )
        ) = ${normalizedClient}
      `,
      sql`
        LOWER(
          UNACCENT(
            REGEXP_REPLACE(TRIM(${projectAliases.excelProject}), '\\s+', ' ', 'g')
          )
        ) = ${normalizedProject}
      `
    )
  });
  
  if (alias) {
    PROJECT_CACHE.set(cacheKey, alias.projectId);
    console.log(`🔗 Proyecto encontrado vía alias DB: ${clientName} + ${projectName} → Proyecto ${alias.projectId}`);
    
    // Update lastMatchedAt
    await db.update(projectAliases)
      .set({ lastMatchedAt: new Date() })
      .where(eq(projectAliases.id, alias.id))
      .catch(() => {}); // Silent fail for perf
    
    return alias.projectId;
  }
  
  // 2. Try specific client+project hardcoded mapping
  if (SPECIFIC_PROJECT_MAPPING[clientProjectKey]) {
    const projectId = SPECIFIC_PROJECT_MAPPING[clientProjectKey];
    PROJECT_CACHE.set(cacheKey, projectId);
    console.log(`🔗 Proyecto encontrado vía mapeo específico: ${clientName} + ${projectName} → Proyecto ${projectId}`);
    return projectId;
  }
  
  // 3. Try client-only fallback mapping
  if (CLIENT_ONLY_MAPPING[normalizedClient]) {
    const projectId = CLIENT_ONLY_MAPPING[normalizedClient];
    PROJECT_CACHE.set(cacheKey, projectId);
    console.log(`🔗 Proyecto encontrado vía mapeo de cliente (fallback): ${clientName} → Proyecto ${projectId}`);
    return projectId;
  }
  
  // 4. Fetch all active projects with relations for fuzzy matching
  const projects = await db.query.activeProjects.findMany({
    with: {
      client: true,
      quotation: true
    }
  });
  
  // 5. Try fuzzy match by client name + project name
  const match = projects.find(p => {
    const projectClientName = normKey(p.client?.name || '');
    const projectQuoteName = normKey(p.quotation?.projectName || '');
    
    // Client match
    const clientMatch = projectClientName === normalizedClient || 
                       projectClientName.includes(normalizedClient) ||
                       normalizedClient.includes(projectClientName);
    
    // Project match
    const projectMatch = projectQuoteName === normalizedProject ||
                         projectQuoteName.includes(normalizedProject) ||
                         normalizedProject.includes(projectQuoteName);
    
    return clientMatch && projectMatch;
  });
  
  const result = match?.id || null;
  PROJECT_CACHE.set(cacheKey, result);
  
  if (!result) {
    console.log(`⚠️ No se encontró mapeo para: ${clientName} :: ${projectName}`);
  } else {
    console.log(`🔍 Proyecto encontrado vía fuzzy matching: ${clientName} + ${projectName} → Proyecto ${result}`);
  }
  
  return result;
}

/**
 * Limpia el cache de proyectos (útil para testing/re-imports)
 */
export function clearProjectCache(): void {
  PROJECT_CACHE.clear();
  console.log('🧹 Cache de proyectos limpiado');
}

// ==================== DIMENSIÓN: PERÍODOS ====================

/**
 * Asegura que un período exista en dim_period
 */
export async function ensurePeriod(periodKey: string): Promise<void> {
  const [year, month] = periodKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  
  await db.insert(dimPeriod)
    .values({
      periodKey,
      year,
      month,
      firstDay,
      businessDays: 22 // Default, puede ajustarse
    })
    .onConflictDoNothing();
}

// ==================== HECHOS: LABOR (COSTOS DIRECTOS) ====================

export interface CostoDirectoRow {
  Cliente?: string;
  Proyecto?: string;
  Mes?: string;
  Año?: string | number;
  Detalle?: string; // Persona
  'Tipo de Costo'?: string;
  'Tipo de Coste'?: string; // Variante header
  'Tipo Costo'?: string; // Variante header
  'Cantidad de horas objetivo'?: any;
  'Cantidad de horas reales Asana'?: any;
  'Cantidad de horas para facturación'?: any;
  'Valor hora ARS'?: any;
  'Valor Hora'?: any;
  'Total ARS'?: any;
  'Cotización'?: any;
  'Tipo de cambio'?: any;
  'Monto Total USD'?: any;
  Rol?: string;
  __rowId?: string;
}

/**
 * ETL: Costos directos e indirectos → fact_labor_month
 * Aplica filtro "Directo", ANTI×100, normalización y derivación de billing_hours
 */
export async function processDirectCostsToFactLabor(rows: CostoDirectoRow[]): Promise<void> {
  console.log(`📊 [SoT ETL] Procesando ${rows.length} filas de costos directos...`);
  
  let processed = 0;
  let skipped = 0;
  
  for (const row of rows) {
    try {
      // 1) Filtro: Solo "Directo" (soportar variantes de header)
      const tipoCosto = normKey(
        row['Tipo de Costo'] || 
        row['Tipo de Coste'] || 
        row['Tipo Costo'] || 
        ''
      );
      if (!tipoCosto.includes('directo') || tipoCosto.includes('indirecto')) {
        skipped++;
        continue;
      }
      
      // 2) Extraer valores RAW (sin normalizar aún)
      const periodKey = toPeriodKey(row.Mes, row.Año);
      const clientRaw = row.Cliente || '';
      const projectRaw = row.Proyecto || '';
      const personRaw = row.Detalle || '';
      
      // Claves normalizadas para storage (guardar en fact table)
      const clientKey = normKey(clientRaw);
      const projectKey = normKey(projectRaw);
      const personKey = normKey(personRaw);
      
      if (!clientKey || !projectKey || !personKey) {
        skipped++;
        continue;
      }
      
      // Asegurar período
      await ensurePeriod(periodKey);
      
      // 3) Horas con ANTI×100
      const targetRaw = parseNum(row['Cantidad de horas objetivo']);
      let asanaRaw = parseNum(row['Cantidad de horas reales Asana']);
      let billingRaw = parseNum(row['Cantidad de horas para facturación']);
      
      // ANTI×100: solo en asana y billing, NO en target
      const asana = normHours(asanaRaw);
      const billing = normHours(billingRaw);
      const target = targetRaw; // No normalizar target
      
      // Derivar billing_hours con prefer
      const billingHours = prefer(billing, asana, target);
      
      // 4) Valores y costos
      const rateARS = parseNum(row['Valor hora ARS'] || row['Valor Hora']);
      const fx = parseNum(row['Cotización'] || row['Tipo de cambio']);
      const totalARSSheet = parseNum(row['Total ARS']);
      const totalUSDSheet = parseNum(row['Monto Total USD']);
      
      const costARS = totalARSSheet || (billingHours * rateARS);
      const costUSD = totalUSDSheet || (fx > 0 ? costARS / fx : 0);
      
      // 5) Buscar projectId y personId - USAR VALORES RAW
      const projectId = await resolveProjectId(clientRaw, projectRaw);
      
      if (!projectId) {
        console.log(`⚠️ Proyecto no encontrado: ${clientKey} :: ${projectKey}`);
        skipped++;
        continue;
      }
      
      // Buscar persona con normalización de acentos en ambos lados
      // COALESCE y TRIM para manejar NULL y whitespace
      const person = await db.query.personnel.findFirst({
        where: (pers) => sql`
          TRIM(LOWER(UNACCENT(COALESCE(${pers.name}, '')))) = 
          TRIM(LOWER(UNACCENT(COALESCE(${personRaw}, ''))))
          AND ${pers.name} IS NOT NULL
        `
      });
      
      // 6) Flags
      const flags = generateFlags({
        'anti_x100_asana': needsAntiX100(asanaRaw),
        'anti_x100_billing': needsAntiX100(billingRaw),
        'fallback_billing': !billingRaw,
        'derived_cost_ars': !totalARSSheet,
        'derived_cost_usd': !totalUSDSheet
      });
      
      // 7) Upsert fact_labor_month
      await db.insert(factLaborMonth)
        .values({
          projectId,
          personId: person?.id || null,
          periodKey,
          clientKey,
          projectKey,
          personKey,
          targetHours: target.toString(),
          asanaHours: asana.toString(),
          billingHours: billingHours.toString(),
          hourlyRateARS: rateARS.toString(),
          costARS: costARS.toString(),
          costUSD: costUSD.toString(),
          fx: fx.toString(),
          roleName: row.Rol || null,
          flags,
          sourceRowId: row.__rowId || `row_${processed}`
        })
        .onConflictDoUpdate({
          target: [factLaborMonth.projectId, factLaborMonth.personKey, factLaborMonth.periodKey],
          set: {
            targetHours: target.toString(),
            asanaHours: asana.toString(),
            billingHours: billingHours.toString(),
            hourlyRateARS: rateARS.toString(),
            costARS: costARS.toString(),
            costUSD: costUSD.toString(),
            fx: fx.toString(),
            roleName: row.Rol || null,
            flags
          }
        });
      
      processed++;
      
      if (needsAntiX100(asanaRaw) || needsAntiX100(billingRaw)) {
        console.log(`🔧 ANTI×100 aplicado: ${personKey} - Asana: ${asanaRaw}→${asana}, Billing: ${billingRaw}→${billing}`);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando fila de costo directo:`, error);
      skipped++;
    }
  }
  
  console.log(`✅ [SoT ETL] Costos directos: ${processed} procesados, ${skipped} saltados`);
}

// ==================== HECHOS: RC (RENDIMIENTO CLIENTE) ====================

export interface RendimientoClienteRow {
  Cliente?: string;
  Proyecto?: string;
  Mes?: string;
  Año?: string | number;
  'Facturación [USD]'?: any;
  'Costos [USD]'?: any;
  'Facturación [ARS]'?: any;
  'Costos [ARS]'?: any;
  'Cotización'?: any; // Precio del mes (denominador)
  'Precio'?: any;
  FX?: any;
  'Tipo de cambio'?: any;
  __rowId?: string;
}

/**
 * ETL: Rendimiento Cliente → fact_rc_month
 * Extrae ingresos/costos mensuales y precio del mes (denominador)
 */
export async function processRendimientoClienteToFactRC(rows: RendimientoClienteRow[]): Promise<void> {
  console.log(`📊 [SoT ETL] Procesando ${rows.length} filas de Rendimiento Cliente...`);
  
  let processed = 0;
  let skipped = 0;
  
  for (const row of rows) {
    try {
      // 1) Extraer valores RAW (sin normalizar)
      const periodKey = toPeriodKey(row.Mes, row.Año);
      const clientRaw = row.Cliente || '';
      const projectRaw = row.Proyecto || '';
      
      // Claves normalizadas (no usadas para resolver projectId)
      const clientKey = normKey(clientRaw);
      const projectKey = normKey(projectRaw);
      
      if (!clientKey || !projectKey) {
        skipped++;
        continue;
      }
      
      // Asegurar período
      await ensurePeriod(periodKey);
      
      // 2) Valores
      const revenueUSD = parseNum(row['Facturación [USD]']);
      const costUSD = parseNum(row['Costos [USD]']);
      const revenueARS = parseNum(row['Facturación [ARS]']);
      const costARS = parseNum(row['Costos [ARS]']);
      const priceNative = parseNum(row['Cotización'] || row['Precio']); // PRECIO del mes
      const fx = parseNum(row.FX || row['Tipo de cambio']);
      
      // 3) Buscar projectId - USAR VALORES RAW
      const projectId = await resolveProjectId(clientRaw, projectRaw);
      
      if (!projectId) {
        console.log(`⚠️ Proyecto no encontrado: ${clientKey} :: ${projectKey}`);
        skipped++;
        continue;
      }
      
      // 4) Upsert fact_rc_month
      await db.insert(factRCMonth)
        .values({
          projectId,
          periodKey,
          revenueUSD: revenueUSD.toString(),
          costUSD: costUSD.toString(),
          revenueARS: revenueARS.toString(),
          costARS: costARS.toString(),
          priceNative: priceNative.toString(),
          fx: fx.toString(),
          sourceRowId: row.__rowId || `row_${processed}`
        })
        .onConflictDoUpdate({
          target: [factRCMonth.projectId, factRCMonth.periodKey],
          set: {
            revenueUSD: revenueUSD.toString(),
            costUSD: costUSD.toString(),
            revenueARS: revenueARS.toString(),
            costARS: costARS.toString(),
            priceNative: priceNative.toString(),
            fx: fx.toString()
          }
        });
      
      processed++;
      
    } catch (error) {
      console.error(`❌ Error procesando fila de RC:`, error);
      skipped++;
    }
  }
  
  console.log(`✅ [SoT ETL] Rendimiento Cliente: ${processed} procesados, ${skipped} saltados`);
}

// ==================== AGREGADO: AGG_PROJECT_MONTH ====================

/**
 * Computa agg_project_month desde fact_labor_month + fact_rc_month
 * Valida invariantes matemáticos
 */
export async function computeAggProjectMonth(projectId: number, periodKey: string): Promise<void> {
  // 1) Obtener agregados de labor
  const laborAgg = await db.select({
    estHours: sql<number>`SUM(CAST(${factLaborMonth.targetHours} AS NUMERIC))`,
    totalAsanaHours: sql<number>`SUM(CAST(${factLaborMonth.asanaHours} AS NUMERIC))`,
    totalBillingHours: sql<number>`SUM(CAST(${factLaborMonth.billingHours} AS NUMERIC))`,
    totalCostARS: sql<number>`SUM(CAST(${factLaborMonth.costARS} AS NUMERIC))`,
    totalCostUSD: sql<number>`SUM(CAST(${factLaborMonth.costUSD} AS NUMERIC))`
  })
  .from(factLaborMonth)
  .where(and(
    eq(factLaborMonth.projectId, projectId),
    eq(factLaborMonth.periodKey, periodKey)
  ))
  .then(rows => rows[0] || {
    estHours: 0,
    totalAsanaHours: 0,
    totalBillingHours: 0,
    totalCostARS: 0,
    totalCostUSD: 0
  });
  
  // 2) Obtener datos de RC
  const rcData = await db.query.factRCMonth.findFirst({
    where: and(
      eq(factRCMonth.projectId, projectId),
      eq(factRCMonth.periodKey, periodKey)
    )
  });
  
  // 3) Derivar moneda nativa desde datos de RC
  // Heurística: si revenueARS > revenueUSD * 10, entonces es ARS, sino USD
  let currencyNative: 'ARS' | 'USD' = 'USD';
  if (rcData) {
    const revARS = parseNum(rcData.revenueARS);
    const revUSD = parseNum(rcData.revenueUSD);
    const fx = parseNum(rcData.fx) || 1;
    
    // Si ARS es significativamente mayor que USD convertido, es un proyecto ARS
    if (revARS > 0 && revUSD > 0 && revARS > (revUSD * fx * 0.8)) {
      currencyNative = 'ARS';
    } else if (revARS > 0 && revUSD === 0) {
      currencyNative = 'ARS';
    }
  }
  
  // 4) Calcular vista operativa
  let viewRevenue = 0;
  let viewCost = 0;
  let viewDenom = 0;
  
  if (rcData) {
    if (currencyNative === 'USD') {
      viewRevenue = parseNum(rcData.revenueUSD);
      viewCost = parseNum(laborAgg.totalCostUSD) || parseNum(rcData.costUSD);
      viewDenom = parseNum(rcData.priceNative);
    } else {
      viewRevenue = parseNum(rcData.revenueARS);
      viewCost = parseNum(laborAgg.totalCostARS) || parseNum(rcData.costARS);
      viewDenom = parseNum(rcData.priceNative);
    }
  }
  
  // 5) Calcular KPIs
  const markup = viewCost > 0 ? viewRevenue / viewCost : 0;
  const margin = viewRevenue > 0 ? (viewRevenue - viewCost) / viewRevenue : 0;
  const budgetUtil = viewDenom > 0 ? viewCost / viewDenom : 0;
  
  // 6) Flags
  const costDiff = Math.abs(parseNum(laborAgg.totalCostUSD) - parseNum(rcData?.costUSD || 0));
  const costDiffPct = parseNum(rcData?.costUSD) > 0 ? (costDiff / parseNum(rcData?.costUSD || 1)) * 100 : 0;
  
  const flags = generateFlags({
    'labor_vs_rc_cost_mismatch': costDiffPct > 10
  });
  
  // 7) Upsert agg_project_month
  await db.insert(aggProjectMonth)
    .values({
      projectId,
      periodKey,
      estHours: laborAgg.estHours.toString(),
      totalAsanaHours: laborAgg.totalAsanaHours.toString(),
      totalBillingHours: laborAgg.totalBillingHours.toString(),
      totalCostARS: laborAgg.totalCostARS.toString(),
      totalCostUSD: laborAgg.totalCostUSD.toString(),
      viewOperativaRevenue: viewRevenue.toString(),
      viewOperativaCost: viewCost.toString(),
      viewOperativaDenom: viewDenom.toString(),
      viewOperativaMarkup: markup.toString(),
      viewOperativaMargin: margin.toString(),
      viewOperativaBudgetUtil: budgetUtil.toString(),
      rcRevenueNative: rcData ? (currencyNative === 'USD' ? rcData.revenueUSD : rcData.revenueARS) : null,
      rcCostNative: rcData ? (currencyNative === 'USD' ? rcData.costUSD : rcData.costARS) : null,
      rcPriceNative: rcData?.priceNative || null,
      fx: rcData?.fx || null,
      flags
    })
    .onConflictDoUpdate({
      target: [aggProjectMonth.projectId, aggProjectMonth.periodKey],
      set: {
        estHours: laborAgg.estHours.toString(),
        totalAsanaHours: laborAgg.totalAsanaHours.toString(),
        totalBillingHours: laborAgg.totalBillingHours.toString(),
        totalCostARS: laborAgg.totalCostARS.toString(),
        totalCostUSD: laborAgg.totalCostUSD.toString(),
        viewOperativaRevenue: viewRevenue.toString(),
        viewOperativaCost: viewCost.toString(),
        viewOperativaDenom: viewDenom.toString(),
        viewOperativaMarkup: markup.toString(),
        viewOperativaMargin: margin.toString(),
        viewOperativaBudgetUtil: budgetUtil.toString(),
        rcRevenueNative: rcData ? (currencyNative === 'USD' ? rcData.revenueUSD : rcData.revenueARS) : null,
        rcCostNative: rcData ? (currencyNative === 'USD' ? rcData.costUSD : rcData.costARS) : null,
        rcPriceNative: rcData?.priceNative || null,
        fx: rcData?.fx || null,
        flags
      }
    });
  
  // 📊 OBSERVABILIDAD: Log detallado por project+period
  console.log(`📊 [SoT AGG] Project ${projectId} - ${periodKey}:`);
  console.log(`  ├─ Hours: target=${laborAgg.estHours.toFixed(1)}, asana=${laborAgg.totalAsanaHours.toFixed(1)}, billing=${laborAgg.totalBillingHours.toFixed(1)}`);
  console.log(`  ├─ Costs: ARS=${laborAgg.totalCostARS.toFixed(0)}, USD=${laborAgg.totalCostUSD.toFixed(2)}`);
  console.log(`  ├─ RC: revenue=${viewRevenue.toFixed(2)}, cost=${viewCost.toFixed(2)}, denom=${viewDenom.toFixed(2)} [${currencyNative}]`);
  console.log(`  ├─ KPIs: BU=${(budgetUtil * 100).toFixed(1)}%, Markup=${markup.toFixed(2)}x, Margin=${(margin * 100).toFixed(1)}%`);
  console.log(`  └─ Flags: ${flags.join(', ') || 'none'}`);
  
  // 🔬 DEV ASSERTIONS: Invariantes matemáticos
  if (process.env.NODE_ENV !== 'production') {
    const epsilon = 0.01; // Tolerancia para comparaciones float
    
    // Invariante: budgetUtil = cost / denom
    const expectedBU = viewDenom > 0 ? viewCost / viewDenom : 0;
    if (Math.abs(budgetUtil - expectedBU) > epsilon) {
      console.warn(`⚠️ [ASSERTION] BU mismatch: computed=${budgetUtil.toFixed(4)} vs expected=${expectedBU.toFixed(4)}`);
    }
    
    // Invariante: markup = revenue / cost
    const expectedMarkup = viewCost > 0 ? viewRevenue / viewCost : 0;
    if (Math.abs(markup - expectedMarkup) > epsilon) {
      console.warn(`⚠️ [ASSERTION] Markup mismatch: computed=${markup.toFixed(4)} vs expected=${expectedMarkup.toFixed(4)}`);
    }
    
    // Invariante: margin = (revenue - cost) / revenue
    const expectedMargin = viewRevenue > 0 ? (viewRevenue - viewCost) / viewRevenue : 0;
    if (Math.abs(margin - expectedMargin) > epsilon) {
      console.warn(`⚠️ [ASSERTION] Margin mismatch: computed=${margin.toFixed(4)} vs expected=${expectedMargin.toFixed(4)}`);
    }
  }
}

// ==================== ORQUESTADOR COMPLETO ====================

export interface SoTETLResult {
  success: boolean;
  periodsProcessed: string[];
  laborRowsProcessed: number;
  rcRowsProcessed: number;
  aggregatesComputed: number;
  errors: string[];
  executionTimeMs: number;
}

/**
 * Orquestador completo del ETL SoT
 * 1. Lee Excel MAESTRO (Costos directos + Rendimiento Cliente)
 * 2. Procesa a fact_labor_month + fact_rc_month
 * 3. Computa agg_project_month
 */
export async function executeSoTETL(
  costosDirectosRows: CostoDirectoRow[],
  rendimientoClienteRows: RendimientoClienteRow[]
): Promise<SoTETLResult> {
  const startTime = Date.now();
  console.log('🚀 [SoT ETL] Iniciando ETL completo...');
  
  try {
    // Limpiar cache de proyectos para forzar re-resolve
    clearProjectCache();
    
    // 1. Procesar labor (costos directos)
    await processDirectCostsToFactLabor(costosDirectosRows);
    
    // 2. Procesar RC (rendimiento cliente)
    await processRendimientoClienteToFactRC(rendimientoClienteRows);
    
    // 3. Obtener períodos únicos de ambas tablas
    const periods = await db.select({ periodKey: factLaborMonth.periodKey })
      .from(factLaborMonth)
      .union(
        db.select({ periodKey: factRCMonth.periodKey }).from(factRCMonth)
      )
      .then(rows => Array.from(new Set(rows.map(r => r.periodKey))));
    
    console.log(`📊 [SoT ETL] Períodos únicos encontrados: ${periods.join(', ')}`);
    
    // 4. Obtener proyectos únicos
    const projects = await db.select({ projectId: factLaborMonth.projectId })
      .from(factLaborMonth)
      .union(
        db.select({ projectId: factRCMonth.projectId }).from(factRCMonth)
      )
      .then(rows => Array.from(new Set(rows.map(r => r.projectId))));
    
    console.log(`📊 [SoT ETL] Proyectos únicos encontrados: ${projects.length}`);
    
    // 5. Computar agregados para cada proyecto x período
    let aggregatesComputed = 0;
    for (const projectId of projects) {
      for (const periodKey of periods) {
        await computeAggProjectMonth(projectId, periodKey);
        aggregatesComputed++;
      }
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    const result: SoTETLResult = {
      success: true,
      periodsProcessed: periods,
      laborRowsProcessed: costosDirectosRows.length,
      rcRowsProcessed: rendimientoClienteRows.length,
      aggregatesComputed,
      errors: [],
      executionTimeMs
    };
    
    console.log(`✅ [SoT ETL] Completado en ${executionTimeMs}ms`);
    console.log(`📊 Resumen: ${result.laborRowsProcessed} labor + ${result.rcRowsProcessed} RC → ${result.aggregatesComputed} agregados`);
    
    return result;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [SoT ETL] Error ejecutando ETL:', error);
    return {
      success: false,
      periodsProcessed: [],
      laborRowsProcessed: 0,
      rcRowsProcessed: 0,
      aggregatesComputed: 0,
      errors: [errorMessage],
      executionTimeMs: Date.now() - startTime
    };
  }
}
