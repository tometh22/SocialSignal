import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import cors from 'cors';
import session from 'express-session';

const app = express();

// Request logging middleware for debugging (reduced noise)
app.use((req, res, next) => {
  // Only log API requests and errors, not static files
  if (req.path.startsWith('/api') || req.method !== 'GET') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.path.startsWith('/api')) {
      console.log('Session ID:', req.session?.userId || 'undefined');
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

// ENDPOINT TEMPORAL PARA DEVIATION ANALYSIS (MOVED FROM ROUTES.TS)
app.get("/api/projects/:id/deviation-analysis", async (req, res) => {
  console.log(`🎯🎯🎯 DEVIATION ANALYSIS WORKING - ID: ${req.params.id}, Query:`, req.query);
  
  try {
    const projectId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;
    
    // Return empty state for now to test basic functionality
    const response = {
      deviationByRole: [],
      totalVariance: { variance: 0 },
      summary: { membersOverBudget: 0, membersUnderBudget: 0 },
      majorDeviations: [],
      analysis: [],
      debug: {
        projectId,
        startDate,
        endDate,
        message: 'Endpoint working from index.ts - showing empty state for filtered data'
      }
    };
    
    console.log(`🎯 Returning response:`, response);
    res.json(response);
  } catch (error) {
    console.error("Error in deviation analysis:", error);
    res.status(500).json({ message: "Failed to analyze project deviations" });
  }
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