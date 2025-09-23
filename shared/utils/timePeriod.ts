/**
 * 🎯 UNIFIED TEMPORAL RESOLUTION ARCHITECTURE
 * Single source of truth for all time period filtering across the system
 */

// Type definitions
export type TimeFilter = 
  | 'this_month' 
  | 'last_month'
  | string  // For patterns like "august_2025", "q3_2025", "2025-08"
  | { start: string; end: string };

export interface ResolvedPeriod {
  start: string;     // ISO date: "2025-08-01"
  end: string;       // ISO date: "2025-08-31"
  label: string;     // Human readable: "August 2025"
  monthKeys: string[]; // Month keys: ["2025-08"]
}

export class InvalidTimeFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTimeFilterError';
  }
}

// Localized month mappings
const MONTH_MAP: Record<string, number> = {
  // English
  'january': 1, 'february': 2, 'march': 3, 'april': 4,
  'may': 5, 'june': 6, 'july': 7, 'august': 8,
  'september': 9, 'october': 10, 'november': 11, 'december': 12,
  // Spanish  
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
  'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
  'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

const MONTH_LABELS: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August', 
  9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

const MONTH_LABELS_ES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

// Helper functions
function isRelativeToken(filter: string): boolean {
  return ['this_month', 'last_month'].includes(filter);
}

function isQuarterToken(filter: string): boolean {
  return /^q[1-4]_\d{4}$/i.test(filter);
}

function isMonthYearToken(filter: string): boolean {
  return /^\d{4}-\d{2}$/.test(filter) || /^[a-z]+_\d{4}$/i.test(filter);
}

function generateMonthKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    keys.push(`${year}-${month}`);
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }
  
  return [...new Set(keys)]; // Deduplicate
}

function getMonthBoundaries(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Last day of month
  return { start, end };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 🎯 UNIFIED PERIOD RESOLVER
 * Single function to resolve all temporal filters consistently
 */
export function resolvePeriod(timeFilter: TimeFilter): ResolvedPeriod {
  const now = new Date();
  
  // Handle custom range objects
  if (typeof timeFilter === 'object' && timeFilter.start && timeFilter.end) {
    const start = new Date(timeFilter.start);
    const end = new Date(timeFilter.end);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new InvalidTimeFilterError(`Invalid date format in custom range: ${JSON.stringify(timeFilter)}`);
    }
    
    if (start > end) {
      throw new InvalidTimeFilterError(`Start date must be before end date: ${timeFilter.start} > ${timeFilter.end}`);
    }
    
    return {
      start: formatDate(start),
      end: formatDate(end),
      label: `${formatDate(start)} to ${formatDate(end)}`,
      monthKeys: generateMonthKeys(start, end)
    };
  }
  
  if (typeof timeFilter !== 'string') {
    throw new InvalidTimeFilterError(`Invalid timeFilter type: ${typeof timeFilter}`);
  }
  
  // Handle relative tokens
  if (isRelativeToken(timeFilter)) {
    let targetDate = new Date(now);
    
    if (timeFilter === 'last_month') {
      targetDate.setMonth(targetDate.getMonth() - 1);
    }
    // this_month uses current date as-is
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const { start, end } = getMonthBoundaries(year, month);
    
    return {
      start: formatDate(start),
      end: formatDate(end),
      label: timeFilter === 'this_month' ? 'This Month' : 'Last Month',
      monthKeys: [formatDate(start).substring(0, 7)] // "2025-08"
    };
  }
  
  // Handle quarter tokens (q3_2025)
  if (isQuarterToken(timeFilter)) {
    const match = timeFilter.match(/^q([1-4])_(\d{4})$/i);
    if (!match) {
      throw new InvalidTimeFilterError(`Invalid quarter format: ${timeFilter}`);
    }
    
    const quarter = parseInt(match[1]);
    const year = parseInt(match[2]);
    
    const quarterMonths = {
      1: [1, 2, 3],   // Q1: Jan-Mar
      2: [4, 5, 6],   // Q2: Apr-Jun
      3: [7, 8, 9],   // Q3: Jul-Sep
      4: [10, 11, 12] // Q4: Oct-Dec
    };
    
    const months = quarterMonths[quarter as keyof typeof quarterMonths];
    const start = new Date(year, months[0] - 1, 1);
    const end = new Date(year, months[2], 0); // Last day of quarter's last month
    
    return {
      start: formatDate(start),
      end: formatDate(end),
      label: `Q${quarter} ${year}`,
      monthKeys: months.map(m => `${year}-${String(m).padStart(2, '0')}`)
    };
  }
  
  // Handle YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(timeFilter)) {
    const [yearStr, monthStr] = timeFilter.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    
    if (month < 1 || month > 12) {
      throw new InvalidTimeFilterError(`Invalid month: ${month}`);
    }
    
    const { start, end } = getMonthBoundaries(year, month);
    
    return {
      start: formatDate(start),
      end: formatDate(end),
      label: `${MONTH_LABELS[month]} ${year}`,
      monthKeys: [timeFilter]
    };
  }
  
  // Handle month_year format (august_2025, agosto_2025)
  if (/^[a-z]+_\d{4}$/i.test(timeFilter)) {
    const [monthName, yearStr] = timeFilter.toLowerCase().split('_');
    const year = parseInt(yearStr);
    const month = MONTH_MAP[monthName];
    
    if (!month) {
      throw new InvalidTimeFilterError(`Unknown month name: ${monthName}`);
    }
    
    const { start, end } = getMonthBoundaries(year, month);
    const label = monthName.includes('agosto') || monthName.includes('enero') ? 
      `${MONTH_LABELS_ES[month]} ${year}` : 
      `${MONTH_LABELS[month]} ${year}`;
    
    return {
      start: formatDate(start),
      end: formatDate(end),
      label,
      monthKeys: [`${year}-${String(month).padStart(2, '0')}`]
    };
  }
  
  throw new InvalidTimeFilterError(`Unsupported timeFilter format: ${timeFilter}`);
}

/**
 * 🔄 BACKWARD COMPATIBILITY SHIM
 * @deprecated Use resolvePeriod instead
 */
export function resolveTimeFilter(timeFilter: string): ResolvedPeriod {
  console.warn('resolveTimeFilter is deprecated, use resolvePeriod instead');
  return resolvePeriod(timeFilter);
}