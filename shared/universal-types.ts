// Universal types for standardized project data processing

export type TimeFilter = { 
  kind: 'month' | 'quarter' | 'custom', 
  start: string, 
  end: string 
};

export interface ProjectConfig {
  projectId: string;
  projectKey: string;        // slug canónico
  sheetId: string;          // spreadsheet
  tabs: { 
    ingresos: 'Ventas Tomi'; 
    costos: 'Costos directos e indirectos'; 
  };
  peopleMap: Record<string, string>; // alias → personId
}

export function resolveProject(projectId: string): ProjectConfig {
  // TODO: lookup en DB/config, por ahora hardcoded
  const configs: Record<string, ProjectConfig> = {
    '39': {
      projectId: '39',
      projectKey: 'huggies-fee',
      sheetId: '1BM8gJbgKtOv2dpEbj3t3Lh8hqYwqpX8s83cZOUgm1hE',
      tabs: {
        ingresos: 'Ventas Tomi',
        costos: 'Costos directos e indirectos'
      },
      peopleMap: {
        'Sol Ayala': 'sol-ayala',
        'Trini Petreigne': 'trini-petreigne', 
        'Vanu Lanza': 'vanu-lanza',
        'Aylu Tamer': 'aylu-tamer',
        'Vicky Achabal': 'vicky-achabal'
      }
    }
  };
  
  return configs[projectId] || {
    projectId,
    projectKey: `project-${projectId}`,
    sheetId: '1BM8gJbgKtOv2dpEbj3t3Lh8hqYwqpX8s83cZOUgm1hE', // default
    tabs: { ingresos: 'Ventas Tomi', costos: 'Costos directos e indirectos' },
    peopleMap: {}
  };
}

// Normalizadores reutilizables
export const parseDec = (v: any) => Number(String(v).replace(/\./g, '').replace(',', '.')) || 0;

export function monthKey(y: number, m: number): string { 
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function fxForRow(row: any): number {
  // prioriza Cotización de la fila; si falta, FX del período; si falta, fallback
  if (row.Cotización && parseDec(row.Cotización) > 0) {
    return parseDec(row.Cotización);
  }
  // TODO: obtener FX histórico del período
  return 1000; // fallback conservador
}

export function rateUSD(row: any): number { 
  return parseDec(row.Valor_Hora_ARS) / fxForRow(row);
}

// Cálculos estandarizados
export type Basis = 'EXEC' | 'ECON';

export interface PersonData {
  personId: string;
  personName: string;
  Kp: number; // Σ horas objetivo (K)
  Lp: number; // Σ horas reales (L) 
  Mp: number; // Σ horas facturación (M)
  budgetedCost: number; // Σ(K * rateUSD)
  actualCost: number; // basis==='ECON' ? Σ(M * rateUSD) : Σ(L * rateUSD)
  hourDeviationPct: number; // Kp===0 ? 0 : (Lp/Kp - 1)*100
  costDeviation: number; // actualCost - budgetedCost
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface PeriodSummary {
  sumK: number; // Σ personas.Kp
  sumL: number; // Σ personas.Lp
  sumM: number; // Σ personas.Mp
  efficiencyPct: number; // sumK===0 ? 0 : (sumL/sumK)*100
  teamCostUSD: number; // Σ personas.actualCost
  activeMembers: number;
  period: string;
  basis: Basis;
}

export function byThreshold(absDeviation: number): 'critical' | 'high' | 'medium' | 'low' {
  if (absDeviation >= 50) return 'critical';
  if (absDeviation >= 30) return 'high'; 
  if (absDeviation >= 15) return 'medium';
  return 'low';
}

// Filtro temporal
export function parseTimeFilter(filter: string): TimeFilter {
  // july_2025 → {kind: 'month', start: '2025-07-01', end: '2025-07-31'}
  // q3_2025 → {kind: 'quarter', start: '2025-07-01', end: '2025-09-30'}
  // august_2025 → {kind: 'month', start: '2025-08-01', end: '2025-08-31'}
  
  if (filter.includes('_')) {
    const [period, year] = filter.split('_');
    const y = parseInt(year);
    
    // Quarters
    if (period.startsWith('q')) {
      const q = parseInt(period.slice(1));
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return {
        kind: 'quarter',
        start: `${y}-${String(startMonth).padStart(2, '0')}-01`,
        end: `${y}-${String(endMonth).padStart(2, '0')}-${new Date(y, endMonth, 0).getDate()}`
      };
    }
    
    // Months (English + Spanish support)
    const monthMap: Record<string, number> = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4,
      'may': 5, 'june': 6, 'july': 7, 'august': 8,
      'september': 9, 'october': 10, 'november': 11, 'december': 12,
      // Spanish months
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
      'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
      'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    };
    
    if (monthMap[period]) {
      const month = monthMap[period];
      const endDay = new Date(y, month, 0).getDate();
      return {
        kind: 'month',
        start: `${y}-${String(month).padStart(2, '0')}-01`,
        end: `${y}-${String(month).padStart(2, '0')}-${endDay}`
      };
    }
  }
  
  // Relative temporal filters
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based (0=January, 8=September)
  
  switch (filter) {
    case 'este_mes': {
      const m = currentMonth + 1; // 1-based
      const endDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      return {
        kind: 'month',
        start: `${currentYear}-${String(m).padStart(2, '0')}-01`,
        end: `${currentYear}-${String(m).padStart(2, '0')}-${endDay}`
      };
    }
    
    case 'mes_pasado': {
      // Get previous month
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const m = prevMonth + 1; // 1-based
      const endDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      
      console.log(`🎯 SHARED parseTimeFilter DEBUG:`);
      console.log(`   Current: ${now.toISOString()} (month=${currentMonth})`);
      console.log(`   prevMonth=${prevMonth}, prevYear=${prevYear}, m=${m}`);
      console.log(`   Result: ${prevYear}-${String(m).padStart(2, '0')}-01 to ${prevYear}-${String(m).padStart(2, '0')}-${endDay}`);
      
      return {
        kind: 'month',
        start: `${prevYear}-${String(m).padStart(2, '0')}-01`,
        end: `${prevYear}-${String(m).padStart(2, '0')}-${endDay}`
      };
    }
    
    case 'este_trimestre': {
      const quarter = Math.floor(currentMonth / 3);
      const startMonth = quarter * 3 + 1;
      const endMonth = startMonth + 2;
      const endDay = new Date(currentYear, endMonth, 0).getDate();
      return {
        kind: 'quarter',
        start: `${currentYear}-${String(startMonth).padStart(2, '0')}-01`,
        end: `${currentYear}-${String(endMonth).padStart(2, '0')}-${endDay}`
      };
    }
    
    case 'trimestre_pasado': {
      const currentQuarter = Math.floor(currentMonth / 3);
      const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const prevYear = currentQuarter === 0 ? currentYear - 1 : currentYear;
      const startMonth = prevQuarter * 3 + 1;
      const endMonth = startMonth + 2;
      const endDay = new Date(prevYear, endMonth, 0).getDate();
      return {
        kind: 'quarter',
        start: `${prevYear}-${String(startMonth).padStart(2, '0')}-01`,
        end: `${prevYear}-${String(endMonth).padStart(2, '0')}-${endDay}`
      };
    }
  }
  
  // Fallback: current month
  const m = currentMonth + 1; // 1-based
  const endDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  return {
    kind: 'month',
    start: `${currentYear}-${String(m).padStart(2, '0')}-01`, 
    end: `${currentYear}-${String(m).padStart(2, '0')}-${endDay}`
  };
}