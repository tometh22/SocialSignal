-- 0056 — Configuración comercial persistente para cotizaciones por créditos.
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS credit_program jsonb;

-- Absence of a credit program stays NULL. Legacy {} is accepted on read.
