// Generado a partir de migrations/0062_personal_invoice_components.sql — mantener en sync.
export const personalInvoiceComponentsMigrationSql = String.raw`
ALTER TABLE personal_monthly_invoices
  ADD COLUMN IF NOT EXISTS invoice_component varchar(10) NOT NULL DEFAULT 'single';

UPDATE personal_monthly_invoices
SET invoice_component = 'single'
WHERE invoice_component IS NULL OR invoice_component NOT IN ('single', 'usd', 'ars');

ALTER TABLE personal_monthly_invoices
  DROP CONSTRAINT IF EXISTS personal_monthly_invoices_user_period_unique;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'personal_monthly_invoices'::regclass
      AND conname = 'personal_monthly_invoices_user_period_component_unique'
  ) THEN
    ALTER TABLE personal_monthly_invoices
      ADD CONSTRAINT personal_monthly_invoices_user_period_component_unique
      UNIQUE (user_id, period, invoice_component);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'personal_monthly_invoices'::regclass
      AND conname = 'personal_monthly_invoices_component_check'
  ) THEN
    ALTER TABLE personal_monthly_invoices
      ADD CONSTRAINT personal_monthly_invoices_component_check
      CHECK (invoice_component IN ('single', 'usd', 'ars'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS personal_monthly_invoices_period_component_idx
  ON personal_monthly_invoices(period, invoice_component, approval_status);
`;
