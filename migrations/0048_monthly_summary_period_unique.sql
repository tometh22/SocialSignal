-- 0048 monthly_financial_summary: period_key único
--
-- shared/schema.ts declara .unique() sobre period_key desde siempre, pero la
-- constraint nunca existió en producción: la tabla se creó sin ella y drizzle
-- no la agregó retroactivamente.
--
-- Consecuencia real detectada el 2026-08-21: el período 2026-03 estaba cargado
-- dos veces con valores idénticos (ids 15 y 16, mismo batch, 700 microsegundos
-- de diferencia). La facturación de 2026 salía 695.066,61 en vez de 641.328,81
-- — inflada en 53.737,80 por el duplicado.
--
-- Esta migración deduplica conservando la fila más antigua y aplica la
-- constraint que el schema ya prometía.

DELETE FROM monthly_financial_summary a
 USING monthly_financial_summary b
 WHERE a.period_key = b.period_key
   AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'monthly_financial_summary'::regclass
       AND conname = 'monthly_financial_summary_period_key_unique'
  ) THEN
    ALTER TABLE monthly_financial_summary
      ADD CONSTRAINT monthly_financial_summary_period_key_unique UNIQUE (period_key);
  END IF;
END $$;
