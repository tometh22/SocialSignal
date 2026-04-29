-- Aliases para mapear nombres de personas que aparecen en el Google Sheet
-- "Valor Hora Real y Estimada" hacia rows de personnel.
--
-- personnel_id = NULL  →  el row del sheet se ignora en futuras sincronizaciones
-- personnel_id = <id>  →  el row del sheet se mapea a esa persona
--
-- Si un sheet_name no aparece acá pero matchea exacto contra personnel.name,
-- el sync los une automáticamente sin necesidad de un alias explícito.

BEGIN;

CREATE TABLE IF NOT EXISTS sheet_personnel_aliases (
  id SERIAL PRIMARY KEY,
  sheet_name TEXT NOT NULL UNIQUE,
  personnel_id INTEGER REFERENCES personnel(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheet_aliases_personnel
  ON sheet_personnel_aliases(personnel_id);

COMMIT;
