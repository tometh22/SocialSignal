/**
 * Procesa un valor de entrada que puede contener comas como separador decimal
 * y lo convierte a un número. Si el valor no es válido, devuelve un valor predeterminado.
 * 
 * @param value Valor de entrada, puede ser un string con coma o punto como separador decimal
 * @param defaultValue Valor a devolver si la conversión falla
 * @returns Número procesado o valor predeterminado si es inválido
 */
export function parseDecimalInput(value: string, defaultValue: number = 0): number {
  // Si es una cadena vacía, devolver el valor predeterminado
  if (!value.trim()) {
    return defaultValue;
  }
  
  // Reemplazar comas por puntos para el procesamiento
  const normalizedValue = value.replace(/,/g, '.');
  
  // Intentar convertir a número
  const numericValue = parseFloat(normalizedValue);
  
  // Verificar si es un número válido, si no devolver el valor predeterminado
  return isNaN(numericValue) ? defaultValue : numericValue;
}

/**
 * Maneja el cambio en un campo de entrada numérico, aceptando valores con coma o punto decimal.
 * 
 * @param value Valor del input
 * @param callback Función de callback para actualizar el estado
 * @param defaultValue Valor por defecto si es inválido
 */
export function handleDecimalInputChange(
  value: string,
  callback: (value: number) => void,
  defaultValue: number = 0
): void {
  callback(parseDecimalInput(value, defaultValue));
}

/**
 * Formatea un número para mostrar en un input, usando coma como separador decimal.
 * 
 * @param value Valor numérico a formatear
 * @returns String formateado con coma como separador decimal
 */
export function formatNumberForInput(value: number): string {
  // Evitar problemas con NaN o undefined
  if (isNaN(value) || value === undefined) {
    return '';
  }
  
  // Convertir a string y reemplazar el punto por coma
  return value.toString().replace('.', ',');
}