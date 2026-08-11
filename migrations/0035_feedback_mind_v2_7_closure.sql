-- Feedback Mind V2.7: cierre de moneda contractual, metadatos de rol y horas nativas.
-- Todos los cambios son idempotentes y preservan configuraciones explícitas existentes.

CREATE UNIQUE INDEX IF NOT EXISTS system_config_config_key_unique
  ON system_config(config_key);

UPDATE personnel_historical_costs cost
SET hourly_rate_usd = cost.hourly_rate_ars,
    hourly_rate_ars = NULL,
    updated_at = NOW()
FROM personnel person
WHERE person.id = cost.personnel_id
  AND UPPER(COALESCE(person.billing_currency, 'ARS')) = 'USD'
  AND cost.is_active = true
  AND cost.hourly_rate_usd IS NULL
  AND cost.hourly_rate_ars > 0
  AND cost.hourly_rate_ars <= 100;

UPDATE personnel person
SET "current_role" = role.name
FROM roles role
WHERE role.id = person.role_id
  AND person.contract_type <> 'freelance'
  AND (person."current_role" IS NULL OR BTRIM(person."current_role") = '' OR LOWER(BTRIM(person."current_role")) = 'postgres');

UPDATE personnel person
SET "current_role" = NULL,
    "legacy_role" = role.name
FROM roles role
WHERE role.id = person.role_id
  AND person.contract_type = 'freelance'
  AND (person."legacy_role" IS NULL OR BTRIM(person."legacy_role") = '' OR LOWER(BTRIM(person."legacy_role")) = 'postgres');

UPDATE personnel person
SET "sublevel" = CASE
      WHEN role.name ILIKE '%semi senior%' THEN 'Semi Senior'
      WHEN role.name ILIKE '%senior%' THEN 'Senior'
      WHEN role.name ILIKE '%junior%' THEN 'Junior'
      WHEN role.name ILIKE '%lead%' THEN 'Lead'
      WHEN role.name ILIKE '%director%' THEN 'Director'
      ELSE person."sublevel"
    END
FROM roles role
WHERE role.id = person.role_id
  AND (person."sublevel" IS NULL OR BTRIM(person."sublevel") = '')
  AND (
    role.name ILIKE '%semi senior%'
    OR role.name ILIKE '%senior%'
    OR role.name ILIKE '%junior%'
    OR role.name ILIKE '%lead%'
    OR role.name ILIKE '%director%'
  );

INSERT INTO system_config(config_key, config_value, description)
SELECT 'hours_data_source', 1, 'Fuente nativa de horas de la aplicación'
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'hours_data_source');

INSERT INTO system_config(config_key, config_value, description)
SELECT 'app_mode_cutover_date', 1, '2026-08'
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'app_mode_cutover_date');
