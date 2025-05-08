import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda USD
 * @param value Valor a formatear
 * @returns Cadena formateada como moneda
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Convierte una cadena que tiene coma como separador decimal a un número
 * Acepta tanto el formato "15,6" como "15.6"
 * @param value Cadena a convertir
 * @returns Número convertido o NaN si no es válido
 */
export function parseDecimal(value: string): number {
  if (!value) return 0;
  
  // Reemplazar coma por punto para hacer el parsing correcto
  const normalizedValue = value.replace(',', '.');
  return parseFloat(normalizedValue);
}

/**
 * Valida y formatea un campo de entrada numérica para permitir formato con coma decimal
 * @param input Valor del input como string
 * @returns Valor formateado para el input
 */
export function formatNumericInput(input: string): string {
  // Permitir vacío
  if (!input) return '';
  
  // Eliminar cualquier caracter que no sea dígito, punto o coma
  let cleaned = input.replace(/[^\d.,]/g, '');
  
  // Asegurarse de que solo hay un separador decimal (sea punto o coma)
  let hasSeparator = false;
  let result = '';
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '.' || char === ',') {
      if (!hasSeparator) {
        // Usar siempre coma como separador visual
        result += ',';
        hasSeparator = true;
      }
      // Si ya había un separador, ignorar este
    } else {
      result += char;
    }
  }
  
  return result;
}

/**
 * Devuelve las clases de color y texto para un estado de proyecto
 * @param status El estado del proyecto
 * @returns Un objeto con las clases y el texto a mostrar
 */
export function getStatusColor(status: string): { color: string; bgColor: string; text: string } {
  status = status.toLowerCase();
  
  switch (status) {
    case 'active':
    case 'activo':
      return {
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        text: 'Activo'
      };
    case 'completed':
    case 'completado':
      return {
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        text: 'Completado'
      };
    case 'paused':
    case 'pausado':
      return {
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        text: 'Pausado'
      };
    case 'cancelled':
    case 'cancelado':
      return {
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        text: 'Cancelado'
      };
    case 'pending':
    case 'pendiente':
      return {
        color: 'text-purple-700',
        bgColor: 'bg-purple-50',
        text: 'Pendiente'
      };
    default:
      return {
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        text: status.charAt(0).toUpperCase() + status.slice(1)
      };
  }
}
