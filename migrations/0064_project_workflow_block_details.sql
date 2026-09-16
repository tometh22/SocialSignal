-- Feedback Mind: preserve why and when an operational project was blocked.
-- Additive and safe to run repeatedly during application startup.
ALTER TABLE active_projects
  ADD COLUMN IF NOT EXISTS workflow_blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS workflow_blocked_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_active_projects_workflow_blocked_at
  ON active_projects(workflow_blocked_at);
