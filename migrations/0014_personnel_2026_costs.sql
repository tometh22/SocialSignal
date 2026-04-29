-- Add 2026 monthly historical cost columns to personnel
-- Mirrors the 2025 columns added in 0002_new_terrax.sql so analysts can
-- record salaries / rates per month in 2026 (admin → costos históricos).

BEGIN;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jan_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jan_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jan_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "feb_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "feb_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "feb_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "mar_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "mar_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "mar_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "apr_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "apr_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "apr_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "may_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "may_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "may_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jun_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jun_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jun_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jul_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jul_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jul_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "aug_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "aug_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "aug_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "sep_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "sep_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "sep_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "oct_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "oct_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "oct_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "nov_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "nov_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "nov_2026_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "dec_2026_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "dec_2026_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "dec_2026_monthly_salary_ars" double precision;

-- Mes histórico de salarios a usar para nuevas filas de equipo en la cotización.
-- NULL = "más reciente disponible". Formato: 'mmmYYYY' (ej. 'aug2025').
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "salary_month" text;

COMMIT;
