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

// 🎯 MAPEO CANÓNICO - aliases exactos del checklist del usuario
const COLUMN_MAPPINGS = {
  // Cliente: ["Cliente","cliente","client","clientName"]
  clientName: ['Cliente', 'cliente', 'client', 'clientName'],
  
  // Proyecto: ["Proyecto","proyecto","project","projectName"]  
  projectName: ['Proyecto', 'proyecto', 'project', 'projectName'],
  
  // Mes: ["Mes","mes","month"] → acepta "agosto", "Ago", "08 ago"
  month: ['Mes', 'mes', 'month'],
  
  // Año: ["Año","anio","año","year"]
  year: ['Año', 'anio', 'año', 'year'],
  
  // Tipo de gasto (para filtrar directos): ["Tipo","tipo","Tipo_Gasto","tipoGasto"]
  kind: ['Tipo', 'tipo', 'Tipo_Gasto', 'tipoGasto'],
  
  // Confirmado: ["Confirmado","confirmado","confirmed"] → "Si" = true
  confirmed: ['Confirmado', 'confirmado', 'confirmed'],
  
  // Total ARS: ["Total ARS","Monto_ARS","costoTotalARS","total_ars"]
  arsAmount: ['Total ARS', 'Monto_ARS', 'costoTotalARS', 'total_ars'],
  
  // Total USD: ["Total USD","Monto_USD","costoTotalUSD","total_usd"]
  usdAmount: ['Total USD', 'Monto_USD', 'costoTotalUSD', 'total_usd']
};

// ==================== CURRENCY DETECTION ====================

function detectNativeCurrency(usdAmount: number | null, arsAmount: number | null): {
  native: 'USD' | 'ARS' | null;
  warning?: string;
} {
  // 🎯 CHECKLIST: Si Total USD > 0 ⇒ moneda nativa = USD
  if (usdAmount && usdAmount > 0) {
    // 🎯 CHECKLIST: Si ambos > 0 ⇒ warning en auditor
    if (arsAmount && arsAmount > 0) {
      return {
        native: 'USD',
        warning: `Dual currency row: USD ${usdAmount}, ARS ${arsAmount} - using USD`
      };
    }
    return { native: 'USD' };
  }
  
  // 🎯 CHECKLIST: Si Total USD = 0 y Total ARS > 0 ⇒ nativa = ARS
  if (arsAmount && arsAmount > 0) {
    return { native: 'ARS' };
  }
  
  return { native: null };
}

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
  // 🎯 CHECKLIST: Confirmado → "Si" = true (exacto del usuario)
  if (confirmedRaw && confirmedRaw.toLowerCase().trim() !== 'si') {
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
  
  // 🎯 CHECKLIST: Sin anti-x100 en costos (esa regla era para ingresos)
  // Usar valores directos sin deflación
  let arsAmount: number | null = null;
  let usdAmount: number | null = null;
  
  if (arsAmountRaw && arsAmountRaw > 0) {
    arsAmount = arsAmountRaw;
  }
  
  if (usdAmountRaw && usdAmountRaw > 0) {
    usdAmount = usdAmountRaw;
  }
  
  // 🎯 CHECKLIST: Detectar moneda nativa
  const currencyDetection = detectNativeCurrency(usdAmount, arsAmount);
  if (currencyDetection.warning) {
    console.log(`⚠️ DUAL CURRENCY: ${currencyDetection.warning}`);
  }
  
  // 🔍 COST KIND - FILTRO DIRECTO
  // 🎯 CHECKLIST: Sólo Directo: Tipo in {"Directo","Directos"}
  if (!kindRaw) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - no tipo de gasto`);
    return null;
  }
  
  const kindLower = kindRaw.toLowerCase().trim();
  if (!['directo', 'directos'].includes(kindLower)) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - not directo: "${kindRaw}"`);
    return null;
  }
  
  const kind: CostKind = 'Directo';
  
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