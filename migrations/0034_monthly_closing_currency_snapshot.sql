-- Persist the exact invoice-currency split used by Cierre Mensual.
-- `total_cost` remains the legacy ARS-equivalent total for compatibility.
ALTER TABLE monthly_closings
  ADD COLUMN IF NOT EXISTS billing_currency TEXT NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS usd_billing_fraction DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_ars DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS total_cost_usd DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS grand_total_ars DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS grand_total_usd DOUBLE PRECISION;

UPDATE monthly_closings
SET total_cost_ars = COALESCE(total_cost_ars, total_cost),
    total_cost_usd = COALESCE(total_cost_usd, 0),
    grand_total_ars = COALESCE(grand_total_ars, total_cost),
    grand_total_usd = COALESCE(grand_total_usd, 0)
WHERE total_cost_ars IS NULL
   OR total_cost_usd IS NULL
   OR grand_total_ars IS NULL
   OR grand_total_usd IS NULL;
