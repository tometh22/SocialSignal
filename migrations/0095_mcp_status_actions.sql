CREATE TABLE IF NOT EXISTS mcp_status_actions (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL REFERENCES mcp_oauth_grants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  action JSONB NOT NULL,
  preview JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','applied','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  UNIQUE(grant_id, request_id)
);
CREATE INDEX IF NOT EXISTS mcp_status_actions_user_idx ON mcp_status_actions(user_id);
