export const professionalQuotationStudioMigrationSql = String.raw`
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
  ADD COLUMN IF NOT EXISTS service_blueprint_id integer REFERENCES service_blueprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_blueprint_version integer,
  ADD COLUMN IF NOT EXISTS commercial_motion varchar(30) NOT NULL DEFAULT 'new_business',
  ADD COLUMN IF NOT EXISTS scope_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS decision_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operational_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS effort_override_reason text;
ALTER TABLE quotation_variants
  ADD COLUMN IF NOT EXISTS scope_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;
UPDATE quotation_variants SET is_legacy = true WHERE scope_snapshot IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotation_variants_one_recommended_idx ON quotation_variants(quotation_id) WHERE is_recommended = true;
CREATE TABLE IF NOT EXISTS proposal_documents (
  id serial PRIMARY KEY,
  quotation_id integer NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_id integer REFERENCES quotation_revisions(id) ON DELETE CASCADE,
  locale varchar(5) NOT NULL DEFAULT 'es',
  content jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  source_document_hash varchar(64),
  qa_status varchar(20) NOT NULL DEFAULT 'pending',
  qa_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  warning_override_reason text,
  is_stale boolean NOT NULL DEFAULT false,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT proposal_documents_quotation_locale_unique UNIQUE(quotation_id, locale)
);
CREATE TABLE IF NOT EXISTS proposal_assets (
  id serial PRIMARY KEY,
  quotation_id integer NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  document_id integer REFERENCES proposal_documents(id) ON DELETE CASCADE,
  asset_type varchar(30) NOT NULL,
  storage_url text NOT NULL,
  alt_text varchar(500),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS proposal_agent_runs (
  id serial PRIMARY KEY,
  quotation_id integer NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  document_id integer NOT NULL REFERENCES proposal_documents(id) ON DELETE CASCADE,
  model varchar(120) NOT NULL,
  prompt_hash varchar(64) NOT NULL,
  requested_operation varchar(80) NOT NULL,
  proposed_patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_patch jsonb,
  input_tokens integer,
  output_tokens integer,
  status varchar(30) NOT NULL,
  error_message text,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  decided_at timestamp
);
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS source_scope_item_id varchar(80),
  ADD COLUMN IF NOT EXISTS acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_definition jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS deliverables_project_scope_item_unique
  ON deliverables(project_id, source_scope_item_id)
  WHERE project_id IS NOT NULL AND source_scope_item_id IS NOT NULL;
`;
