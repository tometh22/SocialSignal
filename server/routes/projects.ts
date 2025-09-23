/**
 * 🚀 Projects Routes - Refactored
 * Devolver portfolioSummary y projects[] con valores del período
 * Usa sistema ETL → domain → routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { resolvePeriod, getMonthKeysInPeriod } from '../utils/period';
import { aggregateWithPeriodFilter } from '../domain/aggregate';
import { processSales } from '../etl/sales';
import { processCosts } from '../etl/costs';

const router = Router();

// Schema de validación para query parameters
const projectsQuerySchema = z.object({
  periodType: z.enum(['month', 'quarter', 'custom']).default('month'),
  year: z.coerce.number().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  quarter: z.coerce.number().min(1).max(4).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  forceETL: z.enum(['true', 'false']).default('false'),
});

/**
 * 📊 GET /api/projects - Endpoint principal
 */
router.get('/', async (req, res) => {
  try {
    const query = projectsQuerySchema.parse(req.query);
    
    console.log('🎯 Projects endpoint called with:', query);
    
    // Si se solicita ETL forzado, ejecutar procesos
    if (query.forceETL === 'true') {
      console.log('🔄 Running forced ETL processes...');
      
      const salesResult = await processSales();
      const costsResult = await processCosts();
      
      console.log('📊 ETL Results:', {
        sales: { processed: salesResult.processed, normalized: salesResult.normalized },
        costs: { processed: costsResult.processed, normalized: costsResult.normalized }
      });
    }
    
    // Resolver período
    let period;
    try {
      if (query.periodType === 'custom') {
        if (!query.startDate || !query.endDate) {
          return res.status(400).json({
            error: 'Custom period requires startDate and endDate'
          });
        }
        
        period = {
          start: new Date(query.startDate),
          end: new Date(query.endDate),
          label: `${query.startDate} to ${query.endDate}`
        };
      } else {
        period = resolvePeriod(query.periodType, query.year, query.month, query.quarter);
      }
    } catch (error) {
      return res.status(400).json({
        error: `Invalid period parameters: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    
    // Obtener monthKeys para el período
    const monthKeys = getMonthKeysInPeriod(period);
    console.log('📅 Period resolved:', { period: period.label, monthKeys });
    
    // Ejecutar agregación
    const result = await aggregateWithPeriodFilter(monthKeys);
    
    // Formatear respuesta
    const response = {
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        label: period.label,
        monthKeys
      },
      portfolioSummary: result.summary,
      projects: result.projects.map(project => ({
        projectKey: project.projectKey,
        monthKey: project.monthKey,
        revenueUSD: project.revenueUSD,
        costUSD: project.costUSD,
        profitUSD: project.profitUSD,
        hoursWorked: project.hoursWorked,
        marginPercent: project.marginPercent,
        markupRatio: project.markupRatio
      })),
      metadata: {
        totalProjects: result.activeProjectKeys.length,
        activeProjectKeys: result.activeProjectKeys,
        queryTimestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Projects response generated:', {
      projectCount: response.projects.length,
      summaryRevenue: response.portfolioSummary.totalRevenueUSD,
      summaryProfit: response.portfolioSummary.totalProfitUSD
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error in projects endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 🔄 POST /api/projects/etl - Endpoint para ejecutar ETL manualmente
 */
router.post('/etl', async (req, res) => {
  try {
    console.log('🔄 Manual ETL process initiated...');
    
    // Ejecutar procesos ETL
    const salesResult = await processSales();
    const costsResult = await processCosts();
    
    const response = {
      success: true,
      results: {
        sales: {
          processed: salesResult.processed,
          normalized: salesResult.normalized,
          errors: salesResult.errors,
          anomalies: salesResult.anomalies
        },
        costs: {
          processed: costsResult.processed,
          normalized: costsResult.normalized,
          errors: costsResult.errors,
          anomalies: costsResult.anomalies
        }
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Manual ETL completed:', response.results);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error in ETL endpoint:', error);
    res.status(500).json({
      error: 'ETL process failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 📊 GET /api/projects/summary - Solo resumen del portfolio
 */
router.get('/summary', async (req, res) => {
  try {
    const query = projectsQuerySchema.parse(req.query);
    
    // Resolver período
    const period = resolvePeriod(query.periodType, query.year, query.month, query.quarter);
    const monthKeys = getMonthKeysInPeriod(period);
    
    // Solo obtener resumen
    const result = await aggregateWithPeriodFilter(monthKeys);
    
    res.json({
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        label: period.label,
        monthKeys
      },
      portfolioSummary: result.summary,
      metadata: {
        totalProjects: result.activeProjectKeys.length,
        queryTimestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in projects summary endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 📅 GET /api/projects/available-periods - Obtener períodos disponibles
 */
router.get('/available-periods', async (req, res) => {
  try {
    const { getAvailableMonthKeys } = await import('../domain/aggregate');
    const monthKeys = await getAvailableMonthKeys();
    
    // Convertir a años y meses únicos
    const years = new Set<number>();
    const months = new Set<string>();
    
    monthKeys.forEach(key => {
      const [year, month] = key.split('-');
      years.add(parseInt(year));
      months.add(key);
    });
    
    // Generar trimestres disponibles
    const quarters = new Set<string>();
    monthKeys.forEach(key => {
      const [year, month] = key.split('-');
      const monthNum = parseInt(month);
      const quarter = Math.ceil(monthNum / 3);
      quarters.add(`${year}-Q${quarter}`);
    });
    
    res.json({
      availableMonths: Array.from(months).sort(),
      availableYears: Array.from(years).sort(),
      availableQuarters: Array.from(quarters).sort(),
      dataRange: {
        earliest: monthKeys.length > 0 ? monthKeys.sort()[0] : null,
        latest: monthKeys.length > 0 ? monthKeys.sort().reverse()[0] : null
      }
    });
    
  } catch (error) {
    console.error('❌ Error in available periods endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as projectsRouter };