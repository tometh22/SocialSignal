import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-data";
import { storage } from "./storage";
import { autoSyncService } from "./services/autoSyncService";
import { pool } from "./db";
import cors from 'cors';
import { execSync } from 'child_process';

/** Applies any DDL that may be missing from the production database.
 *  All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 *  Each migration runs independently so one failure doesn't block the rest.
 */
async function applyPendingMigrations() {
  const client = await pool.connect();

  const run = async (name: string, sql: string) => {
    try {
      await client.query(sql);
      console.log(`✅ Migration OK: ${name}`);
    } catch (err: any) {
      console.error(`⚠️  Migration skipped (${name}): ${err.message}`);
    }
  };

  try {
    // 0003: deadline columns on status tables
    await run('0003 deadline columns', `
      ALTER TABLE "project_status_reviews" ADD COLUMN IF NOT EXISTS "deadline" timestamp;
      ALTER TABLE "weekly_status_items"    ADD COLUMN IF NOT EXISTS "deadline" timestamp;
    `);

    // 0005: margen/proyeccion/balance columns on monthly_financial_summary
    await run('0005 margen_operativo columns', `
      ALTER TABLE monthly_financial_summary
        ADD COLUMN IF NOT EXISTS margen_operativo    numeric(8,  4),
        ADD COLUMN IF NOT EXISTS margen_neto         numeric(8,  4),
        ADD COLUMN IF NOT EXISTS proyeccion_resultado numeric(14, 2),
        ADD COLUMN IF NOT EXISTS balance_60_dias     numeric(14, 2);
    `);

    // 0006: operations module — new columns + tables
    await run('0006 selected_variant_id', `
      ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS selected_variant_id INTEGER REFERENCES quotation_variants(id);
    `);
    await run('0006 project_category', `
      ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS project_category TEXT NOT NULL DEFAULT 'billable';
    `);
    await run('0006 holidays table', `
      CREATE TABLE IF NOT EXISTS holidays (
        id          SERIAL PRIMARY KEY,
        date        TIMESTAMP NOT NULL,
        name        TEXT NOT NULL,
        is_national BOOLEAN NOT NULL DEFAULT TRUE,
        year        INTEGER NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await run('0006 monthly_closings table', `
      CREATE TABLE IF NOT EXISTS monthly_closings (
        id            SERIAL PRIMARY KEY,
        personnel_id  INTEGER NOT NULL REFERENCES personnel(id),
        year          INTEGER NOT NULL,
        month         INTEGER NOT NULL,
        actual_hours  DOUBLE PRECISION NOT NULL,
        adjusted_hours DOUBLE PRECISION NOT NULL,
        hourly_rate   DOUBLE PRECISION NOT NULL,
        total_cost    DOUBLE PRECISION NOT NULL,
        notes         TEXT,
        closed_by     INTEGER REFERENCES users(id),
        closed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_person_month_closing UNIQUE(personnel_id, year, month)
      );
    `);
    await run('0006 estimated_rates table', `
      CREATE TABLE IF NOT EXISTS estimated_rates (
        id                  SERIAL PRIMARY KEY,
        personnel_id        INTEGER NOT NULL REFERENCES personnel(id),
        year                INTEGER NOT NULL,
        month               INTEGER NOT NULL,
        estimated_rate_ars  DOUBLE PRECISION NOT NULL,
        adjustment_pct      DOUBLE PRECISION,
        notes               TEXT,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by          INTEGER REFERENCES users(id),
        CONSTRAINT unique_person_month_rate UNIQUE(personnel_id, year, month)
      );
    `);
    await run('0006 personnel_aliases table', `
      CREATE TABLE IF NOT EXISTS personnel_aliases (
        id           SERIAL PRIMARY KEY,
        personnel_id INTEGER NOT NULL REFERENCES personnel(id),
        excel_name   VARCHAR(255) NOT NULL UNIQUE,
        source       VARCHAR(50) NOT NULL DEFAULT 'manual',
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 0007: status_change_log + updated_by columns
    await run('0007 updated_by columns', `
      ALTER TABLE "project_status_reviews" ADD COLUMN IF NOT EXISTS "updated_by" integer REFERENCES "users"("id");
      ALTER TABLE "weekly_status_items"    ADD COLUMN IF NOT EXISTS "updated_by" integer REFERENCES "users"("id");
    `);
    await run('0007 status_change_log table', `
      CREATE TABLE IF NOT EXISTS "status_change_log" (
        "id"                    serial PRIMARY KEY,
        "project_id"            integer REFERENCES "active_projects"("id") ON DELETE CASCADE,
        "weekly_status_item_id" integer REFERENCES "weekly_status_items"("id") ON DELETE CASCADE,
        "user_id"               integer REFERENCES "users"("id"),
        "field_name"            varchar(30) NOT NULL,
        "old_value"             text,
        "new_value"             text,
        "created_at"            timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_status_change_log_project"     ON "status_change_log" ("project_id")            WHERE "project_id" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "idx_status_change_log_custom_item" ON "status_change_log" ("weekly_status_item_id") WHERE "weekly_status_item_id" IS NOT NULL;
    `);

    // 0008: status_update_entries table
    await run('0008 status_update_entries table', `
      CREATE TABLE IF NOT EXISTS status_update_entries (
        id                    SERIAL PRIMARY KEY,
        project_id            INTEGER REFERENCES active_projects(id) ON DELETE CASCADE,
        weekly_status_item_id INTEGER REFERENCES weekly_status_items(id) ON DELETE CASCADE,
        content               TEXT NOT NULL,
        author_id             INTEGER REFERENCES users(id),
        created_at            TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sue_project  ON status_update_entries(project_id);
      CREATE INDEX IF NOT EXISTS idx_sue_custom   ON status_update_entries(weekly_status_item_id);
      CREATE INDEX IF NOT EXISTS idx_sue_created  ON status_update_entries(created_at DESC);
    `);

    // 0009: quotation expires_at, loss_reason, quotation_templates
    await run('0009 quotation columns', `
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "expires_at"   timestamp;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "loss_reason"  text;
    `);
    await run('0009 quotation_templates table', `
      CREATE TABLE IF NOT EXISTS "quotation_templates" (
        "id"               serial PRIMARY KEY NOT NULL,
        "name"             text NOT NULL,
        "description"      text,
        "project_type"     text NOT NULL,
        "analysis_type"    text NOT NULL,
        "mentions_volume"  text NOT NULL DEFAULT 'medium',
        "countries_covered" text NOT NULL DEFAULT '1',
        "client_engagement" text NOT NULL DEFAULT 'medium',
        "team_config"      text NOT NULL,
        "complexity_config" text,
        "created_by"       integer REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"       timestamp NOT NULL DEFAULT now(),
        "updated_at"       timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_quotation_templates_created_by" ON "quotation_templates"("created_by");
    `);

  } finally {
    client.release();
  }
}

// Note: Session types are declared in server/auth.ts

// Prevent unhandled async rejections from crashing the process.
// Individual route handlers should still have their own try/catch for
// user-facing error responses, but this is the last-resort safety net.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled promise rejection (process kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught exception (process kept alive):', err);
});

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
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || false)
    : true,
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

