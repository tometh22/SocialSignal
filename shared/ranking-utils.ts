import { RANKING_CONFIG, PersonnelMetrics, RankingType } from './ranking-config';

/**
 * Calcula todas las métricas económicas para un miembro del equipo
 */
export function calculatePersonnelMetrics(
  personnelId: number,
  personnelName: string,
  estimatedHours: number,
  actualHours: number,
  estimatedCost: number,
  actualCost: number,
  totalProjectPrice: number,
  totalEstimatedCost: number
): Omit<PersonnelMetrics, 'efficiencyScore' | 'impactScore' | 'unifiedScore' | 'efficiencyRank' | 'impactRank' | 'unifiedRank' | 'performanceColor'> {
  // FILTRO: Solo calcular métricas si hay datos mínimos significativos
  // Excluir casos con solo datos objetivo sin realización
  const hasMinimumData = (actualHours > 0 || actualCost > 0) && 
                         (estimatedHours > 0 || estimatedCost > 0);
  
  if (!hasMinimumData) {
    console.log(`⚠️ Skipping metrics for ${personnelName} - insufficient data:`, {
      actualHours, actualCost, estimatedHours, estimatedCost
    });
  }
  
  // Calcular porcentaje del precio del proyecto que gestiona
  const pricePercentage = totalEstimatedCost > 0 ? (estimatedCost / totalEstimatedCost) : 0;
  const assignedPrice = totalProjectPrice * pricePercentage;
  
  // Calcular métricas base (con validaciones mejoradas)
  const costDeviation = estimatedCost > 0 ? (estimatedCost - actualCost) / estimatedCost : 0;
  const hoursDeviation = estimatedHours > 0 ? (estimatedHours - actualHours) / estimatedHours : 0;
  const marginPerHour = actualHours > 0 ? (assignedPrice - actualCost) / actualHours : 0;
  const billingEfficiency = actualCost > 0 ? assignedPrice / actualCost : 0;
  
  return {
    personnelId,
    personnelName,
    estimatedHours,
    actualHours,
    estimatedCost,
    actualCost,
    pricePercentage,
    assignedPrice,
    costDeviation,
    hoursDeviation,
    marginPerHour,
    billingEfficiency
  };
}

/**
 * Normaliza un array de valores a escala 0-100 usando percentiles robustos
 * Esto maneja mejor los outliers extremos
 */
function normalizeToScale(values: number[], min = 0, max = 100): number[] {
  if (values.length === 0) return [];
  
  // Ordenar valores para calcular percentiles
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;
  
  // Usar percentiles 10-90 para evitar outliers extremos
  const p10Index = Math.floor(len * 0.1);
  const p90Index = Math.floor(len * 0.9);
  const p10Value = sorted[p10Index];
  const p90Value = sorted[p90Index];
  
  const range = p90Value - p10Value;
  
  if (range === 0) return values.map(() => (min + max) / 2);
  
  return values.map(value => {
    // Clamp values to percentile range to handle outliers
    const clampedValue = Math.max(p10Value, Math.min(p90Value, value));
    return min + ((clampedValue - p10Value) / range) * (max - min);
  });
}

/**
 * Calcula el puntaje de eficiencia para cada persona
 */
