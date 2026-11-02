// Keep in sync with migrations/0092_capacity_planning.sql.
export const capacityPlanningMigrationSql = String.raw`ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS capacity_estimation_mode text NOT NULL DEFAULT 'task'
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

-- Only the selected base counts. Explicit task extras are added once, even in task mode.
CREATE OR REPLACE VIEW capacity_effective_weekly_estimates AS
SELECT t.project_id, t.assignee_id AS personnel_id, e.week_start, e.estimated_hours,
       t.section_name, t.id AS task_id, t.status AS task_status, p.status AS project_status
FROM task_weekly_estimates e
JOIN tasks t ON t.id = e.task_id
JOIN active_projects p ON p.id = t.project_id
WHERE p.capacity_estimation_mode = 'task' OR e.is_extra
UNION ALL
SELECT e.project_id, e.personnel_id, e.week_start, e.estimated_hours,
       nullif(e.section_name, ''), NULL::integer, NULL::text, p.status
FROM capacity_group_estimates e
JOIN active_projects p ON p.id = e.project_id
WHERE p.capacity_estimation_mode = e.scope;
`;
