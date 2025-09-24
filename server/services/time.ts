// services/time.ts - Utilidades temporales DRY

export interface TimeFilter {
  kind: 'month' | 'quarter' | 'custom';
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Resuelve filtros temporales: july_2025, q3_2025, 2025-07-01_to_2025-07-31
 * Un solo lugar para TODA la lógica temporal
 */
export function resolveTimeFilter(timeFilter: string): TimeFilter {
  if (timeFilter.includes('_to_')) {
    // Custom range: 2025-07-01_to_2025-07-31
    const [start, end] = timeFilter.split('_to_');
    return { kind: 'custom', start, end };
  }
  
  if (timeFilter.includes('_')) {
    const [period, year] = timeFilter.split('_');
    const y = parseInt(year);
    
    // Quarters: q1_2025, q2_2025, q3_2025, q4_2025
    if (period.startsWith('q')) {
      const q = parseInt(period.slice(1));
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const endDay = new Date(y, endMonth, 0).getDate();
      
      return {
        kind: 'quarter',
        start: `${y}-${String(startMonth).padStart(2, '0')}-01`,
        end: `${y}-${String(endMonth).padStart(2, '0')}-${endDay}`
      };
    }
    
    // Months: january_2025, february_2025, july_2025, august_2025, etc.
    // Soporte para español e inglés según especificaciones del usuario
    const monthMap: Record<string, number> = {
      // Inglés
      'january': 1, 'february': 2, 'march': 3, 'april': 4,
      'may': 5, 'june': 6, 'july': 7, 'august': 8,
      'september': 9, 'october': 10, 'november': 11, 'december': 12,
      // Español 
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
      'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
      'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
      // Abreviaciones españolas
      'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4,
      'jun': 6, 'jul': 7, 'ago': 8,
      'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
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
  
  // Relative filters: mes_pasado, last_month, este_mes, current_month, etc.
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  
  if (timeFilter === 'mes_pasado' || timeFilter === 'last_month') {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const endDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    return {
      kind: 'month',
      start: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`,
      end: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${endDay}`
    };
  }
  
  if (timeFilter === 'este_mes' || timeFilter === 'current_month') {
    const endDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    return {
      kind: 'month',
      start: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
      end: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${endDay}`
    };
  }
  
  // Fallback to current month
  const y = currentYear;
  const m = currentMonth + 1;
  const endDay = new Date(y, m, 0).getDate();
  
  return {
    kind: 'month',
    start: `${y}-${String(m).padStart(2, '0')}-01`, 
    end: `${y}-${String(m).padStart(2, '0')}-${endDay}`
  };
}

/**
 * Verifica si una fecha está dentro del rango del filtro temporal
 */
export function isDateInRange(date: Date, timeRange: TimeFilter): boolean {
  const filterStart = new Date(timeRange.start);
  const filterEnd = new Date(timeRange.end);
  return date >= filterStart && date <= filterEnd;
}

/**
 * Verifica si una fila de sales está dentro del rango temporal 
 * usando los campos correctos: confirmed, month, year, monthNumber
 */
export function isRowInTimeRange(sale: any, timeRange: TimeFilter): boolean {
  // Verificar confirmación usando el campo correcto
  const confirmed = sale.confirmed === 'SI';
  if (!confirmed) {
    return false;
  }
  
  // Obtener año y mes usando los campos correctos 
  const year = sale.year || 0;
  const monthNumber = sale.monthNumber || 0;
  
  if (!year || !monthNumber) {
    return false;
  }
  
  // Crear fecha del primer día del mes
  const saleDate = new Date(year, monthNumber - 1, 1);
  
  return isDateInRange(saleDate, timeRange);
}