/**
 * Sistema de configuración externa para proyectos
 * Permite usar diferentes spreadsheets y mappings por proyecto
 */

import fs from 'fs';
import path from 'path';

export interface ProjectConfig {
  spreadsheetId: string;
  sheetName: string;
  columnMap: {
    horasReal: string | number;
    horasObjetivo: string | number;
    horasFacturacion: string | number;
    valorHoraARS: string | number;
    montoUSD?: string | number;
    persona: string | number;
    year: string | number;
    month: string | number;
  };
  aliases?: Record<string, { start: string; end: string }>;
}

export interface ProjectConfigs {
  [projectKey: string]: ProjectConfig;
}

let cachedConfigs: ProjectConfigs | null = null;

/**
 * Carga configuración de proyectos desde JSON
 */
export function loadProjectConfigs(): ProjectConfigs {
  // Disable caching in development to pick up config changes
  if (cachedConfigs && process.env.NODE_ENV !== 'development') return cachedConfigs;
  
  try {
    const configPath = path.join(process.cwd(), 'shared', 'config', 'projects.json');
    const content = fs.readFileSync(configPath, 'utf8');
    cachedConfigs = JSON.parse(content);
    return cachedConfigs!;
  } catch (error) {
    console.error('Error loading project configs:', error);
    // Fallback a configuración por defecto
    return {
      kimberly_huggies: {
        spreadsheetId: process.env.DEFAULT_SHEET_ID || "1HIhMQsRN9Yg3-VJw6fJxv5NULWO6nKRIJCcW2TwmbdU",
        sheetName: "Ventas Tomi",
        columnMap: {
          horasReal: "L",
          horasObjetivo: "K",
          horasFacturacion: "M", 
          valorHoraARS: "N",
          montoUSD: "R",
          persona: "E",
          year: "A",
          month: "B"
        }
      }
    };
  }
}

/**
 * Obtiene configuración para un proyecto específico
 */
export function getProjectConfig(projectKey: string): ProjectConfig {
  const configs = loadProjectConfigs();
  const config = configs[projectKey];
  
  if (!config) {
    throw new Error(`No configuration found for project: ${projectKey}`);
  }
  
  return config;
}

/**
 * Resuelve período desde alias o rango directo
 */
export function resolvePeriod(periodInput: string, projectKey: string): { start: string; end: string } {
  const config = getProjectConfig(projectKey);
  
  // Buscar en aliases del proyecto
  if (config.aliases && config.aliases[periodInput]) {
    return config.aliases[periodInput];
  }
  
  // Resolver período estándar (yyyy-mm, rangos, etc.)
  return resolveStandardPeriod(periodInput);
}

/**
 * Resuelve períodos estándar (no específicos del proyecto)
 */
function resolveStandardPeriod(period: string): { start: string; end: string } {
  const currentYear = new Date().getFullYear();
  
  // Rango directo: "2024-01_to_2025-12" 
  if (period.includes('_to_')) {
    const [start, end] = period.split('_to_');
    return { start, end };
  }
  
  // Trimestres
  if (period.match(/^q[1-4]_\d{4}$/)) {
    const [, quarter, year] = period.match(/^q(\d)_(\d{4})$/)!;
    const q = parseInt(quarter);
    const quarters = {
      1: { start: '01', end: '03' },
      2: { start: '04', end: '06' },
      3: { start: '07', end: '09' },
      4: { start: '10', end: '12' }
    };
    return {
      start: `${year}-${quarters[q as keyof typeof quarters].start}`,
      end: `${year}-${quarters[q as keyof typeof quarters].end}`
    };
  }
  
  // Meses individuales: "july_2025", "mayo_2025"
  if (period.match(/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)_\d{4}$/)) {
    const [monthName, year] = period.split('_');
    const monthMap: Record<string, string> = {
      enero: '01', january: '01',
      febrero: '02', february: '02', 
      marzo: '03', march: '03',
      abril: '04', april: '04',
      mayo: '05', may: '05',
      junio: '06', june: '06',
      julio: '07', july: '07',
      agosto: '08', august: '08',
      septiembre: '09', september: '09',
      octubre: '10', october: '10',
      noviembre: '11', november: '11',
      diciembre: '12', december: '12'
    };
    const month = monthMap[monthName.toLowerCase()];
    return { start: `${year}-${month}`, end: `${year}-${month}` };
  }
  
  // Formato directo yyyy-mm
  if (period.match(/^\d{4}-\d{2}$/)) {
    return { start: period, end: period };
  }
  
  // Fallback: período actual
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const fallback = `${currentYear}-${currentMonth}`;
  
  console.warn(`Unknown period format: ${period}, using current month: ${fallback}`);
  return { start: fallback, end: fallback };
}