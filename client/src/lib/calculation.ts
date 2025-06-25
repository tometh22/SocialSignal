export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
  templateFactor: number;
}

// Multiplicadores fijos basados en el panel de administración real
const DEFAULT_MULTIPLIERS = {
  complexity: {
    basic: 0, // Metodología Básica: 1x (0%)
    standard: 15, // Metodología Estándar: 1.15x (+15%)
    deep: 35 // Metodología Avanzada: 1.35x (+35%)
  },
  mentions_volume: {
    small: 0, // 10k - 50k menciones: 1x (0%)
    medium: 15, // 50k - 200k menciones: 1.15x (+15%)
    large: 15,
    xlarge: 15
  },
  countries: {
    "1": 0, // Un solo país: 1x (0%)
    "2-5": 10, // 2-5 países: 1.1x (+10%)
    "6-10": 20, // 6-10 países: 1.2x (+20%)
    "10+": 35 // 10+ países: 1.35x (+35%)
  },
  urgency: {
    low: 0, // +0.0% (Bajo)
    medium: 0,
    high: 0
  },
  project_type: {
    basic: 0,
    medium: 0,
    high: 0
  }
};

// Cache para multiplicadores
let multiplierCache: Record<string, Record<string, number>> = DEFAULT_MULTIPLIERS;
let cacheTimestamp: number = 0;

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

export async function loadCostMultipliers(forceReload = false): Promise<void> {
  const now = Date.now();

  // Use cache if not expired and not forcing reload
  if (!forceReload && cacheTimestamp && (now - cacheTimestamp < CACHE_EXPIRATION)) {
    console.log('📋 Using cached multipliers:', multiplierCache);
    return;
  }

  try {
    console.log('🔄 Loading cost multipliers from API...');
    const response = await fetch('/api/cost-multipliers');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const multipliers = await response.json();
    console.log('📊 Raw multipliers from API:', multipliers);

    // Organize multipliers by category
    const organized: Record<string, Record<string, number>> = {};

    multipliers.forEach((m: any) => {
      if (!organized[m.category]) {
        organized[m.category] = {};
      }
      if (m.isActive) {
        organized[m.category][m.subcategory] = m.multiplier;
        console.log(`✅ Added multiplier: ${m.category}.${m.subcategory} = ${m.multiplier}`);
      } else {
        console.log(`❌ Skipped inactive multiplier: ${m.category}.${m.subcategory}`);
      }
    });

    // Always merge with defaults to ensure we have all required values
    multiplierCache = { ...DEFAULT_MULTIPLIERS, ...organized };
    cacheTimestamp = now;
    console.log('💾 Final multiplier cache:', multiplierCache);
    
    // Log each category
    Object.keys(multiplierCache).forEach(category => {
      console.log(`📂 Category ${category}:`, multiplierCache[category]);
    });
    
  } catch (error) {
    console.error('❌ Error loading cost multipliers:', error);
    console.log('🔧 Using default multipliers:', DEFAULT_MULTIPLIERS);
    multiplierCache = DEFAULT_MULTIPLIERS;
    cacheTimestamp = now;
  }
}

// Función para invalidar el caché y forzar recarga
export const invalidateCostMultipliersCache = (): void => {
  cacheTimestamp = 0;
};

// Funciones de factor de cálculo mejoradas
export const getAnalysisTypeFactor = (analysisType: string): number => {
  console.log(`🔍 Getting analysis type factor for: "${analysisType}"`);
  
  if (!analysisType) {
    console.log('⚠️ Analysis type is empty, returning 0');
    return 0;
  }

  // Map UI values to database values
  const mapping: Record<string, string> = {
    'Básico': 'basic',
    'basic': 'basic',
    'Estándar': 'standard', 
    'standard': 'standard',
    'Avanzado': 'deep',
    'deep': 'deep'
  };

  const mappedType = mapping[analysisType] || analysisType.toLowerCase();
  console.log(`🔄 Mapped "${analysisType}" to "${mappedType}"`);
  
  // Get factor from cache or default
  const factor = multiplierCache.complexity?.[mappedType] ?? 
                 DEFAULT_MULTIPLIERS.complexity[mappedType as keyof typeof DEFAULT_MULTIPLIERS.complexity] ?? 
                 0;
  
  console.log(`📊 Analysis type factor result: ${factor} (${factor * 100}%)`);
  console.log(`📂 Available complexity factors:`, multiplierCache.complexity);
  
  return factor;
};

export const getMentionsVolumeFactor = (mentionsVolume: string): number => {
  console.log(`🔍 Getting mentions volume factor for: "${mentionsVolume}"`);
  
  if (!mentionsVolume) {
    console.log('⚠️ Mentions volume is empty, returning 0');
    return 0;
  }

  // Map UI values to database values
  const mapping: Record<string, string> = {
    'Pequeño': 'small',
    'small': 'small',
    'Medio': 'medium',
    'medium': 'medium', 
    'Grande': 'large',
    'large': 'large',
    'Extra grande': 'xlarge',
    'xlarge': 'xlarge'
  };

  const mappedVolume = mapping[mentionsVolume] || mentionsVolume.toLowerCase();
  console.log(`🔄 Mapped "${mentionsVolume}" to "${mappedVolume}"`);
  
  const factor = multiplierCache.mentions_volume?.[mappedVolume] ?? 
                 DEFAULT_MULTIPLIERS.mentions_volume[mappedVolume as keyof typeof DEFAULT_MULTIPLIERS.mentions_volume] ?? 
                 0;
  
  console.log(`📊 Mentions volume factor result: ${factor} (${factor * 100}%)`);
  console.log(`📂 Available mentions_volume factors:`, multiplierCache.mentions_volume);
  
  return factor;
};

export const getCountriesFactor = (countriesCovered: string): number => {
  if (!countriesCovered) return 0;

  // Map UI values to database values
  const mapping: Record<string, string> = {
    '1 país': '1',
    '1': '1',
    '2-5 países': '2-5',
    '2-5': '2-5',
    '6-10 países': '6-10', 
    '6-10': '6-10',
    'Más de 10': '10+',
    '10+': '10+'
  };

  const mappedCountries = mapping[countriesCovered] || countriesCovered;
  const factor = multiplierCache.countries?.[mappedCountries] ?? DEFAULT_MULTIPLIERS.countries[mappedCountries as keyof typeof DEFAULT_MULTIPLIERS.countries] ?? 0;
  console.log(`Countries factor for ${countriesCovered} (mapped to ${mappedCountries}):`, factor);
  return factor;
};

export const getClientEngagementFactor = (clientEngagement: string): number => {
  if (!clientEngagement) return 0;

  // Map UI values to database values  
  const mapping: Record<string, string> = {
    'Bajo': 'low',
    'low': 'low',
    'Medio': 'medium',
    'medium': 'medium',
    'Alto': 'high', 
    'high': 'high'
  };

  const mappedEngagement = mapping[clientEngagement] || clientEngagement;
  const factor = multiplierCache.urgency?.[mappedEngagement] ?? DEFAULT_MULTIPLIERS.urgency[mappedEngagement as keyof typeof DEFAULT_MULTIPLIERS.urgency] ?? 0;
  console.log(`Client engagement factor for ${clientEngagement} (mapped to ${mappedEngagement}):`, factor);
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