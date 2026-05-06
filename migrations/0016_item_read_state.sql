-- Per-user read state for review room items. Tracks the timestamp a user last
-- opened/read each item; unread comment count = notes created after this.
-- Migration is transactional: if any step fails, nothing is applied.

BEGIN;

CREATE TABLE IF NOT EXISTS item_read_state (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES active_projects(id) ON DELETE CASCADE,
  weekly_status_item_id INTEGER REFERENCES weekly_status_items(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Exactly one of project_id / weekly_status_item_id is set.
  CONSTRAINT irs_one_target CHECK (
    (project_id IS NOT NULL)::int + (weekly_status_item_id IS NOT NULL)::int = 1
  )
);

-- Unique per (user, room, target) so we can UPSERT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_irs_user_room_project
  ON item_read_state(user_id, room_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_irs_user_room_custom
  ON item_read_state(user_id, room_id, weekly_status_item_id)
  WHERE weekly_status_item_id IS NOT NULL;

COMMIT;
