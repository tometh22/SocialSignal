-- Entidades de facturación por cliente: un cliente puede facturar bajo más
-- de una razón social/país (ej. Uber Argentina S.R.L. vs Uber Technologies Inc.)

CREATE TABLE IF NOT EXISTS client_billing_entities (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  country TEXT,
  tax_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_billing_entities_client ON client_billing_entities(client_id);

-- A nivel app ya se desmarca cualquier otro default antes de marcar uno nuevo
-- (dentro de una transacción), pero este índice único parcial es el respaldo
-- a nivel de DB para que nunca queden dos entidades default del mismo cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_billing_entities_one_default
  ON client_billing_entities(client_id)
  WHERE is_default = true;
