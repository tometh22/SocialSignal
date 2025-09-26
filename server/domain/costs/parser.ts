/**
 * 🚀 COSTS PARSER - MAPEO Y ANTI-ESCALA
 * 
 * Parser robusto para costos que maneja:
 * - Mapeo flexible de columnas (ES/EN/camel)
 * - Conversión de meses en español
 * - Anti-escala para ARS y USD
 * - Validación y normalización
 */

import type { RawCostRecord, ParsedCostRecord, PeriodKey, CostKind } from './types';

// ==================== COLUMN MAPPING ====================

const COLUMN_MAPPINGS = {
  // 🔧 CORRECCIÓN FINAL: Usar nombres exactos de columnas de direct_costs table
  
  // Cliente - CORRECTO: columna se llama 'cliente'
  clientName: ['cliente', 'client', 'clientName', 'client_name'],
  
  // Proyecto - CORRECTO: columna se llama 'proyecto'
  projectName: ['proyecto', 'project', 'projectName', 'project_name'],
  
  // Temporal - CORRECTO: columnas se llaman 'mes' y 'año'
  month: ['mes', 'month'],
  year: ['año', 'year', 'anio'],
  
  // Validación - usar tipoGasto como proxy de confirmado
  confirmed: ['confirmado', 'confirmed', 'Confirmado', 'tipoGasto'],
  
  // Tipo de costo - CORRECTO: columna se llama 'tipoGasto'
  kind: ['tipoGasto', 'tipo_gasto', 'kind', 'type', 'tipo', 'categoria', 'category'],
  
  // 🎯 CORRECCIÓN CRÍTICA: Usar columnas EXACTAS de la tabla direct_costs
  // ARS amount - no está disponible directamente, usar costoTotal si es ARS
  arsAmount: [
    'costoTotal', // Costo en moneda local, podría ser ARS
    'total_costo_ars', 'costo_ars'
  ],
  
  // USD amount - CORRECTO: columna se llama 'montoTotalUSD'
  usdAmount: [
    'montoTotalUSD', 'costoTotal', // Primary: montoTotalUSD, fallback: costoTotal
    'total_costo_usd', 'costo_usd', 'total_usd_costo', 'costo_total_usd', 
    'total_usd', 'Total USD', 'costo_dolares', 'total_dolares'
  ]
};

// ==================== SPANISH MONTH CONVERSION ====================

const SPANISH_MONTHS: Record<string, string> = {
  'ene': '01', 'enero': '01',
  'feb': '02', 'febrero': '02', 
  'mar': '03', 'marzo': '03',
  'abr': '04', 'abril': '04',
  'may': '05', 'mayo': '05',
  'jun': '06', 'junio': '06',
  'jul': '07', 'julio': '07',
  'ago': '08', 'agosto': '08',
  'sep': '09', 'septiembre': '09', 'setiembre': '09',
  'oct': '10', 'octubre': '10',
  'nov': '11', 'noviembre': '11',
  'dic': '12', 'diciembre': '12'
};

function spanishMonthToNumber(monthStr: string): string {
  const cleaned = monthStr.toLowerCase().trim();
  
  // 🔧 CORRECCIÓN: Manejar formato "NN MMM" (ej: "08 ago", "05 may")
  const formatMatch = cleaned.match(/^(\d{1,2})\s*(.+)$/);
  if (formatMatch) {
    const [, numberPart, namePart] = formatMatch;
    
    // Verificar si el nombre del mes existe en nuestro mapeo
    const monthFromName = SPANISH_MONTHS[namePart.replace(/[.\s]/g, '')];
    if (monthFromName) {
      // Usar el número extraído, pero verificar que coincida con el nombre
      const paddedNumber = numberPart.padStart(2, '0');
      if (paddedNumber === monthFromName) {
        return paddedNumber;
      }
      // Si no coinciden, confiar en el nombre del mes
      return monthFromName;
    }
    
    // Si no encontramos el nombre, usar el número si está en rango válido
    const monthNum = parseInt(numberPart);
    if (monthNum >= 1 && monthNum <= 12) {
      return numberPart.padStart(2, '0');
    }
  }
  
  // Formato original: buscar directamente en el mapeo
  const directMatch = SPANISH_MONTHS[cleaned.replace(/[.\s]/g, '')];
  if (directMatch) {
    return directMatch;
  }
  
  return monthStr; // Retornar original si no se puede procesar
}

