ALTER TABLE personal_monthly_invoices
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS file_hash varchar(64),
  ADD COLUMN IF NOT EXISTS invoice_number varchar(120),
  ADD COLUMN IF NOT EXISTS issue_date timestamp,
  ADD COLUMN IF NOT EXISTS invoice_currency varchar(3),
  ADD COLUMN IF NOT EXISTS declared_invoice_amount double precision,
  ADD COLUMN IF NOT EXISTS extraction_provider varchar(40),
  ADD COLUMN IF NOT EXISTS extraction_model varchar(120),
  ADD COLUMN IF NOT EXISTS extraction_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS personal_invoice_project_allocations (
  id serial PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES personal_monthly_invoices(id) ON DELETE CASCADE,
  project_id integer NOT NULL REFERENCES active_projects(id) ON DELETE RESTRICT,
  hours double precision NOT NULL DEFAULT 0,
  allocation_percent numeric(7,4) NOT NULL,
  computed_cost_ars double precision,
  computed_cost_usd double precision,
  allocated_invoice_amount double precision,
  invoice_currency varchar(3),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT personal_invoice_project_allocations_unique UNIQUE(invoice_id, project_id),
  CONSTRAINT personal_invoice_project_allocation_percent_check CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  CONSTRAINT personal_invoice_project_allocation_currency_check CHECK (invoice_currency IS NULL OR invoice_currency IN ('ARS', 'USD'))
);

CREATE INDEX IF NOT EXISTS idx_pipa_invoice ON personal_invoice_project_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pipa_project ON personal_invoice_project_allocations(project_id);
