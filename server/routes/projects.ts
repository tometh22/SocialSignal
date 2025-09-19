// routes/projects.ts - GET /api/projects
// Usa el motor único computeProjectPeriodMetrics()

import { Router } from 'express';
import { computeProjectPeriodMetrics } from '../domain/metrics';
import { storage } from '../storage';

const router = Router();

/**
 * GET /api/projects
 * Listado de proyectos con métricas unificadas
 * Usa el motor único para consistencia total
 */
router.get('/', async (req, res) => {
  console.log(`🚀 UNIFIED PROJECTS LISTING - TimeFilter: ${req.query.timeFilter}`);
  
  try {
    const { timeFilter = 'current_month' } = req.query;
    
    // Get all active projects
    const allProjects = await storage.getActiveProjects();
    console.log(`📊 Processing ${allProjects.length} projects with unified motor`);
    
    // Process each project with unified motor
    const unifiedProjects = [];
    
    for (const project of allProjects) {
      try {
        // USAR MOTOR ÚNICO - garantiza consistencia total
        const metrics = await computeProjectPeriodMetrics(project.id, timeFilter as string);
        
        // Get client name
        const client = project.clientId ? await storage.getClient(project.clientId) : null;
        
        unifiedProjects.push({
          projectId: project.id,
          client: client?.name || 'Unknown',
          name: project.name,
          period: metrics.summary.period,
          basis: metrics.summary.basis,
          revenueUSD: metrics.summary.revenueUSD,
          teamCostUSD: metrics.summary.teamCostUSD,
          markupUSD: metrics.summary.markupUSD,
          hours: metrics.summary.totalHours,
          efficiencyPct: metrics.summary.efficiencyPct,
          hasData: { 
            "ingresos": metrics.ingresos.ingresos, 
            "costos": metrics.costos.costos 
          }
        });

      } catch (projectError) {
        console.error(`❌ Error processing project ${project.id}:`, projectError);
        // Continue with next project
      }
    }
    
    console.log(`✅ UNIFIED PROJECTS PROCESSED: ${unifiedProjects.length} projects with motor único`);
    
    res.json({
      projects: unifiedProjects,
      metadata: {
        timeFilter: timeFilter,
        engine: 'motor_unico_computeProjectPeriodMetrics',
        source: 'Excel_MAESTRO_unified'
      }
    });

  } catch (error) {
    console.error("❌ Error in unified projects listing:", error);
    res.status(500).json({ 
      message: "Failed to get unified projects listing",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as projectsRouter };