export function calculateEfficiencyScores(metrics: Omit<PersonnelMetrics, 'efficiencyScore' | 'impactScore' | 'unifiedScore' | 'efficiencyRank' | 'impactRank' | 'unifiedRank' | 'performanceColor'>[]): number[] {
  if (metrics.length === 0) return [];
  
  const weights = RANKING_CONFIG.efficiencyWeights;
  
  // Extraer las métricas individuales
  const costDeviations = metrics.map(m => m.costDeviation);
  const hoursDeviations = metrics.map(m => m.hoursDeviation);
  const marginsPerHour = metrics.map(m => m.marginPerHour);
  const billingEfficiencies = metrics.map(m => m.billingEfficiency);
  
  // Normalizar cada métrica a escala 0-100
  const normalizedCostDev = normalizeToScale(costDeviations);
  const normalizedHoursDev = normalizeToScale(hoursDeviations);
  const normalizedMargin = normalizeToScale(marginsPerHour);
  const normalizedBilling = normalizeToScale(billingEfficiencies);
  
  // Calcular puntaje ponderado para cada persona
  return metrics.map((_, index) => {
    const score = 
      normalizedCostDev[index] * weights.costDeviation +
      normalizedHoursDev[index] * weights.hoursDeviation +
      normalizedMargin[index] * weights.marginPerHour +
      normalizedBilling[index] * weights.billingEfficiency;
    
    // Aplicar una curva más suave para evitar scores extremos
    const smoothedScore = Math.pow(score / 100, 0.8) * 100;
    return Math.max(5, Math.min(95, smoothedScore)); // Rango 5-95 para mayor realismo
  });
}

/**
 * Calcula el puntaje de impacto (eficiencia * porcentaje económico)
 */
export function calculateImpactScores(
  efficiencyScores: number[], 
  pricePercentages: number[]
): number[] {
  if (efficiencyScores.length !== pricePercentages.length) return [];
  
  return efficiencyScores.map((efficiency, index) => 
    efficiency * pricePercentages[index]
  );
}

/**
 * Calcula el puntaje unificado (mix configurable de eficiencia e impacto)
 */
export function calculateUnifiedScores(
  efficiencyScores: number[],
  pricePercentages: number[],
  customWeights?: { efficiency: number; impact: number }
): number[] {
  if (efficiencyScores.length !== pricePercentages.length) return [];
  
  const weights = customWeights || RANKING_CONFIG.unifiedWeights;
  
  // Normalizar porcentajes de precio a escala 0-100
  const normalizedPrices = normalizeToScale(pricePercentages);
  
  return efficiencyScores.map((efficiency, index) => 
    efficiency * weights.efficiency + normalizedPrices[index] * weights.impact
  );
}

/**
 * Asigna rankings basados en puntajes (mayor puntaje = mejor ranking)
 */
export function assignRankings(scores: number[]): number[] {
  const indexed = scores.map((score, index) => ({ score, originalIndex: index }));
  indexed.sort((a, b) => b.score - a.score); // Ordenar de mayor a menor
  
  const rankings = new Array(scores.length);
  indexed.forEach((item, rank) => {
    rankings[item.originalIndex] = rank + 1;
  });
  
  return rankings;
}

/**
 * Determina el color del semáforo basado en el puntaje
 */
export function getPerformanceColor(score: number, type: 'efficiency' | 'impact' | 'unified' = 'efficiency'): 'green' | 'yellow' | 'red' {
  const thresholds = RANKING_CONFIG.thresholds[type];
  
  if (score >= thresholds.excellent) return 'green';
  if (score >= thresholds.good) return 'yellow';
  return 'red';
}

/**
 * Función principal que calcula todos los rankings para un equipo
 */
