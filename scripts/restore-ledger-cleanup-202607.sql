-- Explicit rollback for migrations/0032_ledger_snapshot_performance.sql.
-- This restores the exact imported June/July rows from the archive while retaining
-- any manual entries created after cleanup.

\set ON_ERROR_STOP on
BEGIN;

LOCK TABLE activo_entries IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pasivo_entries IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM activo_entries
WHERE period_key IN ('2026-06', '2026-07')
  AND COALESCE(override_manual, false) = false;

INSERT INTO activo_entries (
  id, period_key, tipo_activo, concepto, cliente_id, cliente_nombre,
  monto_ars, monto_usd, cotizacion, monto_total_usd, fecha_facturacion,
  fecha_pago, fecha_vencimiento, vencido, cobrado_al_cierre, nro_factura,
  razon_social, override_manual, source_row_key, imported_at, import_batch,
  created_at, updated_at
)
SELECT
  id, period_key, tipo_activo, concepto, cliente_id, cliente_nombre,
  monto_ars, monto_usd, cotizacion, monto_total_usd, fecha_facturacion,
  fecha_pago, fecha_vencimiento, vencido, cobrado_al_cierre, nro_factura,
  razon_social, override_manual, source_row_key, imported_at, import_batch,
  created_at, updated_at
FROM activo_entries_archive_202607;

DELETE FROM pasivo_entries
WHERE period_key IN ('2026-06', '2026-07')
  AND COALESCE(override_manual, false) = false;

INSERT INTO pasivo_entries (
  id, period_key, detalle, subtipo_costo, concepto, descripcion,
  monto_ars, monto_usd, cotizacion, monto_total_usd, fecha_emision,
  fecha_pago, fecha_vencimiento, vencido, pagado_al_cierre, override_manual,
  source_row_key, imported_at, import_batch, created_at, updated_at
)
SELECT
  id, period_key, detalle, subtipo_costo, concepto, descripcion,
  monto_ars, monto_usd, cotizacion, monto_total_usd, fecha_emision,
  fecha_pago, fecha_vencimiento, vencido, pagado_al_cierre, override_manual,
  source_row_key, imported_at, import_batch, created_at, updated_at
FROM pasivo_entries_archive_202607;

SELECT setval(
  pg_get_serial_sequence('activo_entries', 'id'),
  COALESCE((SELECT MAX(id) FROM activo_entries), 1),
  true
);
SELECT setval(
  pg_get_serial_sequence('pasivo_entries', 'id'),
  COALESCE((SELECT MAX(id) FROM pasivo_entries), 1),
  true
);

COMMIT;
ANALYZE activo_entries;
ANALYZE pasivo_entries;
