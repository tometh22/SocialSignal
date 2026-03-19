-- Add missing Looker Studio fields to monthly_financial_summary
ALTER TABLE monthly_financial_summary
  ADD COLUMN IF NOT EXISTS margen_operativo numeric(8, 4),
  ADD COLUMN IF NOT EXISTS margen_neto numeric(8, 4),
  ADD COLUMN IF NOT EXISTS proyeccion_resultado numeric(14, 2),
  ADD COLUMN IF NOT EXISTS balance_60_dias numeric(14, 2);
