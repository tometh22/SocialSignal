-- Feedback Mind V2-9: canonical personnel costs, quotation pricing metadata,
-- absence workflow, notifications and task completion history.

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS manual_price_currency TEXT DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS pricing_version INTEGER NOT NULL DEFAULT 1;

UPDATE quotations
SET manual_price_currency = COALESCE(manual_price_currency, 'ARS')
WHERE manual_price IS NOT NULL;

ALTER TABLE personnel_historical_costs
  ADD COLUMN IF NOT EXISTS monthly_hours_snapshot DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS personnel_cost_migration_audit (
  id SERIAL PRIMARY KEY,
  historical_cost_id INTEGER NOT NULL REFERENCES personnel_historical_costs(id) ON DELETE CASCADE,
  migration_key TEXT NOT NULL,
  old_monthly_salary_ars NUMERIC(12,2),
  new_monthly_salary_ars NUMERIC(12,2),
  old_monthly_salary_usd NUMERIC(12,2),
  new_monthly_salary_usd NUMERIC(12,2),
  hourly_rate_ars NUMERIC(10,2),
  hourly_rate_usd NUMERIC(10,2),
  monthly_hours_snapshot DOUBLE PRECISION,
  currency TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT personnel_cost_migration_audit_unique UNIQUE (historical_cost_id, migration_key)
);
ALTER TABLE personnel_cost_migration_audit ADD COLUMN IF NOT EXISTS currency TEXT;
UPDATE personnel_cost_migration_audit SET currency = 'unknown' WHERE currency IS NULL;
ALTER TABLE personnel_cost_migration_audit ALTER COLUMN currency SET NOT NULL;

INSERT INTO personnel_cost_migration_audit (
  historical_cost_id, migration_key,
  old_monthly_salary_ars, new_monthly_salary_ars,
  old_monthly_salary_usd, new_monthly_salary_usd,
  hourly_rate_ars, hourly_rate_usd, monthly_hours_snapshot, currency, outcome
)
SELECT cost.id,
       'feedback-mind-v2-9-hourly-canonical-v1',
       cost.monthly_salary_ars,
       CASE WHEN person.monthly_hours > 0 AND cost.hourly_rate_ars IS NOT NULL
            THEN ROUND((cost.hourly_rate_ars * person.monthly_hours)::numeric, 2)::double precision END,
       cost.monthly_salary_usd,
       CASE WHEN person.monthly_hours > 0 AND cost.hourly_rate_usd IS NOT NULL
            THEN ROUND((cost.hourly_rate_usd * person.monthly_hours)::numeric, 2)::double precision END,
       cost.hourly_rate_ars,
       cost.hourly_rate_usd,
       person.monthly_hours,
       CASE WHEN cost.hourly_rate_ars IS NOT NULL AND cost.hourly_rate_usd IS NOT NULL THEN 'mixed'
            WHEN cost.hourly_rate_usd IS NOT NULL THEN 'USD'
            WHEN cost.hourly_rate_ars IS NOT NULL THEN 'ARS' ELSE 'none' END,
       CASE WHEN person.monthly_hours > 0 THEN 'recalculated' ELSE 'skipped_missing_hours' END
FROM personnel_historical_costs cost
JOIN personnel person ON person.id = cost.personnel_id
ON CONFLICT (historical_cost_id, migration_key) DO NOTHING;

UPDATE personnel_historical_costs cost
SET monthly_hours_snapshot = person.monthly_hours,
    monthly_salary_ars = CASE
      WHEN person.monthly_hours > 0 AND cost.hourly_rate_ars IS NOT NULL
      THEN ROUND((cost.hourly_rate_ars * person.monthly_hours)::numeric, 2)::double precision
      ELSE NULL
    END,
    monthly_salary_usd = CASE
      WHEN person.monthly_hours > 0 AND cost.hourly_rate_usd IS NOT NULL
      THEN ROUND((cost.hourly_rate_usd * person.monthly_hours)::numeric, 2)::double precision
      ELSE NULL
    END,
    updated_at = NOW()
FROM personnel person
WHERE person.id = cost.personnel_id
  AND cost.monthly_hours_snapshot IS NULL
  AND person.monthly_hours > 0;

ALTER TABLE personnel_absences
  ADD COLUMN IF NOT EXISTS requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS business_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS legacy_imported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE personnel_absences absence
SET requested_by = COALESCE(absence.requested_by, absence.created_by),
    status = 'approved',
    legacy_imported = TRUE,
    business_days = (
      SELECT COUNT(*)::integer
      FROM generate_series(absence.start_date::date, absence.end_date::date, interval '1 day') day
      WHERE EXTRACT(ISODOW FROM day) BETWEEN 1 AND 5
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = day::date)
    )
WHERE absence.legacy_imported = FALSE
  AND absence.requested_by IS NULL;

ALTER TABLE personnel_absences ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS personnel_absences_person_status_dates_idx
  ON personnel_absences(personnel_id, status, start_date, end_date);

CREATE TABLE IF NOT EXISTS absence_allowances (
  id SERIAL PRIMARY KEY,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  vacation_days INTEGER NOT NULL DEFAULT 0 CHECK (vacation_days >= 0),
  epical_days INTEGER NOT NULL DEFAULT 0 CHECK (epical_days >= 0),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT absence_allowances_person_year_unique UNIQUE (personnel_id, year)
);

CREATE TABLE IF NOT EXISTS absence_events (
  id SERIAL PRIMARY KEY,
  absence_id INTEGER NOT NULL REFERENCES personnel_absences(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO absence_events (absence_id, event_key, action, to_status, actor_user_id, metadata)
SELECT id, 'legacy-import:' || id, 'legacy_import', 'approved', created_by,
       jsonb_build_object('businessDays', business_days)
FROM personnel_absences
WHERE legacy_imported = TRUE
ON CONFLICT (event_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  action_url TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_notifications_user_event_unique UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications(user_id, read_at, created_at DESC);

UPDATE tasks
SET completed_at = updated_at
WHERE status = 'done' AND completed_at IS NULL;
