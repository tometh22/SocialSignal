CREATE TABLE IF NOT EXISTS "fact_estimated_cost_month" (
  "id" serial PRIMARY KEY NOT NULL,
  "month_key" varchar(7) NOT NULL,
  "year" integer NOT NULL,
  "billing_year" integer,
  "detalle" varchar(255),
  "subtipo_costo" varchar(255),
  "puesto" varchar(255),
  "horas_unidades" numeric(10, 2),
  "valor_hora" numeric(12, 4),
  "moneda_original_ars" numeric(14, 2),
  "moneda_original_usd" numeric(14, 4),
  "cotizacion" numeric(10, 4),
  "monto_total_usd" numeric(14, 4),
  "pasado_futuro" varchar(50),
  "loaded_at" timestamp NOT NULL DEFAULT now(),
  "source_run_id" varchar(100)
);
CREATE INDEX IF NOT EXISTS "fact_estimated_cost_month_month_key_idx" ON "fact_estimated_cost_month" ("month_key");
