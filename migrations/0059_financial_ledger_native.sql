-- Modelo operativo nativo para cuentas, documentos, pagos parciales y provisiones.

CREATE TABLE IF NOT EXISTS financial_accounts (
  id serial PRIMARY KEY,
  name varchar(120) NOT NULL,
  bank_name varchar(120),
  account_type varchar(30) NOT NULL DEFAULT 'bank',
  currency varchar(3) NOT NULL DEFAULT 'USD',
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  opening_balance_date timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_financial_account_name_currency UNIQUE(name, currency)
);

ALTER TABLE activo_entries
  ADD COLUMN IF NOT EXISTS detalle text,
  ADD COLUMN IF NOT EXISTS project_id integer REFERENCES active_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type varchar(30) NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS currency varchar(3),
  ADD COLUMN IF NOT EXISTS original_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS net_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS gross_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS outstanding_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS source varchar(40) NOT NULL DEFAULT 'excel',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamp,
  ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text;

UPDATE activo_entries
SET currency = CASE WHEN monto_usd IS NOT NULL THEN 'USD' WHEN monto_ars IS NOT NULL THEN 'ARS' ELSE currency END,
    original_amount = COALESCE(original_amount, monto_usd, monto_ars),
    gross_amount = COALESCE(gross_amount, monto_usd, monto_ars),
    outstanding_amount = COALESCE(outstanding_amount, CASE WHEN cobrado_al_cierre THEN 0 ELSE COALESCE(monto_usd, monto_ars) END),
    status = CASE WHEN cobrado_al_cierre THEN 'PAID' WHEN vencido THEN 'OVERDUE' ELSE status END
WHERE original_amount IS NULL OR outstanding_amount IS NULL;

ALTER TABLE pasivo_entries
  ADD COLUMN IF NOT EXISTS document_number varchar(100),
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS project_id integer REFERENCES active_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency varchar(3),
  ADD COLUMN IF NOT EXISTS original_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS net_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS gross_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS outstanding_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS cost_treatment varchar(20) NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS source varchar(40) NOT NULL DEFAULT 'excel',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamp,
  ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text;

UPDATE pasivo_entries
SET vendor_name = COALESCE(vendor_name, detalle),
    currency = CASE WHEN monto_usd IS NOT NULL THEN 'USD' WHEN monto_ars IS NOT NULL THEN 'ARS' ELSE currency END,
    original_amount = COALESCE(original_amount, monto_usd, monto_ars),
    gross_amount = COALESCE(gross_amount, monto_usd, monto_ars),
    outstanding_amount = COALESCE(outstanding_amount, CASE WHEN pagado_al_cierre THEN 0 ELSE COALESCE(monto_usd, monto_ars) END),
    status = CASE WHEN pagado_al_cierre THEN 'PAID' WHEN vencido THEN 'OVERDUE' ELSE status END
WHERE original_amount IS NULL OR outstanding_amount IS NULL OR vendor_name IS NULL;

ALTER TABLE provision_entries
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'PROPOSED',
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS approved_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

UPDATE provision_entries
SET remaining_amount = COALESCE(remaining_amount, monto_provision, 0) - COALESCE(unwound_amount, 0)
WHERE remaining_amount IS NULL;

CREATE TABLE IF NOT EXISTS provision_movements (
  id serial PRIMARY KEY,
  provision_id integer NOT NULL REFERENCES provision_entries(id) ON DELETE CASCADE,
  period_key varchar(7) NOT NULL,
  movement_type varchar(20) NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  note text,
  source_cost_id integer,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provision_movement_provision ON provision_movements(provision_id, period_key);

ALTER TABLE cashflow_transactions
  ADD COLUMN IF NOT EXISTS account_id integer REFERENCES financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counterparty text,
  ADD COLUMN IF NOT EXISTS project_id integer REFERENCES active_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source varchar(40) NOT NULL DEFAULT 'excel',
  ADD COLUMN IF NOT EXISTS reconciliation_status varchar(20) NOT NULL DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS transfer_group_id varchar(80),
  ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS voided_at timestamp,
  ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text;

UPDATE cashflow_transactions
SET original_amount = COALESCE(original_amount, CASE WHEN moneda = 'ARS' THEN monto_ars ELSE monto_usd END)
WHERE original_amount IS NULL;

CREATE TABLE IF NOT EXISTS financial_document_applications (
  id serial PRIMARY KEY,
  direction varchar(12) NOT NULL,
  activo_entry_id integer REFERENCES activo_entries(id) ON DELETE CASCADE,
  pasivo_entry_id integer REFERENCES pasivo_entries(id) ON DELETE CASCADE,
  cashflow_transaction_id integer NOT NULL REFERENCES cashflow_transactions(id) ON DELETE CASCADE,
  amount_original numeric(18,2) NOT NULL,
  amount_usd numeric(16,2),
  applied_at timestamp NOT NULL,
  notes text,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  voided_at timestamp,
  voided_by integer REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT financial_application_direction_check CHECK (direction IN ('receivable', 'payable')),
  CONSTRAINT financial_application_one_document_check CHECK (
    (direction = 'receivable' AND activo_entry_id IS NOT NULL AND pasivo_entry_id IS NULL)
    OR (direction = 'payable' AND pasivo_entry_id IS NOT NULL AND activo_entry_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_financial_application_activo ON financial_document_applications(activo_entry_id, applied_at);
CREATE INDEX IF NOT EXISTS idx_financial_application_pasivo ON financial_document_applications(pasivo_entry_id, applied_at);
CREATE INDEX IF NOT EXISTS idx_financial_application_cashflow ON financial_document_applications(cashflow_transaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activo_native_external
  ON activo_entries(source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pasivo_native_external
  ON pasivo_entries(source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashflow_native_external
  ON cashflow_transactions(source, external_id) WHERE external_id IS NOT NULL;
