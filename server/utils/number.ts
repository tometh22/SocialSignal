/**
 * 🔢 ROBUST NUMBER PARSING UTILITIES
 * 
 * Handles locale-specific number formats:
 * - Argentine format: "1.234,56" (point as thousands separator, comma as decimal)
 * - US format: "1,234.56" (comma as thousands separator, point as decimal)
 * - Mixed formats from Google Sheets API
 */

/**
 * Parse any numeric value with locale-agnostic handling
 * Handles both Argentine (1.234,56) and US (1,234.56) formats
 * 
 * @param value - Raw value from Excel/Google Sheets
 * @returns Parsed number or null if invalid
 * 
 * @example
 * parseNumberRobust("1.234,56")  // → 1234.56 (Argentine)
 * parseNumberRobust("1,234.56")  // → 1234.56 (US)
 * parseNumberRobust("12167")     // → 12167 (no formatting)
 * parseNumberRobust("121,67")    // → 121.67 (Argentine decimal)
 */
export function parseNumberRobust(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // If already a number, return it
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  // Convert to string and clean
  const str = String(value).trim();
  
  // Remove all non-numeric characters except . , and -
  const cleaned = str.replace(/[^\d.,-]/g, '');
  
  // Detect format based on position of last comma/point
  const lastComma = cleaned.lastIndexOf(',');
  const lastPoint = cleaned.lastIndexOf('.');
  
  let normalized: string;
  
  if (lastComma === -1 && lastPoint === -1) {
    // No separators - just digits
    normalized = cleaned;
  } else if (lastComma > lastPoint) {
    // Argentine format: "1.234,56" → comma is decimal separator
    normalized = cleaned
      .replace(/\./g, '')   // Remove thousands separators (points)
      .replace(/,/g, '.');  // Convert decimal separator (comma) to point
  } else {
    // US format: "1,234.56" → point is decimal separator
    normalized = cleaned
      .replace(/,/g, '');   // Remove thousands separators (commas)
    // Point is already decimal separator
  }
  
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Alias for parseNumberRobust - specifically for monetary values
 * Exists for semantic clarity in code
 */
export function parseMoneyRobust(value: string | number | undefined | null): number | null {
  return parseNumberRobust(value);
}

/**
 * Alias for parseNumberRobust - specifically for hour values
 * Exists for semantic clarity in code
 */
export function parseHoursRobust(value: string | number | undefined | null): number | null {
  return parseNumberRobust(value);
}

/**
 * Parse integer values robustly
 */
export function parseIntRobust(value: string | number | undefined | null): number | null {
  const num = parseNumberRobust(value);
  return num !== null ? Math.round(num) : null;
}

/**
 * Safe number extraction with default fallback
 */
export function safeNum(value: any, fallback: number = 0): number {
  const parsed = parseNumberRobust(value);
  return parsed !== null ? parsed : fallback;
}
