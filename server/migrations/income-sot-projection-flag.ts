// Generado a partir de migrations/0051_income_sot_projection_flag.sql — mantener en sync.
export const incomeSotProjectionFlagMigrationSql = String.raw`
-- 0051 income_sot: distinguir facturación real de proyección
--
-- El ETL de ingresos filtraba Pasado/Futuro = "Real" y descartaba las 29 filas
-- marcadas "Proyección" de la solapa "Proyectos confirmados y estimados".
-- Entre ellas, la venta a Warner de USD 90.960 de septiembre-2026.
--
-- Consecuencia: income_sot no podía contener facturación futura, que es
-- exactamente lo que necesitan las tres bases de ingreso (revenue_events).
--
-- La solapa distingue DOS dimensiones independientes y el modelo sólo tenía una:
--   Confirmado (Sí/No)        -> ya existe como income_sot.confirmed
--   Pasado/Futuro (Real/Proy) -> no existía; se agrega acá
--
-- Sin esta columna, aceptar las proyecciones mezclaría ejecutado con estimado.

ALTER TABLE income_sot
  ADD COLUMN IF NOT EXISTS is_projection boolean NOT NULL DEFAULT false;

-- Las filas ya cargadas entraron bajo el filtro Pasado/Futuro = "Real",
-- así que todas son reales. El default false ya las deja correctas.

CREATE INDEX IF NOT EXISTS income_sot_projection_idx
  ON income_sot(is_projection, month_key);
`;
