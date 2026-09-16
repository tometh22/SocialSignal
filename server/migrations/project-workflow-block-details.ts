/** Runtime copy of migrations/0064_project_workflow_block_details.sql. */
export const projectWorkflowBlockDetailsMigrationSql = String.raw`
ALTER TABLE active_projects
  ADD COLUMN IF NOT EXISTS workflow_blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS workflow_blocked_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_active_projects_workflow_blocked_at
  ON active_projects(workflow_blocked_at);
`;
