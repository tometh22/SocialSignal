/**
 * 🎯 PARSER ROBUSTO DE MONEDA - Anti ×100 bug
 * Detecta automáticamente separadores decimales y miles
 * Maneja todos los formatos: "$29,230.00", "29.230,00", "29230", etc.
 */
export function parseMoneySmart(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw == null) return 0;

  let s = String(raw).trim();
  // quitar símbolos y espacios, dejar sólo dígitos, coma, punto y signo
  s = s.replace(/[^\d.,\-]/g, '');

  const hasC = s.includes(',');
  const hasD = s.includes('.');

  if (hasC && hasD) {
    // último separador es el decimal
    const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const dec  = s[last];
    if (dec === ',') s = s.replace(/\./g, '').replace(',', '.'); // "29.230,00" → "29230.00"
    else             s = s.replace(/,/g, '');                     // "29,230.00" → "29230.00"
  } else if (hasC && !hasD) {
    // sólo coma: si termina con 1-2 dígitos es decimal, sino miles
    s = /,(\d{1,2})$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hasD && !hasC) {
    // sólo punto: si termina con 1-2 dígitos es decimal, sino miles
    s = /\.(\d{1,2})$/.test(s) ? s : s.replace(/\./g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
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
    // 2. Si es string, usar parser robusto de separadores decimales
    n = parseMoneySmart(raw);
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
 * ⚠️ LEGACY FUNCTION - Use parseMoneySmart() instead
 * @deprecated Keeping for backward compatibility - will be removed
 */
export function parseMoneyAuto(input: unknown): number {
  // Redirect to new robust parser
  return parseMoneySmart(input);
}

// Alias para compatibilidad con código existente
export const parseMoneyValue = parseMoneySmart;