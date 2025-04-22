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
  const totalFactor =
    factors.analysisTypeFactor +
    factors.mentionsVolumeFactor +
    factors.countriesFactor +
    factors.clientEngagementFactor +
    factors.templateFactor;

  return baseCost * totalFactor;
};

export const calculateMarkup = (adjustedBaseCost: number): number => {
  // Apply minimum 2x markup (100% margin)
  return adjustedBaseCost;
};

export const calculateTotalAmount = (
  baseCost: number,
  complexityAdjustment: number,
  markupAmount: number,
  platformCost: number = 0,
  deviationPercentage: number = 0
): number => {
  // Calcular el subtotal antes de aplicar el desvío
  const subtotal = baseCost + complexityAdjustment + markupAmount + platformCost;
  
  // Aplicar el porcentaje de desvío (si existe)
  const deviationAmount = subtotal * (deviationPercentage / 100);
  
  return subtotal + deviationAmount;
};
