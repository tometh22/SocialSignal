/**
 * ETL para Single Source of Truth (SoT)
 * Procesa Excel MAESTRO → fact_labor_month + fact_rc_month → agg_project_month
 */

import { db } from '../db';
import { dimPeriod, factLaborMonth, factRCMonth, aggProjectMonth, activeProjects, personnel, projectAliases } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { toPeriodKey, normKey, parseNum, prefer, normHours, needsAntiX100, generateFlags } from './sot-utils';
import { resolveRCRow } from './sot-project-resolver';

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
  'Valor hora ARS'?: any; // Puede no existir en el Excel
  'Valor Hora'?: any; // Puede no existir en el Excel
  'Total ARS'?: any; // Variante antigua
  'Monto Total ARS'?: any; // Nombre real del Excel
  'Monto Original ARS'?: any; // Columna adicional del Excel
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
      
      // 4) Buscar projectId usando nuevo resolver V2 con logging automático
      const resolution = await resolveRCRow(periodKey, clientRaw, projectRaw);
      let projectId = resolution.projectId;
      
      // 🎯 FALLBACK: Si no se resuelve el proyecto, usar proyecto comodín "Costos no asignados"
      const FALLBACK_PROJECT_ID = 50; // ID del proyecto comodín
      if (!projectId) {
        const lostUSD = parseNum(row['Monto Total USD']);
        console.log(`⚠️ [${periodKey}] Proyecto no encontrado: "${clientRaw}" :: "${projectRaw}" - USD: $${lostUSD.toFixed(2)} → ROUTING TO FALLBACK PROJECT [${resolution.diagnostics.motivo}]`);
        projectId = FALLBACK_PROJECT_ID;
        // No hacer continue - procesar la fila con el fallback project
      }
      
      // Log nuevos alias auto-creados
      if (resolution.diagnostics.clientResolution?.isNewAlias) {
        console.log(`✨ Cliente auto-resuelto: "${clientRaw}" (score: ${resolution.diagnostics.clientResolution.fuzzyScore?.toFixed(2)})`);
      }
      if (resolution.diagnostics.projectResolution?.isNewAlias) {
        console.log(`✨ Proyecto auto-resuelto: "${projectRaw}" via ${resolution.diagnostics.projectResolution.matchType}`);
      }
      
      // 🎯 MAPEO DE ROLES: Buscar persona con sistema flexible de mapeo de nombres
      const nameVariants: { [key: string]: string[] } = {
        'victoria achabal': ['victoria achabal', 'vicky achabal'],
        'trinidad petreigne': ['trinidad petreigne', 'trini petreigne'],
        'tomas facio': ['tomas facio', 'tomi facio'],
        'vanina lanza': ['vanina lanza', 'vanu lanza'],
        'aylen magali': ['aylen magali', 'aylu tamer'],
        'gastón guntren': ['gastón guntren', 'gast guntren'],
        'dolores camara': ['dolores camara', 'lola camara'],
        'malena quiroga': ['malena quiroga', 'male quiroga'],
        'sol ayala': ['sol ayala']
      };
      
      // Buscar persona primero por coincidencia exacta
      let person = await db.query.personnel.findFirst({
        where: (pers) => sql`
          TRIM(LOWER(UNACCENT(COALESCE(${pers.name}, '')))) = 
          TRIM(LOWER(UNACCENT(COALESCE(${personRaw}, ''))))
          AND ${pers.name} IS NOT NULL
        `
      });
      
      // Si no se encontró, buscar usando variantes de nombres
      if (!person) {
        const personNormalized = personRaw.toLowerCase().trim();
        for (const [canonical, variants] of Object.entries(nameVariants)) {
          if (variants.includes(personNormalized) || canonical === personNormalized) {
            // Buscar por nombre canónico
            person = await db.query.personnel.findFirst({
              where: (pers) => sql`
                TRIM(LOWER(UNACCENT(COALESCE(${pers.name}, '')))) = ${canonical}
                AND ${pers.name} IS NOT NULL
              `
            });
            if (person) {
              console.log(`✅ Role mapping: "${personRaw}" → "${canonical}" → ${person.name}`);
              break;
            }
          }
        }
      }
      
      let roleFromDB: string | null = null;
      if (person?.roleId) {
        const {roles} = await import('@shared/schema');
        const role = await db.query.roles.findFirst({
          where: (r) => eq(r.id, person.roleId!)
        });
        if (role) {
          roleFromDB = role.name;
          console.log(`🎯 Role found for ${personRaw}: ${role.name}`);
        }
      }
      
      // 5) Valores y costos con sistema de fallback de tarifas
      // Leer tarifa horaria del Excel (columna N: "Valor Hora")
      const rateARSExcelRaw = row['Valor Hora'] || row['Valor hora ARS'];
      const rateARSExcel = parseNum(rateARSExcelRaw);
      
      // Leer tipo de cambio del Excel - usar nombre correcto "Cotización"
      const fxRaw = row['Cotización'] || row['Tipo de cambio'];
      const fx = parseNum(fxRaw);
      
      // IMPORTANTE: Excel NO tiene "Monto Total ARS", solo "Monto Total USD"
      // Calcular Monto Total ARS = Horas × Valor Hora ARS
      const totalARSSheet = (rateARSExcel && billingHours) 
        ? billingHours * rateARSExcel 
        : 0;
      const totalUSDSheet = parseNum(row['Monto Total USD']);
      
      // Priorizar rol desde BD sobre rol del Excel
      const roleName = roleFromDB || row.Rol || null;
      
      // 🔍 DEBUG: Log valores leídos del Excel para detectar problemas de parsing
      if (processed < 5) {
        console.log(`📋 [DEBUG Row ${processed}] ${personKey}:`);
        console.log(`   - Valor Hora (raw): "${rateARSExcelRaw}" → parsed: ${rateARSExcel}`);
        console.log(`   - Tipo cambio (raw): "${fxRaw}" → parsed: ${fx}`);
        console.log(`   - Monto Total ARS: ${totalARSSheet}`);
        console.log(`   - Horas billing: ${billingHours}`);
      }
      
      // 🔍 CALCULAR tarifa horaria desde costo total si no existe en Excel
      // Si no hay tarifa explícita pero hay costo total y horas, calcular tarifa implícita
      let calculatedRateFromCost = 0;
      if ((!rateARSExcel || rateARSExcel === 0) && totalARSSheet > 0 && billingHours > 0) {
        calculatedRateFromCost = totalARSSheet / billingHours;
        console.log(`🧮 Tarifa calculada desde costo: ${personKey} = ${totalARSSheet} / ${billingHours} = ${calculatedRateFromCost.toFixed(2)} ARS/h`);
      }
      
      // Importar resolveHourlyRate dinámicamente (lazy load para evitar ciclos)
      const { resolveHourlyRate } = await import('./sot-rate-fallback');
      
      // Resolver tarifa con sistema de fallback (6 niveles de prioridad)
      // Prioridad: Excel explícito → Calculado desde costo → Catálogo → Histórico → Rol → RC
      const rateResolution = await resolveHourlyRate({
        excelRate: rateARSExcel,
        calculatedRate: calculatedRateFromCost, // Nueva opción: tarifa calculada desde costo
        personId: person?.id || null,
        projectId,
        periodKey,
        billingHours,
        personKey,
        roleName
      });
      
      const rateARS = rateResolution.rate;
      
      // 5.5) Aplicar guard ANTI×100 mejorado para costos usando verificación relacional
      const { normalizeCost } = await import('./sot-utils');
      const costARSNormalized = totalARSSheet 
        ? normalizeCost(totalARSSheet, rateARS, billingHours)
        : { cost: billingHours * rateARS, wasNormalized: false };
      
      const costARS = costARSNormalized.cost;
      
      // Fallback de FX: priorizar fx del Excel, sino buscar desde fact_rc_month del período
      let fxToUse = fx;
      if (fx === 0 || fx === null) {
        // Buscar FX del período desde fact_rc_month
        const rcFx = await db.query.factRCMonth.findFirst({
          where: and(
            eq(factRCMonth.projectId, projectId),
            eq(factRCMonth.periodKey, periodKey)
          )
        });
        
        if (rcFx && parseNum(rcFx.fx) > 0) {
          fxToUse = parseNum(rcFx.fx);
          console.log(`💱 FX fallback: Usando FX ${fxToUse} del RC para ${personKey} en ${periodKey}`);
        }
      }
      
      const costUSD = totalUSDSheet || (fxToUse > 0 ? costARS / fxToUse : 0);
      
      // 6) Flags (combinar flags base + flags de fallback de tarifas + ANTI×100 costos)
      const flags = generateFlags({
        'anti_x100_asana': needsAntiX100(asanaRaw),
        'anti_x100_billing': needsAntiX100(billingRaw),
        'anti_x100_cost_ars': costARSNormalized.wasNormalized,
        'fallback_billing': !billingRaw,
        'fallback_fx': fx === 0 && fxToUse > 0,
        'derived_cost_ars': !totalARSSheet,
        'derived_cost_usd': !totalUSDSheet,
        ...rateResolution.flags.reduce((acc, flag) => ({ ...acc, [flag]: true }), {})
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
          fx: fxToUse.toString(), // Usar fxToUse (incluye fallback) en lugar de fx
          roleName: roleName,
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
            fx: fxToUse.toString(), // Usar fxToUse (incluye fallback) en lugar de fx
            roleName: roleName,
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

// ==================== HECHOS: COSTOS AGREGADOS POR PERÍODO ====================

// Patrones para detectar PROVISIONES CONTABLES (no deben ir en Operativo)
// Según especificación: Pepsico, Warner, Impuestos USA, IVA, etc.
const PROVISION_PATTERNS = [
  'provision', 'provisión',
  'pepsico', 'warner',
  'impuestos usa', 'impuesto usa', 'tax usa',
  'iva', 'impuesto iva',
  'pasivo', 'pasivos',
  'ajuste', 'ajustes',
  'percepcion', 'percepción',
  'anticipo', 'anticipos',
  'facturacion adelantada', 'facturación adelantada',
  'diferido', 'devengado contable',
  'reserva', 'estimacion', 'estimación', 'contingencia'
];

// Subtipos de costo que indican provisiones/impuestos (de la columna "Subtipo de costo")
const PROVISION_SUBTYPES = [
  'provision', 'provisión', 'provisiones',
  'impuesto', 'impuestos', 'tax',
  'iva', 'percepcion', 'percepción',
  'ajuste', 'ajustes', 'pasivo', 'pasivos'
];

/**
 * Detecta si una fila contiene una provisión contable
 * Basado en múltiples campos: Proyecto, Cliente, Detalle, Subtipo, Descripcion, etc.
 * IMPORTANTE: Detecta provisiones INDEPENDIENTEMENTE del tipo de costo (Directo/Indirecto)
 */
function isProvision(row: CostoDirectoRow): boolean {
  // Campos principales a revisar
  const fieldsToCheck = [
    row.Proyecto || '',
    row.Cliente || '',
    row.Detalle || '',
    (row as any).Descripcion || '',
    (row as any).Concepto || '',
    (row as any).Categoria || '',
    (row as any).Cuenta || '',
    (row as any).Subcuenta || ''
  ];
  
  const combinedText = fieldsToCheck.join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Revisar patrones de provisión en texto combinado
  const matchesPattern = PROVISION_PATTERNS.some(pattern => {
    const normalizedPattern = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return combinedText.includes(normalizedPattern);
  });
  
  if (matchesPattern) return true;
  
  // Revisar subtipo de costo específicamente
  const subtipo = ((row as any)['Subtipo de costo'] || (row as any).Subtipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchesSubtype = PROVISION_SUBTYPES.some(st => subtipo.includes(st));
  
  return matchesSubtype;
}

/**
 * Determina el tipo de provisión para logging y análisis
 */
function getProvisionKind(row: CostoDirectoRow): string {
  const text = [
    row.Proyecto || '',
    row.Cliente || '',
    row.Detalle || '',
    (row as any)['Subtipo de costo'] || ''
  ].join(' ').toLowerCase();
  
  if (text.includes('pepsico')) return 'cliente_pepsico';
  if (text.includes('warner')) return 'cliente_warner';
  if (text.includes('impuestos usa') || text.includes('tax usa')) return 'impuestos_usa';
  if (text.includes('iva') || text.includes('percepcion')) return 'impuestos_iva';
  if (text.includes('provision') || text.includes('pasivo')) return 'provision_general';
  return 'otra';
}

/**
 * ETL: Costos directos e indirectos → fact_cost_month
 * Separa en 3 buckets:
 * - DIRECTOS: Tipo = "Directo" Y NO es provisión (costos de equipo operativos)
 * - INDIRECTOS OPERATIVOS: Tipo = "Indirecto" Y NO es provisión (overhead real)
 * - PROVISIONES: Cualquier tipo que SEA provisión/impuesto (solo Financiero)
 * 
 * IMPORTANTE: La detección de provisiones se hace PRIMERO, independientemente del tipo
 */
export async function processCostsByPeriod(rows: CostoDirectoRow[]): Promise<void> {
  console.log(`💰 [SoT ETL] Procesando costos agregados por período desde ${rows.length} filas...`);
  console.log(`   📋 Patrones de provisión activos: ${PROVISION_PATTERNS.slice(0, 5).join(', ')}...`);
  
  const { factCostMonth } = await import('@shared/schema');
  
  // 3 buckets: DIRECTOS, INDIRECTOS OPERATIVOS, PROVISIONES
  const periodCosts = new Map<string, {
    directUSD: number;
    directARS: number;
    indirectUSD: number;  // Solo overhead operativo real (SIN provisiones)
    indirectARS: number;
    provisionsUSD: number; // Provisiones contables (Pepsico, Warner, IVA, Impuestos USA, etc.)
    provisionsARS: number;
    directRows: number;
    indirectRows: number;
    provisionsRows: number;
    provisionDetails: { kind: string; amount: number; description: string }[];
  }>();
  
  let processedDirect = 0;
  let processedIndirect = 0;
  let processedProvisions = 0;
  let skipped = 0;
  
  for (const row of rows) {
    try {
      const periodKey = toPeriodKey(row.Mes, row.Año);
      if (!periodKey) {
        skipped++;
        continue;
      }
      
      const tipoCostoRaw = row['Tipo de Costo'] || row['Tipo de Coste'] || row['Tipo Costo'] || '';
      const tipoCostoNorm = tipoCostoRaw.trim().toLowerCase();
      
      const isDirect = tipoCostoNorm === 'directo' || tipoCostoNorm === 'costos directos e indirectos';
      const isIndirect = tipoCostoNorm === 'indirecto';
      
      // Permitir cualquier tipo para detectar provisiones (algunas pueden venir sin tipo)
      const hasValidType = isDirect || isIndirect;
      
      const montoUSD = parseNum(row['Monto Total USD']);
      const montoARS = parseNum(row['Monto Total ARS'] || row['Monto Original ARS'] || row['Total ARS']);
      
      if (montoUSD === 0 && montoARS === 0) {
        skipped++;
        continue;
      }
      
      if (!periodCosts.has(periodKey)) {
        periodCosts.set(periodKey, {
          directUSD: 0, directARS: 0,
          indirectUSD: 0, indirectARS: 0,
          provisionsUSD: 0, provisionsARS: 0,
          directRows: 0, indirectRows: 0, provisionsRows: 0,
          provisionDetails: []
        });
      }
      
      const acc = periodCosts.get(periodKey)!;
      
      // PASO 1: Verificar si es provisión PRIMERO (independientemente del tipo)
      const isProvisionRow = isProvision(row);
      
      if (isProvisionRow) {
        // Es una provisión → bucket de provisiones (solo para Financiero)
        acc.provisionsUSD += montoUSD;
        acc.provisionsARS += montoARS;
        acc.provisionsRows++;
        processedProvisions++;
        
        const provisionKind = getProvisionKind(row);
        const description = row.Proyecto || row.Cliente || row.Detalle || 'N/A';
        acc.provisionDetails.push({ kind: provisionKind, amount: montoUSD, description });
        
        console.log(`  📋 PROVISIÓN [${provisionKind}]: ${description} → $${montoUSD.toFixed(2)} USD (tipo original: ${tipoCostoRaw})`);
      } else if (isDirect) {
        // No es provisión y es tipo Directo → bucket de directos
        acc.directUSD += montoUSD;
        acc.directARS += montoARS;
        acc.directRows++;
        processedDirect++;
      } else if (isIndirect) {
        // No es provisión y es tipo Indirecto → bucket de indirectos operativos
        acc.indirectUSD += montoUSD;
        acc.indirectARS += montoARS;
        acc.indirectRows++;
        processedIndirect++;
      } else {
        // Sin tipo válido y no es provisión → saltar
        skipped++;
      }
      
    } catch (error) {
      console.error(`❌ Error procesando fila para costos agregados:`, error);
      skipped++;
    }
  }
  
  console.log(`💾 [SoT ETL] Guardando ${periodCosts.size} períodos en fact_cost_month...`);
  console.log(`   📊 Directos: ${processedDirect} | Indirectos Operativos: ${processedIndirect} | Provisiones: ${processedProvisions} | Saltados: ${skipped}`);
  
  for (const [periodKey, costs] of periodCosts) {
    await ensurePeriod(periodKey);
    
    // Total OPERATIVO (sin provisiones) para compatibilidad
    const totalOperativoUSD = costs.directUSD + costs.indirectUSD;
    const totalOperativoARS = costs.directARS + costs.indirectARS;
    // Total CONTABLE (con provisiones)
    const totalContableUSD = totalOperativoUSD + costs.provisionsUSD;
    const totalContableARS = totalOperativoARS + costs.provisionsARS;
    const totalRows = costs.directRows + costs.indirectRows + costs.provisionsRows;
    
    await db.insert(factCostMonth)
      .values({
        periodKey,
        directUSD: costs.directUSD.toString(),
        directARS: costs.directARS.toString(),
        indirectUSD: costs.indirectUSD.toString(),
        indirectARS: costs.indirectARS.toString(),
        provisionsUSD: costs.provisionsUSD.toString(),
        provisionsARS: costs.provisionsARS.toString(),
        amountUSD: totalContableUSD.toString(),
        amountARS: totalContableARS.toString(),
        sourceRowsCount: totalRows,
        directRowsCount: costs.directRows,
        indirectRowsCount: costs.indirectRows,
        provisionsRowsCount: costs.provisionsRows
      })
      .onConflictDoUpdate({
        target: [factCostMonth.periodKey],
        set: {
          directUSD: costs.directUSD.toString(),
          directARS: costs.directARS.toString(),
          indirectUSD: costs.indirectUSD.toString(),
          indirectARS: costs.indirectARS.toString(),
          provisionsUSD: costs.provisionsUSD.toString(),
          provisionsARS: costs.provisionsARS.toString(),
          amountUSD: totalContableUSD.toString(),
          amountARS: totalContableARS.toString(),
          sourceRowsCount: totalRows,
          directRowsCount: costs.directRows,
          indirectRowsCount: costs.indirectRows,
          provisionsRowsCount: costs.provisionsRows,
          etlTimestamp: sql`now()`
        }
      });
    
    console.log(`  ✅ ${periodKey}: Directos=$${costs.directUSD.toFixed(2)}, Indirectos Ope=$${costs.indirectUSD.toFixed(2)}, Provisiones=$${costs.provisionsUSD.toFixed(2)} USD`);
  }
  
  console.log(`✅ [SoT ETL] Costos separados: ${processedDirect} directos, ${processedIndirect} indirectos operativos, ${processedProvisions} provisiones`);
}

// ==================== PROVISIONES DESDE HOJAS ADICIONALES ====================

/**
 * Procesa las hojas adicionales de provisiones del Excel MAESTRO:
 * - "Provisión pasivo proyectos" (Pepsico, Warner, etc.)
 * - "Impuestos" (Impuestos USA, IVA, etc.)
 * - "Pasivo" (otros pasivos contables)
 * 
 * Agrega las provisiones a fact_cost_month sin sobrescribir los directos/indirectos
 */
export async function processProvisionSheets(): Promise<{
  success: boolean;
  provisionsProcessed: number;
  provisionsTotal: number;
  byPeriod: Map<string, number>;
  errors: string[];
}> {
  console.log(`📊 [SoT ETL] Procesando hojas de provisiones adicionales...`);
  
  const result = {
    success: true,
    provisionsProcessed: 0,
    provisionsTotal: 0,
    byPeriod: new Map<string, number>(),
    errors: [] as string[]
  };
  
  try {
    const { googleSheetsWorkingService, ProvisionRow } = await import('../services/googleSheetsWorking');
    const { factCostMonth } = await import('@shared/schema');
    
    // 1. Obtener provisiones de todas las hojas
    console.log('📋 Importando hojas de provisiones...');
    
    const [provisionProyectos, impuestos, pasivo] = await Promise.all([
      googleSheetsWorkingService.getProvisionPasivoProyectos(),
      googleSheetsWorkingService.getImpuestos(),
      googleSheetsWorkingService.getPasivo()
    ]);
    
    console.log(`  📊 Provisión Pasivo Proyectos: ${provisionProyectos.length} registros`);
    console.log(`  📊 Impuestos: ${impuestos.length} registros`);
    console.log(`  📊 Pasivo: ${pasivo.length} registros`);
    
    // 2. Combinar todas las provisiones
    const allProvisions: typeof provisionProyectos = [
      ...provisionProyectos,
      ...impuestos,
      ...pasivo
    ];
    
    if (allProvisions.length === 0) {
      console.log('⚠️ No se encontraron provisiones en las hojas adicionales');
      return result;
    }
    
    // 3. Agregar por período
    const provisionsByPeriod = new Map<string, {
      total: number;
      details: { concept: string; kind: string; amount: number }[];
    }>();
    
    for (const prov of allProvisions) {
      if (!prov.periodKey || prov.amountUsd === 0) continue;
      
      if (!provisionsByPeriod.has(prov.periodKey)) {
        provisionsByPeriod.set(prov.periodKey, { total: 0, details: [] });
      }
      
      const acc = provisionsByPeriod.get(prov.periodKey)!;
      acc.total += prov.amountUsd;
      acc.details.push({
        concept: prov.concept,
        kind: prov.provisionKind,
        amount: prov.amountUsd
      });
      
      result.provisionsProcessed++;
      result.provisionsTotal += prov.amountUsd;
    }
    
    console.log(`💾 Actualizando provisiones para ${provisionsByPeriod.size} períodos...`);
    
    // 4. Actualizar fact_cost_month con las provisiones de las hojas adicionales
    // Sumamos a las provisiones existentes (que pueden venir de "Costos directos e indirectos")
    for (const [periodKey, data] of provisionsByPeriod) {
      try {
        await ensurePeriod(periodKey);
        
        // Obtener el registro existente para sumar provisiones
        const existing = await db.select()
          .from(factCostMonth)
          .where(sql`${factCostMonth.periodKey} = ${periodKey}`)
          .limit(1);
        
        let currentProvisions = 0;
        let currentDirect = 0;
        let currentIndirect = 0;
        
        if (existing.length > 0) {
          currentProvisions = parseFloat(existing[0].provisionsUSD || '0');
          currentDirect = parseFloat(existing[0].directUSD || '0');
          currentIndirect = parseFloat(existing[0].indirectUSD || '0');
        }
        
        // Sumar nuevas provisiones
        const newProvisions = currentProvisions + data.total;
        const totalContable = currentDirect + currentIndirect + newProvisions;
        
        await db.insert(factCostMonth)
          .values({
            periodKey,
            directUSD: currentDirect.toString(),
            directARS: '0',
            indirectUSD: currentIndirect.toString(),
            indirectARS: '0',
            provisionsUSD: newProvisions.toString(),
            provisionsARS: '0',
            amountUSD: totalContable.toString(),
            amountARS: '0',
            sourceRowsCount: data.details.length,
            provisionsRowsCount: data.details.length
          })
          .onConflictDoUpdate({
            target: [factCostMonth.periodKey],
            set: {
              provisionsUSD: newProvisions.toString(),
              amountUSD: totalContable.toString(),
              provisionsRowsCount: sql`COALESCE(${factCostMonth.provisionsRowsCount}, 0) + ${data.details.length}`,
              etlTimestamp: sql`now()`
            }
          });
        
        result.byPeriod.set(periodKey, data.total);
        
        // Log detalles de provisiones importantes
        console.log(`  ✅ ${periodKey}: +$${data.total.toFixed(2)} USD provisiones (${data.details.length} items)`);
        for (const detail of data.details.slice(0, 3)) {
          console.log(`     📋 ${detail.kind}: ${detail.concept} → $${detail.amount.toFixed(2)}`);
        }
        if (data.details.length > 3) {
          console.log(`     ... y ${data.details.length - 3} más`);
        }
        
      } catch (error) {
        const errorMsg = `Error procesando período ${periodKey}: ${error}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    console.log(`✅ [SoT ETL] Provisiones adicionales: ${result.provisionsProcessed} items, $${result.provisionsTotal.toFixed(2)} USD total`);
    
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ [SoT ETL] Error procesando hojas de provisiones:', error);
    result.success = false;
    result.errors.push(errorMsg);
    return result;
  }
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
      
      // Separación semántica: FX vs Precio/Cotización
      const fxRate = parseNum(row['Cotización'] || row.FX || row['Tipo de cambio']); // Tipo de cambio
      const priceNative = parseNum(row['Precio']); // DEPRECATED: precio del mes
      
      // quoteNative: precio/cotización del proyecto (denominador presupuesto)
      // Usa revenue en moneda nativa como precio del proyecto
      const isUSDProject = revenueUSD > 0 && (revenueARS === 0 || revenueUSD > (revenueARS / (fxRate || 1300)));
      const quoteNative = isUSDProject ? revenueUSD : revenueARS;
      
      // DEPRECATED: mantener fx para compatibilidad
      const fx = fxRate;
      
      // 3) Buscar projectId usando nuevo resolver V2 con logging automático
      const resolution = await resolveRCRow(periodKey, clientRaw, projectRaw);
      const projectId = resolution.projectId;
      
      if (!projectId) {
        // 🔍 INSTRUMENTACIÓN: Log detallado de proyectos no encontrados en RC
        const lostRevenue = parseNum(row['Facturación [USD]']) || parseNum(row['Facturación [ARS]']);
        console.log(`⚠️ [${periodKey}] RC - Proyecto no encontrado: "${clientRaw}" :: "${projectRaw}" - Revenue perdido: $${lostRevenue.toFixed(2)} [${resolution.diagnostics.motivo}]`);
        skipped++;
        continue;
      }
      
      // Log nuevos alias auto-creados
      if (resolution.diagnostics.clientResolution?.isNewAlias) {
        console.log(`✨ Cliente auto-resuelto: "${clientRaw}" (score: ${resolution.diagnostics.clientResolution.fuzzyScore?.toFixed(2)})`);
      }
      if (resolution.diagnostics.projectResolution?.isNewAlias) {
        console.log(`✨ Proyecto auto-resuelto: "${projectRaw}" via ${resolution.diagnostics.projectResolution.matchType}`);
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
          quoteNative: quoteNative.toString(),
          fxRate: fxRate.toString(),
          priceNative: priceNative.toString(), // DEPRECATED
          fx: fx.toString(), // DEPRECATED
          sourceRowId: row.__rowId || `row_${processed}`
        })
        .onConflictDoUpdate({
          target: [factRCMonth.projectId, factRCMonth.periodKey],
          set: {
            revenueUSD: revenueUSD.toString(),
            costUSD: costUSD.toString(),
            revenueARS: revenueARS.toString(),
            costARS: costARS.toString(),
            quoteNative: quoteNative.toString(),
            fxRate: fxRate.toString(),
            priceNative: priceNative.toString(), // DEPRECATED
            fx: fx.toString() // DEPRECATED
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
  // 1) Obtener agregados de labor (COALESCE para manejar NULL de SUM)
  const laborAgg = await db.select({
    estHours: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.targetHours} AS NUMERIC)), 0)`,
    totalAsanaHours: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.asanaHours} AS NUMERIC)), 0)`,
    totalBillingHours: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.billingHours} AS NUMERIC)), 0)`,
    totalCostARS: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.costARS} AS NUMERIC)), 0)`,
    totalCostUSD: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.costUSD} AS NUMERIC)), 0)`
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
  console.log(`  ├─ Hours: target=${Number(laborAgg.estHours || 0).toFixed(1)}, asana=${Number(laborAgg.totalAsanaHours || 0).toFixed(1)}, billing=${Number(laborAgg.totalBillingHours || 0).toFixed(1)}`);
  console.log(`  ├─ Costs: ARS=${Number(laborAgg.totalCostARS || 0).toFixed(0)}, USD=${Number(laborAgg.totalCostUSD || 0).toFixed(2)}`);
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

