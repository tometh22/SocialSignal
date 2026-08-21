-- 0052 — Flujo multipropuesta para un mismo cliente.
-- Idempotente para despliegues donde las migraciones también se aplican al iniciar.

CREATE TABLE IF NOT EXISTS quotation_groups (
  id serial PRIMARY KEY,
  group_number varchar(40) UNIQUE,
  name varchar(240) NOT NULL,
  client_id integer NOT NULL REFERENCES clients(id),
  billing_entity_id integer REFERENCES client_billing_entities(id) ON DELETE SET NULL,
  source_lead_id integer REFERENCES crm_leads(id) ON DELETE SET NULL,
  source_type varchar(40) NOT NULL DEFAULT 'meeting_minute',
  source_file_name varchar(255),
  internal_minute text,
  analysis_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token_hash varchar(64),
  public_token_expires_at timestamp,
  idempotency_key_hash varchar(64) UNIQUE,
  archived_at timestamp,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotation_groups_client_idx ON quotation_groups(client_id);
CREATE INDEX IF NOT EXISTS quotation_groups_source_lead_idx ON quotation_groups(source_lead_id);

CREATE TABLE IF NOT EXISTS quotation_group_items (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES quotation_groups(id) ON DELETE CASCADE,
  quotation_id integer NOT NULL UNIQUE REFERENCES quotations(id) ON DELETE CASCADE,
  position integer NOT NULL,
  candidate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_completed_step integer NOT NULL DEFAULT 0,
  started_at timestamp,
  configured_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT quotation_group_items_group_position_unique UNIQUE(group_id, position)
);

CREATE INDEX IF NOT EXISTS quotation_group_items_group_idx ON quotation_group_items(group_id);

CREATE TABLE IF NOT EXISTS quotation_group_deliveries (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES quotation_groups(id) ON DELETE CASCADE,
  recipient_email varchar(255) NOT NULL,
  subject varchar(255) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'queued',
  provider_message_id varchar(255),
  error_message text,
  included_quotation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key_hash varchar(64) UNIQUE,
  sent_at timestamp,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotation_group_deliveries_group_idx ON quotation_group_deliveries(group_id);

ALTER TABLE quotation_deliveries
  ADD COLUMN IF NOT EXISTS group_delivery_id integer REFERENCES quotation_group_deliveries(id) ON DELETE SET NULL;

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS quotation_group_id integer REFERENCES quotation_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opportunity_name varchar(255);

CREATE INDEX IF NOT EXISTS crm_leads_quotation_group_idx ON crm_leads(quotation_group_id);
