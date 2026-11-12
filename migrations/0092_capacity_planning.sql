ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS capacity_estimation_mode text NOT NULL DEFAULT 'task'
  CHECK (capacity_estimation_mode IN ('task', 'section', 'project'));
ALTER TABLE task_weekly_estimates ADD COLUMN IF NOT EXISTS is_extra boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS capacity_group_estimates (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES active_projects(id) ON DELETE CASCADE,
  personnel_id integer NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  week_start text NOT NULL CHECK (week_start ~ '^\d{4}-\d{2}-\d{2}$' AND extract(isodow FROM week_start::date) = 1),
  scope text NOT NULL CHECK (scope IN ('section', 'project')),
  section_name text NOT NULL DEFAULT '',
  estimated_hours double precision NOT NULL CHECK (estimated_hours >= 0 AND estimated_hours < 'Infinity'::float8),
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT capacity_group_section CHECK ((scope = 'project' AND section_name = '') OR (scope = 'section' AND length(trim(section_name)) > 0)),
  CONSTRAINT capacity_group_estimate_unique UNIQUE(project_id, personnel_id, week_start, scope, section_name)
);
CREATE INDEX IF NOT EXISTS capacity_group_estimates_week_idx ON capacity_group_estimates(week_start);

-- A week's selected base must not change when planning another week.
CREATE TABLE IF NOT EXISTS capacity_week_modes (
  project_id integer NOT NULL REFERENCES active_projects(id) ON DELETE CASCADE,
  week_start text NOT NULL CHECK (week_start ~ '^\d{4}-\d{2}-\d{2}$' AND extract(isodow FROM week_start::date)=1),
  mode text NOT NULL CHECK (mode IN ('task','section','project')),
  PRIMARY KEY(project_id,week_start)
);
-- Recover unambiguous legacy bases. If several bases exist, retain the selected
-- mode rather than adding alternatives together. Never replace a saved choice.
INSERT INTO capacity_week_modes(project_id,week_start,mode)
SELECT x.project_id,x.week_start,
  CASE WHEN bool_or(x.mode=p.capacity_estimation_mode) THEN p.capacity_estimation_mode
       WHEN count(DISTINCT x.mode)=1 THEN min(x.mode) ELSE p.capacity_estimation_mode END
FROM (
  SELECT t.project_id,e.week_start,'task'::text AS mode FROM task_weekly_estimates e
  JOIN tasks t ON t.id=e.task_id WHERE NOT e.is_extra
  UNION ALL SELECT project_id,week_start,scope FROM capacity_group_estimates
) x JOIN active_projects p ON p.id=x.project_id
GROUP BY x.project_id,x.week_start,p.capacity_estimation_mode
ON CONFLICT DO NOTHING;

-- Freeze the default on first write, including writes from task detail.
CREATE OR REPLACE FUNCTION snapshot_capacity_week_mode() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project integer; selected text;
BEGIN
  IF TG_TABLE_NAME='task_weekly_estimates' THEN
    SELECT project_id INTO project FROM tasks WHERE id=NEW.task_id;
  ELSE project := NEW.project_id;
  END IF;
  SELECT capacity_estimation_mode INTO selected FROM active_projects WHERE id=project FOR UPDATE;
  IF selected IS NOT NULL THEN
    INSERT INTO capacity_week_modes(project_id,week_start,mode) VALUES(project,NEW.week_start,selected)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS snapshot_capacity_week ON task_weekly_estimates;
CREATE TRIGGER snapshot_capacity_week BEFORE INSERT ON task_weekly_estimates FOR EACH ROW EXECUTE FUNCTION snapshot_capacity_week_mode();
DROP TRIGGER IF EXISTS snapshot_capacity_week ON capacity_group_estimates;
CREATE TRIGGER snapshot_capacity_week BEFORE INSERT ON capacity_group_estimates FOR EACH ROW EXECUTE FUNCTION snapshot_capacity_week_mode();

CREATE OR REPLACE VIEW capacity_effective_weekly_estimates AS
SELECT t.project_id, t.assignee_id AS personnel_id, e.week_start, e.estimated_hours,
       t.section_name, t.id AS task_id, t.status AS task_status, p.status AS project_status
FROM task_weekly_estimates e
JOIN tasks t ON t.id = e.task_id
JOIN active_projects p ON p.id = t.project_id
LEFT JOIN capacity_week_modes m ON m.project_id=p.id AND m.week_start=e.week_start
WHERE COALESCE(m.mode,p.capacity_estimation_mode) = 'task' OR e.is_extra
UNION ALL
SELECT e.project_id, e.personnel_id, e.week_start, e.estimated_hours,
       nullif(e.section_name, ''), NULL::integer, NULL::text, p.status
FROM capacity_group_estimates e
JOIN active_projects p ON p.id = e.project_id
LEFT JOIN capacity_week_modes m ON m.project_id=p.id AND m.week_start=e.week_start
WHERE COALESCE(m.mode,p.capacity_estimation_mode) = e.scope;
