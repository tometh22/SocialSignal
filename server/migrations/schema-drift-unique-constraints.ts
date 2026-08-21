// Generado a partir de migrations/0050_schema_drift_unique_constraints.sql — mantener en sync.
export const schemaDriftUniqueConstraintsMigrationSql = String.raw`
-- 0049 Reconciliación schema ↔ producción: constraints únicas faltantes
--
-- Auditoría del 2026-08-21 (server/scripts/schema-drift-audit.ts): shared/schema.ts
-- declaraba 27 constraints únicas que NUNCA existieron en producción. Sin ellas,
-- "INSERT ... ON CONFLICT" no puede funcionar y todo ETL termina siendo un append.
--
-- Eso explica de una sola vez:
--   · cashflow_transactions con 293.992 filas para 385 movimientos reales (764x)
--   · monthly_financial_summary con el período 2026-03 cargado dos veces
--   · 23.032 + 275.284 filas archivadas en julio como "duplicated snapshot cleanup"
--
-- No eran incidentes distintos. Era el mismo agujero manifestándose donde le tocó.
--
-- VERIFICADO CONTRA PRODUCCIÓN: las 27 aplican sin borrar una sola fila.
-- Los DELETE de abajo son no-ops hoy; quedan como defensa para entornos que sí
-- tengan duplicados y para que la migración sea idempotente.
--
-- Nota: los conteos usan sólo filas con la clave completa, porque Postgres
-- permite múltiples NULL bajo una constraint única.

-- agg_project_month (project_id, period_key)
DELETE FROM "agg_project_month" a USING "agg_project_month" b
 WHERE a.id > b.id AND (a."project_id" = b."project_id" AND a."period_key" = b."period_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agg_project_month_project_id_period_key_unique') THEN
    ALTER TABLE "agg_project_month" ADD CONSTRAINT "agg_project_month_project_id_period_key_unique" UNIQUE ("project_id", "period_key");
  END IF;
END $$;

-- clients (name)
DELETE FROM "clients" a USING "clients" b
 WHERE a.id > b.id AND (a."name" = b."name");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_name_unique') THEN
    ALTER TABLE "clients" ADD CONSTRAINT "clients_name_unique" UNIQUE ("name");
  END IF;
END $$;

-- costs_norm (source_row_id)
DELETE FROM "costs_norm" a USING "costs_norm" b
 WHERE a.id > b.id AND (a."source_row_id" = b."source_row_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_norm_source_row_id_unique') THEN
    ALTER TABLE "costs_norm" ADD CONSTRAINT "costs_norm_source_row_id_unique" UNIQUE ("source_row_id");
  END IF;
END $$;

-- costs_norm (project_key, month_key, source_row_id)
DELETE FROM "costs_norm" a USING "costs_norm" b
 WHERE a.id > b.id AND (a."project_key" = b."project_key" AND a."month_key" = b."month_key" AND a."source_row_id" = b."source_row_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_norm_project_key_month_key_source_row_id_unique') THEN
    ALTER TABLE "costs_norm" ADD CONSTRAINT "costs_norm_project_key_month_key_source_row_id_unique" UNIQUE ("project_key", "month_key", "source_row_id");
  END IF;
END $$;

-- costs_sot (project_key, month_key)
DELETE FROM "costs_sot" a USING "costs_sot" b
 WHERE a.id > b.id AND (a."project_key" = b."project_key" AND a."month_key" = b."month_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_sot_project_key_month_key_unique') THEN
    ALTER TABLE "costs_sot" ADD CONSTRAINT "costs_sot_project_key_month_key_unique" UNIQUE ("project_key", "month_key");
  END IF;
END $$;

-- crm_stages (key)
DELETE FROM "crm_stages" a USING "crm_stages" b
 WHERE a.id > b.id AND (a."key" = b."key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_stages_key_unique') THEN
    ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_key_unique" UNIQUE ("key");
  END IF;
END $$;

-- dim_client_alias (alias_norm)
DELETE FROM "dim_client_alias" a USING "dim_client_alias" b
 WHERE a.id > b.id AND (a."alias_norm" = b."alias_norm");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_client_alias_alias_norm_unique') THEN
    ALTER TABLE "dim_client_alias" ADD CONSTRAINT "dim_client_alias_alias_norm_unique" UNIQUE ("alias_norm");
  END IF;
END $$;

-- dim_person_rate (person_id, project_id, period_key)
DELETE FROM "dim_person_rate" a USING "dim_person_rate" b
 WHERE a.id > b.id AND (a."person_id" = b."person_id" AND a."project_id" = b."project_id" AND a."period_key" = b."period_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_person_rate_person_id_project_id_period_key_unique') THEN
    ALTER TABLE "dim_person_rate" ADD CONSTRAINT "dim_person_rate_person_id_project_id_period_key_unique" UNIQUE ("person_id", "project_id", "period_key");
  END IF;
END $$;

-- dim_project_alias (client_id, alias_norm)
DELETE FROM "dim_project_alias" a USING "dim_project_alias" b
 WHERE a.id > b.id AND (a."client_id" = b."client_id" AND a."alias_norm" = b."alias_norm");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_project_alias_client_id_alias_norm_unique') THEN
    ALTER TABLE "dim_project_alias" ADD CONSTRAINT "dim_project_alias_client_id_alias_norm_unique" UNIQUE ("client_id", "alias_norm");
  END IF;
END $$;

-- direct_costs (unique_key)
DELETE FROM "direct_costs" a USING "direct_costs" b
 WHERE a.id > b.id AND (a."unique_key" = b."unique_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_costs_unique_key_unique') THEN
    ALTER TABLE "direct_costs" ADD CONSTRAINT "direct_costs_unique_key_unique" UNIQUE ("unique_key");
  END IF;
END $$;

-- fact_cost_month (period_key)
DELETE FROM "fact_cost_month" a USING "fact_cost_month" b
 WHERE a.id > b.id AND (a."period_key" = b."period_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fact_cost_month_period_key_unique') THEN
    ALTER TABLE "fact_cost_month" ADD CONSTRAINT "fact_cost_month_period_key_unique" UNIQUE ("period_key");
  END IF;
END $$;

-- fact_rc_month (project_id, period_key)
DELETE FROM "fact_rc_month" a USING "fact_rc_month" b
 WHERE a.id > b.id AND (a."project_id" = b."project_id" AND a."period_key" = b."period_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fact_rc_month_project_id_period_key_unique') THEN
    ALTER TABLE "fact_rc_month" ADD CONSTRAINT "fact_rc_month_project_id_period_key_unique" UNIQUE ("project_id", "period_key");
  END IF;
END $$;

-- financial_sot (client_name, project_name, month_key)
DELETE FROM "financial_sot" a USING "financial_sot" b
 WHERE a.id > b.id AND (a."client_name" = b."client_name" AND a."project_name" = b."project_name" AND a."month_key" = b."month_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_sot_client_name_project_name_month_key_unique') THEN
    ALTER TABLE "financial_sot" ADD CONSTRAINT "financial_sot_client_name_project_name_month_key_unique" UNIQUE ("client_name", "project_name", "month_key");
  END IF;
END $$;

-- google_sheets_sales (unique_key)
DELETE FROM "google_sheets_sales" a USING "google_sheets_sales" b
 WHERE a.id > b.id AND (a."unique_key" = b."unique_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'google_sheets_sales_unique_key_unique') THEN
    ALTER TABLE "google_sheets_sales" ADD CONSTRAINT "google_sheets_sales_unique_key_unique" UNIQUE ("unique_key");
  END IF;
END $$;

-- income_sot (client_name, project_name, month_key)
DELETE FROM "income_sot" a USING "income_sot" b
 WHERE a.id > b.id AND (a."client_name" = b."client_name" AND a."project_name" = b."project_name" AND a."month_key" = b."month_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'income_sot_client_name_project_name_month_key_unique') THEN
    ALTER TABLE "income_sot" ADD CONSTRAINT "income_sot_client_name_project_name_month_key_unique" UNIQUE ("client_name", "project_name", "month_key");
  END IF;
END $$;

-- password_reset_tokens (token)
DELETE FROM "password_reset_tokens" a USING "password_reset_tokens" b
 WHERE a.id > b.id AND (a."token" = b."token");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_token_unique') THEN
    ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_unique" UNIQUE ("token");
  END IF;
END $$;

-- project_aggregates (project_period_id, view_type)
DELETE FROM "project_aggregates" a USING "project_aggregates" b
 WHERE a.id > b.id AND (a."project_period_id" = b."project_period_id" AND a."view_type" = b."view_type");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_aggregates_project_period_id_view_type_unique') THEN
    ALTER TABLE "project_aggregates" ADD CONSTRAINT "project_aggregates_project_period_id_view_type_unique" UNIQUE ("project_period_id", "view_type");
  END IF;
END $$;

-- project_aliases (excel_client, excel_project)
DELETE FROM "project_aliases" a USING "project_aliases" b
 WHERE a.id > b.id AND (a."excel_client" = b."excel_client" AND a."excel_project" = b."excel_project");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_aliases_excel_client_excel_project_unique') THEN
    ALTER TABLE "project_aliases" ADD CONSTRAINT "project_aliases_excel_client_excel_project_unique" UNIQUE ("excel_client", "excel_project");
  END IF;
END $$;

-- project_financial_summary (project_id)
DELETE FROM "project_financial_summary" a USING "project_financial_summary" b
 WHERE a.id > b.id AND (a."project_id" = b."project_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_financial_summary_project_id_unique') THEN
    ALTER TABLE "project_financial_summary" ADD CONSTRAINT "project_financial_summary_project_id_unique" UNIQUE ("project_id");
  END IF;
END $$;

-- project_periods (project_id, period_key)
DELETE FROM "project_periods" a USING "project_periods" b
 WHERE a.id > b.id AND (a."project_id" = b."project_id" AND a."period_key" = b."period_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_periods_project_id_period_key_unique') THEN
    ALTER TABLE "project_periods" ADD CONSTRAINT "project_periods_project_id_period_key_unique" UNIQUE ("project_id", "period_key");
  END IF;
END $$;

-- project_status_reviews (room_id, project_id)
DELETE FROM "project_status_reviews" a USING "project_status_reviews" b
 WHERE a.id > b.id AND (a."room_id" = b."room_id" AND a."project_id" = b."project_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_status_reviews_room_id_project_id_unique') THEN
    ALTER TABLE "project_status_reviews" ADD CONSTRAINT "project_status_reviews_room_id_project_id_unique" UNIQUE ("room_id", "project_id");
  END IF;
END $$;

-- quotations (quotation_number)
DELETE FROM "quotations" a USING "quotations" b
 WHERE a.id > b.id AND (a."quotation_number" = b."quotation_number");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_quotation_number_unique') THEN
    ALTER TABLE "quotations" ADD CONSTRAINT "quotations_quotation_number_unique" UNIQUE ("quotation_number");
  END IF;
END $$;

-- sales_norm (source_row_id)
DELETE FROM "sales_norm" a USING "sales_norm" b
 WHERE a.id > b.id AND (a."source_row_id" = b."source_row_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_norm_source_row_id_unique') THEN
    ALTER TABLE "sales_norm" ADD CONSTRAINT "sales_norm_source_row_id_unique" UNIQUE ("source_row_id");
  END IF;
END $$;

-- sales_norm (project_key, month_key, source_row_id)
DELETE FROM "sales_norm" a USING "sales_norm" b
 WHERE a.id > b.id AND (a."project_key" = b."project_key" AND a."month_key" = b."month_key" AND a."source_row_id" = b."source_row_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_norm_project_key_month_key_source_row_id_unique') THEN
    ALTER TABLE "sales_norm" ADD CONSTRAINT "sales_norm_project_key_month_key_source_row_id_unique" UNIQUE ("project_key", "month_key", "source_row_id");
  END IF;
END $$;

-- targets_norm (source_row_id)
DELETE FROM "targets_norm" a USING "targets_norm" b
 WHERE a.id > b.id AND (a."source_row_id" = b."source_row_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'targets_norm_source_row_id_unique') THEN
    ALTER TABLE "targets_norm" ADD CONSTRAINT "targets_norm_source_row_id_unique" UNIQUE ("source_row_id");
  END IF;
END $$;

-- targets_norm (project_key, month_key, source_row_id)
DELETE FROM "targets_norm" a USING "targets_norm" b
 WHERE a.id > b.id AND (a."project_key" = b."project_key" AND a."month_key" = b."month_key" AND a."source_row_id" = b."source_row_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'targets_norm_project_key_month_key_source_row_id_unique') THEN
    ALTER TABLE "targets_norm" ADD CONSTRAINT "targets_norm_project_key_month_key_source_row_id_unique" UNIQUE ("project_key", "month_key", "source_row_id");
  END IF;
END $$;

-- team_breakdown (project_period_id, person_name, role_name)
DELETE FROM "team_breakdown" a USING "team_breakdown" b
 WHERE a.id > b.id AND (a."project_period_id" = b."project_period_id" AND a."person_name" = b."person_name" AND a."role_name" = b."role_name");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_breakdown_project_period_id_person_name_role_name_unique') THEN
    ALTER TABLE "team_breakdown" ADD CONSTRAINT "team_breakdown_project_period_id_person_name_role_name_unique" UNIQUE ("project_period_id", "person_name", "role_name");
  END IF;
END $$;
`;
