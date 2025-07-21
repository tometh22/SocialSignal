// Configuración de pesos para el sistema de rankings económicos
export const RANKING_CONFIG = {
  // Pesos para el ranking de eficiencia (deben sumar 100%)
  efficiencyWeights: {
    costDeviation: 0.40,      // 40% - Desviación de costo
    hoursDeviation: 0.35,     // 35% - Desviación de horas 
    marginPerHour: 0.15,      // 15% - Margen por hora
    billingEfficiency: 0.10   // 10% - Eficiencia de facturación
  },
  
  // Peso para el ranking unificado (balance eficiencia vs impacto)
  // OPCIONES PREDEFINIDAS:
  // Conservative: { impact: 0.30, efficiency: 0.70 } - Prioriza eficiencia individual
  // Balanced: { impact: 0.50, efficiency: 0.50 } - Balance 50/50
  // Strategic: { impact: 0.70, efficiency: 0.30 } - Prioriza impacto económico
  unifiedWeights: {
    impact: 0.50,             // 50% - Peso del impacto económico
    efficiency: 0.50          // 50% - Peso de la eficiencia pura
  },
  
  // Umbrales para semáforos (en escala 0-100)
  thresholds: {
    excellent: 70,    // Verde: > 70
    good: 50,         // Amarillo: 50-70  
    critical: 50      // Rojo: < 50
  }
};

export type RankingType = 'efficiency' | 'impact' | 'unified';

export interface PersonnelMetrics {
  personnelId: number;
  personnelName: string;
  
  // Datos base
  estimatedHours: number;
  actualHours: number;
  estimatedCost: number;
  actualCost: number;
  pricePercentage: number;  // Porcentaje del precio del proyecto que gestiona
  assignedPrice: number;    // Parte del precio que le corresponde
  
  // Métricas calculadas
  costDeviation: number;    // (estimado - real) / estimado
  hoursDeviation: number;   // (estimado - real) / estimado  
  marginPerHour: number;    // (precio asignado - costo real) / horas reales
  billingEfficiency: number; // precio asignado / costo real
  
  // Puntajes normalizados (0-100)
  efficiencyScore: number;
  impactScore: number;
  unifiedScore: number;
  
  // Ranking positions
  efficiencyRank: number;
  impactRank: number;
  unifiedRank: number;
  
  // Color para semáforo
  performanceColor: 'green' | 'yellow' | 'red';
}