// domain/metrics.ts - MOTOR ÚNICO para todos los cálculos de proyecto

import { resolveProjectConfig } from '../services/projects';
import { resolveTimeFilter, isDateInRange, TimeFilter } from '../services/time';
import { parseDec } from '../services/number';
import { fxForRow, rateUSD } from '../services/fx';
import { readRows } from '../services/sheets';
import { storage } from '../storage';

// Helper function for month name to number conversion
function getMonthNumber(monthName: string): string {
  const monthMap: { [key: string]: string } = {
    'enero': '01', 'ene': '01', '01 ene': '01',
    'febrero': '02', 'feb': '02', '02 feb': '02', 
    'marzo': '03', 'mar': '03', '03 mar': '03',
    'abril': '04', 'abr': '04', '04 abr': '04',
    'mayo': '05', 'may': '05', '05 may': '05',
    'junio': '06', 'jun': '06', '06 jun': '06',
    'julio': '07', 'jul': '07', '07 jul': '07',
    'agosto': '08', 'ago': '08', '08 ago': '08',
    'septiembre': '09', 'sep': '09', '09 sep': '09',
    'octubre': '10', 'oct': '10', '10 oct': '10',
    'noviembre': '11', 'nov': '11', '11 nov': '11',
    'diciembre': '12', 'dic': '12', '12 dic': '12'
  };
  
  return monthMap[monthName.toLowerCase()] || '01';
}

export interface PeriodMetrics {
  summary: {
    period: string;
    basis: 'ECON' | 'EXEC';
    activeMembers: number;
    totalHours: number;
    efficiencyPct: number;
    teamCostUSD: number;
    revenueUSD: number;
    markupUSD: number;
    emptyStates: {
      costos: boolean;
      ingresos: boolean;
      horas: boolean;
      objetivos: boolean;
    };
    hasData: {
      costos: boolean;
      ingresos: boolean;
    };
  };
  teamBreakdown: PersonMetrics[];
  ingresos: { [key: string]: boolean }; // { "ingresos": true, "costos": true }
  costos: { [key: string]: boolean };
}

export interface PersonMetrics {
  personnelId: number | null;
  name: string;
  role: string;
  actualHours: number;
  actualCost: number;
  targetHours: number;
  budgetCost: number;
  efficiency: number;
  deviationHours: number;
  deviationCost: number;
  severity: 'normal' | 'warning' | 'critical';
}

/**
 * MOTOR ÚNICO: computeProjectPeriodMetrics()
 * Usado por TODOS los endpoints: /projects, /complete-data, /deviation-analysis
 * Implementa el algoritmo exacto de las especificaciones del usuario
 */
