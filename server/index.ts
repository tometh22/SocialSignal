import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

const app = express();

// ENDPOINTS ANTES DE CUALQUIER MIDDLEWARE
app.get("/api/projects/:id/deviation-analysis", async (req, res) => {
  console.log(`🎯 DEVIATION ANALYSIS - ID: ${req.params.id}, Query:`, req.query);
  
  try {
    const projectId = parseInt(req.params.id);
    const { startDate, endDate, timeFilter } = req.query as { startDate?: string; endDate?: string; timeFilter?: string };
    
    // Get project data
    const project = await storage.getActiveProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Get quotation for budget data
    const quotations = await storage.getQuotations();
    const quotation = quotations.find(q => q.id === project.quotationId);
    if (!quotation) {
      console.log(`⚠️ No quotation found for project ${projectId}`);
      return res.json({
        deviationByRole: [],
        totalVariance: { variance: 0 },
        summary: { membersOverBudget: 0, membersUnderBudget: 0 },
        majorDeviations: [],
        analysis: []
      });
    }

    // Get team members, time entries, and personnel data
    const teamMembers = await storage.getQuotationTeamMembers(quotation.id);
    const allTimeEntries = await storage.getTimeEntries();
    const personnel = await storage.getPersonnel();
    
    // Filter time entries by project and date range
    let filteredTimeEntries = allTimeEntries.filter(entry => entry.projectId === projectId);
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredTimeEntries = filteredTimeEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
      });
    }
    
    // Use the exact same temporal scaling logic from complete-data endpoint
    const { getDateRangeForFilter, getMonthsInFilter } = await import('./routes');
    
    let adjustedBaseCost = quotation.baseCost || 0;
    let dateRange: { startDate: Date; endDate: Date } | null = null;
    
    // If we have a timeFilter, use the complete-data logic
    if (timeFilter) {
      dateRange = getDateRangeForFilter(timeFilter);
      if (dateRange) {
        filteredTimeEntries = filteredTimeEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return dateRange && entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
        });
      }
    } else if (startDate && endDate) {
      // Fallback to direct date filtering
      const start = new Date(startDate);
      const end = new Date(endDate);
      dateRange = { startDate: start, endDate: end };
    }
    
    // Apply temporal scaling based on ACTUAL months with data
    if ((quotation.projectType === 'always-on' || quotation.projectType === 'fee-mensual') && dateRange && timeFilter !== 'all') {
      // First, check which months actually have data
      const monthsWithData = new Set<string>();
      
      filteredTimeEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`;
        monthsWithData.add(monthKey);
      });
      
      const actualMonthsWithData = monthsWithData.size;
      
      // Use actual months with data instead of theoretical months
      if (actualMonthsWithData > 0) {
        adjustedBaseCost = (quotation.baseCost || 0) * actualMonthsWithData;
        
        console.log(`📊 Applied temporal scaling based on ACTUAL data months:`, {
          timeFilter: timeFilter || 'date-range',
          originalBaseCost: quotation.baseCost,
          adjustedBaseCost: adjustedBaseCost,
          actualMonthsWithData: actualMonthsWithData,
          monthsDetected: Array.from(monthsWithData).sort()
        });
      } else {
        // If no data, use theoretical months
        const theoreticalMonths = timeFilter ? getMonthsInFilter(timeFilter) : 
          Math.max(1, (dateRange.endDate.getFullYear() - dateRange.startDate.getFullYear()) * 12 + 
                     (dateRange.endDate.getMonth() - dateRange.startDate.getMonth()) + 1);
        
        adjustedBaseCost = (quotation.baseCost || 0) * theoreticalMonths;
        
        console.log(`📊 No data found, using theoretical months:`, {
          timeFilter: timeFilter || 'date-range',
          theoreticalMonths: theoreticalMonths
        });
      }
    }

    console.log(`📊 Project: ${project.quotation.projectName}, Team: ${teamMembers.length}, Time entries: ${filteredTimeEntries.length}`);
    if (filteredTimeEntries.length > 0) {
      console.log(`📊 Sample time entry:`, filteredTimeEntries[0]);
    }
    if (personnel.length > 0) {
      console.log(`📊 Sample personnel:`, personnel[0]);
    }

    // 🔥 INTEGRACIÓN EXCEL MAESTRO: Si no hay time entries, buscar datos del Excel MAESTRO
    if (filteredTimeEntries.length === 0) {
      console.log(`⚠️ No time entries found, checking Excel MAESTRO data for project ${projectId}`);
      
      try {
        // 🔥 REPLICAR EXACTAMENTE LA LÓGICA DEL ENDPOINT COMPLETE-DATA QUE FUNCIONA
        console.log(`🔍 Calling complete-data endpoint internally for project ${projectId}`);
        
        // 🔥 USAR DIRECTAMENTE LOS DATOS DEL EXCEL MAESTRO SIN COMPLEJIDAD EXTRA
        const directCosts = await storage.getDirectCostsByProject(projectId);
        
        if (directCosts && directCosts.length > 0) {
          // Filtrar por rango temporal usando la misma lógica que complete-data
          let filteredDirectCosts = directCosts;
          if (dateRange) {
            filteredDirectCosts = directCosts.filter(cost => {
              let monthNumber;
              if (cost.mes.includes(' ')) {
                monthNumber = parseInt(cost.mes.substring(0, 2));
              } else {
                // Función simple para convertir nombres de meses
                const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                monthNumber = monthNames.indexOf(cost.mes.toLowerCase()) + 1;
                if (monthNumber === 0) monthNumber = 1; // fallback
              }
              const costDate = new Date(`${cost.año}-${monthNumber}-15`);
              return costDate >= dateRange.startDate && costDate <= dateRange.endDate;
            });
          }
          
          console.log(`📊 Direct costs found: ${filteredDirectCosts.length} for project ${projectId}`);
          
          if (filteredDirectCosts.length > 0) {
            // Crear teamBreakdown desde directCosts
            const teamBreakdown: Record<string, any> = {};
            
            filteredDirectCosts.forEach(cost => {
              const key = `excel-${cost.persona.toLowerCase().replace(' ', '_')}`;
              
              // 🔍 DETERMINAR TIPO DE COSTO: Personal vs Subcosto
              // Verificar si es freelancer/subcosto por nombre o datos específicos
              const freelancerNames = ['aylu tamer', 'gast guntren', 'male quiroga']; // Lista conocida de freelancers
              const isKnownFreelancer = freelancerNames.includes(cost.persona.toLowerCase());
              
              const isSubcost = cost.tipoGasto && (
                cost.tipoGasto.toLowerCase().includes('subcosto') ||
                cost.tipoGasto.toLowerCase().includes('indirecto') ||
                cost.especificacion?.toLowerCase().includes('subcosto') ||
                cost.especificacion?.toLowerCase().includes('freelance') ||
                cost.especificacion?.toLowerCase().includes('subcontrato')
              ) || isKnownFreelancer;
              
              console.log(`🔍 Checking cost type for ${cost.persona}: tipo_gasto="${cost.tipoGasto}", isKnownFreelancer=${isKnownFreelancer}, isSubcost=${isSubcost}`);
              
              if (!teamBreakdown[key]) {
                teamBreakdown[key] = {
                  name: cost.persona,
                  targetHours: cost.horasObjetivo || 0,
                  actualHours: cost.horasRealesAsana || 0,
                  actualCost: cost.montoTotalUSD || 0,
                  estimatedHours: 0,
                  estimatedCost: 0,
                  personnelId: cost.personnelId || null,
                  role: isSubcost ? 'Subcosto/Freelance' : 'Excel MAESTRO',
                  isSubcost: isSubcost,
                  costType: cost.tipoGasto || 'Directo'
                };
              } else {
                // Acumular datos si hay múltiples entradas
                teamBreakdown[key].targetHours += cost.horasObjetivo || 0;
                teamBreakdown[key].actualHours += cost.horasRealesAsana || 0;
                teamBreakdown[key].actualCost += cost.montoTotalUSD || 0;
                // Mantener el tipo más específico
                if (isSubcost) {
                  teamBreakdown[key].role = 'Subcosto/Freelance';
                  teamBreakdown[key].isSubcost = true;
                }
              }
            });
            
            console.log(`📊 Excel MAESTRO found ${Object.keys(teamBreakdown).length} team members`);
            
              // Convertir datos del Excel MAESTRO a formato de análisis de desviaciones
              const deviationByRole = Object.values(teamBreakdown).map((member: any) => {
              const budgetedHours = member.targetHours || member.estimatedHours || 0;
              const actualHours = member.actualHours || 0;
              const budgetedCost = member.estimatedCost || 0;
              const actualCost = member.actualCost || 0;
              
              const hoursDeviation = budgetedHours > 0 ? ((actualHours - budgetedHours) / budgetedHours) * 100 : 0;
              const costDeviation = budgetedCost > 0 ? ((actualCost - budgetedCost) / budgetedCost) * 100 : 0;
              
              // 🏢 CRITERIOS CORPORATIVOS DE DESVIACIÓN: Análisis empresarial sofisticado
              let severity = 'low';
              let deviationType = 'normal';
              let alertType = 'none';
              
              const absoluteDeviation = Math.abs(hoursDeviation);
              
              if (hoursDeviation > 15) {
                // 🚨 SOBRECOSTO CRÍTICO: Exceso presupuestario
                deviationType = 'sobrecosto';
                alertType = 'budget_overrun';
                severity = hoursDeviation > 50 ? 'critical' : 
                          hoursDeviation > 30 ? 'high' : 'medium';
                          
              } else if (hoursDeviation > 0 && hoursDeviation <= 15) {
                // ⚠️ SOBRECOSTO CONTROLADO: Dentro de tolerancia corporativa
                deviationType = 'sobrecosto_tolerado';
                alertType = 'within_tolerance';
                severity = 'low';
                
              } else if (hoursDeviation < -70) {
                // 🔍 SUBUTILIZACIÓN CRÍTICA: Posible problema de estimación o productividad
                deviationType = 'subutilizacion_critica';
                alertType = 'estimation_issue';
                severity = 'critical'; // Requiere investigación
                
              } else if (hoursDeviation < -40) {
                // 📊 EFICIENCIA ALTA: Ahorro significativo pero requiere análisis
                deviationType = 'eficiencia_alta';
                alertType = 'efficiency_review';
                severity = 'good'; // Positivo pero revisar procesos
                
              } else if (hoursDeviation < -15) {
                // ✅ SUBCOSTO SALUDABLE: Ahorro dentro de parámetros normales
                deviationType = 'subcosto_saludable';
                alertType = 'healthy_savings';
                severity = 'excellent';
                
              } else {
                // 🎯 EJECUCIÓN ÓPTIMA: Dentro del rango objetivo ±15%
                deviationType = 'ejecucion_optima';
                alertType = 'on_target';
                severity = 'optimal';
              }
              
              return {
                personnelId: member.personnelId || null,
                personnelName: member.name,
                role: member.role || 'Excel MAESTRO',
                budgetedHours,
                actualHours,
                budgetedCost,
                actualCost,
                hoursDeviation,
                costDeviation,
                deviationPercentage: hoursDeviation,
                severity,
                deviationType,
                alertType,
                corporateAnalysis: {
                  budgetImpact: hoursDeviation > 0 ? 'negative' : 'positive',
                  requiresReview: ['critical', 'estimation_issue', 'efficiency_review'].includes(alertType),
                  performanceLevel: severity === 'optimal' ? 'target' : 
                                   severity === 'excellent' ? 'above_target' : 
                                   severity === 'good' ? 'efficient' : 
                                   severity === 'critical' ? 'needs_attention' : 'acceptable'
                },
                isSubcost: member.isSubcost || false,
                costType: member.costType || 'Directo'
              };
            }).filter((member: any) => member.actualHours > 0 || member.actualCost > 0);
            
            // 📊 MÉTRICAS CORPORATIVAS
            const membersOverBudget = deviationByRole.filter((m: any) => 
              m.deviationType === 'sobrecosto' || m.alertType === 'budget_overrun').length;
            const membersUnderBudget = deviationByRole.filter((m: any) => 
              ['subcosto_saludable', 'eficiencia_alta'].includes(m.deviationType)).length;
            const membersRequiringReview = deviationByRole.filter((m: any) => 
              m.corporateAnalysis?.requiresReview).length;
            
            console.log(`📊 Excel MAESTRO analysis: ${deviationByRole.length} members, ${membersOverBudget} over budget, ${membersRequiringReview} requiring review`);
            
            return res.json({
              deviationByRole,
              totalVariance: { variance: deviationByRole.reduce((sum: number, m: any) => sum + Math.abs(m.deviationPercentage), 0) },
              summary: { membersOverBudget, membersUnderBudget },
              majorDeviations: deviationByRole.filter((m: any) => Math.abs(m.deviationPercentage) > 25),
              analysis: deviationByRole,
              debug: {
                projectId,
                startDate,
                endDate,
                message: 'Data from Excel MAESTRO integration via complete-data',
                source: 'Excel MAESTRO',
                timeEntriesTotal: 0,
                excelMembersTotal: deviationByRole.length
              }
            });
          }
        }
      } catch (error) {
        console.error('❌ Error fetching Excel MAESTRO data for deviation analysis:', error);
      }
      
      // Fallback si no hay datos en ninguna fuente
      return res.json({
        deviationByRole: [],
        totalVariance: { variance: 0 },
        summary: { membersOverBudget: 0, membersUnderBudget: 0 },
        majorDeviations: [],
        analysis: [],
        debug: {
          projectId,
          startDate,
          endDate,
          message: 'No time entries or Excel MAESTRO data found for this period',
          timeEntriesTotal: allTimeEntries.filter(e => e.projectId === projectId).length
        }
      });
    }

    // Calculate deviations
    const deviationByRole = [];
    const majorDeviations = [];
    let membersOverBudget = 0;
    let membersUnderBudget = 0;
    
    // Calculate total costs first for proper variance calculation
    let totalActualCost = 0;
    let totalBudgetedCost = 0;

    // Create personnel map for hourly rates
    const personnelMap = new Map(personnel.map(p => [p.id, p]));
    
    // Primero, encontrar todo el personal que registró tiempo (cotizado o no)
    const allPersonnelWithTime = new Set<number>();
    filteredTimeEntries.forEach(entry => {
      allPersonnelWithTime.add(entry.personnelId);
    });
    
    // Agregar personal no cotizado al análisis
    const teamMembersMap = new Map(teamMembers.map(m => [m.personnelId, m]));
    
    // Procesar todo el personal con tiempo registrado
    for (const personnelId of Array.from(allPersonnelWithTime)) {
      const member = teamMembersMap.get(personnelId);
      const isQuoted = member !== undefined;
      const memberTimeEntries = filteredTimeEntries.filter(entry => entry.personnelId === personnelId);
      const actualHours = memberTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Calculate actual cost: ALWAYS use entry.totalCost (which is the source of truth)
      // This ensures consistency with the complete-data endpoint
      let actualCost = 0;
      for (const entry of memberTimeEntries) {
        // totalCost is pre-calculated in the time entry and includes the correct hourly rate
        actualCost += entry.totalCost || 0;
      }
      
      // Get personnel name
      const personnelInfo = personnelMap.get(personnelId);
      const personnelName = personnelInfo?.name || `Personal ${personnelId}`;
      
      // Debug logging para verificar cálculos
      if (memberTimeEntries.length > 0) {
        console.log(`👤 ${personnelName}: ${memberTimeEntries.length} entries, total cost: $${actualCost.toFixed(2)}, quoted: ${isQuoted}`);
      }
      
      // Para personal no cotizado, usar 0 como presupuesto
      const budgetedHours = isQuoted ? (member.hours || 0) : 0;
      const budgetedCost = isQuoted ? (member.cost || 0) : 0;
      
      // Add to totals for overall variance calculation
      totalActualCost += actualCost;
      totalBudgetedCost += budgetedCost;
      
      const hourDeviation = actualHours - budgetedHours;
      const costDeviation = actualCost - budgetedCost;
      const deviationPercentage = budgetedCost > 0 ? (costDeviation / budgetedCost) * 100 : 0;
      
      if (deviationPercentage > 5) {
        membersOverBudget++;
      } else if (deviationPercentage < -5) {
        membersUnderBudget++;
      }

      const deviation = {
        personnelId: personnelId,
        personnelName,
        budgetedHours,
        actualHours,
        budgetedCost,
        actualCost,
        hourDeviation,
        costDeviation,
        deviationPercentage,
        isQuoted
      };

      deviationByRole.push(deviation);

      // Track major deviations with intelligent logic
      // Only consider someone "critical" if they worked significant hours AND exceed budget significantly
      // People with very low hours are "underperforming", not "critical cost overruns"
      if (Math.abs(deviationPercentage) > 25 || Math.abs(costDeviation) > 500) {
        let severity = 'high';
        
        // Clasificación más clara y descriptiva:
        const minHoursThreshold = budgetedHours * 0.3;
        const absDeviation = Math.abs(deviationPercentage);
        
        if (absDeviation > 50 && actualHours > minHoursThreshold) {
          // Sobrecosto crítico: trabajó mucho Y excedió presupuesto significativamente
          severity = 'critical';
        } else if (absDeviation > 50 && actualHours <= minHoursThreshold) {
          // Subrendimiento: gran desviación pero por trabajar muy poco
          severity = 'underperforming';
        } else if (absDeviation >= 25) {
          // Alto riesgo: desviación considerable
          severity = 'high';
        }
        
        console.log(`🔍 ${deviation.personnelName}: ${Math.abs(deviationPercentage).toFixed(1)}% dev, ${actualHours}h actual, ${budgetedHours}h budget, threshold: ${minHoursThreshold.toFixed(1)}h → ${severity}`);
        
        majorDeviations.push({
          ...deviation,
          severity
        });
      }
    } // Cierre del bucle for
    
    // Calculate total variance using the same logic as complete-data endpoint
    // Use adjustedBaseCost (with temporal scaling) instead of sum of individual member costs
    const totalVariance = totalActualCost - adjustedBaseCost;
    
    // Debug: Log calculation details
    console.log(`💰 VARIANCE CALCULATION DEBUG:`);
    console.log(`   Total Actual Cost: $${totalActualCost.toFixed(2)}`);
    console.log(`   Adjusted Base Cost (with temporal scaling): $${adjustedBaseCost.toFixed(2)}`);
    console.log(`   Sum of Individual Member Costs: $${totalBudgetedCost.toFixed(2)}`);
    console.log(`   Variance (Actual - Adjusted Base): $${totalVariance.toFixed(2)}`);
    console.log(`   Expected: ${totalActualCost > adjustedBaseCost ? 'SOBRECOSTO (positive)' : 'AHORRO (negative)'}`);
    console.log(`   Is positive (sobrecosto)? ${totalVariance > 0}`);
    
    // Debug: Compare with complete-data endpoint
    const completeDataTotalCost = filteredTimeEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
    console.log(`💰 COMPLETE-DATA COMPARISON:`);
    console.log(`   Deviation-Analysis Total: $${totalActualCost.toFixed(2)}`);
    console.log(`   Complete-Data Total: $${completeDataTotalCost.toFixed(2)}`);
    console.log(`   Difference: $${(completeDataTotalCost - totalActualCost).toFixed(2)}`);
    
    // If there's a mismatch, add temporal scaling debug
    if (quotation.projectType === 'fee-mensual' || quotation.projectType === 'always-on') {
      console.log(`💰 TEMPORAL SCALING DEBUG:`);
      console.log(`   Project Type: ${quotation.projectType}`);
      console.log(`   Original Base Cost: $${quotation.baseCost}`);
      console.log(`   Adjusted Base Cost: $${adjustedBaseCost}`);
      console.log(`   Difference explains variance calculation change`);
    }

    // Generate analysis in Spanish
    const analysis = [];
    if (totalVariance > 1000) {
      analysis.push({
        type: 'budget_overrun',
        message: `El proyecto tiene un sobrecosto de $${totalVariance.toFixed(2)} USD respecto al presupuesto`,
        severity: 'high'
      });
    }
    
    if (membersOverBudget > teamMembers.length * 0.3) {
      analysis.push({
        type: 'team_efficiency',
        message: `${membersOverBudget} miembros del equipo superan significativamente el presupuesto asignado`,
        severity: 'medium'
      });
    }

    // Add more analysis insights
    if (majorDeviations.length > 0) {
      const criticalCount = majorDeviations.filter(d => d.severity === 'critical').length;
      if (criticalCount > 0) {
        analysis.push({
          type: 'critical_deviations',
          message: `Se detectaron ${criticalCount} desviaciones críticas que requieren atención inmediata`,
          severity: 'high'
        });
      }
    }

    if (membersUnderBudget > membersOverBudget) {
      analysis.push({
        type: 'efficiency_opportunity',
        message: `${membersUnderBudget} miembros están por debajo del presupuesto, lo que indica buena eficiencia`,
        severity: 'low'
      });
    }

    const response = {
      deviationByRole,
      totalVariance: { variance: totalVariance },
      summary: { membersOverBudget, membersUnderBudget },
      majorDeviations,
      analysis
    };
    
    const criticalDeviations = majorDeviations.filter(d => d.severity === 'critical');
    console.log(`🎯 Returning analysis: ${deviationByRole.length} members, variance: ${totalVariance.toFixed(2)}`);
    console.log(`🚨 Critical deviations: ${criticalDeviations.length}, Major deviations: ${majorDeviations.length}`);
    
    res.json(response);
  } catch (error) {
    console.error("❌ Error in deviation analysis:", error);
    res.status(500).json({ message: "Failed to analyze project deviations" });
  }
});

// Request logging middleware for debugging (reduced noise)
app.use((req, res, next) => {
  // Only log API requests and errors, not static files
  if (req.path.startsWith('/api') || req.method !== 'GET') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    // Solo acceder a session después de que esté inicializada
    if (req.path.startsWith('/api') && req.session) {
      console.log('Session ID:', req.session.userId || 'undefined');
    }
  }
  next();
});

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Parsing de cookies para persistent sessions

// CORS configuration - Permitir todos los orígenes para debugging en Replit
app.use(cors({
  origin: true, // Permitir cualquier origen durante debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
}));

// Configuración de la sesión
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tu-clave-secreta-muy-segura',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Cambiar a true en producción con HTTPS
      httpOnly: false,
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      sameSite: false
    },
    name: 'sessionId',
    rolling: true // Renovar la sesión en cada request
  })
);

// ENDPOINT DE PRUEBA CON PATH DIFERENTE - PARA EVITAR CONFLICTO CON VITE
app.get("/api/test-project/:id/diagnosis", (req, res) => {
  console.log(`🟢🟢🟢 DIAGNOSTIC ENDPOINT HIT - ID: ${req.params.id}`);
  res.json({ 
    test: 'working with different path', 
    id: req.params.id, 
    query: req.query,
    timestamp: new Date().toISOString()
  });
});



// Ruta pública para contador de proyectos (sin autenticación)
app.get("/api/active-projects/count", async (req, res) => {
  try {
    const projects = await storage.getActiveProjects();
    const count = projects.filter(p => !p.parentProjectId).length;
    res.json({ count });
  } catch (error) {
    console.error("Error getting projects count:", error);
    res.json({ count: 0 });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inicializar la base de datos con datos de muestra
  await initializeDatabase();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Inicializar sincronización automática con Excel MAESTRO
    try {
      const { autoSyncService } = await import('./services/autoSyncService');
      autoSyncService.start();
      log('🔄 Sincronización automática con Excel MAESTRO iniciada');
    } catch (error) {
      console.error('❌ Error iniciando sincronización automática:', error);
    }
  });
})();