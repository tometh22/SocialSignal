/**
 * 🚀 COSTS PARSER - MAPEO Y ANTI-ESCALA
 * 
 * Parser robusto para costos que maneja:
 * - Mapeo flexible de columnas (ES/EN/camel)
 * - Conversión de meses en español
 * - Anti-escala para ARS y USD
 * - Validación y normalización
 */

import type { RawCostRecord, ParsedCostRecord, PeriodKey, CostKind, RejectedCostRecord } from './types';
import { parseNumberRobust } from '../../utils/number';

// ==================== CANONICALIZATION ====================

/**
 * Canonicaliza strings para matching consistente (config, projectKeys, etc)
 * Normaliza Unicode, elimina diacríticos, lowercase, espacios únicos
 */
export function canonicalizeString(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ==================== COLUMN MAPPING ====================

// 🎯 MAPEO CANÓNICO - Nombres EXACTOS del Excel MAESTRO + variantes DB/legacy
const COLUMN_MAPPINGS = {
  // Cliente: EXCEL: "Cliente"
  clientName: ['Cliente', 'cliente', 'client', 'clientName'],
  
  // Proyecto: EXCEL: "Proyecto"
  projectName: ['Proyecto', 'proyecto', 'project', 'projectName'],
  
  // Mes: EXCEL: "Mes"
  month: ['Mes', 'mes', 'month'],
  
  // Año: EXCEL: "Año"
  year: ['Año', 'año', 'anio', 'year'],
  
  // 🎯 NUEVO: Month Key - campo correcto para período (formato YYYY-MM)
  monthKey: ['month_key', 'monthKey', 'period'],
  
  // Tipo de gasto: EXCEL: "Tipo de Costo" (Directo/Indirecto)
  // ✅ FALLBACK: "Subtipo de costo" cuando "Tipo de Costo" está vacío
  kind: ['Tipo de Costo', 'Subtipo de costo', 'Tipo de Coste', 'Tipo Costo', 'tipo_costo', 'tipoCosto', 'tipoGasto', 'Tipo_Gasto', 'categoria', 'Categoria', 'kind'],
  
  // Confirmado: no parece estar en la DB actual - omitir validación
  confirmed: ['confirmado', 'Confirmado', 'confirmed'],
  
  // Total ARS: EXCEL: "Moneda Original ARS"
  arsAmount: ['Moneda Original ARS', 'montoARS', 'Monto Total ARS', 'costoTotal', 'costo_total', 'Total ARS', 'Monto_ARS', 'costoTotalARS'],
  
  // Total USD: EXCEL: "Monto Total USD"
  usdAmount: ['Monto Total USD', 'Moneda Original USD', 'montoTotalUSD', 'montoTotalUsd', 'monto_total_usd', 'Total USD', 'Monto_USD', 'costoTotalUSD'],
  
  // 🎯 ANTI-×100: Campos para detectar costos calculados por horas
  // EXCEL: "Cantidad de horas reales Asana"
  hoursReal: ['Cantidad de horas reales Asana', 'horas_reales_asana', 'horasRealesAsana', 'horas_reales', 'hoursReal'],
  
  // EXCEL: "Valor Hora"
  hourlyRate: ['Valor Hora', 'valor_hora_persona', 'valorHoraPersona', 'hourlyRate', 'valor_hora'],
  
  // EXCEL: "Detalle" (nombre de persona)
  persona: ['Detalle', 'persona', 'Persona', 'person', 'nombre']
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
        // Último intento: usar toString() + parseNumberRobust
        const strValue = value.toString();
        if (strValue !== '[object Object]') {
          const parsed = parseNumberRobust(strValue);
          if (parsed !== null) {
            return parsed;
          }
        }
      }
      
      // 🔧 STANDARD HANDLING: Usar parseNumberRobust para manejar formato argentino
      const parsed = parseNumberRobust(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
}


// ==================== TIPO DE COSTO FALLBACK ====================

/**
 * 🎯 FALLBACK CONTROLADO: Mapear Subtipo de costo → Tipo de Costo
 * Reglas de negocio para completar clasificación cuando "Tipo de Costo" está vacío
 */
function inferTipoCostoFromSubtipo(subtipo: string | undefined): string | null {
  if (!subtipo) return null;
  
  const subtipoNorm = subtipo.toLowerCase().trim();
  
  // ✅ DIRECTOS: Roles y recursos asignables a proyectos
  const directoKeywords = [
    'equipo', 'coordinación', 'coordinacion', 'qa', 'freelance', 
    'diseño', 'diseno', 'analista', 'pm', 'data', 'cuenta',
    'developer', 'desarrollador', 'programador'
  ];
  
  // ✅ INDIRECTOS: Gastos generales no asignables
  const indirectoKeywords = [
    'tarjeta', 'herramientas', 'licencias generales', 
    'administración', 'administracion', 'marketing interno', 
    'viajes internos', 'overhead', 'office'
  ];
  
  // Buscar match en directos
  for (const keyword of directoKeywords) {
    if (subtipoNorm.includes(keyword)) {
      return 'Directo';
    }
  }
  
  // Buscar match en indirectos
  for (const keyword of indirectoKeywords) {
    if (subtipoNorm.includes(keyword)) {
      return 'Indirecto';
    }
  }
  
  // Caso especial: "Costos directos e indirectos" 
  if (subtipoNorm.includes('costos directos e indirectos')) {
    return 'costos directos e indirectos';
  }
  
  return null; // No se pudo inferir
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
  let kindRaw = extractField(record, COLUMN_MAPPINGS.kind);
  
  // 🎯 FALLBACK CONTROLADO: Si "Tipo de Costo" está vacío, inferir desde "Subtipo de costo"
  let autoClassified = false;
  if (!kindRaw) {
    const subtipo = extractField(record, ['Subtipo de costo', 'subtipo', 'categoria']);
    const inferred = inferTipoCostoFromSubtipo(subtipo);
    
    if (inferred) {
      kindRaw = inferred;
      console.log(`🔧 FALLBACK: Row ${rowIndex} - Inferido "${inferred}" desde Subtipo "${subtipo}"`);
    } else {
      // 🆕 TOLERANT FALLBACK: Default a "Directo" cuando falta tipo/subtipo
      // Esto permite que datos históricos sin clasificación se procesen
      kindRaw = 'Directo';
      autoClassified = true;
      console.log(`🔧 AUTO-CLASSIFY: Row ${rowIndex} - Defaulted to "Directo" (no tipo/subtipo found) - Cliente: "${clientName}", Proyecto: "${projectName}"`);
    }
  }
  
  const kindLower = kindRaw.toLowerCase().trim();
  // Accept multiple direct cost labels: "directo", "directos", "costos directos e indirectos"
  const isDirect = kindLower === 'directo' || 
                   kindLower === 'directos' ||
                   kindLower.includes('costos directos e indirectos');
  if (!isDirect) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - not directo (got "${kindRaw}")`);
    return null;
  }
  
  const kind: CostKind = 'Directo';
  
  // ⚠️ REQUIRED FIELDS - clientName es obligatorio SOLO para costos directos
  if (!clientName) {
    console.log(`🔍 COST PARSER: Skipping row ${rowIndex} - missing clientName`);
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
      const flags = ['ANTI_X100_HOURS'];
      if (hoursReal > 3000) flags.push('HOURS_IMPOSSIBLE');
      console.log(`🔧 ${flags.join(' + ')}: {persona: "${persona}", cliente: "${clientName}", proyecto: "${projectName}", horas_raw: ${hoursReal}, horas_fix: ${(hoursReal! / 100).toFixed(2)}, costo_raw: ${arsAmountRaw}, costo_fix: ${arsAmount}}`);
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
    // 🔍 FIX: Cuando USD == ARS, forzar nativeCurrency='USD' y anular ARS
    // Esto evita que sanitizeUSD descarte el USD por el guard "USD==ARS"
    if (currencyDetection.native === 'USD') {
      arsAmount = null;
      console.log(`🔧 DUAL CURRENCY FIX: Anulando arsAmount para preservar USD ${usdAmount}`);
    }
  }
  
  // Kind validation already done above (before clientName validation)
  
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
  
  // 📊 INSTRUMENTATION: Track skip reasons, fallbacks, and amounts
  const skipReasons: Record<string, number> = {};
  const skipAmountsByReason: Record<string, { ars: number; usd: number }> = {};
  const validAmountsByPeriod: Record<string, { ars: number; usd: number; count: number }> = {};
  const fallbackStats = {
    applied: 0,
    failed: 0,
    totalInferred: 0
  };
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Extract key fields for skip tracking
    let kindRaw = extractField(record, COLUMN_MAPPINGS.kind);
    const subtipo = extractField(record, ['Subtipo de costo', 'subtipo', 'categoria']);
    const clientName = extractField(record, COLUMN_MAPPINGS.clientName);
    const monthKeyRaw = extractField(record, COLUMN_MAPPINGS.monthKey);
    const monthRaw = extractField(record, COLUMN_MAPPINGS.month);
    const yearRaw = extractField(record, COLUMN_MAPPINGS.year);
    const arsAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.arsAmount);
    const usdAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.usdAmount);
    
    // Determine period for tracking
    const periodKey = monthKeyRaw || buildFromMesAnio(monthRaw, yearRaw);
    
    // Track fallback attempts
    const hadTipoCosto = !!kindRaw;
    if (!hadTipoCosto && subtipo) {
      const inferred = inferTipoCostoFromSubtipo(subtipo);
      if (inferred) {
        fallbackStats.applied++;
        fallbackStats.totalInferred++;
      } else {
        fallbackStats.failed++;
      }
    }
    
    const parsed = parseCostRecord(record, i);
    
    if (parsed) {
      results.push(parsed);
      
      // Track valid amounts by period
      if (!validAmountsByPeriod[parsed.period]) {
        validAmountsByPeriod[parsed.period] = { ars: 0, usd: 0, count: 0 };
      }
      validAmountsByPeriod[parsed.period].ars += parsed.arsAmount || 0;
      validAmountsByPeriod[parsed.period].usd += parsed.usdAmount || 0;
      validAmountsByPeriod[parsed.period].count++;
      
    } else {
      // Determine skip reason with more granularity
      let reason = 'unknown';
      
      // Re-extract kindRaw for accurate classification
      kindRaw = extractField(record, COLUMN_MAPPINGS.kind);
      
      if (!kindRaw && !subtipo) {
        reason = 'no_tipo_no_subtipo';
      } else if (!kindRaw && subtipo) {
        const inferred = inferTipoCostoFromSubtipo(subtipo);
        if (!inferred) {
          reason = 'subtipo_not_mappable';
        } else {
          // Must have failed another validation
          kindRaw = inferred;
        }
      }
      
      if (kindRaw && !['directo', 'directos'].includes(kindRaw.toLowerCase().trim()) && !kindRaw.toLowerCase().includes('costos directos e indirectos')) {
        reason = 'not_directo';
      } else if (kindRaw && !clientName) {
        reason = 'missing_clientName';
      } else if (!/^\d{4}-\d{2}$/.test(periodKey)) {
        reason = 'bad_periodKey';
      } else if (!arsAmountRaw && !usdAmountRaw) {
        reason = 'no_valid_amounts';
      }
      
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;
      
      // Track skipped amounts by reason
      if (!skipAmountsByReason[reason]) {
        skipAmountsByReason[reason] = { ars: 0, usd: 0 };
      }
      skipAmountsByReason[reason].ars += arsAmountRaw || 0;
      skipAmountsByReason[reason].usd += usdAmountRaw || 0;
    }
  }
  
  // 📊 LOG FALLBACK STATS
  console.log(`\n🔧 FALLBACK STATS:`);
  console.log(`  ✅ Applied: ${fallbackStats.applied} rows (inferred from Subtipo)`);
  console.log(`  ❌ Failed: ${fallbackStats.failed} rows (Subtipo not mappable)`);
  console.log(`  📊 Total inferred: ${fallbackStats.totalInferred}`);
  
  // 📊 LOG SKIP SUMMARY
  console.log(`\n📊 SKIP REASONS SUMMARY:`);
  Object.entries(skipReasons)
    .sort(([, countA], [, countB]) => countB - countA)
    .forEach(([reason, count]) => {
      const amounts = skipAmountsByReason[reason];
      console.log(`  ❌ ${reason}: ${count} rows (ARS: ${amounts.ars.toFixed(2)}, USD: ${amounts.usd.toFixed(2)})`);
    });
  
  // 📊 LOG VALID AMOUNTS BY PERIOD
  console.log(`\n📊 VALID AMOUNTS BY PERIOD:`);
  Object.entries(validAmountsByPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([period, amounts]) => {
      console.log(`  ✅ ${period}: ${amounts.count} rows (ARS: ${amounts.ars.toFixed(2)}, USD: ${amounts.usd.toFixed(2)})`);
    });
  
  const totalSkipped = Object.values(skipReasons).reduce((sum, count) => sum + count, 0);
  const percentWithoutTipo = ((fallbackStats.failed / records.length) * 100).toFixed(1);
  
  console.log(`\n✅ COST PARSER: Completed batch parse - ${results.length} valid, ${totalSkipped} skipped`);
  console.log(`⚠️ DATA QUALITY: ${percentWithoutTipo}% rows without classifiable Tipo de Costo`);
  
  return results;
}

// ==================== BATCH PARSER WITH REJECTIONS ====================

export function parseCostRecordsWithRejections(records: RawCostRecord[]): {
  valid: ParsedCostRecord[];
  rejected: RejectedCostRecord[];
} {
  console.log(`🔍 COST PARSER (WITH REJECTIONS): Starting batch parse of ${records.length} records`);
  
  const valid: ParsedCostRecord[] = [];
  const rejected: RejectedCostRecord[] = [];
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Extract key fields for rejection tracking
    const kindRaw = extractField(record, COLUMN_MAPPINGS.kind);
    const subtipo = extractField(record, ['Subtipo de costo', 'subtipo', 'categoria']);
    const clientName = extractField(record, COLUMN_MAPPINGS.clientName);
    const projectName = extractField(record, COLUMN_MAPPINGS.projectName);
    const monthKeyRaw = extractField(record, COLUMN_MAPPINGS.monthKey);
    const monthRaw = extractField(record, COLUMN_MAPPINGS.month);
    const yearRaw = extractField(record, COLUMN_MAPPINGS.year);
    const arsAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.arsAmount);
    const usdAmountRaw = extractNumericField(record, COLUMN_MAPPINGS.usdAmount);
    
    // Determine period for tracking
    const periodKey = monthKeyRaw || buildFromMesAnio(monthRaw, yearRaw);
    
    const parsed = parseCostRecord(record, i);
    
    if (parsed) {
      valid.push(parsed);
    } else {
      // Determine rejection reason
      let reason = 'unknown';
      
      if (!kindRaw && !subtipo) {
        reason = 'no_tipo_no_subtipo';
      } else if (!kindRaw && subtipo) {
        const inferred = inferTipoCostoFromSubtipo(subtipo);
        if (!inferred) {
          reason = 'subtipo_not_mappable';
        } else {
          // Must have failed another validation - determine which
          if (!clientName) {
            reason = 'missing_clientName';
          } else if (!/^\d{4}-\d{2}$/.test(periodKey)) {
            reason = 'bad_periodKey';
          } else if (!arsAmountRaw && !usdAmountRaw) {
            reason = 'no_valid_amounts';
          }
        }
      } else if (kindRaw && !['directo', 'directos'].includes(kindRaw.toLowerCase().trim()) && !kindRaw.toLowerCase().includes('costos directos e indirectos')) {
        reason = 'not_directo';
      } else if (kindRaw && !clientName) {
        reason = 'missing_clientName';
      } else if (!/^\d{4}-\d{2}$/.test(periodKey)) {
        reason = 'bad_periodKey';
      } else if (!arsAmountRaw && !usdAmountRaw) {
        reason = 'no_valid_amounts';
      }
      
      // Create rejected record
      // 🔧 FIX: Use ?? instead of || to preserve legitimate zero values
      // 🔧 FIX: Normalize empty periodKey to null (not empty string)
      rejected.push({
        rejectReason: reason,
        periodKey: periodKey && periodKey.trim() !== '' ? periodKey : null,
        clientName: clientName ?? null,
        projectName: projectName ?? null,
        tipoCosto: kindRaw ?? null,
        subtipoCosto: subtipo ?? null,
        amountARS: arsAmountRaw ?? null,
        amountUSD: usdAmountRaw ?? null,
        monthRaw: monthRaw ?? null,
        yearRaw: yearRaw !== undefined && yearRaw !== null ? String(yearRaw) : null,
        rawData: record
      });
    }
  }
  
  console.log(`✅ COST PARSER (WITH REJECTIONS): Completed - ${valid.length} valid, ${rejected.length} rejected`);
  
  return { valid, rejected };
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