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
    
    // 4. Insertar registros normalizados en batch
    if (normalizedRecords.length > 0) {
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
 * 🔧 NEW FUNCTION - Force reload and test
 */
async function normalizeSalesRecordNEW(record: any) {
  console.log(`🔥 ABSOLUTELY NEW VERSION: Processing record ID ${record?.id}`);
  console.log(`📝 Data check: clientName="${record?.clientName}", projectName="${record?.projectName}", amountUsd="${record?.amountUsd}"`);
  
  // Simple successful processing
  return {
    projectKey: `new_test_${record.id}`,
    monthKey: record.monthKey || '2025-08',
    usd: '200.00',
    sourceRowId: record.id?.toString() || 'unknown'
  };
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