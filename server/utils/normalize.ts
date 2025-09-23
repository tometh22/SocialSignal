/**
 * 🎯 UNIFIED CANONICAL NORMALIZATION ARCHITECTURE
 * Single source of truth for all text normalization across the system
 */

/**
 * 📝 CANONICAL NORMALIZATION FUNCTION
 * canon(text) → minúsculas, sin tildes, sin dobles espacios, trim
 */
export function canon(text: string | undefined | null): string {
  if (!text) return '';
  
  return text
    .normalize('NFKD')                // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics (tildes, acentos)
    .replace(/\s+/g, ' ')             // Collapse multiple spaces
    .trim()                           // Remove leading/trailing spaces
    .toLowerCase();                   // Convert to lowercase
}

/**
 * 🔑 CANONICAL PROJECT KEY GENERATION
 * key = canon(cliente) + '|' + canon(proyecto)
 * Always generates compound keys to eliminate "Unknown" dependencies
 */
export function generateProjectKey(clientName: string | undefined | null, projectName: string | undefined | null): string {
  const clientCanon = canon(clientName);
  const projectCanon = canon(projectName);
  
  // Generate composite key - no fallbacks to "Unknown"
  return `${clientCanon}|${projectCanon}`;
}

/**
 * 📊 ETL CANONICAL FIELDS GENERATOR
 * Returns clientCanon, projectCanon, projectKey for consistent ETL processing
 */
export function generateCanonicalFields(clientName: string | undefined | null, projectName: string | undefined | null) {
  const clientCanon = canon(clientName);
  const projectCanon = canon(projectName);
  const projectKey = generateProjectKey(clientName, projectName);
  
  return {
    clientCanon,
    projectCanon,
    projectKey
  };
}

// ==================== BACKWARD COMPATIBILITY ====================

/**
 * @deprecated Use canon() instead
 */
export const normalizeKey = canon;

/**
 * @deprecated Use generateProjectKey() instead
 * Old single-field normalization - replaced by compound key architecture
 */
export const projectKey = (s: string | undefined | null) => {
  console.warn('projectKey() is deprecated, use generateProjectKey(client, project) instead');
  return canon(s);
};