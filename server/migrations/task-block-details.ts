export const taskBlockDetailsMigrationSql = String.raw`
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
ALTER TABLE task_time_entries ADD COLUMN IF NOT EXISTS cost_sync_pending BOOLEAN NOT NULL DEFAULT false;
`;
