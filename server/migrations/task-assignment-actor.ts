export const taskAssignmentActorMigrationSql = String.raw`
-- Historical creators are not evidence of who assigned a task: do not backfill.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_assigned_by_idx ON tasks(assigned_by) WHERE assigned_by IS NOT NULL;
`;
