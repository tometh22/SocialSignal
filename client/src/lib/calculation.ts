export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
  templateFactor: number;
}

// Cache para multiplicadores - se actualiza cada vez que se cargan
let multiplierCache: Record<string, Record<string, number>> = {};
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función para cargar multiplicadores desde la API
export const loadCostMultipliers = async (forceReload = false): Promise<void> => {
  const now = Date.now();

  // Si el caché es reciente y no se fuerza la recarga, usar caché
  if (!forceReload && (now - cacheTimestamp) < CACHE_DURATION && Object.keys(multiplierCache).length > 0) {
    return;
  }

  try {
    const response = await fetch('/api/cost-multipliers');
    if (!response.ok) {
      throw new Error('Failed to fetch cost multipliers');
    }

    const multipliers = await response.json();

    // Organizar multiplicadores por categoría y subcategoría
    multiplierCache = {};
    multipliers.forEach((m: any) => {
      if (!multiplierCache[m.category]) {
        multiplierCache[m.category] = {};
      }
      if (m.isActive) {
        multiplierCache[m.category][m.subcategory] = m.multiplier;
      }
    });

    cacheTimestamp = now;
  } catch (error) {
    console.error('Error loading cost multipliers:', error);
    // Usar valores por defecto si falla la carga
    setDefaultMultipliers();
  }
};

// Función para invalidar el caché y forzar recarga
export const invalidateCostMultipliersCache = (): void => {
  cacheTimestamp = 0;
};

// Función para establecer multiplicadores por defecto si falla la carga de la API
const setDefaultMultipliers = (): void => {
  multiplierCache = {
    complexity: {
      basic: 0,
      standard: 0.1,
      deep: 0.15
    },
    mentions_volume: {
      small: 0,
      medium: 0.1,
      large: 0.2,
      xlarge: 0.3
    },
    countries: {
      "1": 0,
      "2-5": 0.05,
      "6-10": 0.15,
      "10+": 0.25
    },
    urgency: {
      low: 0,
      medium: 0.05,
      high: 0.15
    },
    project_type: {
      low: 0,
      medium: 0.1,
      high: 0.2,
      variable: 0.15
    }
  };
};

// Funciones de factor de cálculo - ahora usan la base de datos
// Los multiplicadores vienen como valores absolutos (1.0, 1.25, etc.), los convertimos a factores (0, 0.25, etc.)
export const getAnalysisTypeFactor = (analysisType: string): number => {
  const multiplier = multiplierCache.complexity?.[analysisType] ?? 1;
  return multiplier - 1; // Convertir de multiplicador absoluto a factor aditivo
};

export const getMentionsVolumeFactor = (mentionsVolume: string): number => {
  const multiplier = multiplierCache.mentions_volume?.[mentionsVolume] ?? 1;
  return multiplier - 1;
};

export const getCountriesFactor = (countriesCovered: string): number => {
  const multiplier = multiplierCache.countries?.[countriesCovered] ?? 1;
  return multiplier - 1;
};

export const getClientEngagementFactor = (clientEngagement: string): number => {
  const multiplier = multiplierCache.urgency?.[clientEngagement] ?? 1;
  return multiplier - 1;
};

export const getTemplateFactor = (templateComplexity: string): number => {
  const multiplier = multiplierCache.project_type?.[templateComplexity] ?? 1;
  return multiplier - 1;
};

export function calculateComplexityAdjustment(baseCost: number, factors: ComplexityFactors): number {
  if (!baseCost || baseCost <= 0) return 0;

  const totalFactor = Object.values(factors).reduce((sum, factor) => sum + (factor || 0), 0);
  return Math.round(baseCost * totalFactor * 100) / 100; // Round to 2 decimal places
}

export function calculateMarkup(adjustedCost: number): number {
  if (!adjustedCost || adjustedCost <= 0) return 0;

  // Standard 2x markup (100% markup means doubling the cost)
  return Math.round(adjustedCost * 100) / 100; // Round to 2 decimal places
}

export function calculateTotalAmount(
  baseCost: number, 
  complexityAdjustment: number, 
  markup: number, 
  platformCost: number = 0, 
  deviationPercentage: number = 0
): number {
  if (!baseCost || baseCost <= 0) return 0;

  const subtotal = (baseCost || 0) + (complexityAdjustment || 0) + (markup || 0) + (platformCost || 0);
  const deviationAmount = subtotal * ((deviationPercentage || 0) / 100);
  return Math.round((subtotal + deviationAmount) * 100) / 100; // Round to 2 decimal places
}