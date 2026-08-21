// Generado a partir de migrations/0053_fact_estimated_cost_month.sql — mantener en sync.
export const factEstimatedCostMonthMigrationSql = String.raw`
-- 0053 fact_estimated_cost_month: crear la tabla que el schema ya declaraba
--
-- shared/schema.ts la declara y el paso 7 del job diario la escribe
-- (costos-estimados-etl), pero nunca existió en producción. La auditoría de
-- deriva (server/scripts/schema-drift-audit.ts) la venía reportando junto con
-- task_comments.
--
-- Consecuencias mientras no existió:
--   · el paso de Costos estimados del pipeline fallaba en silencio, tragado por
--     su catch;
--   · los detectores zeroed_projection_line y cost_concentration se saltean por
--     falta de tabla (guarda agregada en el commit de detectores resilientes);
--   · la página "Costos YTD y Estimados" del Looker no se puede replicar.
--
-- Es la fuente del ranking de costos proyectados donde se ve que Tomi Criado +
-- Honorarios Oxean + Vicky Puricelli suman 152.622 al año, el 27,7% de la
-- facturación y las tres primeras líneas de costo de la empresa.

CREATE TABLE IF NOT EXISTS fact_estimated_cost_month (
  id serial PRIMARY KEY,
  month_key varchar(7) NOT NULL,
  year integer NOT NULL,
  billing_year integer,
  detalle varchar(255),
  subtipo_costo varchar(255),
  puesto varchar(255),
  horas_unidades numeric(10,2),
  valor_hora numeric(12,4),
  moneda_original_ars numeric(14,2),
  moneda_original_usd numeric(14,4),
  cotizacion numeric(10,4),
  monto_total_usd numeric(14,4),
  pasado_futuro varchar(50),
  loaded_at timestamp NOT NULL DEFAULT now(),
  source_run_id varchar(100)
);

CREATE INDEX IF NOT EXISTS fact_estimated_cost_month_month_key_idx
  ON fact_estimated_cost_month(month_key);

-- El ETL recarga por corrida completa (borra y reinserta por month_key), así que
-- no necesita clave natural. Este índice sostiene ese borrado y las consultas
-- por período de la vista de costos.
CREATE INDEX IF NOT EXISTS fact_estimated_cost_month_detalle_idx
  ON fact_estimated_cost_month(detalle);
`;
