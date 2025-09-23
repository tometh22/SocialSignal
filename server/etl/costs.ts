/**
 * 💰 Costs ETL Process
 * Leer sheets → normalizar → guardar en costs_norm
 */

import { db } from '../db';
import { directCosts, costsNorm } from '../../shared/schema';
import { canon, projectKey, toUSD, fixAntiX100 } from '../utils/normalize';
import { dateToMonthKey } from '../utils/period';
import { sql } from 'drizzle-orm';

export interface CostsETLResult {
  processed: number;
  normalized: number;
  errors: string[];
  anomalies: string[];
}

/**
 * 🔄 Procesa costos desde sheets a tabla normalizada
 */
export async function processCosts(): Promise<CostsETLResult> {
  const result: CostsETLResult = {
    processed: 0,
    normalized: 0,
    errors: [],
    anomalies: []
  };

  try {
    console.log('🔄 Starting Costs ETL Process...');
    
    // 1. Leer datos raw de directCosts
    const rawCosts = await db.select().from(directCosts);
    result.processed = rawCosts.length;
    
    console.log(`📥 Raw costs records: ${rawCosts.length}`);
    
    // 2. Limpiar tabla normalizada
    await db.delete(costsNorm);
    console.log('🧹 Cleared costs_norm table');
    
    // 3. Procesar y normalizar cada registro
    const normalizedRecords = [];
    
    for (const record of rawCosts) {
      try {
        const normalized = await normalizeCostsRecord(record);
        if (normalized) {
          normalizedRecords.push(normalized);
          if (normalized.anomaly) {
            result.anomalies.push(normalized.anomaly);
          }
        }
      } catch (error) {
        const errorMsg = `Error processing record ID ${record.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    // 4. Insertar registros normalizados en batch
    if (normalizedRecords.length > 0) {
      await db.insert(costsNorm).values(normalizedRecords);
      result.normalized = normalizedRecords.length;
      console.log(`✅ Inserted ${normalizedRecords.length} normalized costs records`);
    }
    
    console.log('✅ Costs ETL Process completed');
    return result;
    
  } catch (error) {
    const errorMsg = `Fatal error in Costs ETL: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
    return result;
  }
}

/**
 * 🔧 Normaliza un registro individual de costos
 */
async function normalizeCostsRecord(record: any) {
  // Validar campos requeridos
  if (!record.cliente || !record.proyecto) {
    throw new Error(`Missing client or project name`);
  }
  
  // Normalizar nombres - usar campos de directCosts
  const projectKeyNorm = projectKey(record.cliente, record.proyecto);
  
  // Usar monthKey ya existente o construir desde mes/año
  let monthKey: string;
  if (record.monthKey) {
    monthKey = record.monthKey;
  } else if (record.mes && record.año) {
    const monthNumber = typeof record.mes === 'string' ? 
      parseInt(record.mes) : record.mes;
    monthKey = `${record.año}-${monthNumber.toString().padStart(2, '0')}`;
  } else {
    throw new Error('Missing date information');
  }
  
  // Procesar monto con anti-x100 - usar montoTotalUSD o costoTotal
  const rawAmount = toUSD(record.montoTotalUSD || record.costoTotal);
  const amountResult = fixAntiX100(rawAmount);
  
  return {
    projectKey: projectKeyNorm,
    monthKey,
    usd: amountResult.corrected.toString(),
    hoursWorked: record.horasRealesAsana || record.horasParaFacturacion,
    sourceRowId: record.uniqueKey || `${record.id}`,
    anomaly: amountResult.anomaly
  };
}

/**
 * 📊 Estadísticas de la tabla normalizada
 */
export async function getCostsNormStats() {
  try {
    const stats = await db
      .select({
        totalRecords: sql<number>`count(*)`,
        totalUSD: sql<number>`sum(usd)`,
        uniqueProjects: sql<number>`count(distinct project_key)`,
        uniqueMonths: sql<number>`count(distinct month_key)`,
        anomaliesCount: sql<number>`count(*) filter (where anomaly is not null)`,
        totalHours: sql<number>`sum(hours_worked)`
      })
      .from(costsNorm);
      
    return stats[0] || {
      totalRecords: 0,
      totalUSD: 0,
      uniqueProjects: 0,
      uniqueMonths: 0,
      anomaliesCount: 0,
      totalHours: 0
    };
  } catch (error) {
    console.error('Error getting costs_norm stats:', error);
    return null;
  }
}

/**
 * 🔍 Validar integridad de datos normalizados
 */
export async function validateCostsNormIntegrity(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    // 1. Verificar projectKeys válidos
    const invalidKeys = await db
      .select({ projectKey: costsNorm.projectKey })
      .from(costsNorm)
      .where(sql`project_key IS NULL OR project_key = '' OR project_key NOT LIKE '%|%'`);
    
    if (invalidKeys.length > 0) {
      issues.push(`${invalidKeys.length} records with invalid project keys`);
    }
    
    // 2. Verificar monthKeys válidos
    const invalidMonths = await db
      .select({ monthKey: costsNorm.monthKey })
      .from(costsNorm)
      .where(sql`month_key IS NULL OR month_key = '' OR month_key !~ '^\\d{4}-\\d{2}$'`);
    
    if (invalidMonths.length > 0) {
      issues.push(`${invalidMonths.length} records with invalid month keys`);
    }
    
    // 3. Verificar amounts positivos
    const negativeAmounts = await db
      .select({ usd: costsNorm.usd })
      .from(costsNorm)
      .where(sql`usd < 0`);
    
    if (negativeAmounts.length > 0) {
      issues.push(`${negativeAmounts.length} records with negative amounts`);
    }
    
    // 4. Verificar horas válidas (si existen)
    const invalidHours = await db
      .select({ hoursWorked: costsNorm.hoursWorked })
      .from(costsNorm)
      .where(sql`hours_worked < 0`);
    
    if (invalidHours.length > 0) {
      issues.push(`${invalidHours.length} records with negative hours`);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
    
  } catch (error) {
    issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, issues };
  }
}

