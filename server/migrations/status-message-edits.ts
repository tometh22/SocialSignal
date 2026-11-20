export const statusMessageEditsMigrationSql = String.raw`
ALTER TABLE project_review_notes ADD COLUMN IF NOT EXISTS edited_at timestamp;
ALTER TABLE status_update_entries ADD COLUMN IF NOT EXISTS edited_at timestamp;
`;
