// routes/deviation.ts - GET /api/projects/:id/deviation-analysis
// Usa el motor único computeProjectPeriodMetrics()

import { Router } from 'express';
import { computeProjectPeriodMetrics } from '../domain/metrics';
import { storage } from '../storage';

const router = Router();

/**
 * GET /api/projects/:id/deviation-analysis
 * Análisis de desviación del equipo con métricas unificadas
 * Usa el motor único para consistencia total
 */
router.get('/:id/deviation-analysis', async (req, res) => {
  console.log(`🚀 UNIFIED DEVIATION ANALYSIS - Project ${req.params.id}, TimeFilter: ${req.query.timeFilter}, Basis: ${req.query.basis}`);
  
  try {
    const projectId = parseInt(req.params.id);
    const { timeFilter = 'current_month', basis = 'ECON' } = req.query;
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await storage.getActiveProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // USAR MOTOR ÚNICO - garantiza consistencia total
    const metrics = await computeProjectPeriodMetrics(projectId, timeFilter as string, basis as 'ECON' | 'EXEC');
    
    // Calculate team deviations and severity
    const teamWithDeviations = metrics.teamBreakdown.map(member => ({
      ...member,
      deviationHours: member.actualHours - member.targetHours,
      deviationCost: member.actualCost - member.budgetCost,
      deviationPct: member.targetHours > 0 ? ((member.actualHours - member.targetHours) / member.targetHours) * 100 : 0,
      severity: member.severity,
      isOverBudget: member.actualCost > member.budgetCost,
      isOverHours: member.actualHours > member.targetHours
    }));

    const response = {
      project: {
        id: projectId,
        name: project.name
      },
      summary: {
        period: metrics.summary.period,
        basis: metrics.summary.basis,
        activeMembers: metrics.summary.activeMembers,
        totalHours: metrics.summary.totalHours,
        efficiencyPct: metrics.summary.efficiencyPct,
        teamCostUSD: metrics.summary.teamCostUSD,
        revenueUSD: metrics.summary.revenueUSD,
        markupUSD: metrics.summary.markupUSD
      },
      teamBreakdown: teamWithDeviations,
      deviationStats: {
        membersOverBudget: teamWithDeviations.filter(m => m.isOverBudget).length,
        membersOverHours: teamWithDeviations.filter(m => m.isOverHours).length,
        totalDeviationCost: teamWithDeviations.reduce((sum, m) => sum + Math.abs(m.deviationCost), 0),
        totalDeviationHours: teamWithDeviations.reduce((sum, m) => sum + Math.abs(m.deviationHours), 0),
        criticalMembers: teamWithDeviations.filter(m => m.severity === 'critical').length,
        warningMembers: teamWithDeviations.filter(m => m.severity === 'warning').length
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

    console.log(`✅ UNIFIED DEVIATION ANALYSIS: Project ${projectId}, ${metrics.summary.activeMembers} members, ${metrics.summary.efficiencyPct}% efficiency`);
    
    res.json(response);

  } catch (error) {
    console.error("❌ Error in unified deviation analysis:", error);
    res.status(500).json({ 
      message: "Failed to get unified deviation analysis",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as deviationRouter };