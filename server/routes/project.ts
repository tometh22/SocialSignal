// routes/project.ts - GET /api/projects/:id/complete-data
// Usa el motor único computeProjectPeriodMetrics()

import { Router } from 'express';
import { computeProjectPeriodMetrics } from '../domain/metrics';
import { storage } from '../storage';

const router = Router();

/**
 * GET /api/projects/:id/complete-data
 * Proyecto completo con métricas unificadas
 * Usa el motor único para consistencia total
 */
router.get('/:id/complete-data', async (req, res) => {
  console.log(`🚀 UNIFIED COMPLETE DATA - Project ${req.params.id}, TimeFilter: ${req.query.timeFilter}, Basis: ${req.query.basis}`);
  
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
    
    // Get client info
    const client = project.clientId ? await storage.getClient(project.clientId) : null;

    const response = {
      project: {
        id: projectId,
        name: project.name,
        client: client?.name || 'Unknown',
        clientId: project.clientId,
        status: project.status
      },
      summary: {
        period: metrics.summary.period,
        basis: metrics.summary.basis,
        activeMembers: metrics.summary.activeMembers,
        totalHours: metrics.summary.totalHours,
        efficiencyPct: metrics.summary.efficiencyPct,
        teamCostUSD: metrics.summary.teamCostUSD,
        revenueUSD: metrics.summary.revenueUSD,
        markupUSD: metrics.summary.markupUSD,
        estimatedHours: project.estimatedHours || metrics.teamBreakdown.reduce((sum, p) => sum + p.targetHours, 0)
      },
      teamBreakdown: metrics.teamBreakdown,
      financials: {
        revenueUSD: metrics.summary.revenueUSD,
        costUSD: metrics.summary.teamCostUSD,
        profitUSD: metrics.summary.markupUSD,
        markupRatio: metrics.summary.revenueUSD > 0 ? metrics.summary.revenueUSD / metrics.summary.teamCostUSD : 0
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

    console.log(`✅ UNIFIED COMPLETE DATA: Project ${projectId}, Hours: ${metrics.summary.totalHours}, Cost: $${metrics.summary.teamCostUSD}, Revenue: $${metrics.summary.revenueUSD}`);
    
    res.json(response);

  } catch (error) {
    console.error("❌ Error in unified complete data:", error);
    res.status(500).json({ 
      message: "Failed to get unified complete data",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as projectRouter };