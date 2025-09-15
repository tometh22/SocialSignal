/**
 * Adaptador para integrar sistema universal con datos existentes
 * Convierte datos del Excel MAESTRO a formato universal
 */

import { getProjectConfig } from './project-config.js';
import { normMonth } from './num.js';
import type { UniversalRow } from './rankings-universal.js';

/**
 * Helper function to access cells robustly from different row formats
 */
function getCell(row: ExcelRow, key: string | number): unknown {
  // Handle numeric index directly
  if (typeof key === 'number') {
    if (Array.isArray(row)) return row[key];
    if (row.values && Array.isArray(row.values)) return row.values[key];
    return undefined;
  }
  
  // Handle string key (column letter or header name)
  if (typeof key === 'string') {
    // Try direct object property access first
    if (row[key] !== undefined) return row[key];
    
    // Convert column letter to index (A=0, B=1, etc.)
    if (key.length === 1 && key >= 'A' && key <= 'Z') {
      const index = key.charCodeAt(0) - 65; // A=0
      if (Array.isArray(row)) return row[index];
      if (row.values && Array.isArray(row.values)) return row.values[index];
    }
  }
  
  return undefined;
}

/**
 * Checks if a person value looks like a header row
 */
function isHeaderRow(person: unknown): boolean {
  if (typeof person !== 'string') return false;
  const normalized = person.toLowerCase().trim();
  return normalized === 'cliente' || normalized === 'proyecto' || 
         normalized === 'persona' || normalized === 'detalle' ||
         normalized === '' || normalized === '#n/a';
}

export interface ExcelRow {
  [column: string]: unknown;
}

/**
 * Convierte datos del Excel MAESTRO al formato universal
 */
export function adaptExcelToUniversal(
  excelRows: ExcelRow[], 
  projectKey: string,
  projectId: string
): UniversalRow[] {
  const config = getProjectConfig(projectKey);
  const { columnMap } = config;
  
  return excelRows.map(row => {
    const persona = getCell(row, columnMap.persona);
    const personStr = String(persona || '').trim();
    
    // Skip header rows
    if (isHeaderRow(persona)) {
      return null;
    }
    
    const yearRaw = getCell(row, columnMap.year);
    const monthRaw = getCell(row, columnMap.month);
    
    return {
      person: personStr,
      projectId,
      year: yearRaw ? parseInt(String(yearRaw)) || new Date().getFullYear() : new Date().getFullYear(),
      month: monthRaw ? normMonth(monthRaw) : new Date().getMonth() + 1,
      horasReal: getCell(row, columnMap.horasReal),
      horasObjetivo: getCell(row, columnMap.horasObjetivo), 
      horasFacturacion: getCell(row, columnMap.horasFacturacion),
      valorHoraARS: getCell(row, columnMap.valorHoraARS),
      montoUSD: columnMap.montoUSD ? getCell(row, columnMap.montoUSD) : undefined
    };
  }).filter(row => 
    // Filtrar filas válidas (persona no vacía y no null)
    row && row.person && row.person !== '' && row.person !== '#N/A'
  ) as UniversalRow[];
}

/**
 * Mantiene compatibilidad con la interfaz existente DocumentRankingResult
 */
export function formatForExistingInterface(universalResult: any) {
  return {
    persona: universalResult.person,
    eficiencia: {
      score: Math.round(universalResult.eficiencia),
      display: `${Math.round(universalResult.eficiencia)}%`,
      clasificacion: getClasificacion(universalResult.eficiencia, 'eficiencia')
    },
    impacto: {
      score: Math.round(universalResult.impacto),
      scoreDecimal: universalResult.impacto, // Para tooltips precisos
      display: `${Math.round(universalResult.impacto)} pts`,
      clasificacion: getClasificacion(universalResult.impacto, 'impacto')
    },
    unificado: {
      score: Math.round(universalResult.unificado * 10) / 10, // 1 decimal
      display: `${(Math.round(universalResult.unificado * 10) / 10).toFixed(1)} pts`,
      clasificacion: getClasificacion(universalResult.unificado, 'unificado')
    },
    horas: {
      real: universalResult.horasReal,
      objetivo: universalResult.horasObjetivo
    },
    economia: {
      participacion_pct: 0 // Se calculará dinámicamente si se necesita
    }
  };
}

/**
 * Clasificación de colores para rankings (compatible con sistema existente)
 */
function getClasificacion(score: number, tipo: 'eficiencia' | 'impacto' | 'unificado') {
  // Umbrales ajustados según el tipo de métrica
  let thresholds: { excellent: number; good: number; fair: number };
  
  switch (tipo) {
    case 'eficiencia':
      thresholds = { excellent: 90, good: 75, fair: 60 };
      break;
    case 'impacto':
      thresholds = { excellent: 20, good: 15, fair: 10 };
      break;
    case 'unificado':
      thresholds = { excellent: 70, good: 55, fair: 40 };
      break;
  }
  
  if (score >= thresholds.excellent) {
    return { label: 'Excelente', color: 'text-green-600' };
  } else if (score >= thresholds.good) {
    return { label: 'Bueno', color: 'text-yellow-600' };
  } else if (score >= thresholds.fair) {
    return { label: 'Regular', color: 'text-orange-600' };
  } else {
    return { label: 'Bajo', color: 'text-red-600' };
  }
}