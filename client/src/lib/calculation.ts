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

export const calculateComplexityAdjustment = (
  baseCost: number,
  factors: ComplexityFactors
): number => {
  // Verificar que el costo base sea un número válido
  if (!baseCost || isNaN(baseCost)) {
    baseCost = 0;
  }
  
  // Asegurarse de que todos los factores sean números válidos
  const analysisTypeFactor = isNaN(factors.analysisTypeFactor) ? 0 : factors.analysisTypeFactor;
  const mentionsVolumeFactor = isNaN(factors.mentionsVolumeFactor) ? 0 : factors.mentionsVolumeFactor;
  const countriesFactor = isNaN(factors.countriesFactor) ? 0 : factors.countriesFactor;
  const clientEngagementFactor = isNaN(factors.clientEngagementFactor) ? 0 : factors.clientEngagementFactor;
  const templateFactor = isNaN(factors.templateFactor) ? 0 : factors.templateFactor;
  
  // Calcular el factor total
  const totalFactor =
    analysisTypeFactor +
    mentionsVolumeFactor +
    countriesFactor +
    clientEngagementFactor +
    templateFactor;

  // Aplicar el factor al costo base
  return baseCost * totalFactor;
};

export const calculateMarkup = (
  adjustedBaseCost: number,
  marginFactor: number = 1.0
): number => {
  // Mejorado para que siempre devuelva un valor numérico válido
  if (isNaN(adjustedBaseCost) || adjustedBaseCost < 0) {
    console.warn("Valor inválido para calcular markup:", adjustedBaseCost);
    return 0;
  }
  
  // Validar el factor de margen (1.0-10.0)
  const factor = !isNaN(marginFactor) && marginFactor >= 1.0 && marginFactor <= 10.0 
    ? marginFactor 
    : 1.0;
    
  
  // El margen se calcula como un porcentaje extra sobre el costo ajustado
  // Un factor de 1.0x significa no agregar margen (100% del costo)
  // Un factor de 2.0x significa agregar un 100% adicional (200% del costo)
  // Así, el margen sería (factor - 1.0) * adjustedBaseCost
  const markupPercentage = factor - 1.0;
  const markup = adjustedBaseCost * markupPercentage;
  
  
  return markup;
};

export const calculateTotalAmount = (
  baseCost: number,
  complexityAdjustment: number,
  markupAmount: number,
  platformCost: number = 0,
  deviationPercentage: number = 0
): number => {
  // Verificar y sanear valores de entrada
  baseCost = isNaN(baseCost) ? 0 : baseCost;
  complexityAdjustment = isNaN(complexityAdjustment) ? 0 : complexityAdjustment;
  markupAmount = isNaN(markupAmount) ? 0 : markupAmount;
  platformCost = isNaN(platformCost) ? 0 : platformCost;
  deviationPercentage = isNaN(deviationPercentage) ? 0 : deviationPercentage;
  
  // Calcular el costo base ajustado (incluyendo complejidad)
  const adjustedBaseCost = baseCost + complexityAdjustment;
  
  // Calcular el costo operativo total (costos operativos + plataforma)
  const operativeCost = adjustedBaseCost + platformCost;
  
  // El markupAmount ahora representa el margen operativo calculado
  
  // Calcular el subtotal con operaciones
  const operativeSubtotal = operativeCost;
  
  // Aplicar el porcentaje de desvío sobre el subtotal operativo (sin incluir el margen)
  const deviationAmount = operativeSubtotal * (deviationPercentage / 100);
  
  // Calcular el subtotal incluyendo margen
  const subtotal = operativeCost + markupAmount;
  
    baseCost,
    complexityAdjustment,
    adjustedBaseCost,
    platformCost,
    operativeCost,
    operativeSubtotal,
    markupAmount,
    deviationPercentage: `${deviationPercentage}% (aplicado sobre subtotal operativo)`,
    subtotal,
    deviationAmount,
    total: subtotal + deviationAmount
  });
  
  return subtotal + deviationAmount;
};
