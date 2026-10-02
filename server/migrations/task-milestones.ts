/** Runtime copy of migrations/0073_task_milestones.sql. */
export const taskMilestonesMigrationSql = String.raw`
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;
`;
