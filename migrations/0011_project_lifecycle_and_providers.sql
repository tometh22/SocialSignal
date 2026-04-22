-- Modernización gestión de proyectos: estados granulares + cierre bloquante,
-- factura mensual personal y proveedores externos end-to-end.
-- Transaccional: todo o nada.

BEGIN;

-- ─── 1. users.role (paralelo a isAdmin, no reemplaza) ───────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Backfill: admins existentes quedan como admin, el resto como member.
UPDATE users SET role = 'admin' WHERE is_admin = TRUE AND role = 'member';

-- ─── 2. active_projects: campos de ciclo de vida ────────────────────────────
ALTER TABLE active_projects
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invoiced_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS closed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- ─── 3. personal_monthly_invoices ───────────────────────────────────────────
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

-- ─── 4. external_providers ─────────────────────────────────────────────────
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

-- ─── 5. provider_project_access ────────────────────────────────────────────
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

COMMIT;
