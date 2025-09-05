import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { z } from "zod";
import { 
  insertClientSchema, 
  insertRoleSchema, 
  insertPersonnelSchema, 
  insertReportTemplateSchema, 
  insertQuotationSchema,
  insertQuotationTeamMemberSchema,
  insertQuotationVariantSchema,
  insertTemplateRoleAssignmentSchema,
  insertActiveProjectSchema,
  insertTimeEntrySchema,
  insertProgressReportSchema,
  insertProjectComponentSchema,
  insertDeliverableSchema,
  insertClientModoCommentSchema,
  insertRecurringProjectTemplateSchema,
  insertRecurringTemplatePersonnelSchema,
  insertProjectCycleSchema,
  insertProjectBaseTeamSchema,
  insertQuickTimeEntrySchema,
  insertQuickTimeEntryDetailSchema,
  insertMonthlyInflationSchema,
  insertSystemConfigSchema,
  insertMonthlyHourAdjustmentSchema,
  insertProjectPriceAdjustmentSchema,
  insertIndirectCostCategorySchema,
  insertIndirectCostSchema,
  insertNonBillableHoursSchema,
  insertExchangeRateSchema,
  insertPersonnelHistoricalCostSchema,
  insertProjectMonthlySalesSchema,
  insertProjectFinancialTransactionSchema,
  insertGoogleSheetsSalesSchema,
  insertDirectCostSchema,

  forgotPasswordSchema,
  resetPasswordSchema,
  exchangeRateHistory,
  projectStatusOptions,
  trackingFrequencyOptions,
  deliverables,
  clientModoComments,
  activeProjects,
  quotations,
  quotationVariants,
  timeEntries,
  personnel,
  roles,
  recurringProjectTemplates,
  recurringTemplatePersonnel,
  projectCycles,
  projectBaseTeam,
  quickTimeEntries,
  quickTimeEntryDetails,
  monthlyInflation,
  systemConfig,
  indirectCostCategories,
  indirectCosts,
  nonBillableHours,
  personnelHistoricalCosts,
  projectPriceAdjustments,
  googleSheetsProjects,
  googleSheetsProjectBilling,
  googleSheetsSales,
  directCosts
} from "@shared/schema";
import { eq, and, isNull, desc, sql, asc, gte, lte, inArray } from "drizzle-orm";
import { reinitializeDatabase } from "./reinit-data";
import { setupAuth } from "./auth";
// Temporalmente deshabilitado: import { setupChat } from "./chat";
// import { googleSheetsService } from "./services/googleSheetsService"; // Temporalmente deshabilitado
import { googleSheetsServiceAlternative } from "./services/googleSheetsServiceAlternative";
import { googleSheetsSimpleService } from "./services/googleSheetsSimple";
import { googleSheetsFixedService } from "./services/googleSheetsFixed";
import { googleSheetsWorkingService } from "./services/googleSheetsWorking";
import { autoSyncService } from "./services/autoSyncService";

// Helper function to convert null values to undefined for Zod validation
function nullToUndefined(obj: any): any {
  if (obj === null) return undefined;
  if (Array.isArray(obj)) return obj.map(nullToUndefined);
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      result[key] = nullToUndefined(obj[key]);
    }
    return result;
  }
  return obj;
}

// Exported temporal filtering functions for consistency across endpoints
export function getDateRangeForFilter(filter: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (filter) {
    case 'current_month':
    case 'this-month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last_month':
    case 'last-month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'may_2025':
    case 'may':
    case 'mayo_2025':
    case 'mayo':
      startDate = new Date(2025, 4, 1); // Mayo 2025
      endDate = new Date(2025, 4, 31);
      break;
    case 'june_2025':
    case 'june':  
    case 'junio_2025':
    case 'junio':
      startDate = new Date(2025, 5, 1); // Junio 2025
      endDate = new Date(2025, 5, 30);
      break;
    case 'july_2025':
    case 'july':
    case 'julio_2025': 
    case 'julio':
      startDate = new Date(2025, 6, 1); // Julio 2025
      endDate = new Date(2025, 6, 31);
      break;
    case 'current_quarter':
    case 'this-quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
      endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      break;
    case 'last_quarter':
    case 'last-quarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
      startDate = new Date(quarterYear, adjustedQuarter * 3, 1);
      endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0);
      break;
    case 'current_semester':
    case 'this-semester':
      const currentSemester = Math.floor(now.getMonth() / 6);
      startDate = new Date(now.getFullYear(), currentSemester * 6, 1);
      endDate = new Date(now.getFullYear(), (currentSemester + 1) * 6, 0);
      break;
    case 'last_semester':
    case 'last-semester':
      const lastSemester = Math.floor(now.getMonth() / 6) - 1;
      const semesterYear = lastSemester < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedSemester = lastSemester < 0 ? 1 : lastSemester;
      startDate = new Date(semesterYear, adjustedSemester * 6, 1);
      endDate = new Date(semesterYear, (adjustedSemester + 1) * 6, 0);
      break;
    case 'current_year':
    case 'this-year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'q1':
    case 'q1_2025':
      startDate = new Date(now.getFullYear(), 0, 1); // Q1: Enero-Marzo
      endDate = new Date(now.getFullYear(), 2, 31);
      break;
    case 'q2':
    case 'q2_2025':
      startDate = new Date(now.getFullYear(), 3, 1); // Q2: Abril-Mayo-Junio
      endDate = new Date(now.getFullYear(), 5, 30);
      break;
    case 'q3':
    case 'q3_2025':
      startDate = new Date(now.getFullYear(), 6, 1); // Q3: Julio-Agosto-Septiembre
      endDate = new Date(now.getFullYear(), 8, 30);
      break;
    case 'q4':
    case 'q4_2025':
      startDate = new Date(now.getFullYear(), 9, 1); // Q4: Octubre-Noviembre-Diciembre
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'huggies_period':
    case 'mayo_julio_2025':
      // Período específico para proyectos como Huggies: Mayo-Julio 2025
      startDate = new Date(2025, 4, 1); // Mayo 2025
      endDate = new Date(2025, 6, 31);  // Julio 2025
      break;
    case 'all':
      return null; // Sin filtro temporal - mostrar todo
    default:
      // Soporte para rangos de fechas personalizados: "YYYY-MM-DD_to_YYYY-MM-DD"
      if (filter.includes('_to_')) {
        const [startStr, endStr] = filter.split('_to_');
        const customStartDate = new Date(startStr);
        const customEndDate = new Date(endStr);
        
        if (!isNaN(customStartDate.getTime()) && !isNaN(customEndDate.getTime())) {
          startDate = customStartDate;
          endDate = customEndDate;
          break;
        }
      }
      
      // Soporte para meses específicos: "mayo_2025", "june_2025", etc.
      const monthMatch = filter.match(/^([a-z]+)_(\d{4})$/i);
      if (monthMatch) {
        const [, monthName, year] = monthMatch;
        const monthNames = {
          'enero': 0, 'january': 0, 'jan': 0,
          'febrero': 1, 'february': 1, 'feb': 1,
          'marzo': 2, 'march': 2, 'mar': 2,
          'abril': 3, 'april': 3, 'apr': 3,
          'mayo': 4, 'may': 4,
          'junio': 5, 'june': 5, 'jun': 5,
          'julio': 6, 'july': 6, 'jul': 6,
          'agosto': 7, 'august': 7, 'aug': 7,
          'septiembre': 8, 'september': 8, 'sep': 8,
          'octubre': 9, 'october': 9, 'oct': 9,
          'noviembre': 10, 'november': 10, 'nov': 10,
          'diciembre': 11, 'december': 11, 'dec': 11
        };
        
        const monthIndex = monthNames[monthName.toLowerCase()];
        if (monthIndex !== undefined) {
          startDate = new Date(parseInt(year), monthIndex, 1);
          endDate = new Date(parseInt(year), monthIndex + 1, 0);
          break;
        }
      }
      
      // Soporte para bimestres: "bimestre_1_2025", "bimestre_2_2025", etc.
      const bimestreMatch = filter.match(/^bimestre_(\d)_(\d{4})$/i);
      if (bimestreMatch) {
        const [, bimestreNum, year] = bimestreMatch;
        const bimestre = parseInt(bimestreNum);
        if (bimestre >= 1 && bimestre <= 6) {
          const startMonth = (bimestre - 1) * 2;
          startDate = new Date(parseInt(year), startMonth, 1);
          endDate = new Date(parseInt(year), startMonth + 2, 0);
          break;
        }
      }
      
      // Soporte para trimestres específicos de años: "q1_2024", "q2_2023", etc.
      const quarterYearMatch = filter.match(/^q(\d)_(\d{4})$/i);
      if (quarterYearMatch) {
        const [, quarterNum, year] = quarterYearMatch;
        const quarter = parseInt(quarterNum);
        if (quarter >= 1 && quarter <= 4) {
          const startMonth = (quarter - 1) * 3;
          startDate = new Date(parseInt(year), startMonth, 1);
          endDate = new Date(parseInt(year), startMonth + 3, 0);
          break;
        }
      }
      
      // Soporte para semestres: "semestre_1_2025", "semestre_2_2025"
      const semestreMatch = filter.match(/^semestre_(\d)_(\d{4})$/i);
      if (semestreMatch) {
        const [, semestreNum, year] = semestreMatch;
        const semestre = parseInt(semestreNum);
        if (semestre === 1) {
          startDate = new Date(parseInt(year), 0, 1); // Enero
          endDate = new Date(parseInt(year), 5, 30); // Junio
          break;
        } else if (semestre === 2) {
          startDate = new Date(parseInt(year), 6, 1); // Julio
          endDate = new Date(parseInt(year), 11, 31); // Diciembre
          break;
        }
      }
      
      // Soporte para períodos de múltiples meses: "ene_mar_2025", "jul_sep_2025", etc.
      const multiMonthMatch = filter.match(/^([a-z]{3})_([a-z]{3})_(\d{4})$/i);
      if (multiMonthMatch) {
        const [, startMonthName, endMonthName, year] = multiMonthMatch;
        const shortMonthNames = {
          'ene': 0, 'jan': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'apr': 3,
          'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'aug': 7,
          'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11, 'dec': 11
        };
        
        const startMonthIndex = shortMonthNames[startMonthName.toLowerCase()];
        const endMonthIndex = shortMonthNames[endMonthName.toLowerCase()];
        
        if (startMonthIndex !== undefined && endMonthIndex !== undefined) {
          startDate = new Date(parseInt(year), startMonthIndex, 1);
          endDate = new Date(parseInt(year), endMonthIndex + 1, 0);
          break;
        }
      }
      
      // Soporte para años completos: "año_2024", "year_2025", etc.
      const yearMatch = filter.match(/^(año|year)_(\d{4})$/i);
      if (yearMatch) {
        const [, , year] = yearMatch;
        startDate = new Date(parseInt(year), 0, 1);
        endDate = new Date(parseInt(year), 11, 31);
        break;
      }
      
      // Soporte para últimos N meses: "ultimos_3_meses", "last_6_months"
      const lastMonthsMatch = filter.match(/^(ultimos|last)_(\d+)_(meses|months)$/i);
      if (lastMonthsMatch) {
        const [, , monthsCount] = lastMonthsMatch;
        const months = parseInt(monthsCount);
        endDate = new Date();
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        startDate.setDate(1); // Primer día del mes
        break;
      }
      
      // Soporte para días específicos: "ultimos_30_dias", "last_90_days"
      const lastDaysMatch = filter.match(/^(ultimos|last)_(\d+)_(dias|days)$/i);
      if (lastDaysMatch) {
        const [, , daysCount] = lastDaysMatch;
        const days = parseInt(daysCount);
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        break;
      }
      
      // Para filtros no reconocidos
      console.log(`⚠️ Filtro temporal no reconocido: ${filter}`);
      return null;
  }

  // Asegurar que startDate y endDate son objetos Date válidos
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    console.warn(`⚠️ Invalid startDate for filter ${filter}, using fallback`);
    startDate = new Date(2020, 0, 1);
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    console.warn(`⚠️ Invalid endDate for filter ${filter}, using fallback`);
    endDate = new Date(2030, 11, 31);
  }
  
  console.log(`📅 Date range for filter ${filter}:`, startDate.toISOString(), 'to', endDate.toISOString());
  return { startDate, endDate };
}

export function getMonthsInFilter(filter: string): number {
  switch (filter) {
    // Filtros mensuales
    case 'este_mes':
    case 'mes_pasado':
    case 'current_month':
    case 'last_month':
    case 'this-month':
    case 'last-month':
    case 'may_2025':
    case 'june_2025':
    case 'julio_2025':
    case 'mayo_2025':
    case 'junio_2025':
      return 1;
    
    // Filtros trimestrales
    case 'este_trimestre':
    case 'trimestre_pasado':
    case 'current_quarter':
    case 'last_quarter':
    case 'this-quarter':
    case 'last-quarter':
    case 'q1':
    case 'q2':
    case 'q3':
    case 'q4':
    case 'q1_2025':
    case 'q2_2025':
    case 'q3_2025':
    case 'q4_2025':
      return 3;
    
    // Filtros semestrales
    case 'este_semestre':
    case 'semestre_pasado':
    case 'current_semester':
    case 'last_semester':
    case 'this-semester':
    case 'last-semester':
      return 6;
    
    // Filtros anuales
    case 'este_año':
    case 'current_year':
    case 'this-year':
      return 12;
    
    default:
      return 1;
  }
}
import { upload, deleteOldFile } from "./upload";
import { sanitizeInput } from "./input-sanitization";
import path from 'path';

