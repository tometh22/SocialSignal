-- Objectives tracking foundation. Safe to run repeatedly during application startup.
CREATE TABLE IF NOT EXISTS objectives (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  year INTEGER NOT NULL,
  area_key VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  metric TEXT,
  target TEXT,
  current_value TEXT,
  progress_percent NUMERIC(5,2),
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  owner_personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT objectives_level_check CHECK (level IN ('company', 'area', 'person')),
  CONSTRAINT objectives_progress_check CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  CONSTRAINT objectives_slug_year_unique UNIQUE (slug, year)
);

CREATE TABLE IF NOT EXISTS objective_accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objective_actions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(180) NOT NULL,
  objective_id INTEGER REFERENCES objectives(id) ON DELETE SET NULL,
  account_id INTEGER REFERENCES objective_accounts(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  month INTEGER,
  week_label VARCHAR(80),
  week_start DATE,
  due_date DATE,
  focus VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  accountable_owner_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
  evidence TEXT,
  dependency_action_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT objective_actions_month_check CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  CONSTRAINT objective_actions_status_check CHECK (status IN ('planned', 'in_progress', 'blocked', 'done', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS objective_action_owners (
  id SERIAL PRIMARY KEY,
  action_id INTEGER NOT NULL REFERENCES objective_actions(id) ON DELETE CASCADE,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'support',
  CONSTRAINT objective_action_owners_role_check CHECK (role IN ('accountable', 'support')),
  CONSTRAINT objective_action_owners_unique UNIQUE (action_id, personnel_id, role)
);

CREATE TABLE IF NOT EXISTS objective_action_events (
  id SERIAL PRIMARY KEY,
  action_id INTEGER NOT NULL REFERENCES objective_actions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  from_status VARCHAR(20) NOT NULL,
  to_status VARCHAR(20) NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Repairs for a partially-created table from an interrupted deploy. These are
-- additive only, except for the deterministic slug backfill below.
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS area_key VARCHAR(80);
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS metric TEXT;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS target TEXT;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS current_value TEXT;
ALTER TABLE objectives ALTER COLUMN target TYPE TEXT USING target::text;
ALTER TABLE objectives ALTER COLUMN current_value TYPE TEXT USING current_value::text;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2);
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'planned';
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS owner_personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE objective_accounts ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE objective_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE objective_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS objective_id INTEGER REFERENCES objectives(id) ON DELETE SET NULL;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS slug VARCHAR(180);
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES objective_accounts(id) ON DELETE SET NULL;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS week_label VARCHAR(80);
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS week_start DATE;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS focus VARCHAR(120);
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'planned';
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS accountable_owner_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS evidence TEXT;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS dependency_action_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE objective_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- A previous interrupted deploy may have created actions without their stable
-- slug. Backfill those rows before enforcing the new idempotency key.
UPDATE objective_actions
SET slug = 'legacy-action-' || id
WHERE slug IS NULL;
ALTER TABLE objective_actions ALTER COLUMN slug SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_year ON objectives(year);
CREATE INDEX IF NOT EXISTS idx_objectives_owner ON objectives(owner_personnel_id);
CREATE INDEX IF NOT EXISTS idx_objective_accounts_client ON objective_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_objective_actions_objective ON objective_actions(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_actions_account ON objective_actions(account_id);
CREATE INDEX IF NOT EXISTS idx_objective_actions_week ON objective_actions(week_start, due_date);
CREATE INDEX IF NOT EXISTS idx_objective_actions_status ON objective_actions(status);
CREATE INDEX IF NOT EXISTS idx_objective_actions_owner ON objective_actions(accountable_owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS objective_actions_slug_unique ON objective_actions(slug);
CREATE INDEX IF NOT EXISTS idx_objective_action_owners_action ON objective_action_owners(action_id);
CREATE INDEX IF NOT EXISTS idx_objective_action_owners_personnel ON objective_action_owners(personnel_id);
CREATE INDEX IF NOT EXISTS idx_objective_action_events_action ON objective_action_events(action_id, created_at);
CREATE INDEX IF NOT EXISTS idx_objective_action_events_user ON objective_action_events(user_id);
