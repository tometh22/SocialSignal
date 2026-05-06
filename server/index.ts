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

    // 0010: Multi-room Review system
    await run('0010 review_rooms tables', `
      CREATE TABLE IF NOT EXISTS review_rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        color_index INTEGER NOT NULL DEFAULT 0,
        emoji VARCHAR(16),
        privacy VARCHAR(20) NOT NULL DEFAULT 'members',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        archived_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS review_room_members (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'editor',
        added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_visited_at TIMESTAMP,
        CONSTRAINT review_room_members_room_user_unique UNIQUE (room_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_rrm_user ON review_room_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_rrm_room ON review_room_members(room_id);
    `);
    await run('0010 room_id columns', `
      ALTER TABLE project_status_reviews ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
      ALTER TABLE weekly_status_items    ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
      ALTER TABLE project_review_notes   ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
      ALTER TABLE status_update_entries  ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
      ALTER TABLE status_change_log      ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
    `);
    await run('0010 backfill legacy room', `
      DO $$
      DECLARE
        v_admin_id INTEGER;
        v_room_id  INTEGER;
      BEGIN
        -- Only run if no rooms exist yet (idempotent)
        IF (SELECT COUNT(*) FROM review_rooms) = 0 THEN
          SELECT id INTO v_admin_id FROM users WHERE is_admin = true ORDER BY id ASC LIMIT 1;
          IF v_admin_id IS NULL THEN
            SELECT id INTO v_admin_id FROM users ORDER BY id ASC LIMIT 1;
          END IF;

          INSERT INTO review_rooms (name, description, color_index, emoji, privacy, created_by)
          VALUES ('Mi Review', 'Sala personal con el historial heredado.', 0, NULL, 'members', v_admin_id)
          RETURNING id INTO v_room_id;

          -- Add all admins as owners so nobody loses access (fallback to any user if no admins)
          INSERT INTO review_room_members (room_id, user_id, role, added_by)
          SELECT v_room_id, u.id, 'owner', v_admin_id
          FROM users u
          WHERE u.is_admin = true
          ON CONFLICT (room_id, user_id) DO NOTHING;

          -- If no admins existed, at least add the fallback user
          IF v_admin_id IS NOT NULL THEN
            INSERT INTO review_room_members (room_id, user_id, role, added_by)
            VALUES (v_room_id, v_admin_id, 'owner', v_admin_id)
            ON CONFLICT (room_id, user_id) DO NOTHING;
          END IF;

          UPDATE project_status_reviews SET room_id = v_room_id WHERE room_id IS NULL;
          UPDATE weekly_status_items    SET room_id = v_room_id WHERE room_id IS NULL;
          UPDATE project_review_notes   SET room_id = v_room_id WHERE room_id IS NULL;
          UPDATE status_update_entries  SET room_id = v_room_id WHERE room_id IS NULL;
          UPDATE status_change_log      SET room_id = v_room_id WHERE room_id IS NULL;
        END IF;
      END $$;
    `);

    // 0010b: retroactive fix for environments where only the first admin was added as member.
    // Add any missing admins as owners of Mi Review (idempotent).
    await run('0010b backfill admin members', `
      DO $$
      DECLARE
        v_room_id INTEGER;
      BEGIN
        SELECT id INTO v_room_id FROM review_rooms WHERE name = 'Mi Review' ORDER BY id ASC LIMIT 1;
        IF v_room_id IS NOT NULL THEN
          INSERT INTO review_room_members (room_id, user_id, role, added_by)
          SELECT v_room_id, u.id, 'owner', u.id
          FROM users u
          WHERE u.is_admin = true
          ON CONFLICT (room_id, user_id) DO NOTHING;
        END IF;
      END $$;
    `);
    await run('0010 room_id indexes', `
      CREATE INDEX IF NOT EXISTS idx_psr_room ON project_status_reviews(room_id);
      CREATE INDEX IF NOT EXISTS idx_wsi_room ON weekly_status_items(room_id);
      CREATE INDEX IF NOT EXISTS idx_prn_room ON project_review_notes(room_id);
      CREATE INDEX IF NOT EXISTS idx_sue_room ON status_update_entries(room_id);
      CREATE INDEX IF NOT EXISTS idx_scl_room ON status_change_log(room_id);
    `);

    // 0011: project lifecycle states + personal monthly invoices + external providers
    await run('0011 users.role', `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
      UPDATE users SET role = 'admin' WHERE is_admin = TRUE AND role = 'member';
    `);
    await run('0011 active_projects lifecycle', `
      ALTER TABLE active_projects
        ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS invoiced_at  TIMESTAMP,
        ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMP,
        ADD COLUMN IF NOT EXISTS closed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    await run('0011 personal_monthly_invoices', `
      CREATE TABLE IF NOT EXISTS personal_monthly_invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
        period VARCHAR(7) NOT NULL,
        file_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        computed_total_cost_ars DOUBLE PRECISION,
        computed_total_cost_usd DOUBLE PRECISION,
        hours_total DOUBLE PRECISION,
        notes TEXT,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT personal_monthly_invoices_user_period_unique UNIQUE (user_id, period)
      );
      CREATE INDEX IF NOT EXISTS idx_pmi_user   ON personal_monthly_invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_pmi_period ON personal_monthly_invoices(period);
    `);
    await run('0011 external_providers', `
      CREATE TABLE IF NOT EXISTS external_providers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
        company_name VARCHAR(255) NOT NULL,
        tax_id VARCHAR(50),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        hourly_rate DOUBLE PRECISION,
        hourly_rate_ars DOUBLE PRECISION,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_external_providers_company ON external_providers(company_name);
    `);
    await run('0011 provider_project_access', `
      CREATE TABLE IF NOT EXISTS provider_project_access (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES external_providers(id) ON DELETE CASCADE,
        project_id  INTEGER NOT NULL REFERENCES active_projects(id)  ON DELETE CASCADE,
        can_log_hours     BOOLEAN NOT NULL DEFAULT TRUE,
        can_upload_costs  BOOLEAN NOT NULL DEFAULT TRUE,
        granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT provider_project_access_unique UNIQUE (provider_id, project_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ppa_provider ON provider_project_access(provider_id);
      CREATE INDEX IF NOT EXISTS idx_ppa_project  ON provider_project_access(project_id);
    `);

    // 0012: rate_projection_mode column on quotations (schema drift fix).
    // The column was declared in shared/schema.ts but never had a migration,
    // so SELECT * on quotations was failing with "column does not exist".
    await run('0012 quotations.rate_projection_mode', `
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "rate_projection_mode" text DEFAULT 'current';
    `);

    // 0013: status item proposals — versioned approval flow for content (e.g. social posts)
    await run('0013 status_item_proposals table', `
      CREATE TABLE IF NOT EXISTS status_item_proposals (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES active_projects(id) ON DELETE CASCADE,
        weekly_status_item_id INTEGER REFERENCES weekly_status_items(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        submitted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        decided_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        decided_at TIMESTAMP,
        decision_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT status_item_proposals_target_xor CHECK (
          (project_id IS NOT NULL AND weekly_status_item_id IS NULL)
          OR (project_id IS NULL AND weekly_status_item_id IS NOT NULL)
        ),
        CONSTRAINT status_item_proposals_status_chk CHECK (
          status IN ('pending','approved','rejected','superseded')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_sip_room_project ON status_item_proposals(room_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_sip_room_item    ON status_item_proposals(room_id, weekly_status_item_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sip_project_version ON status_item_proposals(project_id, version) WHERE project_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sip_item_version    ON status_item_proposals(weekly_status_item_id, version) WHERE weekly_status_item_id IS NOT NULL;
    `);
    await run('0013 status_item_proposal_attachments table', `
      CREATE TABLE IF NOT EXISTS status_item_proposal_attachments (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES status_item_proposals(id) ON DELETE CASCADE,
        kind VARCHAR(10) NOT NULL DEFAULT 'file',
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        mime_type VARCHAR(120),
        link_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT status_item_proposal_attachments_kind_chk CHECK (kind IN ('file','link')),
        CONSTRAINT status_item_proposal_attachments_payload_chk CHECK (
          (kind = 'file' AND file_url IS NOT NULL)
          OR (kind = 'link' AND link_url IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS idx_sipa_proposal ON status_item_proposal_attachments(proposal_id);
    `);

    // 0016: per-user, per-item read state for review comments. Each row says
    // "user X considers item Y read up to last_seen_at". Unread count =
    // notes(item) where created_at > last_seen_at AND author_id <> user.
    await run('0016 review_item_read_state table', `
      CREATE TABLE IF NOT EXISTS review_item_read_state (
        user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        room_id     INTEGER     NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
        target_kind VARCHAR(10) NOT NULL CHECK (target_kind IN ('project','custom')),
        target_id   INTEGER     NOT NULL,
        last_seen_at TIMESTAMP  NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, target_kind, target_id)
      );
      CREATE INDEX IF NOT EXISTS idx_riras_user_room ON review_item_read_state(user_id, room_id);
    `);

    // 0016 backfill: seed receipts so existing users don't see all old comments
    // as new. last_seen_at = COALESCE(member.last_visited_at, NOW()).
    // Idempotent via ON CONFLICT DO NOTHING.
    await run('0016 backfill from last_visited_at (project items)', `
      INSERT INTO review_item_read_state (user_id, room_id, target_kind, target_id, last_seen_at)
      SELECT rrm.user_id, rrm.room_id, 'project', psr.project_id,
             COALESCE(rrm.last_visited_at, NOW())
      FROM review_room_members rrm
      JOIN project_status_reviews psr ON psr.room_id = rrm.room_id
      ON CONFLICT (user_id, target_kind, target_id) DO NOTHING;
    `);
    await run('0016 backfill from last_visited_at (custom items)', `
      INSERT INTO review_item_read_state (user_id, room_id, target_kind, target_id, last_seen_at)
      SELECT rrm.user_id, rrm.room_id, 'custom', wsi.id,
             COALESCE(rrm.last_visited_at, NOW())
      FROM review_room_members rrm
      JOIN weekly_status_items wsi ON wsi.room_id = rrm.room_id
      ON CONFLICT (user_id, target_kind, target_id) DO NOTHING;
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