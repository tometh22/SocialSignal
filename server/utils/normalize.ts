/**
 * Normalizador de nombres de proyecto para resolver matchs $0
 * Maneja espacios, mayúsculas, acentos, alias "Fee mensual", "Fee Marketing", etc.
 */

export const normalizeKey = (s: string | undefined | null) => {
  if (!s) return '';
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'') // sin acentos
    .replace(/\s+/g,' ')            // colapsar espacios
    .trim()
    .toLowerCase();
};

// Mapa de alias (agregar equivalencias reales que tengas en los excels)
const ALIAS: Record<string,string> = {
  'fee mensual': 'fee marketing',
  'fee huggies': 'fee huggies',      // mantener
  // agrega aquí equivalencias reales que tengas en los excels
};

export const projectKey = (s: string | undefined | null) => {
  if (!s) return '';
  const normalized = normalizeKey(s);
  return ALIAS[normalized] ?? normalized;
};