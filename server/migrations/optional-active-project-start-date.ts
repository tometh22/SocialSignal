/** Runtime copy of migrations/0070_optional_active_project_start_date.sql. */
export const optionalActiveProjectStartDateMigrationSql = String.raw`
ALTER TABLE active_projects ALTER COLUMN start_date DROP NOT NULL;
`;
