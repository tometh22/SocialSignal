
export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
  templateFactor: number;
}

// Multiplicadores fijos (fallback si falla la API)
const DEFAULT_MULTIPLIERS = {
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
    basic: 0,
    medium: 0.1,
    high: 0.2
  }
};

// Cache para multiplicadores
let multiplierCache: Record<string, Record<string, number>> = DEFAULT_MULTIPLIERS;
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
    console.log('Loading cost multipliers from API...');
    const response = await fetch('/api/cost-multipliers');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const multipliers = await response.json();
    console.log('Raw multipliers from API:', multipliers);

    // Organizar multiplicadores por categoría y subcategoría
    const newCache: Record<string, Record<string, number>> = {};
    
    multipliers.forEach((m: any) => {
      if (!newCache[m.category]) {
        newCache[m.category] = {};
      }
      if (m.isActive) {
        newCache[m.category][m.subcategory] = m.multiplier;
      }
    });

    // Solo actualizar si tenemos datos válidos
    if (Object.keys(newCache).length > 0) {
      multiplierCache = newCache;
      cacheTimestamp = now;
      console.log('Updated multiplier cache:', multiplierCache);
    } else {
      console.warn('No valid multipliers received, keeping defaults');
    }
  } catch (error) {
    console.error('Error loading cost multipliers:', error);
    console.log('Using default multipliers');
    multiplierCache = DEFAULT_MULTIPLIERS;
  }
};

// Función para invalidar el caché y forzar recarga
export const invalidateCostMultipliersCache = (): void => {
  cacheTimestamp = 0;
};

// Funciones de factor de cálculo mejoradas
export const getAnalysisTypeFactor = (analysisType: string): number => {
  if (!analysisType) return 0;
  
  const factor = multiplierCache.complexity?.[analysisType] ?? DEFAULT_MULTIPLIERS.complexity[analysisType as keyof typeof DEFAULT_MULTIPLIERS.complexity] ?? 0;
  console.log(`Analysis type factor for ${analysisType}:`, factor);
  return factor;
};

export const getMentionsVolumeFactor = (mentionsVolume: string): number => {
  if (!mentionsVolume) return 0;
  
  const factor = multiplierCache.mentions_volume?.[mentionsVolume] ?? DEFAULT_MULTIPLIERS.mentions_volume[mentionsVolume as keyof typeof DEFAULT_MULTIPLIERS.mentions_volume] ?? 0;
  console.log(`Mentions volume factor for ${mentionsVolume}:`, factor);
  return factor;
};

export const getCountriesFactor = (countriesCovered: string): number => {
  if (!countriesCovered) return 0;
  
  const factor = multiplierCache.countries?.[countriesCovered] ?? DEFAULT_MULTIPLIERS.countries[countriesCovered as keyof typeof DEFAULT_MULTIPLIERS.countries] ?? 0;
  console.log(`Countries factor for ${countriesCovered}:`, factor);
  return factor;
};

export const getClientEngagementFactor = (clientEngagement: string): number => {
  if (!clientEngagement) return 0;
  
  const factor = multiplierCache.urgency?.[clientEngagement] ?? DEFAULT_MULTIPLIERS.urgency[clientEngagement as keyof typeof DEFAULT_MULTIPLIERS.urgency] ?? 0;
  console.log(`Client engagement factor for ${clientEngagement}:`, factor);
  return factor;
};

export const getTemplateFactor = (templateComplexity: string): number => {
  if (!templateComplexity) return 0;
  
  const factor = multiplierCache.project_type?.[templateComplexity] ?? DEFAULT_MULTIPLIERS.project_type[templateComplexity as keyof typeof DEFAULT_MULTIPLIERS.project_type] ?? 0;
  console.log(`Template factor for ${templateComplexity}:`, factor);
  return factor;
};

export function calculateComplexityAdjustment(baseCost: number, factors: ComplexityFactors): number {
  if (!baseCost || baseCost <= 0) {
    console.log('Base cost is 0 or invalid:', baseCost);
    return 0;
  }

  console.log('Calculating complexity adjustment with:', { baseCost, factors });
  
  const totalFactor = Object.values(factors).reduce((sum, factor) => sum + (factor || 0), 0);
  const adjustment = Math.round(baseCost * totalFactor * 100) / 100;
  
  console.log('Complexity calculation:', { totalFactor, adjustment });
  return adjustment;
}

export function calculateMarkup(adjustedCost: number): number {
  if (!adjustedCost || adjustedCost <= 0) {
    console.log('Adjusted cost is 0 or invalid:', adjustedCost);
    return 0;
  }

  // Standard 100% markup (doblar el costo)
  const markup = Math.round(adjustedCost * 100) / 100;
  console.log('Markup calculation:', { adjustedCost, markup });
  return markup;
}

export function calculateTotalAmount(
  baseCost: number, 
  complexityAdjustment: number, 
  markup: number, 
  platformCost: number = 0, 
  deviationPercentage: number = 0
): number {
  if (!baseCost || baseCost <= 0) {
    console.log('Base cost is 0 or invalid for total calculation:', baseCost);
    return 0;
  }

  const subtotal = (baseCost || 0) + (complexityAdjustment || 0) + (markup || 0) + (platformCost || 0);
  const deviationAmount = subtotal * ((deviationPercentage || 0) / 100);
  const total = Math.round((subtotal + deviationAmount) * 100) / 100;
  
  console.log('Total calculation:', { baseCost, complexityAdjustment, markup, platformCost, deviationAmount, total });
  return total;
}
