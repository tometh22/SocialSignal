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
  
  // Detectar formato: europeo (coma decimal) vs USA/inglés (punto decimal)
  const hasCommaDecimal = /,\d{1,2}$/.test(s);  // Formato europeo: 1.234,56
  const hasDotDecimal = /\.\d{1,2}$/.test(s);   // Formato USA: 1,234.56
  
  if (hasCommaDecimal) {
    // Formato europeo: punto=miles, coma=decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDotDecimal) {
    // Formato USA/inglés: coma=miles, punto=decimal
    s = s.replace(/,/g, '');  // Solo quitar comas (separadores de miles)
  } else {
    // Sin decimal claro: asumir formato entero (quitar todo)
    s = s.replace(/[.,]/g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 🛡️ DETECCIÓN ANTI-X100 GENÉRICA POR FILA
 * Calcula usdFromArs = montoARS / tipoCambio
 * Si abs(montoUSD - usdFromArs*100) <= 0.5 ⇒ corregir montoUSD = montoUSD/100, flag anomaly: 'x100_fixed'
 * PLUS: Detección solo-USD para valores grandes con patrón x100
 */
export function detectAntiX100Generic(montoUSD: number, montoARS: number, tipoCambio: number): { correctedUSD: number; anomaly?: string } {
  if (!montoUSD || tipoCambio <= 0) {
    return { correctedUSD: montoUSD };
  }

  // MODO 1: Detección con ARS (como especificaste originalmente)
  if (montoARS && montoARS > 0) {
    const usdFromArs = montoARS / tipoCambio;
    const difference = Math.abs(montoUSD - usdFromArs * 100);
    
    // Si la diferencia es <= 0.5, es muy probable que sea un error x100
    if (difference <= 0.5) {
      const correctedUSD = montoUSD / 100;
      console.log(`🔧 ANTI×100 GENÉRICO ARS: ${montoUSD} → ${correctedUSD} (diferencia: ${difference.toFixed(3)})`);
      return { correctedUSD, anomaly: 'x100_fixed' };
    }
  }
  
  // MODO 2: Detección solo-USD para valores grandes (sales típicamente no tienen ARS)
  // Detectar patrones x10000, x1000, x100 según magnitud
  if (montoUSD > 50000) {
    let candidate: number;
    let divider: number;
    let patternName: string;
    
    // Detectar x10000 para valores muy grandes (millones)
    if (montoUSD > 10000000 && montoUSD % 10000 === 0) {
      candidate = montoUSD / 10000;
      divider = 10000;
      patternName = 'x10000';
    }
    // Detectar x1000 para valores grandes (cientos de miles)
    else if (montoUSD > 1000000 && montoUSD % 1000 === 0) {
      candidate = montoUSD / 1000;
      divider = 1000;
      patternName = 'x1000';
    }
    // Detectar x100 para valores medianos (decenas de miles)
    else if (montoUSD % 100 === 0 && montoUSD.toString().endsWith('00')) {
      candidate = montoUSD / 100;
      divider = 100;
      patternName = 'x100';
    }
    else {
      return { correctedUSD: montoUSD };
    }
    
    // El candidato debe estar en rango business razonable
    const isReasonableRange = candidate >= 100 && candidate <= 500000;
    
    if (isReasonableRange) {
      console.log(`🔧 ANTI×${divider} GENÉRICO USD: ${montoUSD} → ${candidate} (patrón ${patternName} detectado)`);
      return { correctedUSD: candidate, anomaly: `${patternName}_fixed` };
    }
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