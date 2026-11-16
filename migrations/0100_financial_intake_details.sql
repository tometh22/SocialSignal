-- Carga financiera: detalles que el Máster tenía y Mind no.
-- "Costo Marketing" en pasivos y "Ajuste" de ventas.
ALTER TABLE pasivo_entries ADD COLUMN IF NOT EXISTS is_marketing boolean NOT NULL DEFAULT false;
ALTER TABLE revenue_events
  ADD COLUMN IF NOT EXISTS adjustment_amount_usd numeric(14,2),
  ADD COLUMN IF NOT EXISTS adjustment_note text;
