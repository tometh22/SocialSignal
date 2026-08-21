-- 0052 cashflow_transactions: deduplicar y hacer la ingesta idempotente
--
-- Al 2026-08-21 la tabla tenía 299.866 filas para 389 movimientos reales: un
-- factor de 770x, creciendo en cada corrida del sync.
--
-- Causa: el ETL (googleSheetsWorking.syncCashflow) hace un INSERT plano con un
-- import_batch nuevo cada vez. Sin constraint única no hay ON CONFLICT posible,
-- así que cada corrida reinsertaba el mes entero. Es el mismo agujero que la
-- migración 0050 cerró en las otras 27 tablas, pero acá el schema tampoco
-- declaraba la constraint, así que no entró en aquella reparación.
--
-- CLAVE NATURAL
--
-- No hay que adivinarla: el ETL escribe exactamente siete campos de negocio
-- (fecha, period_key, tipo_movimiento, banco, detalle_operacion, monto_ars,
-- monto_usd). Dos filas idénticas en los siete son la misma fila cargada dos
-- veces — no hay forma de distinguirlas ni mirándolas a mano.
--
-- Se materializa como columna generada en vez de calcularla en la app para que
-- el hash no pueda divergir entre los dos caminos de escritura (el ETL y el
-- alta manual de routes-ledger).

-- 1. Deduplicar conservando la fila más antigua de cada grupo.
--    Un self-join sobre 300k filas es O(n^2) y no termina; el GROUP BY es una
--    sola pasada de hash aggregate.
DELETE FROM cashflow_transactions
 WHERE id NOT IN (
   SELECT MIN(id)
     FROM cashflow_transactions
    GROUP BY fecha, period_key, tipo_movimiento, banco,
             detalle_operacion, monto_ars, monto_usd
 );

-- 2. Hash de la clave natural. COALESCE porque en una constraint única los NULL
--    no colisionan entre sí, y acá banco/detalle/montos son opcionales.
ALTER TABLE cashflow_transactions
  ADD COLUMN IF NOT EXISTS row_hash text
  GENERATED ALWAYS AS (
    md5(
      coalesce(extract(epoch from fecha)::text, '') || '|' ||
      coalesce(period_key, '')                     || '|' ||
      coalesce(tipo_movimiento, '')                || '|' ||
      coalesce(banco, '')                          || '|' ||
      coalesce(detalle_operacion, '')              || '|' ||
      coalesce(monto_ars::text, '')                || '|' ||
      coalesce(monto_usd::text, '')
    )
  ) STORED;

-- 3. La constraint que hace posible el ON CONFLICT del ETL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'cashflow_transactions'::regclass
       AND conname = 'cashflow_transactions_row_hash_unique'
  ) THEN
    ALTER TABLE cashflow_transactions
      ADD CONSTRAINT cashflow_transactions_row_hash_unique UNIQUE (row_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cashflow_transactions_period_idx
  ON cashflow_transactions(period_key);
