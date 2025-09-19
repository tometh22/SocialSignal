// routes/rankings.ts - GET /api/projects/:id/performance-rankings
// Usa el motor único computeProjectPeriodMetrics()

import { Router } from 'express';
import { computeProjectPeriodMetrics } from '../domain/metrics';

const router = Router();

/**
 * GET /api/projects/:id/performance-rankings
 * Rankings de performance del equipo con métricas unificadas
 * Usa el motor único para consistencia total
 */
router.get('/:id/performance-rankings', async (req, res) => {
  console.log(`🚀 UNIFIED PERFORMANCE RANKINGS - Project ${req.params.id}, TimeFilter: ${req.query.timeFilter}, Basis: ${req.query.basis}`);
  
  try {
    const projectId = parseInt(req.params.id);
    const { timeFilter = 'current_month', basis = 'ECON' } = req.query;
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // USAR MOTOR ÚNICO - garantiza consistencia total
    const metrics = await computeProjectPeriodMetrics(projectId, timeFilter as string, basis as 'ECON' | 'EXEC');
    
    // Create performance rankings based on different metrics
    const performanceRankings = {
      byEfficiency: [...metrics.teamBreakdown]
        .filter(m => m.targetHours > 0) // Only rank members with target hours
        .sort((a, b) => b.efficiency - a.efficiency)
        .map((member, index) => ({ ...member, rank: index + 1, metric: 'efficiency' })),
        
      byCostEffectiveness: [...metrics.teamBreakdown]
        .filter(m => m.actualCost > 0) // Only rank members with actual costs
        .sort((a, b) => (a.actualCost / Math.max(a.actualHours, 1)) - (b.actualCost / Math.max(b.actualHours, 1))) // Cost per hour ascending
        .map((member, index) => ({ 
          ...member, 
          rank: index + 1, 
          metric: 'cost_effectiveness',
          costPerHour: member.actualCost / Math.max(member.actualHours, 1)
        })),
        
      byProductivity: [...metrics.teamBreakdown]
        .filter(m => m.actualHours > 0) // Only rank members with actual hours
        .sort((a, b) => b.actualHours - a.actualHours)
        .map((member, index) => ({ ...member, rank: index + 1, metric: 'productivity' })),
        
      byAccuracy: [...metrics.teamBreakdown]
        .filter(m => m.targetHours > 0) // Only rank members with targets
        .sort((a, b) => Math.abs(a.deviationHours) - Math.abs(b.deviationHours)) // Least deviation = most accurate
        .map((member, index) => ({ 
          ...member, 
          rank: index + 1, 
          metric: 'accuracy',
          accuracyScore: 100 - Math.min(100, Math.abs(member.deviationHours / member.targetHours * 100))
        }))
    };

    const response = {
      project: {
        id: projectId
      },
      summary: {
        period: metrics.summary.period,
        basis: metrics.summary.basis,
        activeMembers: metrics.summary.activeMembers,
        totalHours: metrics.summary.totalHours,
        efficiencyPct: metrics.summary.efficiencyPct,
        teamCostUSD: metrics.summary.teamCostUSD
      },
      rankings: performanceRankings,
      topPerformers: {
        efficiency: performanceRankings.byEfficiency[0] || null,
        costEffectiveness: performanceRankings.byCostEffectiveness[0] || null,
        productivity: performanceRankings.byProductivity[0] || null,
        accuracy: performanceRankings.byAccuracy[0] || null
      },
      ingresos: metrics.ingresos,
      costos: metrics.costos,
      metadata: {
        projectId,
        timeFilter,
        basis,
        engine: 'motor_unico_computeProjectPeriodMetrics',
        source: 'Excel_MAESTRO_unified'
      }
    };

    console.log(`✅ UNIFIED PERFORMANCE RANKINGS: Project ${projectId}, ${metrics.summary.activeMembers} members ranked`);
    
    res.json(response);

  } catch (error) {
    console.error("❌ Error in unified performance rankings:", error);
    res.status(500).json({ 
      message: "Failed to get unified performance rankings",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as rankingsRouter };