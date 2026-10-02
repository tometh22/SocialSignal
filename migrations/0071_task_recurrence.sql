ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_source_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurrence_source_unique ON tasks(recurrence_source_task_id) WHERE recurrence_source_task_id IS NOT NULL;
