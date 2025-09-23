/**
 * 🗓️ Parser robusto de fechas ES → YYYY-MM
 * Maneja meses en español + fallback numérico para ETL idempotente
 */

// Tabla de meses en español (normalizada)
const MONTH_MAP_ES: { [key: string]: number } = {
  // Nombres completos
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
  
  // Abreviaciones comunes
  'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
  
  // Variaciones con tildes
  'septbre': 9, 'setiembre': 9, 'sept': 9,
  
  // Casos edge encontrados en data real
  'ener': 1, 'febr': 2, 'marz': 3, 'abri': 4, 'juni': 6, 'juli': 7, 'agos': 8, 'octu': 10, 'novi': 11, 'dici': 12
};

/**
 * Normalize string for month lookup (lowercase, no tildes, no spaces)
 */
function normalizeMonthString(month: string): string {
  return month
    .toLowerCase()
    .normalize('NFD') // Separate base chars from diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks (tildes, etc)
    .trim();
}

/**
 * Parse month from Spanish name or number
 * @param monthInput - Month as string or number
 * @returns Month number (1-12) or null if invalid
 */
export function parseMonth(monthInput: unknown): number | null {
  if (typeof monthInput === 'number') {
    return monthInput >= 1 && monthInput <= 12 ? monthInput : null;
  }
  
  if (typeof monthInput === 'string') {
    // Try numeric parse first
    const numericMonth = parseInt(monthInput.trim());
    if (!isNaN(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
      return numericMonth;
    }
    
    // Try Spanish month name lookup
    const normalizedMonth = normalizeMonthString(monthInput);
    return MONTH_MAP_ES[normalizedMonth] || null;
  }
  
  return null;
}

/**
 * Parse year from various formats
 * @param yearInput - Year as string or number
 * @returns 4-digit year or null if invalid
 */
export function parseYear(yearInput: unknown): number | null {
  if (typeof yearInput === 'number') {
    // Handle 2-digit years (assume 20xx)
    if (yearInput >= 0 && yearInput <= 99) {
      return 2000 + yearInput;
    }
    // Handle 4-digit years
    if (yearInput >= 1900 && yearInput <= 2100) {
      return yearInput;
    }
    return null;
  }
  
  if (typeof yearInput === 'string') {
    const numericYear = parseInt(yearInput.trim());
    if (isNaN(numericYear)) return null;
    
    // Handle 2-digit years
    if (numericYear >= 0 && numericYear <= 99) {
      return 2000 + numericYear;
    }
    // Handle 4-digit years
    if (numericYear >= 1900 && numericYear <= 2100) {
      return numericYear;
    }
  }
  
  return null;
}

/**
 * 🎯 CORE FUNCTION: Parse month/year to YYYY-MM format
 * Handles all variations found in Excel MAESTRO
 * @param monthInput - Month (Spanish name, abbreviation, or number)
 * @param yearInput - Year (2-digit or 4-digit)
 * @returns monthKey in YYYY-MM format or null if invalid
 */
export function parseMonthKey(monthInput: unknown, yearInput: unknown): string | null {
  const month = parseMonth(monthInput);
  const year = parseYear(yearInput);
  
  if (month === null || year === null) {
    console.warn(`🗓️ Failed to parse monthKey: month=${monthInput}, year=${yearInput}`);
    return null;
  }
  
  // Format as YYYY-MM with zero-padding
  const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
  return monthKey;
}

/**
 * Generate source row ID for idempotent ETL
 * @param source - Source identifier ('ventas', 'costos', 'targets')
 * @param rowData - Raw row data from sheet
 * @param rowIndex - Row index in sheet
 * @returns Unique source row ID
 */
export function generateSourceRowId(source: string, rowData: any[], rowIndex: number): string {
  // Create hash of key fields + row position for uniqueness
  const dataHash = JSON.stringify(rowData).substring(0, 100); // First 100 chars as signature
  return `${source}_${rowIndex}_${Buffer.from(dataHash).toString('base64').substring(0, 16)}`;
}

/**
 * Normalize project key for consistent lookup
 * @param clientName - Client name from sheet
 * @param projectName - Project name from sheet  
 * @returns Normalized project key
 */
export function normalizeProjectKey(clientName?: string, projectName?: string): string {
  const client = (clientName || '').toString().toLowerCase().trim();
  const project = (projectName || '').toString().toLowerCase().trim();
  
  // Remove special characters and normalize spaces
  const cleanClient = client.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const cleanProject = project.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  if (cleanClient && cleanProject) {
    return `${cleanClient}|${cleanProject}`;
  } else if (cleanProject) {
    return cleanProject;
  } else if (cleanClient) {
    return cleanClient;
  } else {
    return 'unknown';
  }
}

/**
 * Test function for date parser
 */
export function testDateParser() {
  console.log('🧪 Testing date parser...');
  
  const testCases = [
    ['agosto', 2025, '2025-08'],
    ['Agosto', '25', '2025-08'],  
    ['AGO', 2025, '2025-08'],
    [8, 2025, '2025-08'],
    ['8', '2025', '2025-08'],
    ['septiembre', 24, '2024-09'],
    ['invalid', 2025, null],
    ['agosto', 'invalid', null]
  ];
  
  testCases.forEach(([month, year, expected]) => {
    const result = parseMonthKey(month, year);
    const status = result === expected ? '✅' : '❌';
    console.log(`${status} parseMonthKey(${month}, ${year}) = ${result} (expected: ${expected})`);
  });
}