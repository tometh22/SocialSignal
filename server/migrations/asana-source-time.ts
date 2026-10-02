/** Runtime copy of migrations/0075_asana_source_time.sql. */
export const asanaSourceTimeSql = String.raw`
CREATE TABLE IF NOT EXISTS asana_person_identities (
  gid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  personnel_id INTEGER REFERENCES personnel(id),
  source JSONB NOT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS asana_time_entries (
  gid TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  personnel_id INTEGER REFERENCES personnel(id),
  source_task_gid TEXT,
  source_task_name TEXT,
  author_gid TEXT REFERENCES asana_person_identities(gid),
  author_name TEXT,
  date TIMESTAMP NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  description TEXT,
  source JSONB NOT NULL,
  source_created_at TIMESTAMP,
  imported_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asana_time_entries_project_date ON asana_time_entries(project_id,date);
CREATE INDEX IF NOT EXISTS asana_time_entries_task ON asana_time_entries(task_id);
`;