// ==================== LOOKER STUDIO / BI ENDPOINTS ====================
// Registered at top level (synchronous) so they always run before any catch-all
app.get("/api/bi/pnl-mensual", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM vw_looker_pnl_mensual")).rows); }
  catch (e: any) { res.status(500).json({ message: e.message }); }
});
app.get("/api/bi/proyectos-mensual", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM vw_looker_proyectos_mensual")).rows); }
  catch (e: any) { res.status(500).json({ message: e.message }); }
});
app.get("/api/bi/costos-mensual", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM vw_looker_costos_mensual")).rows); }
  catch (e: any) { res.status(500).json({ message: e.message }); }
});
app.get("/api/bi/equipo-mensual", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM vw_looker_equipo_mensual")).rows); }
  catch (e: any) { res.status(500).json({ message: e.message }); }
});
app.get("/api/bi/cashflow", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM vw_looker_cashflow")).rows); }
  catch (e: any) { res.status(500).json({ message: e.message }); }
});
app.get("/api/bi/revenue-por-cliente", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM vw_looker_revenue_por_cliente")).rows); }
  catch (e: any) { res.status(500).json({ message: e.message }); }
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
    
    // Apply any pending schema migrations before initializing data
    await applyPendingMigrations();

    // Initialize database connection and data
    await initializeDatabase();
    console.log("💾 Database initialized successfully");

    // TEMPORARILY DISABLED: Auto-sync services causing OOM
    // Start automatic synchronization service
    // autoSyncService.start();
    // console.log("🔄 Sincronización automática iniciada (cada 30 minutos)");

    // Lightweight Resumen Ejecutivo sync (every 2 hours + on startup)
    const { startResumenEjecutivoSync } = await import("./jobs/resumen-ejecutivo-sync");
    startResumenEjecutivoSync();
    console.log("📊 Resumen Ejecutivo auto-sync iniciado (cada 2 horas)");

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