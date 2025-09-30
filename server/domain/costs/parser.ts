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

// 🎯 MAPEO CANÓNICO - Adaptado a la estructura real de la base de datos
const COLUMN_MAPPINGS = {
  // Cliente: usar estructura real de DB
  clientName: ['cliente', 'Cliente', 'client', 'clientName'],
  
  // Proyecto: usar estructura real de DB  
  projectName: ['proyecto', 'Proyecto', 'project', 'projectName'],
  
  // 🚨 CORRECCIÓN CRÍTICA: Usar month_key (correcto) en lugar de mes+año (corrupto)
  // Mes: usar estructura real de DB (DEPRECADO - datos corruptos)
  month: ['mes', 'Mes', 'month'],
  
  // Año: usar estructura real de DB (DEPRECADO - datos corruptos)
  year: ['año', 'Año', 'anio', 'year'],
  
  // 🎯 NUEVO: Month Key - campo correcto para período (formato YYYY-MM)
  monthKey: ['month_key', 'monthKey', 'period'],
  
  // Tipo de gasto: usar estructura real de DB
  kind: ['tipoGasto', 'Tipo', 'tipo', 'Tipo_Gasto'],
  
  // Confirmado: no parece estar en la DB actual - omitir validación
  confirmed: ['confirmado', 'Confirmado', 'confirmed'],
  
  // Total ARS: estructura real de DB con variantes snake_case
  arsAmount: ['costoTotal', 'costo_total', 'Total ARS', 'Monto_ARS', 'costoTotalARS'],
  
  // Total USD: estructura real de DB con variantes snake_case y camelCase
  usdAmount: ['montoTotalUSD', 'montoTotalUsd', 'monto_total_usd', 'Total USD', 'Monto_USD', 'costoTotalUSD'],
  
  // 🎯 ANTI-×100: Campos para detectar costos calculados por horas
  hoursReal: ['horas_reales_asana', 'horasRealesAsana', 'horas_reales', 'hoursReal'],
  hourlyRate: ['valor_hora_persona', 'valorHoraPersona', 'hourlyRate', 'valor_hora'],
  persona: ['persona', 'Persona', 'person', 'nombre']
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

// ==================== PERIOD CONSTRUCTION ====================

function isNonEmpty(value: string | undefined | null): boolean {
  return value !== undefined && value !== null && value.trim() !== '';
}

function buildFromMesAnio(mes: string | undefined, año: string | undefined): string {
  if (!mes || !año) {
    return '';
  }
  
  const monthNum = spanishMonthToNumber(mes);
  const yearStr = String(año).trim();
  
  // Validar que tenemos un año válido
  if (!/^\d{4}$/.test(yearStr)) {
    return '';
  }
  
  // Validar que el mes es válido
  if (!/^\d{2}$/.test(monthNum)) {
    return '';
  }
  
  return `${yearStr}-${monthNum}`;
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
  for (const key of mappings) {
    const value = (record as any)[key];
    if (value !== undefined && value !== null && value !== '') {
      
      // 🔧 DRIZZLE DECIMAL HANDLING: Detectar y convertir objetos Decimal
      if (typeof value === 'object' && value !== null) {
        // Intentar métodos comunes de Decimal: .valueOf(), .toNumber(), .toString()
        if (typeof value.valueOf === 'function') {
          const numValue = value.valueOf();
          if (typeof numValue === 'number' && !isNaN(numValue)) {
            return numValue;
          }
        }
        if (typeof value.toNumber === 'function') {
          const numValue = value.toNumber();
          if (typeof numValue === 'number' && !isNaN(numValue)) {
            return numValue;
          }
        }
        // Último intento: usar toString()
        const strValue = value.toString();
        if (strValue !== '[object Object]') {
          const cleaned = strValue.replace(/[$,\s]/g, '');
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      }
      
      // 🔧 STANDARD HANDLING: Strings y números primitivos
      const strValue = String(value).trim();
      const cleaned = strValue.replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}


// ==================== MAIN PARSER ====================

export function parseCostRecord(
  record: RawCostRecord, 
  rowIndex: number = 0
): ParsedCostRecord | null {
  
  // 🔍 EXTRACT FIELDS
  const clientName = extractField(record, COLUMN_MAPPINGS.clientName);
  const projectName = extractField(record, COLUMN_MAPPINGS.projectName);
  
  // 🚨 CORRECCIÓN CRÍTICA: Usar month_key (correcto) en lugar de mes+año (corrupto)
  const monthKeyRaw = extractField(record, COLUMN_MAPPINGS.monthKey);
  
  // 🚫 DEPRECADO: Campos corruptos mes+año (conservar por debugging)
  const monthRaw = extractField(record, COLUMN_MAPPINGS.month);
  const yearRaw = extractField(record, COLUMN_MAPPINGS.year);
  
  const confirmedRaw = extractField(record, COLUMN_MAPPINGS.confirmed);
  const kindRaw = extractField(record, COLUMN_MAPPINGS.kind);
  
  // ⚠️ REQUIRED FIELDS - clientName es obligatorio
  if (!clientName) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - missing clientName`);
    console.log(`🔍 COST PARSER DEBUG: Available keys in record:`, Object.keys(record));
    console.log(`🔍 COST PARSER DEBUG: Record sample:`, record);
    return null;
  }
  
  // 🎯 PERIOD EXTRACTION - Plan exacto: month_key prioritario, fallback a mes+año solo si falta
  const periodKey = isNonEmpty(monthKeyRaw) 
    ? String(monthKeyRaw) 
    : buildFromMesAnio(monthRaw, yearRaw);
    
  // 🔧 VALIDACIÓN: Verificar formato YYYY-MM exacto
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - bad periodKey:`, { 
      periodKey,
      monthKeyRaw, 
      monthRaw,
      yearRaw,
      expectedFormat: 'YYYY-MM'
    });
    console.log(`🔍 COST PARSER DEBUG: clientName="${clientName}", projectName="${projectName}"`);
    console.log(`🔍 COST PARSER DEBUG: Full record sample:`, record);
    return null;
  }
  
  const period: PeriodKey = periodKey as PeriodKey;
  
  // 🔍 AMOUNTS
  const arsAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.arsAmount);
  const usdAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.usdAmount);
  
  // At least one amount must be present
  if (!arsAmountRaw && !usdAmountRaw) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - no valid amounts`);
    return null;
  }
  
  // 🎯 ANTI-×100 PARA COSTOS CALCULADOS POR HORAS
  // Regla: Si hay horas_reales_asana Y valor_hora_persona, y horas > 300 → dividir costo_total por 100
  const hoursReal = extractNumericField(record, COLUMN_MAPPINGS.hoursReal);
  const hourlyRate = extractNumericField(record, COLUMN_MAPPINGS.hourlyRate);
  const persona = extractField(record, COLUMN_MAPPINGS.persona);
  
  let arsAmount: number | null = null;
  let usdAmount: number | null = null;
  
  // Detectar si es un costo calculado por horas
  const isHourBasedCost = hoursReal && hoursReal > 0 && hourlyRate && hourlyRate > 0;
  
  // Detectar USD corrupto (astronómico)
  const usdIsCorrupt = usdAmountRaw && (
    !isFinite(usdAmountRaw) || 
    usdAmountRaw > 100_000
  );
  
  if (arsAmountRaw && arsAmountRaw > 0) {
    // 🎯 REGLA ANTI-×100: Si hoursReal > 300 (astronómico), dividir costo_total por 100
    // El indicador es las horas astronómicas, no la presencia de hourlyRate
    if (hoursReal && hoursReal > 300) {
      arsAmount = Math.round((arsAmountRaw / 100) * 100) / 100; // Redondeo a 2 decimales
      console.log(`🔧 ANTI_×100_HOURS: {persona: "${persona}", cliente: "${clientName}", proyecto: "${projectName}", horas_raw: ${hoursReal}, horas_fix: ${(hoursReal! / 100).toFixed(2)}, costo_raw: ${arsAmountRaw}, costo_fix: ${arsAmount}}`);
    } else {
      arsAmount = arsAmountRaw;
    }
  }
  
  // USD: Ignorar si está corrupto (astronómico)
  if (usdAmountRaw && usdAmountRaw > 0 && !usdIsCorrupt) {
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