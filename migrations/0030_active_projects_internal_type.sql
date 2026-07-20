-- Subtipo para proyectos internos no facturables (capacitación, automatización, etc.)

ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS internal_type TEXT;
