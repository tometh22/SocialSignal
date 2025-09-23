/**
 * 📅 SERVICIO DE FECHAS - Parser robusto de meses en español
 * Maneja "agosto", "Agosto", "08 ago", "8 ago", etc.
 */

const ES_MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
};

/**
 * Convierte mes en español + año a monthKey (YYYY-MM)
 * Soporta formatos: "agosto", "Agosto", "08 ago", "8 ago", etc.
 */
export function monthKeyFromSpanish(mesRaw: string, año: number): string {
  const s = (mesRaw || "").toString().trim().toLowerCase();
  
  // Buscar nombre de mes completo o abreviado
  const monthName = Object.keys(ES_MONTHS).find(k => s.includes(k));
  
  // Si no encuentra nombre, buscar número
  const monthNumber = monthName ? null : (/(\d{1,2})/).exec(s)?.[1];
  
  // Obtener número de mes
  const n = monthName ? ES_MONTHS[monthName as keyof typeof ES_MONTHS] : 
            monthNumber ? Number(monthNumber) : null;
  
  if (!n || n < 1 || n > 12) {
    throw new Error(`Mes inválido: ${mesRaw}`);
  }
  
  return `${año}-${String(n).padStart(2, '0')}`;
}

/**
 * Convierte monthKey a formato legible en español
 */
export function monthKeyToSpanish(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNum = parseInt(month, 10);
  
  const monthNames = Object.entries(ES_MONTHS).find(([_, num]) => num === monthNum);
  
  if (!monthNames) {
    throw new Error(`MonthKey inválido: ${monthKey}`);
  }
  
  const monthName = monthNames[0];
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
}

/**
 * Obtiene monthKey para el mes actual
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Valida si un monthKey tiene formato correcto (YYYY-MM)
 */
export function isValidMonthKey(monthKey: string): boolean {
  const pattern = /^\d{4}-\d{2}$/;
  if (!pattern.test(monthKey)) return false;
  
  const [year, month] = monthKey.split('-');
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  
  return y >= 2020 && y <= 2030 && m >= 1 && m <= 12;
}