export function calculateTeamRankings(
  teamData: Array<{
    personnelId: number;
    personnelName: string;
    estimatedHours: number;
    actualHours: number;
    estimatedCost: number;
    actualCost: number;
  }>,
  totalProjectPrice: number,
  customUnifiedWeights?: { efficiency: number; impact: number }
): PersonnelMetrics[] {
  if (teamData.length === 0) return [];
  
  // FILTRO CRÍTICO: Solo incluir miembros con datos significativos para rankings
  // Requerir actividad real (horas trabajadas O costo incurrido) para ser incluido en rankings
  const filteredTeamData = teamData.filter(member => {
    const hasRealActivity = member.actualHours > 0 || member.actualCost > 0;
    const hasEstimatedData = member.estimatedHours > 0 || member.estimatedCost > 0;
    return hasRealActivity && hasEstimatedData;
  });
  
  console.log(`📊 Rankings filter: ${teamData.length} → ${filteredTeamData.length} members with actual data`);
  
  // Log detallado de qué miembros fueron filtrados
  const filteredOutMembers = teamData.filter(member => {
    const hasRealActivity = member.actualHours > 0 || member.actualCost > 0;
    const hasEstimatedData = member.estimatedHours > 0 || member.estimatedCost > 0;
    return !(hasRealActivity && hasEstimatedData);
  });
  
  if (filteredOutMembers.length > 0) {
    console.log(`🚫 Filtered out ${filteredOutMembers.length} members:`, 
      filteredOutMembers.map(m => ({
        name: m.personnelName,
        actualHours: m.actualHours,
        actualCost: m.actualCost,
        estimatedHours: m.estimatedHours,
        estimatedCost: m.estimatedCost
      }))
    );
  }
  
  if (filteredTeamData.length === 0) return [];
  
  // Calcular costo total estimado del equipo (solo miembros con datos)
  const totalEstimatedCost = filteredTeamData.reduce((sum, member) => sum + member.estimatedCost, 0);
  
  // Calcular métricas base para cada persona (usando datos filtrados)
  const baseMetrics = filteredTeamData.map(member => 
    calculatePersonnelMetrics(
      member.personnelId,
      member.personnelName,
      member.estimatedHours,
      member.actualHours,
      member.estimatedCost,
      member.actualCost,
      totalProjectPrice,
      totalEstimatedCost
    )
  );
  
  // Calcular puntajes
  const efficiencyScores = calculateEfficiencyScores(baseMetrics);
  const pricePercentages = baseMetrics.map(m => m.pricePercentage);
  const impactScores = calculateImpactScores(efficiencyScores, pricePercentages);
  const unifiedScores = calculateUnifiedScores(efficiencyScores, pricePercentages, customUnifiedWeights);
  
  // Asignar rankings
  const efficiencyRanks = assignRankings(efficiencyScores);
  const impactRanks = assignRankings(impactScores);
  const unifiedRanks = assignRankings(unifiedScores);
  
  // Combinar todo en el resultado final
  const finalResults = baseMetrics.map((base, index) => ({
    ...base,
    efficiencyScore: efficiencyScores[index],
    impactScore: impactScores[index],
    unifiedScore: unifiedScores[index],
    efficiencyRank: efficiencyRanks[index],
    impactRank: impactRanks[index],
    unifiedRank: unifiedRanks[index],
    performanceColor: getPerformanceColor(unifiedScores[index], 'unified') // Usar unified score para color general
  }));

  // Log final de rankings problemáticos (scores en 0 con color crítico)
  const problematicRankings = finalResults.filter(r => 
    r.performanceColor === 'red' && (r.actualHours === 0 && r.actualCost === 0)
  );
  
  if (problematicRankings.length > 0) {
    console.log(`🚨 Found ${problematicRankings.length} problematic rankings (red with zero data):`,
      problematicRankings.map(r => ({
        name: r.personnelName,
        unifiedScore: r.unifiedScore,
        actualHours: r.actualHours,
        actualCost: r.actualCost,
        estimatedHours: r.estimatedHours,
        estimatedCost: r.estimatedCost
      }))
    );
  }

  return finalResults;
}

/**
 * Ordena las métricas según el tipo de ranking seleccionado
 */
export function sortByRankingType(metrics: PersonnelMetrics[], rankingType: RankingType): PersonnelMetrics[] {
  const sorted = [...metrics];
  
  switch (rankingType) {
    case 'efficiency':
      return sorted.sort((a, b) => a.efficiencyRank - b.efficiencyRank);
    case 'impact':
      return sorted.sort((a, b) => a.impactRank - b.impactRank);
    case 'unified':
      return sorted.sort((a, b) => a.unifiedRank - b.unifiedRank);
    default:
      return sorted;
  }
}