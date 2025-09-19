// routes/index.ts - Integración de todas las rutas del sistema universal
// MOTOR ÚNICO: Todas las rutas usan computeProjectPeriodMetrics()

import { Express } from 'express';
import { projectsRouter } from './projects';
import { projectRouter } from './project';
import { deviationRouter } from './deviation';
import { rankingsRouter } from './rankings';

/**
 * Integra todas las rutas del sistema universal
 * Todas usan el MOTOR ÚNICO computeProjectPeriodMetrics() para garantizar consistencia
 */
export function setupUniversalRoutes(app: Express, requireAuth: any) {
  // Aplicar middleware de autenticación
  app.use('/api/projects', requireAuth);
  
  // Integrar todas las rutas universales
  app.use('/api/projects', projectsRouter);          // GET /api/projects
  app.use('/api/projects', projectRouter);           // GET /api/projects/:id/complete-data
  app.use('/api/projects', deviationRouter);         // GET /api/projects/:id/deviation-analysis  
  app.use('/api/projects', rankingsRouter);          // GET /api/projects/:id/performance-rankings

  console.log('🚀 UNIVERSAL ROUTES CONFIGURED:');
  console.log('   - GET /api/projects (listado con motor único)');
  console.log('   - GET /api/projects/:id/complete-data (proyecto completo con motor único)');
  console.log('   - GET /api/projects/:id/deviation-analysis (análisis equipo con motor único)');
  console.log('   - GET /api/projects/:id/performance-rankings (rankings equipo con motor único)');
  console.log('   - TODAS las rutas usan computeProjectPeriodMetrics() para consistencia total');
}