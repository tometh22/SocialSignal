-- Preserve source workbooks that leave a project's start date blank.
ALTER TABLE active_projects ALTER COLUMN start_date DROP NOT NULL;
