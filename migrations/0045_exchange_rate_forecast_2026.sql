-- Forecast USD/ARS supplied by Finance. January is intentionally omitted
-- because it was not present in the source table shared for this change.
WITH actor AS (
  SELECT id FROM users ORDER BY id LIMIT 1
), forecast(month, rate, notes) AS (
  VALUES
    (2,  1425.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (3,  1410.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (4,  1400.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (5,  1430.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (6,  1515.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (7,  1560.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (8,  1476.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (9,  1516.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (10, 1553.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (11, 1597.0000::numeric, 'Proyección 2026 provista por Finanzas'),
    (12, 1760.0000::numeric, 'Proyección a 12 meses por falta de información')
)
INSERT INTO exchange_rates (
  year, month, rate, rate_type, source, is_active, notes, created_by
)
SELECT 2026, forecast.month, forecast.rate, 'estimated', 'Manual', TRUE, forecast.notes, actor.id
FROM forecast
CROSS JOIN actor
WHERE NOT EXISTS (
  SELECT 1
  FROM exchange_rates existing
  WHERE existing.year = 2026
    AND existing.month = forecast.month
    AND existing.rate_type = 'estimated'
    AND existing.source = 'Manual'
    AND existing.is_active = TRUE
);
