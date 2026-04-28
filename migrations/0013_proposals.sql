-- Status item proposals: versioned approval flow for content (e.g. social posts)
-- attached to a project or custom status item inside a review room.

BEGIN;

CREATE TABLE IF NOT EXISTS status_item_proposals (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES review_rooms(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES active_projects(id) ON DELETE CASCADE,
  weekly_status_item_id INTEGER REFERENCES weekly_status_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  decided_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMP,
  decision_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT status_item_proposals_target_xor CHECK (
    (project_id IS NOT NULL AND weekly_status_item_id IS NULL)
    OR (project_id IS NULL AND weekly_status_item_id IS NOT NULL)
  ),
  CONSTRAINT status_item_proposals_status_chk CHECK (
    status IN ('pending','approved','rejected','superseded')
  )
);

CREATE INDEX IF NOT EXISTS idx_sip_room_project ON status_item_proposals(room_id, project_id);
CREATE INDEX IF NOT EXISTS idx_sip_room_item    ON status_item_proposals(room_id, weekly_status_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sip_project_version ON status_item_proposals(project_id, version) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sip_item_version    ON status_item_proposals(weekly_status_item_id, version) WHERE weekly_status_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS status_item_proposal_attachments (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES status_item_proposals(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL DEFAULT 'file',
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type VARCHAR(120),
  link_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT status_item_proposal_attachments_kind_chk CHECK (kind IN ('file','link')),
  CONSTRAINT status_item_proposal_attachments_payload_chk CHECK (
    (kind = 'file' AND file_url IS NOT NULL)
    OR (kind = 'link' AND link_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_sipa_proposal ON status_item_proposal_attachments(proposal_id);

COMMIT;
