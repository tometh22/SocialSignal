/**
 * 🚀 PARSERS SEGUROS PARA "VENTAS TOMI"
 * Maneja números ES, fechas y validaciones
 */

export const parseNumberEs = (v: unknown): number => {
  if (v == null) return 0;
  // "4.359.857" -> "4359857", "1.750" -> "1750", "29,230.00" (por si acaso) -> "29230.00"
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// Mapeo de meses en español a números
const MES = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'setiembre': 9, 'octubre': 10, 
  'noviembre': 11, 'diciembre': 12
} as const;

/**
 * Convierte mes en español a número
 */
export const spanishMonthToNumber = (mesEs: string): number => {
  const k = mesEs.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const n = (MES as any)[k];
  if (!n) throw new Error(`Mes inválido: "${mesEs}"`);
  return n;
};

/**
 * Genera PeriodKey desde mes ES + año
 */
export const periodKeyOf = (mesEs: string, year: number): `${number}-${string}` => {
  const m = spanishMonthToNumber(mesEs);
  return `${year}-${String(m).padStart(2, '0')}`;
};

/**
 * Valida si una respuesta es "Sí"
 */
export const isYes = (v: any): boolean => 
  String(v ?? '').trim().toLowerCase().replace('í', 'i') === 'si';

// Re-export del tipo para conveniencia
export type { PeriodKey } from './types';