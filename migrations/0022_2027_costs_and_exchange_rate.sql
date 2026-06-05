-- Columnas de costos históricos 2027 en tabla personnel
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jan_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jan_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jan_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "feb_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "feb_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "feb_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "mar_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "mar_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "mar_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "apr_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "apr_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "apr_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "may_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "may_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "may_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jun_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jun_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jun_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jul_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jul_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "jul_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "aug_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "aug_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "aug_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "sep_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "sep_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "sep_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "oct_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "oct_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "oct_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "nov_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "nov_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "nov_2027_monthly_salary_ars" double precision;

ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "dec_2027_contract_type" text;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "dec_2027_hourly_rate_ars" double precision;
ALTER TABLE "personnel" ADD COLUMN IF NOT EXISTS "dec_2027_monthly_salary_ars" double precision;

-- Tipo de cambio al momento del cierre mensual (auditoría)
ALTER TABLE "monthly_closings" ADD COLUMN IF NOT EXISTS "exchange_rate_at_close" double precision;
