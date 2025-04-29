import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
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