// ==================== FIELD EXTRACTION ====================

function extractField(record: RawCostRecord, mappings: string[]): string | undefined {
  for (const key of mappings) {
    const value = (record as any)[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

function extractNumericField(record: RawCostRecord, mappings: string[]): number | null {
  const rawValue = extractField(record, mappings);
  if (!rawValue) return null;
  
  // Limpiar y convertir
  const cleaned = rawValue.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

// ==================== ANTI-SCALE LOGIC ====================

interface AntiScaleResult {
  original: number;
  scaled: number;
  wasScaled: boolean;
  reason?: string;
}

function applyAntiScale(amount: number, currency: 'ARS' | 'USD'): AntiScaleResult {
  const original = amount;
  
  // 🚀 ANTI-SCALE ARS: Detectar valores inflados (terminan en muchos ceros)
  if (currency === 'ARS' && amount > 20_000_000) {
    const lastTwo = amount % 100;
    if (lastTwo === 0 && amount > 50_000_000) {
      return {
        original,
        scaled: amount / 100,
        wasScaled: true,
        reason: `ARS anti-scale: ${amount} → ${amount / 100} (divide by 100)`
      };
    }
  }
  
  // 🚀 ANTI-SCALE USD: Detectar patrones específicos
  if (currency === 'USD' && amount > 100_000) {
    const lastTwo = amount % 100;
    if (lastTwo === 0 && amount.toString().endsWith('00')) {
      return {
        original,
        scaled: amount / 100,
        wasScaled: true,
        reason: `USD anti-scale: ${amount} → ${amount / 100} (divide by 100)`
      };
    }
  }
  
  return {
    original,
    scaled: amount,
    wasScaled: false
  };
}

// ==================== MAIN PARSER ====================

export function parseCostRecord(
  record: RawCostRecord, 
  rowIndex: number = 0
): ParsedCostRecord | null {
  
  // 🔍 EXTRACT FIELDS
  const clientName = extractField(record, COLUMN_MAPPINGS.clientName);
  const projectName = extractField(record, COLUMN_MAPPINGS.projectName);
  const monthRaw = extractField(record, COLUMN_MAPPINGS.month);
  const yearRaw = extractField(record, COLUMN_MAPPINGS.year);
  const confirmedRaw = extractField(record, COLUMN_MAPPINGS.confirmed);
  const kindRaw = extractField(record, COLUMN_MAPPINGS.kind);
  
  // ⚠️ REQUIRED FIELDS
  if (!clientName || !monthRaw || !yearRaw) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - missing required fields:`, {
      clientName: !!clientName,
      monthRaw: !!monthRaw,
      yearRaw: !!yearRaw
    });
    return null;
  }
  
  // 🔍 CONFIRMATION CHECK
  // 🔧 CORRECCIÓN CRÍTICA: "Directo" e "Indirecto" son tipos de costo válidos confirmados
  const confirmedValues = ['si', 'yes', 'directo', 'indirecto', 'direct', 'indirect', 'confirmado', 'confirmed'];
  if (confirmedRaw && !confirmedValues.includes(confirmedRaw.toLowerCase())) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - not confirmed: "${confirmedRaw}"`);
    return null;
  }
  
  // 🔍 PERIOD CONSTRUCTION
  const monthStr = spanishMonthToNumber(monthRaw);
  const year = parseInt(yearRaw);
  
  if (isNaN(year) || monthStr.length !== 2) {
    console.log(`🔍 COST PARSER: Invalid period at row ${rowIndex}:`, { monthRaw, yearRaw, monthStr, year });
    return null;
  }
  
  const period: PeriodKey = `${year}-${monthStr}` as PeriodKey;
  
  // 🔍 AMOUNTS
  const arsAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.arsAmount);
  const usdAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.usdAmount);
  
  // At least one amount must be present
  if (!arsAmountRaw && !usdAmountRaw) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - no valid amounts`);
    return null;
  }
  
  // 🚀 APPLY ANTI-SCALE
  let arsAmount: number | null = null;
  let usdAmount: number | null = null;
  
  if (arsAmountRaw && arsAmountRaw > 0) {
    const antiScale = applyAntiScale(arsAmountRaw, 'ARS');
    arsAmount = antiScale.scaled;
    if (antiScale.wasScaled) {
      console.log(`🚀 COST ANTI-SCALE: ${antiScale.reason}`);
    }
  }
  
  if (usdAmountRaw && usdAmountRaw > 0) {
    const antiScale = applyAntiScale(usdAmountRaw, 'USD');
    usdAmount = antiScale.scaled;
    if (antiScale.wasScaled) {
      console.log(`🚀 COST ANTI-SCALE: ${antiScale.reason}`);
    }
  }
  
  // 🔍 COST KIND
  let kind: CostKind = 'Directo'; // Default
  if (kindRaw) {
    const kindLower = kindRaw.toLowerCase();
    if (kindLower.includes('indirecto') || kindLower.includes('indirect')) {
      kind = 'Indirecto';
    }
  }
  
  // If no project name, it's likely indirect
  if (!projectName || projectName.trim() === '') {
    kind = 'Indirecto';
  }
  
  console.log(`✅ COST PARSED: ${clientName} | ${projectName || 'overhead'} | ${period} | ARS:${arsAmount} USD:${usdAmount} | ${kind}`);
  
  return {
    clientName,
    projectName: projectName || 'Overhead',
    period,
    arsAmount,
    usdAmount,
    kind,
    sourceRow: rowIndex,
    rawRecord: record
  };
}

// ==================== BATCH PARSER ====================

export function parseCostRecords(records: RawCostRecord[]): ParsedCostRecord[] {
  console.log(`🔍 COST PARSER: Starting batch parse of ${records.length} records`);
  
  // 🔍 DEBUG: Mostrar columnas de los primeros registros para entender la estructura
  if (records.length > 0) {
    console.log(`🔍 COLUMNS DEBUG: Showing available columns from first few records`);
    for (let i = 0; i < Math.min(3, records.length); i++) {
      debugAvailableColumns(records[i], i);
    }
  }
  
  const results: ParsedCostRecord[] = [];
  let skipped = 0;
  
  for (let i = 0; i < records.length; i++) {
    const parsed = parseCostRecord(records[i], i);
    if (parsed) {
      results.push(parsed);
    } else {
      skipped++;
    }
  }
  
  console.log(`✅ COST PARSER: Completed batch parse - ${results.length} valid, ${skipped} skipped`);
  
  return results;
}

// ==================== DEBUGGING UTILS ====================

// 🔍 DEBUG: Mostrar todas las columnas disponibles en un registro
export function debugAvailableColumns(record: RawCostRecord, index: number = 0): void {
  console.log(`🔍 AVAILABLE COLUMNS FOR ROW ${index}:`);
  const keys = Object.keys(record);
  keys.forEach(key => {
    const value = (record as any)[key];
    const type = typeof value;
    const preview = String(value).substring(0, 50);
    console.log(`  📋 ${key}: ${type} = "${preview}${String(value).length > 50 ? '...' : ''}"`);
  });
  console.log(`📊 Total columns: ${keys.length}`);
}

export function debugCostRecord(record: RawCostRecord): void {
  console.log('🔍 COST DEBUG RECORD:', {
    clientMappings: COLUMN_MAPPINGS.clientName.map(k => ({ [k]: (record as any)[k] })),
    projectMappings: COLUMN_MAPPINGS.projectName.map(k => ({ [k]: (record as any)[k] })),
    monthMappings: COLUMN_MAPPINGS.month.map(k => ({ [k]: (record as any)[k] })),
    yearMappings: COLUMN_MAPPINGS.year.map(k => ({ [k]: (record as any)[k] })),
    arsAmountMappings: COLUMN_MAPPINGS.arsAmount.map(k => ({ [k]: (record as any)[k] })),
    usdAmountMappings: COLUMN_MAPPINGS.usdAmount.map(k => ({ [k]: (record as any)[k] })),
    confirmedMappings: COLUMN_MAPPINGS.confirmed.map(k => ({ [k]: (record as any)[k] })),
    kindMappings: COLUMN_MAPPINGS.kind.map(k => ({ [k]: (record as any)[k] }))
  });
}