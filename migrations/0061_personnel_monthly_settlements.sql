CREATE TABLE IF NOT EXISTS personnel_monthly_settlements (
  id serial PRIMARY KEY,
  personnel_id integer NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  period varchar(7) NOT NULL,
  contract_type_snapshot varchar(20) NOT NULL,
  billing_currency_snapshot varchar(10) NOT NULL,
  hours_snapshot double precision NOT NULL,
  hourly_rate_ars_snapshot double precision NOT NULL,
  total_ars double precision NOT NULL,
  usd_percentage double precision NOT NULL DEFAULT 0,
  planned_usd_ars double precision NOT NULL DEFAULT 0,
  bonus_usd double precision NOT NULL DEFAULT 0,
  extras_ars double precision NOT NULL DEFAULT 0,
  invoice_fx double precision,
  base_invoice_usd double precision,
  total_invoice_usd double precision,
  received_fx double precision,
  bank_commission_usd double precision NOT NULL DEFAULT 0,
  pesified_base_ars double precision,
  final_invoice_ars double precision,
  admin_notes text,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_by integer REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT personnel_monthly_settlements_person_period_unique UNIQUE(personnel_id, period),
  CONSTRAINT personnel_monthly_settlements_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT personnel_monthly_settlements_percentage_check CHECK (usd_percentage >= 0 AND usd_percentage <= 100),
  CONSTRAINT personnel_monthly_settlements_status_check CHECK (status IN ('draft', 'published'))
);

CREATE INDEX IF NOT EXISTS personnel_monthly_settlements_period_status_idx
  ON personnel_monthly_settlements(period, status);

ALTER TABLE personal_monthly_invoices
  ADD COLUMN IF NOT EXISTS settlement_id integer REFERENCES personnel_monthly_settlements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supporting_files jsonb NOT NULL DEFAULT '[]'::jsonb;
