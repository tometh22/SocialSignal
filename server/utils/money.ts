/**
 * 🎯 PARSER ÚNICO DE MONEDA
 * Quita espacios, separadores de miles (.), deja , como decimal → convierte a número seguro; NaN → 0
 */
export function parseMoneyUnified(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw == null) return 0;

  let s = String(raw).trim();
  // Quitar espacios y símbolos, dejar sólo dígitos, coma, punto y signo
  s = s.replace(/[^\d.,\-]/g, '');
  
  // Quitar separadores de miles (.) y dejar , como decimal
  // Detectar si hay coma como decimal al final
  const hasCommaDecimal = /,\d{1,2}$/.test(s);
  
  if (hasCommaDecimal) {
    // Quitar puntos (separadores de miles) y convertir coma a punto decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Si no hay coma decimal, quitar todos los separadores
    s = s.replace(/[.,]/g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 🛡️ DETECCIÓN ANTI-X100 GENÉRICA POR FILA
 * Calcula usdFromArs = montoARS / tipoCambio
 * Si abs(montoUSD - usdFromArs*100) <= 0.5 ⇒ corregir montoUSD = montoUSD/100, flag anomaly: 'x100_fixed'
 */
export function detectAntiX100Generic(montoUSD: number, montoARS: number, tipoCambio: number): { correctedUSD: number; anomaly?: string } {
  if (!montoUSD || !montoARS || !tipoCambio || tipoCambio <= 0) {
    return { correctedUSD: montoUSD };
  }

  const usdFromArs = montoARS / tipoCambio;
  const difference = Math.abs(montoUSD - usdFromArs * 100);
  
  // Si la diferencia es <= 0.5, es muy probable que sea un error x100
  if (difference <= 0.5) {
    const correctedUSD = montoUSD / 100;
    console.log(`🔧 ANTI×100 GENÉRICO: ${montoUSD} → ${correctedUSD} (diferencia: ${difference.toFixed(3)})`);
    return { correctedUSD, anomaly: 'x100_fixed' };
  }
  
  return { correctedUSD: montoUSD };
}

/**
 * 🛡️ PARSER ROBUSTO CON ANTI ×100 (blueprint end-to-end)
 * Maneja números puros de UNFORMATTED_VALUE y strings legacy con separadores
 */
export function normalizeAmount(raw: unknown): number {
  let n: number;
  
  // 1. Si ya es número (UNFORMATTED_VALUE), usarlo directamente
  if (typeof raw === 'number') {
    n = raw;
  } else {
    // 2. Si es string, usar parser unificado de separadores decimales
    n = parseMoneyUnified(raw);
  }
  
  // 3. 🛡️ ANTI ×100: si n > 1M, evaluar n/100 cuando sea razonable
  if (n > 1_000_000) {
    const n2 = n / 100;
    // Heurística: n2 debe estar en rango razonable (1..500k) 
    // y n debe tener patrón ×100 (terminado en 00 o múltiple exacto)
    if (n2 >= 1 && n2 <= 500_000 && (n % 100 === 0 || n % 1000 === 0)) {
      console.log(`🔧 ANTI×100: ${n} → ${n2} (pattern detected)`);
      return n2;
    }
  }
  
  return n;
}

/**
 * ⚠️ LEGACY FUNCTION - Use parseMoneyUnified() instead
 * @deprecated Keeping for backward compatibility - will be removed
 */
export function parseMoneyAuto(input: unknown): number {
  // Redirect to new unified parser
  return parseMoneyUnified(input);
}

/**
 * ⚠️ LEGACY FUNCTION - Use parseMoneyUnified() instead
 * @deprecated Keeping for backward compatibility - will be removed
 */
export function parseMoneySmart(input: unknown): number {
  // Redirect to new unified parser
  return parseMoneyUnified(input);
}

// Alias para compatibilidad con código existente
export const parseMoneyValue = parseMoneyUnified;