/**
 * 📊 Sales ETL Process
 * Leer sheets → normalizar → guardar en sales_norm
 */

console.log('🚀 LOADING SALES ETL MODULE - sales.ts is being loaded');

import { db } from '../db';
import { googleSheetsSales, salesNorm } from '../../shared/schema';
import { canon, projectKey, toUSD, fixAntiX100 } from '../utils/normalize';
import { dateToMonthKey, parseSpanishMonth } from '../utils/period';
import { sql } from 'drizzle-orm';
import { 
  VENTAS_TOMI_SPEC, 
  mapearCabecerasVentasTomi, 
  extraerDatosFila, 
  validarDatosVentasTomi 
} from './sales-spec';

export interface SalesETLResult {
  processed: number;
  normalized: number;
  errors: string[];
  anomalies: string[];
}

/**
 * 🔄 Procesa ventas desde sheets a tabla normalizada
 */
export async function processSales(): Promise<SalesETLResult> {
  const result: SalesETLResult = {
    processed: 0,
    normalized: 0,
    errors: [],
    anomalies: []
  };

  try {
    console.log('🔄 Starting Sales ETL Process...');
    
    // 1. Leer datos raw de googleSheetsSales
    const rawSales = await db.select().from(googleSheetsSales);
    result.processed = rawSales.length;
    
    console.log(`📥 Raw sales records: ${rawSales.length}`);
    
    // 2. Limpiar tabla normalizada
    await db.delete(salesNorm);
    console.log('🧹 Cleared sales_norm table');
    
    // 3. Procesar y normalizar cada registro
    const normalizedRecords = [];
    
    for (const record of rawSales) {
      try {
        const normalized = await normalizeSalesRecordNEW(record);
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
    
    console.log(`🔧 Processing completed. Total valid records: ${normalizedRecords.length}`);
    
    // 4. Insertar registros normalizados en batch
    if (normalizedRecords.length > 0) {
      // DEBUG: Check for null sourceRowId values before insert
      const invalidRecords = normalizedRecords.filter(r => !r.sourceRowId);
      if (invalidRecords.length > 0) {
        console.error('❌ Found records with null sourceRowId:', invalidRecords);
        throw new Error(`${invalidRecords.length} records have null sourceRowId`);
      }
      
      console.log(`🔧 About to insert ${normalizedRecords.length} records`);
      console.log('🔧 Sample record:', JSON.stringify(normalizedRecords[0], null, 2));
      
      await db.insert(salesNorm).values(normalizedRecords);
      result.normalized = normalizedRecords.length;
      console.log(`✅ Inserted ${normalizedRecords.length} normalized sales records`);
    }
    
    console.log('✅ Sales ETL Process completed');
    return result;
    
  } catch (error) {
    const errorMsg = `Fatal error in Sales ETL: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
    return result;
  }
}

/**
 * 🔧 PRODUCTION ETL - Implementa reglas exactas especificadas
 */
async function normalizeSalesRecordNEW(record: any) {
  console.log(`🎯 PRODUCTION RULES: Processing record ID ${record?.id}: ${record?.clientName} | ${record?.projectName}`);
  
  // DEBUG: Check for null/undefined ID
  if (!record.id) {
    throw new Error(`Record has null/undefined ID: ${JSON.stringify(record)}`);
  }
  
  // 1. FILTRAR: incluir solo confirmado en {"SI", "Sí", true} (case-insensitive)
  const confirmed = String(record.confirmed || '').toLowerCase().trim();
  if (!['si', 'sí', 'true', '1'].includes(confirmed)) {
    throw new Error(`Record ${record.id} not confirmed: "${record.confirmed}"`);
  }
  
  // 2. CLAVE DE PROYECTO: projectKey = canon(cliente) + '|' + canon(proyecto)
  const clientName = record.clientName || '';
  const projectName = record.projectName || '';
  
  if (!clientName.trim() || !projectName.trim()) {
    throw new Error(`Record ${record.id} missing client/project: "${clientName}" | "${projectName}"`);
  }
  
  const projectKey = `${canon(clientName)}|${canon(projectName)}`;
  
  // 3. MES/AÑO → monthKey: "YYYY-MM" con parser español
  let monthKey: string;
  try {
    if (record.monthKey) {
      // Ya está en formato YYYY-MM
      monthKey = record.monthKey;
    } else if (record.month && record.year) {
      // Parsear mes español a número
      const monthNumber = typeof record.month === 'number' 
        ? record.month 
        : parseSpanishMonth(record.month);
      monthKey = `${record.year}-${monthNumber.toString().padStart(2, '0')}`;
    } else {
      throw new Error(`Cannot determine month/year from record`);
    }
  } catch (error) {
    throw new Error(`Record ${record.id} invalid date: ${error}`);
  }
  
  // 4. MONEDA con anti-x100
  let usd = 0;
  let anomaly = null;
  
  const montoUSD = parseFloat(record.amountUsd || '0');
  const montoARS = parseFloat(record.amountLocal || '0');
  const fx = parseFloat(record.fxApplied || '0');
  
  if (montoUSD > 0) {
    usd = montoUSD;
  } else if (montoARS > 0 && fx > 0) {
    usd = montoARS / fx;
  } else {
    throw new Error(`Record ${record.id} no valid amount: USD=${montoUSD}, ARS=${montoARS}, FX=${fx}`);
  }
  
  // Anti×100: si existe montoARS y fx, verificar corrupción
  if (montoARS > 0 && fx > 0) {
    const arsFx = montoARS / fx;
    const diff = Math.abs(usd - arsFx * 100);
    
    if (diff <= 0.5) {
      console.log(`🔧 ANTI×100 DETECTED: Record ${record.id}: ${usd} → ${usd/100} (diff: ${diff.toFixed(3)})`);
      usd = usd / 100;
      anomaly = 'x100_fixed';
    }
  }
  
  // 5. DETERMINAR TIPO
  const salesType = String(record.salesType || '').toLowerCase();
  let type: string;
  if (salesType.includes('fee')) {
    type = 'Fee';
  } else if (salesType.includes('one shot') || salesType.includes('oneshot')) {
    type = 'One Shot';
  } else {
    // Fallback basado en nombre del proyecto
    type = projectName.toLowerCase().includes('fee') ? 'Fee' : 'One Shot';
  }
  
  // 6. SALIDA NORMALIZADA - Formato exacto requerido por sales_norm table
  const result = {
    projectKey,
    monthKey,
    usd: usd.toFixed(2), // Convert to string for numeric DB field
    sourceRowId: record.id?.toString() || 'unknown',
    anomaly
  };
  
  console.log(`✅ Normalized record ID ${record.id}:`, result);
  return result;
}

/**
 * 🔧 OLD FUNCTION - Keep for reference
 */
async function normalizeSalesRecord(record: any) {
  console.log(`🚀 NEW VERSION: Record ID ${record?.id} with clientName: "${record?.clientName}"`);
  
  // Just return a working record for all cases to test the basic flow
  return {
    projectKey: `test_project_${record.id}`,
    monthKey: record.monthKey || '2025-08',
    usd: '100.00',
    sourceRowId: record.id?.toString() || 'unknown'
  };
}

/**
 * 🔄 Mapeo REAL desde datos existentes a especificación EXACTA
 * Usa los campos reales de google_sheets_sales
 */
function mapearCabecerasFromExistingData(record: any): Record<string, string> {
  return {
    cliente: 'clientName',      // record.clientName → cliente (camelCase real)
    proyecto: 'projectName',    // record.projectName → proyecto  
    mes: 'month',               // record.month → mes
    anio: 'year',               // record.year → anio
    tipoVenta: 'salesType',     // record.salesType → tipoVenta
    montoARS: 'amountLocal',    // record.amountLocal → montoARS
    montoUSD: 'amountUsd',      // record.amountUsd → montoUSD
    confirmado: 'confirmed'     // record.confirmed → confirmado
  };
}

/**
 * 📅 Generar monthKey desde mes/año según especificación
 */
function generarMonthKey(mes: any, anio: number): string {
  if (!anio || anio < 2020 || anio > 2030) {
    throw new Error(`Invalid year: ${anio}`);
  }
  
  let monthNumber: number;
  
  if (typeof mes === 'number') {
    // Mes ya es numérico
    monthNumber = mes;
  } else if (typeof mes === 'string') {
    // Parsear mes en español
    try {
      monthNumber = parseSpanishMonth(mes);
    } catch (error) {
      throw new Error(`Cannot parse month: ${mes}`);
    }
  } else {
    throw new Error(`Invalid month format: ${mes}`);
  }
  
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Month out of range: ${monthNumber}`);
  }
  
  return `${anio}-${monthNumber.toString().padStart(2, '0')}`;
}

/**
 * 📊 Estadísticas de la tabla normalizada
 */
export async function getSalesNormStats() {
  try {
    const stats = await db
      .select({
        totalRecords: sql<number>`count(*)`,
        totalUSD: sql<number>`sum(usd)`,
        uniqueProjects: sql<number>`count(distinct project_key)`,
        uniqueMonths: sql<number>`count(distinct month_key)`,
        anomaliesCount: sql<number>`count(*) filter (where anomaly is not null)`
      })
      .from(salesNorm);
      
    return stats[0] || {
      totalRecords: 0,
      totalUSD: 0,
      uniqueProjects: 0,
      uniqueMonths: 0,
      anomaliesCount: 0
    };
  } catch (error) {
    console.error('Error getting sales_norm stats:', error);
    return null;
  }
}

/**
 * 🔍 Validar integridad de datos normalizados
 */
export async function validateSalesNormIntegrity(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    // 1. Verificar projectKeys válidos
    const invalidKeys = await db
      .select({ projectKey: salesNorm.projectKey })
      .from(salesNorm)
      .where(sql`project_key IS NULL OR project_key = '' OR project_key NOT LIKE '%|%'`);
    
    if (invalidKeys.length > 0) {
      issues.push(`${invalidKeys.length} records with invalid project keys`);
    }
    
    // 2. Verificar monthKeys válidos
    const invalidMonths = await db
      .select({ monthKey: salesNorm.monthKey })
      .from(salesNorm)
      .where(sql`month_key IS NULL OR month_key = '' OR month_key !~ '^\\d{4}-\\d{2}$'`);
    
    if (invalidMonths.length > 0) {
      issues.push(`${invalidMonths.length} records with invalid month keys`);
    }
    
    // 3. Verificar amounts positivos
    const negativeAmounts = await db
      .select({ usd: salesNorm.usd })
      .from(salesNorm)
      .where(sql`usd < 0`);
    
    if (negativeAmounts.length > 0) {
      issues.push(`${negativeAmounts.length} records with negative amounts`);
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