export async function computeProjectPeriodMetrics(
  projectId: number, 
  timeFilter: string, 
  basis: 'ECON' | 'EXEC' = 'ECON'
): Promise<PeriodMetrics> {
  
  // 1. cfg = resolveProjectConfig(projectId)
  const cfg = resolveProjectConfig(projectId);
  
  // 2. rng = resolveTimeFilter(timeFilter)
  const rng = resolveTimeFilter(timeFilter);
  
  // 3. DATOS LOCALES PRIMERO: costRows desde base de datos filtradas por proyecto y período
  let costRows: any[] = [];
  let ingRows: any[] = [];
  
  try {
    // Intentar usar datos locales primero (según checklist punto 1)
    const directCosts = await storage.getDirectCostsByProject(projectId);
    const sales = await storage.getGoogleSheetsSales();
    
    if (directCosts && directCosts.length > 0) {
      // Filtrar costos por período usando isDateInRange
      costRows = directCosts.filter((cost: any) => {
        if (!cost.mes || !cost.año) return false;
        // Convertir "08 ago" + 2025 a fecha y verificar si está en rango
        const monthMatch = cost.mes.match(/(\d{2})\s+(\w+)/);
        if (!monthMatch) return false;
        
        const monthNum = getMonthNumber(monthMatch[2]);
        const dateStr = `${cost.año}-${monthNum.padStart(2, '0')}-01`;
        const costDate = new Date(dateStr);
        
        return isDateInRange(costDate, rng);
      });
      console.log(`💰 BD Local - Proyecto ${projectId}: ${costRows.length} costos filtrados de ${directCosts.length} totales`);
    }
    
    if (sales && sales.length > 0) {
      // Filtrar ingresos por proyecto y período
      ingRows = sales.filter((sale: any) => {
        if (sale.projectId !== projectId) return false;
        if (!sale.year || !sale.month) return false;
        
        const monthNum = getMonthNumber(sale.month);
        const dateStr = `${sale.year}-${monthNum.padStart(2, '0')}-01`;
        const saleDate = new Date(dateStr);
        
        return isDateInRange(saleDate, rng);
      });
      console.log(`💰 BD Local - Proyecto ${projectId}: ${ingRows.length} ingresos filtrados de ${sales.filter((s: any) => s.projectId === projectId).length} del proyecto`);
    }
  } catch (localError) {
    console.log(`⚠️ Error accessing local DB, falling back to Google Sheets:`, localError instanceof Error ? localError.message : String(localError));
  }
  
  // 4. ENHANCED FALLBACK: Only try Google Sheets if we have NO local data at all
  let hadLocalData = costRows.length > 0 || ingRows.length > 0;
  
  if (costRows.length === 0 || ingRows.length === 0) {
    try {
      const allCostRows = await readRows(cfg.sheetId, cfg.tabs.costos);
      const allIngRows = await readRows(cfg.sheetId, cfg.tabs.ingresos);
      
      // Only use Google Sheets data if local data was completely missing
      if (costRows.length === 0) {
        const sheetsCosts = filterRowsByProjectAndPeriod(allCostRows, projectId, rng);
        costRows = sheetsCosts;
        console.log(`📊 Google Sheets Costos - Proyecto ${projectId}: ${sheetsCosts.length} costos from sheets`);
      }
      if (ingRows.length === 0) {
        const sheetsIngresos = filterRowsByProjectAndPeriod(allIngRows, projectId, rng);
        ingRows = sheetsIngresos;
        console.log(`📊 Google Sheets Ingresos - Proyecto ${projectId}: ${sheetsIngresos.length} ingresos from sheets`);
      }
    } catch (sheetsError) {
      console.log(`❌ Google Sheets failed, using local data only:`, sheetsError instanceof Error ? sheetsError.message : String(sheetsError));
      // CRITICAL: Don't overwrite existing local data when sheets fail!
      if (hadLocalData) {
        console.log(`✅ Preserving local data - Proyecto ${projectId}: ${costRows.length} costos, ${ingRows.length} ingresos from database`);
      }
    }
  }
  
  console.log(`💰 Motor único - Proyecto ${projectId}: ${costRows.length} costos, ${ingRows.length} ingresos`);
  
  // 5. Para cada fila de costos: rateUSD, acumular por persona K, L, M, budgetUSD, actualUSD
  const personGroups = groupByPerson(costRows, rng, basis);
  
  // 6. Totales: sumK, sumL, efficiency = sumL? (sumL/sumK*100) : 70; teamCost = Σ actualUSD
  const sumK = Object.values(personGroups).reduce((sum, p) => sum + p.targetHours, 0);
  const sumL = Object.values(personGroups).reduce((sum, p) => sum + p.actualHours, 0);
  const efficiency = sumK > 0 ? (sumL / sumK * 100) : 70;
  const teamCost = Object.values(personGroups).reduce((sum, p) => sum + p.actualCost, 0);
  
  // 7. Ingresos: revenueUSD = Σ (Monto_USD || Monto_ARS/FX)
  const revenueUSD = calculateRevenue(ingRows, rng);
  
  // 8. markupUSD = revenueUSD - teamCost
  const markupUSD = revenueUSD - teamCost;
  
  // 🎯 ESTADOS VACÍOS - Detectar datos faltantes
  const EPS = 1e-6;
  
  const emptyStates = {
    costos: teamCost <= EPS,           // no hay filas válidas de "Costos directos e indirectos"
    ingresos: revenueUSD <= EPS,       // no hay filas válidas de "Ventas Tomi"
    horas: sumL <= EPS,                // ΣL (horas trabajadas)
    objetivos: sumK <= EPS             // ΣK (evita mostrar eficiencia 70 si no hay plan)
  };

  const hasData = {
    costos: !emptyStates.costos,
    ingresos: !emptyStates.ingresos
  };
  
  // 9. Construir teamBreakdown (con severidad y desviaciones) y devolver
  const teamBreakdown = Object.values(personGroups).map(person => ({
    ...person,
    deviationHours: person.actualHours - person.targetHours,
    deviationCost: person.actualCost - person.budgetCost,
    severity: calculateSeverity(person.actualHours, person.targetHours)
  }));
  
  console.log(`🎯 ESTADOS VACÍOS - Proyecto ${projectId}: costos=${emptyStates.costos}, ingresos=${emptyStates.ingresos}, horas=${emptyStates.horas}, objetivos=${emptyStates.objetivos}`);
  
  return {
    summary: {
      period: timeFilter,
      basis,
      activeMembers: teamBreakdown.length,
      totalHours: sumL,
      efficiencyPct: Math.round(efficiency * 100) / 100,
      teamCostUSD: Math.round(teamCost * 100) / 100,
      revenueUSD: Math.round(revenueUSD * 100) / 100,
      markupUSD: Math.round(markupUSD * 100) / 100,
      emptyStates,
      hasData
    },
    teamBreakdown,
    ingresos: { "ingresos": ingRows.length > 0 },
    costos: { "costos": costRows.length > 0 }
  };
}

