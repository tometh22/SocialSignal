/**
 * Formatea un número a una representación de moneda en dólares
 * @param amount La cantidad a formatear
 * @param shortVersion Si es true, muestra una versión abreviada para espacios pequeños
 * @returns La cadena formateada con formato de moneda
 */
export const formatCurrency = (amount: number, shortVersion: boolean = false): string => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  if (shortVersion) {
    // Versión corta para espacios pequeños (ej: $1.2k en lugar de $1,234.56)
    if (Math.abs(amount) >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (Math.abs(amount) >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    } else {
      return formatted;
    }
  }
  
  return formatted;
};

/**
 * Formatea un número a una representación de porcentaje
 * @param value El valor a formatear
 * @param digits Número de dígitos decimales a mostrar
 * @returns La cadena formateada con formato de porcentaje
 */
export const formatPercentage = (value: number, digits: number = 1): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value / 100);
};

/**
 * Formatea una fecha a una representación legible
 * @param date La fecha a formatear (string o Date)
 * @param format El formato a utilizar (por defecto dd/MM/yyyy)
 * @returns La cadena formateada con el formato especificado
 */
export const formatDate = (date: string | Date | null, format: string = 'dd/MM/yyyy'): string => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Simple implementation of format (can be replaced with date-fns or similar)
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return format
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', String(year));
};

/**
 * Formatea un número
 * @param value El valor a formatear
 * @param digits Número de dígitos decimales a mostrar
 * @returns La cadena formateada con el número de dígitos especificado
 */
export const formatNumber = (value: number, digits: number = 2): string => {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
};