const factorFrom = (value: string, factors: Record<string, number>) => factors[value] ?? 0;

export const getAnalysisTypeFactor = (value: string) => factorFrom(value, {
  basic: -0.10, standard: 0, advanced: 0.15, deep: 0.15, premium: 0.25,
  "Básico": -0.10, "Estándar": 0, "Avanzado": 0.15, "Premium": 0.25,
});

export const getMentionsVolumeFactor = (value: string) => factorFrom(value, {
  low: -0.05, small: -0.05, medium: 0, high: 0.15, large: 0.15,
  "very-high": 0.30, xlarge: 0.30,
  "Bajo": -0.05, "Medio": 0, "Alto": 0.15, "Muy Alto": 0.30,
});

export const getCountriesFactor = (value: string) => factorFrom(value, {
  "1": 0, "2-3": 0.08, "2-5": 0.08, "4-6": 0.18, "6-10": 0.18,
  "7+": 0.30, "10+": 0.30, "2-3 países": 0.08, "4+ países": 0.18,
  "4-6 países": 0.18, "7+ países": 0.30,
});

export const getClientEngagementFactor = (value: string) => factorFrom(value, {
  low: -0.05, medium: 0, high: 0.12, "very-high": 0.20,
  "Bajo": -0.05, "Medio": 0, "Alto": 0.12, "Muy Alto": 0.20,
});

export function calculateQuotationComplexityFactor(input: {
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
}): number {
  return getAnalysisTypeFactor(input.analysisType)
    + getMentionsVolumeFactor(input.mentionsVolume)
    + getCountriesFactor(input.countriesCovered)
    + getClientEngagementFactor(input.clientEngagement);
}
