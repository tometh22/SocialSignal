// services/number.ts - Utilidades numéricas DRY

/**
 * Parsea decimales con formato ES/US, moneda y paréntesis
 * Ejemplos: "1.234,56", "(1,234.56)", "$1,234.56", "1234.56"
 * Un solo lugar para TODO el parsing numérico
 */
export function parseDec(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  let str = String(value).trim();
  
  // Handle parentheses (negative numbers)
  const isNegative = str.startsWith('(') && str.endsWith(')');
  if (isNegative) {
    str = str.slice(1, -1);
  }
  
  // Remove currency symbols and spaces
  str = str.replace(/[$€£¥\s]/g, '');
  
  // Handle Spanish format: "1.234,56" -> "1234.56"
  if (str.includes(',') && str.includes('.')) {
    // Mixed format - assume European (dot as thousands, comma as decimal)
    if (str.lastIndexOf('.') < str.lastIndexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // American format (comma as thousands, dot as decimal)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma - could be thousands or decimal
    const commaIndex = str.lastIndexOf(',');
    const afterComma = str.slice(commaIndex + 1);
    
    if (afterComma.length <= 2) {
      // Decimal comma: "1234,56"
      str = str.replace(',', '.');
    } else {
      // Thousands comma: "1,234"
      str = str.replace(/,/g, '');
    }
  }
  
  const parsed = parseFloat(str);
  return isNegative ? -parsed : (isNaN(parsed) ? 0 : parsed);
}

/**
 * Formatea número a USD con 2 decimales
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Formatea número a ARS con 2 decimales
 */
export function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}