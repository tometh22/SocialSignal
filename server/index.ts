import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

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

// Configuración de la sesión
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tu-clave-secreta-muy-segura',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Cambiar a true en producción con HTTPS
      httpOnly: false, // IMPORTANTE: false para que sea accesible desde el frontend
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
  })
);

// Middleware de autenticación temporal para desarrollo
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 Auth middleware - Headers: ${req.headers.authorization}`);
  console.log(`🔍 Auth middleware - Session ID: ${req.sessionID}`);
  console.log(`🔍 Auth middleware - Session data:`, req.session);

  // Verificar si el usuario ya está autenticado
  if (req.session?.userId) {
    console.log(`✅ User authenticated: ${req.session.userId}`);
    return next();
  }

  // TEMP FIX: Permitir cualquier usuario en desarrollo
  console.log(`🚀 TEMP FIX requireAuth: No session found, attempting auto-login for development`);
  req.session.userId = 'demo@epical.digital';
  req.session.save((err) => {
    if (err) {
      console.error('Error saving session:', err);
    } else {
      console.log(`✅ TEMP FIX requireAuth: Auto-logged in demo user: demo@epical.digital`);
    }
  });
  return next();
};

// Auth status check endpoint - DEBE IR ANTES DE registerRoutes()
app.get('/auth/check', (req: Request, res: Response) => {
  const userId = req.session?.userId;
  
  console.log(`🔍 Auth check: Session ID = ${req.sessionID}, User ID = ${userId}`);
  
  if (userId) {
    res.json({
      authenticated: true,
      user: { email: userId }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Register all API routes with auth middleware
registerRoutes(app, requireAuth);

const port = Number(process.env.PORT || process.env.REPL_SLUG ? 5000 : 3000);

(async () => {
  try {
    console.log("🔄 Starting application...");
    
    // Initialize database connection and data
    await initializeDatabase();
    console.log("💾 Database initialized successfully");

    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });

    // Setup Vite middleware after server is created
    await setupVite(app, server);
    
    // Note: serveStatic is only needed in production, Vite handles static files in development
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();