/**
 * Normalizador robusto de moneda ES/US para arreglar parseo incorrecto
 * Warner: "29.230,00" -> 29230 (NO 2923000)
 */

export function parseMoneyAuto(v: unknown): number {
  if (v == null) return 0;
  let s = String(v).trim().replace(/\s|\$/g, '');

  // Detectar último separador decimal (. o ,)
  const lastSep = s.replace(/[0-9]/g, '').slice(-1); // '.' o ',' o ''
  
  if (lastSep === ',') {
    // Formato español: 29.230,00 -> 29230.00
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato inglés o mixto: 29,230.00 o 29230.00
    s = s.replace(/,/g, '');
  }
  
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}