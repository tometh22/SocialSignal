-- Allow creating active projects without a linked quotation (demos, internal projects, etc.)

ALTER TABLE active_projects
  ALTER COLUMN quotation_id DROP NOT NULL;
