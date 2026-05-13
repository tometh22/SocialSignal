-- Weekly hour estimates per task (multi-week support)
CREATE TABLE IF NOT EXISTS task_weekly_estimates (
  id            SERIAL PRIMARY KEY,
  task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  estimated_hours NUMERIC(6,2) NOT NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_task_weekly_estimates_task_id ON task_weekly_estimates(task_id);
