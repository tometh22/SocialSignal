/** Runtime copy of migrations/0076_quotation_alert_dismissals.sql. */
export const quotationAlertDismissalsMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS quotation_alert_dismissals (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  alert_type VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL,
  snoozed_until TIMESTAMP,
  baseline_erosion_points DOUBLE PRECISION NOT NULL DEFAULT 0,
  baseline_severity VARCHAR(20) NOT NULL DEFAULT 'watch',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT quotation_alert_dismissals_quotation_alert_unique UNIQUE (quotation_id, alert_type)
);
ALTER TABLE quotation_alert_dismissals ADD COLUMN IF NOT EXISTS baseline_severity VARCHAR(20) NOT NULL DEFAULT 'watch';
`;
