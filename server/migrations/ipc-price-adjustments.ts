// Generado a partir de migrations/0054_ipc_price_adjustments.sql — mantener en sync.
export const ipcPriceAdjustmentsMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS ipc_index_values (
  id serial PRIMARY KEY,
  year integer NOT NULL,
  month integer NOT NULL,
  monthly_percentage numeric(6,3) NOT NULL,
  source varchar(60) NOT NULL DEFAULT 'ArgentinaDatos',
  fetched_at timestamp NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT ipc_index_values_year_month_source_unique UNIQUE(year, month, source)
);

CREATE TABLE IF NOT EXISTS quotation_price_adjustments (
  id serial PRIMARY KEY,
  quotation_id integer NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  cadence varchar(20) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  ipc_accumulated_percentage double precision NOT NULL,
  previous_total_amount double precision NOT NULL,
  proposed_total_amount double precision NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending_approval',
  reviewed_by integer REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  review_notes text,
  email_sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT quotation_price_adjustments_quotation_period_unique UNIQUE(quotation_id, period_start)
);
CREATE INDEX IF NOT EXISTS quotation_price_adjustments_status_idx ON quotation_price_adjustments(status);
CREATE INDEX IF NOT EXISTS quotation_price_adjustments_quotation_idx ON quotation_price_adjustments(quotation_id);
CREATE UNIQUE INDEX IF NOT EXISTS quotation_price_adjustments_one_pending_per_quotation
  ON quotation_price_adjustments(quotation_id)
  WHERE status = 'pending_approval';
`;
