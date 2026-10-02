/** Runtime copy of migrations/0072_project_task_sections.sql. */
export const projectTaskSectionsMigrationSql = String.raw`
ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS task_section_names JSONB NOT NULL DEFAULT '[]'::jsonb;
`;
