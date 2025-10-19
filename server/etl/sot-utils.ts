/**
 * ETL Utilities para Single Source of Truth (SoT)
 * Helpers para normalización, parsing y derivación de datos del Excel MAESTRO
 */

// Mapeo de meses en español a números
const MONTHS: Record<string, string> = {
  ene: '01', enero: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03',
  abr: '04', abril: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06',
  jul: '07', julio: '07',
  ago: '08', agosto: '08',
  sep: '09', septiembre: '09', sept: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12'
};

/**
 * Convierte mes/año a period_key en formato YYYY-MM
 * Ejemplos: ("07 jul", 2025) → "2025-07", ("jul", 2025) → "2025-07"
 * Maneja años en formato "2025-8" (del Excel) → extrae solo "2025"
 */
export function toPeriodKey(mes: any, anio: any): string {
  // Extraer solo el año (primeros 4 dígitos) para manejar "2025-8" → "2025"
  const yearStr = String(anio).trim();
  const yearMatch = yearStr.match(/^\d{4}/);
  const y = yearMatch ? yearMatch[0] : yearStr;
  
  const s = String(mes).toLowerCase().trim();
  
  // Intentar extraer mes de diferentes formatos
  const lastThree = s.slice(-3);
  const mm = MONTHS[lastThree] ?? MONTHS[s] ?? String(s).padStart(2, '0');
  
  return `${y}-${mm}`;
}

/**
 * Normaliza un string para usar como clave de matching
 * - Lowercase
 * - Trim
 * - Remueve tildes (NFKD)
 * - Colapsa espacios múltiples
 */
export function normKey(s: string | null | undefined): string {
  if (!s) return '';
  
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // Remover tildes/diacríticos
    .replace(/\s+/g, ' ')            // Colapsar espacios
    .trim();
}

/**
 * Parsea números en formato argentino (1.040.684,50 → 1040684.5)
 * - Punto (.) como separador de miles (se elimina)
 * - Coma (,) como separador decimal (se convierte a punto)
 * - Símbolo de moneda ($) se remueve
 * Retorna 0 si no es un número válido
 */
export function parseNum(x: any): number {
  if (x == null || x === '') return 0;
  
  // Si ya es número, devolverlo
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
  
  // Convertir a string y procesar
  const str = String(x);
  
  // Remover símbolo de moneda ($), separadores de miles (puntos) y convertir decimal (coma a punto)
  const cleaned = str
    .replace(/\$/g, '')              // Remover símbolo $
    .replace(/\s/g, '')               // Remover espacios
    .replace(/\./g, '')               // Remover separadores de miles
    .replace(',', '.');               // Convertir decimal coma a punto
  const n = Number(cleaned);
  
  return Number.isFinite(n) ? n : 0;
}

/**
 * Función preferencia: retorna el primer valor no-nulo/no-cero
 * Útil para fallbacks en derivación de datos
 */
export function prefer(...values: (number | null | undefined)[]): number {
  for (const val of values) {
    if (val != null && val !== 0) return val;
  }
  return 0;
}

/**
 * Aplica normalización ANTI×100 a horas
 * Si una hora > 500, la divide por 100 (error típico de carga del Excel)
 */
export function normHours(hours: number): number {
  return hours > 500 ? hours / 100 : hours;
}

/**
 * Determina si se debe aplicar ANTI×100 a un valor de horas
 */
export function needsAntiX100(value: number, threshold: number = 500): boolean {
  return value > threshold;
}

/**
 * Guard ANTI×100 mejorado para costos usando verificación relacional
 * Detecta si un costo está multiplicado por 100 comparando con el valor esperado
 * 
 * @param costRaw - Costo raw del Excel
 * @param hourlyRate - Tarifa horaria en ARS
 * @param billingHours - Horas de facturación
 * @returns Costo normalizado (÷100 si detecta multiplicación)
 */
export function normalizeCost(costRaw: number, hourlyRate: number, billingHours: number): {
  cost: number;
  wasNormalized: boolean;
} {
  if (costRaw === 0 || hourlyRate === 0 || billingHours === 0) {
    return { cost: costRaw, wasNormalized: false };
  }
  
  // Calcular costo esperado
  const expectedCost = hourlyRate * billingHours;
  
  // Verificar si costRaw / expectedCost está en rango [90, 110]
  // Esto indica que probablemente costRaw está multiplicado por 100
  const ratio = costRaw / expectedCost;
  
  if (ratio >= 90 && ratio <= 110) {
    // Detectado patrón ×100, normalizar
    console.log(`🛡️ ANTI×100 COST: ${costRaw} / ${expectedCost} = ${ratio.toFixed(1)}x → Dividiendo por 100`);
    return {
      cost: costRaw / 100,
      wasNormalized: true
    };
  }
  
  // Si el costo es muy alto en términos absolutos Y la razón sugiere error
  // (más de 1M ARS y más de 10x el esperado)
  if (costRaw > 1_000_000 && ratio > 10) {
    console.log(`🛡️ ANTI×100 COST (fallback): Costo ${costRaw} > 1M y ${ratio.toFixed(1)}x esperado → Dividiendo por 100`);
    return {
      cost: costRaw / 100,
      wasNormalized: true
    };
  }
  
  // Costo parece correcto
  return {
    cost: costRaw,
    wasNormalized: false
  };
}

/**
 * Genera flags de auditoría para un registro
 */
export function generateFlags(checks: Record<string, boolean>): string[] {
  const flags: string[] = [];
  
  for (const [key, value] of Object.entries(checks)) {
    if (value) flags.push(key);
  }
  
  return flags;
}
