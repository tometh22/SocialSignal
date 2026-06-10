-- Fase 7.2: Migrar columnas mensuales de personnel a personnel_historical_costs
-- Copia los valores hora 2025-2027 de las 36 columnas {mmm}_{yyyy}_hourly_rate_ars
-- a la tabla normalizada. NO borra las columnas originales: el drop se hará en una
-- migración posterior, después de verificar paridad en producción.
-- Idempotente: NOT EXISTS evita duplicados si se re-ejecuta.

INSERT INTO personnel_historical_costs
  (personnel_id, year, month, hourly_rate_ars, adjustment_reason, is_active)
SELECT p.id, v.year, v.month, v.rate, 'Migrado desde columnas mensuales de personnel (0026)', true
FROM personnel p
CROSS JOIN LATERAL (
  VALUES
    (2025, 1, p.jan_2025_hourly_rate_ars),
    (2025, 2, p.feb_2025_hourly_rate_ars),
    (2025, 3, p.mar_2025_hourly_rate_ars),
    (2025, 4, p.apr_2025_hourly_rate_ars),
    (2025, 5, p.may_2025_hourly_rate_ars),
    (2025, 6, p.jun_2025_hourly_rate_ars),
    (2025, 7, p.jul_2025_hourly_rate_ars),
    (2025, 8, p.aug_2025_hourly_rate_ars),
    (2025, 9, p.sep_2025_hourly_rate_ars),
    (2025, 10, p.oct_2025_hourly_rate_ars),
    (2025, 11, p.nov_2025_hourly_rate_ars),
    (2025, 12, p.dec_2025_hourly_rate_ars),
    (2026, 1, p.jan_2026_hourly_rate_ars),
    (2026, 2, p.feb_2026_hourly_rate_ars),
    (2026, 3, p.mar_2026_hourly_rate_ars),
    (2026, 4, p.apr_2026_hourly_rate_ars),
    (2026, 5, p.may_2026_hourly_rate_ars),
    (2026, 6, p.jun_2026_hourly_rate_ars),
    (2026, 7, p.jul_2026_hourly_rate_ars),
    (2026, 8, p.aug_2026_hourly_rate_ars),
    (2026, 9, p.sep_2026_hourly_rate_ars),
    (2026, 10, p.oct_2026_hourly_rate_ars),
    (2026, 11, p.nov_2026_hourly_rate_ars),
    (2026, 12, p.dec_2026_hourly_rate_ars),
    (2027, 1, p.jan_2027_hourly_rate_ars),
    (2027, 2, p.feb_2027_hourly_rate_ars),
    (2027, 3, p.mar_2027_hourly_rate_ars),
    (2027, 4, p.apr_2027_hourly_rate_ars),
    (2027, 5, p.may_2027_hourly_rate_ars),
    (2027, 6, p.jun_2027_hourly_rate_ars),
    (2027, 7, p.jul_2027_hourly_rate_ars),
    (2027, 8, p.aug_2027_hourly_rate_ars),
    (2027, 9, p.sep_2027_hourly_rate_ars),
    (2027, 10, p.oct_2027_hourly_rate_ars),
    (2027, 11, p.nov_2027_hourly_rate_ars),
    (2027, 12, p.dec_2027_hourly_rate_ars)
) AS v(year, month, rate)
WHERE v.rate IS NOT NULL
  AND v.rate > 0
  AND NOT EXISTS (
    SELECT 1 FROM personnel_historical_costs h
    WHERE h.personnel_id = p.id
      AND h.year = v.year
      AND h.month = v.month
      AND h.is_active = true
  );
