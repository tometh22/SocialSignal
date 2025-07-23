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
  forgotPasswordSchema,
  resetPasswordSchema,
  exchangeRateHistory,
  projectStatusOptions,
  trackingFrequencyOptions,
  deliverables,
  clientModoComments,
  activeProjects,
  quotations,
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
  systemConfig
} from "@shared/schema";
import { eq, and, isNull, desc, sql, asc, gte, lte, inArray } from "drizzle-orm";
import { reinitializeDatabase } from "./reinit-data";
import { setupAuth } from "./auth";
// Temporalmente deshabilitado: import { setupChat } from "./chat";

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
      let quotationTeam = [];
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
      const getAdjustedHoursForDateRange = (personnelId: number, originalHours: number, startDate: Date, endDate: Date) => {
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
          const monthlyHours = getAdjustedHours(personnelId, originalHours, monthData.year, monthData.month);
          totalAdjustedHours += monthlyHours;
        }
        
        console.log(`📊 Calculated adjusted hours for personnel ${personnelId} over ${months.length} months: ${totalAdjustedHours}h (${months.map(m => `${m.year}/${m.month}`).join(', ')})`);
        return totalAdjustedHours;
      };

      // 3. Función para aplicar filtros temporales
      const getDateRangeForFilter = (filter: string) => {
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
      
      // Aplicar filtro temporal si está especificado
      const dateRange = getDateRangeForFilter(timeFilter);
      if (dateRange) {
        timeEntries = timeEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
        });
        console.log(`📊 Filtered time entries for project ${id}:`, timeEntries.length, 'entries (from', dateRange.startDate.toISOString(), 'to', dateRange.endDate.toISOString(), ')');
      }

      const totalWorkedHours = timeEntries.reduce((total, entry) => total + (entry.hours || 0), 0);
      const totalWorkedCost = timeEntries.reduce((total, entry) => total + (entry.totalCost || 0), 0);
      
      // Generate team breakdown from filtered time entries
      const teamBreakdown: { [personnelId: string]: any } = {};
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
                console.log(`📊 Applied May 2025 adjustment for ${entry.personnel?.name}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else if (timeFilter.includes('june_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(entry.personnelId, estimatedHours, 2025, 6);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied June 2025 adjustment for ${entry.personnel?.name}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else if (timeFilter.includes('july_2025')) {
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHours(entry.personnelId, estimatedHours, 2025, 7);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied July 2025 adjustment for ${entry.personnel?.name}: ${originalHours}h → ${estimatedHours}h`);
              }
            } else {
              // Para rangos de múltiples meses (trimestres, semestres, etc.)
              const originalHours = estimatedHours;
              estimatedHours = getAdjustedHoursForDateRange(entry.personnelId, estimatedHours, dateRange.startDate, dateRange.endDate);
              if (originalHours !== estimatedHours) {
                console.log(`📊 Applied range adjustment for ${entry.personnel?.name}: ${originalHours}h → ${estimatedHours}h`);
              }
            }
          }
          
          // Usar el rol REAL del personal desde su perfil, no el rol de la cotización
          let actualRole = entry.role?.name || 'Sin Rol';
          let actualRate = quotationMember?.rate || entry.personnel?.hourlyRate || 0;
          
          if (!isQuoted) {
            // Buscar datos de personal no cotizado para este proyecto
            const unquotedData = await storage.getUnquotedPersonnelByProject(parseInt(id));
            const unquotedEntry = unquotedData.find(up => up.personnelId === entry.personnelId);
            
            if (unquotedEntry) {
              // Para personal no cotizado, usar también el rol real de su perfil
              actualRole = entry.role?.name || unquotedEntry.role?.name || 'Sin Rol';
              actualRate = unquotedEntry.estimatedRate || entry.personnel?.hourlyRate || 0;
              console.log(`📊 Found unquoted personnel data:`, {
                personnelId: entry.personnelId,
                name: entry.personnel?.name,
                role: actualRole,
                rate: actualRate
              });
            }
          }
          
          teamBreakdown[personnelId] = {
            personnelId: entry.personnelId,
            name: entry.personnel?.name || 'Unknown',
            roleName: actualRole,
            hourlyRate: actualRate,
            hours: 0,
            cost: 0,
            entries: 0,
            lastActivity: null,
            estimatedHours: estimatedHours,
            rate: actualRate,
            isQuoted: isQuoted, // NUEVO: Marca si el personal estaba en cotización original
            isUnquoted: !isQuoted // NUEVO: Marca si el personal NO estaba cotizado originalmente
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
      
      // 4.5. Agregar miembros del equipo de cotización que no tienen time entries en este período
      for (const quotationMember of quotationTeam) {
        const personnelId = quotationMember.personnelId.toString();
        if (!teamBreakdown[personnelId]) {
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
            isUnquoted: false
          };
        }
      }

      console.log(`📊 Time entries for project ${id}:`, timeEntries.length, 'entries');
      console.log(`📊 Total worked hours:`, totalWorkedHours);
      console.log(`📊 Total worked cost:`, totalWorkedCost);
      console.log(`📊 Team breakdown created for ${Object.keys(teamBreakdown).length} members (including quotation team)`);

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

      // 5. Ajustar horas estimadas según tipo de proyecto y filtro temporal
      let adjustedEstimatedHours = estimatedHours;
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
        
        // Usar el menor entre meses teóricos y meses con datos reales
        const monthsToUse = Math.min(actualMonthsWithData, theoreticalMonths) || theoreticalMonths;
        
        if (monthsToUse > 0) {
          // Las cotizaciones de contratos mensuales son por mes, multiplicamos por el período
          adjustedEstimatedHours = estimatedHours * monthsToUse;
          adjustedBaseCost = baseCost * monthsToUse;
          adjustedTotalAmount = totalAmount * monthsToUse;
          
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
      const markup = totalWorkedCost > 0 ? adjustedTotalAmount / totalWorkedCost : 0;
      const budgetUtilization = adjustedBaseCost > 0 ? (totalWorkedCost / adjustedBaseCost) * 100 : 0;

      // 7. CALCULAR RANKINGS ECONÓMICOS USANDO LOS DATOS REALES
      const { calculateTeamRankings } = await import('../shared/ranking-utils');
      
      // Preparar datos del equipo para rankings - SOLO MIEMBROS CON TIME ENTRIES
      const teamRankingData = Object.values(teamBreakdown)
        .filter(member => (member.hours || 0) > 0) // Solo incluir miembros con horas trabajadas
        .map(member => {
          // NO ESCALAR las horas estimadas individuales - mantener valores base de cotización
          const baseEstimatedHours = member.estimatedHours || 0;
          const baseEstimatedCost = baseEstimatedHours * (member.rate || 0);
          
          return {
            personnelId: member.personnelId,
            name: member.name || `Miembro ${member.personnelId}`,
            personnelName: member.name || `Miembro ${member.personnelId}`,
            estimatedHours: baseEstimatedHours, // HORAS BASE SIN ESCALAMIENTO
            actualHours: member.hours || 0, // Los datos reales están en 'hours', no 'actualHours'
            estimatedCost: baseEstimatedCost, // COSTO BASE SIN ESCALAMIENTO
            actualCost: member.cost || 0 // Los datos reales están en 'cost', no 'actualCost'
          };
        });

      // Debug: Ver datos que van al cálculo de rankings
      console.log(`📊 Team ranking data prepared:`, teamRankingData.slice(0, 2)); // Solo mostrar primeros 2 para debug
      console.log(`📊 Filtered team for rankings: ${teamRankingData.length} members with actual hours`);
      
      // Calcular rankings con datos reales del proyecto - solo si hay miembros con horas
      const economicRankings = teamRankingData.length > 0 ? calculateTeamRankings(teamRankingData, adjustedTotalAmount) : [];

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
        }
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
        isAlwaysOn: project.quotation?.projectType === 'always-on'
      };

      console.log(`📊 Complete data prepared for project ${id}:`, {
        estimatedHours: adjustedEstimatedHours,
        workedHours: totalWorkedHours,
        efficiency: completeData.metrics.efficiency,
        timeFilter: timeFilter,
        isAlwaysOn: project.quotation?.projectType === 'always-on'
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

  // Personnel routes
  app.get("/api/personnel", requireAuth, async (_, res) => {
    try {
      const personnel = await db.select({
        id: sql`personnel.id`,
        name: sql`personnel.name`,
        roleId: sql`personnel.role_id`,
        hourlyRate: sql`personnel.hourly_rate`,
        roleName: sql`roles.name`
      })
      .from(sql`personnel`)
      .leftJoin(sql`roles`, sql`personnel.role_id = roles.id`)
      .orderBy(sql`personnel.name`);

      res.json(personnel);
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

      const validatedData = insertPersonnelSchema.partial().parse(data);
      const updatedPerson = await storage.updatePersonnel(id, validatedData);

      if (!updatedPerson) {
        return res.status(404).json({ message: "Personnel not found" });
      }

      res.json(updatedPerson);
    } catch (error) {
      console.error("Error al actualizar personal:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid personnel data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update personnel" });
    }
  });

  app.delete("/api/personnel/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid personnel ID" });

    try {
      const success = await storage.deletePersonnel(id);

      if (!success) {
        return res.status(400).json({ 
          message: "Cannot delete this personnel. They may have active time entries or project assignments." 
        });
      }

      res.json({ success: true, message: "Personnel deleted successfully" });
    } catch (error) {
      console.error("Error deleting personnel:", error);
      res.status(500).json({ message: "Failed to delete personnel" });
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

      const updatedQuotation = await storage.updateQuotation(id, { status });

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
  app.delete("/api/quotations/:id", async (req, res) => {
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
      await storage.deleteQuotationTeamMembers(id);
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

  app.post("/api/quotation-team", async (req, res) => {
    try {
      console.log('📥 Creating team member with data:', JSON.stringify(req.body, null, 2));

      // Si no hay personnelId, necesitamos asignar uno automáticamente
      let personnelId = req.body.personnelId;

      if (!personnelId && req.body.roleId) {
        console.log('🔍 No personnel assigned, looking for available personnel for role:', req.body.roleId);
        
        // Buscar personal disponible para este rol
        const availablePersonnel = await storage.getPersonnelByRole(req.body.roleId);
        
        if (availablePersonnel.length > 0) {
          // Usar el primer personal disponible
          personnelId = availablePersonnel[0].id;
          console.log('✅ Assigned personnel automatically:', availablePersonnel[0].name, 'ID:', personnelId);
        } else {
          // Si no hay personal para el rol, crear uno genérico
          console.log('⚠️ No personnel found for role, creating generic personnel...');
          
          const role = await storage.getRole(req.body.roleId);
          const genericPersonnel = await storage.createPersonnel({
            name: `${role?.name || 'Generic'} Member`,
            roleId: req.body.roleId,
            hourlyRate: req.body.rate || role?.defaultRate || 50
          });
          
          personnelId = genericPersonnel.id;
          console.log('✅ Created generic personnel:', genericPersonnel.name, 'ID:', personnelId);
        }
      }

      // Preparar datos asegurando que cost esté presente y personnelId sea válido
      const teamMemberData = {
        ...req.body,
        personnelId: personnelId,
        cost: req.body.cost || (req.body.hours * req.body.rate) || 0
      };

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

    await storage.deleteQuotationTeamMembers(quotationId);
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

    await storage.deleteQuotationTeamMembers(quotationId);
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
      // Obtener parámetro de consulta para filtrar subproyectos
      const showSubprojects = req.query.showSubprojects === 'true';

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

      // Depuración para ver qué está pasando con las cotizaciones
      projects.forEach(project => {
        if (project.quotation) {
        }
      });

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
      const validatedData = insertActiveProjectSchema.partial().parse(req.body);
      const updatedProject = await storage.updateActiveProject(id, validatedData);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
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
      const entries = await db.select({
        projectId: sql`time_entries.project_id`,
        hours: sql`time_entries.hours`
      })
      .from(sql`time_entries`);

      // Agrupar por proyecto
      const groupedByProject: Record<number, any[]> = {};
      entries.forEach(entry => {
        const projectId = entry.projectId as number;
        if (!groupedByProject[projectId]) {
          groupedByProject[projectId] = [];
        }
        groupedByProject[projectId].push(entry);
      });

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

  // Punto 3: Recomendaciones automáticas
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

      // Predicciones
      const velocityData = await calculateProjectVelocity(projectId);
      
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
  });

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
  async function calculateProjectVelocity(projectId: number) {
    const projectEntries = await db.select()
      .from(timeEntries)
      .where(eq(timeEntries.projectId, projectId))
      .orderBy(asc(timeEntries.date));

    if (projectEntries.length < 2) {
      return {
        estimatedCompletion: null,
        projectedCost: 0,
        projectedMarkup: 0,
        confidence: 'low'
      };
    }

    // Calcular velocidad promedio (horas por día)
    const first = new Date(projectEntries[0].date);
    const last = new Date(projectEntries[projectEntries.length - 1].date);
    const daysDiff = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
    const totalHours = projectEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const velocity = daysDiff > 0 ? totalHours / daysDiff : 0;

    const project = await storage.getActiveProject(projectId);
    const quotation = project ? await storage.getQuotation(project.quotationId) : null;
    const targetHours = quotation ? await calculateEstimatedHours(quotation.id) : 0;
    
    const remainingHours = Math.max(0, targetHours - totalHours);
    const daysToComplete = velocity > 0 ? remainingHours / velocity : null;
    
    const estimatedCompletion = daysToComplete ? 
      new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000) : null;

    return {
      estimatedCompletion,
      projectedCost: quotation?.baseCost || 0,
      projectedMarkup: quotation ? (quotation.totalAmount / (quotation.baseCost || 1)) : 0,
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

        const hoursVariance = actualHours - member.hours;
        const costVariance = actualCost - member.cost;

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
          variance: {
            hours: hoursVariance,
            cost: costVariance,
            hoursPercentage: member.hours > 0 ? (hoursVariance / member.hours) * 100 : 0,
            costPercentage: member.cost > 0 ? (costVariance / member.cost) * 100 : 0
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
      const { startDate, endDate } = req.query;
      
      console.log(`🔍🔍🔍 RECOMMENDATIONS CALLED - ProjectId: ${projectId}, StartDate: ${startDate}, EndDate: ${endDate}`);
      
      const project = await storage.getActiveProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const quotation = await storage.getQuotation(project.quotationId);
      const teamMembers = await storage.getQuotationTeamMembers(project.quotationId);
      
      // Construir condiciones de filtro
      const whereConditions = [eq(timeEntries.projectId, projectId)];
      
      if (startDate && endDate) {
        whereConditions.push(
          gte(timeEntries.date, startDate as string),
          lte(timeEntries.date, endDate as string)
        );
      }

      const projectEntries = await db.select()
        .from(timeEntries)
        .where(and(...whereConditions));

      console.log(`🔍 Recommendations - Found ${projectEntries.length} time entries after filtering`);

      // Si no hay registros de tiempo filtrados, devolver estructura vacía
      if (projectEntries.length === 0) {
        console.log(`🔍 Recommendations - No time entries found for the filtered period, returning empty data`);
        return res.json({
          recommendations: [],
          predictions: {
            projectedFinalCost: 0,
            projectedCompletionDate: null,
            confidenceLevel: 'low'
          },
          generatedAt: new Date().toISOString()
        });
      }

      const totalActualCost = projectEntries.reduce((sum, entry) => 
        sum + (entry.hours * (entry.hourlyRateAtTime || 100)), 0);
      const totalEstimatedCost = teamMembers.reduce((sum, member) => sum + member.cost, 0);
      const totalActualHours = projectEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const totalEstimatedHours = teamMembers.reduce((sum, member) => sum + member.hours, 0);

      const recommendations = [];

      // Recomendación de control de costos
      if (totalActualCost > totalEstimatedCost * 1.2) {
        recommendations.push({
          type: 'cost_control',
          priority: 'high',
          title: 'Control de Costos Urgente',
          description: 'El proyecto excede el presupuesto estimado en más del 20%',
          actions: [
            'Revisar asignaciones de recursos',
            'Optimizar procesos actuales',
            'Considerar renegociar alcance con el cliente'
          ],
          impact: 'financial'
        });
      }

      // Recomendación de eficiencia
      if (totalActualHours > totalEstimatedHours * 1.1) {
        recommendations.push({
          type: 'efficiency',
          priority: 'medium',
          title: 'Mejora de Eficiencia',
          description: 'Se están utilizando más horas de las estimadas',
          actions: [
            'Implementar metodologías ágiles',
            'Automatizar tareas repetitivas',
            'Proporcionar capacitación adicional al equipo'
          ],
          impact: 'productivity'
        });
      }

      // Recomendación de rentabilidad
      const markup = quotation ? (quotation.totalAmount / totalActualCost) : 0;
      if (markup < 1.5) {
        recommendations.push({
          type: 'profitability',
          priority: 'high',
          title: 'Mejora de Rentabilidad',
          description: 'El markup actual está por debajo del objetivo mínimo',
          actions: [
            'Reducir costos operativos',
            'Optimizar tiempos de entrega',
            'Evaluar ajustes en precios futuros'
          ],
          impact: 'profitability'
        });
      }

      // Predicciones
      const velocity = await calculateProjectVelocity(projectId);
      const predictions = {
        estimatedCompletionDate: velocity.estimatedCompletion?.toISOString() || null,
        projectedFinalCost: velocity.projectedCost,
        projectedFinalMarkup: velocity.projectedMarkup,
        confidenceLevel: velocity.confidence as 'high' | 'medium' | 'low'
      };

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

  return httpServer;
}