/**
 * Adaptador para integrar sistema universal con datos existentes
 * Convierte datos del Excel MAESTRO a formato universal
 */

import { getProjectConfig } from './project-config.js';
import { normMonth } from './num.js';
import type { UniversalRow } from './rankings-universal.js';

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
  
  return excelRows.map(row => ({
    person: String(row[columnMap.persona] || '').trim(),
    projectId,
    year: row[columnMap.year] || new Date().getFullYear(),
    month: row[columnMap.month] || new Date().getMonth() + 1,
    horasReal: row[columnMap.horasReal],
    horasObjetivo: row[columnMap.horasObjetivo],
    horasFacturacion: row[columnMap.horasFacturacion],
    valorHoraARS: row[columnMap.valorHoraARS],
    montoUSD: columnMap.montoUSD ? row[columnMap.montoUSD] : undefined
  })).filter(row => 
    // Filtrar filas válidas (persona no vacía)
    row.person && row.person !== '' && row.person !== '#N/A'
  );
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