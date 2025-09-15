// ==================== DATE RANGE UTILITIES ====================
// Extracted from routes.ts to eliminate circular dependencies

/**
 * Convierte un filtro temporal en string a un rango de fechas
 * Soporta múltiples formatos: trimestres, meses, rangos personalizados, etc.
 */
export function getDateRangeForFilter(timeFilter: string): { startDate: Date; endDate: Date } | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Trimestres Q1, Q2, Q3, Q4 (cualquier año)
  if (timeFilter.match(/^q[1-4]_\d{4}$/i)) {
    const [quarter, yearStr] = timeFilter.toLowerCase().split('_');
    const year = parseInt(yearStr);
    const quarterNum = parseInt(quarter.replace('q', ''));
    
    const quarterStartMonth = (quarterNum - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;
    
    return {
      startDate: new Date(year, quarterStartMonth, 1),
      endDate: new Date(year, quarterEndMonth + 1, 0, 23, 59, 59)
    };
  }
  
  // Trimestres del año actual (Q1, Q2, Q3, Q4)
  if (timeFilter.match(/^Q[1-4]$/)) {
    const quarter = parseInt(timeFilter.replace('Q', ''));
    const quarterStartMonth = (quarter - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;
    
    return {
      startDate: new Date(currentYear, quarterStartMonth, 1),
      endDate: new Date(currentYear, quarterEndMonth + 1, 0, 23, 59, 59)
    };
  }
  
  // Rangos personalizados: "YYYY-MM-DD_to_YYYY-MM-DD"
  if (timeFilter.includes('_to_')) {
    const [startStr, endStr] = timeFilter.split('_to_');
    const startDate = new Date(startStr);
    const endDate = new Date(endStr + 'T23:59:59');
    
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      return { startDate, endDate };
    }
  }
  
  // Meses específicos con año: "mayo_2025", "june_2025", "january_2024"
  const monthYearMatch = timeFilter.match(/^([a-z]+)_(\d{4})$/i);
  if (monthYearMatch) {
    const [, monthName, yearStr] = monthYearMatch;
    const year = parseInt(yearStr);
    const monthNum = getMonthNumber(monthName);
    
    if (monthNum !== -1) {
      return {
        startDate: new Date(year, monthNum - 1, 1),
        endDate: new Date(year, monthNum, 0, 23, 59, 59)
      };
    }
  }
  
  // Bimestres: "bimestre_1_2025" hasta "bimestre_6_2025"
  const bimestreMatch = timeFilter.match(/^bimestre_([1-6])_(\d{4})$/i);
  if (bimestreMatch) {
    const [, bimestreNum, yearStr] = bimestreMatch;
    const year = parseInt(yearStr);
    const bimestre = parseInt(bimestreNum);
    
    const startMonth = (bimestre - 1) * 2;
    const endMonth = startMonth + 1;
    
    return {
      startDate: new Date(year, startMonth, 1),
      endDate: new Date(year, endMonth + 1, 0, 23, 59, 59)
    };
  }
  
  // Semestres: "semestre_1_2025", "semestre_2_2025"
  const semestreMatch = timeFilter.match(/^semestre_([12])_(\d{4})$/i);
  if (semestreMatch) {
    const [, semestreNum, yearStr] = semestreMatch;
    const year = parseInt(yearStr);
    const semestre = parseInt(semestreNum);
    
    const startMonth = semestre === 1 ? 0 : 6; // Enero o Julio
    const endMonth = semestre === 1 ? 5 : 11;  // Junio o Diciembre
    
    return {
      startDate: new Date(year, startMonth, 1),
      endDate: new Date(year, endMonth + 1, 0, 23, 59, 59)
    };
  }
  
  // Años completos: "año_2024", "year_2025"
  const yearMatch = timeFilter.match(/^(año|year)_(\d{4})$/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[2]);
    return {
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31, 23, 59, 59)
    };
  }
  
  // Períodos relativos
  if (timeFilter === 'ultimos_3_meses' || timeFilter === 'last_3_months') {
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(currentMonth - 3);
    return { startDate: threeMonthsAgo, endDate: now };
  }
  
  if (timeFilter === 'ultimos_6_meses' || timeFilter === 'last_6_months') {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(currentMonth - 6);
    return { startDate: sixMonthsAgo, endDate: now };
  }
  
  if (timeFilter === 'ultimos_30_dias' || timeFilter === 'last_30_days') {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return { startDate: thirtyDaysAgo, endDate: now };
  }
  
  if (timeFilter === 'ultimos_90_dias' || timeFilter === 'last_90_days') {
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);
    return { startDate: ninetyDaysAgo, endDate: now };
  }
  
  // Casos específicos adicionales como "august_2025"
  if (timeFilter === 'august_2025') {
    return {
      startDate: new Date(2025, 7, 1), // Agosto es mes 7 (0-based)
      endDate: new Date(2025, 7, 31, 23, 59, 59)
    };
  }
  
  // Períodos especiales
  if (timeFilter === 'huggies_period') {
    return {
      startDate: new Date(2025, 7, 1), // Agosto 2025
      endDate: new Date(2025, 7, 31, 23, 59, 59)
    };
  }
  
  // Este mes (mes actual)
  if (timeFilter === 'este_mes' || timeFilter === 'this_month') {
    return {
      startDate: new Date(2025, 8, 1), // Septiembre 2025 (mes 8 en 0-based)
      endDate: new Date(2025, 8, 30, 23, 59, 59) // 30 de septiembre
    };
  }
  
  return null;
}

/**
 * Convierte nombres de mes en español/inglés a números
 */
function getMonthNumber(monthName: string): number {
  const monthMap: { [key: string]: number } = {
    'enero': 1, 'january': 1, 'jan': 1, 'ene': 1,
    'febrero': 2, 'february': 2, 'feb': 2,
    'marzo': 3, 'march': 3, 'mar': 3,
    'abril': 4, 'april': 4, 'apr': 4, 'abr': 4,
    'mayo': 5, 'may': 5,
    'junio': 6, 'june': 6, 'jun': 6,
    'julio': 7, 'july': 7, 'jul': 7,
    'agosto': 8, 'august': 8, 'aug': 8, 'ago': 8,
    'septiembre': 9, 'september': 9, 'sep': 9,
    'octubre': 10, 'october': 10, 'oct': 10,
    'noviembre': 11, 'november': 11, 'nov': 11,
    'diciembre': 12, 'december': 12, 'dec': 12, 'dic': 12
  };
  
  return monthMap[monthName.toLowerCase()] || -1;
}