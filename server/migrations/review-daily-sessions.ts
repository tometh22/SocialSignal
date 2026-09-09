// Generado a partir de migrations/0057_review_daily_sessions.sql — mantener en sync.
export const reviewDailySessionsMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS review_daily_sessions (
  id serial PRIMARY KEY,
  room_id integer NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamp NOT NULL,
  finished_at timestamp NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  reviewed_count integer NOT NULL DEFAULT 0,
  changed_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rds_room_finished ON review_daily_sessions(room_id, finished_at DESC);
`;