/**
 * Filtra filas por proyecto y período
 */
function filterRowsByProjectAndPeriod(rows: any[], projectId: number, timeRange: TimeFilter): any[] {
  return rows.filter(row => {
    // Filter by project
    const rowProjectId = parseDec(row.proyecto_id || row.projectId || row.ID_Proyecto || 0);
    if (rowProjectId !== projectId) return false;
    
    // Filter by time period
    const date = parseRowDate(row);
    return date && isDateInRange(date, timeRange);
  });
}

/**
 * Parsea fecha de fila (maneja diferentes formatos de mes/año)
 */
function parseRowDate(row: any): Date | null {
  const año = parseDec(row.año || row.year || 0);
  if (año < 2020 || año > 2030) return null;
  
  let mes = 1;
  
  if (row.mes) {
    if (typeof row.mes === 'number') {
      mes = row.mes;
    } else if (typeof row.mes === 'string') {
      if (row.mes.includes(' ')) {
        mes = parseDec(row.mes.substring(0, 2));
      } else {
        const monthMap: { [key: string]: number } = {
          'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
          'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
        };
        mes = monthMap[row.mes.toLowerCase()] || 1;
      }
    }
  }
  
  return new Date(año, mes - 1, 15); // Mid-month for comparison
}

/**
 * groupByPerson(rows) → agrega K, L, M, budget, actual según basis
 */
function groupByPerson(rows: any[], timeRange: TimeFilter, basis: 'ECON' | 'EXEC'): { [key: string]: PersonMetrics } {
  const groups: { [key: string]: PersonMetrics } = {};
  
  rows.forEach(row => {
    const personName = String(row.persona || row.detalle || row.name || 'Unknown');
    
    if (!groups[personName]) {
      groups[personName] = {
        personnelId: null,
        name: personName,
        role: 'From Excel MAESTRO',
        actualHours: 0,
        actualCost: 0,
        targetHours: 0,
        budgetCost: 0,
        efficiency: 0,
        deviationHours: 0,
        deviationCost: 0,
        severity: 'normal'
      };
    }
    
    const person = groups[personName];
    
    // Acumular K, L, M
    const K = parseDec(row.K || row.hrs_obj || 0);
    const L = parseDec(row.L || row.hrs_reales || 0);
    const M = parseDec(row.M || row.hrs_facturacion || 0);
    
    person.targetHours += K;
    person.actualHours += L;
    
    // rateUSD = Valor_Hora_ARS / fxForRow(rng, row)
    const rate = rateUSD(timeRange, row);
    
    // budgetUSD += K_row * rateUSD
    person.budgetCost += K * rate;
    
    // actualUSD += (basis==='ECON' ? M_row : L_row) * rateUSD OR montoTotalUSD if present
    const hoursForCost = basis === 'ECON' ? M : L;
    const directCost = parseDec(row.montoTotalUSD || 0);
    
    if (directCost > 0 && basis === 'ECON') {
      // Usar el monto directo del Excel MAESTRO (suma row-by-row)
      person.actualCost += directCost;
    } else {
      // Calcular basado en horas × rate (suma row-by-row)
      person.actualCost += hoursForCost * rate;
    }
  });
  
  // Calcular eficiencia por persona
  Object.values(groups).forEach(person => {
    person.efficiency = person.targetHours > 0 ? (person.actualHours / person.targetHours * 100) : 0;
  });
  
  return groups;
}

/**
 * Calcula revenue desde filas de ingresos
 */
function calculateRevenue(ingRows: any[], timeRange: TimeFilter): number {
  return ingRows.reduce((sum, row) => {
    // Solo incluir confirmado
    if (!row.confirmado && row.confirmado !== true && row.confirmado !== 'true') {
      return sum;
    }
    
    const montoUSD = parseDec(row.montoUSD || 0);
    const montoARS = parseDec(row.montoARS || 0);
    const fx = fxForRow(timeRange, row);
    
    // Priorizar USD, convertir ARS si es necesario
    return sum + (montoUSD > 0 ? montoUSD : montoARS / fx);
  }, 0);
}

/**
 * Calcula severidad basada en desviación de horas
 */
function calculateSeverity(actualHours: number, targetHours: number): 'normal' | 'warning' | 'critical' {
  if (targetHours === 0) return 'normal';
  
  const deviation = Math.abs(actualHours - targetHours);
  const deviationPct = (deviation / targetHours) * 100;
  
  if (deviationPct > 25) return 'critical';
  if (deviationPct > 10) return 'warning';
  return 'normal';
}