CREATE TABLE IF NOT EXISTS training_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  state JSONB NOT NULL DEFAULT '{"completedSteps":[],"answers":{}}'::jsonb,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_id, version)
);
CREATE TABLE IF NOT EXISTS training_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  invitation_dismissed_at TIMESTAMP
);
