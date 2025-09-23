/**
 * 🔧 ETL UNIVERSAL - FORMATO "LÍNEAS GENERALES"
 * Procesamiento genérico con reglas de preferencia ARS/USD
 */

import { db } from '../db';
import { salesNorm, costsNorm } from '../../shared/schema';
import { canon, projectKey, toUSD, fixAntiX100 } from '../utils/normalize';
import { dateToMonthKey, parseSpanishMonth } from '../utils/period';
import { sql } from 'drizzle-orm';
import { 
  LINEAS_GENERALES_SPEC, 
  mapearCabecerasLineasGenerales, 
  extraerDatosFilaLineasGenerales, 
  validarDatosLineasGenerales,
  calcularMontoFinalUSD
} from './lineas-generales-spec';

export interface LineasGeneralesETLResult {
  processed: number;
  normalized: number;
  errors: string[];
  anomalies: string[];
  ventasInserted: number;
  costosInserted: number;
}

/**
 * 🔄 Procesa datos formato "líneas generales" desde cualquier fuente
 * Determina automáticamente si son ventas o costos basado en el contenido
 */
export async function processLineasGenerales(
  data: any[], 
  sourceType: 'sales' | 'costs' | 'auto' = 'auto'
): Promise<LineasGeneralesETLResult> {
  const result: LineasGeneralesETLResult = {
    processed: 0,
    normalized: 0,
    errors: [],
    anomalies: [],
    ventasInserted: 0,
    costosInserted: 0
  };

  try {
    console.log('🚀 Starting Líneas Generales ETL Process...');
    console.log(`📥 Raw records to process: ${data.length}`);
    
    result.processed = data.length;
    
    if (data.length === 0) {
      console.log('⚠️ No data to process');
      return result;
    }

    // 1. Detectar y mapear cabeceras (usar primer registro para headers)
    const headers = Object.keys(data[0]);
    console.log(`📋 Detected headers: ${headers.join(', ')}`);
    
    const mapping = mapearCabecerasLineasGenerales(headers);
    console.log(`🔧 Field mapping:`, mapping);
    
    // 2. Verificar que tenemos campos mínimos requeridos
    const requiredFields = ['cliente', 'proyecto', 'mes', 'anio'];
    const missingFields = requiredFields.filter(field => mapping[field] === null);
    
    if (missingFields.length > 0) {
      throw new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
    }

    // 3. Procesar cada registro
    const ventasRecords = [];
    const costosRecords = [];
    
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      try {
        console.log(`🔧 Processing record ${i + 1}/${data.length}`);
        
        // Extraer datos usando mapeo de cabeceras
        const extractedData = extractDataFromRecord(record, mapping);
        
        // Validar datos básicos
        const validation = validarDatosLineasGenerales(extractedData);
        if (!validation.valido) {
          throw new Error(`Validation failed: ${validation.errores.join(', ')}`);
        }
        
        // Normalizar registro
        const normalized = await normalizeLineasGeneralesRecord(extractedData, i);
        if (normalized) {
          // Determinar tipo: ventas o costos
          const recordType = determineRecordType(normalized, sourceType);
          
          if (recordType === 'sales') {
            ventasRecords.push(normalized.salesRecord);
          } else if (recordType === 'costs') {
            costosRecords.push(normalized.costsRecord);
          }
          
          if (normalized.anomaly) {
            result.anomalies.push(normalized.anomaly);
          }
        }
        
      } catch (error) {
        const errorMsg = `Error processing record ${i + 1}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    console.log(`🔧 Processing completed. Ventas: ${ventasRecords.length}, Costos: ${costosRecords.length}`);
    
    // 4. Insertar registros normalizados
    if (ventasRecords.length > 0) {
      await db.insert(salesNorm).values(ventasRecords);
      result.ventasInserted = ventasRecords.length;
      console.log(`✅ Inserted ${ventasRecords.length} sales records`);
    }
    
    if (costosRecords.length > 0) {
      await db.insert(costsNorm).values(costosRecords);
      result.costosInserted = costosRecords.length;
      console.log(`✅ Inserted ${costosRecords.length} costs records`);
    }
    
    result.normalized = result.ventasInserted + result.costosInserted;
    
    console.log('✅ Líneas Generales ETL Process completed');
    return result;
    
  } catch (error) {
    const errorMsg = `Fatal error in Líneas Generales ETL: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
    return result;
  }
}

/**
 * 📊 Extrae datos de un registro usando formato compatible con el mapeo
 */
function extractDataFromRecord(record: any, mapping: Record<string, number | null>): Record<string, any> {
  const data: Record<string, any> = {};
  
  // Convertir record object a array para usar con mapping de índices
  const headers = Object.keys(record);
  const values = Object.values(record);
  
  for (const [field, columnIndex] of Object.entries(mapping)) {
    if (columnIndex !== null && values[columnIndex] !== undefined) {
      data[field] = values[columnIndex];
    } else {
      data[field] = null;
    }
  }
  
  return data;
}

/**
 * 🔧 Normaliza un registro usando las reglas de "líneas generales"
 */
async function normalizeLineasGeneralesRecord(data: Record<string, any>, recordIndex: number) {
  console.log(`🎯 LÍNEAS GENERALES: Processing record ${recordIndex + 1}: ${data.cliente} | ${data.proyecto}`);
  
  // 1. Generar projectKey usando función estándar
  const clienteNorm = canon(data.cliente || '');
  const proyectoNorm = canon(data.proyecto || '');
  const pKey = projectKey(clienteNorm, proyectoNorm);
  
  // 2. Generar monthKey
  let monthKey: string;
  try {
    if (typeof data.mes === 'string') {
      const monthNum = parseSpanishMonth(data.mes);
      const year = parseInt(data.anio);
      monthKey = `${year}-${monthNum.toString().padStart(2, '0')}`;
    } else {
      const month = parseInt(data.mes);
      const year = parseInt(data.anio);
      monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    }
  } catch (error) {
    throw new Error(`Invalid date: mes=${data.mes}, anio=${data.anio}`);
  }
  
  // 3. Calcular monto final USD usando reglas de preferencia
  const montoResult = calcularMontoFinalUSD(data);
  
  if (!montoResult.montoFinalUSD) {
    throw new Error(`No valid USD amount calculated: ${montoResult.detalles}`);
  }
  
  console.log(`💰 Monto calculado: ${montoResult.detalles}`);
  
  // 4. Aplicar anti-×100 detection si es necesario
  let finalUSD = montoResult.montoFinalUSD;
  let anomaly: string | null = null;
  
  // Aplicar detección anti-×100 genérica
  const antiX100Result = fixAntiX100(finalUSD);
  if (antiX100Result.anomaly) {
    finalUSD = antiX100Result.corrected;
    anomaly = antiX100Result.anomaly;
    console.log(`🔧 ANTI×100 APLICADO: ${montoResult.montoFinalUSD} → ${finalUSD} (${anomaly})`);
  }
  
  // 5. Crear registros para sales_norm y costs_norm
  const baseRecord = {
    projectKey: pKey,
    monthKey,
    sourceRowId: `lineas_generales_${recordIndex + 1}`,
    anomaly
  };
  
  const salesRecord = {
    ...baseRecord,
    usd: finalUSD.toFixed(2)
  };
  
  const costsRecord = {
    ...baseRecord,
    usd: finalUSD.toFixed(2),
    hoursWorked: data.horas ? parseFloat(data.horas).toFixed(2) : null
  };
  
  console.log(`✅ Normalized record ${recordIndex + 1}:`, salesRecord);
  
  return {
    salesRecord,
    costsRecord,
    anomaly,
    calculationMethod: montoResult.metodo
  };
}

/**
 * 🎯 Determina si un registro es venta o costo basado en heurísticas
 */
function determineRecordType(
  normalized: { salesRecord: any; costsRecord: any; calculationMethod: string }, 
  sourceType: 'sales' | 'costs' | 'auto'
): 'sales' | 'costs' {
  // Si el tipo está explícitamente especificado, usarlo
  if (sourceType !== 'auto') {
    return sourceType;
  }
  
  // Heurísticas automáticas:
  // - Si tiene horas trabajadas, probablemente es costo
  // - Si el proyecto contiene "Fee", probablemente es venta
  // - Por defecto, asumir venta
  
  if (normalized.costsRecord.hoursWorked) {
    console.log(`🎯 AUTO-DETECT: Record has worked hours → COSTS`);
    return 'costs';
  }
  
  if (normalized.salesRecord.projectKey.toLowerCase().includes('fee')) {
    console.log(`🎯 AUTO-DETECT: Project contains 'fee' → SALES`);
    return 'sales';
  }
  
  console.log(`🎯 AUTO-DETECT: Default fallback → SALES`);
  return 'sales';
}