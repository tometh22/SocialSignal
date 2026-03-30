-- Status Update Entries: accumulating update history instead of overwriting
CREATE TABLE IF NOT EXISTS status_update_entries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES active_projects(id) ON DELETE CASCADE,
  weekly_status_item_id INTEGER REFERENCES weekly_status_items(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sue_project ON status_update_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_sue_custom ON status_update_entries(weekly_status_item_id);
CREATE INDEX IF NOT EXISTS idx_sue_created ON status_update_entries(created_at DESC);
