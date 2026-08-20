/**
 * Small, dependency-safe foundation for the professional quotation workflow.
 *
 * The original 0043/0044 runtime migration bundled data repairs and all DDL in
 * one statement. A single legacy row could therefore abort the statement before
 * the revision tables (and the studio schema) existed. This foundation is run
 * independently before those repairs so startup can always complete the schema
 * required by the quotation routes and blueprint seeder.
 */
/** The seeder only needs this table; keep it in its own statement as a last
 * line of defence if a later compatibility repair is blocked by legacy data. */
export const serviceBlueprintFoundationMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS service_blueprints (
  id serial PRIMARY KEY,
  slug varchar(120) NOT NULL,
  name varchar(180) NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL,
  source_label varchar(180),
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_blueprints_slug_version_unique UNIQUE(slug, version),
  CONSTRAINT service_blueprints_status_check CHECK (status IN ('draft', 'published', 'archived'))
);
CREATE INDEX IF NOT EXISTS service_blueprints_status_idx ON service_blueprints(status);
`;

export const quotationWorkflowFoundationMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS service_blueprints (
  id serial PRIMARY KEY,
  slug varchar(120) NOT NULL,
  name varchar(180) NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL,
  source_label varchar(180),
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_blueprints_slug_version_unique UNIQUE(slug, version),
  CONSTRAINT service_blueprints_status_check CHECK (status IN ('draft', 'published', 'archived'))
);
CREATE INDEX IF NOT EXISTS service_blueprints_status_idx ON service_blueprints(status);

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS project_duration TEXT,
  ADD COLUMN IF NOT EXISTS deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_deliverable_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_entity_id INTEGER REFERENCES client_billing_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automatic_inflation_rate DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS subtotal_amount DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label VARCHAR(40) NOT NULL DEFAULT 'IVA',
  ADD COLUMN IF NOT EXISTS tax_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER,
  ADD COLUMN IF NOT EXISTS payment_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commercial_terms TEXT,
  ADD COLUMN IF NOT EXISTS inclusions TEXT,
  ADD COLUMN IF NOT EXISTS exclusions TEXT,
  ADD COLUMN IF NOT EXISTS terms_version VARCHAR(40) NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS accepted_variant_id INTEGER REFERENCES quotation_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS internal_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS public_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS lock_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_blueprint_id INTEGER REFERENCES service_blueprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_blueprint_version INTEGER,
  ADD COLUMN IF NOT EXISTS commercial_motion VARCHAR(30) NOT NULL DEFAULT 'new_business',
  ADD COLUMN IF NOT EXISTS scope_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS decision_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operational_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS effort_override_reason TEXT;

CREATE TABLE IF NOT EXISTS quotation_revisions (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  document_hash VARCHAR(64) NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT quotation_revisions_quote_revision_unique UNIQUE (quotation_id, revision_number)
);
CREATE TABLE IF NOT EXISTS quotation_events (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_id INTEGER REFERENCES quotation_revisions(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  event_key VARCHAR(180) UNIQUE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(30) NOT NULL DEFAULT 'internal',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS quotation_approvals (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_id INTEGER NOT NULL REFERENCES quotation_revisions(id) ON DELETE CASCADE,
  rule_code VARCHAR(80) NOT NULL,
  rule_label VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMP,
  decision_reason TEXT,
  CONSTRAINT quotation_approvals_revision_rule_unique UNIQUE (revision_id, rule_code)
);
CREATE TABLE IF NOT EXISTS quotation_approval_rules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  min_discount_percentage DOUBLE PRECISION,
  max_gross_margin_percentage DOUBLE PRECISION,
  min_total_amount DOUBLE PRECISION,
  currency VARCHAR(3),
  requires_manual_price BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS quotation_deliveries (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_id INTEGER NOT NULL REFERENCES quotation_revisions(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quotation_revisions_quote_idx ON quotation_revisions(quotation_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS quotation_events_quote_idx ON quotation_events(quotation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quotation_approvals_pending_idx ON quotation_approvals(status, requested_at);
CREATE INDEX IF NOT EXISTS quotation_deliveries_quote_idx ON quotation_deliveries(quotation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS quotation_deliveries_one_active_revision_idx
  ON quotation_deliveries(quotation_id, revision_id)
  WHERE status IN ('queued', 'sent');

ALTER TABLE quotation_variants
  ADD COLUMN IF NOT EXISTS scope_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unit_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS quotation_variants_one_recommended_idx
  ON quotation_variants(quotation_id) WHERE is_recommended = TRUE;
`;
