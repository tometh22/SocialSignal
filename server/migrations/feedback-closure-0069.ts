// Generated from migrations/0069_feedback_closure.sql — keep both files in sync.
export const feedbackClosure0069MigrationSql = String.raw`
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS birthday TEXT;
ALTER TABLE personnel_absences ADD COLUMN IF NOT EXISTS planning_status TEXT NOT NULL DEFAULT 'tentative';
ALTER TABLE absence_allowances ADD COLUMN IF NOT EXISTS vacation_carryover_days INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS monthly_settlement_declarations (
 id SERIAL PRIMARY KEY, closing_id INTEGER NOT NULL UNIQUE REFERENCES monthly_closings(id) ON DELETE CASCADE,
 personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE, bank_fx_rate DOUBLE PRECISION NOT NULL,
 usd_amount DOUBLE PRECISION NOT NULL, closing_fx_rate DOUBLE PRECISION NOT NULL, difference_ars DOUBLE PRECISION NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', submitted_at TIMESTAMP NOT NULL DEFAULT now(),
 reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_at TIMESTAMP, review_reason TEXT,
 created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monthly_settlement_declarations_person_idx ON monthly_settlement_declarations(personnel_id, submitted_at DESC);
CREATE TABLE IF NOT EXISTS monthly_settlement_events (
 id SERIAL PRIMARY KEY, declaration_id INTEGER NOT NULL REFERENCES monthly_settlement_declarations(id) ON DELETE CASCADE,
 action TEXT NOT NULL, actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, metadata JSONB DEFAULT '{}', created_at TIMESTAMP NOT NULL DEFAULT now()
);
`;
