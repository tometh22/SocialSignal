ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS asana_project_gid TEXT;
ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS asana_source JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS active_projects_asana_gid_unique ON active_projects(asana_project_gid) WHERE asana_project_gid IS NOT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS asana_task_gid TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS asana_source JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_asana_project_gid_unique ON tasks(project_id,asana_task_gid) WHERE asana_task_gid IS NOT NULL;
CREATE TABLE IF NOT EXISTS project_quotation_links (
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  quotation_id INTEGER NOT NULL REFERENCES quotations(id),
  relation TEXT NOT NULL DEFAULT 'supplemental',
  source TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,quotation_id)
);
CREATE TABLE IF NOT EXISTS project_history_links (
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  legacy_project_id INTEGER NOT NULL REFERENCES active_projects(id),
  relation TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,legacy_project_id)
);
