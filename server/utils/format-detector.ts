/**
 * 🔍 DETECTOR AUTOMÁTICO DE FORMATOS
 * Identifica automáticamente el formato de datos entrantes
 */

import { LINEAS_GENERALES_SPEC } from '../etl/lineas-generales-spec';
import { VENTAS_TOMI_SPEC } from '../etl/sales-spec';

export type DetectedFormat = 
  | 'lineas_generales'
  | 'ventas_tomi'
  | 'costs_general'
  | 'unknown';

export interface FormatDetectionResult {
  format: DetectedFormat;
  confidence: number; // 0-1
  matchedFields: string[];
  missingFields: string[];
  extraFields: string[];
  reasons: string[];
}

/**
 * 🔍 Detecta automáticamente el formato de un dataset
 */
export function detectFormat(data: any[]): FormatDetectionResult {
  if (!data || data.length === 0) {
    return {
      format: 'unknown',
      confidence: 0,
      matchedFields: [],
      missingFields: [],
      extraFields: [],
      reasons: ['No data provided']
    };
  }

  // Obtener headers del primer registro
  const headers = Object.keys(data[0]);
  console.log(`🔍 FORMAT DETECTOR: Analyzing ${headers.length} headers: ${headers.join(', ')}`);

  // Probar cada formato conocido
  const results = [
    detectLineasGenerales(headers),
    detectVentasTomi(headers),
    detectCostsGeneral(headers)
  ];

  // Ordenar por confianza y retornar el mejor match
  results.sort((a, b) => b.confidence - a.confidence);
  const best = results[0];

  console.log(`🔍 FORMAT DETECTOR: Best match = ${best.format} (confidence: ${best.confidence.toFixed(2)})`);
  console.log(`🔍 FORMAT DETECTOR: Reasons: ${best.reasons.join(', ')}`);

  return best;
}

/**
 * 🔧 Detecta formato "líneas generales"
 */
function detectLineasGenerales(headers: string[]): FormatDetectionResult {
  const spec = LINEAS_GENERALES_SPEC;
  const result: FormatDetectionResult = {
    format: 'lineas_generales',
    confidence: 0,
    matchedFields: [],
    missingFields: [],
    extraFields: [],
    reasons: []
  };

  let matches = 0;
  let requiredMatches = 0;
  let totalRequired = 0;

  // Verificar cada campo de la spec
  for (const [fieldName, fieldSpec] of Object.entries(spec)) {
    if (fieldSpec.required) totalRequired++;

    let found = false;
    
    // Buscar cabecera principal
    if (headers.some(h => h.toLowerCase().trim() === fieldSpec.cabecera.toLowerCase().trim())) {
      matches++;
      if (fieldSpec.required) requiredMatches++;
      result.matchedFields.push(fieldName);
      found = true;
    }
    // Buscar en sinónimos
    else if (fieldSpec.sinonimos.some(syn => 
      headers.some(h => h.toLowerCase().trim() === syn.toLowerCase().trim())
    )) {
      matches++;
      if (fieldSpec.required) requiredMatches++;
      result.matchedFields.push(fieldName);
      found = true;
    }
    // Buscar en campos con prioridad
    else if ('prioridad' in fieldSpec && fieldSpec.prioridad) {
      for (const priority of fieldSpec.prioridad) {
        if (headers.some(h => h.toLowerCase().trim() === priority.toLowerCase().trim())) {
          matches++;
          if (fieldSpec.required) requiredMatches++;
          result.matchedFields.push(fieldName);
          result.reasons.push(`Found priority field: ${priority}`);
          found = true;
          break;
        }
      }
    }

    if (!found && fieldSpec.required) {
      result.missingFields.push(fieldName);
    }
  }

  // Calcular confianza
  const requiredScore = totalRequired > 0 ? (requiredMatches / totalRequired) : 0;
  const overallScore = Object.keys(spec).length > 0 ? (matches / Object.keys(spec).length) : 0;
  result.confidence = (requiredScore * 0.8) + (overallScore * 0.2);

  // Verificar campos característicos de líneas generales
  const hasMontoPreference = headers.some(h => 
    h.toLowerCase().includes('monto total usd') || h.toLowerCase().includes('monto original usd')
  );
  const hasHoursPreference = headers.some(h => 
    h.toLowerCase().includes('cantidad de horas asana') || h.toLowerCase().includes('cantidad de horas')
  );
  const hasCotization = headers.some(h => 
    h.toLowerCase().includes('cotización') || h.toLowerCase().includes('cotizacion')
  );

  if (hasMontoPreference) {
    result.confidence += 0.1;
    result.reasons.push('Has USD amount preference fields');
  }
  if (hasHoursPreference) {
    result.confidence += 0.1;
    result.reasons.push('Has hours preference fields');
  }
  if (hasCotization) {
    result.confidence += 0.1;
    result.reasons.push('Has exchange rate (cotización) field');
  }

  // Penalizar si faltan campos críticos
  if (result.missingFields.length > 0) {
    result.confidence *= (1 - (result.missingFields.length * 0.15));
    result.reasons.push(`Missing required fields: ${result.missingFields.join(', ')}`);
  }

  result.reasons.push(`Matched ${matches}/${Object.keys(spec).length} fields`);
  result.reasons.push(`Required fields: ${requiredMatches}/${totalRequired}`);

  return result;
}

