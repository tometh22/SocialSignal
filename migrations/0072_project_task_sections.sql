ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS task_section_names JSONB NOT NULL DEFAULT '[]'::jsonb;
