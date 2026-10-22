// Keep in sync with migrations/0086_mcp_oauth.sql (startup migration convention).
export const mcpOauthMigrationSql = `
CREATE TABLE IF NOT EXISTS mcp_oauth_grants (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_hash TEXT UNIQUE,
  code_expires_at TIMESTAMPTZ NOT NULL,
  access_token_hash TEXT UNIQUE,
  access_expires_at TIMESTAMPTZ,
  refresh_token_hash TEXT UNIQUE,
  refresh_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_oauth_grants_user_idx ON mcp_oauth_grants(user_id);
`;
