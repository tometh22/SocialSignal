-- Multi-room Review system: rooms + members + per-room scoping of existing status tables.
-- Migration is transactional: if any step fails, nothing is applied.

BEGIN;

-- ─── 1. Create review_rooms + review_room_members ───────────────────────────

CREATE TABLE IF NOT EXISTS review_rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  color_index INTEGER NOT NULL DEFAULT 0,
  emoji VARCHAR(16),
  privacy VARCHAR(20) NOT NULL DEFAULT 'members',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_room_members (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'editor',
  added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_visited_at TIMESTAMP,
  CONSTRAINT review_room_members_room_user_unique UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rrm_user ON review_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rrm_room ON review_room_members(room_id);

-- ─── 2. Add room_id columns (nullable for now) ──────────────────────────────

ALTER TABLE project_status_reviews ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
ALTER TABLE weekly_status_items    ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
ALTER TABLE project_review_notes   ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
ALTER TABLE status_update_entries  ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;
ALTER TABLE status_change_log      ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES review_rooms(id) ON DELETE CASCADE;

-- ─── 3. Insert "Mi Review" for the oldest admin + make them owner ───────────

DO $$
DECLARE
  v_admin_id  INTEGER;
  v_room_id   INTEGER;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE is_admin = true ORDER BY id ASC LIMIT 1;

  -- Fallback: if no admin exists, pick any active user; if no users, create a placeholder room with NULL created_by.
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM users ORDER BY id ASC LIMIT 1;
  END IF;

  INSERT INTO review_rooms (name, description, color_index, emoji, privacy, created_by)
  VALUES ('Mi Review', 'Sala personal con el historial heredado del board compartido.', 0, '📋', 'members', v_admin_id)
  RETURNING id INTO v_room_id;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO review_room_members (room_id, user_id, role, added_by)
    VALUES (v_room_id, v_admin_id, 'owner', v_admin_id)
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;

  -- ── 4. Backfill existing rows into "Mi Review" ──────────────────────────
  UPDATE project_status_reviews SET room_id = v_room_id WHERE room_id IS NULL;
  UPDATE weekly_status_items    SET room_id = v_room_id WHERE room_id IS NULL;
  UPDATE project_review_notes   SET room_id = v_room_id WHERE room_id IS NULL;
  UPDATE status_update_entries  SET room_id = v_room_id WHERE room_id IS NULL;
  UPDATE status_change_log      SET room_id = v_room_id WHERE room_id IS NULL;
END $$;

-- ─── 5. Guard: abort if any room_id is still NULL ───────────────────────────

DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM project_status_reviews WHERE room_id IS NULL) +
    (SELECT COUNT(*) FROM weekly_status_items    WHERE room_id IS NULL) +
    (SELECT COUNT(*) FROM project_review_notes   WHERE room_id IS NULL) +
    (SELECT COUNT(*) FROM status_update_entries  WHERE room_id IS NULL) +
    (SELECT COUNT(*) FROM status_change_log      WHERE room_id IS NULL)
    INTO v_null_count;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % rows still have NULL room_id', v_null_count;
  END IF;
END $$;

-- ─── 6. Set NOT NULL ─────────────────────────────────────────────────────────

ALTER TABLE project_status_reviews ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE weekly_status_items    ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE project_review_notes   ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE status_update_entries  ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE status_change_log      ALTER COLUMN room_id SET NOT NULL;

-- ─── 7. Swap project uniqueness: per-room instead of global ─────────────────

-- The old implicit UNIQUE(project_id) may live under many names; drop any we can find.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'project_status_reviews'::regclass
      AND  contype  = 'u'
  LOOP
    -- Drop only single-column uniques on project_id (never drop our new room+project one)
    IF EXISTS (
      SELECT 1
      FROM   pg_attribute a
      WHERE  a.attrelid = 'project_status_reviews'::regclass
        AND  a.attnum   = ANY((SELECT conkey FROM pg_constraint WHERE conname = r.conname))
        AND  a.attname  = 'project_id'
    ) AND (SELECT array_length(conkey, 1) FROM pg_constraint WHERE conname = r.conname) = 1 THEN
      EXECUTE format('ALTER TABLE project_status_reviews DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE project_status_reviews
  ADD CONSTRAINT project_status_reviews_room_project_unique UNIQUE (room_id, project_id);

-- ─── 8. Per-room indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_psr_room ON project_status_reviews(room_id);
CREATE INDEX IF NOT EXISTS idx_wsi_room ON weekly_status_items(room_id);
CREATE INDEX IF NOT EXISTS idx_prn_room ON project_review_notes(room_id);
CREATE INDEX IF NOT EXISTS idx_sue_room ON status_update_entries(room_id);
CREATE INDEX IF NOT EXISTS idx_scl_room ON status_change_log(room_id);

COMMIT;
