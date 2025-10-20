/**
 * Sistema de Fallback de Tarifas para SoT ETL
 * 
 * Prioridades de búsqueda de tarifas:
 * 1. Tarifa del Excel (si > 0)
 * 2. Catálogo específico proyecto (dim_person_rate con project_id)
 * 3. Catálogo general persona (dim_person_rate sin project_id)
 * 4. Última tarifa histórica conocida (mes anterior)
 * 5. Tarifa base por rol (pendiente implementación)
 * 6. Reconciliación con RC (último recurso)
 */

import { db } from '../db';
import { dimPersonRate, factLaborMonth, factRCMonth } from '../../shared/schema';
import { sql, desc, and, eq, isNull } from 'drizzle-orm';

interface RateLookupResult {
  rate: number;
  source: 'excel' | 'catalog_project' | 'catalog_general' | 'historical' | 'role' | 'rc_reconciled';
  flags: string[];
}

/**
 * Busca tarifa en catálogo (dim_person_rate)
 */
async function lookupRateCatalog(
  personId: number | null,
  projectId: number | null,
  periodKey: string
): Promise<number | null> {
  if (!personId) return null;
  
  const conditions = [
    eq(dimPersonRate.personId, personId),
    eq(dimPersonRate.periodKey, periodKey)
  ];
  
  if (projectId !== null) {
    conditions.push(eq(dimPersonRate.projectId, projectId));
  } else {
    conditions.push(isNull(dimPersonRate.projectId));
  }
  
  const rate = await db.query.dimPersonRate.findFirst({
    where: and(...conditions),
  });
  
  return rate ? parseFloat(rate.hourlyRateARS.toString()) : null;
}

/**
 * Busca última tarifa histórica conocida de la persona (mes anterior)
 */
async function lookupLastKnownRate(
  personId: number | null,
  periodKey: string
): Promise<number | null> {
  if (!personId) return null;
  
  const rate = await db.select({
    hourlyRateARS: factLaborMonth.hourlyRateARS
  })
  .from(factLaborMonth)
  .where(and(
    eq(factLaborMonth.personId, personId),
    sql`${factLaborMonth.periodKey} < ${periodKey}`,
    sql`${factLaborMonth.hourlyRateARS} IS NOT NULL AND ${factLaborMonth.hourlyRateARS} > 0`
  ))
  .orderBy(desc(factLaborMonth.periodKey))
  .limit(1)
  .then((rows: any[]) => rows[0]);
  
  return rate ? parseFloat(rate.hourlyRateARS.toString()) : null;
}

/**
 * Tarifa base por rol (placeholder - requiere tabla role_baseline_rates)
 */
async function lookupRoleBaselineRate(roleName: string | null): Promise<number | null> {
  // TODO: Implementar cuando se cree tabla de tarifas base por rol
  return null;
}

/**
 * Reconciliación con RC: reparte el costo RC proporcionalmente a las billing hours
 */
