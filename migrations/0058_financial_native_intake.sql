-- Carga financiera nativa: bandeja inteligente, cierre mensual y auditoría.

CREATE TABLE IF NOT EXISTS financial_intake_items (
  id serial PRIMARY KEY,
  input_kind varchar(20) NOT NULL,
  original_text text,
  original_file_name text,
  mime_type varchar(160),
  file_size integer,
  file_hash varchar(64),
  storage_key text,
  document_kind varchar(40) NOT NULL DEFAULT 'unknown',
  suggested_target varchar(40),
  status varchar(30) NOT NULL DEFAULT 'received',
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_error text,
  extractor_provider varchar(40),
  extractor_model varchar(120),
  extractor_version varchar(40),
  review_notes text,
  rejection_reason text,
  linked_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  posted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT financial_intake_input_kind_check
    CHECK (input_kind IN ('text', 'file', 'image', 'connection')),
  CONSTRAINT financial_intake_status_check
    CHECK (status IN ('received', 'processing', 'needs_review', 'approved', 'rejected', 'posted', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_financial_intake_status
  ON financial_intake_items(status, created_at);
CREATE INDEX IF NOT EXISTS idx_financial_intake_hash
  ON financial_intake_items(file_hash);
CREATE INDEX IF NOT EXISTS idx_financial_intake_kind
  ON financial_intake_items(document_kind);

CREATE TABLE IF NOT EXISTS financial_close_periods (
  id serial PRIMARY KEY,
  period_key varchar(7) NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  official_fx_rate_id integer REFERENCES exchange_rates(id) ON DELETE SET NULL,
  checklist_version integer NOT NULL DEFAULT 1,
  snapshot_version integer NOT NULL DEFAULT 0,
  notes text,
  requested_by integer REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamp,
  closed_by integer REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamp,
  reopened_by integer REFERENCES users(id) ON DELETE SET NULL,
  reopened_at timestamp,
  reopen_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT financial_close_period_key_check
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT financial_close_status_check
    CHECK (status IN ('OPEN', 'PRE_CLOSE', 'IN_REVIEW', 'CLOSED', 'REOPENED'))
);

CREATE INDEX IF NOT EXISTS idx_financial_close_status
  ON financial_close_periods(status, period_key);

CREATE TABLE IF NOT EXISTS financial_close_checks (
  id serial PRIMARY KEY,
  close_period_id integer NOT NULL REFERENCES financial_close_periods(id) ON DELETE CASCADE,
  code varchar(80) NOT NULL,
  severity varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  title varchar(255) NOT NULL,
  detail text,
  expected_value numeric(18,4),
  actual_value numeric(18,4),
  delta numeric(18,4),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution text,
  resolved_by integer REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_financial_close_check UNIQUE(close_period_id, code),
  CONSTRAINT financial_close_check_severity_check
    CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT financial_close_check_status_check
    CHECK (status IN ('pending', 'passed', 'failed', 'accepted', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_financial_close_check_status
  ON financial_close_checks(close_period_id, status, severity);

CREATE TABLE IF NOT EXISTS financial_audit_events (
  id serial PRIMARY KEY,
  period_key varchar(7),
  entity_type varchar(60) NOT NULL,
  entity_id integer,
  action varchar(60) NOT NULL,
  before_data jsonb,
  after_data jsonb,
  intake_item_id integer REFERENCES financial_intake_items(id) ON DELETE SET NULL,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_entity
  ON financial_audit_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_financial_audit_period
  ON financial_audit_events(period_key, created_at);