/**
 * 🔧 Detecta formato "ventas tomi"
 */
function detectVentasTomi(headers: string[]): FormatDetectionResult {
  const spec = VENTAS_TOMI_SPEC;
  const result: FormatDetectionResult = {
    format: 'ventas_tomi',
    confidence: 0,
    matchedFields: [],
    missingFields: [],
    extraFields: [],
    reasons: []
  };

  let matches = 0;
  let requiredMatches = 0;
  let totalRequired = 0;

  // Verificar cada campo de la spec
  for (const [fieldName, fieldSpec] of Object.entries(spec)) {
    if (fieldSpec.required) totalRequired++;

    let found = false;
    
    // Buscar cabecera principal
    if (headers.some(h => h.toLowerCase().trim() === fieldSpec.cabecera.toLowerCase().trim())) {
      matches++;
      if (fieldSpec.required) requiredMatches++;
      result.matchedFields.push(fieldName);
      found = true;
    }
    // Buscar en sinónimos
    else if (fieldSpec.sinonimos && fieldSpec.sinonimos.some(syn => 
      headers.some(h => h.toLowerCase().trim() === syn.toLowerCase().trim())
    )) {
      matches++;
      if (fieldSpec.required) requiredMatches++;
      result.matchedFields.push(fieldName);
      found = true;
    }

    if (!found && fieldSpec.required) {
      result.missingFields.push(fieldName);
    }
  }

  // Calcular confianza
  const requiredScore = totalRequired > 0 ? (requiredMatches / totalRequired) : 0;
  const overallScore = Object.keys(spec).length > 0 ? (matches / Object.keys(spec).length) : 0;
  result.confidence = (requiredScore * 0.8) + (overallScore * 0.2);

  // Características específicas de Ventas Tomi
  const hasVentasTomiFields = headers.some(h => 
    h.toLowerCase().includes('confirmado') || 
    h.toLowerCase().includes('fx applied') ||
    h.toLowerCase().includes('sales type')
  );

  if (hasVentasTomiFields) {
    result.confidence += 0.15;
    result.reasons.push('Has Ventas Tomi specific fields');
  }

  result.reasons.push(`Matched ${matches}/${Object.keys(spec).length} fields`);
  result.reasons.push(`Required fields: ${requiredMatches}/${totalRequired}`);

  return result;
}

/**
 * 🔧 Detecta formato genérico de costos
 */
function detectCostsGeneral(headers: string[]): FormatDetectionResult {
  const result: FormatDetectionResult = {
    format: 'costs_general',
    confidence: 0,
    matchedFields: [],
    missingFields: [],
    extraFields: [],
    reasons: []
  };

  // Palabras clave que indican costos
  const costKeywords = [
    'cost', 'costo', 'gasto', 'expense',
    'hours', 'horas', 'tiempo', 'time',
    'rate', 'tasa', 'tarifa', 'salary', 'salario'
  ];

  let costIndicators = 0;
  const foundKeywords: string[] = [];

  for (const header of headers) {
    const headerLower = header.toLowerCase();
    for (const keyword of costKeywords) {
      if (headerLower.includes(keyword)) {
        costIndicators++;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
        break;
      }
    }
  }

  result.confidence = Math.min(costIndicators * 0.15, 0.8);
  result.reasons.push(`Found cost keywords: ${foundKeywords.join(', ')}`);
  result.reasons.push(`Cost indicators: ${costIndicators}`);

  return result;
}

/**
 * 🎯 Función de utilidad para determinar el mejor ETL a usar
 */
export function selectETLProcessor(detection: FormatDetectionResult): {
  processor: string;
  confidence: number;
  shouldUse: boolean;
} {
  const threshold = 0.6; // Umbral mínimo de confianza

  if (detection.confidence < threshold) {
    return {
      processor: 'unknown',
      confidence: detection.confidence,
      shouldUse: false
    };
  }

  return {
    processor: detection.format,
    confidence: detection.confidence,
    shouldUse: true
  };
}