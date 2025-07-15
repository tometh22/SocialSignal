import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import cors from 'cors';
import session from 'express-session';

const app = express();

// ENDPOINTS ANTES DE CUALQUIER MIDDLEWARE
app.get("/api/projects/:id/deviation-analysis", async (req, res) => {
  console.log(`🎯 DEVIATION ANALYSIS - ID: ${req.params.id}, Query:`, req.query);
  
  try {
    const projectId = parseInt(req.params.id);
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
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

    console.log(`📊 Project: ${project.quotation.projectName}, Team: ${teamMembers.length}, Time entries: ${filteredTimeEntries.length}`);
    if (filteredTimeEntries.length > 0) {
      console.log(`📊 Sample time entry:`, filteredTimeEntries[0]);
    }
    if (personnel.length > 0) {
      console.log(`📊 Sample personnel:`, personnel[0]);
    }

    if (filteredTimeEntries.length === 0) {
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
          message: 'No time entries found for this period',
          timeEntriesTotal: allTimeEntries.filter(e => e.projectId === projectId).length
        }
      });
    }

    // Calculate deviations
    const deviationByRole = [];
    const majorDeviations = [];
    let totalVariance = 0;
    let membersOverBudget = 0;
    let membersUnderBudget = 0;

    // Create personnel map for hourly rates
    const personnelMap = new Map(personnel.map(p => [p.id, p]));

    for (const member of teamMembers) {
      const memberTimeEntries = filteredTimeEntries.filter(entry => entry.personnelId === member.personnelId);
      const actualHours = memberTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Calculate actual cost: use entry.totalCost if available, otherwise calculate from personnel hourly rate
      let actualCost = 0;
      for (const entry of memberTimeEntries) {
        if (entry.totalCost && entry.totalCost > 0) {
          actualCost += entry.totalCost;
        } else {
          // Use historical hourly rate if available, otherwise current personnel hourly rate
          const hourlyRate = entry.hourlyRateAtTime || personnelMap.get(entry.personnelId)?.hourlyRate || 0;
          actualCost += entry.hours * hourlyRate;
        }
      }
      
      const budgetedHours = member.hours || 0;
      const budgetedCost = member.cost || 0;
      
      const hourDeviation = actualHours - budgetedHours;
      const costDeviation = actualCost - budgetedCost;
      const deviationPercentage = budgetedCost > 0 ? (costDeviation / budgetedCost) * 100 : 0;
      
      // Only add valid cost deviations to total variance
      if (!isNaN(costDeviation) && isFinite(costDeviation)) {
        totalVariance += Math.abs(costDeviation);
      }
      
      if (deviationPercentage > 5) {
        membersOverBudget++;
      } else if (deviationPercentage < -5) {
        membersUnderBudget++;
      }

      // Get personnel name
      const personnelInfo = personnelMap.get(member.personnelId);
      const personnelName = personnelInfo?.name || `Personal ${member.personnelId}`;

      const deviation = {
        personnelId: member.personnelId,
        personnelName,
        budgetedHours,
        actualHours,
        budgetedCost,
        actualCost,
        hourDeviation,
        costDeviation,
        deviationPercentage
      };

      deviationByRole.push(deviation);

      // Track major deviations
      if (Math.abs(deviationPercentage) > 25 || Math.abs(costDeviation) > 500) {
        majorDeviations.push({
          ...deviation,
          severity: Math.abs(deviationPercentage) > 50 ? 'critical' : 'high'
        });
      }
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
  }, () => {
    log(`serving on port ${port}`);
  });
})();