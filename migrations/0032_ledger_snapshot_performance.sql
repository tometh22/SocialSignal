-- Ledger snapshot stabilization and reversible cleanup.
-- Application deploy order:
--   1. ship idempotent snapshot writer + paginated readers;
--   2. execute this migration once;
--   3. trigger a fresh Activo/Pasivo sync and validate.

BEGIN;

ALTER TABLE activo_entries ADD COLUMN IF NOT EXISTS source_row_key VARCHAR(80);
ALTER TABLE pasivo_entries ADD COLUMN IF NOT EXISTS source_row_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activo_imported_source
  ON activo_entries(period_key, source_row_key)
  WHERE source_row_key IS NOT NULL AND override_manual = false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pasivo_imported_source
  ON pasivo_entries(period_key, source_row_key)
  WHERE source_row_key IS NOT NULL AND override_manual = false;
CREATE INDEX IF NOT EXISTS idx_activo_period_created
  ON activo_entries(period_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pasivo_period_created
  ON pasivo_entries(period_key, created_at DESC);

CREATE TABLE IF NOT EXISTS activo_entries_archive_202607
  (LIKE activo_entries INCLUDING DEFAULTS INCLUDING GENERATED);
ALTER TABLE activo_entries_archive_202607
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archive_reason TEXT NOT NULL DEFAULT '2026-07 duplicated snapshot cleanup';

CREATE TABLE IF NOT EXISTS pasivo_entries_archive_202607
  (LIKE pasivo_entries INCLUDING DEFAULTS INCLUDING GENERATED);
ALTER TABLE pasivo_entries_archive_202607
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archive_reason TEXT NOT NULL DEFAULT '2026-07 duplicated snapshot cleanup';

CREATE TABLE IF NOT EXISTS ledger_cleanup_runs (
  name TEXT PRIMARY KEY,
  activo_archived INTEGER NOT NULL,
  pasivo_archived INTEGER NOT NULL,
  activo_remaining INTEGER NOT NULL,
  pasivo_remaining INTEGER NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT now()
);

DO $cleanup$
DECLARE
  activo_archived_count INTEGER;
  pasivo_archived_count INTEGER;
  activo_remaining_count INTEGER;
  pasivo_remaining_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM ledger_cleanup_runs
    WHERE name = '0032_ledger_snapshot_performance_202607'
  ) THEN
    RETURN;
  END IF;

  LOCK TABLE activo_entries IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE pasivo_entries IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO activo_entries_archive_202607
  SELECT a.*, now(), '2026-07 duplicated snapshot cleanup'
  FROM activo_entries a
  WHERE a.period_key IN ('2026-06', '2026-07')
    AND COALESCE(a.override_manual, false) = false;
  GET DIAGNOSTICS activo_archived_count = ROW_COUNT;

  INSERT INTO pasivo_entries_archive_202607
  SELECT p.*, now(), '2026-07 duplicated snapshot cleanup'
  FROM pasivo_entries p
  WHERE p.period_key IN ('2026-06', '2026-07')
    AND COALESCE(p.override_manual, false) = false;
  GET DIAGNOSTICS pasivo_archived_count = ROW_COUNT;

  -- June's imported rows were created during July and are an exact false copy.
  DELETE FROM activo_entries
  WHERE period_key = '2026-06' AND COALESCE(override_manual, false) = false;
  DELETE FROM pasivo_entries
  WHERE period_key = '2026-06' AND COALESCE(override_manual, false) = false;

  -- Keep one canonical July row until the first fresh snapshot replaces it.
  WITH grouped AS (
    SELECT
      MIN(id) AS keeper_id,
      BOOL_OR(COALESCE(cobrado_al_cierre, false)) AS any_cobrado,
      ARRAY_AGG(id) AS ids
    FROM activo_entries
    WHERE period_key = '2026-07' AND COALESCE(override_manual, false) = false
    GROUP BY
      concepto, cliente_nombre, monto_ars, monto_usd, cotizacion,
      monto_total_usd, nro_factura, fecha_facturacion, fecha_pago,
      fecha_vencimiento, tipo_activo, razon_social
  )
  UPDATE activo_entries a
  SET cobrado_al_cierre = grouped.any_cobrado, updated_at = now()
  FROM grouped
  WHERE a.id = grouped.keeper_id;

  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          concepto, cliente_nombre, monto_ars, monto_usd, cotizacion,
          monto_total_usd, nro_factura, fecha_facturacion, fecha_pago,
          fecha_vencimiento, tipo_activo, razon_social
        ORDER BY id
      ) AS duplicate_number
    FROM activo_entries
    WHERE period_key = '2026-07' AND COALESCE(override_manual, false) = false
  )
  DELETE FROM activo_entries a
  USING ranked
  WHERE a.id = ranked.id AND ranked.duplicate_number > 1;

  WITH grouped AS (
    SELECT
      MIN(id) AS keeper_id,
      BOOL_OR(COALESCE(pagado_al_cierre, false)) AS any_pagado
    FROM pasivo_entries
    WHERE period_key = '2026-07' AND COALESCE(override_manual, false) = false
    GROUP BY
      detalle, subtipo_costo, concepto, descripcion, monto_ars, monto_usd,
      cotizacion, monto_total_usd, fecha_emision, fecha_pago,
      fecha_vencimiento
  )
  UPDATE pasivo_entries p
  SET pagado_al_cierre = grouped.any_pagado, updated_at = now()
  FROM grouped
  WHERE p.id = grouped.keeper_id;

  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          detalle, subtipo_costo, concepto, descripcion, monto_ars, monto_usd,
          cotizacion, monto_total_usd, fecha_emision, fecha_pago,
          fecha_vencimiento
        ORDER BY id
      ) AS duplicate_number
    FROM pasivo_entries
    WHERE period_key = '2026-07' AND COALESCE(override_manual, false) = false
  )
  DELETE FROM pasivo_entries p
  USING ranked
  WHERE p.id = ranked.id AND ranked.duplicate_number > 1;

  SELECT COUNT(*) INTO activo_remaining_count
  FROM activo_entries WHERE period_key = '2026-07';
  SELECT COUNT(*) INTO pasivo_remaining_count
  FROM pasivo_entries WHERE period_key = '2026-07';

  INSERT INTO ledger_cleanup_runs (
    name, activo_archived, pasivo_archived, activo_remaining, pasivo_remaining
  ) VALUES (
    '0032_ledger_snapshot_performance_202607',
    activo_archived_count,
    pasivo_archived_count,
    activo_remaining_count,
    pasivo_remaining_count
  );
END
$cleanup$;

COMMIT;

ANALYZE activo_entries;
ANALYZE pasivo_entries;

-- Recovery, only if explicitly required:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/restore-ledger-cleanup-202607.sql
