-- Agrega columna unresolved_person a fact_labor_month
-- true cuando person_id es NULL y no se pudo resolver la persona desde el Excel
ALTER TABLE fact_labor_month
  ADD COLUMN IF NOT EXISTS unresolved_person BOOLEAN NOT NULL DEFAULT FALSE;

-- Marca filas existentes sin person_id como no resueltas
UPDATE fact_labor_month
SET unresolved_person = TRUE
WHERE person_id IS NULL;
