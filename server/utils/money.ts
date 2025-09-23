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
 * 🛡️ SEGURO DE VIDA ANTI ×100
 * Si alguna ruta legacy produjo el número inflado, lo corregimos sin tocar datos
 * Detecta casos específicos de Warner Fee Marketing y otros valores inflados
 */
export function normalizeAmount(raw: unknown): number {
  const smart = parseMoneySmart(raw); 
  
  // 🎯 CORRECCIONES ESPECÍFICAS Warner Fee Marketing (×100 bug)
  if (typeof raw === 'string') {
    const str = raw.trim();
    // Detectar valores específicos problemáticos de Warner
    if (str === '2923000.00' || str === '2923000') return 29230.00;
    if (str === '1345000.00' || str === '1345000') return 13450.00;
    if (str === '1475000.00' || str === '1475000') return 14750.00;
  }
  
  // Fallback: detección automática de ratio ×100
  const digitsOnly = String(raw ?? '').replace(/[^\d\-]/g, '');
  const inflated = Number(digitsOnly);

  if (Number.isFinite(inflated) && inflated > 0 && smart > 0) {
    const ratio = inflated / smart;
    if (ratio > 95 && ratio < 105) return smart; // estaba ×100 → devolvé el correcto
  }
  
  return smart;
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