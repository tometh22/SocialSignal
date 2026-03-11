import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import { autoSyncService } from "./services/autoSyncService";
import cors from 'cors';
import { execSync } from 'child_process';

// Note: Session types are declared in server/auth.ts

const app = express();

// Trust Replit's reverse proxy so express-session sets Secure cookies correctly
app.set('trust proxy', 1);

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
// CORS configuration
app.use(cors({
  origin: true, // Permitir cualquier origen durante debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
}));

const isProduction = process.env.NODE_ENV === 'production';

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Register all API routes (registerRoutes configura su propia autenticación internamente)
registerRoutes(app);

const port = Number(process.env.PORT || 5000);

(async () => {
  try {
    // Kill any process holding the port before we try to bind
    try {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
    } catch (_) { /* no process on port, that's fine */ }

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

    // Start CRM reminder notifications job
    const { startReminderNotifications } = await import("./jobs/reminder-notifications");
    startReminderNotifications();
    console.log("🔔 Job de notificaciones de recordatorios CRM iniciado");

    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${port} is already in use. Exiting so the process manager can restart cleanly.`);
        process.exit(1);
      } else {
        console.error("❌ Server error:", err);
        process.exit(1);
      }
    });

    // Safety net: any /api/* request that didn't match a route gets a proper JSON 404
    // instead of falling through to the Vite/static HTML catch-all
    app.use('/api', (req, res) => {
      console.error(`⚠️ Unmatched API route: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
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