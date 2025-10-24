import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import { autoSyncService } from "./services/autoSyncService";
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Note: Session types are declared in server/auth.ts

const app = express();

// 🚫 ENDPOINT DUPLICADO ELIMINADO - Ahora usa implementación universal en routes.ts

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

// Configuración de la sesión - Compatible con Replit webview y pestañas externas
const isProduction = process.env.NODE_ENV === 'production';
const isReplit = process.env.REPL_ID !== undefined;

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tu-clave-secreta-muy-segura',
    resave: false,
    saveUninitialized: true, // Crear sesión automáticamente en primera visita
    cookie: {
      secure: isReplit, // true en Replit (usa HTTPS), false en local
      httpOnly: false, // false para que sea accesible desde el frontend si es necesario
      sameSite: isReplit ? 'none' : 'lax', // 'none' para cross-origin en Replit, 'lax' en local
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      path: '/', // Cookie disponible en todas las rutas
      domain: undefined // Auto-detectar el dominio
    }
  })
);

// Auth check endpoint - CRITICAL FOR FRONTEND
app.get('/auth/check', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  
  console.log(`🔍 Auth check: Session ID = ${req.sessionID}, User ID = ${userId}`);
  
  if (userId) {
    // Get user from storage
    const user = await storage.getUser(userId);
    if (user) {
      res.json({
        authenticated: true,
        user: { email: user.email }
      });
    } else {
      res.json({ authenticated: false });
    }
  } else {
    // Auto-authenticate in development - use default user ID 1
    try {
      const user = await storage.getUser(1);
      if (user) {
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
          }
        });
        res.json({
          authenticated: true,
          user: { email: user.email }
        });
      } else {
        res.json({ authenticated: false });
      }
    } catch (err) {
      console.error('Error getting user:', err);
      res.json({ authenticated: false });
    }
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Register all API routes (registerRoutes configura su propia autenticación internamente)
registerRoutes(app);

const port = Number(process.env.PORT || 5000);

(async () => {
  try {
    console.log("🔄 Starting application...");
    console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    
    // Initialize database connection and data
    await initializeDatabase();
    console.log("💾 Database initialized successfully");

    // TEMPORARILY DISABLED: Auto-sync services causing OOM
    // Start automatic synchronization service
    // autoSyncService.start();
    // console.log("🔄 Sincronización automática iniciada (cada 30 minutos)");

    // Start daily SoT ETL synchronization job
    // const { startDailySoTSync } = await import("./jobs/daily-sot-sync");
    // startDailySoTSync();
    // console.log("📅 Job diario SoT ETL programado (02:00 AR)");

    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });

    // Setup Vite or static file serving based on environment
    // CRITICAL: This must be called AFTER API routes are registered
    if (isProduction) {
      console.log("📦 Production mode: serving static files from dist/public");
      serveStatic(app);
    } else {
      console.log("🔧 Development mode: setting up Vite middleware");
      await setupVite(app, server);
    }
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();