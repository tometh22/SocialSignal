/** Runtime copy of migrations/0055_canonical_quotation_roles.sql. */
export const canonicalQuotationRolesMigrationSql = String.raw`
-- Roles del cotizador alineados con la escala de Personal.
--
-- Vicky pidió que el rol de una cotización lea "04 Lead A" y refleje la lógica
-- de Roles, y que "Account Director" no aparezca porque no existe ese rol. El
-- área se suma para desambiguar: sin ella un "04 Lead A" de Operaciones y uno
-- de DataTech serían el mismo rol y las recetas no podrían repartir horas por
-- función.
--
-- Aditiva e idempotente. No borra filas: los roles del catálogo viejo se
-- retiran con is_active = FALSE porque las cotizaciones históricas los siguen
-- referenciando por id.

ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_level TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS sublevel  TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS area      TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 1. Materializar un rol canónico por cada clasificación que exista realmente
--    en Personal. No se generan las ~44 combinaciones teóricas: sólo las que
--    el equipo tiene hoy.
INSERT INTO roles (name, description, default_rate, default_rate_usd, role_level, sublevel, area, is_active)
SELECT DISTINCT
  CONCAT(
    regexp_replace(p.current_role, '^(\d)\s', '0\1 '),
    ' ', p.sublevel,
    ' · ', p.area
  ) AS name,
  'Rol canónico derivado de la clasificación de Personal' AS description,
  0 AS default_rate,
  0 AS default_rate_usd,
  p.current_role,
  p.sublevel,
  p.area,
  TRUE
FROM personnel p
WHERE COALESCE(NULLIF(TRIM(p.current_role), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM(p.sublevel), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM(p.area), ''), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.role_level = p.current_role
      AND r.sublevel   = p.sublevel
      AND r.area       = p.area
  );

-- 2. Reapuntar cada persona a su rol canónico. \`personnel.role_id\` sigue siendo
--    NOT NULL y lo usan cotizaciones y plantillas, así que nunca queda huérfano.
UPDATE personnel p
SET role_id = r.id
FROM roles r
WHERE r.role_level = p.current_role
  AND r.sublevel   = p.sublevel
  AND r.area       = p.area
  AND p.role_id IS DISTINCT FROM r.id;

-- 3. Retirar del catálogo los roles sin clasificación canónica. Dejan de
--    ofrecerse en cotizaciones nuevas; las históricas los siguen resolviendo.
UPDATE roles
SET is_active = FALSE
WHERE role_level IS NULL
  AND is_active = TRUE;
`;