export interface SoTETLOptions {
  scopes?: {
    periods?: string[]; // Filtrar por períodos específicos (e.g. ["2023-01", "2023-12"])
    projects?: number[]; // Filtrar por proyectos específicos
  };
  dryRun?: boolean; // Simular sin guardar
  recomputeAgg?: boolean; // Forzar recálculo de agregados
}

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
  rendimientoClienteRows: RendimientoClienteRow[],
  options: SoTETLOptions = {}
): Promise<SoTETLResult> {
  const startTime = Date.now();
  console.log('🚀 [SoT ETL] Iniciando ETL completo...');
  
  if (options.scopes?.periods) {
    console.log(`🎯 [SoT ETL] Filtrado por períodos: ${options.scopes.periods.join(', ')}`);
  }
  
  try {
    // Limpiar cache de proyectos para forzar re-resolve
    clearProjectCache();
    
    // Filtrar datos por scopes si están definidos
    let filteredCostos = costosDirectosRows;
    let filteredRC = rendimientoClienteRows;
    
    if (options.scopes?.periods) {
      const periodSet = new Set(options.scopes.periods);
      filteredCostos = costosDirectosRows.filter(row => {
        const period = toPeriodKey(row.Mes, row.Año);
        return period && periodSet.has(period);
      });
      filteredRC = rendimientoClienteRows.filter(row => {
        const period = toPeriodKey(row.Mes, row.Año);
        return period && periodSet.has(period);
      });
      console.log(`📊 [SoT ETL] Filtrado: ${filteredCostos.length}/${costosDirectosRows.length} costos, ${filteredRC.length}/${rendimientoClienteRows.length} RC`);
    }
    
    // Filtrar para fact_cost_month: TODOS los costos directos (Equipo, Coordinación, QA, Admin, etc.)
    // Acepta SOLO "Directo" y "Directos e indirectos" (rechaza "Indirecto")
    // Fuente: Columna R del Excel MAESTRO (1:1 match sin filtros adicionales)
    
    // 🔍 DEBUG: Log first row keys to see what columns are available
    if (filteredCostos.length > 0) {
      const firstRowKeys = Object.keys(filteredCostos[0]);
      const tipoKeys = firstRowKeys.filter(k => k.toLowerCase().includes('tipo'));
      console.log(`🔍 [SoT ETL DEBUG] Columnas con 'tipo' en primera fila:`, tipoKeys);
      console.log(`🔍 [SoT ETL DEBUG] Valor de primera columna tipo:`, filteredCostos[0][tipoKeys[0]]);
    }
    
    const filteredCostosDirectos = filteredCostos.filter(row => {
      // Probar múltiples variantes de la columna "Tipo"
      const tipoCosto = normKey(
        row['Tipo de Costo'] ?? 
        row['Tipo de Coste'] ?? 
        row['Tipo Costo'] ?? 
        ''
      );
      
      // Verificar que Tipo sea exactamente "directo" o "directos e indirectos"
      // IMPORTANTE: No usar .includes() porque "indirecto".includes("directo") es true
      const isDirecto = tipoCosto === 'directo' || tipoCosto === 'directos e indirectos' || tipoCosto === 'costos directos e indirectos';
      if (!isDirecto) return false;
      
      // NO filtrar por Subtipo, persona, o horas - incluye TODOS los costos directos
      // (Equipo con horas, Coordinación, QA, Admin, Provisions sin horas, etc.)
      return true;
    });
    
    console.log(`🎯 [SoT ETL] Filtrado Costos Directos: ${filteredCostosDirectos.length}/${filteredCostos.length} costos para fact_cost_month`);
    
    // Debug: sumar columna R para verificar el total
    const totalR = filteredCostosDirectos.reduce((sum, row) => {
      const montoUSD = parseNum(row['Monto Total USD']);
      return sum + montoUSD;
    }, 0);
    console.log(`💰 [SoT ETL DEBUG] Total columna R para ${filteredCostosDirectos.length} filas: $${totalR.toFixed(2)} USD`);
    
    if (options.dryRun) {
      console.log('🔍 [SoT ETL] DRY RUN - No se guardarán cambios');
      return {
        success: true,
        periodsProcessed: options.scopes?.periods || [],
        laborRowsProcessed: filteredCostos.length,
        rcRowsProcessed: filteredRC.length,
        aggregatesComputed: 0,
        errors: [],
        executionTimeMs: Date.now() - startTime
      };
    }
    
    // 1. Procesar labor (costos directos con horas - fact_labor_month)
    await processDirectCostsToFactLabor(filteredCostos);
    
    // 1b. Procesar costos agregados por período (TODOS los costos: directos E indirectos - fact_cost_month)
    // La función processCostsByPeriod() separa internamente directos vs indirectos
    // Incluye Equipo, Coordinación, QA, Admin, etc. - Match 1:1 con Columna R del Excel
    await processCostsByPeriod(filteredCostos); // ← CAMBIADO: pasar filteredCostos (todos) en vez de filteredCostosDirectos
    
    // 1c. Procesar hojas adicionales de provisiones (Provisión pasivo proyectos, Impuestos, Pasivo)
    // Agrega Pepsico, Warner, Impuestos USA, IVA, etc. al bucket de provisiones
    const provisionResult = await processProvisionSheets();
    console.log(`📊 [SoT ETL] Provisiones adicionales: ${provisionResult.provisionsProcessed} items, $${provisionResult.provisionsTotal.toFixed(2)} USD`);
    
    // 2. Procesar RC (rendimiento cliente)
    await processRendimientoClienteToFactRC(filteredRC);
    
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
      laborRowsProcessed: filteredCostos.length,
      rcRowsProcessed: filteredRC.length,
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

// ==================== ETL: RESUMEN EJECUTIVO → MONTHLY FINANCIAL SUMMARY ====================

/**
 * ETL: Sincronizar datos de "Resumen Ejecutivo" del Excel MAESTRO a monthly_financial_summary
 * Upsert por period_key para permitir actualizaciones incrementales
 */
export async function syncResumenEjecutivoToMonthlyFinancialSummary(): Promise<{
  success: boolean;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: string[];
  executionTimeMs: number;
}> {
  const startTime = Date.now();
  console.log('📊 [Resumen Ejecutivo ETL] Iniciando sincronización...');
  
  try {
    const { googleSheetsWorkingService, ResumenEjecutivoRow } = await import('../services/googleSheetsWorking');
    const { monthlyFinancialSummary } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');
    
    // 1. Obtener datos del Excel
    const rows = await googleSheetsWorkingService.getResumenEjecutivo();
    
    if (rows.length === 0) {
      console.log('⚠️ [Resumen Ejecutivo ETL] No hay datos para procesar');
      return {
        success: true,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
        executionTimeMs: Date.now() - startTime
      };
    }
    
    console.log(`📊 [Resumen Ejecutivo ETL] Procesando ${rows.length} registros mensuales...`);
    
    let recordsInserted = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];
    
    // 2. Upsert cada registro
    for (const row of rows) {
      try {
        // Verificar si existe
        const existing = await db.select({ id: monthlyFinancialSummary.id })
          .from(monthlyFinancialSummary)
          .where(sql`${monthlyFinancialSummary.periodKey} = ${row.periodKey}`)
          .limit(1);
        
        const values = {
          periodKey: row.periodKey,
          year: row.year,
          monthNumber: row.monthNumber,
          monthLabel: row.monthLabel || null,
          totalActivo: row.totalActivo?.toString() || null,
          totalPasivo: row.totalPasivo?.toString() || null,
          balanceNeto: row.balanceNeto?.toString() || null,
          cajaTotal: row.cajaTotal?.toString() || null,
          inversiones: row.inversiones?.toString() || null,
          cashflowIngresos: row.cashflowIngresos?.toString() || null,
          cashflowEgresos: row.cashflowEgresos?.toString() || null,
          cashflowNeto: row.cashflowNeto?.toString() || null,
          cuentasCobrarUsd: row.cuentasCobrarUsd?.toString() || null,
          cuentasPagarUsd: row.cuentasPagarUsd?.toString() || null,
          facturacionTotal: row.facturacionTotal?.toString() || null,
          costosDirectos: row.costosDirectos?.toString() || null,
          costosIndirectos: row.costosIndirectos?.toString() || null,
          ivaCompras: row.ivaCompras?.toString() || null,
          impuestosUsa: row.impuestosUsa?.toString() || null,
          ebitOperativo: row.ebitOperativo?.toString() || null,
          beneficioNeto: row.beneficioNeto?.toString() || null,
          markupPromedio: row.markupPromedio?.toString() || null,
        };
        
        if (existing.length > 0) {
          // UPDATE
          await db.update(monthlyFinancialSummary)
            .set({
              ...values,
              updatedAt: new Date()
            })
            .where(sql`${monthlyFinancialSummary.periodKey} = ${row.periodKey}`);
          recordsUpdated++;
        } else {
          // INSERT
          await db.insert(monthlyFinancialSummary).values(values);
          recordsInserted++;
        }
        
      } catch (error) {
        const msg = `Error procesando período ${row.periodKey}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${msg}`);
        errors.push(msg);
      }
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    console.log(`✅ [Resumen Ejecutivo ETL] Completado en ${executionTimeMs}ms`);
    console.log(`📊 Resumen: ${recordsInserted} insertados, ${recordsUpdated} actualizados, ${errors.length} errores`);
    
    return {
      success: errors.length === 0,
      recordsProcessed: rows.length,
      recordsInserted,
      recordsUpdated,
      errors,
      executionTimeMs
    };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [Resumen Ejecutivo ETL] Error:', error);
    return {
      success: false,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: [errorMessage],
      executionTimeMs: Date.now() - startTime
    };
  }
}
