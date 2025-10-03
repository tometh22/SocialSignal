// routes/index.ts - Integración de todas las rutas del sistema universal
// MOTOR ÚNICO: Todas las rutas usan computeProjectPeriodMetrics()

import { Express } from 'express';
import { projectsRouter } from './projects';
import { projectRouter } from './project';
import { deviationRouter } from './deviation';
import { rankingsRouter } from './rankings';
import { completeDataHandler } from './complete-data';

/**
 * Integra todas las rutas del sistema universal
 * Todas usan el MOTOR ÚNICO computeProjectPeriodMetrics() para garantizar consistencia
 */
export function setupUniversalRoutes(app: Express, requireAuth: any) {
  // Aplicar middleware de autenticación
  app.use('/api/projects', requireAuth);
  
  // Integrar todas las rutas universales
  // app.use('/api/projects', projectsRouter);          // COMENTADO: Conflicto con handleProjectsRequest en línea 692 de routes.ts
  app.get('/api/projects/:id/complete-data', completeDataHandler);  // ÚNICA RUTA COMPLETE-DATA (fix quirúrgico)
  app.use('/api/projects', deviationRouter);         // GET /api/projects/:id/deviation-analysis  
  app.use('/api/projects', rankingsRouter);          // GET /api/projects/:id/performance-rankings

  console.log('🚀 UNIVERSAL ROUTES CONFIGURED:');
  console.log('   - GET /api/projects (usa handleProjectsRequest de routes.ts línea 692)');
  console.log('   - GET /api/projects/:id/complete-data (proyecto completo con motor único)');
  console.log('   - GET /api/projects/:id/deviation-analysis (análisis equipo con motor único)');
  console.log('   - GET /api/projects/:id/performance-rankings (rankings equipo con motor único)');
  console.log('   - TODAS las rutas usan computeProjectPeriodMetrics() para consistencia total');
}