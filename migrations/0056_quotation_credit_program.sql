-- 0056 — Configuración comercial persistente para cotizaciones por créditos.
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS credit_program jsonb;

UPDATE quotations
SET credit_program = '{}'::jsonb
WHERE credit_program IS NULL;
