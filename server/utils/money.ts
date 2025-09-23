/**
 * Parser de moneda a prueba de locales - detecta separador decimal correctamente
 * Maneja casos: "$29,230.00" -> 29230, "29.230,00" -> 29230, "$8,450" -> 8450
 */

export function parseMoneySmart(raw: unknown): number {
  if (typeof raw === 'number') return raw;             // caso ideal
  if (raw == null) return 0;

  let s = String(raw).trim();

  // quitar símbolos y espacios
  s = s.replace(/[^\d.,\-]/g, '');

  // casos típicos: "29,230.00" (US)  |  "29.230,00" (ES)
  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');

  if (hasComma && hasDot) {
    // DECIMAL = el último separador que aparece
    const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const dec  = s[last];

    if (dec === ',') {
      // "29.230,00" -> quitar miles ".", cambiar "," -> "."
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // "29,230.00" -> quitar miles ","
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // Solo coma: si hay 2 dígitos luego de la coma, es decimal
    const m = s.match(/,(\d{1,2})$/);
    s = m ? s.replace(',', '.') : s.replace(/,/g, ''); // sino es miles
  } else {
    // Solo punto: si hay 2 dígitos luego del punto, es decimal; sino miles
    const m = s.match(/\.(\d{1,2})$/);
    s = m ? s : s.replace(/\./g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Alias para compatibilidad con código existente
export const parseMoneyAuto = parseMoneySmart;