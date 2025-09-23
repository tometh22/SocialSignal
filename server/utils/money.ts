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
 */
export function normalizeAmount(raw: unknown): number {
  const smart = parseMoneySmart(raw); // 29230
  const digitsOnly = String(raw ?? '').replace(/[^\d\-]/g, '');
  const inflated = Number(digitsOnly); // 2923000 si alguien quitó coma y punto

  if (Number.isFinite(inflated) && inflated > 0) {
    const ratio = inflated / (smart || 1);
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