// Ver migrations/0100_financial_intake_details.sql (mismo contenido).
// cost_treatment es varchar sin CHECK: los valores nuevos 'balance_only' y
// 'tax' no requieren cambiar la columna.
export const financialIntakeDetailsMigrationSql = String.raw`
ALTER TABLE pasivo_entries ADD COLUMN IF NOT EXISTS is_marketing boolean NOT NULL DEFAULT false;
ALTER TABLE revenue_events
  ADD COLUMN IF NOT EXISTS adjustment_amount_usd numeric(14,2),
  ADD COLUMN IF NOT EXISTS adjustment_note text;
`;
