/**
 * Formatea un número a una representación de moneda en euros
 * @param amount La cantidad a formatear
 * @returns La cadena formateada con formato de moneda
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
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