export async function registerRoutes(app: Express): Promise<Server> {
  // Create the HTTP server
  const httpServer = createServer(app);

  // Setup authentication with storage
  const { requireAuth } = setupAuth(app, storage);

  // Apply input sanitization to all routes
  app.use(sanitizeInput);

  // Debug middleware para todas las rutas de proyectos
  app.use('/api/projects', (req, res, next) => {
    console.log(`🌟 PROJECT API CALL: ${req.method} ${req.url}`);
    next();
  });

  // TEST ENDPOINT DIRECTO - JUSTO DESPUÉS DEL MIDDLEWARE DE DEBUG
  app.get('/api/projects/:id/test-simple', (req, res) => {
    console.log(`🔥🔥🔥 SIMPLE TEST ENDPOINT HIT - ID: ${req.params.id}`);
    res.json({ 
      message: 'Test endpoint working', 
      id: req.params.id, 
      query: req.query,
      timestamp: new Date().toISOString()
    });
  });

  // TEMPORARY FORCE SYNC ENDPOINT
  app.get('/api/debug/force-sync', async (req, res) => {
    try {
      console.log('🚀 Force sync triggered via debug endpoint');
      
      const { GoogleSheetsWorkingService } = await import('./services/googleSheetsWorking');
      const googleSheetsService = new GoogleSheetsWorkingService();
      
      const result = await googleSheetsService.importDirectCosts(storage);
      
      res.json({ 
        success: true, 
        message: 'Direct costs sync completed',
        result: result
      });
    } catch (error: any) {
      console.error('❌ Force sync failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Debug endpoint - Verificar mapeo de costos directos 
  app.get('/api/debug/costs-mapping/:projectId', requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    console.log(`🔍 DEBUG - Verificando mapeo de costos para proyecto ${projectId}`);
    
    try {
      // Obtener costos directos de la base
      const directCosts = await storage.getDirectCostsByProject(projectId);
      console.log(`📊 Total costos en base: ${directCosts?.length || 0}`);
      
      // Mostrar estructura de los primeros registros
      const sample = directCosts?.slice(0, 5) || [];
      console.log(`📋 Muestra de datos completos:`, sample);
      
      res.json({
        projectId,
        totalCosts: directCosts?.length || 0,
        allCosts: directCosts || [],
        sampleData: sample,
        summary: {
          hasUSDAmounts: directCosts?.filter(c => c.montoTotalUsd && c.montoTotalUsd > 0).length || 0,
          hasARSAmounts: directCosts?.filter(c => c.costoTotal && c.costoTotal > 0).length || 0,
          hasHours: directCosts?.filter(c => c.horasRealesAsana && c.horasRealesAsana > 0).length || 0
        }
      });
    } catch (error) {
      console.error('❌ Error en debug de costos:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint para investigar discrepancia de costos
  app.get('/api/debug/costs-filtered/:projectId', requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    const timeFilter = req.query.timeFilter as string || '2025-05-01_to_2025-08-31';
    
    try {
      console.log(`🔍 DEBUG COSTOS FILTRADOS - Proyecto ${projectId}, Filtro: ${timeFilter}`);
      
      // Obtener todos los costos sin filtro
      const allCosts = await storage.getDirectCostsByProject(projectId);
      console.log(`📊 Total costos en base: ${allCosts?.length || 0}`);
      
      // Aplicar filtro temporal
      const dateRange = parseTimeFilter(timeFilter);
      const filteredCosts = allCosts?.filter(cost => {
        const costDate = new Date(cost.año, getMonthNumber(cost.mes) - 1, 1);
        const inRange = costDate >= dateRange.startDate && costDate <= dateRange.endDate;
        
        console.log(`💰 Costo: ${cost.nombre} - ${cost.mes} ${cost.año} = $${cost.montoTotalUsd} USD, En rango: ${inRange}`);
        return inRange;
      }) || [];
      
      // Calcular totales
      const totalUSD = filteredCosts.reduce((sum, cost) => sum + (parseFloat(cost.montoTotalUsd as string) || 0), 0);
      const totalARS = filteredCosts.reduce((sum, cost) => sum + (parseFloat(cost.costoTotal as string) || 0), 0);
      
      console.log(`💰 RESULTADO: ${filteredCosts.length} costos filtrados = $${totalUSD} USD`);
      
      res.json({
        projectId,
        timeFilter,
        dateRange: {
          start: dateRange.startDate.toISOString(),
          end: dateRange.endDate.toISOString()
        },
        allCosts: allCosts?.length || 0,
        filteredCosts: filteredCosts.length,
        totals: {
          usd: totalUSD,
          ars: totalARS
        },
        detailedCosts: filteredCosts.map(cost => ({
          nombre: cost.nombre,
          mes: cost.mes,
          año: cost.año,
          montoUSD: cost.montoTotalUsd,
          montoARS: cost.costoTotal,
          tipo: cost.tipoGasto
        }))
      });
    } catch (error) {
      console.error('❌ Error en debug de costos filtrados:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Función auxiliar para filtrar ventas de Google Sheets por período temporal
  const getFilteredGoogleSheetsSales = async (projectId: number, timeFilter: string, dateRange: any) => {
    try {
      console.log(`🔍 Getting sales for project ${projectId}...`);
      // Obtener todas las ventas del proyecto
      const allSales = await storage.getGoogleSheetsSalesByProject(projectId);
      
      console.log(`🔍 Retrieved ${allSales ? allSales.length : 0} sales from storage for project ${projectId}`);
      console.log(`🔍 Sample sales data:`, allSales?.slice(0, 2));
      
      if (!allSales || allSales.length === 0) {
        console.log(`⚠️ No sales data found for project ${projectId}`);
        return [];
      }
      
      // Si es 'all', retornar todas las ventas
      if (timeFilter === 'all') {
        console.log(`🔍 Returning all ${allSales.length} sales (filter: all)`);
        return allSales;
      }
      
      // Filtrar por fechas según el período temporal
      const filteredSales = allSales.filter(sale => {
        // Crear fecha del primer día del mes de la venta usando getMonthNumber
        const monthNum = getMonthNumber(sale.month);
        const saleDate = new Date(sale.year, monthNum - 1, 1);
        
        console.log(`🗓️ Sale: ${sale.month} ${sale.year} → Month ${monthNum} → Date ${saleDate.toISOString()}`);
        console.log(`🗓️ Filter range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`);
        console.log(`🗓️ Sale in range? ${saleDate >= dateRange.startDate && saleDate <= dateRange.endDate}`);
        
        // Comparar con el rango de fechas del filtro
        return saleDate >= dateRange.startDate && saleDate <= dateRange.endDate;
      });
      
      console.log(`📊 Ventas filtradas para proyecto ${projectId} (${timeFilter}): ${filteredSales.length} de ${allSales.length} ventas`);
      
      return filteredSales;
    } catch (error) {
      console.error(`❌ Error filtrando ventas para proyecto ${projectId}:`, error);
      return [];
    }
  };

  const getFilteredDirectCosts = async (projectId: number, timeFilter: string, dateRange: any) => {
    try {
      console.log(`💰 Getting direct costs for project ${projectId}...`);
      // Obtener todos los costos directos del proyecto
      const allDirectCosts = await storage.getDirectCostsByProject(projectId);
      
      console.log(`💰 Retrieved ${allDirectCosts ? allDirectCosts.length : 0} direct costs from storage for project ${projectId}`);
      console.log(`💰 Sample direct costs data:`, allDirectCosts?.slice(0, 2));
      
      if (!allDirectCosts || allDirectCosts.length === 0) {
        console.log(`⚠️ No direct costs data found for project ${projectId}`);
        return [];
      }
      
      // Si es 'all', retornar todos los costos directos
      if (timeFilter === 'all') {
        console.log(`💰 Returning all ${allDirectCosts.length} direct costs (filter: all)`);
        return allDirectCosts;
      }
      
      // Filtrar por fechas según el período temporal
      const filteredDirectCosts = allDirectCosts.filter(cost => {
        // Crear fecha del primer día del mes del costo
        const costDate = new Date(cost.año, getMonthNumber(cost.mes) - 1, 1);
        
        // Comparar con el rango de fechas del filtro
        return costDate >= dateRange.startDate && costDate <= dateRange.endDate;
      });
      
      console.log(`💰 Costos directos filtrados para proyecto ${projectId} (${timeFilter}): ${filteredDirectCosts.length} de ${allDirectCosts.length} costos`);
      
      return filteredDirectCosts;
    } catch (error) {
      console.error(`❌ Error filtrando costos directos para proyecto ${projectId}:`, error);
      return [];
    }
  };

  // Helper function for month name to number conversion
  const getMonthNumber = (monthName: string): number => {
    const monthMap: Record<string, number> = {
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
      'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
      'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
      '01 ene': 1, '02 feb': 2, '03 mar': 3, '04 abr': 4,
      '05 may': 5, '06 jun': 6, '07 jul': 7, '08 ago': 8,
      '09 sep': 9, '10 oct': 10, '11 nov': 11, '12 dic': 12
    };
    
    return monthMap[monthName.toLowerCase()] || 1;
  };


  // SINGLE SOURCE OF TRUTH - ENDPOINT CONSOLIDADO CON FILTROS TEMPORALES
  app.get('/api/projects/:id/complete-data', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const timeFilter = req.query.timeFilter as string || 'all';
    console.log(`🔥🔥🔥 COMPLETE DATA ENDPOINT HIT - ID: ${id}, Filter: ${timeFilter}`);
    
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      console.log(`📊 Getting complete data for project ${id} with filter: ${timeFilter}`);
      
      // 1. Obtener datos base del proyecto
      const project = await storage.getActiveProject(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // 2. Obtener datos de la cotización (FUENTE ÚNICA para horas estimadas)
      let quotationTeam: any[] = [];
      let estimatedHours = 0;
      let baseCost = 0;
      let totalAmount = 0;
      
      if (project.quotation) {
        quotationTeam = await storage.getQuotationTeamMembers(project.quotation.id);
        estimatedHours = quotationTeam.reduce((total, member) => total + (member.hours || 0), 0);
        baseCost = project.quotation.baseCost || 0;
        totalAmount = project.quotation.totalAmount || 0;
        
        console.log(`📊 Quotation team for project ${id}:`, quotationTeam.length, 'members');
        console.log(`📊 Total estimated hours from quotation:`, estimatedHours);
      }

      // 2.5. Obtener ajustes de horas mensuales
      const monthlyHourAdjustments = await storage.getMonthlyHourAdjustments(id);
      console.log(`📊 Monthly hour adjustments for project ${id}:`, monthlyHourAdjustments.length, 'adjustments');

      // 2.6. Obtener información de personnel y roles para mapeo correcto
      const allPersonnel = await storage.getPersonnel();
      const allRoles = await storage.getRoles();
      console.log(`👥 Retrieved ${allPersonnel.length} personnel and ${allRoles.length} roles for role mapping`);

      // Helper function para obtener el rol real de una persona
      const getRoleForPerson = (personnelId: number | null, personName: string): string => {
        if (!personnelId) {
          // Para personas del Excel MAESTRO sin personnelId, buscar por nombre exacto
          const matchedPersonnel = allPersonnel.find(p => p.name === personName);
          if (matchedPersonnel) {
            const role = allRoles.find(r => r.id === matchedPersonnel.roleId);
            return role?.name || 'Sin Rol';
          }
          return 'Freelancer Excel'; // Para external del Excel MAESTRO
        } else {
          // Para personnel con ID, buscar directamente
          const personnel = allPersonnel.find(p => p.id === personnelId);
          if (personnel) {
            const role = allRoles.find(r => r.id === personnel.roleId);
            return role?.name || 'Sin Rol';
          }
          return 'Sin Rol';
        }
      };

      // Función para obtener horas estimadas ajustadas por mes/año
      const getAdjustedHours = (personnelId: number, originalHours: number, targetYear?: number, targetMonth?: number) => {
        if (!targetYear || !targetMonth) return originalHours;
        
        const adjustment = monthlyHourAdjustments.find(adj => 
          adj.personnelId === personnelId && 
          adj.year === targetYear && 
          adj.month === targetMonth
        );
        
        if (adjustment) {
          console.log(`📊 Found hour adjustment for personnel ${personnelId} (${adjustment.reason}): ${originalHours}h → ${adjustment.adjustedHours}h`);
          return adjustment.adjustedHours;
        }
        
        return originalHours;
      };

      // Función para calcular horas estimadas totales para un rango de fechas con ajustes mensuales
      const getAdjustedHoursForDateRange = (personnelId: number, originalMonthlyHours: number, startDate: Date, endDate: Date) => {
        let totalAdjustedHours = 0;
        
        // Crear lista de meses en el rango
        const months = [];
        const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        
        while (current <= end) {
          months.push({
            year: current.getFullYear(),
            month: current.getMonth() + 1 // getMonth() returns 0-11, pero los ajustes usan 1-12
          });
          current.setMonth(current.getMonth() + 1);
        }
        
        // Aplicar ajustes para cada mes en el rango
        for (const monthData of months) {
          // Para cada mes, usar las horas base mensuales de la cotización y aplicar ajustes específicos
          const monthlyHours = getAdjustedHours(personnelId, originalMonthlyHours, monthData.year, monthData.month);
          totalAdjustedHours += monthlyHours;
          
          console.log(`📊 Month ${monthData.year}/${monthData.month}: ${originalMonthlyHours}h → ${monthlyHours}h for personnel ${personnelId}`);
        }
        
        console.log(`📊 Total adjusted hours for personnel ${personnelId} over ${months.length} months: ${totalAdjustedHours}h`);
        return totalAdjustedHours;
      };

      // 3. Función para aplicar filtros temporales
      // NOTA: Esta función ahora está exportada al principio del archivo
      const getDateRangeForFilterLocal = (filter: string) => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;

        switch (filter) {
          case 'current_month':
          case 'this-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
          case 'last_month':
          case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
          case 'may_2025':
            startDate = new Date(2025, 4, 1); // Mayo 2025
            endDate = new Date(2025, 4, 31);
            break;
          case 'june_2025':
            startDate = new Date(2025, 5, 1); // Junio 2025
            endDate = new Date(2025, 5, 30);
            break;
          case 'july_2025':
            startDate = new Date(2025, 6, 1); // Julio 2025
            endDate = new Date(2025, 6, 31);
            break;
          case 'current_quarter':
          case 'this-quarter':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
            break;
          case 'last_quarter':
          case 'last-quarter':
            const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
            const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
            const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
            startDate = new Date(quarterYear, adjustedQuarter * 3, 1);
            endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0);
            break;
          case 'current_semester':
          case 'this-semester':
            const currentSemester = Math.floor(now.getMonth() / 6);
            startDate = new Date(now.getFullYear(), currentSemester * 6, 1);
            endDate = new Date(now.getFullYear(), (currentSemester + 1) * 6, 0);
            break;
          case 'last_semester':
          case 'last-semester':
            const lastSemester = Math.floor(now.getMonth() / 6) - 1;
            const semesterYear = lastSemester < 0 ? now.getFullYear() - 1 : now.getFullYear();
            const adjustedSemester = lastSemester < 0 ? 1 : lastSemester;
            startDate = new Date(semesterYear, adjustedSemester * 6, 1);
            endDate = new Date(semesterYear, (adjustedSemester + 1) * 6, 0);
            break;
          case 'current_year':
          case 'this-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
          case 'last_year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
            break;
          case 'q1':
          case 'q1_2025':
            startDate = new Date(now.getFullYear(), 0, 1); // Q1: Enero-Marzo del año actual
            endDate = new Date(now.getFullYear(), 2, 31);
            break;
          case 'q2':
          case 'q2_2025':
            startDate = new Date(now.getFullYear(), 3, 1); // Q2: Abril-Junio del año actual
            endDate = new Date(now.getFullYear(), 5, 30);
            break;
          case 'q3':
          case 'q3_2025':
            startDate = new Date(now.getFullYear(), 6, 1); // Q3: Julio-Septiembre del año actual
            endDate = new Date(now.getFullYear(), 8, 30);
            break;
          case 'q4':
          case 'q4_2025':
            startDate = new Date(now.getFullYear(), 9, 1); // Q4: Octubre-Diciembre del año actual
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
          case 'semester1_2025':
            startDate = new Date(2025, 0, 1); // Primer semestre 2025
            endDate = new Date(2025, 5, 30);
            break;
          case 'semester2_2025':
            startDate = new Date(2025, 6, 1); // Segundo semestre 2025
            endDate = new Date(2025, 11, 31);
            break;
          case 'year_2025':
            startDate = new Date(2025, 0, 1); // Todo el año 2025
            endDate = new Date(2025, 11, 31);
            break;
          // Meses específicos de 2025
          case 'january_2025':
            startDate = new Date(2025, 0, 1);
            endDate = new Date(2025, 0, 31);
            break;
          case 'february_2025':
            startDate = new Date(2025, 1, 1);
            endDate = new Date(2025, 1, 28);
            break;
          case 'march_2025':
            startDate = new Date(2025, 2, 1);
            endDate = new Date(2025, 2, 31);
            break;
          case 'april_2025':
            startDate = new Date(2025, 3, 1);
            endDate = new Date(2025, 3, 30);
            break;
          case 'august_2025':
            startDate = new Date(2025, 7, 1);
            endDate = new Date(2025, 7, 31);
            break;
          case 'september_2025':
            startDate = new Date(2025, 8, 1);
            endDate = new Date(2025, 8, 30);
            break;
          case 'october_2025':
            startDate = new Date(2025, 9, 1);
            endDate = new Date(2025, 9, 31);
            break;
          case 'november_2025':
            startDate = new Date(2025, 10, 1);
            endDate = new Date(2025, 10, 30);
            break;
          case 'december_2025':
            startDate = new Date(2025, 11, 1);
            endDate = new Date(2025, 11, 31);
            break;
          // Meses del año actual (sin especificar año)
          case 'january':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 0, 31);
            break;
          case 'february':
            startDate = new Date(now.getFullYear(), 1, 1);
            endDate = new Date(now.getFullYear(), 1, 28); // Simplificado, no considera años bisiestos
            break;
          case 'march':
            startDate = new Date(now.getFullYear(), 2, 1);
            endDate = new Date(now.getFullYear(), 2, 31);
            break;
          case 'april':
            startDate = new Date(now.getFullYear(), 3, 1);
            endDate = new Date(now.getFullYear(), 3, 30);
            break;
          case 'may':
            startDate = new Date(now.getFullYear(), 4, 1);
            endDate = new Date(now.getFullYear(), 4, 31);
            break;
          case 'june':
            startDate = new Date(now.getFullYear(), 5, 1);
            endDate = new Date(now.getFullYear(), 5, 30);
            break;
          case 'july':
            startDate = new Date(now.getFullYear(), 6, 1);
            endDate = new Date(now.getFullYear(), 6, 31);
            break;
          case 'august':
            startDate = new Date(now.getFullYear(), 7, 1);
            endDate = new Date(now.getFullYear(), 7, 31);
            break;
          case 'september':
            startDate = new Date(now.getFullYear(), 8, 1);
            endDate = new Date(now.getFullYear(), 8, 30);
            break;
          case 'october':
            startDate = new Date(now.getFullYear(), 9, 1);
            endDate = new Date(now.getFullYear(), 9, 31);
            break;
          case 'november':
            startDate = new Date(now.getFullYear(), 10, 1);
            endDate = new Date(now.getFullYear(), 10, 30);
            break;
          case 'december':
            startDate = new Date(now.getFullYear(), 11, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
          case 'all':
            return null; // Sin filtro temporal - mostrar todo
          default:
            // Para filtros personalizados o no reconocidos
            return null;
        }

        console.log(`📅 Date range for filter ${filter}:`, startDate.toISOString(), 'to', endDate.toISOString());
        return { startDate, endDate };
      };

      // 4. Obtener tiempo trabajado real con filtros
      let timeEntries = await storage.getTimeEntriesByProject(id);
      
      // Aplicar filtro temporal si está especificado (usando la función exportada)
      console.log(`🔍 DEBUG: Calling getDateRangeForFilter with timeFilter: "${timeFilter}"`);
      const dateRange = getDateRangeForFilter(timeFilter);
      console.log(`🔍 DEBUG: getDateRangeForFilter returned:`, dateRange);
      if (dateRange) {
        timeEntries = timeEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
        });
        console.log(`📊 Filtered time entries for project ${id}:`, timeEntries.length, 'entries (from', dateRange.startDate.toISOString(), 'to', dateRange.endDate.toISOString(), ')');
      }

      // 💰 NUEVA INTEGRACIÓN: Usar getProjectCostSummary con filtros temporales para obtener horas y costos integrados
      console.log(`📊 Getting integrated cost summary for project ${id} with time filter: ${timeFilter}`);
      
      const costSummary = await storage.getProjectCostSummary(id, dateRange || undefined);
      console.log(`📊 Cost summary received:`, {
        totalWorkedHours: costSummary?.totalWorkedHours || 0,
        totalWorkedCost: costSummary?.totalCost || 0,
        directCostsFromExcel: costSummary?.costBreakdown?.directCostsFromExcel || 0,
        timeEntriesCost: costSummary?.costBreakdown?.timeEntriesCost || 0,
        dateRangeApplied: dateRange ? `${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}` : 'NO_FILTER'
      });

      // Usar datos integrados (incluye time entries + Excel MAESTRO)
      const totalWorkedHours = costSummary?.totalWorkedHours || timeEntries.reduce((total, entry) => total + (entry.hours || 0), 0);
      const totalWorkedCost = costSummary?.totalCost || 0;

      // Mantener backward compatibility para directCosts
      const projectDirectCosts = await getFilteredDirectCosts(id, timeFilter, dateRange);
      
      // 💰 NUEVA INTEGRACIÓN: Generar team breakdown desde cost summary integrado (incluye Excel MAESTRO)
      const teamBreakdown: { [personnelId: string]: any } = {};
      
      // Usar las personas y costos del cost summary que ya incluye Excel MAESTRO
      if (costSummary?.costByPerson && costSummary.costByPerson.length > 0) {
        console.log(`📊 Using integrated team data from cost summary: ${costSummary.costByPerson.length} members`);
        console.log(`🔍 Sample costByPerson data:`, costSummary.costByPerson.slice(0, 3));
        console.log(`🔍 DEBUG: costByPerson full for project ${id}:`, JSON.stringify(costSummary.costByPerson, null, 2));
        
        for (const personCost of costSummary.costByPerson) {
          const personnelId = personCost.personnelId || `excel-${personCost.name?.replace(/\s+/g, '_').toLowerCase()}`;
          
          // Evitar duplicaciones: verificar si ya existe
          if (teamBreakdown[personnelId]) {
            console.log(`⚠️ Evitando duplicación para personnelId: ${personnelId}, name: ${personCost.name}`);
            continue;
          }
          
          // Buscar datos estimados de la cotización si existe
          const quotationMember = quotationTeam.find(m => m.personnelId === personCost.personnelId);
          let estimatedHours = quotationMember ? quotationMember.hours : 0;
          const isQuoted = quotationMember !== undefined;
          
          // Usar role real de su perfil o del Excel MAESTRO
          let actualRole = getRoleForPerson(personCost.personnelId, personCost.name);
          let actualRate = quotationMember?.rate || 0;
          
          teamBreakdown[personnelId] = {
            personnelId: personCost.personnelId,
            name: personCost.name,
            role: actualRole,
            email: '',
            estimatedHours: estimatedHours,
            actualHours: personCost.hours || 0, // Horas del Excel MAESTRO integradas
            actualCost: personCost.realCost || personCost.operationalCost || 0,
            hours: personCost.hours || 0, // CORRECCIÓN: Usar también 'hours' para compatibilidad con filtros
            cost: personCost.realCost || personCost.operationalCost || 0, // CORRECCIÓN: Usar también 'cost'
            rate: actualRate,
            efficiency: estimatedHours > 0 ? Math.round(((personCost.hours || 0) / estimatedHours) * 100) : 0,
            isQuoted: isQuoted,
            contractType: personCost.contractType || 'external',
            isFromExcel: !personCost.personnelId, // Marcador para entries del Excel
            targetHours: personCost.targetHours || null // NUEVO: Horas objetivo del Excel MAESTRO
          };
        }
      } else {
        // Fallback: usar time entries tradicionales si no hay cost summary
        console.log(`📊 Fallback: Using traditional time entries: ${timeEntries.length} entries`);
        console.log(`📊 DEBUG: costSummary is null or empty - costSummary:`, !!costSummary, 'costByPerson length:', costSummary?.costByPerson?.length || 0);
        for (const entry of timeEntries) {
          const personnelId = entry.personnelId.toString();
          if (!teamBreakdown[personnelId]) {
            // Find estimated hours for this personnel from quotation team
            const quotationMember = quotationTeam.find(m => m.personnelId === entry.personnelId);
            let estimatedHours = quotationMember ? quotationMember.hours : 0;
            const isQuoted = quotationMember !== undefined;
            
            // Aplicar ajustes de horas mensuales según el tipo de filtro
          if (dateRange) {
            if (timeFilter.includes('may_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(entry.personnelId, estimatedHours, 2025, 5);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied May 2025 adjustment for personnel ${entry.personnelId}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else if (timeFilter.includes('june_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(entry.personnelId, estimatedHours, 2025, 6);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied June 2025 adjustment for personnel ${entry.personnelId}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else if (timeFilter.includes('july_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(entry.personnelId, estimatedHours, 2025, 7);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied July 2025 adjustment for personnel ${entry.personnelId}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else {
              // Para rangos de múltiples meses (trimestres, semestres, etc.)
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHoursForDateRange(entry.personnelId, estimatedHours, dateRange.startDate, dateRange.endDate);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied range adjustment for personnel ${entry.personnelId}: ${originalHours}h → ${estimatedHours}h`);
              }
            }
          }
          
          // Usar el rol REAL del personal desde su perfil, no el rol de la cotización
          let actualRole = getRoleForPerson(entry.personnelId, '');
          let actualRate = quotationMember?.rate || 0;
          
          if (!isQuoted) {
            // Buscar datos de personal no cotizado para este proyecto
            const unquotedData = await storage.getUnquotedPersonnelByProject(id);
            const unquotedEntry = unquotedData.find(up => up.personnelId === entry.personnelId);
            
            if (unquotedEntry) {
              // Para personal no cotizado, usar también el rol real de su perfil
              actualRole = 'Sin Rol';
              actualRate = unquotedEntry.estimatedRate || 0;
              console.log(`📊 Found unquoted personnel data:`, {
                personnelId: entry.personnelId,
                name: 'Personnel Name',
                role: actualRole,
                rate: actualRate
              });
            }
          }
          
          teamBreakdown[personnelId] = {
            personnelId: entry.personnelId,
            name: 'Personnel Name',
            roleName: actualRole,
            hourlyRate: actualRate,
            hours: 0,
            cost: 0,
            entries: 0,
            lastActivity: null,
            estimatedHours: estimatedHours,
            rate: actualRate,
            isQuoted: isQuoted, // NUEVO: Marca si el personal estaba en cotización original
            isUnquoted: !isQuoted, // NUEVO: Marca si el personal NO estaba cotizado originalmente
            targetHours: null // NUEVO: Horas objetivo del Excel MAESTRO (inicialmente null para time entries)
          };
          }
          teamBreakdown[personnelId].hours += entry.hours || 0;
          teamBreakdown[personnelId].cost += entry.totalCost || 0;
          teamBreakdown[personnelId].entries += 1;
        
          // Update last activity if this entry is more recent
          const entryDate = new Date(entry.date);
          if (!teamBreakdown[personnelId].lastActivity || entryDate > new Date(teamBreakdown[personnelId].lastActivity)) {
            teamBreakdown[personnelId].lastActivity = entryDate.toISOString();
          }
        }
      }
      
      // 4.5. Agregar miembros del equipo de cotización que no tienen time entries en este período (solo si no están ya)
      for (const quotationMember of quotationTeam) {
        const personnelId = quotationMember.personnelId.toString();
        if (!teamBreakdown[personnelId]) {
          console.log(`📊 Adding quotation member ${quotationMember.personnelName} (ID: ${personnelId}) - not found in cost summary`);
          let estimatedHours = quotationMember.hours || 0;
          
          // Aplicar ajustes de horas mensuales según el tipo de filtro
          if (dateRange) {
            if (timeFilter.includes('may_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(quotationMember.personnelId, estimatedHours, 2025, 5);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied May 2025 adjustment for ${quotationMember.personnelName}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else if (timeFilter.includes('june_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(quotationMember.personnelId, estimatedHours, 2025, 6);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied June 2025 adjustment for ${quotationMember.personnelName}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else if (timeFilter.includes('july_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(quotationMember.personnelId, estimatedHours, 2025, 7);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied July 2025 adjustment for ${quotationMember.personnelName}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else {
              // Para rangos de múltiples meses (trimestres, semestres, etc.)
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHoursForDateRange(quotationMember.personnelId, estimatedHours, dateRange.startDate, dateRange.endDate);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied range adjustment for ${quotationMember.personnelName}: ${originalHours}h → ${estimatedHours}h`);
              }
            }
          }

          teamBreakdown[personnelId] = {
            personnelId: quotationMember.personnelId,
            name: quotationMember.personnelName || 'Unknown',
            roleName: quotationMember.roleName || 'Unknown Role',
            hourlyRate: quotationMember.rate || 0,
            hours: 0, // No worked hours in this period
            cost: 0, // No cost in this period
            entries: 0,
            lastActivity: null,
            estimatedHours: estimatedHours, // Adjusted hours
            rate: quotationMember.rate || 0,
            isQuoted: true,
            isUnquoted: false,
            targetHours: null // NUEVO: Horas objetivo del Excel MAESTRO (inicialmente null para miembros de cotización sin datos)
          };
        }
      }

      // 4.6. INTEGRAR DATOS DEL EXCEL MAESTRO AL TEAM BREAKDOWN
      const directCosts = await getFilteredDirectCosts(id, timeFilter, dateRange);
      console.log(`💰 Integrating ${directCosts.length} direct costs from Excel MAESTRO into team breakdown`);
      
      for (const directCost of directCosts) {
        const personnelName = directCost.persona;
        const targetHours = directCost.horasObjetivo || 0;
        const actualHours = directCost.horasRealesAsana || 0;
        
        // Buscar el miembro del equipo por nombre (ya que Excel MAESTRO puede no tener personnelId)
        // Usar la misma lógica de normalización para evitar duplicados
        const normalizePersonnelName = (name: string) => {
          const nameMap = {
            'vicky': 'victoria',
            'victoria': 'victoria',
            'trini': 'trinidad', 
            'trinidad': 'trinidad',
            'tomi': 'tomas',
            'tomas': 'tomas',
            'male': 'malena',
            'malena': 'malena',
            'vanu': 'vanina',
            'vanina': 'vanina',
            'gast': 'gastón',
            'gaston': 'gastón',
            'gastón': 'gastón',
            'aylu': 'aylen',
            'aylen': 'aylen',
            'sol': 'sol',
            'to': 'rosario',
            'ro': 'rosario',
            'rosario': 'rosario',
            'santi': 'santiago',
            'santiago': 'santiago',
            'xavi': 'xavier',
            'xavier': 'xavier',
            'mati': 'matías',
            'matias': 'matías',
            'ina': 'ina',
            'cata': 'cata'
          };
          const normalized = name.toLowerCase().split(' ')[0]; // Solo primer nombre
          return nameMap[normalized] || normalized;
        };

        let teamMemberKey = null;
        const normalizedPersonnelName = normalizePersonnelName(personnelName);
        
        // Debug: mostrar todos los miembros disponibles
        console.log(`🔍 Looking for match for "${personnelName}" (normalized: "${normalizedPersonnelName}")`);
        console.log(`📋 Available team members:`, Object.entries(teamBreakdown).map(([key, member]) => ({
          key,
          name: member.name,
          normalized: normalizePersonnelName(member.name || '')
        })));
        
        for (const [key, member] of Object.entries(teamBreakdown)) {
          const normalizedMemberName = normalizePersonnelName(member.name || '');
          
          // Usar coincidencia normalizada MÁS coincidencia de texto para mejor precisión
          if (normalizedPersonnelName === normalizedMemberName ||
              member.name?.toLowerCase().includes(personnelName.toLowerCase()) || 
              personnelName.toLowerCase().includes(member.name?.toLowerCase() || '')) {
            teamMemberKey = key;
            console.log(`🔗 Found team member match: "${personnelName}" → "${member.name}" (key: ${key})`);
            break;
          }
        }
        
        if (!teamMemberKey) {
          console.log(`❌ NO MATCH FOUND for "${personnelName}" - this will cause duplicates!`);
        }
        
        if (teamMemberKey) {
          // Actualizar horas objetivo del Excel MAESTRO
          teamBreakdown[teamMemberKey].targetHours = (teamBreakdown[teamMemberKey].targetHours || 0) + targetHours;
          
          // Si el miembro no tiene rate, buscar en base de datos de personnel
          if (!teamBreakdown[teamMemberKey].rate || teamBreakdown[teamMemberKey].rate === 0) {
            const personnelData = await storage.getPersonnel();
            // Mejorar la coincidencia de nombres con apodos comunes
            const normalizePersonnelName = (name: string) => {
              const nameMap = {
                'vicky': 'victoria',
                'victoria': 'victoria',
                'trini': 'trinidad', 
                'trinidad': 'trinidad',
                'tomi': 'tomas',
                'tomas': 'tomas',
                'male': 'malena',
                'malena': 'malena',
                'vanu': 'vanina',
                'vanina': 'vanina',
                'gast': 'gastón',
                'gaston': 'gastón',
                'gastón': 'gastón',
                'aylu': 'aylen',
                'aylen': 'aylen',
                'sol': 'sol',
                'to': 'rosario',
                'ro': 'rosario', 
                'rosario': 'rosario',
                'santi': 'santiago',
                'santiago': 'santiago',
                'xavi': 'xavier',
                'xavier': 'xavier',
                'mati': 'matías',
                'matias': 'matías',
                'ina': 'ina',
                'cata': 'cata'
              };
              const normalized = name.toLowerCase().split(' ')[0]; // Solo primer nombre
              return nameMap[normalized] || normalized;
            };
            
            const matchingPersonnel = personnelData.find(p => {
              const personnelFirstName = normalizePersonnelName(personnelName);
              const dbFirstName = normalizePersonnelName(p.name || '');
              return personnelFirstName === dbFirstName ||
                     p.name?.toLowerCase().includes(personnelName.toLowerCase()) || 
                     personnelName.toLowerCase().includes(p.name?.toLowerCase() || '');
            });
            
            if (matchingPersonnel && matchingPersonnel.hourlyRate) {
              teamBreakdown[teamMemberKey].rate = matchingPersonnel.hourlyRate;
              teamBreakdown[teamMemberKey].hourlyRate = matchingPersonnel.hourlyRate;
              console.log(`💰 Updated rate for ${personnelName}: $${matchingPersonnel.hourlyRate}/h (matched with ${matchingPersonnel.name})`);
            } else {
              console.log(`⚠️ No rate found for ${personnelName}. Tried matching with personnel names.`);
            }
          }
          
          console.log(`💰 Updated ${personnelName}: targetHours=${teamBreakdown[teamMemberKey].targetHours}, rate=${teamBreakdown[teamMemberKey].rate}`);
        } else {
          console.log(`⚠️ No team member match found for "${personnelName}" from Excel MAESTRO - skipping to avoid duplicates`);
          console.log(`📋 Available team members: ${Object.values(teamBreakdown).map(m => `"${m.name}"`).join(', ')}`);
        }
      }

      console.log(`📊 Time entries for project ${id}:`, timeEntries.length, 'entries');
      console.log(`📊 Total worked hours:`, totalWorkedHours);
      console.log(`📊 Total worked cost:`, totalWorkedCost);
      console.log(`📊 Team breakdown created for ${Object.keys(teamBreakdown).length} members (including quotation team + Excel MAESTRO)`);
      console.log(`🔍 Final team breakdown keys:`, Object.keys(teamBreakdown).map(key => ({
        key, 
        name: teamBreakdown[key].name, 
        personnelId: teamBreakdown[key].personnelId,
        actualHours: teamBreakdown[key].actualHours || teamBreakdown[key].hours,
        targetHours: teamBreakdown[key].targetHours
      })));

      // Función para calcular meses reales con datos
      function calculateActualMonthsWithData(entries: any[], dateRange: any): number {
        if (!entries || entries.length === 0) return 0;
        
        const monthsSet = new Set<string>();
        entries.forEach(entry => {
          const entryDate = new Date(entry.date);
          const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`;
          monthsSet.add(monthKey);
        });
        
        return monthsSet.size;
      }

      // 5. RECALCULAR horas estimadas totales DESPUÉS de integrar Excel MAESTRO
      // Sumar todas las horas objetivo del Excel MAESTRO + horas estimadas de cotización
      const totalEstimatedHoursFromTeam = Object.values(teamBreakdown).reduce((sum, member) => {
        const memberEstimated = member.targetHours || member.estimatedHours || 0;
        console.log(`📊 Member ${member.name}: estimatedHours=${member.estimatedHours}, targetHours=${member.targetHours}, using=${memberEstimated}`);
        return sum + memberEstimated;
      }, 0);
      
      console.log(`📊 RECALCULATED estimatedHours: original=${estimatedHours}, fromTeamBreakdown=${totalEstimatedHoursFromTeam}`);
      
      // 5. Ajustar horas estimadas según tipo de proyecto y filtro temporal
      let adjustedEstimatedHours = totalEstimatedHoursFromTeam > 0 ? totalEstimatedHoursFromTeam : estimatedHours;
      let adjustedBaseCost = baseCost;
      let adjustedTotalAmount = totalAmount;
      
      // Para proyectos de fee mensual o Always-On, calcular estimaciones proporcionales al período
      console.log(`📊 Checking temporal scaling conditions:`, {
        projectType: project.quotation?.projectType,
        dateRange: !!dateRange,
        timeFilter,
        shouldScale: (project.quotation?.projectType === 'always-on' || project.quotation?.projectType === 'fee-mensual') && dateRange && timeFilter !== 'all'
      });
      
      if ((project.quotation?.projectType === 'always-on' || project.quotation?.projectType === 'fee-mensual') && dateRange && timeFilter !== 'all') {
        // Calcular meses reales con datos en lugar de meses teóricos del filtro
        const actualMonthsWithData = calculateActualMonthsWithData(timeEntries, dateRange);
        const theoreticalMonths = getMonthsInFilter(timeFilter);
        
        // IMPORTANTE: Usar SOLO los meses con datos reales, no los teóricos
        const monthsToUse = actualMonthsWithData > 0 ? actualMonthsWithData : theoreticalMonths;
        
        if (monthsToUse > 0) {
          // SOLO escalar costos y montos para contratos de fee mensual, NO las horas
          // Las horas ya fueron calculadas individualmente con ajustes mensuales
          adjustedBaseCost = baseCost * monthsToUse;
          adjustedTotalAmount = totalAmount * monthsToUse;
          
          // Para las horas totales, usar la suma real de las horas ajustadas individuales
          adjustedEstimatedHours = Object.values(teamBreakdown).reduce((sum, member) => sum + (member.estimatedHours || 0), 0);
          
          console.log(`📊 Monthly contract adjustment for ${monthsToUse} months (${project.quotation?.projectType}):`, {
            theoretical: theoreticalMonths,
            actualWithData: actualMonthsWithData,
            used: monthsToUse,
            originalHours: estimatedHours,
            adjustedHours: adjustedEstimatedHours,
            originalCost: baseCost,
            adjustedCost: adjustedBaseCost,
            originalAmount: totalAmount,
            adjustedAmount: adjustedTotalAmount
          });
        }
      }

      // Función auxiliar para calcular meses en filtro
      function getMonthsInFilter(filter: string): number {
        switch (filter) {
          case 'current_month':
          case 'this-month':
          case 'last_month':
          case 'last-month':
          case 'may_2025':
          case 'june_2025':
          case 'july_2025':
          case 'january_2025':
          case 'february_2025':
          case 'march_2025':
          case 'april_2025':
          case 'august_2025':
          case 'september_2025':
          case 'october_2025':
          case 'november_2025':
          case 'december_2025':
          case 'january':
          case 'february':
          case 'march':
          case 'april':
          case 'may':
          case 'june':
          case 'july':
          case 'august':
          case 'september':
          case 'october':
          case 'november':
          case 'december':
            return 1;
          case 'current_quarter':
          case 'this-quarter':
          case 'last_quarter':
          case 'last-quarter':
          case 'q1':
          case 'q2':
          case 'q3':
          case 'q4':
          case 'q1_2025':
          case 'q2_2025':
          case 'q3_2025':
          case 'q4_2025':
            return 3;
          case 'current_semester':
          case 'this-semester':
          case 'last_semester':
          case 'last-semester':
          case 'semester1_2025':
          case 'semester2_2025':
            return 6;
          case 'current_year':
          case 'this-year':
          case 'last_year':
          case 'year_2025':
            return 12;
          default:
            return 0;
        }
      }

      // 6. Calcular métricas consolidadas (ÚNICA FUENTE)
      const efficiency = adjustedEstimatedHours > 0 ? (totalWorkedHours / adjustedEstimatedHours) * 100 : 0;
      
      // SIEMPRE usar ingresos reales del Excel MAESTRO para cálculos de markup (excepto cuando no hay datos)
      const salesData = await getFilteredGoogleSheetsSales(id, timeFilter, dateRange);
      const totalRealRevenue = salesData.length > 0 
        ? salesData.reduce((sum, sale) => sum + (parseFloat(sale.amountUsd) || 0), 0)
        : adjustedTotalAmount; // Fallback a cotización solo si no hay datos reales
      
      console.log(`💰 Using real revenue for filter "${timeFilter}": $${totalRealRevenue} from ${salesData.length} sales records (fallback to quotation: ${salesData.length === 0})`);
      if (salesData.length > 0) {
        console.log(`📊 Sales breakdown:`, salesData.map(s => ({ month: s.month, year: s.year, amount: s.amountUsd })));
      }
      
      const markup = totalWorkedCost > 0 ? totalRealRevenue / totalWorkedCost : 0;
      const budgetUtilization = adjustedBaseCost > 0 ? (totalWorkedCost / adjustedBaseCost) * 100 : 0;
      
      console.log(`🔢 MARKUP CALCULATION DEBUG for project ${id} (${timeFilter}):`);
      console.log(`   Total Real Revenue: $${totalRealRevenue}`);
      console.log(`   Total Worked Cost: $${totalWorkedCost}`);
      console.log(`   Calculated Markup: ${markup.toFixed(3)}x`);
      console.log(`   Expected 5.5x? ${markup > 5.0 ? 'YES' : 'NO - Issue detected'}`);

      // 7. CALCULAR RANKINGS ECONÓMICOS USANDO LOS DATOS REALES
      const { calculateTeamRankings } = await import('../shared/ranking-utils');
      

      
      // Preparar datos del equipo para rankings - DEDUPLICAR POR NOMBRE NORMALIZADO
      const uniqueTeamMembers = new Map();
      
      // Consolidar miembros con nombres similares (ej: Sol vs Sol Ayala)
      Object.entries(teamBreakdown).forEach(([key, member]) => {
        const normalizedName = member.name?.toLowerCase().split(' ')[0] || key;
        
        if (uniqueTeamMembers.has(normalizedName)) {
          // Ya existe, combinar datos
          const existing = uniqueTeamMembers.get(normalizedName);
          existing.hours += (member.hours || 0);
          existing.cost += (member.cost || 0);
          existing.targetHours = Math.max(existing.targetHours || 0, member.targetHours || 0);
          existing.estimatedHours = Math.max(existing.estimatedHours || 0, member.estimatedHours || 0);
          existing.rate = Math.max(existing.rate || 0, member.rate || 0); // Usar la tarifa más alta
          console.log(`🔗 Consolidated duplicate: "${member.name}" into "${existing.name}"`);
        } else {
          // Primera vez viendo este nombre, agregar
          uniqueTeamMembers.set(normalizedName, { ...member });
        }
      });
      
      const teamRankingData = Array.from(uniqueTeamMembers.values())
        .filter(member => (member.hours || 0) > 0) // Solo incluir miembros con horas trabajadas
        .map(member => {
          // PRIORIZAR horas objetivo del Excel MAESTRO sobre estimaciones de cotización
          const baseEstimatedHours = member.targetHours || member.estimatedHours || 0;
          const baseEstimatedCost = baseEstimatedHours * (member.rate || 0);
          
          console.log(`📊 Rankings - Member ${member.name}:`);
          console.log(`  - targetHours: ${member.targetHours}`);
          console.log(`  - estimatedHours: ${member.estimatedHours}`);
          console.log(`  - using baseEstimatedHours: ${baseEstimatedHours}`);
          console.log(`  - rate: ${member.rate}`);
          console.log(`  - baseEstimatedCost: ${baseEstimatedCost}`);
          console.log(`  - actualHours: ${member.hours}`);
          console.log(`  - actualCost: ${member.cost}`);
          
          return {
            personnelId: member.personnelId,
            name: member.name || `Miembro ${member.personnelId}`,
            personnelName: member.name || `Miembro ${member.personnelId}`,
            estimatedHours: baseEstimatedHours, // USAR HORAS OBJETIVO DEL EXCEL MAESTRO PRIMERO
            actualHours: member.hours || 0, // Los datos reales están en 'hours', no 'actualHours'
            estimatedCost: baseEstimatedCost, // COSTO BASADO EN HORAS OBJETIVO
            actualCost: member.cost || 0 // Los datos reales están en 'cost', no 'actualCost'
          };
        });

      // Debug: Ver datos que van al cálculo de rankings
      console.log(`📊 Team ranking data prepared:`, teamRankingData.slice(0, 2)); // Solo mostrar primeros 2 para debug
      console.log(`📊 Filtered team for rankings: ${teamRankingData.length} members with actual hours`);
      

      
      // Calcular rankings con datos reales del proyecto - solo si hay miembros con horas
      console.log(`📊 About to calculate rankings with adjustedTotalAmount: $${adjustedTotalAmount}`);
      console.log(`📊 Total estimatedCost for rankings: $${teamRankingData.reduce((sum, m) => sum + (m.estimatedCost || 0), 0)}`);
      const economicRankings = teamRankingData.length > 0 ? calculateTeamRankings(teamRankingData, adjustedTotalAmount) : [];
      console.log(`📊 Rankings result:`, economicRankings.map(r => ({
        name: r.personnelName,
        impactScore: r.impactScore,
        pricePercentage: r.pricePercentage,
        estimatedCost: r.estimatedCost
      })));

      console.log(`📊 Economic rankings calculated for ${economicRankings.length} team members`);
      
      if (economicRankings.length === 0) {
        console.log(`📊 No rankings generated - no team members with actual time entries for filter: ${timeFilter}`);
      }

      // 5. Crear el objeto consolidado (FUENTE ÚNICA DE VERDAD)
      const completeData = {
        // Datos base del proyecto
        project: {
          id: project.id,
          name: project.quotation?.projectName || '',
          status: project.status,
          startDate: project.startDate,
          expectedEndDate: project.expectedEndDate,
          clientId: project.clientId,
          quotationId: project.quotationId
        },
        
        // Datos de la cotización (FUENTE ÚNICA para estimaciones)
        quotation: {
          id: project.quotation?.id,
          projectName: project.quotation?.projectName,
          baseCost: adjustedBaseCost,
          totalAmount: adjustedTotalAmount,
          estimatedHours: adjustedEstimatedHours, // AJUSTADA SEGÚN FILTRO TEMPORAL
          team: quotationTeam.map(member => ({
            id: member.id,
            personnelId: member.personnelId,
            personnelName: member.personnelName,
            hours: member.hours,
            rate: member.rate,
            cost: member.cost,
            personnel: {
              id: member.personnelId,
              name: member.personnelName,
              email: member.personnelEmail,
              hourlyRate: member.personnelHourlyRate,
              profilePicture: member.personnelProfilePicture
            },
            role: {
              id: member.roleId,
              name: member.roleName,
              description: member.roleDescription
            }
          }))
        },
        
        // Datos reales trabajados (FILTERED BY DATE RANGE)
        actuals: {
          totalWorkedHours,
          totalWorkedCost,
          totalEntries: timeEntries.length,
          teamBreakdown: Object.values(teamBreakdown) // Convert object to array for frontend
        },
        
        // NUEVOS RANKINGS ECONÓMICOS
        rankings: {
          economicMetrics: economicRankings,
          summary: {
            totalMembers: economicRankings.length,
            excellentPerformers: economicRankings.filter(m => m.performanceColor === 'green').length,
            goodPerformers: economicRankings.filter(m => m.performanceColor === 'yellow').length,
            criticalPerformers: economicRankings.filter(m => m.performanceColor === 'red').length
          }
        },
        
        // Métricas calculadas (ÚNICA FUENTE)
        metrics: {
          efficiency: Math.round(efficiency * 100) / 100,
          markup: Math.round(markup * 100) / 100,
          budgetUtilization: Math.round(budgetUtilization * 100) / 100,
          hoursDeviation: Math.round((totalWorkedHours - adjustedEstimatedHours) * 100) / 100,
          costDeviation: Math.round((totalWorkedCost - adjustedBaseCost) * 100) / 100
        },

        // Datos de ventas desde Excel MAESTRO (filtradas por período temporal)
        googleSheetsSales: await getFilteredGoogleSheetsSales(id, timeFilter, dateRange),
        
        // Costos directos desde Excel MAESTRO (filtrados por período temporal)
        directCosts: await getFilteredDirectCosts(id, timeFilter, dateRange)
      };

      // Agregar campos principales en el nivel superior para compatibilidad con frontend
      const responseData = {
        ...completeData,
        // Campos principales para acceso directo desde frontend
        estimatedHours: adjustedEstimatedHours,
        estimatedCost: adjustedBaseCost,
        workedHours: totalWorkedHours,
        workedCost: totalWorkedCost,
        efficiency: completeData.metrics.efficiency,
        markup: completeData.metrics.markup,
        timeFilter: timeFilter,
        isAlwaysOn: project.quotation?.projectType === 'always-on',
        // Agregar salesData para compatibilidad con frontend
        salesData: completeData.googleSheetsSales,
        // AGREGAR timeEntries para mostrar actividad reciente en frontend
        // NOTA: Si no hay timeEntries tradicionales, usar datos del teamBreakdown como actividad reciente
        timeEntries: timeEntries.length > 0 
          ? timeEntries.map(entry => ({
              id: entry.id,
              personnelId: entry.personnelId,
              personnelName: entry.personnelName || 'Sin nombre',
              date: entry.date,
              hours: entry.hours,
              description: entry.description,
              roleName: entry.roleName || 'Sin rol'
            })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          : Object.values(teamBreakdown).map((member: any, index) => ({
              id: `excel-${index}`,
              personnelId: member.personnelId || null,
              personnelName: member.name || 'Sin nombre',
              date: new Date().toISOString().split('T')[0], // Fecha actual como placeholder
              hours: member.actualHours || member.hours || 0,
              description: `${member.hours || 0}h trabajadas en el período`,
              roleName: member.role || 'Sin rol'
            })).filter(entry => entry.hours > 0) // Solo mostrar miembros con horas trabajadas
      };

      console.log(`📊 Complete data prepared for project ${id}:`, {
        estimatedHours: adjustedEstimatedHours,
        workedHours: totalWorkedHours,
        efficiency: completeData.metrics.efficiency,
        timeFilter: timeFilter,
        isAlwaysOn: project.quotation?.projectType === 'always-on',
        teamBreakdownLength: Object.values(teamBreakdown).length,
        teamBreakdownKeys: Object.keys(teamBreakdown),
        teamBreakdownSample: Object.values(teamBreakdown).slice(0, 2),
        economicRankingsCount: economicRankings.length,
        timeEntriesCount: timeEntries.length > 0 ? timeEntries.length : Object.values(teamBreakdown).filter((m: any) => m.hours > 0).length,
        recentTimeEntriesSample: timeEntries.length > 0 
          ? timeEntries.slice(0, 3).map(e => ({
              personnelName: e.personnelName,
              date: e.date,
              hours: e.hours
            }))
          : Object.values(teamBreakdown).filter((m: any) => m.hours > 0).slice(0, 3).map((member: any) => ({
              personnelName: member.name,
              hours: member.hours || member.actualHours,
              source: 'teamBreakdown'
            }))
      });

      res.json(responseData);
    } catch (error) {
      console.error("Error getting complete project data:", error);
      res.status(500).json({ message: "Failed to get complete project data" });
    }
  });

  // Endpoint para asignar horas a personal no cotizado
  app.post("/api/projects/assign-unquoted-personnel", requireAuth, async (req, res) => {
    try {
      const { projectId, personnelId, estimatedHours, hourlyRate } = req.body;
      
      if (!projectId || !personnelId || !estimatedHours) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      console.log(`🔧 Assigning ${estimatedHours} hours to unquoted personnel ${personnelId} in project ${projectId}`);
      
      // Crear registro en tabla de personal no cotizado
      const result = await storage.assignUnquotedPersonnel(projectId, personnelId, estimatedHours, hourlyRate);
      
      console.log(`✅ Successfully assigned hours to unquoted personnel:`, result);
      
      res.json({ 
        success: true, 
        message: "Hours assigned successfully",
        assignment: result 
      });
    } catch (error) {
      console.error("Error assigning hours to unquoted personnel:", error);
      res.status(500).json({ message: "Failed to assign hours to unquoted personnel" });
    }
  });

  // Servir archivos estáticos desde public
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

  // Temporalmente deshabilitado: Chat websocket server
  // setupChat(app, httpServer);

  // Clients routes
  app.get("/api/clients", requireAuth, async (_, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    res.json(client);
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

    try {

      // Partial validation - only validate the fields provided
      const validatedData = insertClientSchema.partial().parse(req.body);

      const updatedClient = await storage.updateClient(id, validatedData);

      if (!updatedClient) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(updatedClient);
    } catch (error) {
      console.error("Error actualizando cliente:", error);
      if (error instanceof z.ZodError) {
        console.error("Error de validación Zod:", error.errors);
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Delete client route
  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

    try {
      const client = await storage.getClient(id);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const success = await storage.deleteClient(id);
      
      if (!success) {
        return res.status(400).json({ 
          message: "Cannot delete this client because it has active projects or quotations. Remove or reassign them before deleting." 
        });
      }

      res.json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Ruta para cargar logo de cliente
  app.post("/api/clients/:id/logo", requireAuth, upload.single('logo'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

      if (!req.file) {
        return res.status(400).json({ message: "No logo file provided" });
      }

      // Obtener el cliente actual para ver si ya tiene un logo
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Si existe un logo anterior, eliminar el archivo
      if (client.logoUrl) {
        deleteOldFile(client.logoUrl.replace(/^\/uploads\//, 'public/uploads/'));
      }

      // Actualizar el cliente con la nueva URL del logo
      const logoUrl = `/uploads/${path.basename(req.file.path)}`;

      const updatedClient = await storage.updateClient(id, {
        logoUrl: logoUrl
      });

      res.json(updatedClient);
    } catch (error) {
      console.error("Error uploading client logo:", error);
      res.status(500).json({ message: "Failed to upload client logo", error: String(error) });
    }
  });

  // Roles routes
  app.get("/api/roles", requireAuth, async (_, res) => {
    const roles = await storage.getRoles();
    res.json(roles);
  });

  app.get("/api/roles/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid role ID" });

    const role = await storage.getRole(id);
    if (!role) return res.status(404).json({ message: "Role not found" });

    res.json(role);
  });

  app.post("/api/roles", requireAuth, async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid role ID" });

    try {
      const validatedData = insertRoleSchema.partial().parse(req.body);
      const updatedRole = await storage.updateRole(id, validatedData);

      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found" });
      }

      res.json(updatedRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid role ID" });

    try {
      const success = await storage.deleteRole(id);

      if (!success) {
        return res.status(400).json({ 
          message: "Cannot delete this role because it has personnel assigned to it. Reassign personnel before deleting." 
        });
      }

      res.json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Personnel historical costs routes
  app.get("/api/personnel-historical-costs", requireAuth, async (req, res) => {
    try {
      const historicalCosts = await db
        .select()
        .from(personnelHistoricalCosts)
        .where(eq(personnelHistoricalCosts.isActive, true))
        .orderBy(personnelHistoricalCosts.personnelId, personnelHistoricalCosts.year, personnelHistoricalCosts.month);
      
      res.json(historicalCosts);
    } catch (error) {
      console.error("Error fetching historical costs:", error);
      res.status(500).json({ message: "Failed to fetch historical costs" });
    }
  });

  app.post("/api/personnel-historical-costs", requireAuth, async (req, res) => {
    try {
      const { personnelId, year, month, hourlyRateARS, monthlySalaryARS, hourlyRateUSD, monthlySalaryUSD, adjustmentReason, notes } = req.body;
      
      // Insert or update historical cost
      const result = await db
        .insert(personnelHistoricalCosts)
        .values({
          personnelId,
          year,
          month,
          hourlyRateARS: hourlyRateARS?.toString(),
          monthlySalaryARS: monthlySalaryARS?.toString(),
          hourlyRateUSD: hourlyRateUSD?.toString(),
          monthlySalaryUSD: monthlySalaryUSD?.toString(),
          adjustmentReason,
          notes,
          createdBy: req.user?.id || 1
        })
        .onDuplicateKeyUpdate({
          set: {
            hourlyRateARS: hourlyRateARS?.toString(),
            monthlySalaryARS: monthlySalaryARS?.toString(),
            hourlyRateUSD: hourlyRateUSD?.toString(),
            monthlySalaryUSD: monthlySalaryUSD?.toString(),
            adjustmentReason,
            notes,
            updatedAt: new Date(),
            updatedBy: req.user?.id || 1
          }
        })
        .returning();
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error("Error creating historical cost:", error);
      res.status(500).json({ message: "Failed to create historical cost" });
    }
  });

  // Personnel routes
  app.get("/api/personnel", requireAuth, async (_, res) => {
    try {
      const personnelData = await db.select({
        id: personnel.id,
        name: personnel.name,
        email: personnel.email,
        roleId: personnel.roleId,
        hourlyRate: personnel.hourlyRate,
        roleName: roles.name,
        contractType: personnel.contractType,
        monthlyFixedSalary: personnel.monthlyFixedSalary,
        monthlyHours: personnel.monthlyHours,
        includeInRealCosts: personnel.includeInRealCosts,
        // Historical hourly rates (ARS) - CORREGIDO: nombres de columnas con guiones bajos
        jan2025HourlyRateARS: personnel.jan2025HourlyRateARS,
        feb2025HourlyRateARS: personnel.feb2025HourlyRateARS,
        mar2025HourlyRateARS: personnel.mar2025HourlyRateARS,
        apr2025HourlyRateARS: personnel.apr2025HourlyRateARS,
        may2025HourlyRateARS: personnel.may2025HourlyRateARS,
        jun2025HourlyRateARS: personnel.jun2025HourlyRateARS,
        jul2025HourlyRateARS: personnel.jul2025HourlyRateARS,
        aug2025HourlyRateARS: personnel.aug2025HourlyRateARS,
        sep2025HourlyRateARS: personnel.sep2025HourlyRateARS,
        oct2025HourlyRateARS: personnel.oct2025HourlyRateARS,
        nov2025HourlyRateARS: personnel.nov2025HourlyRateARS,
        dec2025HourlyRateARS: personnel.dec2025HourlyRateARS,
        // Historical monthly salaries (ARS)
        jan2025MonthlySalaryARS: personnel.jan2025MonthlySalaryARS,
        feb2025MonthlySalaryARS: personnel.feb2025MonthlySalaryARS,
        mar2025MonthlySalaryARS: personnel.mar2025MonthlySalaryARS,
        apr2025MonthlySalaryARS: personnel.apr2025MonthlySalaryARS,
        may2025MonthlySalaryARS: personnel.may2025MonthlySalaryARS,
        jun2025MonthlySalaryARS: personnel.jun2025MonthlySalaryARS,
        jul2025MonthlySalaryARS: personnel.jul2025MonthlySalaryARS,
        aug2025MonthlySalaryARS: personnel.aug2025MonthlySalaryARS,
        sep2025MonthlySalaryARS: personnel.sep2025MonthlySalaryARS,
        oct2025MonthlySalaryARS: personnel.oct2025MonthlySalaryARS,
        nov2025MonthlySalaryARS: personnel.nov2025MonthlySalaryARS,
        dec2025MonthlySalaryARS: personnel.dec2025MonthlySalaryARS,
        // Historical contract types by month
        jan2025ContractType: personnel.jan2025ContractType,
        feb2025ContractType: personnel.feb2025ContractType,
        mar2025ContractType: personnel.mar2025ContractType,
        apr2025ContractType: personnel.apr2025ContractType,
        may2025ContractType: personnel.may2025ContractType,
        jun2025ContractType: personnel.jun2025ContractType,
        jul2025ContractType: personnel.jul2025ContractType,
        aug2025ContractType: personnel.aug2025ContractType,
        sep2025ContractType: personnel.sep2025ContractType,
        oct2025ContractType: personnel.oct2025ContractType,
        nov2025ContractType: personnel.nov2025ContractType,
        dec2025ContractType: personnel.dec2025ContractType
      })
      .from(personnel)
      .leftJoin(roles, eq(personnel.roleId, roles.id))
      .orderBy(personnel.name);

      res.json(personnelData);
    } catch (error) {
      console.error("Error fetching personnel:", error);
      res.status(500).json({ error: "Error fetching personnel" });
    }
  });

  app.get("/api/personnel/role/:roleId", requireAuth, async (req, res) => {
    const roleId = parseInt(req.params.roleId);
    if (isNaN(roleId)) return res.status(400).json({ message: "Invalid role ID" });

    const personnel = await storage.getPersonnelByRole(roleId);
    res.json(personnel);
  });

  app.get("/api/personnel/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid personnel ID" });

    const person = await storage.getPersonnelById(id);
    if (!person) return res.status(404).json({ message: "Personnel not found" });

    res.json(person);
  });

  app.post("/api/personnel", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPersonnelSchema.parse(req.body);
      const person = await storage.createPersonnel(validatedData);
      res.status(201).json(person);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid personnel data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create personnel" });
    }
  });

  app.patch("/api/personnel/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid personnel ID" });

    try {
      // Get current person name for better logging
      const currentPerson = await storage.getPersonnelById(id);
      const personName = currentPerson?.name || `ID${id}`;
      
      console.log(`🔧 [${personName}] PATCH /api/personnel/${id} - Raw body:`, req.body);
      
      // Si hourlyRate viene como string, asegurarnos de convertirlo a número
      let data = { ...req.body };

      if (typeof data.hourlyRate === 'string') {
        // Reemplazar coma por punto si existe
        const rateString = data.hourlyRate.replace(',', '.');
        const rateNumber = parseFloat(rateString);

        if (!isNaN(rateNumber)) {
          data.hourlyRate = Math.round(rateNumber * 100) / 100; // Redondear a 2 decimales
        }
      }

      // Si monthlyHours viene como string, asegurarnos de convertirlo a número
      if (typeof data.monthlyHours === 'string') {
        console.log(`🔧 [${personName}] Converting monthlyHours from string: "${data.monthlyHours}"`);
        // Reemplazar coma por punto si existe
        const hoursString = data.monthlyHours.replace(',', '.');
        const hoursNumber = parseFloat(hoursString);

        if (!isNaN(hoursNumber) && hoursNumber > 0) {
          data.monthlyHours = Math.round(hoursNumber); // Redondear a entero
          console.log(`🔧 [${personName}] Converted monthlyHours to: ${data.monthlyHours}`);
        } else {
          console.error(`❌ [${personName}] Invalid monthlyHours string: "${data.monthlyHours}" -> ${hoursNumber}`);
        }
      }

      // Validar rango de horas mensuales
      if (data.monthlyHours !== undefined) {
        console.log(`🔧 [${personName}] Validating monthlyHours: ${data.monthlyHours} (type: ${typeof data.monthlyHours})`);
        if (data.monthlyHours < 40 || data.monthlyHours > 300) {
          console.error(`❌ [${personName}] Invalid monthly hours: ${data.monthlyHours}. Must be between 40 and 300.`);
          return res.status(400).json({ 
            message: "Las horas mensuales deben estar entre 40 y 300 horas",
            field: "monthlyHours",
            value: data.monthlyHours
          });
        }
        console.log(`✅ [${personName}] Monthly hours validation passed: ${data.monthlyHours}h`);
      }

      const validatedData = insertPersonnelSchema.partial().parse(data);
      console.log(`🔧 [${personName}] PATCH /api/personnel/${id} - Validated data:`, validatedData);
      
      // Si se están actualizando horas mensuales y hay sueldo fijo, recalcular tarifa por hora
      if (validatedData.monthlyHours !== undefined) {
        console.log(`🔧 [${personName}] Monthly hours update detected: ${validatedData.monthlyHours}h`);
        
        if (currentPerson && currentPerson.monthlyFixedSalary && validatedData.monthlyHours > 0) {
          const newHourlyRate = Math.round(currentPerson.monthlyFixedSalary / validatedData.monthlyHours);
          validatedData.hourlyRate = newHourlyRate;
          console.log(`🔧 Auto-calculating hourlyRate: ${currentPerson.monthlyFixedSalary} ÷ ${validatedData.monthlyHours} = ${newHourlyRate}`);
          
          // También actualizar el campo histórico del mes actual si existe
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth(); // 0-based
          
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const historicalField = `${monthNames[currentMonth]}${currentYear}HourlyRateARS` as keyof typeof validatedData;
          
          // Si el campo histórico existe y tiene un valor, actualizarlo también
          if (currentPerson[historicalField as keyof typeof currentPerson] !== null && currentPerson[historicalField as keyof typeof currentPerson] !== undefined) {
            (validatedData as any)[historicalField] = newHourlyRate;
            console.log(`🔧 Also updating historical field ${historicalField} to ${newHourlyRate}`);
          }
        } else {
          console.log(`📝 Monthly hours updated to ${validatedData.monthlyHours}h (no salary recalculation needed)`);
        }
      }
      
      // Si se actualiza el sueldo fijo y hay horas mensuales, recalcular tarifa por hora
      if (validatedData.monthlyFixedSalary !== undefined) {
        const currentPerson = await storage.getPersonnelById(id);
        const monthlyHours = validatedData.monthlyHours || currentPerson?.monthlyHours || 0;
        if (validatedData.monthlyFixedSalary > 0 && monthlyHours > 0) {
          const newHourlyRate = Math.round(validatedData.monthlyFixedSalary / monthlyHours);
          validatedData.hourlyRate = newHourlyRate;
          console.log(`🔧 Auto-calculating hourlyRate from salary: ${validatedData.monthlyFixedSalary} ÷ ${monthlyHours} = ${newHourlyRate}`);
        }
      }
      
      const updatedPerson = await storage.updatePersonnel(id, validatedData);
      console.log(`🔧 [${personName}] PATCH /api/personnel/${id} - Updated person:`, updatedPerson);

      if (!updatedPerson) {
        console.error(`❌ [${personName}] Personnel not found after update`);
        return res.status(404).json({ message: "Personnel not found" });
      }

      console.log(`✅ [${personName}] Sending response with monthlyHours: ${updatedPerson.monthlyHours}`);
      res.json(updatedPerson);
    } catch (error) {
      console.error("Error al actualizar personal:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid personnel data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update personnel" });
    }
  });

  // Get personnel dependencies before deletion
  app.get("/api/personnel/:id/dependencies", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid personnel ID" });

    try {
      const dependencies = await storage.getPersonnelDependencies(id);
      res.json(dependencies);
    } catch (error) {
      console.error("Error getting personnel dependencies:", error);
      res.status(500).json({ message: "Error interno del servidor al obtener dependencias" });
    }
  });

  app.delete("/api/personnel/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid personnel ID" });

    try {
      // Primero verificar las dependencias
      const dependencies = await storage.getPersonnelDependencies(id);
      
      if (dependencies.timeEntries > 0 || dependencies.quotations.length > 0 || dependencies.projects.length > 0) {
        let message = "No se puede eliminar este personal porque está siendo usado en:\n";
        
        if (dependencies.timeEntries > 0) {
          message += `• ${dependencies.timeEntries} entradas de tiempo\n`;
        }
        
        if (dependencies.quotations.length > 0) {
          message += `• Cotizaciones: ${dependencies.quotations.map(q => q.projectName).join(', ')}\n`;
        }
        
        if (dependencies.projects.length > 0) {
          message += `• Proyectos activos: ${dependencies.projects.map(p => p.name).join(', ')}\n`;
        }
        
        message += "\nPara eliminarlo, primero debe removerlo de estas cotizaciones y proyectos.";
        
        return res.status(400).json({ 
          message,
          dependencies
        });
      }

      const success = await storage.deletePersonnel(id);

      if (!success) {
        return res.status(400).json({ 
          message: "Error inesperado al eliminar el personal." 
        });
      }

      res.json({ success: true, message: "Personal eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting personnel:", error);
      res.status(500).json({ message: "Error interno del servidor al eliminar personal" });
    }
  });

  // Report templates routes
  app.get("/api/templates", requireAuth, async (_, res) => {
    const templates = await storage.getReportTemplates();
    res.json(templates);
  });

  // Ruta alternativa para las plantillas (para compatibilidad con el flujo optimizado)
  app.get("/api/report-templates", requireAuth, async (_, res) => {
    const templates = await storage.getReportTemplates();
    res.json(templates);
  });

  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });

    const template = await storage.getReportTemplate(id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    res.json(template);
  });

  // Ruta alternativa para obtener una plantilla específica (para compatibilidad con el flujo optimizado)
  app.get("/api/report-templates/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });

    const template = await storage.getReportTemplate(id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    res.json(template);
  });

  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const validatedData = insertReportTemplateSchema.parse(req.body);
      const template = await storage.createReportTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });

    try {
      const validatedData = insertReportTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateReportTemplate(id, validatedData);

      if (!updatedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(updatedTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Eliminar plantilla de reporte
  app.delete("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });

    try {
      // Verificar si la plantilla existe
      const template = await storage.getReportTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Intentar eliminar la plantilla
      const deleted = await storage.deleteReportTemplate(id);

      if (!deleted) {
        return res.status(409).json({ 
          message: "Cannot delete template. It may be in use by existing quotations." 
        });
      }

      res.status(200).json({ 
        message: "Template deleted successfully", 
        id
      });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Ruta para obtener asignaciones de roles para una plantilla específica
  app.get("/api/templates/:id/role-assignments", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });

    try {
      const assignments = await storage.getTemplateRoleAssignments(id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template role assignments" });
    }
  });

  // ---------- RUTAS PARA MULTIPLICADORES DE COSTOS ----------

  // Obtener todos los multiplicadores de costos
  app.get("/api/cost-multipliers", requireAuth, async (req, res) => {
    try {
      const multipliers = await storage.getCostMultipliers();
      res.json(multipliers);
    } catch (error) {
      console.error("Error fetching cost multipliers:", error);
      res.status(500).json({ message: "Failed to fetch cost multipliers" });
    }
  });

  // Obtener multiplicadores por categoría
  app.get("/api/cost-multipliers/category/:category", requireAuth, async (req, res) => {
    const category = req.params.category;

    try {
      const multipliers = await storage.getCostMultipliersByCategory(category);
      res.json(multipliers);
    } catch (error) {
      console.error("Error fetching cost multipliers by category:", error);
      res.status(500).json({ message: "Failed to fetch cost multipliers by category" });
    }
  });

  // Actualizar multiplicador de costo
  app.patch("/api/cost-multipliers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid multiplier ID" });

    try {
      const { multiplier, label, description, isActive } = req.body;

      const updateData: any = {};
      if (multiplier !== undefined) updateData.multiplier = parseFloat(multiplier);
      if (label !== undefined) updateData.label = label;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await storage.updateCostMultiplier(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Cost multiplier not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating cost multiplier:", error);
      res.status(500).json({ message: "Failed to update cost multiplier" });
    }
  });

  // Crear nuevo multiplicador de costo
  app.post("/api/cost-multipliers", requireAuth, async (req, res) => {
    try {
      const { category, subcategory, multiplier, label, description } = req.body;

      if (!category || !subcategory || !label || multiplier === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const newMultiplier = await storage.createCostMultiplier({
        category,
        subcategory,
        multiplier: parseFloat(multiplier),
        label,
        description,
        isActive: true
      });

      res.status(201).json(newMultiplier);
    } catch (error) {
      console.error("Error creating cost multiplier:", error);
      res.status(500).json({ message: "Failed to create cost multiplier" });
    }
  });

  // Eliminar multiplicador de costo
  app.delete("/api/cost-multipliers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid multiplier ID" });

    try {
      const deleted = await storage.deleteCostMultiplier(id);

      if (!deleted) {
        return res.status(404).json({ message: "Cost multiplier not found" });
      }

      res.json({ message: "Cost multiplier deleted successfully" });
    } catch (error) {
      console.error("Error deleting cost multiplier:", error);
      res.status(500).json({ message: "Failed to delete cost multiplier" });
    }
  });

  // Quotations routes
  app.get("/api/quotations", requireAuth, async (_, res) => {
    const quotations = await storage.getQuotations();
    res.json(quotations);
  });

  app.get("/api/quotations/client/:clientId", requireAuth, async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

    const quotations = await storage.getQuotationsByClient(clientId);
    res.json(quotations);
  });

  app.get("/api/quotations/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    console.log('🔍 Getting quotation with ID:', req.params.id, 'parsed:', id);
    
    if (isNaN(id)) {
      console.error('❌ Invalid quotation ID:', req.params.id);
      return res.status(400).json({ message: "Invalid quotation ID" });
    }

    const quotation = await storage.getQuotation(id);
    if (!quotation) {
      console.error('❌ Quotation not found for ID:', id);
      return res.status(404).json({ message: "Quotation not found" });
    }

    console.log('✅ Quotation found:', quotation.id, quotation.projectName);
    res.json(quotation);
  });

  app.post("/api/quotations", requireAuth, async (req, res) => {
    try {
      console.log('📥 POST /api/quotations - Request body:', JSON.stringify(req.body, null, 2));

      try {
        // Validar datos con Zod
        console.log('🔍 Validating quotation data...');
        const validatedData = insertQuotationSchema.parse(req.body);
        console.log('✅ Validation successful:', JSON.stringify(validatedData, null, 2));

        // Crear cotización
        const quotation = await storage.createQuotation(validatedData);

        res.status(201).json(quotation);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error("Error de validación Zod:", JSON.stringify(validationError.errors, null, 2));
          return res.status(400).json({ 
            message: "Invalid quotation data", 
            errors: validationError.errors 
          });
        }
        throw validationError; // Re-lanzar para que sea capturado por el catch externo
      }
    } catch (error) {
      console.error("Error al crear cotización:", error);
      res.status(500).json({ message: "Failed to create quotation", error: String(error) });
    }
  });

  // Ruta PUT para actualizar cotización completa (para ediciones)
  app.put("/api/quotations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('📥 PUT /api/quotations/:id - ID:', id);
      console.log('📥 PUT /api/quotations/:id - Request body:', JSON.stringify(req.body, null, 2));
      
      if (isNaN(id)) return res.status(400).json({ message: "Invalid quotation ID" });

      // Validar que la cotización existe
      const existingQuotation = await storage.getQuotation(id);
      if (!existingQuotation) {
        console.log('❌ Quotation not found for ID:', id);
        return res.status(404).json({ message: "Quotation not found" });
      }
      console.log('✅ Existing quotation found:', existingQuotation.id);

      try {
        // Validar datos con Zod
        console.log('🔍 Validating quotation data for update...');
        const validatedData = insertQuotationSchema.parse(req.body);

        // Actualizar cotización
        const updatedQuotation = await storage.updateQuotation(id, validatedData);

        res.json(updatedQuotation);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error("Error de validación Zod en actualización:", JSON.stringify(validationError.errors, null, 2));
          return res.status(400).json({ 
            message: "Invalid quotation data", 
            errors: validationError.errors 
          });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error al actualizar cotización:", error);
      res.status(500).json({ message: "Failed to update quotation", error: String(error) });
    }
  });

  app.patch("/api/quotations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const validatedData = insertQuotationSchema.partial().parse(req.body);
      const updatedQuotation = await storage.updateQuotation(id, validatedData);

      if (!updatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      res.json(updatedQuotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid quotation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });

  app.patch("/api/quotations/:id/status", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const { status } = req.body;

      if (!status) return res.status(400).json({ message: "Status is required" });

      // Get the current quotation to check its status
      const currentQuotation = await storage.getQuotation(id);
      if (!currentQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Check if status is changing from "in-negotiation" to "approved"
      let updateData: any = { status };
      
      if (currentQuotation.status === 'in-negotiation' && status === 'approved') {
        // Get the last negotiation entry
        const negotiationHistory = await storage.getNegotiationHistory(id);
        
        if (negotiationHistory && negotiationHistory.length > 0) {
          // Get the most recent negotiation (first in the array since it's ordered by createdAt DESC)
          const lastNegotiation = negotiationHistory[0];
          
          // Update the quotation with the last negotiated price
          updateData.totalAmount = lastNegotiation.newPrice;
          
          // Also update the markup amount to maintain the correct calculation
          const operationalSubtotal = currentQuotation.baseCost + currentQuotation.complexityAdjustment;
          updateData.markupAmount = lastNegotiation.newPrice - operationalSubtotal;
          
          console.log(`[API] Updating quotation ${id} from negotiated price: ${currentQuotation.totalAmount} → ${lastNegotiation.newPrice}`);
        }
      }

      const updatedQuotation = await storage.updateQuotation(id, updateData);

      if (!updatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      res.json(updatedQuotation);
    } catch (error) {
      console.error(`[API] Error actualizando estado de cotización ID ${id}:`, error);
      res.status(500).json({ message: "Failed to update quotation status", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Eliminar una cotización
  app.delete("/api/quotations/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {

      // 1. Verificar que la cotización exista
      const quotation = await storage.getQuotation(id);
      if (!quotation) {
        return res.status(404).json({ 
          success: false, 
          message: "La cotización no existe" 
        });
      }

      // 2. Verificar si la cotización está asociada a proyectos activos
      const activeProjects = await storage.getActiveProjectsByQuotationId(id);

      if (activeProjects.length > 0) {

        const projectInfo = activeProjects.map(p => ({ id: p.id, name: `Proyecto ID ${p.id}` }));

        return res.status(409).json({ 
          success: false, 
          message: "No se puede eliminar esta cotización porque está siendo utilizada por proyectos activos", 
          projects: projectInfo
        });
      }

      // 3. Proceder con la eliminación
      // First delete team members associated with the quotation
      const teamMembers = await storage.getQuotationTeamMembers(id);
      for (const member of teamMembers) {
        await storage.deleteQuotationTeamMember(member.id);
      }
      const success = await storage.deleteQuotation(id);

      if (!success) {
        return res.status(500).json({ 
          success: false, 
          message: "Ocurrió un error al intentar eliminar la cotización" 
        });
      }

      res.json({ 
        success: true, 
        message: "Cotización eliminada exitosamente",
        id
      });
    } catch (error) {
      console.error("[API] Error eliminando cotización:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al eliminar la cotización" 
      });
    }
  });

  // Actualizar el cliente asociado a una cotización
  app.patch("/api/quotations/:id/client", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const { clientId } = req.body;
      if (!clientId || isNaN(clientId)) {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

      // Verificar que el cliente existe
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Actualizar la cotización con el nuevo cliente
      const updatedQuotation = await storage.updateQuotation(id, { clientId });

      if (!updatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      res.json(updatedQuotation);
    } catch (error) {
      console.error("Error updating quotation client:", error);
      res.status(500).json({ message: "Failed to update quotation client" });
    }
  });

  // ==================== NEGOTIATION HISTORY ROUTES ====================
  
  // Get negotiation history for a quotation
  app.get("/api/quotations/:id/negotiation-history", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const history = await storage.getNegotiationHistory(quotationId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching negotiation history:", error);
      res.status(500).json({ message: "Failed to fetch negotiation history" });
    }
  });

  // Create new negotiation history entry
  app.post("/api/quotations/:id/negotiation-history", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const quotation = await storage.getQuotation(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const {
        newPrice,
        previousScope,
        newScope,
        previousTeam,
        newTeam,
        changeType,
        clientFeedback,
        internalNotes,
        negotiationReason,
        proposalLink
      } = req.body;

      // Calculate adjustment percentage
      const adjustmentPercentage = ((newPrice - quotation.totalAmount) / quotation.totalAmount) * 100;

      const negotiationEntry = await storage.createNegotiationHistory({
        quotationId,
        previousPrice: quotation.totalAmount,
        newPrice,
        previousScope,
        newScope,
        previousTeam,
        newTeam,
        changeType,
        clientFeedback,
        internalNotes,
        negotiationReason,
        proposalLink,
        adjustmentPercentage,
        createdBy: req.user?.id
      });

      res.status(201).json(negotiationEntry);
    } catch (error) {
      console.error("Error creating negotiation history:", error);
      res.status(500).json({ message: "Failed to create negotiation history" });
    }
  });

  // Get latest negotiation for a quotation
  app.get("/api/quotations/:id/latest-negotiation", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const latest = await storage.getLatestNegotiation(quotationId);
      res.json(latest || null);
    } catch (error) {
      console.error("Error fetching latest negotiation:", error);
      res.status(500).json({ message: "Failed to fetch latest negotiation" });
    }
  });

  // Asignar cliente a un proyecto específico
  app.patch("/api/active-projects/:id/assign-client", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const { clientId } = req.body;
      if (!clientId || isNaN(clientId)) {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

      // Verificar que el cliente existe
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Obtener el proyecto
      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Obtener la cotización actual
      const currentQuotation = await storage.getQuotation(project.quotationId);
      if (!currentQuotation) {
        return res.status(404).json({ message: "Original quotation not found" });
      }

      let updatedProject;

      // Verificar si hay otros proyectos que usan la misma cotización
      const projectsWithSameQuotation = await storage.getProjectsByQuotationId(project.quotationId);

      if (projectsWithSameQuotation.length > 1) {
        // Si hay múltiples proyectos que usan la misma cotización, crear una copia

        // Crear una copia de la cotización con el nuevo cliente
        const { id, createdAt, updatedAt, ...quotationData } = currentQuotation;
        const newQuotation = nullToUndefined({ 
          ...quotationData, 
          clientId
        });
        const createdQuotation = await storage.createQuotation(newQuotation);

        if (!createdQuotation) {
          return res.status(500).json({ message: "Failed to create new quotation" });
        }

        // Actualizar el proyecto para usar la nueva cotización
        updatedProject = await storage.updateActiveProject(projectId, { 
          quotationId: createdQuotation.id as any
        });
      } else {
        // Si solo hay un proyecto, simplemente actualizar el cliente en la cotización existente
        await storage.updateQuotation(project.quotationId, { clientId });
        updatedProject = await storage.getActiveProject(projectId);
      }

      if (!updatedProject) {
        return res.status(404).json({ message: "Failed to update project" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error assigning client to project:", error);
      res.status(500).json({ message: "Failed to assign client to project" });
    }
  });

  // Quotation team members routes
  app.get("/api/quotation-team/:quotationId", async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      console.log(`🔍 Fetching team members for quotation ID: ${quotationId}`);
      const members = await storage.getQuotationTeamMembers(quotationId);
      console.log(`👥 Found ${members.length} team members:`, members);
      res.json(members);
    } catch (error) {
      console.error(`❌ Error fetching team members for quotation ${quotationId}:`, error);
      res.status(500).json({ message: "Failed to fetch team members", error: String(error) });
    }
  });

  // Assign personnel to a quotation team member
  app.patch("/api/quotation-team/:quotationId/assign-personnel", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const { roleId, personnelId, hours, rate } = req.body;
      
      if (!roleId || !personnelId || !hours || !rate) {
        return res.status(400).json({ message: "roleId, personnelId, hours, and rate are required" });
      }

      console.log(`🔧 Assigning personnel ${personnelId} to role ${roleId} in quotation ${quotationId}`);
      
      // Find the team member with this role in the quotation
      const teamMembers = await storage.getQuotationTeamMembers(quotationId);
      const targetMember = teamMembers.find(member => member.roleId === roleId && member.personnelId === null);
      
      if (!targetMember) {
        return res.status(404).json({ message: "Role-only team member not found" });
      }

      // Update the team member with personnel assignment
      const updatedMember = await storage.updateQuotationTeamMember(targetMember.id, {
        personnelId: personnelId,
        hours: hours,
        rate: rate,
        cost: hours * rate
      });

      console.log(`✅ Personnel assigned successfully:`, updatedMember);
      res.json(updatedMember);
    } catch (error) {
      console.error("Error assigning personnel to quotation team:", error);
      res.status(500).json({ message: "Failed to assign personnel" });
    }
  });

  app.post("/api/quotation-team", requireAuth, async (req, res) => {
    try {
      console.log('📥 Creating team member with data:', JSON.stringify(req.body, null, 2));

      // CRITICAL FIX: No auto-asignar personal cuando se cotiza solo con roles
      // Si el usuario eligió cotizar con roles, respetar esa decisión
      let personnelId = req.body.personnelId || null;

      // Preparar datos asegurando que cost esté presente y personnelId sea válido
      const teamMemberData = {
        ...req.body,
        personnelId: personnelId,
        roleId: req.body.roleId, // CRITICAL: Explicitly preserve the roleId from request
        cost: req.body.cost || (req.body.hours * req.body.rate) || 0
      };

      console.log('🔍 CRITICAL DEBUG - Request roleId:', req.body.roleId);
      console.log('🔍 CRITICAL DEBUG - TeamMemberData roleId:', teamMemberData.roleId);
      console.log('📝 Final team member data:', teamMemberData);

      try {
        // Validar datos con Zod
        const validatedData = insertQuotationTeamMemberSchema.parse(teamMemberData);

        // VALIDACIÓN OPCIONAL DE TARIFAS - Solo advertir si hay diferencias grandes
        if (validatedData.personnelId) {
          const personnel = await storage.getPersonnelById(validatedData.personnelId);
          if (personnel && personnel.hourlyRate !== validatedData.rate) {
            // Permitir la asignación con tarifa personalizada
            console.log(`⚠️ Using custom rate ${validatedData.rate} instead of personnel rate ${personnel.hourlyRate}`);
          }
        }

        // Verificar si ya existe un miembro exactamente igual para evitar duplicados
        const existingMembers = await storage.getQuotationTeamMembers(validatedData.quotationId);

        // Verificar duplicados exactos
        const isDuplicate = existingMembers.some(existing => 
          existing.roleId === validatedData.roleId &&
          existing.personnelId === validatedData.personnelId && 
          existing.hours === validatedData.hours && 
          existing.rate === validatedData.rate
        );

        if (isDuplicate) {
          // Simplemente devolver el primer miembro duplicado encontrado
          const duplicateMember = existingMembers.find(existing => 
            existing.roleId === validatedData.roleId &&
            existing.personnelId === validatedData.personnelId && 
            existing.hours === validatedData.hours && 
            existing.rate === validatedData.rate
          );
          console.log('📋 Returning existing duplicate member');
          return res.status(200).json(duplicateMember);
        }

        // Si no es duplicado, crear el nuevo miembro
        const member = await storage.createQuotationTeamMember(validatedData);
        console.log('✅ Team member created successfully');

        res.status(201).json(member);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error("Error de validación Zod en miembro:", JSON.stringify(validationError.errors, null, 2));
          return res.status(400).json({ 
            message: "Invalid team member data", 
            errors: validationError.errors 
          });
        }
        throw validationError; // Re-lanzar para que sea capturado por el catch externo
      }
    } catch (error) {
      console.error("Error al crear miembro del equipo:", error);
      res.status(500).json({ message: "Failed to add team member", error: String(error) });
    }
  });

  // Eliminar todos los miembros del equipo de una cotización
  app.delete("/api/quotation-team/:quotationId", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    // Delete team members associated with the quotation
    const teamMembers = await storage.getQuotationTeamMembers(quotationId);
    for (const member of teamMembers) {
      await storage.deleteQuotationTeamMember(member.id);
    }
    res.status(204).send();
  });

  // Eliminar un miembro específico del equipo por su ID
  app.delete("/api/quotation-team-member/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid team member ID" });

    try {
      // Usamos el método de storage para manejar la eliminación en lugar de acceder directamente a la base de datos
      await storage.deleteQuotationTeamMemberById(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error al eliminar miembro del equipo ID ${id}:`, error);
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });

  // Ruta alternativa para la misma funcionalidad (mantener compatibilidad con el cliente)
  app.delete("/api/quotation-team/by-quotation/:quotationId", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    // Delete team members associated with the quotation
    const teamMembers = await storage.getQuotationTeamMembers(quotationId);
    for (const member of teamMembers) {
      await storage.deleteQuotationTeamMember(member.id);
    }
    res.status(204).send();
  });

  // Option lists
  app.get("/api/options/analysis-types", async (_, res) => {
    const types = await storage.getAnalysisTypes();
    res.json(types);
  });

  app.get("/api/options/project-types", async (_, res) => {
    const types = await storage.getProjectTypes();
    res.json(types);
  });

  app.get("/api/options/project-duration/:projectType", async (req, res) => {
    const projectType = req.params.projectType;
    const options = await storage.getProjectDurationOptions(projectType);
    res.json(options);
  });

  app.get("/api/options/mentions-volume", async (_, res) => {
    const options = await storage.getMentionsVolumeOptions();
    res.json(options);
  });

  app.get("/api/options/countries-covered", async (_, res) => {
    const options = await storage.getCountriesCoveredOptions();
    res.json(options);
  });

  app.get("/api/options/client-engagement", async (_, res) => {
    const options = await storage.getClientEngagementOptions();
    res.json(options);
  });

  // Template role assignments routes
  app.get("/api/template-roles/:templateId", async (req, res) => {
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ message: "Invalid template ID" });

    const assignments = await storage.getTemplateRoleAssignments(templateId);
    res.json(assignments);
  });

  // Ruta alternativa para asignaciones de roles (para compatibilidad con roles recomendados)
  app.get("/api/report-templates/:templateId/role-assignments", async (req, res) => {
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ message: "Invalid template ID" });

    const assignments = await storage.getTemplateRoleAssignments(templateId);
    res.json(assignments);
  });

  app.get("/api/template-roles/:templateId/with-roles", async (req, res) => {
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ message: "Invalid template ID" });

    const assignmentsWithRoles = await storage.getTemplateRoleAssignmentsWithRoles(templateId);
    res.json(assignmentsWithRoles);
  });

  app.post("/api/template-roles", async (req, res) => {
    try {
      const validatedData = insertTemplateRoleAssignmentSchema.parse(req.body);
      const assignment = await storage.createTemplateRoleAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template role assignment" });
    }
  });

  app.patch("/api/template-roles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid assignment ID" });

    try {
      const validatedData = insertTemplateRoleAssignmentSchema.partial().parse(req.body);
      const updatedAssignment = await storage.updateTemplateRoleAssignment(id, validatedData);

      if (!updatedAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json(updatedAssignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template role assignment" });
    }
  });

  app.delete("/api/template-roles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid assignment ID" });

    try {
      const success = await storage.deleteTemplateRoleAssignment(id);

      if (!success) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ success: true, message: "Template role assignment deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template role assignment" });
    }
  });

  app.delete("/api/template-roles/template/:templateId", async (req, res) => {
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ message: "Invalid template ID" });

    try {
      await storage.deleteTemplateRoleAssignments(templateId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template role assignments" });
    }
  });

  // ---------- RUTAS PARA VARIANTES DE COTIZACIÓN ----------

  // Get all variants for a quotation
  app.get("/api/quotations/:quotationId/variants", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      console.log(`🔍 Fetching variants for quotation ID: ${quotationId}`);
      const variants = await storage.getQuotationVariants(quotationId);
      console.log(`📊 Found ${variants.length} variants:`, variants);
      res.json(variants);
    } catch (error) {
      console.error(`❌ Error fetching variants for quotation ${quotationId}:`, error);
      res.status(500).json({ message: "Failed to fetch variants", error: String(error) });
    }
  });

  // Get a specific variant
  app.get("/api/quotation-variants/:variantId", requireAuth, async (req, res) => {
    const variantId = parseInt(req.params.variantId);
    if (isNaN(variantId)) return res.status(400).json({ message: "Invalid variant ID" });

    try {
      const variant = await storage.getQuotationVariant(variantId);
      if (!variant) {
        return res.status(404).json({ message: "Variant not found" });
      }
      res.json(variant);
    } catch (error) {
      console.error(`❌ Error fetching variant ${variantId}:`, error);
      res.status(500).json({ message: "Failed to fetch variant", error: String(error) });
    }
  });

  // Create a new quotation variant
  app.post("/api/quotations/:quotationId/variants", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });

    try {
      const validatedData = insertQuotationVariantSchema.parse({
        ...req.body,
        quotationId
      });

      console.log('📝 Creating quotation variant:', validatedData);
      const variant = await storage.createQuotationVariant(validatedData);
      console.log('✅ Quotation variant created:', variant);
      res.status(201).json(variant);
    } catch (error) {
      console.error("❌ Error creating quotation variant:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid variant data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create quotation variant" });
    }
  });

  // Update a quotation variant
  app.patch("/api/quotation-variants/:variantId", requireAuth, async (req, res) => {
    const variantId = parseInt(req.params.variantId);
    if (isNaN(variantId)) return res.status(400).json({ message: "Invalid variant ID" });

    try {
      const validatedData = insertQuotationVariantSchema.partial().parse(req.body);
      const updatedVariant = await storage.updateQuotationVariant(variantId, validatedData);

      if (!updatedVariant) {
        return res.status(404).json({ message: "Variant not found" });
      }

      res.json(updatedVariant);
    } catch (error) {
      console.error("❌ Error updating quotation variant:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid variant data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update quotation variant" });
    }
  });

  // Delete a quotation variant
  app.delete("/api/quotation-variants/:variantId", requireAuth, async (req, res) => {
    const variantId = parseInt(req.params.variantId);
    if (isNaN(variantId)) return res.status(400).json({ message: "Invalid variant ID" });

    try {
      const success = await storage.deleteQuotationVariant(variantId);
      if (!success) {
        return res.status(404).json({ message: "Variant not found" });
      }
      res.json({ success: true, message: "Quotation variant deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting quotation variant:", error);
      res.status(500).json({ message: "Failed to delete quotation variant" });
    }
  });

  // Get team members for a specific variant
  app.get("/api/quotation-variants/:variantId/team", requireAuth, async (req, res) => {
    const variantId = parseInt(req.params.variantId);
    if (isNaN(variantId)) return res.status(400).json({ message: "Invalid variant ID" });

    try {
      console.log(`🔍 Fetching team members for variant ID: ${variantId}`);
      const members = await storage.getQuotationTeamMembersByVariant(variantId);
      console.log(`👥 Found ${members.length} team members for variant:`, members);
      res.json(members);
    } catch (error) {
      console.error(`❌ Error fetching team members for variant ${variantId}:`, error);
      res.status(500).json({ message: "Failed to fetch team members", error: String(error) });
    }
  });

  // Select a quotation variant (mark as selected and update quotation)
  app.patch("/api/quotations/:quotationId/variants/:variantId/select", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    const variantId = parseInt(req.params.variantId);
    
    if (isNaN(quotationId)) return res.status(400).json({ message: "Invalid quotation ID" });
    if (isNaN(variantId)) return res.status(400).json({ message: "Invalid variant ID" });

    try {
      console.log(`🎯 Selecting variant ${variantId} for quotation ${quotationId}`);
      
      // First, unselect all variants for this quotation
      await db.update(quotationVariants)
        .set({ isSelected: false })
        .where(eq(quotationVariants.quotationId, quotationId));

      // Then select the chosen variant
      await db.update(quotationVariants)
        .set({ isSelected: true })
        .where(and(
          eq(quotationVariants.id, variantId),
          eq(quotationVariants.quotationId, quotationId)
        ));

      console.log(`✅ Variant ${variantId} selected for quotation ${quotationId}`);
      res.json({ success: true, message: "Variant selected successfully" });
      
    } catch (error) {
      console.error(`❌ Error selecting variant ${variantId} for quotation ${quotationId}:`, error);
      res.status(500).json({ message: "Failed to select variant", error: String(error) });
    }
  });

  // ---------- RUTAS PARA PROYECTOS ACTIVOS ----------

  // Obtener conteo de proyectos activos principales
  app.get("/api/active-projects/count", requireAuth, async (req, res) => {
    try {
      // Usar consulta SQL directa para mayor control
      const { rows } = await pool.query(`
        SELECT COUNT(*) as count 
        FROM active_projects 
        WHERE parent_project_id IS NULL 
        AND status = 'active'
      `);

      const count = parseInt(rows[0]?.count || '0');
      console.log(`Conteo de proyectos activos: ${count}`);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching active projects count:", error);
      res.status(500).json({ message: "Failed to fetch active projects count", count: 0 });
    }
  });

  // Debug endpoint para verificar datos reales
  app.get("/api/active-projects/debug", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, quotation_id, status, parent_project_id, is_always_on_macro, created_at
        FROM active_projects 
        ORDER BY id
      `);
      
      console.log('Todos los proyectos en DB:', rows);
      
      const activeMainProjects = rows.filter(p => 
        p.parent_project_id === null && p.status === 'active'
      );
      
      console.log('Proyectos principales activos:', activeMainProjects);
      
      res.json({
        totalProjects: rows.length,
        allProjects: rows,
        activeMainProjects: activeMainProjects,
        activeMainCount: activeMainProjects.length
      });
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Obtener todos los proyectos activos
  app.get("/api/active-projects", requireAuth, async (req, res) => {
    try {
      // Obtener parámetros de consulta
      const showSubprojects = req.query.showSubprojects === 'true';
      const timeFilter = req.query.timeFilter as string;
      
      console.log(`🔍 Active Projects API called with:`, { 
        showSubprojects, 
        timeFilter 
      });

      // Función para obtener el último precio de Google Sheets para un proyecto
      const getLatestGoogleSheetsPrice = async (projectName: string, clientName: string): Promise<number | null> => {
        console.log(`🔍 getLatestGoogleSheetsPrice called for: ${projectName} - ${clientName}`);
        try {
          // Buscar el proyecto en google_sheets_projects
          const googleProject = await db
            .select()
            .from(googleSheetsProjects)
            .where(sql`LOWER(project_name) = LOWER(${projectName}) AND LOWER(client_name) = LOWER(${clientName})`)
            .limit(1);
          
          console.log(`🔍 Found ${googleProject.length} Google project matches`);
          if (googleProject.length === 0) {
            console.log(`❌ No Google Sheets project found for: ${projectName} - ${clientName}`);
            return null;
          }
          console.log(`✅ Found Google project ID: ${googleProject[0].id}`);
          
          // Buscar el último registro de billing para este proyecto usando SQL directo
          try {
            const billingResult = await db.execute(sql`
              SELECT amount_usd, billing_year, billing_month
              FROM google_sheets_project_billing
              WHERE project_id = ${googleProject[0].id}
              ORDER BY billing_year DESC, billing_month DESC
              LIMIT 1
            `);
            
            console.log(`🔍 Found ${billingResult.rows.length} billing records`);
            if (billingResult.rows.length > 0) {
              const record = billingResult.rows[0];
              const latestPrice = record.amount_usd as number;
              console.log(`💰 Latest price from billing: $${latestPrice} (${record.billing_year}-${record.billing_month})`);
              return latestPrice;
            }
          } catch (billingError) {
            console.log(`⚠️ Billing query failed, using original price:`, billingError);
          }
          
          // Si no hay registros de billing o falló, usar el precio original
          const originalPrice = googleProject[0].originalAmountUsd || null;
          console.log(`💰 Using original price: $${originalPrice}`);
          return originalPrice;
        } catch (error) {
          console.error(`❌ Error getting latest Google Sheets price for ${projectName}:`, error);
          return null;
        }
      };

      // Obtener todos los proyectos
      const allProjects = await storage.getActiveProjects();

      // Filtrar los proyectos según el parámetro
      let projects;

      if (!showSubprojects) {
        // Modo normal - mostrar solo proyectos padres y proyectos sin padre
        projects = allProjects.filter(project => {
          const result = project.parentProjectId === null;
          return result;
        });
      } else {
        // Modo completo - mostrar todos los proyectos
        projects = allProjects;
      }

      // Filtrar por período temporal si se especifica - basado en ACTIVIDAD no en fecha de inicio
      if (timeFilter && timeFilter !== 'all') {
        const dateRange = getDateRangeForFilter(timeFilter);
        if (dateRange) {
          console.log(`🔍 Applying activity-based temporal filter:`, { 
            timeFilter, 
            dateRange: {
              startDate: dateRange.startDate?.toISOString(),
              endDate: dateRange.endDate?.toISOString()
            }
          });
          
          // Obtener IDs de proyectos que tuvieron actividad en el período
          const projectsWithActivity = await db
            .select({ projectId: timeEntries.projectId })
            .from(timeEntries)
            .where(sql`time_entries.date >= ${dateRange.startDate} AND time_entries.date <= ${dateRange.endDate}`)
            .groupBy(timeEntries.projectId);
          
          const activeProjectIds = new Set(projectsWithActivity.map(p => p.projectId));
          
          console.log(`🔍 Found ${activeProjectIds.size} projects with activity in period`);
          
          // Filtrar proyectos para mostrar solo los que tuvieron actividad
          projects = projects.filter(project => activeProjectIds.has(project.id));
          
          console.log(`🔍 Projects after activity-based filtering: ${projects.length}`);

          // Enriquecer proyectos con datos calculados para el período específico
          for (let i = 0; i < projects.length; i++) {
            const project = projects[i];
            
            // Obtener time entries del período para este proyecto
            const periodTimeEntries = await db
              .select()
              .from(timeEntries)
              .where(sql`time_entries.project_id = ${project.id} AND time_entries.date >= ${dateRange.startDate} AND time_entries.date <= ${dateRange.endDate}`);
            
            // Calcular métricas del período según el tipo de proyecto
            let periodHours = periodTimeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
            let periodCost = periodTimeEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
            let periodBilling = 0;
            
            // Determinar tipo de proyecto
            const isAlwaysOn = project.quotation?.projectType === 'always-on' || 
                             project.quotation?.projectType === 'fee-mensual' ||
                             project.isAlwaysOnMacro;
            
            if (isAlwaysOn) {
              // Para proyectos Always-On: Calcular cuántos meses completos abarca el filtro
              const monthsInPeriod = getMonthsInFilter(timeFilter);
              
              if (monthsInPeriod > 0) {
                // Valores mensuales base del proyecto
                const monthlyAmount = project.quotation?.totalAmount || 0;
                const monthlyHours = project.quotation?.totalHours || 0;
                const monthlyCost = project.quotation?.baseCost || monthlyAmount * 0.7; // Estimación si no hay baseCost
                
                // Multiplicar por el número de meses del período
                periodBilling = monthlyAmount * monthsInPeriod;
                periodCost = monthlyCost * monthsInPeriod;
                
                // Para las horas, usar las registradas realmente (más preciso)
                console.log(`📊 Always-On project ${project.id} - ${monthsInPeriod} months:`, {
                  monthlyAmount,
                  periodBilling,
                  actualHours: periodHours,
                  monthlyHours,
                  estimatedHours: monthlyHours * monthsInPeriod
                });
              } else {
                // Fallback a cálculo basado en registros reales
                const billableEntries = periodTimeEntries.filter(entry => entry.billable);
                periodBilling = billableEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
              }
            } else {
              // Para proyectos One-Shot: Solo usar registros reales del período
              const billableEntries = periodTimeEntries.filter(entry => entry.billable);
              periodBilling = billableEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
              
              console.log(`📊 One-Shot project ${project.id} - actual period data:`, {
                periodHours,
                periodCost,
                periodBilling
              });
            }
            
            // Añadir datos del período al proyecto
            projects[i] = {
              ...project,
              periodMetrics: {
                hours: periodHours,
                cost: periodCost,
                billing: periodBilling,
                entries: periodTimeEntries.length,
                dateRange: {
                  start: dateRange.startDate,
                  end: dateRange.endDate
                }
              }
            };
          }
          
          console.log(`📊 Enriched ${projects.length} projects with period metrics`);
        }
      }

      // [TEMPORAL] Precios dinámicos deshabilitados - problema con esquema de Google Sheets billing
      console.log(`💰 Using original quotation prices (dynamic pricing temporarily disabled)`);
      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        if (project.quotation) {
          // Marcar todos los proyectos como usando precios originales
          projects[i] = {
            ...project,
            quotation: {
              ...project.quotation,
              priceSource: 'original_quotation'
            }
          };
        }
      }

      res.json(projects);
    } catch (error) {
      console.error("Error fetching active projects:", error);
      res.status(500).json({ message: "Failed to fetch active projects" });
    }
  });

  // Obtener proyectos activos por cliente
  app.get("/api/active-projects/client/:clientId", requireAuth, async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

    try {
      const projects = await storage.getActiveProjectsByClient(clientId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching client active projects:", error);
      res.status(500).json({ message: "Failed to fetch client active projects" });
    }
  });

  app.get("/api/active-projects/quotation/:quotationId", requireAuth, async (req, res) => {
    const quotationId = parseInt(req.params.quotationId);
    if (isNaN(quotationId)) return res.status(400).json({ message: "ID de cotización inválido" });

    try {
      const projects = await storage.getProjectsByQuotationId(quotationId);
      res.json(projects);
    } catch (error) {
      console.error("Error obteniendo proyectos por cotización:", error);
      res.status(500).json({ message: "Error al obtener proyectos por cotización" });
    }
  });

  // Obtener registros de tiempo por cliente
  app.get("/api/time-entries/client/:clientId", async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

    try {
      const entries = await storage.getTimeEntriesByClient(clientId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching client time entries:", error);
      res.status(500).json({ message: "Failed to fetch client time entries" });
    }
  });

  // Obtener resumen de costos por cliente
  app.get("/api/clients/:clientId/cost-summary", async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

    try {
      const summary = await storage.getClientCostSummary(clientId);
      res.json(summary);
    } catch (error) {
      console.error("Error getting client cost summary:", error);
      res.status(500).json({ message: "Failed to calculate client cost summary" });
    }
  });

  // ==================== ENDPOINT ELIMINADO - CONSOLIDADO ARRIBA ====================
  // El endpoint /api/projects/:id/complete-data ya está implementado arriba con autenticación

  // Obtener un proyecto activo específico (mantenido para compatibilidad)
  app.get("/api/active-projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const project = await storage.getActiveProject(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Calcular horas estimadas desde los miembros del equipo de la cotización
      let estimatedHours = 0;
      if (project.quotation) {
        try {
          const teamMembers = await storage.getQuotationTeamMembers(project.quotation.id);
          estimatedHours = teamMembers.reduce((total, member) => total + (member.hours || 0), 0);

        } catch (error) {
          console.error("Error calculando horas estimadas:", error);
        }
      }

      // Si es un proyecto macro, obtener sus subproyectos
      if (project.isAlwaysOnMacro) {
        try {
          const subprojects = await storage.getSubprojectsByParentId(id);
          // Agregamos los subproyectos a un nuevo objeto para evitar problemas de tipado
          return res.json({
            ...project,
            quotation: {
              ...project.quotation,
              estimatedHours
            },
            subProjects: subprojects
          });
        } catch (error) {
          console.error("Error obteniendo subproyectos:", error);
          // Aún devolvemos el proyecto principal si hay un error con los subproyectos
        }
      }

      res.json({
        ...project,
        quotation: {
          ...project.quotation,
          estimatedHours
        }
      });
    } catch (error) {
      console.error("Error fetching active project:", error);
      res.status(500).json({ message: "Failed to fetch active project" });
    }
  });

  // Obtener subproyectos por ID de proyecto padre
  app.get("/api/active-projects/parent/:parentId", requireAuth, async (req, res) => {
    const parentId = parseInt(req.params.parentId);
    if (isNaN(parentId)) return res.status(400).json({ message: "ID de proyecto padre inválido" });

    try {
      const subprojects = await storage.getSubprojectsByParentId(parentId);
      res.json(subprojects);
    } catch (error) {
      console.error("Error obteniendo subproyectos:", error);
      res.status(500).json({ message: "Error al obtener subproyectos" });
    }
  });

  // Actualizar estado de finalización de subproyecto
  app.patch("/api/active-projects/:id/status", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const { completionStatus, completedDate } = req.body;

      if (!completionStatus) {
        return res.status(400).json({ message: "Completion status is required" });
      }

      const updateData: any = { completionStatus };
      if (completedDate) {
        updateData.completedDate = completedDate;
      }

      const updatedProject = await storage.updateActiveProject(id, updateData);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project completion status:", error);
      res.status(500).json({ message: "Failed to update project completion status" });
    }
  });

  // Eliminar proyecto activo
  app.delete("/api/active-projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      console.log('ID de proyecto inválido:', req.params.id);
      return res.status(400).json({ message: "Invalid project ID" });
    }

    console.log(`Iniciando eliminación del proyecto ${id}`);

    try {
      // Verificar que el proyecto existe
      const project = await storage.getActiveProject(id);
      if (!project) {
        console.log(`Proyecto ${id} no encontrado`);
        return res.status(404).json({ message: "Project not found" });
      }

      console.log(`Proyecto encontrado: ${project.quotation?.projectName || 'Sin nombre'}`);

      // Si es un proyecto macro, verificar si tiene subproyectos
      if (project.isAlwaysOnMacro) {
        const subprojects = await storage.getSubprojectsByParentId(id);
        console.log(`Eliminando proyecto macro ${id} con ${subprojects.length} subproyectos`);
      }

      // Eliminar el proyecto (el método deleteActiveProject ya maneja subproyectos y relaciones)
      const deleted = await storage.deleteActiveProject(id);

      if (!deleted) {
        console.log(`Falló la eliminación del proyecto ${id}`);
        return res.status(500).json({ message: "Failed to delete project" });
      }

      console.log(`Proyecto ${id} eliminado exitosamente`);
      res.json({ 
        success: true,
        message: "Project deleted successfully", 
        projectId: id 
      });
    } catch (error) {
      console.error("Error deleting active project:", error);
      res.status(500).json({ 
        message: "Failed to delete project",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Eliminar todos los proyectos activos
  app.delete("/api/active-projects", requireAuth, async (req, res) => {
    try {
      // Obtener todos los proyectos activos
      const allProjects = await storage.getActiveProjects();
      
      if (allProjects.length === 0) {
        return res.json({ message: "No projects to delete", deletedCount: 0 });
      }

      console.log(`Eliminando ${allProjects.length} proyectos activos...`);

      // Eliminar todos los proyectos usando el método existente
      let deletedCount = 0;
      for (const project of allProjects) {
        try {
          const deleted = await storage.deleteActiveProject(project.id);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error eliminando proyecto ${project.id}:`, error);
        }
      }

      res.json({ 
        message: `Successfully deleted ${deletedCount} projects`, 
        deletedCount,
        totalProjects: allProjects.length
      });
    } catch (error) {
      console.error("Error deleting all active projects:", error);
      res.status(500).json({ message: "Failed to delete all projects" });
    }
  });



  // Actualizar proyecto completo (nombre, estado, descripción)
  app.patch("/api/active-projects/:id/update", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const { name, status, description } = req.body;
      const updateData: any = {};

      if (name && name.trim().length > 0) {
        updateData.subprojectName = name.trim();
      }

      if (status) {
        const validStatuses = ["pending", "in_progress", "completed", "paused", "cancelled"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        updateData.completionStatus = status;

        if (status === "completed") {
          updateData.completedDate = new Date();
        } else if (status !== "completed") {
          updateData.completedDate = null;
        }
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      const updatedProject = await storage.updateActiveProject(id, updateData);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Actualizar nombre de subproyecto
  app.patch("/api/active-projects/:id/name", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const { subprojectName } = req.body;

      if (!subprojectName || subprojectName.trim().length === 0) {
        return res.status(400).json({ message: "Subproject name is required" });
      }

      const updatedProject = await storage.updateActiveProject(id, { 
        subprojectName: subprojectName.trim() 
      });

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating subproject name:", error);
      res.status(500).json({ message: "Failed to update subproject name" });
    }
  });

  // Guardar asignaciones de presupuesto para subproyectos Always-On
  app.post("/api/projects/budget-allocations", async (req, res) => {
    try {
      const { macroProjectId, allocations } = req.body;

      if (!macroProjectId || !allocations || !Array.isArray(allocations)) {
        return res.status(400).json({ message: "Datos de asignación de presupuesto inválidos" });
      }

      // Verificar que el proyecto macro existe y es de tipo Always-On
      const macroProject = await storage.getActiveProject(macroProjectId);
      if (!macroProject || !macroProject.isAlwaysOnMacro) {
        return res.status(400).json({ message: "El proyecto especificado no es un proyecto macro Always-On válido" });
      }

      // Actualizar el presupuesto estimado de cada subproyecto
      const results = [];
      for (const allocation of allocations) {
        const { projectId, amount } = allocation;

        if (!projectId || typeof amount !== 'number') {
          console.warn("Datos de asignación incorrectos:", allocation);
          continue;
        }

        // Verificar que el subproyecto pertenece al proyecto macro
        const subproject = await storage.getActiveProject(projectId);
        if (!subproject || subproject.parentProjectId !== macroProjectId) {
          console.warn(`El proyecto ${projectId} no es un subproyecto de ${macroProjectId}`);
          continue;
        }

        // En una implementación real, aquí actualizaríamos el presupuesto estimado en la base de datos
        // Por ahora, simulamos la actualización

        results.push({
          projectId,
          success: true,
          previousAmount: 0, // Aquí deberíamos poner el monto anterior
          newAmount: amount
        });
      }

      res.json({
        success: true,
        macroProjectId,
        updatedAllocations: results
      });
    } catch (error) {
      console.error("Error al guardar asignaciones de presupuesto:", error);
      res.status(500).json({ 
        message: "Error al procesar la asignación de presupuesto",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Obtener entregables de todos los subproyectos Always-On de MODO
  app.get("/api/projects/always-on/deliverables", requireAuth, async (req, res) => {
    try {

      // IDs de los subproyectos de MODO Always-On
      const subProjectIds = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

      let allDeliverables: any[] = [];

      // Obtener entregables de cada subproyecto usando consulta directa
      for (const projectId of subProjectIds) {
        try {

          // Consulta parametrizada segura para obtener entregables
          const projectDeliverables = await db.select().from(deliverables)
            .where(eq(deliverables.project_id, projectId));

          if (projectDeliverables && projectDeliverables.length > 0) {

            // Agregar información del subproyecto a cada entregable
            const deliverablesWithProject = projectDeliverables.map((d: any) => ({
              ...d,
              subProjectId: projectId,
              displayTitle: `${d.title || `Entregable ${d.id}`} (Subproyecto ${projectId})`
            }));
            allDeliverables = allDeliverables.concat(deliverablesWithProject);
          } else {
          }
        } catch (error) {
          console.warn(`Error obteniendo entregables del proyecto ${projectId}:`, error);
        }
      }

      res.json(allDeliverables);
    } catch (error) {
      console.error("Error obteniendo entregables Always-On:", error);
      res.status(500).json({ message: "Error al obtener entregables" });
    }
  });

  // Crear un nuevo proyecto activo desde una cotización
  app.post("/api/active-projects", requireAuth, async (req, res) => {
    try {
      // Adaptar fechas si vienen como strings ISO
      const processedData = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        expectedEndDate: req.body.expectedEndDate ? new Date(req.body.expectedEndDate) : undefined,
        actualEndDate: req.body.actualEndDate ? new Date(req.body.actualEndDate) : undefined,
      };

      const validatedData = insertActiveProjectSchema.parse(processedData);

      // Verificar que la cotización existe
      const quotation = validatedData.quotationId ? await storage.getQuotation(Number(validatedData.quotationId)) : null;
      if (!quotation) {
        return res.status(404).json({ message: "Cotización no encontrada" });
      }

      // Verificar que la cotización está aprobada
      if (quotation.status !== "approved") {
        return res.status(400).json({ 
          message: "No se puede crear un proyecto a partir de una cotización no aprobada",
          currentStatus: quotation.status
        });
      }

      const project = await storage.createActiveProject(validatedData);
      
      // Copiar automáticamente el equipo de la cotización al proyecto recién creado
      try {
        console.log(`📋 Copiando equipo automáticamente desde cotización ${validatedData.quotationId} al proyecto ${project.id}`);
        const baseTeam = await storage.copyQuotationTeamToProject(Number(validatedData.quotationId), project.id);
        console.log(`✅ Equipo copiado automáticamente: ${baseTeam.length} miembros`);
      } catch (teamError) {
        console.warn('⚠️ Error al copiar equipo automáticamente, pero proyecto creado exitosamente:', teamError);
        // No fallar la creación del proyecto si hay error copiando el equipo
      }
      
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Error de validación:", error.errors);
        return res.status(400).json({ message: "Datos de proyecto inválidos", errors: error.errors });
      }
      console.error("Error creating active project:", error);
      res.status(500).json({ message: "Error al crear el proyecto activo" });
    }
  });

  // Actualizar un proyecto activo
  app.patch("/api/active-projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      console.log("PATCH /api/active-projects/:id - Request body:", req.body);
      
      // Separar projectName del resto de los datos ya que no es parte del esquema de activeProjects
      const { projectName, ...projectData } = req.body;
      
      // Limpiar valores null antes de validar
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(projectData)) {
        if (value !== null) {
          cleanedData[key] = value;
        }
      }
      
      // Convertir fechas si existen
      if (cleanedData.startDate) {
        cleanedData.startDate = new Date(cleanedData.startDate);
      }
      if (cleanedData.expectedEndDate) {
        cleanedData.expectedEndDate = new Date(cleanedData.expectedEndDate);
      }
      
      // Validar solo los campos del proyecto
      const validatedData = insertActiveProjectSchema.partial().parse(cleanedData);
      const updatedProject = await storage.updateActiveProject(id, validatedData);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating active project:", error);
      res.status(500).json({ message: "Failed to update active project" });
    }
  });



  // ---------- RUTAS PARA COMPONENTES DE PROYECTO ----------

  // Obtener todos los componentes de un proyecto
  app.get("/api/project-components/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "ID de proyecto inválido" });

    try {
      const components = await storage.getProjectComponents(projectId);
      res.json(components);
    } catch (error) {
      console.error(`Error al obtener componentes del proyecto ${projectId}:`, error);
      res.status(500).json({ message: "Error al obtener componentes del proyecto" });
    }
  });

  // Obtener componente específico
  app.get("/api/project-components/detail/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID de componente inválido" });

    try {
      const component = await storage.getProjectComponent(id);
      if (!component) {
        return res.status(404).json({ message: "Componente no encontrado" });
      }
      res.json(component);
    } catch (error) {
      console.error(`Error al obtener componente ${id}:`, error);
      res.status(500).json({ message: "Error al obtener componente" });
    }
  });

  // Obtener componente predeterminado de un proyecto
  app.get("/api/project-components/default/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "ID de proyecto inválido" });

    try {
      const component = await storage.getDefaultProjectComponent();
      if (!component) {
        return res.status(404).json({ message: "No hay componente predeterminado para este proyecto" });
      }
      res.json(component);
    } catch (error) {
      console.error(`Error al obtener componente predeterminado del proyecto ${projectId}:`, error);
      res.status(500).json({ message: "Error al obtener componente predeterminado" });
    }
  });

  // Crear nuevo componente
  app.post("/api/project-components", async (req, res) => {
    try {
      const validatedData = insertProjectComponentSchema.parse(req.body);
      const component = await storage.createProjectComponent(validatedData);
      res.status(201).json(component);
    } catch (error) {
      console.error("Error al crear componente:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos para el componente", errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear componente" });
    }
  });

  // Actualizar componente
  app.patch("/api/project-components/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID de componente inválido" });

    try {
      const validatedData = insertProjectComponentSchema.partial().parse(req.body);
      const updatedComponent = await storage.updateProjectComponent(id, validatedData);

      if (!updatedComponent) {
        return res.status(404).json({ message: "Componente no encontrado" });
      }

      res.json(updatedComponent);
    } catch (error) {
      console.error(`Error al actualizar componente ${id}:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos para el componente", errors: error.errors });
      }
      res.status(500).json({ message: "Error al actualizar componente" });
    }
  });

  // Eliminar componente
  app.delete("/api/project-components/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID de componente inválido" });

    try {
      const success = await storage.deleteProjectComponent(id);

      if (!success) {
        return res.status(404).json({ message: "Componente no encontrado o no se puede eliminar" });
      }

      res.json({ success: true, message: "Componente eliminado correctamente" });
    } catch (error) {
      console.error(`Error al eliminar componente ${id}:`, error);
      res.status(500).json({ message: "Error al eliminar componente" });
    }
  });

  // ---------- RUTAS PARA REGISTRO DE HORAS ----------

  // Obtener registros de horas con filtros opcionales
  app.get("/api/time-entries", async (req, res) => {
    try {
      const { projectId, startDate, endDate, personnelId } = req.query;

      if (projectId) {
        const id = parseInt(projectId as string);
        if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

        const entries = await storage.getTimeEntriesByProject(id);
        res.json(entries);
      } else {
        // Si no se especifica proyecto, devolver todas las entradas
        const entries = await storage.getTimeEntries();
        res.json(entries);
      }
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  // Obtener registros de horas agrupados por proyecto (para métricas rápidas)
  app.get("/api/time-entries/all-projects", async (req, res) => {
    try {
      const timeFilter = req.query.timeFilter as string;
      
      console.log(`🔍 Time Entries All Projects API called with:`, { 
        timeFilter 
      });

      let query = db.select({
        projectId: sql`time_entries.project_id`,
        hours: sql`time_entries.hours`,
        date: sql`time_entries.date`
      })
      .from(sql`time_entries`);

      // Aplicar filtro temporal si se especifica
      if (timeFilter && timeFilter !== 'all') {
        const dateRange = getDateRangeForFilter(timeFilter);
        if (dateRange) {
          console.log(`🔍 Applying temporal filter to time entries:`, { 
            timeFilter, 
            dateRange: {
              startDate: dateRange.startDate?.toISOString(),
              endDate: dateRange.endDate?.toISOString()
            }
          });
          
          query = query.where(sql`time_entries.date >= ${dateRange.startDate} AND time_entries.date <= ${dateRange.endDate}`);
        }
      }

      const entries = await query;

      // Agrupar por proyecto
      const groupedByProject: Record<number, any[]> = {};
      entries.forEach(entry => {
        const projectId = entry.projectId as number;
        if (!groupedByProject[projectId]) {
          groupedByProject[projectId] = [];
        }
        groupedByProject[projectId].push(entry);
      });

      console.log(`🔍 Time Entries grouped by project:`, Object.keys(groupedByProject).length, 'projects');

      res.json(groupedByProject);
    } catch (error) {
      console.error("Error fetching all projects time entries:", error);
      res.status(500).json({ message: "Failed to fetch time entries data" });
    }
  });

  // Obtener registros de horas por proyecto con información del personal
  app.get("/api/time-entries/project/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const entries = await db
        .select({
          id: timeEntries.id,
          projectId: timeEntries.projectId,
          personnelId: timeEntries.personnelId,
          hours: timeEntries.hours,
          description: timeEntries.description,
          date: timeEntries.date,
          hourlyRate: personnel.hourlyRate,
          personnelName: personnel.name,
          roleName: roles.name,
          entryType: timeEntries.entryType,
          totalCost: timeEntries.totalCost,
          hourlyRateAtTime: timeEntries.hourlyRateAtTime
        })
        .from(timeEntries)
        .leftJoin(personnel, eq(timeEntries.personnelId, personnel.id))
        .leftJoin(roles, eq(personnel.roleId, roles.id))
        .where(eq(timeEntries.projectId, projectId))
        .orderBy(desc(timeEntries.date));

      res.json(entries);
    } catch (error) {
      console.error("Error fetching project time entries:", error);
      res.status(500).json({ message: "Failed to fetch project time entries" });
    }
  });

  // Obtener registros de horas por persona
  app.get("/api/time-entries/personnel/:personnelId", async (req, res) => {
    const personnelId = parseInt(req.params.personnelId);
    if (isNaN(personnelId)) return res.status(400).json({ message: "Invalid personnel ID" });

    try {
      const entries = await storage.getTimeEntriesByPersonnel(personnelId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching personnel time entries:", error);
      res.status(500).json({ message: "Failed to fetch personnel time entries" });
    }
  });



  // Obtener una entrada de tiempo específica
  app.get("/api/time-entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid time entry ID" });

    try {
      const entry = await storage.getTimeEntryById(id);
      if (!entry) return res.status(404).json({ message: "Time entry not found" });

      res.json(entry);
    } catch (error) {
      console.error("Error fetching time entry:", error);
      res.status(500).json({ message: "Failed to fetch time entry" });
    }
  });

  // Crear un nuevo registro de horas
  app.post("/api/time-entries", async (req, res) => {
    try {
      // Adaptar fechas si vienen como strings ISO
      const processedData = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        approvedDate: req.body.approvedDate ? new Date(req.body.approvedDate) : undefined
      };

      // Verificar que la persona existe para obtener el valor hora actual si no se proporciona
      const person = await storage.getPersonnelById(processedData.personnelId);
      if (!person) {
        return res.status(404).json({ message: "Personal no encontrado" });
      }

      // Si no se proporciona hourlyRateAtTime, usar el valor actual
      if (!processedData.hourlyRateAtTime) {
        processedData.hourlyRateAtTime = person.hourlyRate || 50;
      }

      // Solo calcular si faltan datos completamente
      if (processedData.entryType === "hours" && (processedData.totalCost === undefined || processedData.totalCost === null)) {
        // Si se registró por horas y no hay costo definido, calcularlo
        processedData.totalCost = (processedData.hours || 0) * (processedData.hourlyRateAtTime || 0);
        console.log('🔧 Calculando totalCost en backend:', {
          hours: processedData.hours,
          hourlyRateAtTime: processedData.hourlyRateAtTime,
          totalCost: processedData.totalCost
        });
      } else if (processedData.entryType === "cost" && (processedData.hours === undefined || processedData.hours === null)) {
        // Si se registró por costo y no hay horas definidas, calcularlas
        processedData.hours = (processedData.totalCost || 0) / (processedData.hourlyRateAtTime || 1);
        console.log('🔧 Calculando hours en backend:', {
          totalCost: processedData.totalCost,
          hourlyRateAtTime: processedData.hourlyRateAtTime,
          hours: processedData.hours
        });
      }
      
      console.log('📋 Backend recibe:', { 
        entryType: processedData.entryType, 
        totalCost: processedData.totalCost, 
        originalKeys: Object.keys(req.body || {}) 
      });

      // Validar que tenemos valores válidos y positivos
      if (typeof processedData.totalCost !== 'number' || isNaN(processedData.totalCost) || processedData.totalCost <= 0) {
        console.error('❌ Validación totalCost fallida:', {
          totalCost: processedData.totalCost,
          type: typeof processedData.totalCost,
          isNaN: isNaN(processedData.totalCost),
          hours: processedData.hours,
          hourlyRateAtTime: processedData.hourlyRateAtTime
        });
        return res.status(400).json({ 
          message: "El costo total debe ser un número positivo",
          debug: {
            totalCost: processedData.totalCost,
            type: typeof processedData.totalCost,
            hours: processedData.hours,
            hourlyRateAtTime: processedData.hourlyRateAtTime
          }
        });
      }

      if (typeof processedData.hours !== 'number' || isNaN(processedData.hours) || processedData.hours <= 0) {
        console.error('❌ Validación hours fallida:', {
          hours: processedData.hours,
          type: typeof processedData.hours,
          isNaN: isNaN(processedData.hours)
        });
        return res.status(400).json({ 
          message: "Las horas deben ser un número positivo",
          debug: {
            hours: processedData.hours,
            type: typeof processedData.hours,
            totalCost: processedData.totalCost,
            hourlyRateAtTime: processedData.hourlyRateAtTime
          }
        });
      }

      // Añadir por defecto que está aprobado y establecer la fecha de aprobación
      const dataWithDefaults = {
        ...processedData,
        approved: true,
        approvedDate: new Date(),
        approvedBy: processedData.personnelId // Auto-aprobado por la persona que registra
      };

      const validatedData = insertTimeEntrySchema.parse(dataWithDefaults);

      // Verificar que el proyecto existe
      const project = await storage.getActiveProject(validatedData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      // 🔍 DETECCIÓN DE PERSONAL NO COTIZADO ORIGINALMENTE
      let isUncotizedPersonnel = false;
      const personnelId = validatedData.personnelId;
      
      if (project.quotationId && personnelId) {
        // Verificar si esta persona estaba en el equipo original de la cotización
        const originalTeam = await storage.getQuotationTeamMembers(project.quotationId);
        const wasInOriginalTeam = originalTeam.some(member => member.personnelId === personnelId);
        
        if (!wasInOriginalTeam) {
          console.log(`🚨 PERSONAL NO COTIZADO DETECTADO: ${personnelId} no estaba en cotización ${project.quotationId}`);
          isUncotizedPersonnel = true;
          
          // Obtener información del personal para logging
          const personnel = await storage.getPersonnelById(personnelId);
          if (personnel) {
            console.log(`📝 Personal no cotizado: ${personnel.name} - Solo marcado visualmente, NO agregado al equipo base`);
          }
        }
      }

      // Crear el registro de tiempo con información adicional
      const entry = await storage.createTimeEntry(validatedData);
      
      // Agregar flag de personal no cotizado al response
      const entryWithMetadata = {
        ...entry,
        isUncotizedPersonnel,
        warningMessage: isUncotizedPersonnel ? 
          "Esta persona no estaba en el equipo original de la cotización" : null
      };

      res.status(201).json(entryWithMetadata);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Error de validación:", error.errors);
        return res.status(400).json({ message: "Datos de registro inválidos", errors: error.errors });
      }
      console.error("Error creating time entry:", error);
      res.status(500).json({ message: "Error al crear el registro" });
    }
  });

  // Actualizar un registro de horas
  app.patch("/api/time-entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid time entry ID" });

    try {
      const validatedData = insertTimeEntrySchema.partial().parse(req.body);
      const updatedEntry = await storage.updateTimeEntry(id, validatedData);

      if (!updatedEntry) {
        return res.status(404).json({ message: "Time entry not found" });
      }

      res.json(updatedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid time entry data", errors: error.errors });
      }
      console.error("Error updating time entry:", error);
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  // Eliminar un registro de horas
  app.delete("/api/time-entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid time entry ID" });

    try {
      const deleted = await storage.deleteTimeEntry(id);

      if (!deleted) {
        return res.status(404).json({ message: "Time entry not found" });
      }

      res.json({ success: true, message: "Time entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting time entry:", error);
      res.status(500).json({ message: "Failed to delete time entry" });
    }
  });

  // Aprobar un registro de horas
  app.post("/api/time-entries/:id/approve", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid time entry ID" });

    const { approverId } = req.body;
    if (!approverId || isNaN(parseInt(approverId))) {
      return res.status(400).json({ message: "Valid approver ID is required" });
    }

    try {
      const entry = await storage.getTimeEntryById(id);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }

      if (entry.approved) {
        return res.status(400).json({ message: "Time entry already approved" });
      }

      const updatedEntry = await storage.approveTimeEntry(id, parseInt(approverId));
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error approving time entry:", error);
      res.status(500).json({ message: "Failed to approve time entry" });
    }
  });

  // ---------- RUTAS PARA INFORMES DE PROGRESO ----------

  // Obtener informes de progreso por proyecto
  app.get("/api/progress-reports/project/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const reports = await storage.getProgressReportsByProject(projectId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching progress reports:", error);
      res.status(500).json({ message: "Failed to fetch progress reports" });
    }
  });

  // Obtener un informe de progreso específico
  app.get("/api/progress-reports/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });

    try {
      const report = await storage.getProgressReport(id);
      if (!report) return res.status(404).json({ message: "Progress report not found" });

      res.json(report);
    } catch (error) {
      console.error("Error fetching progress report:", error);
      res.status(500).json({ message: "Failed to fetch progress report" });
    }
  });

  // Crear un nuevo informe de progreso
  app.post("/api/progress-reports", async (req, res) => {
    try {
      const validatedData = insertProgressReportSchema.parse(req.body);

      // Verificar que el proyecto existe
      const project = await storage.getActiveProject(validatedData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Verificar que la persona existe
      const person = await storage.getPersonnelById(validatedData.createdBy);
      if (!person) {
        return res.status(404).json({ message: "Creator not found" });
      }

      const report = await storage.createProgressReport(validatedData);
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid report data", errors: error.errors });
      }
      console.error("Error creating progress report:", error);
      res.status(500).json({ message: "Failed to create progress report" });
    }
  });

  // Actualizar un informe de progreso
  app.patch("/api/progress-reports/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });

    try {
      const validatedData = insertProgressReportSchema.partial().parse(req.body);
      const updatedReport = await storage.updateProgressReport(id, validatedData);

      if (!updatedReport) {
        return res.status(404).json({ message: "Progress report not found" });
      }

      res.json(updatedReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid report data", errors: error.errors });
      }
      console.error("Error updating progress report:", error);
      res.status(500).json({ message: "Failed to update progress report" });
    }
  });

  // ---------- RUTAS PARA COMPARACIONES FINANCIERAS ----------

  // Obtener resumen de costos de un proyecto
  // Obtener resumen de costos para un periodo específico (mes, trimestre, etc.)
  app.get("/api/projects/:id/cost-summary/period", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      // Obtener parámetros de fecha (opcionales)
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const period = req.query.period as 'month' | 'quarter' | 'custom' | undefined;

      // Si se proporciona un mes específico (formato 'YYYY-MM')
      const monthYear = req.query.monthYear as string | undefined;

      // Si se proporciona un trimestre específico (formato 'YYYY-Q1', 'YYYY-Q2', etc.)
      const quarter = req.query.quarter as string | undefined;

      // Lógica temporal para filtrar por periodo
      let filteredSummary;
      let periodLabel = "";

      // Obtener el proyecto y verificar si es un Always-On
      const [project] = await db.select().from(activeProjects).where(eq(activeProjects.id, id));

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Si es un proyecto Always-On con subproyectos
      if (project.isAlwaysOnMacro) {
        // Obtener subproyectos
        const subprojects = await db.select().from(activeProjects).where(eq(activeProjects.parentProjectId, id));

        // Filtrar subproyectos por fecha si se especifica
        let filteredSubprojects = [...subprojects];

        if (monthYear) {
          // Filtrar por mes específico (YYYY-MM)
          const [yearStr, monthStr] = monthYear.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr) - 1; // JS months are 0-indexed

          const firstDayOfMonth = new Date(year, month, 1);
          const lastDayOfMonth = new Date(year, month + 1, 0);

          filteredSubprojects = subprojects.filter(subproject => {
            const startDate = new Date(subproject.startDate);
            const endDate = subproject.expectedEndDate ? new Date(subproject.expectedEndDate) : new Date();

            return (startDate <= lastDayOfMonth && endDate >= firstDayOfMonth);
          });

          periodLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(firstDayOfMonth);
        } else if (quarter) {
          // Filtrar por trimestre (YYYY-Q1, YYYY-Q2, etc.)
          const [yearStr, quarterStr] = quarter.split('-');
          const year = parseInt(yearStr);
          const quarterNum = parseInt(quarterStr.substring(1));

          // Calcular meses para el trimestre
          const startMonth = (quarterNum - 1) * 3;
          const startDate = new Date(year, startMonth, 1);
          const endDate = new Date(year, startMonth + 3, 0);

          filteredSubprojects = subprojects.filter(subproject => {
            const projectStartDate = new Date(subproject.startDate);
            const projectEndDate = subproject.expectedEndDate ? new Date(subproject.expectedEndDate) : new Date();

            return (projectStartDate <= endDate && projectEndDate >= startDate);
          });

          periodLabel = `Q${quarterNum} ${year}`;
        }

        // Obtener costos de cada subproyecto filtrado
        const subprojectCosts = await Promise.all(
          filteredSubprojects.map(async (subproject) => {
            // Obtener cotización para el subproyecto
            const [quotation] = await db.select().from(quotations).where(eq(quotations.id, subproject.quotationId));

            // Obtener entradas de tiempo para el subproyecto
            const timeEntryData = await db.select({
              timeEntry: timeEntries,
              personnel: personnel
            })
            .from(timeEntries)
            .innerJoin(personnel, eq(timeEntries.personnelId, personnel.id))
            .where(eq(timeEntries.projectId, subproject.id));

            // Calcular costo actual
            let actualCost = 0;
            for (const entry of timeEntryData) {
              if (entry.timeEntry.billable) {
                actualCost += entry.personnel.hourlyRate * entry.timeEntry.hours;
              }
            }

            return {
              id: subproject.id,
              name: quotation?.projectName || 'Unnamed Project',
              startDate: new Date(subproject.startDate),
              endDate: subproject.expectedEndDate ? new Date(subproject.expectedEndDate) : null,
              costs: {
                estimatedCost: quotation?.totalAmount || 0,
                actualCost,
                percentageUsed: quotation?.totalAmount ? (actualCost / quotation.totalAmount * 100) : 0
              }
            };
          })
        );

        // Calcular totales para el periodo
        const totalEstimatedCost = project.macroMonthlyBudget || 
          subprojectCosts.reduce((sum, p) => sum + p.costs.estimatedCost, 0);
        const totalActualCost = subprojectCosts.reduce((sum, p) => sum + p.costs.actualCost, 0);

        filteredSummary = {
          estimatedCost: totalEstimatedCost,
          actualCost: totalActualCost,
          variance: totalEstimatedCost - totalActualCost,
          percentageUsed: totalEstimatedCost > 0 ? (totalActualCost / totalEstimatedCost * 100) : 0,
          periodLabel,
          subprojects: subprojectCosts
        };
      } else {
        // Para proyectos regulares, usar el resumen estándar
        filteredSummary = await storage.getProjectCostSummary(id);
      }

      res.json(filteredSummary);
    } catch (error) {
      console.error("Error fetching filtered cost summary:", error);
      res.status(500).json({ message: "Failed to fetch filtered cost summary" });
    }
  });

  // Mantener el endpoint original para compatibilidad
  app.get("/api/projects/:id/cost-summary", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const summary = await storage.getProjectCostSummary(id);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching project cost summary:", error);
      res.status(500).json({ message: "Failed to fetch project cost summary" });
    }
  });

  // Actualizar nombre de proyecto
  app.patch("/api/projects/:id/update-name", async (req, res) => {

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }


    try {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Project name is required" });
      }

      const project = await storage.getActiveProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }


      const quotation = await storage.getQuotation(project.quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }


      // Verificar si hay otros proyectos que usan la misma cotización
      const projectsWithSameQuotation = await storage.getActiveProjectsByQuotationId(project.quotationId);

      if (projectsWithSameQuotation.length > 1) {
        // Si hay más proyectos usando la misma cotización, crear una copia para este proyecto

        // Crear una copia de la cotización con el nuevo nombre
        const { id, createdAt, updatedAt, ...quotationWithoutId } = quotation;
        const newQuotation = nullToUndefined({ ...quotationWithoutId, projectName: name.trim() });

        const createdQuotation = await storage.createQuotation(newQuotation);
        if (!createdQuotation) {
          return res.status(500).json({ message: "Failed to create quotation copy" });
        }


        // Actualizar el proyecto para usar la nueva cotización
        const updatedProject = await storage.updateActiveProject(id, {
          quotationId: createdQuotation.id as any
        });

        if (!updatedProject) {
          return res.status(500).json({ message: "Failed to update project" });
        }


        // Obtener el proyecto actualizado para devolver
        const finalProject = await storage.getActiveProject(id);
        return res.json(finalProject);
      } else {
        // Si solo este proyecto usa la cotización, actualizar normalmente

        // Actualizar el nombre del proyecto en la cotización
        const updatedQuotation = await storage.updateQuotation(project.quotationId, {
          projectName: name.trim()
        });

        if (!updatedQuotation) {
          return res.status(500).json({ message: "Failed to update project name" });
        }


        // Obtenemos el proyecto actualizado
        const updatedProject = await storage.getActiveProject(id);
        return res.json(updatedProject);
      }
    } catch (error) {
      console.error("Error updating project name:", error);
      res.status(500).json({ message: "Failed to update project name" });
    }
  });

  // ---------- RUTAS PARA COSTOS HISTÓRICOS DE PERSONAL ----------

  // Obtener costos históricos de personal
  app.get("/api/personnel-historical-costs", requireAuth, async (req, res) => {
    try {
      const { personnelId, year, month } = req.query;
      
      let query = db.select({
        id: personnelHistoricalCosts.id,
        personnelId: personnelHistoricalCosts.personnelId,
        personnelName: personnel.name,
        year: personnelHistoricalCosts.year,
        month: personnelHistoricalCosts.month,
        hourlyRateARS: personnelHistoricalCosts.hourlyRateARS,
        monthlySalaryARS: personnelHistoricalCosts.monthlySalaryARS,
        hourlyRateUSD: personnelHistoricalCosts.hourlyRateUSD,
        monthlySalaryUSD: personnelHistoricalCosts.monthlySalaryUSD,
        adjustmentReason: personnelHistoricalCosts.adjustmentReason,
        notes: personnelHistoricalCosts.notes,
        createdAt: personnelHistoricalCosts.createdAt,
        updatedAt: personnelHistoricalCosts.updatedAt
      })
      .from(personnelHistoricalCosts)
      .leftJoin(personnel, eq(personnelHistoricalCosts.personnelId, personnel.id))
      .where(eq(personnelHistoricalCosts.isActive, true))
      .orderBy(desc(personnelHistoricalCosts.year), desc(personnelHistoricalCosts.month));

      const costs = await query;
      res.json(costs);
    } catch (error) {
      console.error("Error fetching personnel historical costs:", error);
      res.status(500).json({ message: "Failed to fetch personnel historical costs" });
    }
  });

  // Crear nuevo costo histórico
  app.post("/api/personnel-historical-costs", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPersonnelHistoricalCostSchema.parse({
        ...req.body,
        createdBy: req.user?.id
      });

      // Verificar si ya existe un registro para el mismo personal/año/mes
      const existing = await db.select()
        .from(personnelHistoricalCosts)
        .where(and(
          eq(personnelHistoricalCosts.personnelId, validatedData.personnelId),
          eq(personnelHistoricalCosts.year, validatedData.year),
          eq(personnelHistoricalCosts.month, validatedData.month),
          eq(personnelHistoricalCosts.isActive, true)
        ));

      if (existing.length > 0) {
        return res.status(409).json({ 
          message: "Ya existe un registro de costo histórico para este personal en el período especificado" 
        });
      }

      const result = await db.insert(personnelHistoricalCosts).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      console.error("Error creating personnel historical cost:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create personnel historical cost" });
    }
  });

  // Actualizar costo histórico
  app.patch("/api/personnel-historical-costs/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid cost ID" });

    try {
      const validatedData = insertPersonnelHistoricalCostSchema.partial().parse({
        ...req.body,
        updatedBy: req.user?.id,
        updatedAt: new Date()
      });

      const result = await db
        .update(personnelHistoricalCosts)
        .set(validatedData)
        .where(and(eq(personnelHistoricalCosts.id, id), eq(personnelHistoricalCosts.isActive, true)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: "Personnel historical cost not found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error updating personnel historical cost:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update personnel historical cost" });
    }
  });

  // Eliminar costo histórico (soft delete)
  app.delete("/api/personnel-historical-costs/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid cost ID" });

    try {
      const result = await db
        .update(personnelHistoricalCosts)
        .set({ isActive: false, updatedBy: req.user?.id, updatedAt: new Date() })
        .where(eq(personnelHistoricalCosts.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: "Personnel historical cost not found" });
      }

      res.json({ success: true, message: "Personnel historical cost deleted successfully" });
    } catch (error) {
      console.error("Error deleting personnel historical cost:", error);
      res.status(500).json({ message: "Failed to delete personnel historical cost" });
    }
  });

  // ---------- RUTAS PARA OPCIONES ----------

  // Obtener opciones de estado de proyecto
  app.get("/api/options/project-status", async (_, res) => {
    try {
      const options = await storage.getProjectStatusOptions();
      res.json(options);
    } catch (error) {
      console.error("Error fetching project status options:", error);
      res.status(500).json({ message: "Failed to fetch project status options" });
    }
  });

  // Obtener opciones de frecuencia de seguimiento
  app.get("/api/options/tracking-frequency", async (_, res) => {
    try {
      const options = await storage.getTrackingFrequencyOptions();
      res.json(options);
    } catch (error) {
      console.error("Error fetching tracking frequency options:", error);
      res.status(500).json({ message: "Failed to fetch tracking frequency options" });
    }
  });

  // Admin route para reinicializar la base de datos con los nuevos datos
  app.post("/api/admin/reinit-database", async (req, res) => {
    try {
      await reinitializeDatabase();
      res.json({ message: "Database reinitialized successfully" });
    } catch (error) {
      console.error("Error reinitializing database:", error);
      res.status(500).json({ message: "Failed to reinitialize database" });
    }
  });

  // =========== RUTAS PARA INFLACIÓN Y CONFIGURACIÓN ===========

  // Obtener historial de inflación mensual
  app.get("/api/admin/monthly-inflation", async (req, res) => {
    try {
      const inflation = await db.select().from(monthlyInflation).orderBy(desc(monthlyInflation.year), desc(monthlyInflation.month));
      res.json(inflation);
    } catch (error) {
      console.error("Error fetching monthly inflation:", error);
      res.status(500).json({ message: "Failed to fetch inflation data" });
    }
  });

  // Ruta pública para datos de inflación (usada en cotizaciones)
  app.get("/api/inflation/data", async (req, res) => {
    try {
      const inflation = await db.select().from(monthlyInflation).orderBy(desc(monthlyInflation.year), desc(monthlyInflation.month));
      res.json(inflation);
    } catch (error) {
      console.error("Error fetching inflation data:", error);
      res.status(500).json({ message: "Failed to fetch inflation data" });
    }
  });

  // Ruta para obtener tipo de cambio
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const exchangeRateConfig = await db.select()
        .from(systemConfig)
        .where(eq(systemConfig.configKey, 'usd_exchange_rate'));
      
      const rate = exchangeRateConfig.length > 0 ? exchangeRateConfig[0].configValue : 1100;
      res.json({ rate });
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      res.status(500).json({ message: "Failed to fetch exchange rate" });
    }
  });

  // Crear/actualizar inflación mensual
  app.post("/api/admin/monthly-inflation", async (req, res) => {
    try {
      const validatedData = insertMonthlyInflationSchema.parse(req.body);
      
      // Verificar si ya existe datos para ese año/mes
      const existing = await db.select()
        .from(monthlyInflation)
        .where(and(
          eq(monthlyInflation.year, validatedData.year),
          eq(monthlyInflation.month, validatedData.month)
        ));

      if (existing.length > 0) {
        // Actualizar existente
        const updated = await db.update(monthlyInflation)
          .set({
            inflationRate: validatedData.inflationRate, // Guardar como porcentaje
            source: validatedData.source,
            updatedAt: new Date(),
            updatedBy: validatedData.updatedBy
          })
          .where(eq(monthlyInflation.id, existing[0].id))
          .returning();
        res.json(updated[0]);
      } else {
        // Crear nuevo
        const created = await db.insert(monthlyInflation)
          .values({
            ...validatedData,
            inflationRate: validatedData.inflationRate, // Guardar como porcentaje
          })
          .returning();
        res.status(201).json(created[0]);
      }
    } catch (error) {
      console.error("Error creating/updating inflation:", error);
      res.status(500).json({ message: "Failed to save inflation data" });
    }
  });

  // Actualizar dato de inflación específico
  app.patch("/api/admin/monthly-inflation/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertMonthlyInflationSchema.parse(req.body);
      
      const updated = await db.update(monthlyInflation)
        .set({
          year: validatedData.year,
          month: validatedData.month,
          inflationRate: validatedData.inflationRate, // Guardar como porcentaje
          source: validatedData.source,
          updatedAt: new Date(),
          updatedBy: validatedData.updatedBy
        })
        .where(eq(monthlyInflation.id, id))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ message: "Inflation data not found" });
      }
      
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating inflation:", error);
      res.status(500).json({ message: "Failed to update inflation data" });
    }
  });

  // Eliminar dato de inflación
  app.delete("/api/admin/monthly-inflation/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const deleted = await db.delete(monthlyInflation)
        .where(eq(monthlyInflation.id, id))
        .returning();
      
      if (deleted.length === 0) {
        return res.status(404).json({ message: "Inflation data not found" });
      }
      
      res.json({ message: "Inflation data deleted successfully" });
    } catch (error) {
      console.error("Error deleting inflation:", error);
      res.status(500).json({ message: "Failed to delete inflation data" });
    }
  });

  // Obtener configuración del sistema
  app.get("/api/admin/system-config", async (req, res) => {
    try {
      const config = await db.select().from(systemConfig);
      res.json(config);
    } catch (error) {
      console.error("Error fetching system config:", error);
      res.status(500).json({ message: "Failed to fetch system configuration" });
    }
  });

  // Crear/actualizar configuración del sistema
  app.post("/api/admin/system-config", async (req, res) => {
    try {
      const validatedData = insertSystemConfigSchema.parse(req.body);
      
      // Verificar si ya existe la configuración
      const existing = await db.select()
        .from(systemConfig)
        .where(eq(systemConfig.configKey, validatedData.configKey));

      if (existing.length > 0) {
        // Actualizar existente
        const updated = await db.update(systemConfig)
          .set({
            configValue: validatedData.configValue,
            description: validatedData.description,
            updatedAt: new Date(),
            updatedBy: validatedData.updatedBy
          })
          .where(eq(systemConfig.configKey, validatedData.configKey))
          .returning();
        res.json(updated[0]);
      } else {
        // Crear nuevo
        const created = await db.insert(systemConfig)
          .values(validatedData)
          .returning();
        res.status(201).json(created[0]);
      }
    } catch (error) {
      console.error("Error creating/updating system config:", error);
      res.status(500).json({ message: "Failed to save system configuration" });
    }
  });

  // =========== RUTAS PARA ENCUESTAS NPS ===========

  // Obtener todas las encuestas NPS
  app.get("/api/nps-surveys", async (req, res) => {
    try {
      const surveys = await storage.getAllNpsSurveys();
      res.json(surveys);
    } catch (error) {
      console.error("Error fetching all NPS surveys:", error);
      res.status(500).json({ message: "Failed to fetch NPS surveys" });
    }
  });

  // Crear nueva encuesta NPS
  app.post("/api/nps-surveys", async (req, res) => {
    try {
      const surveyData = req.body;
      const newSurvey = await storage.createNpsSurvey(surveyData);
      res.status(201).json(newSurvey);
    } catch (error) {
      console.error("Error creating NPS survey:", error);
      res.status(500).json({ message: "Failed to create NPS survey" });
    }
  });

  // Obtener encuestas NPS por cliente
  app.get("/api/clients/:clientId/nps-surveys", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }

      const surveys = await storage.getNpsSurveysByClient(clientId);
      res.json(surveys);
    } catch (error) {
      console.error("Error fetching NPS surveys:", error);
      res.status(500).json({ message: "Failed to fetch NPS surveys" });
    }
  });

  // Obtener encuesta NPS específica
  app.get("/api/nps-surveys/:id", async (req, res) => {
    try {
      const surveyId = parseInt(req.params.id);
      if (isNaN(surveyId)) {
        return res.status(400).json({ message: "Invalid survey ID" });
      }

      const survey = await storage.getNpsSurvey(surveyId);
      if (!survey) {
        return res.status(404).json({ message: "NPS survey not found" });
      }

      res.json(survey);
    } catch (error) {
      console.error("Error fetching NPS survey:", error);
      res.status(500).json({ message: "Failed to fetch NPS survey" });
    }
  });

  // Actualizar encuesta NPS
  app.put("/api/nps-surveys/:id", async (req, res) => {
    try {
      const surveyId = parseInt(req.params.id);
      if (isNaN(surveyId)) {
        return res.status(400).json({ message: "Invalid survey ID" });
      }

      const updateData = req.body;
      const updatedSurvey = await storage.updateNpsSurvey(surveyId, updateData);

      if (!updatedSurvey) {
        return res.status(404).json({ message: "NPS survey not found" });
      }

      res.json(updatedSurvey);
    } catch (error) {
      console.error("Error updating NPS survey:", error);
      res.status(500).json({ message: "Failed to update NPS survey" });
    }
  });

  // Eliminar encuesta NPS
  app.delete("/api/nps-surveys/:id", async (req, res) => {
    try {
      const surveyId = parseInt(req.params.id);
      if (isNaN(surveyId)) {
        return res.status(400).json({ message: "Invalid survey ID" });
      }

      const deleted = await storage.deleteNpsSurvey(surveyId);
      if (!deleted) {
        return res.status(404).json({ message: "NPS survey not found" });
      }

      res.json({ message: "NPS survey deleted successfully" });
    } catch (error) {
      console.error("Error deleting NPS survey:", error);
      res.status(500).json({ message: "Failed to delete NPS survey" });
    }
  });

  // =========== RUTAS PARA RECURRING TEMPLATES ===========

  // Get recurring templates for a project
  app.get("/api/projects/:projectId/recurring-templates", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const templates = await storage.getRecurringTemplatesWithTeam(projectId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching recurring templates:", error);
      res.status(500).json({ message: "Failed to fetch recurring templates" });
    }
  });

  // Create new recurring template
  app.post("/api/recurring-templates", async (req, res) => {
    try {
      const templateData = {
        ...req.body,
        createdBy: 1 // Default user ID for now
      };

      const newTemplate = await storage.createRecurringTemplateWithTeam(templateData);
      res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Error creating recurring template:", error);
      res.status(500).json({ message: "Failed to create recurring template" });
    }
  });

  // Update recurring template
  app.put("/api/recurring-templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const updatedTemplate = await storage.updateRecurringTemplateWithTeam(templateId, req.body);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating recurring template:", error);
      res.status(500).json({ message: "Failed to update recurring template" });
    }
  });

  // Delete recurring template
  app.delete("/api/recurring-templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const deleted = await storage.deleteRecurringTemplateWithTeam(templateId);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting recurring template:", error);
      res.status(500).json({ message: "Failed to delete recurring template" });
    }
  });

  // =========== RUTAS PARA MODO (SEGUIMIENTO OPERACIONES) ===========

  // Obtener todos los entregables (opcionalmente filtrados por cliente)
  app.get("/api/deliverables", async (req, res) => {
    try {
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      const deliverables = clientId ? await storage.getDeliverablesByProjects([clientId]) : await storage.getDeliverables([]);
      res.json(deliverables);
    } catch (error) {
      console.error("Error fetching deliverables:", error);
      res.status(500).json({ message: "Failed to fetch deliverables" });
    }
  });

  // Obtener entregables para un proyecto específico
  app.get("/api/modo/deliverables/project/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "ID de proyecto inválido" });
    }

    try {
      // Consulta SQL directa para obtener entregable de un proyecto
      const { rows } = await db.execute(
        `SELECT * FROM deliverables WHERE project_id = ${projectId} LIMIT 1`
      );

      if (rows.length === 0) {
        return res.json(null);
      }

      res.json(rows[0]);
    } catch (error) {
      console.error(`Error al obtener entregable MODO para proyecto ID ${projectId}:`, error);
      res.status(500).json({ message: "Error al obtener datos MODO" });
    }
  });

  // Obtener todos los entregables de un proyecto específico (para calidad de puntuaciones)
  app.get("/api/projects/:projectId/deliverables", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "ID de proyecto inválido" });
    }

    try {
      const { rows } = await db.execute(
        `SELECT * FROM deliverables WHERE project_id = ${projectId} ORDER BY created_at DESC`
      );

      res.json(rows);
    } catch (error) {
      console.error(`Error al obtener entregables del proyecto ID ${projectId}:`, error);
      res.status(500).json({ message: "Error al obtener entregables del proyecto" });
    }
  });

  // Obtener un entregable por ID
  app.get("/api/deliverables/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid deliverable ID" });

    try {
      const deliverable = await storage.getDeliverable(id);
      if (!deliverable) {
        return res.status(404).json({ message: "Deliverable not found" });
      }
      res.json(deliverable);
    } catch (error) {
      console.error("Error fetching deliverable:", error);
      res.status(500).json({ message: "Failed to fetch deliverable" });
    }
  });

  // Crear un nuevo entregable
  app.post("/api/deliverables", async (req, res) => {
    try {
      const validatedData = insertDeliverableSchema.parse(req.body);
      const deliverable = await storage.createDeliverable(validatedData);
      res.status(201).json(deliverable);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid deliverable data", errors: error.errors });
      }
      console.error("Error creating deliverable:", error);
      res.status(500).json({ message: "Failed to create deliverable" });
    }
  });

  // Actualizar un entregable
  app.patch("/api/deliverables/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid deliverable ID" });

    try {

      // Omitimos la validación de Zod y enviamos los datos directamente
      const updatedDeliverable = await storage.updateDeliverable(id, req.body);

      if (!updatedDeliverable) {
        return res.status(404).json({ message: "Deliverable not found" });
      }

      res.json(updatedDeliverable);
    } catch (error) {
      console.error("Error updating deliverable:", error);
      res.status(500).json({ message: "Failed to update deliverable", error: String(error) });
    }
  });

  // Actualizar los indicadores de robustez de un entregable (ruta simplificada)
  app.post("/api/deliverables/:id/indicators", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid deliverable ID" });

    try {

      // Solución simple: ejecutar una actualización SQL directa con los valores correctos

      await pool.query(`
        UPDATE deliverables 
        SET 
          narrative_quality = ${Number(req.body.narrative_quality || 0)},
          graphics_effectiveness = ${Number(req.body.graphics_effectiveness || 0)},
          format_design = ${Number(req.body.format_design || 0)},
          relevant_insights = ${Number(req.body.relevant_insights || 0)},
          operations_feedback = ${Number(req.body.operations_feedback || 0)},
          mes_entrega = ${Number(req.body.mes_entrega || 1)},
          retrabajo = ${req.body.retrabajo ? 'true' : 'false'},
          on_time = ${req.body.delivery_on_time ? 'true' : 'false'},
          analysts = '${(req.body.analysts || '').replace(/'/g, "''")}',
          pm = '${(req.body.pm || '').replace(/'/g, "''")}',
          hours_available = ${Number(req.body.hours_available || 0)},
          updated_at = NOW()
        WHERE id = ${id}
      `);

      // Obtener el entregable actualizado
      const { rows } = await pool.query('SELECT * FROM deliverables WHERE id = $1', [id]);
      const updatedDeliverable = rows[0];

      if (!updatedDeliverable) {
        return res.status(404).json({ message: "Deliverable not found" });
      }

      res.json(updatedDeliverable);
    } catch (error) {
      console.error("Error updating deliverable indicators:", error);
      res.status(500).json({ message: "Failed to update deliverable indicators", error: String(error) });
    }
  });

  // Eliminar un entregable
  app.delete("/api/deliverables/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid deliverable ID" });

    try {
      const success = await storage.deleteDeliverable(id);
      if (!success) {
        return res.status(404).json({ message: "Deliverable not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deliverable:", error);
      res.status(500).json({ message: "Failed to delete deliverable" });
    }
  });

  // Obtener comentarios MODO por cliente
  app.get("/api/modo-comments/client/:clientId", requireAuth, async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

    try {
      const comments = await storage.getClientModoComments(clientId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching MODO comments:", error);
      res.status(500).json({ message: "Failed to fetch MODO comments" });
    }
  });

  // Obtener un comentario MODO por ID
  app.get("/api/modo-comments/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid comment ID" });

    try {
      const comment = await storage.getClientModoComment(id, 1, 2024);
      if (!comment) {
        return res.status(404).json({ message: "MODO comment not found" });
      }
      res.json(comment);
    } catch (error) {
      console.error("Error fetching MODO comment:", error);
      res.status(500).json({ message: "Failed to fetch MODO comment" });
    }
  });

  // Buscar comentario MODO por trimestre/año
  app.get("/api/modo-comments/quarter", requireAuth, async (req, res) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : null;
    const year = req.query.year ? parseInt(req.query.year as string) : null;

    if (!clientId || !quarter || !year || isNaN(clientId) || isNaN(quarter) || isNaN(year)) {
      return res.status(400).json({ message: "Missing or invalid parameters. Required: clientId, quarter, year" });
    }

    try {
      const comment = await storage.getClientModoCommentByQuarter(clientId, quarter, year);
      if (!comment) {
        return res.status(404).json({ message: "MODO comment not found for the specified quarter" });
      }
      res.json(comment);
    } catch (error) {
      console.error("Error fetching MODO comment by quarter:", error);
      res.status(500).json({ message: "Failed to fetch MODO comment" });
    }
  });

  // Crear un nuevo comentario MODO
  app.post("/api/modo-comments", requireAuth, async (req, res) => {
    try {
      const validatedData = insertClientModoCommentSchema.parse(req.body);
      const comment = await storage.createClientModoComment(validatedData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid MODO comment data", errors: error.errors });
      }
      console.error("Error creating MODO comment:", error);
      res.status(500).json({ message: "Failed to create MODO comment" });
    }
  });

  // Actualizar un comentario MODO
  app.patch("/api/modo-comments/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid comment ID" });

    try {
      const validatedData = insertClientModoCommentSchema.partial().parse(req.body);
      const updatedComment = await storage.updateClientModoComment(id, validatedData);

      if (!updatedComment) {
        return res.status(404).json({ message: "MODO comment not found" });
      }

      res.json(updatedComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid MODO comment data", errors: error.errors });
      }
      console.error("Error updating MODO comment:", error);
      res.status(500).json({ message: "Failed to update MODO comment" });
    }
  });

  // Eliminar un comentario MODO
  app.delete("/api/modo-comments/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid comment ID" });

    try {
      const success = await storage.deleteClientModoComment(id);
      if (!success) {
        return res.status(404).json({ message: "MODO comment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting MODO comment:", error);
      res.status(500).json({ message: "Failed to delete MODO comment" });
    }
  });

  // Obtener resumen MODO por cliente
  app.get("/api/modo-summary/client/:clientId", requireAuth, async (req, res) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

    try {
      const summary = await storage.getClientModoSummary(clientId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching MODO summary:", error);
      res.status(500).json({ message: "Failed to fetch MODO summary" });
    }
  });

  /* MODO Routes START */
  app.get("/api/clients/:id/modo-summary", requireAuth, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Cliente ID inválido" });
      }

      // Obtener entregables a través de proyectos activos relacionados con el cliente
      const { rows: activeProjects } = await db.execute(
        `SELECT ap.id FROM active_projects ap
         JOIN quotations q ON ap.quotation_id = q.id
         WHERE q.client_id = ${clientId}`
      );

      // Si no hay proyectos, devolver resultado vacío
      if (!activeProjects.length) {
        return res.json({
          totalDeliverables: 0,
          onTimeDeliveries: 0,
          onTimePercentage: 0,
          averageScores: {
            narrativeQuality: 0,
            graphicsEffectiveness: 0,
            formatDesign: 0,
            relevantInsights: 0,
            operationsFeedback: 0,
            clientFeedback: 0,
            briefCompliance: 0,
            hoursCompliance: 0
          },
          averageHours: {
            available: 0,
            real: 0,
            compliance: 0
          },
          totalComments: 0
        });
      }

      // Crear lista de IDs de proyectos para usar en IN clause
      const projectIds = activeProjects.map(p => p.id).join(',');

      // Obtener entregables usando los IDs de proyectos activos
      const { rows: deliverables } = await db.execute(
        `SELECT * FROM deliverables WHERE project_id IN (${projectIds})`
      );



      // Calcular métricas
      const totalDeliverables = deliverables.length;
      const onTimeDeliveries = deliverables.filter(d => d.on_time).length;
      const onTimePercentage = totalDeliverables > 0 ? (onTimeDeliveries / totalDeliverables) * 100 : 0;

      // Inicializar sumas para promedios
      let sumNarrativeQuality = 0;
      let sumGraphicsEffectiveness = 0;
      let sumFormatDesign = 0;
      let sumRelevantInsights = 0;
      let sumOperationsFeedback = 0;
      let sumClientFeedback = 0;
      let sumBriefCompliance = 0;
      let sumHoursCompliance = 0;

      // Variables para horas
      let sumHoursAvailable = 0;
      let sumHoursReal = 0;

      let countNarrativeQuality = 0;
      let countGraphicsEffectiveness = 0;
      let countFormatDesign = 0;
      let countRelevantInsights = 0;
      let countOperationsFeedback = 0;
      let countClientFeedback = 0;
      let countBriefCompliance = 0;
      let countHoursCompliance = 0;
      let countHoursData = 0;

      // Sumar valores para cada categoría (ignorando null/undefined)
      for (const deliverable of deliverables) {
        if (deliverable.narrative_quality !== null && deliverable.narrative_quality !== undefined) {
          sumNarrativeQuality += Number(deliverable.narrative_quality);
          countNarrativeQuality++;
        }

        if (deliverable.graphics_effectiveness !== null && deliverable.graphics_effectiveness !== undefined) {
          sumGraphicsEffectiveness += Number(deliverable.graphics_effectiveness);
          countGraphicsEffectiveness++;
        }

        if (deliverable.format_design !== null && deliverable.format_design !== undefined) {
          sumFormatDesign += Number(deliverable.format_design);
          countFormatDesign++;
        }

        if (deliverable.relevant_insights !== null && deliverable.relevant_insights !== undefined) {
          sumRelevantInsights += Number(deliverable.relevant_insights);
          countRelevantInsights++;
        }

        if (deliverable.operations_feedback !== null && deliverable.operations_feedback !== undefined) {
          sumOperationsFeedback += Number(deliverable.operations_feedback);
          countOperationsFeedback++;
        }

        if (deliverable.client_feedback !== null && deliverable.client_feedback !== undefined) {
          sumClientFeedback += Number(deliverable.client_feedback);
          countClientFeedback++;
        }

        if (deliverable.brief_compliance !== null && deliverable.brief_compliance !== undefined) {
          sumBriefCompliance += Number(deliverable.brief_compliance);
          countBriefCompliance++;
        }

        // Datos de horas
        if (deliverable.hours_compliance !== null && deliverable.hours_compliance !== undefined) {
          sumHoursCompliance += Number(deliverable.hours_compliance);
          countHoursCompliance++;
        }

        if (deliverable.hours_available !== null && deliverable.hours_available !== undefined && 
            deliverable.hours_real !== null && deliverable.hours_real !== undefined) {
          sumHoursAvailable += Number(deliverable.hours_available);
          sumHoursReal += Number(deliverable.hours_real);
          countHoursData++;
        }
      }

      // Calcular promedios
      const averageNarrativeQuality = countNarrativeQuality > 0 ? sumNarrativeQuality / countNarrativeQuality : 0;
      const averageGraphicsEffectiveness = countGraphicsEffectiveness > 0 ? sumGraphicsEffectiveness / countGraphicsEffectiveness : 0;
      const averageFormatDesign = countFormatDesign > 0 ? sumFormatDesign / countFormatDesign : 0;
      const averageRelevantInsights = countRelevantInsights > 0 ? sumRelevantInsights / countRelevantInsights : 0;
      const averageOperationsFeedback = countOperationsFeedback > 0 ? sumOperationsFeedback / countOperationsFeedback : 0;
      const averageClientFeedback = countClientFeedback > 0 ? sumClientFeedback / countClientFeedback : 0;
      const averageBriefCompliance = countBriefCompliance > 0 ? sumBriefCompliance / countBriefCompliance : 0;
      const averageHoursCompliance = countHoursCompliance > 0 ? sumHoursCompliance / countHoursCompliance : 0;

      // Calcular promedios de horas
      const averageHoursAvailable = countHoursData > 0 ? sumHoursAvailable / countHoursData : 0;
      const averageHoursReal = countHoursData > 0 ? sumHoursReal / countHoursData : 0;

      // Obtener comentarios MODO
      const { rows: comments } = await db.execute(
        `SELECT * FROM client_modo_comments 
         WHERE client_id = ${clientId} 
         ORDER BY year DESC, quarter DESC`
      );

      const totalComments = comments.length;
      const latestComment = comments.length > 0 ? comments[0] : undefined;

      const modoSummary = {
        totalDeliverables,
        onTimeDeliveries,
        onTimePercentage,
        averageScores: {
          narrativeQuality: averageNarrativeQuality,
          graphicsEffectiveness: averageGraphicsEffectiveness,
          formatDesign: averageFormatDesign,
          relevantInsights: averageRelevantInsights,
          operationsFeedback: averageOperationsFeedback,
          clientFeedback: averageClientFeedback,
          briefCompliance: averageBriefCompliance,
          hoursCompliance: averageHoursCompliance
        },
        averageHours: {
          available: averageHoursAvailable,
          real: averageHoursReal,
          compliance: averageHoursCompliance
        },
        totalComments,
        latestComment
      };

      res.json(modoSummary);
    } catch (error) {
      console.error("Error al obtener resumen MODO:", error);
      res.status(500).json({ message: "Error al obtener resumen MODO" });
    }
  });

  app.get("/api/clients/:id/deliverables", requireAuth, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Cliente ID inválido" });
      }

      // Obtener proyectos activos relacionados con el cliente
      const { rows: activeProjects } = await db.execute(
        `SELECT ap.id FROM active_projects ap
         JOIN quotations q ON ap.quotation_id = q.id
         WHERE q.client_id = ${clientId}`
      );

      // Si no hay proyectos, devolver array vacío
      if (!activeProjects.length) {
        return res.json([]);
      }

      // Crear lista de IDs de proyectos para usar en IN clause
      const projectIds = activeProjects.map(p => p.id).join(',');

      // Obtener entregables usando los IDs de proyectos activos
      const { rows } = await db.execute(
        `SELECT * FROM deliverables 
         WHERE project_id IN (${projectIds})
         ORDER BY delivery_date DESC`
      );

      res.json(rows);
    } catch (error) {
      console.error("Error al obtener entregables:", error);
      res.status(500).json({ message: "Error al obtener entregables" });
    }
  });

  app.get("/api/clients/:id/modo-comments", requireAuth, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Cliente ID inválido" });
      }

      const comments = await storage.getClientModoComments(clientId);
      res.json(comments);
    } catch (error) {
      console.error("Error al obtener comentarios MODO:", error);
      res.status(500).json({ message: "Error al obtener comentarios MODO" });
    }
  });

  // Obtener entregables para un cliente específico
  /* Esta ruta está duplicada y no se usa */

  app.post("/api/clients/:id/modo-comments", requireAuth, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Cliente ID inválido" });
      }

      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "Acceso no autorizado" });
      }

      const schema = insertClientModoCommentSchema.parse({
        ...req.body,
        clientId,
        createdBy: currentUser.id
      });

      const comment = await storage.createClientModoComment(schema);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error al crear comentario MODO:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear comentario MODO" });
    }
  });

  app.post("/api/deliverables", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "Acceso no autorizado" });
      }

      // Validar datos
      const schema = insertDeliverableSchema.parse({
        ...req.body,
        createdBy: currentUser.id
      });

      const deliverable = await storage.createDeliverable(schema);
      res.status(201).json(deliverable);
    } catch (error) {
      console.error("Error al crear entregable:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Error al crear entregable" });
    }
  });

  app.put("/api/deliverables/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de entregable inválido" });
      }

      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "Acceso no autorizado" });
      }

      // Actualizar solo los campos enviados
      const deliverable = await storage.updateDeliverable(id, {
        ...req.body,
        updatedAt: new Date()
      });

      if (!deliverable) {
        return res.status(404).json({ message: "Entregable no encontrado" });
      }

      res.json(deliverable);
    } catch (error) {
      console.error("Error al actualizar entregable:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Error al actualizar entregable" });
    }
  });
  /* MODO Routes END */

  // =========== RUTAS PARA PLANTILLAS RECURRENTES ===========

  // Crear plantilla recurrente
  app.post("/api/recurring-templates", requireAuth, async (req, res) => {
    try {
      const validatedData = insertRecurringProjectTemplateSchema.parse(req.body);
      const template = await storage.createRecurringTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      console.error("Error creating recurring template:", error);
      res.status(500).json({ message: "Failed to create recurring template" });
    }
  });

  // Obtener plantillas recurrentes por proyecto padre
  app.get("/api/projects/:parentProjectId/recurring-templates", requireAuth, async (req, res) => {
    try {
      const parentProjectId = parseInt(req.params.parentProjectId);
      if (isNaN(parentProjectId)) {
        return res.status(400).json({ message: "Invalid parent project ID" });
      }

      const templates = await storage.getRecurringTemplatesByProject(parentProjectId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching recurring templates:", error);
      res.status(500).json({ message: "Failed to fetch recurring templates" });
    }
  });

  // Actualizar plantilla recurrente
  app.put("/api/recurring-templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const updatedTemplate = await storage.updateRecurringTemplate(templateId, req.body);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating recurring template:", error);
      res.status(500).json({ message: "Failed to update recurring template" });
    }
  });

  // Eliminar plantilla recurrente
  app.delete("/api/recurring-templates/:id", requireAuth, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const deleted = await storage.deleteRecurringTemplate(templateId);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting recurring template:", error);
      res.status(500).json({ message: "Failed to delete recurring template" });
    }
  });

  // =========== RUTAS PARA CICLOS DE PROYECTO ===========

  // Obtener ciclos por proyecto padre
  app.get("/api/projects/:parentProjectId/cycles", requireAuth, async (req, res) => {
    try {
      const parentProjectId = parseInt(req.params.parentProjectId);
      if (isNaN(parentProjectId)) {
        return res.status(400).json({ message: "Invalid parent project ID" });
      }

      const cycles = await storage.getProjectCycles(parentProjectId);
      res.json(cycles);
    } catch (error) {
      console.error("Error fetching project cycles:", error);
      res.status(500).json({ message: "Failed to fetch project cycles" });
    }
  });

  // Crear ciclo de proyecto
  app.post("/api/project-cycles", requireAuth, async (req, res) => {
    try {
      const validatedData = insertProjectCycleSchema.parse(req.body);
      const cycle = await storage.createProjectCycle(validatedData);
      res.status(201).json(cycle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cycle data", errors: error.errors });
      }
      console.error("Error creating project cycle:", error);
      res.status(500).json({ message: "Failed to create project cycle" });
    }
  });

  // Completar ciclo (marca como completado y calcula varianza)
  app.patch("/api/project-cycles/:id/complete", requireAuth, async (req, res) => {
    try {
      const cycleId = parseInt(req.params.id);
      if (isNaN(cycleId)) {
        return res.status(400).json({ message: "Invalid cycle ID" });
      }

      const completedCycle = await storage.completeProjectCycle(cycleId);
      if (!completedCycle) {
        return res.status(404).json({ message: "Cycle not found" });
      }

      res.json(completedCycle);
    } catch (error) {
      console.error("Error completing project cycle:", error);
      res.status(500).json({ message: "Failed to complete project cycle" });
    }
  });

  // =========== AUTOMATIZACIÓN DE PROYECTOS RECURRENTES ===========

  // Endpoint para generar automáticamente subproyectos desde plantillas
  app.post("/api/projects/:parentProjectId/auto-generate", requireAuth, async (req, res) => {
    try {
      const parentProjectId = parseInt(req.params.parentProjectId);
      if (isNaN(parentProjectId)) {
        return res.status(400).json({ message: "Invalid parent project ID" });
      }

      const { templateId, periodStart, periodEnd } = req.body;

      const generatedProjects = await storage.autoGenerateSubprojects(
        parentProjectId, 
        templateId, 
        new Date(periodStart), 
        new Date(periodEnd)
      );

      res.json(generatedProjects);
    } catch (error) {
      console.error("Error auto-generating subprojects:", error);
      res.status(500).json({ message: "Failed to auto-generate subprojects" });
    }
  });

  // Endpoint para verificar y crear próximos ciclos pendientes
  app.post("/api/automation/check-pending-cycles", requireAuth, async (req, res) => {
    try {
      const pendingCycles = await storage.checkAndCreatePendingCycles();
      res.json({ 
        message: "Pending cycles checked", 
        created: pendingCycles.length,
        cycles: pendingCycles 
      });
    } catch (error) {
      console.error("Error checking pending cycles:", error);
      res.status(500).json({ message: "Failed to check pending cycles" });
    }
  });

  // =========== PROJECT BASE TEAM ROUTES ===========

  // Obtener equipo base de un proyecto
  app.get("/api/projects/:id/base-team", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      let baseTeam = await storage.getProjectBaseTeam(projectId);
      
      // Si no hay equipo base configurado, usar el equipo de la cotización como fallback
      if (baseTeam.length === 0) {
        console.log(`🔄 No base team found for project ${projectId}, using quotation team as fallback`);
        
        // Obtener la cotización del proyecto
        const [project] = await db.select().from(activeProjects).where(eq(activeProjects.id, projectId));
        if (project && project.quotationId) {
          const quotationTeam = await storage.getQuotationTeamMembers(project.quotationId);
          
          console.log(`🔍 ANTES DEL MAPEO - Datos de cotización:`, quotationTeam.slice(0, 2));
          
          // Convertir formato de cotización a formato de equipo base
          baseTeam = quotationTeam.map(member => {
            console.log(`🔄 MAPEANDO MIEMBRO:`, { id: member.id, hours: member.hours, rate: member.rate });
            
            return {
              id: member.id,
              projectId: projectId,
              personnelId: member.personnelId,
              roleId: member.roleId,
              hours: member.hours,
              rate: member.rate,
              cost: member.cost,
              estimatedHours: member.hours,
              hourlyRate: member.rate
            };
          });
          
          console.log(`🔍 DESPUÉS DEL MAPEO - Equipo base:`, baseTeam.slice(0, 2));
        }
      }
      
      // Enriquecer con información de personal, roles y horas trabajadas reales
      const enrichedTeam = await Promise.all(
        baseTeam.map(async (member) => {
          const [personnelData] = await db.select().from(personnel).where(eq(personnel.id, member.personnelId));
          const [roleData] = await db.select().from(roles).where(eq(roles.id, member.roleId));
          
          // Calcular horas trabajadas reales desde time entries
          const { rows: timeEntryRows } = await pool.query(`
            SELECT COALESCE(SUM(hours), 0) as total_hours
            FROM time_entries 
            WHERE personnel_id = $1 AND project_id = $2
          `, [member.personnelId, projectId]);
          
          const workedHours = parseFloat(timeEntryRows[0]?.total_hours || '0');
          
          const enrichedMember = {
            ...member,
            personnel: personnelData,
            role: roleData,
            name: personnelData?.name || 'Sin nombre',
            hours: workedHours, // Real worked hours from time entries
            estimatedHours: member.hours || member.estimatedHours, // Original estimated hours
            hourlyRate: member.rate || member.hourlyRate // Hourly rate
          };
          
          console.log(`🚀 ENVIANDO AL FRONTEND - ${personnelData?.name}:`, {
            hours: workedHours,
            rate: member.rate,
            cost: member.cost,
            estimatedHours: member.hours || member.estimatedHours,
            hourlyRate: member.rate || member.hourlyRate,
            personnelId: member.personnelId
          });
          
          return enrichedMember;
        })
      );

      console.log(`📤 RESPUESTA COMPLETA AL FRONTEND:`, enrichedTeam.map(m => ({
        name: m.personnel?.name,
        hours: m.hours,
        rate: m.rate,
        estimatedHours: m.estimatedHours,
        hourlyRate: m.hourlyRate,
        personnelId: m.personnelId
      })));

      res.json(enrichedTeam);
    } catch (error) {
      console.error("Error fetching project base team:", error);
      res.status(500).json({ message: "Failed to fetch project base team" });
    }
  });

  // Copiar equipo de cotización a proyecto
  app.post("/api/projects/:id/copy-quotation-team", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Obtener la cotización del proyecto
      const [project] = await db.select().from(activeProjects).where(eq(activeProjects.id, projectId));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Verificar si ya existe equipo base
      const existingTeam = await storage.getProjectBaseTeam(projectId);
      if (existingTeam.length > 0) {
        return res.status(200).json({ 
          message: "El equipo ya existe en este proyecto",
          alreadyExists: true,
          team: existingTeam 
        });
      }

      const baseTeam = await storage.copyQuotationTeamToProject(project.quotationId, projectId);
      res.json({ 
        message: "Equipo copiado exitosamente",
        created: true,
        team: baseTeam 
      });
    } catch (error) {
      console.error("Error copying quotation team to project:", error);
      res.status(500).json({ message: "Failed to copy quotation team" });
    }
  });

  // Crear miembro del equipo base
  app.post("/api/projects/:id/base-team", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const teamData = insertProjectBaseTeamSchema.parse({
        ...req.body,
        projectId
      });

      const member = await storage.createProjectBaseTeam(teamData);
      res.json(member);
    } catch (error) {
      console.error("Error creating base team member:", error);
      res.status(500).json({ message: "Failed to create base team member" });
    }
  });

  // Actualizar miembro del equipo base
  app.patch("/api/base-team/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team member ID" });
      }

      const updateData = req.body;
      const member = await storage.updateProjectBaseTeam(id, updateData);
      
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }

      res.json(member);
    } catch (error) {
      console.error("Error updating base team member:", error);
      res.status(500).json({ message: "Failed to update base team member" });
    }
  });

  // Eliminar miembro del equipo base
  app.delete("/api/base-team/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team member ID" });
      }

      const success = await storage.deleteProjectBaseTeam(id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting base team member:", error);
      res.status(500).json({ message: "Failed to delete base team member" });
    }
  });

  // =========== QUICK TIME ENTRY ROUTES ===========

  // Obtener registros rápidos de tiempo de un proyecto
  app.get("/api/projects/:id/quick-time-entries", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const entries = await storage.getQuickTimeEntries(projectId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching quick time entries:", error);
      res.status(500).json({ message: "Failed to fetch quick time entries" });
    }
  });

  // Crear nuevo registro rápido de tiempo
  app.post("/api/projects/:id/quick-time-entries", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const entryData = insertQuickTimeEntrySchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user?.id
      });

      const entry = await storage.createQuickTimeEntry(entryData);
      res.json(entry);
    } catch (error) {
      console.error("Error creating quick time entry:", error);
      res.status(500).json({ message: "Failed to create quick time entry" });
    }
  });

  // Obtener detalles de un registro rápido
  app.get("/api/quick-time-entries/:id/details", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid entry ID" });
      }

      const details = await storage.getQuickTimeEntryDetails(id);
      
      // Enriquecer con información de personal y roles
      const enrichedDetails = await Promise.all(
        details.map(async (detail) => {
          const [personnelData] = await db.select().from(personnel).where(eq(personnel.id, detail.personnelId));
          const [roleData] = await db.select().from(roles).where(eq(roles.id, detail.roleId));
          
          return {
            ...detail,
            personnel: personnelData,
            role: roleData
          };
        })
      );

      res.json(enrichedDetails);
    } catch (error) {
      console.error("Error fetching quick time entry details:", error);
      res.status(500).json({ message: "Failed to fetch quick time entry details" });
    }
  });

  // Agregar detalle a registro rápido
  app.post("/api/quick-time-entries/:id/details", requireAuth, async (req, res) => {
    try {
      const quickTimeEntryId = parseInt(req.params.id);
      if (isNaN(quickTimeEntryId)) {
        return res.status(400).json({ message: "Invalid entry ID" });
      }

      const detailData = insertQuickTimeEntryDetailSchema.parse({
        ...req.body,
        quickTimeEntryId
      });

      const detail = await storage.createQuickTimeEntryDetail(detailData);
      res.json(detail);
    } catch (error) {
      console.error("Error creating quick time entry detail:", error);
      res.status(500).json({ message: "Failed to create quick time entry detail" });
    }
  });

  // Actualizar detalle de registro rápido
  app.patch("/api/quick-time-entry-details/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid detail ID" });
      }

      const updateData = req.body;
      const detail = await storage.updateQuickTimeEntryDetail(id, updateData);
      
      if (!detail) {
        return res.status(404).json({ message: "Detail not found" });
      }

      res.json(detail);
    } catch (error) {
      console.error("Error updating quick time entry detail:", error);
      res.status(500).json({ message: "Failed to update quick time entry detail" });
    }
  });

  // Eliminar detalle de registro rápido
  app.delete("/api/quick-time-entry-details/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid detail ID" });
      }

      const success = await storage.deleteQuickTimeEntryDetail(id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting quick time entry detail:", error);
      res.status(500).json({ message: "Failed to delete quick time entry detail" });
    }
  });

  // Enviar registro rápido para aprobación
  app.post("/api/quick-time-entries/:id/submit", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid entry ID" });
      }

      const entry = await storage.submitQuickTimeEntry(id);
      res.json(entry);
    } catch (error) {
      console.error("Error submitting quick time entry:", error);
      res.status(500).json({ message: "Failed to submit quick time entry" });
    }
  });

  // Aprobar registro rápido
  app.post("/api/quick-time-entries/:id/approve", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid entry ID" });
      }

      const entry = await storage.approveQuickTimeEntry(id, req.user?.id || 1);
      res.json(entry);
    } catch (error) {
      console.error("Error approving quick time entry:", error);
      res.status(500).json({ message: "Failed to approve quick time entry" });
    }
  });

  // ==================== MONTHLY HOUR ADJUSTMENTS ROUTES ====================

  // Obtener todos los ajustes de horas mensuales de un proyecto
  app.get("/api/projects/:id/monthly-hour-adjustments", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const adjustments = await storage.getMonthlyHourAdjustments(projectId);
      res.json(adjustments);
    } catch (error) {
      console.error("Error fetching monthly hour adjustments:", error);
      res.status(500).json({ message: "Failed to fetch monthly hour adjustments" });
    }
  });

  // Crear o actualizar ajuste de horas mensuales
  app.post("/api/projects/:id/monthly-hour-adjustments", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const adjustmentData = insertMonthlyHourAdjustmentSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user?.id || 1
      });

      const adjustment = await storage.createMonthlyHourAdjustment(adjustmentData);
      res.status(201).json(adjustment);
    } catch (error) {
      console.error("Error creating monthly hour adjustment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create monthly hour adjustment" });
    }
  });

  // Obtener ajuste específico de horas mensuales
  app.get("/api/projects/:id/monthly-hour-adjustments/:personnelId/:year/:month", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const personnelId = parseInt(req.params.personnelId);
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (isNaN(projectId) || isNaN(personnelId) || isNaN(year) || isNaN(month)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const adjustment = await storage.getMonthlyHourAdjustment(projectId, personnelId, year, month);
      if (!adjustment) {
        return res.status(404).json({ message: "Adjustment not found" });
      }

      res.json(adjustment);
    } catch (error) {
      console.error("Error fetching monthly hour adjustment:", error);
      res.status(500).json({ message: "Failed to fetch monthly hour adjustment" });
    }
  });

  // Actualizar ajuste de horas mensuales
  app.patch("/api/monthly-hour-adjustments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adjustment ID" });
      }

      const updateData = insertMonthlyHourAdjustmentSchema.partial().parse(req.body);
      const adjustment = await storage.updateMonthlyHourAdjustment(id, updateData);
      
      if (!adjustment) {
        return res.status(404).json({ message: "Adjustment not found" });
      }

      res.json(adjustment);
    } catch (error) {
      console.error("Error updating monthly hour adjustment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update monthly hour adjustment" });
    }
  });

  // Eliminar ajuste de horas mensuales
  app.delete("/api/monthly-hour-adjustments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adjustment ID" });
      }

      const success = await storage.deleteMonthlyHourAdjustment(id);
      if (!success) {
        return res.status(404).json({ message: "Adjustment not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting monthly hour adjustment:", error);
      res.status(500).json({ message: "Failed to delete monthly hour adjustment" });
    }
  });

  // ==================== PROJECT PRICE ADJUSTMENTS ====================

  // Obtener todos los ajustes de precio de un proyecto
  app.get("/api/projects/:id/price-adjustments", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const adjustments = await storage.getProjectPriceAdjustments(projectId);
      res.json(adjustments);
    } catch (error) {
      console.error("Error fetching project price adjustments:", error);
      res.status(500).json({ message: "Failed to fetch project price adjustments" });
    }
  });

  // Crear ajuste de precio de proyecto
  app.post("/api/projects/:id/price-adjustments", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const adjustmentData = insertProjectPriceAdjustmentSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.user?.id || 1
      });

      const adjustment = await storage.createProjectPriceAdjustment(adjustmentData);
      res.status(201).json(adjustment);
    } catch (error) {
      console.error("Error creating project price adjustment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project price adjustment" });
    }
  });

  // Obtener ajuste específico de precio
  app.get("/api/price-adjustments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adjustment ID" });
      }

      const adjustment = await storage.getProjectPriceAdjustment(id);
      if (!adjustment) {
        return res.status(404).json({ message: "Price adjustment not found" });
      }

      res.json(adjustment);
    } catch (error) {
      console.error("Error fetching project price adjustment:", error);
      res.status(500).json({ message: "Failed to fetch project price adjustment" });
    }
  });

  // Actualizar ajuste de precio
  app.patch("/api/price-adjustments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adjustment ID" });
      }

      const updateData = insertProjectPriceAdjustmentSchema.partial().parse(req.body);
      const adjustment = await storage.updateProjectPriceAdjustment(id, updateData);
      
      if (!adjustment) {
        return res.status(404).json({ message: "Price adjustment not found" });
      }

      res.json(adjustment);
    } catch (error) {
      console.error("Error updating project price adjustment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project price adjustment" });
    }
  });

  // Eliminar ajuste de precio
  app.delete("/api/price-adjustments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adjustment ID" });
      }

      const success = await storage.deleteProjectPriceAdjustment(id);
      if (!success) {
        return res.status(404).json({ message: "Price adjustment not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project price adjustment:", error);
      res.status(500).json({ message: "Failed to delete project price adjustment" });
    }
  });

  // Obtener precio actual del proyecto
  app.get("/api/projects/:id/current-price", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const currentPrice = await storage.getCurrentProjectPrice(projectId);
      res.json({ currentPrice });
    } catch (error) {
      console.error("Error fetching current project price:", error);
      res.status(500).json({ message: "Failed to fetch current project price" });
    }
  });

  // ==================== RUTAS API MEJORADAS ====================

  // Funciones de conversión integradas
  const getCurrentExchangeRate = async (): Promise<number> => {
    try {
      const exchangeRateConfig = await db.select()
        .from(systemConfig)
        .where(eq(systemConfig.configKey, 'usd_exchange_rate'))
        .limit(1);
      
      return exchangeRateConfig.length > 0 ? exchangeRateConfig[0].configValue : 1200;
    } catch (error) {
      console.error("Error fetching current exchange rate:", error);
      return 1200;
    }
  };

  const convertFromUSD = (amountUSD: number, toCurrency: string, exchangeRate: number): number => {
    if (toCurrency === 'USD') return amountUSD;
    return Math.round(amountUSD * exchangeRate * 100) / 100;
  };

  const formatCurrency = (amount: number, currency: string): string => {
    if (currency === 'USD') {
      return `USD ${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    } else {
      return `ARS ${amount.toLocaleString('es-AR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`;
    }
  };

  // Ruta para obtener cotización con conversión automática
  app.get("/api/quotations/:id/display/:currency", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currency = req.params.currency;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      const quotation = await storage.getQuotation(id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const currentRate = await getCurrentExchangeRate();

      // Convertir valores USD a la moneda solicitada
      const convertedQuotation = {
        ...quotation,
        displayCurrency: currency,
        exchangeRateUsed: currentRate,
        baseCostDisplay: convertFromUSD(quotation.baseCost, currency, currentRate),
        complexityAdjustmentDisplay: convertFromUSD(quotation.complexityAdjustment || 0, currency, currentRate),
        totalAmountDisplay: convertFromUSD(quotation.totalAmount, currency, currentRate),
        formattedTotal: formatCurrency(
          convertFromUSD(quotation.totalAmount, currency, currentRate), 
          currency
        )
      };

      res.json(convertedQuotation);
    } catch (error) {
      console.error("Error fetching quotation with currency conversion:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  // Ruta para guardar snapshot de tipo de cambio
  app.post("/api/exchange-rate/snapshot", requireAuth, async (req, res) => {
    try {
      const { rate } = req.body;
      
      if (!rate || rate <= 0) {
        return res.status(400).json({ message: "Invalid exchange rate" });
      }

      await db.insert(exchangeRateHistory).values({
        rate: rate.toString(),
        effectiveFrom: new Date(),
        createdBy: req.user?.id || null,
      });

      res.json({ message: "Exchange rate snapshot saved", rate });
    } catch (error) {
      console.error("Error saving exchange rate snapshot:", error);
      res.status(500).json({ message: "Failed to save exchange rate snapshot" });
    }
  });

  // ==================== ANÁLISIS AVANZADO Y RECOMENDACIONES ====================

  // Punto 2: Análisis detallado de desviaciones - COMENTADO (duplicado más abajo con filtros temporales)
  // app.get("/api/projects/:id/deviation-analysis", requireAuth, async (req, res) => {
    /*try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const quotation = await storage.getQuotation(project.quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Obtener entradas de tiempo del proyecto
      const projectTimeEntries = await db.select({
        timeEntry: timeEntries,
        personnel: personnel,
        role: roles
      })
        .from(timeEntries)
        .innerJoin(personnel, eq(timeEntries.personnelId, personnel.id))
        .leftJoin(roles, eq(personnel.roleId, roles.id))
        .where(eq(timeEntries.projectId, projectId));

      // Obtener miembros del equipo de la cotización
      const quotationTeam = await storage.getQuotationTeamMembers(project.quotationId);

      // Análisis por categorías/roles
      const deviationByRole = new Map();
      
      for (const member of quotationTeam) {
        const roleEntries = projectTimeEntries.filter(entry => 
          entry.timeEntry.personnelId === member.personnelId
        );
        
        const actualHours = roleEntries.reduce((sum, entry) => sum + entry.timeEntry.hours, 0);
        const actualCost = roleEntries.reduce((sum, entry) => sum + (entry.timeEntry.hours * entry.personnel.hourlyRate), 0);
        
        const deviation = {
          personnelId: member.personnelId,
          personnelName: roleEntries[0]?.personnel.name || 'Unknown',
          roleName: roleEntries[0]?.role?.name || 'No role',
          estimated: {
            hours: member.hours,
            cost: member.cost
          },
          actual: {
            hours: actualHours,
            cost: actualCost
          },
          variance: {
            hours: actualHours - member.hours,
            cost: actualCost - member.cost,
            hoursPercentage: member.hours > 0 ? ((actualHours - member.hours) / member.hours) * 100 : 0,
            costPercentage: member.cost > 0 ? ((actualCost - member.cost) / member.cost) * 100 : 0
          }
        };
        
        deviationByRole.set(member.personnelId, deviation);
      }

      // Detectar principales causas de desviación
      const deviations = Array.from(deviationByRole.values());
      const majorDeviations = deviations.filter(d => Math.abs(d.variance.costPercentage) > 20);
      const overBudgetMembers = deviations.filter(d => d.variance.costPercentage > 0);
      const underBudgetMembers = deviations.filter(d => d.variance.costPercentage < 0);

      // Resumen de causas
      const causes = [];
      if (overBudgetMembers.length > underBudgetMembers.length) {
        causes.push({
          type: 'cost_overrun',
          severity: 'high',
          description: `${overBudgetMembers.length} miembros del equipo han excedido sus presupuestos`,
          affectedMembers: overBudgetMembers.map(m => m.personnelName)
        });
      }

      if (majorDeviations.length > 0) {
        causes.push({
          type: 'scope_change',
          severity: 'medium',
          description: `${majorDeviations.length} roles muestran desviaciones significativas (>20%)`,
          affectedRoles: majorDeviations.map(m => m.roleName)
        });
      }

      const analysis = {
        projectId,
        projectName: quotation.projectName,
        totalVariance: {
          estimatedCost: quotationTeam.reduce((sum, m) => sum + m.cost, 0),
          actualCost: deviations.reduce((sum, d) => sum + d.actual.cost, 0),
          variance: deviations.reduce((sum, d) => sum + d.variance.cost, 0)
        },
        deviationByRole: deviations,
        majorDeviations,
        causes,
        summary: {
          membersOverBudget: overBudgetMembers.length,
          membersUnderBudget: underBudgetMembers.length,
          averageVariancePercentage: deviations.reduce((sum, d) => sum + d.variance.costPercentage, 0) / deviations.length
        }
      };

      res.json(analysis);
    } catch (error) {
      console.error("Error in deviation analysis:", error);
      res.status(500).json({ message: "Failed to analyze project deviations" });
    }
  });*/

  /* Punto 3: Recomendaciones automáticas - COMENTADO, VER ENDPOINT ACTUALIZADO MÁS ABAJO
  app.get("/api/projects/:id/recommendations", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Handle temporal filter
      const timeFilter = req.query.timeFilter as string;
      let filterStartDate: Date | undefined;
      let filterEndDate: Date | undefined;
      
      if (timeFilter) {
        const { startDate, endDate } = getDateRangeForFilter(timeFilter);
        filterStartDate = startDate;
        filterEndDate = endDate;
      }

      const costSummary = await storage.getProjectCostSummary(projectId);
      const quotation = await storage.getQuotation(project.quotationId);

      const recommendations = [];

      // Análisis de presupuesto
      if (costSummary.budgetUtilization > 90) {
        recommendations.push({
          type: 'budget_alert',
          priority: 'high',
          title: 'Presupuesto crítico',
          description: `El proyecto ha utilizado ${costSummary.budgetUtilization.toFixed(1)}% del presupuesto`,
          actions: [
            'Revisar scope del proyecto inmediatamente',
            'Negociar presupuesto adicional con el cliente',
            'Optimizar recursos del equipo'
          ],
          impact: 'financial'
        });
      } else if (costSummary.budgetUtilization > 75) {
        recommendations.push({
          type: 'budget_warning',
          priority: 'medium',
          title: 'Monitoreo de presupuesto',
          description: `Presupuesto al ${costSummary.budgetUtilization.toFixed(1)}% - requiere atención`,
          actions: [
            'Planificar entregables restantes cuidadosamente',
            'Revisar eficiencia del equipo semanalmente'
          ],
          impact: 'financial'
        });
      }

      // Análisis de markup
      if (costSummary.markup < 1.2) {
        recommendations.push({
          type: 'markup_critical',
          priority: 'high',
          title: 'Rentabilidad crítica',
          description: `Markup actual de ${costSummary.markup.toFixed(2)}x está por debajo del mínimo`,
          actions: [
            'Evaluar reducción de scope no crítico',
            'Incrementar eficiencia operativa',
            'Considerar renegociación con cliente'
          ],
          impact: 'profitability'
        });
      } else if (costSummary.markup < 1.8) {
        recommendations.push({
          type: 'markup_warning',
          priority: 'medium',
          title: 'Mejorar rentabilidad',
          description: `Markup de ${costSummary.markup.toFixed(2)}x puede optimizarse`,
          actions: [
            'Identificar tareas de alto valor',
            'Optimizar procesos internos'
          ],
          impact: 'profitability'
        });
      }

      // Análisis temporal
      if (project.expectedEndDate) {
        const daysUntilDeadline = Math.ceil((new Date(project.expectedEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const progressPercentage = costSummary.targetHours > 0 ? (costSummary.filteredHours / costSummary.targetHours) * 100 : 0;
        
        if (daysUntilDeadline < 0) {
          recommendations.push({
            type: 'deadline_overdue',
            priority: 'high',
            title: 'Proyecto retrasado',
            description: `El proyecto está ${Math.abs(daysUntilDeadline)} días retrasado`,
            actions: [
              'Comunicar nueva fecha estimada al cliente',
              'Revisar recursos disponibles',
              'Priorizar entregables críticos'
            ],
            impact: 'timeline'
          });
        } else if (daysUntilDeadline < 7 && progressPercentage < 80) {
          recommendations.push({
            type: 'deadline_risk',
            priority: 'high',
            title: 'Riesgo de incumplimiento',
            description: `Faltan ${daysUntilDeadline} días y el progreso es ${progressPercentage.toFixed(1)}%`,
            actions: [
              'Asignar recursos adicionales urgentemente',
              'Comunicar riesgos al cliente proactivamente'
            ],
            impact: 'timeline'
          });
        }
      }

      // Análisis de eficiencia del equipo
      const projectTimeEntries2 = await db.select({
        timeEntry: timeEntries,
        personnel: personnel
      })
        .from(timeEntries)
        .innerJoin(personnel, eq(timeEntries.personnelId, personnel.id))
        .where(eq(timeEntries.projectId, projectId));

      const last7Days = projectTimeEntries2.filter(entry => {
        const entryDate = new Date(entry.timeEntry.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return entryDate >= weekAgo;
      });

      if (last7Days.length === 0) {
        recommendations.push({
          type: 'activity_low',
          priority: 'medium',
          title: 'Baja actividad reciente',
          description: 'No se han registrado horas en los últimos 7 días',
          actions: [
            'Verificar estado del equipo',
            'Revisar bloqueos del proyecto'
          ],
          impact: 'productivity'
        });
      }

      // Predicciones con filtro temporal
      const velocityData = await calculateProjectVelocity(projectId, filterStartDate, filterEndDate);
      
      const predictions = {
        estimatedCompletionDate: velocityData.estimatedCompletion,
        projectedFinalCost: velocityData.projectedCost,
        projectedFinalMarkup: velocityData.projectedMarkup,
        confidenceLevel: velocityData.confidence
      };

      res.json({
        projectId,
        projectName: quotation?.projectName || 'Unknown Project',
        recommendations,
        predictions,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });*/

  // Punto 4: Datos para gráficos de tendencias
  app.get("/api/projects/:id/trend-data", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const period = req.query.period as string || 'weekly'; // weekly, monthly
      const { startDate, endDate } = req.query;
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Construir condiciones de filtro
      const whereConditions = [eq(timeEntries.projectId, projectId)];
      
      if (startDate && endDate) {
        whereConditions.push(
          gte(timeEntries.date, startDate as string),
          lte(timeEntries.date, endDate as string)
        );
      }

      const projectTimeEntries3 = await db.select({
        timeEntry: timeEntries,
        personnel: personnel
      })
        .from(timeEntries)
        .innerJoin(personnel, eq(timeEntries.personnelId, personnel.id))
        .where(and(...whereConditions))
        .orderBy(asc(timeEntries.date));

      // Agrupar por período
      const groupedData = new Map();
      const quotation = await storage.getQuotation(project.quotationId);
      
      for (const entry of projectTimeEntries3) {
        const date = new Date(entry.timeEntry.date);
        let periodKey;
        
        if (period === 'weekly') {
          // Obtener inicio de semana (lunes)
          const monday = new Date(date);
          monday.setDate(date.getDate() - date.getDay() + 1);
          periodKey = monday.toISOString().split('T')[0];
        } else {
          // Mensual
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!groupedData.has(periodKey)) {
          groupedData.set(periodKey, {
            period: periodKey,
            hours: 0,
            cost: 0,
            entries: 0,
            uniqueMembers: new Set()
          });
        }

        const periodData = groupedData.get(periodKey);
        periodData.hours += entry.timeEntry.hours;
        periodData.cost += entry.timeEntry.hours * entry.personnel.hourlyRate;
        periodData.entries += 1;
        periodData.uniqueMembers.add(entry.timeEntry.personnelId);
      }

      // Convertir a array y agregar métricas acumulativas
      const trendData = Array.from(groupedData.values()).map(data => ({
        ...data,
        uniqueMembers: data.uniqueMembers.size,
        averageHoursPerMember: data.uniqueMembers.size > 0 ? data.hours / data.uniqueMembers.size : 0
      }));

      // Calcular métricas acumulativas
      let cumulativeHours = 0;
      let cumulativeCost = 0;
      const targetCost = quotation?.baseCost || 0;
      const targetHours = quotation ? await calculateEstimatedHours(quotation.id) : 0;

      const enhancedTrendData = trendData.map(data => {
        cumulativeHours += data.hours;
        cumulativeCost += data.cost;
        
        return {
          ...data,
          cumulativeHours,
          cumulativeCost,
          progressPercentage: targetHours > 0 ? (cumulativeHours / targetHours) * 100 : 0,
          budgetUtilization: targetCost > 0 ? (cumulativeCost / targetCost) * 100 : 0,
          currentMarkup: cumulativeCost > 0 ? (quotation?.totalAmount || 0) / cumulativeCost : 0
        };
      });

      // Análisis de velocidad
      const velocityAnalysis = calculateVelocityTrends(enhancedTrendData);

      // Predicciones futuras
      const futureProjections = generateProjections(enhancedTrendData, targetHours, targetCost);

      res.json({
        projectId,
        period,
        trendData: enhancedTrendData,
        velocityAnalysis,
        futureProjections,
        summary: {
          totalPeriods: enhancedTrendData.length,
          averageHoursPerPeriod: trendData.reduce((sum, d) => sum + d.hours, 0) / trendData.length || 0,
          averageCostPerPeriod: trendData.reduce((sum, d) => sum + d.cost, 0) / trendData.length || 0,
          peakActivity: trendData.reduce((max, d) => d.hours > max.hours ? d : max, { hours: 0 })
        }
      });
    } catch (error) {
      console.error("Error generating trend data:", error);
      res.status(500).json({ message: "Failed to generate trend data" });
    }
  });

  // Funciones auxiliares para cálculos avanzados
  async function calculateProjectVelocity(projectId: number, startDate?: string, endDate?: string) {
    // Obtener registros con filtro de fechas si está presente
    const whereConditions = [eq(timeEntries.projectId, projectId)];
    if (startDate && endDate) {
      whereConditions.push(
        gte(timeEntries.date, new Date(startDate)),
        lte(timeEntries.date, new Date(endDate))
      );
    }

    const projectEntries = await db.select()
      .from(timeEntries)
      .where(and(...whereConditions))
      .orderBy(asc(timeEntries.date));

    if (projectEntries.length < 2) {
      return {
        estimatedCompletion: null,
        projectedCost: 0,
        projectedMarkup: 0,
        confidence: 'low'
      };
    }

    // Calcular velocidad promedio (horas por semana)
    const first = new Date(projectEntries[0].date);
    const last = new Date(projectEntries[projectEntries.length - 1].date);
    const weeksDiff = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const totalHours = projectEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalCost = projectEntries.reduce((sum, entry) => sum + entry.totalCost, 0);
    const velocityPerWeek = totalHours / weeksDiff;

    const project = await storage.getActiveProject(projectId);
    const quotation = project ? await storage.getQuotation(project.quotationId) : null;
    let targetHours = quotation ? await calculateEstimatedHours(quotation.id) : 0;
    let targetCost = quotation?.baseCost || 0;
    
    // Ajustar horas objetivo para contratos mensuales con filtro temporal
    if (quotation?.projectType === 'fee-mensual' && startDate && endDate) {
      const filterStart = new Date(startDate);
      const filterEnd = new Date(endDate);
      const monthsDiff = Math.max(1, 
        (filterEnd.getFullYear() - filterStart.getFullYear()) * 12 + 
        (filterEnd.getMonth() - filterStart.getMonth()) + 1
      );
      console.log(`📊 Monthly contract adjustment: ${monthsDiff} months, original hours: ${targetHours}`);
      targetHours = targetHours * monthsDiff;
      targetCost = targetCost * monthsDiff;
    }
    
    const remainingHours = Math.max(0, targetHours - totalHours);
    const weeksToComplete = velocityPerWeek > 0 && remainingHours > 0 ? remainingHours / velocityPerWeek : null;
    
    console.log(`📊 Velocity calculation: targetHours=${targetHours}, totalHours=${totalHours}, remainingHours=${remainingHours}, velocityPerWeek=${velocityPerWeek}, weeksToComplete=${weeksToComplete}`);
    
    // Si el proyecto ya superó las horas, estimar fecha basada en velocidad actual para completar el scope total
    let estimatedCompletion = null;
    if (weeksToComplete) {
      estimatedCompletion = new Date(Date.now() + weeksToComplete * 7 * 24 * 60 * 60 * 1000);
    } else if (totalHours >= targetHours && project?.expectedEndDate) {
      // Si ya se superaron las horas, usar la fecha esperada del proyecto
      estimatedCompletion = new Date(project.expectedEndDate);
    }

    // Proyectar costo final basado en tendencia actual
    const costPerHour = totalHours > 0 ? totalCost / totalHours : 0;
    const projectedFinalCost = totalCost + (remainingHours * costPerHour);
    
    // Calcular markup proyectado con el costo proyectado
    const projectedMarkup = quotation && projectedFinalCost > 0 ? 
      (quotation.totalAmount / projectedFinalCost) : 0;

    return {
      estimatedCompletion,
      projectedCost: projectedFinalCost || targetCost,
      projectedMarkup,
      confidence: projectEntries.length > 10 ? 'high' : projectEntries.length > 5 ? 'medium' : 'low'
    };
  }

  async function calculateEstimatedHours(quotationId: number): Promise<number> {
    const teamMembers = await storage.getQuotationTeamMembers(quotationId);
    return teamMembers.reduce((total, member) => total + member.hours, 0);
  }

  function calculateVelocityTrends(trendData: any[]) {
    if (trendData.length < 2) return { trend: 'insufficient_data' };

    const recentPeriods = trendData.slice(-3);
    const earlierPeriods = trendData.slice(0, -3);

    const recentAvg = recentPeriods.reduce((sum, d) => sum + d.hours, 0) / recentPeriods.length;
    const earlierAvg = earlierPeriods.length > 0 ? 
      earlierPeriods.reduce((sum, d) => sum + d.hours, 0) / earlierPeriods.length : recentAvg;

    const velocityChange = ((recentAvg - earlierAvg) / earlierAvg) * 100;

    return {
      trend: velocityChange > 10 ? 'accelerating' : velocityChange < -10 ? 'decelerating' : 'stable',
      velocityChange,
      recentAverage: recentAvg,
      historicalAverage: earlierAvg
    };
  }

  function generateProjections(trendData: any[], targetHours: number, targetCost: number) {
    if (trendData.length < 2) return { available: false };

    const lastPeriod = trendData[trendData.length - 1];
    const avgHoursPerPeriod = trendData.reduce((sum, d) => sum + d.hours, 0) / trendData.length;
    
    const remainingHours = Math.max(0, targetHours - lastPeriod.cumulativeHours);
    const estimatedPeriodsRemaining = avgHoursPerPeriod > 0 ? Math.ceil(remainingHours / avgHoursPerPeriod) : 0;

    return {
      available: true,
      estimatedPeriodsToComplete: estimatedPeriodsRemaining,
      projectedFinalCost: lastPeriod.cumulativeCost + (remainingHours * (lastPeriod.cumulativeCost / lastPeriod.cumulativeHours || 0)),
      projectedCompletionDate: new Date(Date.now() + estimatedPeriodsRemaining * 7 * 24 * 60 * 60 * 1000),
      confidence: trendData.length > 8 ? 'high' : trendData.length > 4 ? 'medium' : 'low'
    };
  }

  // Endpoint TEST sin auth para diagnosis
  app.get('/api/projects/:id/deviation-analysis-test', async (req, res) => {
    console.log(`🟢🟢🟢 TEST ENDPOINT HIT - ID: ${req.params.id}, Query:`, req.query);
    res.json({ test: 'working', params: req.params, query: req.query });
  });

  // Endpoint para análisis de desviaciones
  app.get('/api/projects/:id/deviation-analysis', requireAuth, async (req, res) => {
    console.log(`🚀🚀🚀 DEVIATION ANALYSIS ENDPOINT HIT - ID: ${req.params.id}`);
    try {
      const projectId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;
      
      console.log(`🔍🔍🔍 DEVIATION ANALYSIS CALLED - ProjectId: ${projectId}, StartDate: ${startDate}, EndDate: ${endDate}`);
      
      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const quotation = await storage.getQuotation(project.quotationId);
      const teamMembers = await storage.getQuotationTeamMembers(project.quotationId);
      
      // NUEVO: Obtener costos directos del Excel MAESTRO para horas objetivo
      let excelDirectCosts = await storage.getDirectCostsByProject(projectId);
      
      // Aplicar filtro temporal a costos directos si está especificado
      if (startDate && endDate) {
        excelDirectCosts = excelDirectCosts.filter(cost => {
          // Manejar diferentes formatos de mes en el Excel MAESTRO
          let monthNumber;
          if (cost.mes.includes(' ')) {
            // Formato "08 ago", "05 may", etc.
            monthNumber = parseInt(cost.mes.substring(0, 2));
          } else {
            // Formato "Agosto", "Mayo", etc.
            monthNumber = storage.getMonthNumber(cost.mes);
          }
          const costDate = new Date(`${cost.año}-${monthNumber}-15`); // Día 15 del mes
          const filterStartDate = new Date(startDate as string);
          const filterEndDate = new Date(endDate as string);
          return costDate >= filterStartDate && costDate <= filterEndDate;
        });
      }
      
      console.log(`📊 Found ${excelDirectCosts.length} Excel MAESTRO cost records for deviation analysis`);
      
      // Construir condiciones de filtro
      const whereConditions = [eq(timeEntries.projectId, projectId)];
      
      if (startDate && endDate) {
        whereConditions.push(
          gte(timeEntries.date, startDate as string),
          lte(timeEntries.date, endDate as string)
        );
      }

      console.log(`🔍 Building query with conditions:`, whereConditions);
      
      // Simplificar la consulta para evitar problemas de relaciones
      const projectTimeEntries = await db.select()
        .from(timeEntries)
        .where(and(...whereConditions));
      
      console.log(`🔍 Found ${projectTimeEntries.length} time entries before joining with personnel`);
      
      // Obtener información del personal por separado
      const personnelIds = [...new Set(projectTimeEntries.map(entry => entry.personnelId))];
      const personnelData = personnelIds.length > 0 ? await db.select()
        .from(personnel)
        .where(inArray(personnel.id, personnelIds)) : [];
      
      console.log(`🔍 Found ${personnelData.length} personnel records`);
      
      console.log(`🔍 Deviation analysis - Found ${projectTimeEntries.length} time entries after filtering`);

      // Si no hay registros de tiempo filtrados, devolver estructura vacía
      if (projectTimeEntries.length === 0) {
        console.log(`🔍 Deviation analysis - No time entries found for the filtered period, returning empty data`);
        return res.json({
          deviationByRole: [],
          totalVariance: { variance: 0 },
          summary: { membersOverBudget: 0, membersUnderBudget: 0 },
          majorDeviations: [],
          analysis: []
        });
      }

      // Calcular desviaciones solo para miembros que tienen registros en el período filtrado
      const membersWithTimeEntries = teamMembers.filter(member => 
        projectTimeEntries.some(entry => entry.personnelId === member.personnelId)
      );

      console.log(`🔍 Deviation analysis - Found ${membersWithTimeEntries.length} team members with time entries in filtered period`);

      const deviationByRole = membersWithTimeEntries.map(member => {
        const memberTimeEntries = projectTimeEntries.filter(entry => 
          entry.personnelId === member.personnelId
        );
        
        const memberPersonnel = personnelData.find(p => p.id === member.personnelId);
        
        const actualHours = memberTimeEntries.reduce((sum, entry) => 
          sum + entry.hours, 0);
        const actualCost = memberTimeEntries.reduce((sum, entry) => 
          sum + (entry.hours * (entry.hourlyRateAtTime || member.rate)), 0);
        
        // NUEVO: Obtener horas objetivo del Excel MAESTRO para este miembro
        const memberExcelCosts = excelDirectCosts.filter(cost => cost.persona === memberPersonnel?.name);
        const targetHours = memberExcelCosts.reduce((sum, cost) => sum + (cost.horasObjetivo || 0), 0);
        
        console.log(`📊 Deviation Analysis - ${memberPersonnel?.name}: Estimated: ${member.hours}h, Target: ${targetHours}h, Actual: ${actualHours}h`);

        const hoursVariance = actualHours - member.hours;
        const costVariance = actualCost - member.cost;
        
        // NUEVO: Calcular desviación vs horas objetivo del Excel MAESTRO
        const targetVariance = targetHours > 0 ? actualHours - targetHours : 0;
        const targetVariancePercentage = targetHours > 0 ? (targetVariance / targetHours) * 100 : 0;
        
        // NUEVO: Calcular eficiencia (horas objetivo vs trabajadas)
        const efficiency = targetHours > 0 && actualHours > 0 ? (targetHours / actualHours) * 100 : 0;

        return {
          personnelId: member.personnelId,
          personnelName: memberPersonnel?.name || 'Unknown',
          roleName: 'Team Member',
          estimated: {
            hours: member.hours,
            cost: member.cost
          },
          actual: {
            hours: actualHours,
            cost: actualCost
          },
          // NUEVO: Agregar información de horas objetivo del Excel MAESTRO
          target: {
            hours: targetHours,
            efficiency: efficiency
          },
          variance: {
            hours: hoursVariance,
            cost: costVariance,
            hoursPercentage: member.hours > 0 ? (hoursVariance / member.hours) * 100 : 0,
            costPercentage: member.cost > 0 ? (costVariance / member.cost) * 100 : 0,
            // NUEVO: Desviación vs horas objetivo
            targetHours: targetVariance,
            targetHoursPercentage: targetVariancePercentage
          }
        };
      });

      // Calcular totales
      const totalEstimatedCost = teamMembers.reduce((sum, member) => sum + member.cost, 0);
      const totalActualCost = projectTimeEntries.reduce((sum, entry) => 
        sum + (entry.hours * (entry.hourlyRateAtTime || 100)), 0);
      const totalVariance = totalActualCost - totalEstimatedCost;

      // Identificar desviaciones mayores (>20%)
      const majorDeviations = deviationByRole.filter(deviation => 
        Math.abs(deviation.variance.costPercentage) > 20
      );

      // Generar causas basadas en análisis
      const causes = [];
      if (majorDeviations.length > 0) {
        causes.push({
          type: 'budget_overrun',
          severity: 'high',
          description: 'Algunos miembros del equipo excedieron significativamente el presupuesto estimado',
          affectedMembers: majorDeviations.map(d => d.personnelName)
        });
      }

      const membersOverBudget = deviationByRole.filter(d => d.variance.costPercentage > 0).length;
      const membersUnderBudget = deviationByRole.filter(d => d.variance.costPercentage < 0).length;

      res.json({
        projectId,
        projectName: project.name,
        totalVariance: {
          estimatedCost: totalEstimatedCost,
          actualCost: totalActualCost,
          variance: totalVariance
        },
        deviationByRole,
        majorDeviations,
        causes,
        summary: {
          membersOverBudget,
          membersUnderBudget,
          averageVariancePercentage: deviationByRole.length > 0 ? 
            deviationByRole.reduce((sum, d) => sum + Math.abs(d.variance.costPercentage), 0) / deviationByRole.length : 0
        }
      });
    } catch (error) {
      console.error("Error generating deviation analysis:", error);
      res.status(500).json({ message: "Failed to generate deviation analysis" });
    }
  });

  // Endpoint para recomendaciones
  app.get('/api/projects/:id/recommendations', requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { startDate, endDate, timeFilter } = req.query;
      
      console.log(`🔍🔍🔍 RECOMMENDATIONS CALLED - ProjectId: ${projectId}, TimeFilter: ${timeFilter}, StartDate: ${startDate}, EndDate: ${endDate}`);
      
      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const quotation = await storage.getQuotation(project.quotationId);
      const teamMembers = await storage.getQuotationTeamMembers(project.quotationId);
      
      // Construir condiciones de filtro
      const whereConditions = [eq(timeEntries.projectId, projectId)];
      
      // Procesar timeFilter o usar startDate/endDate
      let filterStartDate: string | undefined;
      let filterEndDate: string | undefined;
      
      if (timeFilter) {
        const filterDates = getDateRangeForFilter(timeFilter as string);
        filterStartDate = filterDates.startDate.toISOString().split('T')[0];
        filterEndDate = filterDates.endDate.toISOString().split('T')[0];
      } else if (startDate && endDate) {
        filterStartDate = startDate as string;
        filterEndDate = endDate as string;
      }
      
      if (filterStartDate && filterEndDate) {
        whereConditions.push(
          gte(timeEntries.date, new Date(filterStartDate)),
          lte(timeEntries.date, new Date(filterEndDate))
        );
      }

      const projectEntries = await db.select()
        .from(timeEntries)
        .where(and(...whereConditions));

      console.log(`🔍 Recommendations - Found ${projectEntries.length} time entries after filtering`);

      // Si no hay registros de tiempo filtrados, devolver estructura vacía pero con recomendaciones estáticas
      if (projectEntries.length === 0) {
        console.log(`🔍 Recommendations - No time entries found for the filtered period`);
        
        // Aún sin datos podemos dar recomendaciones básicas
        const basicRecommendations = [];
        
        // Recomendación de inicio
        basicRecommendations.push({
          type: 'no_activity',
          priority: 'high',
          title: 'Sin actividad registrada',
          description: 'No se encontraron registros de tiempo en el período seleccionado',
          actions: [
            'Verificar que el equipo esté registrando sus horas',
            'Revisar el filtro temporal seleccionado',
            'Confirmar que el proyecto esté activo en este período'
          ],
          impact: 'timeline'
        });
        
        return res.json({
          projectId,
          projectName: quotation?.projectName || 'Unknown Project',
          recommendations: basicRecommendations,
          predictions: {
            projectedFinalCost: 0,
            projectedCompletionDate: null,
            projectedFinalMarkup: 0,
            confidenceLevel: 'low'
          },
          generatedAt: new Date().toISOString()
        });
      }

      const totalActualCost = projectEntries.reduce((sum, entry) => 
        sum + (entry.hours * (entry.hourlyRateAtTime || 100)), 0);
      let totalEstimatedCost = teamMembers.reduce((sum, member) => sum + member.cost, 0);
      const totalActualHours = projectEntries.reduce((sum, entry) => sum + entry.hours, 0);
      let totalEstimatedHours = teamMembers.reduce((sum, member) => sum + member.hours, 0);
      
      // Ajustar horas estimadas para contratos mensuales con filtro temporal
      if (quotation?.projectType === 'fee-mensual' && filterStartDate && filterEndDate) {
        const startDate = new Date(filterStartDate);
        const endDate = new Date(filterEndDate);
        const monthsDiff = Math.max(1, 
          (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
          (endDate.getMonth() - startDate.getMonth()) + 1
        );
        console.log(`📊 Monthly contract adjustment for recommendations: ${monthsDiff} months`);
        totalEstimatedHours = totalEstimatedHours * monthsDiff;
        totalEstimatedCost = totalEstimatedCost * monthsDiff;
      }

      const recommendations = [];
      
      // Análisis de tendencia de costos
      const costDeviation = ((totalActualCost - totalEstimatedCost) / totalEstimatedCost) * 100;
      const hourDeviation = ((totalActualHours - totalEstimatedHours) / totalEstimatedHours) * 100;
      
      // Ajustar el totalAmount basado en el filtro temporal para coherencia con complete-data
      let adjustedTotalAmount = quotation?.totalAmount || 0;
      if (quotation?.projectType === 'fee-mensual' && filterStartDate && filterEndDate) {
        // Para coherencia con complete-data, usar meses reales con datos, no teóricos
        const monthsSet = new Set<string>();
        projectEntries.forEach(entry => {
          const entryDate = new Date(entry.date);
          const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`;
          monthsSet.add(monthKey);
        });
        const actualMonthsWithData = monthsSet.size || 1;
        
        // Para fee-mensual, totalAmount ya es mensual, no anual
        adjustedTotalAmount = quotation.totalAmount * actualMonthsWithData; // Multiplicar precio mensual por meses con datos reales
        
        console.log(`📊 Markup adjustment: ${quotation.totalAmount} × ${actualMonthsWithData} months = ${adjustedTotalAmount}`);
      }
      
      const currentMarkup = totalActualCost > 0 ? adjustedTotalAmount / totalActualCost : 0;
      
      // INTELIGENCIA DE NEGOCIO: Análisis predictivo de riesgos
      if (costDeviation > 10) {
        const monthlyBurn = totalActualCost / (filterEndDate ? 
          (new Date(filterEndDate).getMonth() - new Date(filterStartDate).getMonth() + 1) : 1);
        const projectedOverrun = monthlyBurn * 12 - quotation?.baseCost;
        
        recommendations.push({
          type: 'financial_risk',
          priority: 'high',
          title: 'Riesgo Financiero Detectado',
          description: `Tendencia de sobrecosto del ${costDeviation.toFixed(1)}%. De continuar así, el proyecto podría exceder el presupuesto anual en $${projectedOverrun.toFixed(0)}`,
          actions: [
            `Reducir asignación de recursos senior en un ${(costDeviation/2).toFixed(0)}%`,
            'Implementar revisión semanal de costos con el equipo',
            'Evaluar automatización de tareas que consumen >20h/mes',
            'Presentar propuesta de ajuste de precio al cliente (+15%)'
          ],
          impact: 'financial'
        });
      }

      // INTELIGENCIA DE NEGOCIO: Análisis de eficiencia operativa
      if (hourDeviation > 0) {
        // Identificar personas con mayor desviación
        const teamAnalysis = projectEntries.reduce((acc, entry) => {
          const person = teamMembers.find(m => m.personnelId === entry.personnelId);
          if (!acc[entry.personnelId]) {
            acc[entry.personnelId] = { 
              name: person?.personnelName || 'Unknown',
              actual: 0, 
              estimated: person?.hours || 0,
              cost: 0
            };
          }
          acc[entry.personnelId].actual += entry.hours;
          acc[entry.personnelId].cost += entry.hours * (entry.hourlyRateAtTime || 100);
          return acc;
        }, {});
        
        const inefficientMembers = Object.values(teamAnalysis)
          .filter(m => m.actual > m.estimated * 1.2)
          .sort((a, b) => (b.actual - b.estimated) - (a.actual - a.estimated))
          .slice(0, 3);
        
        if (inefficientMembers.length > 0) {
          recommendations.push({
            type: 'operational_efficiency',
            priority: 'medium',
            title: 'Optimización Operativa Requerida',
            description: `${inefficientMembers.length} miembros exceden significativamente sus horas estimadas`,
            actions: [
              `Reasignar tareas de ${inefficientMembers[0].name} (${((inefficientMembers[0].actual - inefficientMembers[0].estimated) / inefficientMembers[0].estimated * 100).toFixed(0)}% excedido)`,
              'Evaluar carga de trabajo y redistribuir responsabilidades',
              'Implementar pair programming para acelerar entregables',
              'Considerar contratar junior para tareas operativas repetitivas'
            ],
            impact: 'productivity'
          });
        }
      }
      
      // INTELIGENCIA DE NEGOCIO: Análisis de rentabilidad y oportunidades
      if (currentMarkup < 2.5) {
        const markupGap = 2.5 - currentMarkup;
        const revenueOpportunity = totalActualCost * markupGap;
        
        recommendations.push({
          type: 'profitability_opportunity',
          priority: 'high',
          title: 'Oportunidad de Mejora de Rentabilidad',
          description: `Markup actual de ${currentMarkup.toFixed(2)}x está ${((markupGap/2.5)*100).toFixed(0)}% por debajo del objetivo. Oportunidad de revenue adicional: $${revenueOpportunity.toFixed(0)}`,
          actions: [
            'Identificar y priorizar entregables de alto valor para el cliente',
            `Proponer servicios adicionales por valor de $${(revenueOpportunity * 0.3).toFixed(0)}/mes`,
            'Renegociar contrato incluyendo inflación y ajuste de scope',
            'Implementar modelo de pricing basado en valor, no en horas'
          ],
          impact: 'profitability'
        });
      }

      // INTELIGENCIA DE NEGOCIO: Análisis predictivo basado en tendencias
      if (projectEntries.length >= 3) {
        // Análisis de tendencia mensual
        const monthlyData = projectEntries.reduce((acc, entry) => {
          const month = new Date(entry.date).toISOString().slice(0, 7);
          if (!acc[month]) acc[month] = { hours: 0, cost: 0 };
          acc[month].hours += entry.hours;
          acc[month].cost += entry.hours * (entry.hourlyRateAtTime || 100);
          return acc;
        }, {});
        
        const months = Object.keys(monthlyData).sort();
        if (months.length >= 2) {
          const lastMonth = monthlyData[months[months.length - 1]];
          const prevMonth = monthlyData[months[months.length - 2]];
          const costTrend = ((lastMonth.cost - prevMonth.cost) / prevMonth.cost) * 100;
          
          if (Math.abs(costTrend) > 20) {
            recommendations.push({
              type: 'trend_alert',
              priority: 'medium',
              title: costTrend > 0 ? 'Tendencia de Costos al Alza' : 'Reducción de Actividad Detectada',
              description: costTrend > 0 
                ? `Incremento del ${costTrend.toFixed(0)}% en costos mensuales detectado`
                : `Reducción del ${Math.abs(costTrend).toFixed(0)}% en actividad mensual`,
              actions: costTrend > 0 ? [
                'Revisar si hay scope creep no documentado',
                'Validar que el incremento esté alineado con entregables',
                'Preparar justificación para el cliente'
              ] : [
                'Verificar si el equipo está sub-utilizado',
                'Identificar bloqueos o dependencias externas',
                'Considerar reasignar recursos a otros proyectos'
              ],
              impact: 'timeline'
            });
          }
        }
      }

      // INTELIGENCIA DE NEGOCIO: Recomendación basada en patrones de equipo
      const teamPerformance = teamMembers.map(member => {
        const memberEntries = projectEntries.filter(e => e.personnelId === member.personnelId);
        const actualHours = memberEntries.reduce((sum, e) => sum + e.hours, 0);
        const efficiency = member.hours > 0 ? actualHours / member.hours : 0;
        return { ...member, actualHours, efficiency };
      }).filter(m => m.actualHours > 0);
      
      const overperformers = teamPerformance.filter(m => m.efficiency > 1.5);
      const underperformers = teamPerformance.filter(m => m.efficiency < 0.5 && m.hours > 20);
      
      if (overperformers.length > 0) {
        recommendations.push({
          type: 'team_optimization',
          priority: 'medium',
          title: 'Optimización de Asignación de Equipo',
          description: `${overperformers.length} roles están trabajando 50%+ más de lo estimado`,
          actions: [
            `Redistribuir carga de ${overperformers[0].personnelName} (${overperformers[0].actualHours.toFixed(0)}h vs ${overperformers[0].hours}h estimadas)`,
            'Evaluar si el rol requiere apoyo adicional permanente',
            'Documentar tareas no previstas que están consumiendo tiempo',
            'Considerar ajuste de estimación para próximos períodos'
          ],
          impact: 'productivity'
        });
      }
      
      if (underperformers.length > 0) {
        recommendations.push({
          type: 'resource_utilization',
          priority: 'low',
          title: 'Recursos Sub-utilizados Detectados',
          description: `${underperformers.length} roles están utilizando menos del 50% de sus horas asignadas`,
          actions: [
            `Reasignar ${underperformers[0].personnelName} a otros proyectos (solo ${underperformers[0].actualHours.toFixed(0)}h de ${underperformers[0].hours}h)`,
            'Evaluar si el rol sigue siendo necesario',
            'Aprovechar capacidad disponible para nuevas iniciativas'
          ],
          impact: 'financial'
        });
      }

      // Predicciones mejoradas con inteligencia de negocio
      const isPastPeriod = req.query.timeFilter && 
        (req.query.timeFilter.includes('last') || req.query.timeFilter.includes('pasado'));
      
      let predictions;
      if (isPastPeriod) {
        // Para períodos pasados, mostrar análisis retrospectivo
        // Calcular meses reales con datos para un cálculo más preciso del burn rate
        const monthsSet = new Set<string>();
        projectEntries.forEach(entry => {
          const entryDate = new Date(entry.date);
          const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`;
          monthsSet.add(monthKey);
        });
        const actualMonthsWithData = monthsSet.size || 1;
        
        const monthlyAvg = totalActualCost / actualMonthsWithData;
        
        // Determinar el trimestre actual y el período analizado
        const now = new Date();
        const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
        const currentYear = now.getFullYear();
        
        const analyzedDate = new Date(filterEndDate);
        const analyzedQuarter = Math.floor(analyzedDate.getMonth() / 3) + 1;
        const analyzedYear = analyzedDate.getFullYear();
        
        // Determinar si proyectamos para el Q actual o el siguiente
        let projectionQuarter = currentQuarter;
        let projectionYear = currentYear;
        let projectionLabel = `Q${currentQuarter} ${currentYear}`;
        
        if (analyzedYear === currentYear && analyzedQuarter === currentQuarter) {
          // Si analizamos un mes del Q actual, proyectamos para el resto del Q
          const monthsRemainingInQuarter = 3 - (now.getMonth() % 3);
          predictions = {
            periodAnalysis: true,
            actualCost: totalActualCost,
            actualMarkup: currentMarkup,
            confidenceLevel: 'high' as const,
            businessMetrics: {
              monthlyBurnRate: monthlyAvg,
              projectedAnnualRevenue: quotation && quotation.projectType === 'fee-mensual' ? 
                (quotation.totalAmount * 8) : // Mayo a Diciembre = 8 meses
                (monthlyAvg * currentMarkup * 12),
              breakEvenPoint: currentMarkup >= 1.2 ? 'Alcanzado' : `${((1.2 - currentMarkup) * 100).toFixed(0)}% para alcanzar`,
              clientSatisfactionRisk: hourDeviation > 20 ? 'high' : hourDeviation > 10 ? 'medium' : 'low',
              currentQuarterProjection: {
                label: `Resto de ${projectionLabel}`,
                monthsRemaining: monthsRemainingInQuarter,
                // Para proyectos fee-mensual, usar costo base del contrato para proyecciones futuras
                estimatedCost: quotation && quotation.projectType === 'fee-mensual' ? 
                  (quotation.baseCost * monthsRemainingInQuarter) : // baseCost ya es mensual
                  (monthlyAvg * monthsRemainingInQuarter),
                estimatedRevenue: quotation && quotation.projectType === 'fee-mensual' ? 
                  (quotation.totalAmount * monthsRemainingInQuarter) : 
                  (monthlyAvg * currentMarkup * monthsRemainingInQuarter),
                estimatedProfit: quotation && quotation.projectType === 'fee-mensual' ?
                  (quotation.totalAmount * monthsRemainingInQuarter) - (quotation.baseCost * monthsRemainingInQuarter) :
                  (monthlyAvg * currentMarkup * monthsRemainingInQuarter) - (monthlyAvg * monthsRemainingInQuarter)
              }
            }
          };
        } else {
          // Si analizamos un Q pasado, proyectamos para el Q actual completo
          predictions = {
            periodAnalysis: true,
            actualCost: totalActualCost,
            actualMarkup: currentMarkup,
            confidenceLevel: 'high' as const,
            businessMetrics: {
              monthlyBurnRate: monthlyAvg,
              projectedAnnualRevenue: quotation && quotation.projectType === 'fee-mensual' ? 
                (quotation.totalAmount * 8) : // Mayo a Diciembre = 8 meses
                (monthlyAvg * currentMarkup * 12),
              breakEvenPoint: currentMarkup >= 1.2 ? 'Alcanzado' : `${((1.2 - currentMarkup) * 100).toFixed(0)}% para alcanzar`,
              clientSatisfactionRisk: hourDeviation > 20 ? 'high' : hourDeviation > 10 ? 'medium' : 'low',
              nextQuarterProjection: {
                label: projectionLabel,
                // Para proyectos fee-mensual, usar costo base del contrato para proyecciones futuras
                estimatedCost: quotation && quotation.projectType === 'fee-mensual' ? 
                  (quotation.baseCost * 3) : // baseCost ya es mensual
                  (monthlyAvg * 3),
                estimatedRevenue: quotation && quotation.projectType === 'fee-mensual' ? 
                  (quotation.totalAmount * 3) : // Para fee-mensual, usar el precio del contrato * 3 meses
                  (monthlyAvg * currentMarkup * 3),
                estimatedProfit: quotation && quotation.projectType === 'fee-mensual' ?
                  (quotation.totalAmount * 3) - (quotation.baseCost * 3) :
                  (monthlyAvg * currentMarkup * 3) - (monthlyAvg * 3)
              }
            }
          };
        }
      } else {
        // Para períodos actuales/futuros, usar proyecciones normales
        const velocity = await calculateProjectVelocity(projectId, filterStartDate, filterEndDate);
        predictions = {
          estimatedCompletionDate: velocity.estimatedCompletion?.toISOString() || null,
          projectedFinalCost: velocity.projectedCost,
          projectedFinalMarkup: velocity.projectedMarkup,
          confidenceLevel: velocity.confidence as 'high' | 'medium' | 'low',
          businessMetrics: {
            monthlyBurnRate: totalActualCost / (filterEndDate && filterStartDate ? 
              Math.max(1, Math.round((new Date(filterEndDate).getTime() - new Date(filterStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 1),
            projectedAnnualRevenue: quotation && quotation.projectType === 'fee-mensual' ? 
              (quotation.totalAmount * 8) : // Mayo a Diciembre = 8 meses
              (totalActualCost * currentMarkup * 12 / Math.max(1, Math.round((new Date(filterEndDate).getTime() - new Date(filterStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))),
            breakEvenPoint: currentMarkup >= 1.2 ? 'achieved' : `${((1.2 - currentMarkup) * 100).toFixed(0)}% para alcanzar`,
            clientSatisfactionRisk: hourDeviation > 20 ? 'high' : hourDeviation > 10 ? 'medium' : 'low'
          }
        };
      }

      res.json({
        projectId,
        projectName: project.name,
        recommendations,
        predictions,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // ==================== INDIRECT COSTS ROUTES ====================

  // Indirect Cost Categories
  app.get("/api/indirect-cost-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getIndirectCostCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching indirect cost categories:", error);
      res.status(500).json({ message: "Failed to fetch indirect cost categories" });
    }
  });

  app.get("/api/indirect-cost-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const category = await storage.getIndirectCostCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error fetching indirect cost category:", error);
      res.status(500).json({ message: "Failed to fetch indirect cost category" });
    }
  });

  app.post("/api/indirect-cost-categories", requireAuth, async (req, res) => {
    try {
      const categoryData = insertIndirectCostCategorySchema.parse(req.body);
      const category = await storage.createIndirectCostCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating indirect cost category:", error);
      res.status(500).json({ message: "Failed to create indirect cost category" });
    }
  });

  app.patch("/api/indirect-cost-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const categoryData = insertIndirectCostCategorySchema.partial().parse(req.body);
      const category = await storage.updateIndirectCostCategory(id, categoryData);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating indirect cost category:", error);
      res.status(500).json({ message: "Failed to update indirect cost category" });
    }
  });

  app.delete("/api/indirect-cost-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const success = await storage.deleteIndirectCostCategory(id);
      if (!success) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting indirect cost category:", error);
      res.status(500).json({ message: "Failed to delete indirect cost category" });
    }
  });

  // Indirect Costs
  app.get("/api/indirect-costs", requireAuth, async (req, res) => {
    try {
      const costs = await storage.getIndirectCosts();
      res.json(costs);
    } catch (error) {
      console.error("Error fetching indirect costs:", error);
      res.status(500).json({ message: "Failed to fetch indirect costs" });
    }
  });

  app.get("/api/indirect-costs/category/:categoryId", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const costs = await storage.getIndirectCostsByCategory(categoryId);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching indirect costs by category:", error);
      res.status(500).json({ message: "Failed to fetch indirect costs" });
    }
  });

  app.get("/api/indirect-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }

      const cost = await storage.getIndirectCost(id);
      if (!cost) {
        return res.status(404).json({ message: "Cost not found" });
      }

      res.json(cost);
    } catch (error) {
      console.error("Error fetching indirect cost:", error);
      res.status(500).json({ message: "Failed to fetch indirect cost" });
    }
  });

  app.post("/api/indirect-costs", requireAuth, async (req, res) => {
    try {
      const costData = insertIndirectCostSchema.parse({
        ...req.body,
        createdBy: req.user?.id || 1
      });
      const cost = await storage.createIndirectCost(costData);
      res.status(201).json(cost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating indirect cost:", error);
      res.status(500).json({ message: "Failed to create indirect cost" });
    }
  });

  app.patch("/api/indirect-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }

      const costData = insertIndirectCostSchema.partial().parse(req.body);
      const cost = await storage.updateIndirectCost(id, costData);
      
      if (!cost) {
        return res.status(404).json({ message: "Cost not found" });
      }

      res.json(cost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating indirect cost:", error);
      res.status(500).json({ message: "Failed to update indirect cost" });
    }
  });

  app.delete("/api/indirect-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }

      const success = await storage.deleteIndirectCost(id);
      if (!success) {
        return res.status(404).json({ message: "Cost not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting indirect cost:", error);
      res.status(500).json({ message: "Failed to delete indirect cost" });
    }
  });

  // Non-Billable Hours
  app.get("/api/non-billable-hours", requireAuth, async (req, res) => {
    try {
      const hours = await storage.getNonBillableHours();
      res.json(hours);
    } catch (error) {
      console.error("Error fetching non-billable hours:", error);
      res.status(500).json({ message: "Failed to fetch non-billable hours" });
    }
  });

  app.get("/api/non-billable-hours/personnel/:personnelId", requireAuth, async (req, res) => {
    try {
      const personnelId = parseInt(req.params.personnelId);
      if (isNaN(personnelId)) {
        return res.status(400).json({ message: "Invalid personnel ID" });
      }

      const hours = await storage.getNonBillableHoursByPersonnel(personnelId);
      res.json(hours);
    } catch (error) {
      console.error("Error fetching non-billable hours by personnel:", error);
      res.status(500).json({ message: "Failed to fetch non-billable hours" });
    }
  });

  app.post("/api/non-billable-hours", requireAuth, async (req, res) => {
    try {
      const hoursData = insertNonBillableHoursSchema.parse({
        ...req.body,
        createdBy: req.user?.id || 1
      });
      const hours = await storage.createNonBillableHours(hoursData);
      res.status(201).json(hours);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating non-billable hours:", error);
      res.status(500).json({ message: "Failed to create non-billable hours" });
    }
  });

  app.patch("/api/non-billable-hours/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid hours ID" });
      }

      const hoursData = insertNonBillableHoursSchema.partial().parse(req.body);
      const hours = await storage.updateNonBillableHours(id, hoursData);
      
      if (!hours) {
        return res.status(404).json({ message: "Hours entry not found" });
      }

      res.json(hours);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating non-billable hours:", error);
      res.status(500).json({ message: "Failed to update non-billable hours" });
    }
  });

  app.delete("/api/non-billable-hours/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid hours ID" });
      }

      const success = await storage.deleteNonBillableHours(id);
      if (!success) {
        return res.status(404).json({ message: "Hours entry not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting non-billable hours:", error);
      res.status(500).json({ message: "Failed to delete non-billable hours" });
    }
  });

  // =========== RUTAS PARA GOOGLE SHEETS INTEGRATION ===========
  
  // Importar el servicio después de todas las rutas
  const { googleSheetsService } = await import('./services/googleSheetsService');

  // Sincronizar datos desde Google Sheets
  app.post("/api/google-sheets/sync", async (req, res) => {
    try {
      console.log('🔄 Iniciando sincronización con Google Sheets...');
      
      const costosData = await googleSheetsServiceAlternative.getCostosDirectosIndirectos();
      
      console.log(`📊 Datos obtenidos: ${costosData.length} registros`);
      
      // Aquí puedes procesar los datos y guardarlos en tu base de datos
      // o simplemente devolverlos para verificar que la conexión funciona
      
      res.json({
        success: true,
        message: `Sincronización completada: ${costosData.length} registros obtenidos`,
        data: costosData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error en sincronización con Google Sheets:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al sincronizar con Google Sheets",
        error: error.message 
      });
    }
  });

  // Probar conexión con Google Sheets
  app.get("/api/google-sheets/test", async (req, res) => {
    try {
      console.log('🧪 Probando conexión con Google Sheets...');
      
      const isConnected = await googleSheetsServiceAlternative.testConnection();
      const spreadsheetInfo = await googleSheetsServiceAlternative.getSpreadsheetInfo();
      
      res.json({
        connected: isConnected,
        spreadsheet: spreadsheetInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error probando conexión:', error);
      res.status(500).json({ 
        connected: false,
        error: error.message 
      });
    }
  });

  // Obtener metadatos del spreadsheet
  app.get("/api/google-sheets/info", async (req, res) => {
    try {
      const info = await googleSheetsServiceAlternative.getSpreadsheetInfo();
      res.json(info);
    } catch (error) {
      console.error('❌ Error obteniendo info del spreadsheet:', error);
      res.status(500).json({ 
        message: "Error al obtener información del spreadsheet",
        error: error.message 
      });
    }
  });

  // Probar conexión alternativa con Google Sheets
  app.get("/api/google-sheets/test-alt", async (req, res) => {
    try {
      const connected = await googleSheetsServiceAlternative.testConnection();
      if (connected) {
        const info = await googleSheetsServiceAlternative.getSpreadsheetInfo();
        res.json({ 
          connected: true, 
          message: "Conexión exitosa con Google Sheets API (método alternativo)",
          spreadsheetInfo: info
        });
      } else {
        res.json({ connected: false, error: "Failed to connect" });
      }
    } catch (error) {
      console.error('❌ Error testing alternative Google Sheets connection:', error);
      res.status(500).json({ 
        connected: false, 
        error: error.message 
      });
    }
  });

  // Obtener datos de costos usando método alternativo
  app.get("/api/google-sheets/costos-alt", async (req, res) => {
    try {
      const costosData = await googleSheetsServiceAlternative.getCostosDirectosIndirectos();
      res.json({
        success: true,
        data: costosData,
        count: costosData.length
      });
    } catch (error) {
      console.error('❌ Error obteniendo datos de costos (alternativo):', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener datos de costos del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Debug de credenciales de Google
  app.get("/api/google-sheets/debug-credentials", async (req, res) => {
    try {
      const credentials = {
        hasProjectId: !!process.env.GOOGLE_PROJECT_ID,
        hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
        hasPrivateKeyId: !!process.env.GOOGLE_PRIVATE_KEY_ID,
        hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
        privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
        privateKeyStartsWith: process.env.GOOGLE_PRIVATE_KEY?.substring(0, 50) || '',
        projectId: process.env.GOOGLE_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL
      };

      res.json({
        success: true,
        credentials: credentials
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  // Probar conexión con Google Sheets usando método simple
  app.get("/api/google-sheets/test-simple", async (req, res) => {
    try {
      const connected = await googleSheetsSimpleService.testConnection();
      if (connected) {
        const info = await googleSheetsSimpleService.getSpreadsheetInfo();
        res.json({ 
          connected: true, 
          message: "Conexión exitosa con Google Sheets API (método simple)",
          spreadsheetInfo: info
        });
      } else {
        res.json({ connected: false, error: "Failed to connect" });
      }
    } catch (error) {
      console.error('❌ Error testing simple Google Sheets connection:', error);
      res.status(500).json({ 
        connected: false, 
        error: error.message 
      });
    }
  });

  // Obtener datos de costos usando el método simple
  app.get("/api/google-sheets/costos-simple", async (req, res) => {
    try {
      const costosData = await googleSheetsSimpleService.getCostosDirectosIndirectos();
      res.json({
        success: true,
        message: "Datos obtenidos exitosamente del Excel MAESTRO",
        data: costosData,
        count: costosData.length
      });
    } catch (error) {
      console.error('❌ Error obteniendo datos de costos (simple):', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener datos de costos del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Obtener lista de clientes desde Google Sheets (pestaña Activo, columna C)
  app.get("/api/google-sheets/clients", async (req, res) => {
    try {
      console.log('📋 Obteniendo lista de clientes desde Google Sheets...');
      const clientNames = await googleSheetsSimpleService.getClientesFromSheet();
      res.json({
        success: true,
        message: `Se encontraron ${clientNames.length} clientes únicos`,
        data: clientNames,
        count: clientNames.length
      });
    } catch (error) {
      console.error('❌ Error obteniendo clientes desde Google Sheets:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener lista de clientes del Google Sheet",
        error: error.message 
      });
    }
  });

  // Importar proyectos desde Google Sheets a la base de datos
  app.post("/api/google-sheets/import-projects", requireAuth, async (req, res) => {
    try {
      console.log('🔄 Importando proyectos desde Google Sheets...');
      
      // Obtener los datos de proyectos del Excel MAESTRO
      const projectsData = await googleSheetsWorkingService.getProyectosConfirmados();
      
      console.log(`📊 Procesando ${projectsData.length} registros de proyectos...`);
      
      // Importar proyectos usando el storage
      const importResult = await storage.importGoogleSheetsProjects(projectsData);
      
      console.log(`✅ Importación completada:`, importResult);
      
      res.json({
        success: true,
        message: `Importación completada: ${importResult.imported} nuevos proyectos agregados, ${importResult.updated} actualizados`,
        imported: importResult.imported,
        updated: importResult.updated,
        totalProcessed: projectsData.length,
        errors: importResult.errors
      });

    } catch (error) {
      console.error('❌ Error al importar proyectos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al importar proyectos desde Google Sheets',
        error: error.message
      });
    }
  });

  // Obtener proyectos importados desde Google Sheets
  app.get("/api/google-sheets/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getGoogleSheetsProjects();
      
      res.json({
        success: true,
        projects: projects,
        count: projects.length
      });

    } catch (error) {
      console.error('❌ Error al obtener proyectos de Google Sheets:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener proyectos',
        error: error.message
      });
    }
  });

  // Obtener registros de facturación de un proyecto específico
  app.get("/api/google-sheets/projects/:id/billing", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const billingRecords = await storage.getProjectBillingRecords(projectId);
      
      res.json({
        success: true,
        billingRecords: billingRecords,
        count: billingRecords.length
      });

    } catch (error) {
      console.error('❌ Error al obtener registros de facturación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener registros de facturación',
        error: error.message
      });
    }
  });

  // ==================== AUTO SYNC SERVICE ====================
  
  // Ejecutar sincronización manual
  app.post("/api/auto-sync/execute", async (req, res) => {
    try {
      console.log('🔄 Ejecutando sincronización manual...');
      
      const result = await autoSyncService.manualSync();
      
      res.json({
        success: result.success,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Error en sincronización manual:', error);
      res.status(500).json({
        success: false,
        message: 'Error ejecutando sincronización',
        error: error.message
      });
    }
  });

  // Obtener estado de sincronización
  app.get("/api/auto-sync/status", (req, res) => {
    try {
      const status = autoSyncService.getStatus();
      res.json({
        success: true,
        status: status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Iniciar sincronización automática
  app.post("/api/auto-sync/start", (req, res) => {
    try {
      autoSyncService.start();
      res.json({
        success: true,
        message: 'Sincronización automática iniciada',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Detener sincronización automática
  app.post("/api/auto-sync/stop", (req, res) => {
    try {
      autoSyncService.stop();
      res.json({
        success: true,
        message: 'Sincronización automática detenida',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== GOOGLE SHEETS SALES IMPORT ====================
  
  // Importar ventas desde Google Sheets "Ventas Tomi"
  app.post("/api/google-sheets/import-sales", requireAuth, async (req, res) => {
    try {
      console.log('🔄 Importando ventas desde Google Sheets...');
      
      // Obtener datos de ventas desde el Google Sheets
      const salesData = await googleSheetsWorkingService.getVentasTomi();
      
      console.log(`📊 Procesando ${salesData.length} registros de ventas...`);
      
      // Importar ventas usando el storage
      const importResult = await storage.importSalesFromGoogleSheets(salesData);
      
      console.log(`✅ Importación completada:`, importResult);
      
      res.json({
        success: true,
        message: `Importación completada: ${importResult.imported} nuevos registros agregados, ${importResult.updated} actualizados`,
        imported: importResult.imported,
        updated: importResult.updated,
        totalProcessed: salesData.length,
        errors: importResult.errors
      });

    } catch (error) {
      console.error('❌ Error al importar ventas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al importar ventas desde Google Sheets',
        error: error.message
      });
    }
  });

  // Obtener ventas importadas desde Google Sheets
  app.get("/api/google-sheets/sales", requireAuth, async (req, res) => {
    try {
      const sales = await storage.getGoogleSheetsSales();
      
      res.json({
        success: true,
        sales: sales,
        count: sales.length
      });

    } catch (error) {
      console.error('❌ Error al obtener ventas de Google Sheets:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener ventas',
        error: error.message
      });
    }
  });

  // Obtener ventas de un proyecto específico
  app.get("/api/google-sheets/sales/:projectId", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const sales = await storage.getGoogleSheetsSalesByProject(projectId);
      
      res.json({
        success: true,
        sales: sales,
        count: sales.length
      });

    } catch (error) {
      console.error('❌ Error al obtener ventas del proyecto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener ventas del proyecto',
        error: error.message
      });
    }
  });

  // Limpiar datos de ventas de Google Sheets
  app.delete("/api/google-sheets/sales", requireAuth, async (req, res) => {
    try {
      const cleared = await storage.clearGoogleSheetsSales();
      
      if (cleared) {
        res.json({
          success: true,
          message: 'Todos los datos de ventas han sido eliminados'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error al limpiar los datos'
        });
      }

    } catch (error) {
      console.error('❌ Error al limpiar ventas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al limpiar los datos de ventas',
        error: error.message
      });
    }
  });

  // Probar obtener datos de Ventas Tomi desde Google Sheets
  app.get("/api/google-sheets/test-sales", requireAuth, async (req, res) => {
    try {
      console.log('🧪 Probando lectura de Ventas Tomi desde Google Sheets...');
      
      const salesData = await googleSheetsWorkingService.getVentasTomi();
      
      res.json({
        success: true,
        message: `Se obtuvieron ${salesData.length} registros de ventas`,
        data: salesData.slice(0, 5), // Solo mostrar los primeros 5 para ver estructura
        totalCount: salesData.length
      });

    } catch (error) {
      console.error('❌ Error probando lectura de ventas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al probar lectura de ventas',
        error: error.message
      });
    }
  });

  // Migrar proyectos de Google Sheets a proyectos activos
  app.post("/api/google-sheets/migrate-to-active", requireAuth, async (req, res) => {
    try {
      console.log('🔄 Migrando proyectos de Google Sheets a proyectos activos...');
      
      // Obtener proyectos de Google Sheets
      const googleProjects = await storage.getGoogleSheetsProjects();
      
      if (googleProjects.length === 0) {
        return res.json({
          success: true,
          message: 'No hay proyectos de Google Sheets para migrar',
          migrated: 0
        });
      }
      
      // Obtener clientes existentes para hacer el mapeo
      const clients = await storage.getClients();
      const clientMap = new Map();
      clients.forEach(client => {
        clientMap.set(client.name.toLowerCase(), client.id);
      });
      
      let migrated = 0;
      let errors: string[] = [];
      
      for (const project of googleProjects) {
        try {
          const clientId = clientMap.get(project.clientName.toLowerCase());
          
          if (!clientId) {
            errors.push(`Cliente no encontrado: ${project.clientName}`);
            continue;
          }
          
          // Crear una cotización automática para este proyecto
          const quotationData = {
            clientId: clientId,
            projectName: project.projectName,
            projectDescription: `${project.projectType} - ${project.projectName}`,
            totalAmount: project.originalAmountUsd || 0,
            currency: 'USD',
            exchangeRate: 1,
            status: 'approved',
            createdBy: req.session.userId,
            validityDays: 30,
            notes: `Migrado desde Google Sheets - Tipo: ${project.projectType}`,
            analysisType: project.projectType === 'Fee' ? 'standard' : 'basic'
          };
          
          const quotation = await storage.createQuotation(quotationData);
          
          // Crear el proyecto activo
          const activeProjectData = {
            quotationId: quotation.id,
            clientId: clientId,
            status: 'active',
            startDate: new Date(),
            trackingFrequency: project.projectType === 'Fee' ? 'monthly' : 'weekly',
            notes: `Migrado desde Google Sheets - Precio original: $${project.originalAmountUsd} USD`,
            createdBy: req.session.userId,
            budget: project.originalAmountUsd || 0
          };
          
          const activeProject = await storage.createActiveProject(activeProjectData);
          
          console.log(`✅ Proyecto migrado: ${project.projectName} (${project.clientName})`);
          migrated++;
          
        } catch (error) {
          const errorMsg = `Error migrando proyecto ${project.projectName}: ${error.message}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }
      
      res.json({
        success: true,
        message: `Migración completada: ${migrated} proyectos migrados a proyectos activos`,
        migrated: migrated,
        totalProjects: googleProjects.length,
        errors: errors
      });
      
    } catch (error) {
      console.error('❌ Error al migrar proyectos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al migrar proyectos desde Google Sheets',
        error: error.message
      });
    }
  });

  // Importar clientes desde Google Sheets a la base de datos
  app.post("/api/google-sheets/import-clients", requireAuth, async (req, res) => {
    try {
      console.log('🔄 Importando clientes desde Google Sheets...');
      
      // Obtener lista de clientes desde el sheet
      const clientNames = await googleSheetsSimpleService.getClientesFromSheet();
      
      // Obtener clientes existentes en la base de datos
      const existingClients = await storage.getClients();
      const existingClientNames = new Set(existingClients.map(c => c.name.toLowerCase()));
      
      // Filtrar solo los clientes nuevos
      const newClientNames = clientNames.filter(name => 
        !existingClientNames.has(name.toLowerCase())
      );
      
      let imported = 0;
      let errors: string[] = [];
      
      // Crear clientes nuevos
      for (const clientName of newClientNames) {
        try {
          const newClient = {
            name: clientName,
            contactName: 'Sin especificar', // Valor por defecto
            contactEmail: `contact@${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            contactPhone: 'Sin especificar'
          };
          
          await storage.createClient(newClient);
          imported++;
          console.log(`✅ Cliente creado: ${clientName}`);
        } catch (error) {
          const errorMsg = `Error creando cliente ${clientName}: ${error.message}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }
      
      res.json({
        success: true,
        message: `Importación completada: ${imported} nuevos clientes agregados`,
        totalFound: clientNames.length,
        alreadyExists: clientNames.length - newClientNames.length,
        imported: imported,
        errors: errors
      });
      
    } catch (error) {
      console.error('❌ Error importando clientes:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al importar clientes desde Google Sheets",
        error: error.message 
      });
    }
  });

  // Verificar credenciales completas de Google
  app.get("/api/google-sheets/verify-credentials", async (req, res) => {
    try {
      const result = googleSheetsFixedService.verifyCredentials();
      res.json(result);
    } catch (error) {
      console.error('❌ Error verificando credenciales:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al verificar credenciales",
        error: error.message 
      });
    }
  });

  // Probar con archivo JSON directamente
  app.get("/api/google-sheets/test-json", async (req, res) => {
    try {
      const result = await googleSheetsFixedService.testWithJSONFile();
      res.json(result);
    } catch (error) {
      console.error('❌ Error probando con JSON:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al probar con archivo JSON",
        error: error.message 
      });
    }
  });

  // Obtener datos usando el servicio fixed (temporal con datos simulados)
  app.get("/api/google-sheets/costos-fixed", async (req, res) => {
    try {
      const costosData = await googleSheetsFixedService.getCostosDirectosIndirectos();
      res.json({
        success: true,
        message: "Datos obtenidos del servicio fixed",
        data: costosData,
        count: costosData.length,
        note: "Usando datos simulados mientras se resuelve la conexión con Google Sheets"
      });
    } catch (error) {
      console.error('❌ Error obteniendo datos de costos (fixed):', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener datos de costos",
        error: error.message 
      });
    }
  });

  // Probar conexión real con Google Sheets usando archivo JSON
  app.get("/api/google-sheets/test-working", async (req, res) => {
    try {
      const connected = await googleSheetsWorkingService.testConnection();
      if (connected) {
        const info = await googleSheetsWorkingService.getSpreadsheetInfo();
        res.json({ 
          connected: true, 
          message: "Conexión exitosa usando archivo JSON",
          spreadsheetInfo: info
        });
      } else {
        res.json({ connected: false, error: "Failed to connect using JSON file" });
      }
    } catch (error) {
      console.error('❌ Error testing working Google Sheets connection:', error);
      res.status(500).json({ 
        connected: false, 
        error: error.message 
      });
    }
  });

  // Obtener datos reales del Excel MAESTRO usando archivo JSON
  app.get("/api/google-sheets/costos-maestro", async (req, res) => {
    try {
      const costosData = await googleSheetsWorkingService.getCostosDirectosIndirectos();
      res.json({
        success: true,
        message: "Datos obtenidos del Excel MAESTRO",
        data: costosData,
        count: costosData.length,
        source: "Excel MAESTRO via Google Sheets API"
      });
    } catch (error) {
      console.error('❌ Error obteniendo datos del Excel MAESTRO:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener datos del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Obtener datos del Excel MAESTRO con límite de registros para pruebas rápidas
  app.get("/api/google-sheets/costos-maestro-summary", async (req, res) => {
    try {
      const costosData = await googleSheetsWorkingService.getCostosDirectosIndirectos();
      
      // Resumen ejecutivo con estadísticas clave
      const personalUnico = Array.from(new Set(costosData.map(c => c.persona)));
      const costoTotalGeneral = costosData.reduce((sum, c) => sum + c.costoTotal, 0);
      const costoDirectoTotal = costosData.reduce((sum, c) => sum + c.costoDirecto, 0);
      const costoIndirectoTotal = costosData.reduce((sum, c) => sum + c.costoIndirecto, 0);

      // Top 5 personas por costo
      const topPersonal = personalUnico.map(persona => {
        const registros = costosData.filter(c => c.persona === persona);
        const costoTotal = registros.reduce((sum, c) => sum + c.costoTotal, 0);
        return { persona, costoTotal, registros: registros.length };
      }).sort((a, b) => b.costoTotal - a.costoTotal).slice(0, 5);

      res.json({
        success: true,
        message: "Resumen ejecutivo del Excel MAESTRO",
        summary: {
          totalRegistros: costosData.length,
          personalTotal: personalUnico.length,
          costoTotalGeneral,
          costoDirectoTotal,
          costoIndirectoTotal,
          topPersonal
        },
        source: "Excel MAESTRO via Google Sheets API",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error obteniendo resumen del Excel MAESTRO:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener resumen del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Importar costos directos desde Excel MAESTRO
  app.post("/api/google-sheets/import-direct-costs", async (req, res) => {
    try {
      const result = await googleSheetsWorkingService.importDirectCosts(storage);
      res.json({
        success: result.success,
        message: result.success 
          ? `Importación completada: ${result.costsImported} costos importados, ${result.costsUpdated} actualizados`
          : "Error en la importación de costos directos",
        costsImported: result.costsImported,
        costsUpdated: result.costsUpdated,
        errors: result.errors
      });
    } catch (error) {
      console.error('❌ Error importando costos directos:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al importar costos directos del Excel MAESTRO",
        error: error.message,
        costsImported: 0,
        costsUpdated: 0,
        errors: [error.message]
      });
    }
  });

  // Obtener costos directos
  app.get("/api/direct-costs", requireAuth, async (req, res) => {
    try {
      const costs = await storage.getDirectCosts();
      res.json(costs);
    } catch (error) {
      console.error("Error fetching direct costs:", error);
      res.status(500).json({ message: "Failed to fetch direct costs" });
    }
  });

  // Obtener costos directos por proyecto
  app.get("/api/direct-costs/project/:projectId", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const costs = await storage.getDirectCostsByProject(projectId);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching project direct costs:", error);
      res.status(500).json({ message: "Failed to fetch project direct costs" });
    }
  });

  // Crear costo directo
  app.post("/api/direct-costs", requireAuth, async (req, res) => {
    try {
      const costData = insertDirectCostSchema.parse(req.body);
      const cost = await storage.createDirectCost(costData);
      res.status(201).json(cost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating direct cost:", error);
      res.status(500).json({ message: "Failed to create direct cost" });
    }
  });

  // Actualizar costo directo
  app.patch("/api/direct-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }

      const costData = insertDirectCostSchema.partial().parse(req.body);
      const cost = await storage.updateDirectCost(id, costData);
      
      if (!cost) {
        return res.status(404).json({ message: "Direct cost not found" });
      }

      res.json(cost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating direct cost:", error);
      res.status(500).json({ message: "Failed to update direct cost" });
    }
  });

  // Eliminar costo directo
  app.delete("/api/direct-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }

      const success = await storage.deleteDirectCost(id);
      
      if (!success) {
        return res.status(404).json({ message: "Direct cost not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting direct cost:", error);
      res.status(500).json({ message: "Failed to delete direct cost" });
    }
  });

  // Obtener proyectos confirmados y estimados del Excel MAESTRO
  app.get("/api/google-sheets/proyectos-confirmados", async (req, res) => {
    try {
      const proyectosData = await googleSheetsWorkingService.getProyectosConfirmados();
      res.json({
        success: true,
        message: "Proyectos confirmados obtenidos del Excel MAESTRO",
        data: proyectosData,
        count: proyectosData.length,
        confirmados: proyectosData.filter(p => p.confirmado).length,
        estimados: proyectosData.filter(p => !p.confirmado).length,
        source: "Excel MAESTRO - Proyectos confirmados y estimados"
      });
    } catch (error) {
      console.error('❌ Error obteniendo proyectos confirmados:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener proyectos confirmados del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Endpoint para listar todas las pestañas del Excel MAESTRO  
  app.get("/api/google-sheets/pestanas", async (req, res) => {
    try {
      const pestanas = await googleSheetsWorkingService.getSheetNames();
      res.json({
        success: true,
        message: "Pestañas del Excel MAESTRO obtenidas",
        data: pestanas,
        count: pestanas.length
      });
    } catch (error) {
      console.error('❌ Error obteniendo pestañas:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener pestañas del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Endpoint para obtener tipos de cambio del Excel MAESTRO
  app.get("/api/google-sheets/tipos-cambio", async (req, res) => {
    try {
      const tiposCambioData = await googleSheetsWorkingService.getTiposCambio();
      res.json({
        success: true,
        message: "Tipos de cambio obtenidos del Excel MAESTRO",
        data: tiposCambioData,
        count: tiposCambioData.length,
        source: "Excel MAESTRO - Tipos de cambio BCRA"
      });
    } catch (error) {
      console.error('❌ Error obteniendo tipos de cambio:', error);
      res.status(500).json({ 
        success: false,
        message: "Error al obtener tipos de cambio del Excel MAESTRO",
        error: error.message 
      });
    }
  });

  // Endpoint para cargar tipos de cambio históricos en la base de datos
  app.post("/api/bulk-load/exchange-rates", async (req, res) => {
    try {
      const { dryRun = true } = req.body;
      
      // Obtener tipos de cambio del Excel
      const tiposCambioData = await googleSheetsWorkingService.getTiposCambio();
      
      if (dryRun) {
        return res.json({
          success: true,
          message: "Análisis de tipos de cambio (modo prueba)",
          dryRun: true,
          resumen: {
            totalRegistros: tiposCambioData.length,
            periodoCompleto: tiposCambioData.length > 0 ? {
              desde: `${tiposCambioData[tiposCambioData.length - 1].mes} ${tiposCambioData[tiposCambioData.length - 1].año}`,
              hasta: `${tiposCambioData[0].mes} ${tiposCambioData[0].año}`
            } : null,
            muestra: tiposCambioData.slice(0, 5),
            rangoCambio: tiposCambioData.length > 0 ? {
              minimo: Math.min(...tiposCambioData.map(t => t.tipoCambio)),
              maximo: Math.max(...tiposCambioData.map(t => t.tipoCambio))
            } : null
          }
        });
      }

      // Conversión de datos para insertar en base de datos
      const exchangeRatesToInsert = tiposCambioData.map(tc => ({
        year: tc.año || 2024,
        month: convertirMesANumero(tc.mes),
        exchangeRate: tc.tipoCambio,
        rateType: "official",
        source: tc.fuente,
        updatedBy: null
      }));

      // Crear registros en lotes
      const createdRates = await storage.bulkCreateExchangeRates(exchangeRatesToInsert);

      res.json({
        success: true,
        message: "Tipos de cambio cargados exitosamente",
        dryRun: false,
        resultados: {
          tiposCambioCreados: createdRates.length,
          fuente: "Excel MAESTRO - BCRA",
          periodo: exchangeRatesToInsert.length > 0 ? {
            desde: `${exchangeRatesToInsert[exchangeRatesToInsert.length - 1].month}/${exchangeRatesToInsert[exchangeRatesToInsert.length - 1].year}`,
            hasta: `${exchangeRatesToInsert[0].month}/${exchangeRatesToInsert[0].year}`
          } : null
        }
      });

    } catch (error) {
      console.error('❌ Error en carga masiva de tipos de cambio:', error);
      res.status(500).json({
        success: false,
        message: "Error al cargar tipos de cambio",
        error: error.message
      });
    }
  });

  // Función auxiliar para convertir mes en texto a número
  function convertirMesANumero(mes: string): number {
    const meses = {
      'ene': 1, 'enero': 1,
      'feb': 2, 'febrero': 2,
      'mar': 3, 'marzo': 3,
      'abr': 4, 'abril': 4,
      'may': 5, 'mayo': 5,
      'jun': 6, 'junio': 6,
      'jul': 7, 'julio': 7,
      'ago': 8, 'agosto': 8,
      'sep': 9, 'septiembre': 9,
      'oct': 10, 'octubre': 10,
      'nov': 11, 'noviembre': 11,
      'dic': 12, 'diciembre': 12
    };
    
    const mesNormalizado = mes.toLowerCase().replace(/[^a-z]/g, '');
    return meses[mesNormalizado] || 1;
  }

  // Estos endpoints están duplicados más abajo, eliminando duplicados



  // ==================== FUNCIONES AUXILIARES PARA ESTIMACIONES ====================
  
  // Función para generar estimaciones estándar basadas en el tipo de proyecto
  function generarEstimacionesEstandar(detalle: string, tipoProyecto: string, valorUSD: number) {
    const detalleNormalizado = detalle.toLowerCase();
    const tipoNormalizado = tipoProyecto.toLowerCase();
    
    // Configuraciones por tipo de proyecto
    const configuraciones = {
      'fee_marketing': {
        horasPorMes: 40,
        tarifaPromedio: 50, // USD por hora
        distribucionRoles: {
          'Account Manager': { horas: 15, tarifa: 60 },
          'Community Manager': { horas: 20, tarifa: 40 },
          'Diseñador Gráfico': { horas: 5, tarifa: 45 }
        }
      },
      'social_listening': {
        horasPorMes: 25,
        tarifaPromedio: 65,
        distribucionRoles: {
          'Data Analyst': { horas: 15, tarifa: 70 },
          'Social Media Manager': { horas: 10, tarifa: 55 }
        }
      },
      'campana_digital': {
        horasPorMes: 60,
        tarifaPromedio: 55,
        distribucionRoles: {
          'Strategist': { horas: 20, tarifa: 75 },
          'Creative Director': { horas: 15, tarifa: 80 },
          'Media Planner': { horas: 15, tarifa: 65 },
          'Community Manager': { horas: 10, tarifa: 40 }
        }
      },
      'default': {
        horasPorMes: 30,
        tarifaPromedio: 50,
        distribucionRoles: {
          'Project Manager': { horas: 15, tarifa: 65 },
          'Specialist': { horas: 15, tarifa: 45 }
        }
      }
    };
    
    // Determinar configuración según el tipo de proyecto
    let config = configuraciones.default;
    
    if (tipoNormalizado.includes('fee') || detalleNormalizado.includes('marketing')) {
      config = configuraciones.fee_marketing;
    } else if (detalleNormalizado.includes('listening') || detalleNormalizado.includes('monitoreo')) {
      config = configuraciones.social_listening;
    } else if (detalleNormalizado.includes('campana') || detalleNormalizado.includes('campaign')) {
      config = configuraciones.campana_digital;
    }
    
    // Calcular estimaciones
    const totalHoras = config.horasPorMes;
    const costoHorasTotal = totalHoras * config.tarifaPromedio;
    const markup = valorUSD > costoHorasTotal ? (valorUSD / costoHorasTotal) : 1.5;
    const costoBase = valorUSD / markup;
    const margenGanancia = valorUSD - costoBase;
    
    return {
      totalHoras,
      tarifaPromedio: config.tarifaPromedio,
      costoBase,
      margenGanancia,
      markup,
      distribucionRoles: config.distribucionRoles
    };
  }

  // Endpoint para cargar masivamente cotizaciones aprobadas desde el Excel MAESTRO
  app.post("/api/bulk-load/quotations-from-excel", async (req, res) => {
    try {
      const { dryRun = true } = req.body; // Por defecto modo de prueba
      
      // Obtener proyectos confirmados del Excel
      const proyectosData = await googleSheetsWorkingService.getProyectosConfirmados();
      const proyectosConfirmados = proyectosData.filter(p => p.confirmado);
      
      console.log(`📊 Procesando ${proyectosConfirmados.length} proyectos confirmados para carga masiva`);
      
      if (dryRun) {
        // Modo de prueba: solo analizar sin crear
        const clientesUnicos = Array.from(new Set(proyectosConfirmados.map(p => p.cliente)));
        const valorTotalUSD = proyectosConfirmados.reduce((sum, p) => sum + p.monedaUSD, 0);
        
        const resumen = {
          totalProyectos: proyectosConfirmados.length,
          clientesUnicos: clientesUnicos.length, 
          listaClientes: clientesUnicos,
          valorTotalUSD: valorTotalUSD,
          periodoFacturacion: {
            desde: Math.min(...proyectosConfirmados.map(p => p.añoFacturacion)),
            hasta: Math.max(...proyectosConfirmados.map(p => p.añoFacturacion))
          },
          muestra: proyectosConfirmados.slice(0, 5)
        };
        
        return res.json({
          success: true,
          message: "Análisis de carga masiva (modo prueba)",
          dryRun: true,
          resumen: resumen
        });
      }
      
      // Modo real: crear cotizaciones
      const resultados = {
        clientesCreados: 0,
        cotizacionesCreadas: 0,
        errores: [],
        procesados: []
      };
      
      for (const proyecto of proyectosConfirmados) {
        try {
          // 1. Verificar si el cliente existe, si no, crearlo
          let cliente = await storage.getClientByName(proyecto.cliente);
          
          if (!cliente) {
            const nuevoCliente = await storage.createClient({
              name: proyecto.cliente,
              email: `contacto@${proyecto.cliente.toLowerCase().replace(/\s+/g, '')}.com`,
              phone: '',
              address: '',
              website: '',
              notes: `Cliente creado automáticamente desde Excel MAESTRO`
            });
            cliente = nuevoCliente;
            resultados.clientesCreados++;
            console.log(`✅ Cliente creado: ${proyecto.cliente}`);
          }
          
          // 2. Generar estimaciones estándar basadas en el tipo de proyecto
          const estimaciones = generarEstimacionesEstandar(proyecto.detalle, proyecto.proyecto, proyecto.monedaUSD);
          
          // 3. Crear la cotización basada en el proyecto del Excel
          const nuevaCotizacion = await storage.createQuotation({
            clientId: cliente.id,
            projectName: `${proyecto.detalle}`, // Campo requerido
            title: `${proyecto.detalle} - ${proyecto.mesFacturacion} ${proyecto.añoFacturacion}`,
            description: `Cotización creada automáticamente desde Excel MAESTRO para ${proyecto.cliente}`,
            currency: 'USD',
            totalAmount: proyecto.monedaUSD,
            validUntil: new Date(proyecto.añoFacturacion, 11, 31), // Fin del año
            status: 'approved', // Ya está confirmado en el Excel
            createdAt: new Date(),
            updatedAt: new Date(),
            markup: estimaciones.markup,
            templateId: null,
            notes: `Proyecto: ${proyecto.proyecto} | Condición de pago: ${proyecto.condicionPago} días | Estimación automática`,
            isTemplate: false,
            customMarkup: null,
            discountPercentage: 0,
            totalHours: estimaciones.totalHoras,
            hourlyRate: estimaciones.tarifaPromedio,
            baseCost: estimaciones.costoBase,
            complexityAdjustment: 0,
            markupAmount: estimaciones.margenGanancia
          });
          
          resultados.cotizacionesCreadas++;
          resultados.procesados.push({
            cliente: proyecto.cliente,
            cotizacionId: nuevaCotizacion.id,
            valor: proyecto.monedaUSD,
            titulo: nuevaCotizacion.title
          });
          
        } catch (error) {
          console.error(`❌ Error procesando proyecto ${proyecto.cliente}:`, error);
          resultados.errores.push({
            cliente: proyecto.cliente,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: "Carga masiva de cotizaciones completada",
        dryRun: false,
        resultados: resultados
      });
      
    } catch (error) {
      console.error('❌ Error en carga masiva:', error);
      res.status(500).json({ 
        success: false,
        message: "Error en la carga masiva de cotizaciones",
        error: error.message 
      });
    }
  });

  // ==================== RUTAS PARA TIPOS DE CAMBIO ====================

  // Obtener todos los tipos de cambio
  app.get("/api/exchange-rates", requireAuth, async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      let rates;
      if (year) {
        rates = await storage.getExchangeRatesByYear(year);
      } else {
        rates = await storage.getExchangeRates();
      }
      
      res.json(rates);
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      res.status(500).json({ message: "Failed to fetch exchange rates" });
    }
  });

  // Obtener tipo de cambio por mes específico
  app.get("/api/exchange-rates/:year/:month", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }
      
      const rate = await storage.getExchangeRateByMonth(year, month);
      
      if (!rate) {
        return res.status(404).json({ message: "Exchange rate not found for this period" });
      }
      
      res.json(rate);
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      res.status(500).json({ message: "Failed to fetch exchange rate" });
    }
  });

  // Crear nuevo tipo de cambio
  app.post("/api/exchange-rates", requireAuth, async (req, res) => {
    try {
      const validatedData = insertExchangeRateSchema.parse({
        ...req.body,
        createdBy: req.session.userId
      });
      
      // Verificar si ya existe un tipo de cambio para este período
      const existing = await storage.getExchangeRateByMonth(validatedData.year, validatedData.month);
      if (existing) {
        return res.status(409).json({ 
          message: "Exchange rate already exists for this period",
          existingRate: existing
        });
      }
      
      const rate = await storage.createExchangeRate(validatedData);
      res.status(201).json(rate);
    } catch (error) {
      console.error("Error creating exchange rate:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exchange rate data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create exchange rate" });
    }
  });

  // Actualizar tipo de cambio existente
  app.patch("/api/exchange-rates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid exchange rate ID" });
      }
      
      const validatedData = insertExchangeRateSchema.partial().parse({
        ...req.body,
        updatedBy: req.session.userId
      });
      
      const updatedRate = await storage.updateExchangeRate(id, validatedData);
      
      if (!updatedRate) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }
      
      res.json(updatedRate);
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exchange rate data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update exchange rate" });
    }
  });

  // Eliminar tipo de cambio
  app.delete("/api/exchange-rates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid exchange rate ID" });
      }
      
      const success = await storage.deleteExchangeRate(id);
      
      if (!success) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }
      
      res.json({ success: true, message: "Exchange rate deleted successfully" });
    } catch (error) {
      console.error("Error deleting exchange rate:", error);
      res.status(500).json({ message: "Failed to delete exchange rate" });
    }
  });

  // Obtener el tipo de cambio más reciente
  app.get("/api/exchange-rates/latest", requireAuth, async (req, res) => {
    try {
      const latestRate = await storage.getLatestExchangeRate();
      
      if (!latestRate) {
        return res.status(404).json({ message: "No exchange rates found" });
      }
      
      res.json(latestRate);
    } catch (error) {
      console.error("Error fetching latest exchange rate:", error);
      res.status(500).json({ message: "Failed to fetch latest exchange rate" });
    }
  });

  // ==================== PERSONNEL HISTORICAL COSTS ====================

  // Obtener todos los costos históricos de personal
  app.get("/api/personnel-historical-costs", requireAuth, async (req, res) => {
    try {
      const costs = await storage.getPersonnelHistoricalCosts();
      res.json(costs);
    } catch (error) {
      console.error("Error fetching personnel historical costs:", error);
      res.status(500).json({ message: "Failed to fetch personnel historical costs" });
    }
  });

  // Obtener costos históricos por persona
  app.get("/api/personnel-historical-costs/personnel/:personnelId", requireAuth, async (req, res) => {
    try {
      const personnelId = parseInt(req.params.personnelId);
      if (isNaN(personnelId)) {
        return res.status(400).json({ message: "Invalid personnel ID" });
      }

      const costs = await storage.getPersonnelHistoricalCostsByPersonnel(personnelId);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching personnel historical costs:", error);
      res.status(500).json({ message: "Failed to fetch personnel historical costs" });
    }
  });

  // Obtener costo histórico por período específico
  app.get("/api/personnel-historical-costs/personnel/:personnelId/:year/:month", requireAuth, async (req, res) => {
    try {
      const personnelId = parseInt(req.params.personnelId);
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (isNaN(personnelId) || isNaN(year) || isNaN(month)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const cost = await storage.getPersonnelHistoricalCostByPeriod(personnelId, year, month);
      
      if (!cost) {
        return res.status(404).json({ message: "No cost found for the specified period" });
      }

      res.json(cost);
    } catch (error) {
      console.error("Error fetching personnel historical cost:", error);
      res.status(500).json({ message: "Failed to fetch personnel historical cost" });
    }
  });

  // Obtener costo efectivo por período (con fallback)
  app.get("/api/personnel-historical-costs/effective/:personnelId/:year/:month", requireAuth, async (req, res) => {
    try {
      const personnelId = parseInt(req.params.personnelId);
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (isNaN(personnelId) || isNaN(year) || isNaN(month)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const effectiveCost = await storage.getEffectivePersonnelCostForPeriod(personnelId, year, month);
      
      if (effectiveCost === undefined) {
        return res.status(404).json({ message: "No cost found for personnel" });
      }

      res.json({ 
        personnelId, 
        year, 
        month, 
        effectiveHourlyRateARS: effectiveCost 
      });
    } catch (error) {
      console.error("Error fetching effective personnel cost:", error);
      res.status(500).json({ message: "Failed to fetch effective personnel cost" });
    }
  });

  // Crear nuevo costo histórico
  app.post("/api/personnel-historical-costs", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPersonnelHistoricalCostSchema.parse({
        ...req.body,
        createdBy: req.session.userId,
        effectiveDate: new Date(),
        isActive: true
      });

      const newCost = await storage.createPersonnelHistoricalCost(validatedData);
      res.status(201).json(newCost);
    } catch (error) {
      console.error("Error creating personnel historical cost:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cost data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create personnel historical cost" });
    }
  });

  // Actualizar costo histórico existente
  app.patch("/api/personnel-historical-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }
      
      const validatedData = insertPersonnelHistoricalCostSchema.partial().parse({
        ...req.body,
        updatedBy: req.session.userId
      });
      
      const updatedCost = await storage.updatePersonnelHistoricalCost(id, validatedData);
      
      if (!updatedCost) {
        return res.status(404).json({ message: "Personnel historical cost not found" });
      }
      
      res.json(updatedCost);
    } catch (error) {
      console.error("Error updating personnel historical cost:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cost data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update personnel historical cost" });
    }
  });

  // Eliminar costo histórico
  app.delete("/api/personnel-historical-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost ID" });
      }
      
      const success = await storage.deletePersonnelHistoricalCost(id);
      
      if (!success) {
        return res.status(404).json({ message: "Personnel historical cost not found" });
      }
      
      res.json({ success: true, message: "Personnel historical cost deleted successfully" });
    } catch (error) {
      console.error("Error deleting personnel historical cost:", error);
      res.status(500).json({ message: "Failed to delete personnel historical cost" });
    }
  });

  // ==================== RUTAS API FINANCIERAS ====================
  
  // Obtener ingresos mensuales de un proyecto
  app.get("/api/projects/:projectId/monthly-revenue", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      const revenues = await storage.getProjectMonthlyRevenue(projectId);
      res.json(revenues);
    } catch (error) {
      console.error("Error obteniendo ingresos mensuales del proyecto:", error);
      res.status(500).json({ message: "Error al obtener ingresos mensuales del proyecto" });
    }
  });
  
  // Crear ingreso mensual para un proyecto
  app.post("/api/projects/:projectId/monthly-revenue", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      const revenueData = { ...req.body, projectId, createdBy: req.user!.id };
      const revenue = await storage.createProjectMonthlyRevenue(revenueData);
      
      // Actualizar resumen financiero
      await storage.calculateAndUpdateFinancialSummary(projectId);
      
      res.status(201).json(revenue);
    } catch (error) {
      console.error("Error creando ingreso mensual:", error);
      res.status(500).json({ message: "Error al crear ingreso mensual" });
    }
  });
  
  // Actualizar ingreso mensual
  app.put("/api/monthly-revenue/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de ingreso inválido" });
      }
      
      const updated = await storage.updateProjectMonthlyRevenue(id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Ingreso mensual no encontrado" });
      }
      
      // Actualizar resumen financiero
      await storage.calculateAndUpdateFinancialSummary(updated.projectId);
      
      res.json(updated);
    } catch (error) {
      console.error("Error actualizando ingreso mensual:", error);
      res.status(500).json({ message: "Error al actualizar ingreso mensual" });
    }
  });
  
  // Generar ingresos automáticos para cualquier tipo de proyecto
  app.post("/api/projects/:projectId/generate-revenue", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      const { fromYear, fromMonth, toYear, toMonth } = req.body;
      
      if (!fromYear || !fromMonth || !toYear || !toMonth) {
        return res.status(400).json({ message: "Se requieren fechas de inicio y fin" });
      }
      
      console.log(`🤖 Manual revenue generation requested for project ${projectId}`);
      console.log(`📅 Period: ${fromMonth}/${fromYear} to ${toMonth}/${toYear}`);
      
      // Usar la nueva función que funciona con cualquier tipo de proyecto
      const revenues = await storage.generateMonthlyRevenueForAnyProject(
        projectId, fromYear, fromMonth, toYear, toMonth
      );
      
      res.json({
        message: `Se generaron ${revenues.length} registros de ingresos mensuales`,
        revenues
      });
    } catch (error: any) {
      console.error("Error generando ingresos automáticos:", error);
      res.status(500).json({ message: error?.message || "Error al generar ingresos automáticos" });
    }
  });

  // Ejecutar generación automática de ingresos para TODOS los proyectos activos
  app.post("/api/projects/generate-all-revenues", requireAuth, async (req, res) => {
    try {
      console.log("🚀 INICIANDO GENERACIÓN AUTOMÁTICA DE INGRESOS PARA TODOS LOS PROYECTOS");
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Obtener todos los proyectos activos
      const projects = await storage.getActiveProjects();
      console.log(`📊 Found ${projects.length} active projects`);
      
      let processedProjects = 0;
      let totalRevenuesCreated = 0;
      
      for (const project of projects) {
        try {
          // Procesar TODOS los proyectos activos que tengan cotización
          if (!project.quotation) {
            console.log(`⚠️ Skipping project ${project.id} - no quotation found`);
            continue;
          }
          
          console.log(`💰 Processing project: ${project.quotation.projectName} (ID: ${project.id}) - Type: ${project.quotation.projectType}`);
          
          // Determinar fecha de inicio del proyecto
          const projectStartDate = project.quotation.createdAt ? new Date(project.quotation.createdAt) : new Date(2024, 0, 1);
          const startYear = projectStartDate.getFullYear();
          const startMonth = projectStartDate.getMonth() + 1;
          
          // Generar ingresos usando la nueva función universal
          const revenues = await storage.generateMonthlyRevenueForAnyProject(
            project.id,
            startYear,
            startMonth,
            currentYear,
            currentMonth
          );
          
          processedProjects++;
          totalRevenuesCreated += revenues.length;
          
          console.log(`✅ Created ${revenues.length} revenue records for project ${project.id}`);
          
        } catch (projectError: any) {
          console.error(`❌ Error processing project ${project.id}:`, projectError);
        }
      }
      
      res.json({
        message: `Generación completada: ${processedProjects} proyectos procesados, ${totalRevenuesCreated} ingresos creados`,
        processedProjects,
        totalRevenuesCreated,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("❌ Error en generación automática masiva:", error);
      res.status(500).json({ 
        message: error?.message || "Error en la generación automática masiva",
        error: error?.message
      });
    }
  });
  
  // Obtener cambios de pricing de un proyecto
  app.get("/api/projects/:projectId/pricing-changes", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      const changes = await storage.getProjectPricingChanges(projectId);
      res.json(changes);
    } catch (error) {
      console.error("Error obteniendo cambios de pricing:", error);
      res.status(500).json({ message: "Error al obtener cambios de pricing" });
    }
  });
  
  // Crear cambio de pricing
  app.post("/api/projects/:projectId/pricing-changes", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      const changeData = { ...req.body, projectId, createdBy: req.user!.id };
      const change = await storage.createProjectPricingChange(changeData);
      
      res.status(201).json(change);
    } catch (error) {
      console.error("Error creando cambio de pricing:", error);
      res.status(500).json({ message: "Error al crear cambio de pricing" });
    }
  });
  
  // Obtener resumen financiero de un proyecto
  app.get("/api/projects/:projectId/financial-summary", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      let summary = await storage.getProjectFinancialSummary(projectId);
      
      // Si no existe, calcularlo
      if (!summary) {
        summary = await storage.calculateAndUpdateFinancialSummary(projectId);
      }
      
      res.json(summary);
    } catch (error) {
      console.error("Error obteniendo resumen financiero:", error);
      res.status(500).json({ message: "Error al obtener resumen financiero" });
    }
  });
  
  // Obtener reporte financiero completo
  app.get("/api/projects/:projectId/financial-report", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }
      
      const report = await storage.generateProjectFinancialReport(projectId);
      res.json(report);
    } catch (error) {
      console.error("Error generando reporte financiero:", error);
      res.status(500).json({ message: "Error al generar reporte financiero" });
    }
  });

  // Generar ingresos automáticamente desde datos del Excel
  app.post("/api/financial/auto-generate-from-excel", requireAuth, async (req, res) => {
    try {
      console.log("🤖 Iniciando generación automática desde Excel...");
      
      const result = await googleSheetsWorkingService.generateMonthlyRevenuesFromExcel(storage);
      
      res.json({
        success: result.success,
        message: result.success 
          ? `Generación automática desde Excel completada: ${result.revenuesCreated} ingresos creados`
          : 'Error en la generación automática desde Excel',
        revenuesCreated: result.revenuesCreated,
        errors: result.errors
      });
      
    } catch (error: any) {
      console.error("❌ Error en generación automática desde Excel:", error);
      res.status(500).json({ 
        message: "Error en la generación automática desde Excel", 
        error: error?.message || error 
      });
    }
  });

  // Generar ingresos automáticos para todos los proyectos fee mensual hasta el mes actual
  app.post("/api/financial/auto-generate-all-revenues", requireAuth, async (req, res) => {
    try {
      console.log("🤖 Starting automatic revenue generation for all fee monthly projects...");
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      console.log(`📅 Generating revenues up to: ${currentMonth}/${currentYear}`);
      
      const projects = await storage.getActiveProjects();
      console.log(`📊 Found ${projects.length} active projects`);
      
      let processedProjects = 0;
      let totalRevenuesCreated = 0;
      const results = [];
      
      for (const project of projects) {
        try {
          if (!project.quotation || project.quotation.projectType !== 'fee-mensual') {
            console.log(`⏭️ Skipping project ${project.id} - not fee mensual (type: ${project.quotation?.projectType})`);
            continue;
          }
          
          console.log(`💰 Processing fee mensual project: ${project.quotation.projectName} (ID: ${project.id})`);
          
          const projectStartDate = project.quotation.createdAt ? new Date(project.quotation.createdAt) : new Date(2024, 0, 1);
          const startYear = projectStartDate.getFullYear();
          const startMonth = projectStartDate.getMonth() + 1;
          
          console.log(`📅 Project start date: ${startMonth}/${startYear}`);
          
          const revenues = await storage.generateMonthlyRevenueForProject(
            project.id,
            startYear,
            startMonth,
            currentYear,
            currentMonth
          );
          
          processedProjects++;
          totalRevenuesCreated += revenues.length;
          
          results.push({
            projectId: project.id,
            projectName: project.quotation.projectName,
            revenuesCreated: revenues.length,
            startPeriod: `${startMonth}/${startYear}`,
            endPeriod: `${currentMonth}/${currentYear}`
          });
          
          console.log(`✅ Created ${revenues.length} revenue records for project ${project.id}`);
          
        } catch (projectError: any) {
          console.error(`❌ Error processing project ${project.id}:`, projectError);
          results.push({
            projectId: project.id,
            projectName: project.quotation?.projectName || 'Unknown',
            error: projectError.message || 'Unknown error'
          });
        }
      }
      
      console.log(`🎉 Auto-generation completed: ${processedProjects} projects processed, ${totalRevenuesCreated} total revenues created`);
      
      res.json({
        success: true,
        message: `Generación automática completada`,
        summary: {
          projectsProcessed: processedProjects,
          totalRevenuesCreated,
          currentPeriod: `${currentMonth}/${currentYear}`
        },
        results
      });
      
    } catch (error: any) {
      console.error("❌ Error in automatic revenue generation:", error);
      res.status(500).json({ 
        message: "Error en la generación automática de ingresos", 
        error: error?.message || error 
      });
    }
  });

  // ==================== NUEVAS RUTAS PARA ANÁLISIS OPERACIONAL Y FINANCIERO ====================
  
  // Project Monthly Sales Operations (para análisis operacional)
  app.get("/api/projects/:projectId/monthly-sales", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const sales = await storage.getProjectMonthlySales(projectId);
      res.json(sales);
    } catch (error) {
      console.error("Error fetching project monthly sales:", error);
      res.status(500).json({ message: "Failed to fetch project monthly sales" });
    }
  });

  app.post("/api/projects/:projectId/monthly-sales", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const validatedData = insertProjectMonthlySalesSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.session.userId
      });
      
      const sales = await storage.createProjectMonthlySales(validatedData);
      res.status(201).json(sales);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid sales data", errors: error.errors });
      }
      console.error("Error creating project monthly sales:", error);
      res.status(500).json({ message: "Failed to create project monthly sales" });
    }
  });

  app.patch("/api/projects/:projectId/monthly-sales/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid sales ID" });

    try {
      const validatedData = insertProjectMonthlySalesSchema.partial().parse(req.body);
      const updatedSales = await storage.updateProjectMonthlySales(id, validatedData);
      
      if (!updatedSales) {
        return res.status(404).json({ message: "Monthly sales record not found" });
      }
      
      res.json(updatedSales);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid sales data", errors: error.errors });
      }
      console.error("Error updating project monthly sales:", error);
      res.status(500).json({ message: "Failed to update project monthly sales" });
    }
  });

  app.delete("/api/projects/:projectId/monthly-sales/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid sales ID" });

    try {
      const success = await storage.deleteProjectMonthlySales(id);
      
      if (!success) {
        return res.status(404).json({ message: "Monthly sales record not found" });
      }
      
      res.json({ success: true, message: "Monthly sales record deleted successfully" });
    } catch (error) {
      console.error("Error deleting project monthly sales:", error);
      res.status(500).json({ message: "Failed to delete project monthly sales" });
    }
  });

  // Project Financial Transactions Operations (para análisis financiero)
  app.get("/api/projects/:projectId/financial-transactions", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const transactions = await storage.getProjectFinancialTransactions(projectId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching project financial transactions:", error);
      res.status(500).json({ message: "Failed to fetch project financial transactions" });
    }
  });

  app.post("/api/projects/:projectId/financial-transactions", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      const validatedData = insertProjectFinancialTransactionSchema.parse({
        ...req.body,
        projectId,
        createdBy: req.session.userId
      });
      
      const transaction = await storage.createProjectFinancialTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      console.error("Error creating project financial transaction:", error);
      res.status(500).json({ message: "Failed to create project financial transaction" });
    }
  });

  app.patch("/api/projects/:projectId/financial-transactions/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid transaction ID" });

    try {
      const validatedData = insertProjectFinancialTransactionSchema.partial().parse(req.body);
      const updatedTransaction = await storage.updateProjectFinancialTransaction(id, validatedData);
      
      if (!updatedTransaction) {
        return res.status(404).json({ message: "Financial transaction not found" });
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      console.error("Error updating project financial transaction:", error);
      res.status(500).json({ message: "Failed to update project financial transaction" });
    }
  });

  app.delete("/api/projects/:projectId/financial-transactions/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid transaction ID" });

    try {
      const success = await storage.deleteProjectFinancialTransaction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Financial transaction not found" });
      }
      
      res.json({ success: true, message: "Financial transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting project financial transaction:", error);
      res.status(500).json({ message: "Failed to delete project financial transaction" });
    }
  });

  // ==================== RESUMEN EJECUTIVO CONSOLIDADO ====================
  // Endpoint que integra datos del Excel MAESTRO para el dashboard ejecutivo
  app.get('/api/executive-summary', requireAuth, async (req, res) => {
    try {
      const timeFilter = req.query.timeFilter as string || 'august_2025';
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      
      console.log(`📊 EXECUTIVE SUMMARY - Filter: ${timeFilter}, Project: ${projectId}`);
      
      // Helper para parsear filtros temporales  
      const parseTimeFilter = (filter: string) => {
        const now = new Date();
        let monthKey: string;
        
        switch (filter) {
          case 'august_2025':
            monthKey = '2025-08';
            break;
          case 'may_2025':
            monthKey = '2025-05';
            break;
          case 'june_2025':
            monthKey = '2025-06';
            break;
          case 'july_2025':
            monthKey = '2025-07';
            break;
          default:
            monthKey = '2025-08'; // Default agosto 2025
        }
        return monthKey;
      };
      
      const monthKey = parseTimeFilter(timeFilter);
      console.log(`📊 Filtering by month_key: ${monthKey}`);
      
      // 1. INGRESOS desde google_sheets_sales
      const allSales = await storage.getGoogleSheetsSales();
      const salesForPeriod = allSales.filter(sale => 
        sale.monthKey === monthKey && 
        sale.confirmed === 'SI' &&
        (!projectId || sale.projectId === projectId)
      );
      
      const totalRevenue = salesForPeriod.reduce((sum, sale) => 
        sum + parseFloat(sale.amountUsd || '0'), 0
      );
      
      console.log(`📊 Revenue data: ${salesForPeriod.length} sales, $${totalRevenue} USD`);
      
      // 2. COSTOS desde direct_costs  
      const allDirectCosts = await storage.getDirectCosts();
      const costsForPeriod = allDirectCosts.filter(cost =>
        cost.monthKey === monthKey &&
        (!projectId || cost.projectId === projectId)
      );
      
      const totalCosts = costsForPeriod.reduce((sum, cost) => 
        sum + (cost.montoTotalUSD || 0), 0
      );
      
      const totalHoursReal = costsForPeriod.reduce((sum, cost) => 
        sum + (cost.horasRealesAsana || 0), 0
      );
      
      const totalHoursBillable = costsForPeriod.reduce((sum, cost) => 
        sum + (cost.horasParaFacturacion || 0), 0
      );
      
      console.log(`💰 Cost data: ${costsForPeriod.length} costs, $${totalCosts} USD, ${totalHoursReal}h real`);
      
      // 3. CÁLCULOS KPI según el review
      const markup = totalCosts > 0 ? totalRevenue / totalCosts : 0;
      const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
      const budgetUsed = totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : 0;
      const efficiency = totalHoursReal > 0 && totalHoursBillable > 0 ? 
        (totalHoursBillable / totalHoursReal) * 100 : 0;
      
      // 4. ANÁLISIS POR EQUIPO (top performers)
      const teamAnalysis = costsForPeriod.reduce((acc, cost) => {
        const persona = cost.persona;
        if (!acc[persona]) {
          acc[persona] = {
            persona,
            totalHours: 0,
            totalCost: 0,
            avgRate: 0
          };
        }
        
        acc[persona].totalHours += cost.horasRealesAsana || 0;
        acc[persona].totalCost += cost.montoTotalUSD || 0;
        
        return acc;
      }, {} as Record<string, any>);
      
      const topPerformers = Object.values(teamAnalysis)
        .sort((a: any, b: any) => b.totalHours - a.totalHours)
        .slice(0, 5)
        .map((member: any) => ({
          ...member,
          avgRate: member.totalHours > 0 ? member.totalCost / member.totalHours : 0
        }));
      
      // 5. VALIDACIONES según review
      const validations = {
        revenueDataSource: 'Excel MAESTRO - Ventas Tomi',
        costDataSource: 'Excel MAESTRO - Costos Directos',
        dataConsistency: totalRevenue > 0 && totalCosts > 0,
        parseValidation: totalCosts > 10 ? 'OK' : 'POSIBLE ERROR DE PARSING',
        markupValidation: markup > 0.5 ? 'OK' : 'MARKUP BAJO'
      };
      
      const result = {
        period: monthKey,
        timeFilter,
        projectId,
        
        // KPIs principales  
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCosts: Math.round(totalCosts * 100) / 100,
        markup: Math.round(markup * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        budgetUsed: Math.round(budgetUsed * 10) / 10,
        
        // Métricas de equipo
        totalHoursReal,
        totalHoursBillable,
        efficiency: Math.round(efficiency * 10) / 10,
        
        // Team insights
        topPerformers,
        teamSize: Object.keys(teamAnalysis).length,
        
        // Data sources y validaciones
        dataSources: {
          salesCount: salesForPeriod.length,
          costsCount: costsForPeriod.length,
          monthKey
        },
        validations,
        
        generatedAt: new Date().toISOString()
      };
      
      console.log(`📊 EXECUTIVE SUMMARY RESULT:`, JSON.stringify(result, null, 2));
      
      res.json(result);
    } catch (error) {
      console.error("❌ Error in executive summary:", error);
      res.status(500).json({ message: "Executive summary failed", error: error.message });
    }
  });

  // ==================== ENDPOINT TEMPORAL DE DIAGNÓSTICO ====================
  
  // Endpoint de diagnóstico para verificar costos directos específicos
  app.get('/api/debug/direct-costs/:projectId', requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const timeFilter = req.query.timeFilter as string || 'june_2025';
      
      console.log(`🔥 DEBUG ENDPOINT - Project: ${projectId}, Filter: ${timeFilter}`);
      
      // Obtener datos directos de la base de datos
      const allDirectCosts = await storage.getDirectCostsByProject(projectId);
      
      // Aplicar filtro manual para junio 2025
      const filteredCosts = allDirectCosts.filter(cost => {
        if (cost.mes === '06 jun' && cost.año === 2025) {
          return true;
        }
        return false;
      });
      
      const result = {
        projectId,
        timeFilter,
        totalDirectCosts: allDirectCosts.length,
        filteredDirectCosts: filteredCosts.length,
        rawDatabaseData: allDirectCosts.slice(0, 10), // Primeros 10 registros
        filteredData: filteredCosts,
        databaseQuery: `SELECT * FROM direct_costs WHERE project_id = ${projectId}`,
        generatedAt: new Date().toISOString()
      };
      
      console.log(`🔥 DEBUG RESULT:`, JSON.stringify(result, null, 2));
      
      res.json(result);
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ message: "Debug endpoint failed", error: error.message });
    }
  });

  return httpServer;
}