async function reconcileToRCCost(
  projectId: number,
  periodKey: string,
  billingHours: number,
  personKey: string
): Promise<number | null> {
  if (billingHours <= 0) return null;
  
  // 1. Obtener total de costos labor ya procesados (excluir current person para no contar doble)
  const laborTotal = await db.select({
    totalCost: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.costARS} AS NUMERIC)), 0)`,
    totalHours: sql<number>`COALESCE(SUM(CAST(${factLaborMonth.billingHours} AS NUMERIC)), 0)`
  })
  .from(factLaborMonth)
  .where(and(
    eq(factLaborMonth.projectId, projectId),
    eq(factLaborMonth.periodKey, periodKey),
    sql`${factLaborMonth.personKey} != ${personKey}` // Excluir persona actual
  ))
  .then((rows: any[]) => rows[0]);
  
  // 2. Obtener RC cost del período
  const rcData = await db.query.factRCMonth.findFirst({
    where: and(
      eq(factRCMonth.projectId, projectId),
      eq(factRCMonth.periodKey, periodKey)
    )
  });
  
  if (!rcData) return null;
  
  const rcCost = parseFloat((rcData.costARS || rcData.costUSD || '0').toString());
  const laborCost = parseFloat(laborTotal.totalCost.toString());
  const laborHours = parseFloat(laborTotal.totalHours.toString());
  
  // 3. Calcular costo disponible para distribuir
  const remainingCost = rcCost - laborCost;
  
  if (remainingCost <= 0) {
    console.log(`⚠️ RC reconciliation: No remaining cost for ${personKey} (RC=${rcCost}, Labor=${laborCost})`);
    return null;
  }
  
  // 4. Calcular tarifa implícita para esta persona
  const implicitRate = remainingCost / billingHours;
  
  console.log(`💰 RC reconciliation: ${personKey} → ${implicitRate.toFixed(2)} ARS/h (${remainingCost.toFixed(2)} / ${billingHours}h)`);
  
  return implicitRate;
}

/**
 * Sistema principal de fallback de tarifas
 */
export async function resolveHourlyRate(params: {
  excelRate: number | null;
  calculatedRate?: number; // Nueva opción: tarifa calculada desde Monto Total ARS / horas
  personId: number | null;
  projectId: number | null;
  periodKey: string;
  billingHours: number;
  personKey: string;
  roleName: string | null;
}): Promise<RateLookupResult> {
  
  const { excelRate, calculatedRate = 0, personId, projectId, periodKey, billingHours, personKey, roleName } = params;
  const flags: string[] = [];
  
  // Prioridad 1: Excel explícito (si > 0)
  if (excelRate && excelRate > 0) {
    return {
      rate: excelRate,
      source: 'excel',
      flags: ['rate_from_excel']
    };
  }
  
  // Prioridad 1.5: Tarifa calculada desde costo total del Excel (Monto Total ARS / horas)
  if (calculatedRate && calculatedRate > 0) {
    console.log(`🧮 Using calculated rate from Excel cost for ${personKey}: ${calculatedRate.toFixed(2)} ARS/h`);
    return {
      rate: calculatedRate,
      source: 'excel',
      flags: ['rate_calculated_from_cost']
    };
  }
  
  // Prioridad 2: Catálogo específico proyecto
  const catalogProjectRate = await lookupRateCatalog(personId, projectId, periodKey);
  if (catalogProjectRate && catalogProjectRate > 0) {
    flags.push('rate_from_catalog_project');
    return {
      rate: catalogProjectRate,
      source: 'catalog_project',
      flags
    };
  }
  
  // Prioridad 3: Catálogo general persona
  const catalogGeneralRate = await lookupRateCatalog(personId, null, periodKey);
  if (catalogGeneralRate && catalogGeneralRate > 0) {
    flags.push('rate_from_catalog_general');
    return {
      rate: catalogGeneralRate,
      source: 'catalog_general',
      flags
    };
  }
  
  // Prioridad 4: Última tarifa histórica
  const historicalRate = await lookupLastKnownRate(personId, periodKey);
  if (historicalRate && historicalRate > 0) {
    flags.push('rate_from_historical', 'rate_fallback');
    console.log(`📊 Using historical rate for ${personKey}: ${historicalRate} ARS/h`);
    return {
      rate: historicalRate,
      source: 'historical',
      flags
    };
  }
  
  // Prioridad 5: Tarifa base por rol (TODO)
  const roleRate = await lookupRoleBaselineRate(roleName);
  if (roleRate && roleRate > 0) {
    flags.push('rate_from_role', 'rate_fallback');
    return {
      rate: roleRate,
      source: 'role',
      flags
    };
  }
  
  // Prioridad 6: Reconciliación con RC (último recurso)
  if (billingHours > 0) {
    const reconciledRate = await reconcileToRCCost(projectId!, periodKey, billingHours, personKey);
    if (reconciledRate && reconciledRate > 0) {
      flags.push('rate_from_rc_reconciliation', 'rate_provisional');
      return {
        rate: reconciledRate,
        source: 'rc_reconciled',
        flags
      };
    }
  }
  
  // Sin tarifa disponible
  flags.push('rate_missing_zero_cost');
  return {
    rate: 0,
    source: 'excel',
    flags
  };
}

/**
 * Guarda tarifa en catálogo para reutilización futura
 */
export async function saveRateToCatalog(
  personId: number,
  projectId: number | null,
  periodKey: string,
  rate: number,
  source: string
): Promise<void> {
  await db.insert(dimPersonRate)
    .values({
      personId,
      projectId: projectId || null,
      periodKey,
      hourlyRateARS: rate.toString(),
      source
    })
    .onConflictDoUpdate({
      target: [dimPersonRate.personId, dimPersonRate.projectId, dimPersonRate.periodKey],
      set: {
        hourlyRateARS: rate.toString(),
        source,
        updatedAt: sql`NOW()`
      }
    });
}
