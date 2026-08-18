-- Feedback Mind V2-10: operational workflow and post-closing invoice review.

ALTER TABLE active_projects
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT;

UPDATE active_projects
SET workflow_stage = CASE
  WHEN status = 'active' THEN 'empezado'
  WHEN status = 'on-hold' THEN 'bloqueado'
  WHEN status IN ('delivered', 'invoiced', 'completed', 'cancelled', 'voided') THEN 'finalizado'
  ELSE 'aprobado'
END
WHERE workflow_stage IS NULL;

ALTER TABLE active_projects
  ALTER COLUMN workflow_stage SET DEFAULT 'aprobado',
  ALTER COLUMN workflow_stage SET NOT NULL;

ALTER TABLE personal_monthly_invoices
  ADD COLUMN IF NOT EXISTS suggested_invoice_usd DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS declared_invoice_usd DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS bank_fx DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS difference_usd DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

CREATE INDEX IF NOT EXISTS personal_monthly_invoices_approval_idx
  ON personal_monthly_invoices(approval_status, period);
