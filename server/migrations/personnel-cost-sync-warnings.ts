/** Runtime copy of migrations/0041_personnel_cost_sync_warnings.sql. */
export const personnelCostSyncWarningsMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS personnel_cost_sync_warnings (
  id SERIAL PRIMARY KEY,
  warning_key TEXT NOT NULL UNIQUE,
  historical_cost_id INTEGER REFERENCES personnel_historical_costs(id) ON DELETE SET NULL,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  source TEXT NOT NULL,
  currency TEXT NOT NULL,
  warning_code TEXT NOT NULL,
  hourly_rate NUMERIC(10,2),
  supplied_monthly_salary NUMERIC(12,2),
  derived_monthly_salary NUMERIC(12,2),
  monthly_hours_snapshot DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS personnel_cost_sync_warnings_period_idx
  ON personnel_cost_sync_warnings(personnel_id, year, month, created_at);
`;
