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
 * 🔑 Genera projectKey normalizado (versión específica solicitada)
 */
export function projectKey(clientName: string, projectName: string): string {
  const client = canon(clientName);
  const project = canon(projectName);
  
  if (!client || !project) {
    throw new Error(`Invalid project key components: client="${clientName}", project="${projectName}"`);
  }
  
  return `${client}|${project}`;
}

/**
 * 💰 Convierte a USD con validación
 */
export function toUSD(amount: any, currency = 'USD'): number {
  if (amount === null || amount === undefined || amount === '') {
    return 0;
  }
  
  let numericAmount: number;
  
  if (typeof amount === 'string') {
    // Limpiar string de caracteres no numéricos excepto punto y coma
    const cleaned = amount.replace(/[^\d.,-]/g, '');
    numericAmount = parseFloat(cleaned.replace(',', '.'));
  } else {
    numericAmount = Number(amount);
  }
  
  if (isNaN(numericAmount)) {
    console.warn(`Cannot convert to USD: ${amount}`);
    return 0;
  }
  
  return numericAmount;
}

/**
 * 🔧 Fix Anti-×100/×1000/×10000 patterns
 * Detecta y corrige multiplicaciones erróneas comunes
 */
export function fixAntiX100(amount: number): { 
  corrected: number; 
  anomaly: string | null; 
  originalAmount: number;
} {
  const originalAmount = amount;
  
  if (!amount || amount === 0) {
    return { corrected: amount, anomaly: null, originalAmount };
  }
  
  // Detectar patrón ×10000 (muy común en errores de entrada)
  if (amount >= 100000 && amount % 10000 === 0) {
    const candidate = amount / 10000;
    if (candidate >= 10 && candidate <= 100000) {
      return {
        corrected: candidate,
        anomaly: `x10000 pattern detected: ${amount} → ${candidate}`,
        originalAmount
      };
    }
  }
  
  // Detectar patrón ×1000
  if (amount >= 10000 && amount % 1000 === 0) {
    const candidate = amount / 1000;
    if (candidate >= 10 && candidate <= 50000) {
      return {
        corrected: candidate,
        anomaly: `x1000 pattern detected: ${amount} → ${candidate}`,
        originalAmount
      };
    }
  }
  
  // Detectar patrón ×100
  if (amount >= 1000 && amount % 100 === 0) {
    const candidate = amount / 100;
    if (candidate >= 10 && candidate <= 10000) {
      return {
        corrected: candidate,
        anomaly: `x100 pattern detected: ${amount} → ${candidate}`,
        originalAmount
      };
    }
  }
  
  return { corrected: amount, anomaly: null, originalAmount };
}