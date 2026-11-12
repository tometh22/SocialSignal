// Enlaces de solo lectura del Pipeline comercial. Solo se guarda el hash del token.
export const pipelineShareLinksMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS pipeline_share_links (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_viewed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pipeline_share_links_active_idx ON pipeline_share_links(revoked_at, id DESC);
`;
