export interface ComplexityFactors {
  analysisTypeFactor: number;
  mentionsVolumeFactor: number;
  countriesFactor: number;
  clientEngagementFactor: number;
  templateFactor: number;
}

export const getAnalysisTypeFactor = (analysisType: string): number => {
  switch (analysisType) {
    case "basic":
      return 0;
    case "standard":
      return 0.1; // +10% - Metodología estándar requiere más recursos técnicos
    case "deep":
      return 0.15; // +15% - Metodología avanzada requiere herramientas y técnicas especializadas
    default:
      return 0;
  }
};

export const getMentionsVolumeFactor = (mentionsVolume: string): number => {
  switch (mentionsVolume) {
    case "small":
      return 0;
    case "medium":
      return 0.1; // +10%
    case "large":
      return 0.2; // +20%
    case "xlarge":
      return 0.3; // +30%
    default:
      return 0;
  }
};

export const getCountriesFactor = (countriesCovered: string): number => {
  switch (countriesCovered) {
    case "1":
      return 0;
    case "2-5":
      return 0.05; // +5%
    case "6-10":
      return 0.15; // +15%
    case "10+":
      return 0.25; // +25%
    default:
      return 0;
  }
};

export const getClientEngagementFactor = (clientEngagement: string): number => {
  switch (clientEngagement) {
    case "low":
      return 0;
    case "medium":
      return 0.05; // +5%
    case "high":
      return 0.15; // +15%
    default:
      return 0;
  }
};

export const getTemplateFactor = (templateComplexity: string): number => {
  switch (templateComplexity) {
    case "low":
      return 0;
    case "medium":
      return 0.1; // +10%
    case "high":
      return 0.2; // +20%
    case "variable":
      return 0.15; // +15%
    default:
      return 0;
  }
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
  
  console.log("Factores de complejidad:", { 
    analysisTypeFactor, 
    mentionsVolumeFactor, 
    countriesFactor, 
    clientEngagementFactor, 
    templateFactor,
    totalFactor
  });

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
    
  console.log(`Aplicando factor de margen: ${factor}x al costo ajustado: ${adjustedBaseCost}`);
  
  // Aplicar el factor multiplicador al margen
  return adjustedBaseCost * factor;
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
  
  // Calcular el subtotal antes de aplicar el desvío
  const subtotal = baseCost + complexityAdjustment + markupAmount + platformCost;
  
  // Aplicar el porcentaje de desvío (si existe)
  const deviationAmount = subtotal * (deviationPercentage / 100);
  
  console.log("Cálculo total:", {
    baseCost,
    complexityAdjustment,
    markupAmount,
    platformCost,
    deviationPercentage,
    subtotal,
    deviationAmount,
    total: subtotal + deviationAmount
  });
  
  return subtotal + deviationAmount;
};
