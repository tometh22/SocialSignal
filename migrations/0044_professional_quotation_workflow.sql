-- Professional quotation lifecycle, immutable revisions, approvals and delivery audit.

-- Historical form accepted a human percentage while the domain expects a
-- decimal rate. Repair only unmistakable percentage-shaped rows; idempotent.
UPDATE monthly_inflation
SET inflation_rate = inflation_rate / 100.0
WHERE inflation_rate > 1 AND inflation_rate <= 100;

DO $$ BEGIN
  ALTER TABLE monthly_inflation ADD CONSTRAINT monthly_inflation_decimal_rate_check
    CHECK (inflation_rate > 0 AND inflation_rate <= 1) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE quotations
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
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE quotations
SET quotation_number = 'COT-' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(id::text, 6, '0')
WHERE quotation_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quotations_number_unique_idx ON quotations(quotation_number);
CREATE UNIQUE INDEX IF NOT EXISTS quotations_public_token_hash_unique_idx
  ON quotations(public_token_hash) WHERE public_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotations_parent_revision_idx ON quotations(parent_quotation_id, revision_number);
CREATE INDEX IF NOT EXISTS quotations_lifecycle_idx ON quotations(status, expires_at);

DO $$ BEGIN
  ALTER TABLE quotations ADD CONSTRAINT quotations_commercial_terms_check CHECK (
    revision_number > 0
    AND lock_version > 0
    AND tax_rate >= 0 AND tax_rate <= 100
    AND tax_amount >= 0
    AND (subtotal_amount IS NULL OR subtotal_amount >= 0)
    AND (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 730)
  ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

INSERT INTO quotation_approval_rules
  (code, name, min_discount_percentage, max_gross_margin_percentage, min_total_amount, currency, requires_manual_price)
VALUES
  ('discount-over-10', 'Descuento superior al 10%', 10, NULL, NULL, NULL, FALSE),
  ('gross-margin-under-30', 'Margen bruto inferior al 30%', NULL, 30, NULL, NULL, FALSE),
  ('manual-price', 'Precio definido manualmente', NULL, NULL, NULL, NULL, TRUE),
  ('large-usd-quote', 'Cotización USD superior a 50.000', NULL, NULL, 50000, 'USD', FALSE)
ON CONFLICT (code) DO NOTHING;

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

-- Existing approved rows were historically "finalized internally". Preserve
-- project compatibility while making the distinction explicit going forward.
UPDATE quotations
SET internal_approved_at = COALESCE(internal_approved_at, updated_at)
WHERE status = 'approved' AND internal_approved_at IS NULL;
