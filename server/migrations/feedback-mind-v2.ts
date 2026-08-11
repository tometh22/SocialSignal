/**
 * Runtime copy of migrations/0031_feedback_mind_v2.sql.
 *
 * Production currently applies idempotent migrations during server startup,
 * so this SQL is bundled with the application instead of relying on the source
 * migration directory being present in the deployed image.
 */
export const feedbackMindV2MigrationSql = String.raw`
DELETE FROM task_project_members a
USING task_project_members b
WHERE a.id > b.id
  AND a.project_id = b.project_id
  AND a.personnel_id = b.personnel_id;

CREATE UNIQUE INDEX IF NOT EXISTS task_project_members_project_personnel_unique
  ON task_project_members(project_id, personnel_id);

DELETE FROM task_weekly_estimates a
USING task_weekly_estimates b
WHERE a.id > b.id
  AND a.task_id = b.task_id
  AND a.week_start = b.week_start;

CREATE UNIQUE INDEX IF NOT EXISTS task_weekly_estimates_task_week_unique
  ON task_weekly_estimates(task_id, week_start);

DELETE FROM personnel_historical_costs a
USING personnel_historical_costs b
WHERE a.id < b.id
  AND a.personnel_id = b.personnel_id
  AND a.year = b.year
  AND a.month = b.month
  AND a.is_active = true
  AND b.is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS personnel_historical_costs_active_period_unique
  ON personnel_historical_costs(personnel_id, year, month)
  WHERE is_active = true;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_project_members_project_personnel_unique'
  ) THEN
    ALTER TABLE task_project_members
      ADD CONSTRAINT task_project_members_project_personnel_unique
      UNIQUE USING INDEX task_project_members_project_personnel_unique;
  END IF;
END $migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_weekly_estimates_task_week_unique'
  ) THEN
    ALTER TABLE task_weekly_estimates
      ADD CONSTRAINT task_weekly_estimates_task_week_unique
      UNIQUE USING INDEX task_weekly_estimates_task_week_unique;
  END IF;
END $migration$;

ALTER TABLE holidays
  ALTER COLUMN date TYPE date
  USING date::date;

ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS "current_role" TEXT,
  ADD COLUMN IF NOT EXISTS "sublevel" TEXT,
  ADD COLUMN IF NOT EXISTS "legacy_role" TEXT;

ALTER TABLE personnel
  ALTER COLUMN monthly_hours DROP NOT NULL;

UPDATE personnel
SET monthly_hours = NULL
WHERE contract_type = 'freelance'
  AND (monthly_hours IS NULL OR monthly_hours = 160);

UPDATE personnel
SET "current_role" = NULL
WHERE contract_type = 'freelance';

ALTER TABLE personnel_absences
  DROP CONSTRAINT IF EXISTS personnel_absences_type_check;

ALTER TABLE personnel_absences
  ADD CONSTRAINT personnel_absences_type_check
  CHECK (type IN ('vacation', 'sick', 'other', 'epical_day'));

INSERT INTO clients(name)
SELECT 'Epical'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Epical');

DO $migration$
DECLARE
  own_project RECORD;
  epical_id INTEGER;
  migrated_project_id INTEGER;
BEGIN
  SELECT id INTO epical_id FROM clients WHERE name = 'Epical' LIMIT 1;
  IF to_regclass('public.task_own_projects') IS NOT NULL THEN
    FOR own_project IN EXECUTE 'SELECT * FROM task_own_projects ORDER BY id' LOOP
      INSERT INTO active_projects (
        client_id, name, status, start_date, tracking_frequency, project_category, internal_type
      )
      VALUES (
        epical_id, own_project.name, 'active', own_project.created_at, 'weekly', 'internal', 'otro'
      )
      RETURNING id INTO migrated_project_id;

      UPDATE tasks
      SET project_id = migrated_project_id,
          section_name = COALESCE(NULLIF(section_name, ''), 'General')
      WHERE project_id = own_project.id + 1000000;

      INSERT INTO task_project_members(project_id, personnel_id, role)
      SELECT migrated_project_id, personnel_id, role
      FROM task_project_members
      WHERE project_id = own_project.id + 1000000
      ON CONFLICT (project_id, personnel_id) DO UPDATE SET role = EXCLUDED.role;

      DELETE FROM task_project_members WHERE project_id = own_project.id + 1000000;
    END LOOP;
  END IF;
END $migration$;

DROP TABLE IF EXISTS task_own_projects;
DROP TABLE IF EXISTS estimated_rates;

INSERT INTO active_projects (
  client_id, name, status, start_date, tracking_frequency, project_category, internal_type
)
SELECT c.id, 'General interno', 'active', NOW(), 'weekly', 'internal', 'general'
FROM clients c
WHERE c.name = 'Epical'
  AND NOT EXISTS (
    SELECT 1 FROM active_projects ap
    WHERE ap.client_id = c.id AND ap.name = 'General interno'
  );

UPDATE tasks
SET project_id = (
  SELECT ap.id
  FROM active_projects ap
  JOIN clients c ON c.id = ap.client_id
  WHERE c.name = 'Epical' AND ap.name = 'General interno'
  ORDER BY ap.id
  LIMIT 1
),
section_name = COALESCE(NULLIF(section_name, ''), 'General')
WHERE parent_task_id IS NULL
  AND (
    project_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM active_projects existing_project
      WHERE existing_project.id = tasks.project_id
    )
  );

UPDATE tasks
SET section_name = 'General'
WHERE parent_task_id IS NULL
  AND NULLIF(BTRIM(section_name), '') IS NULL;

INSERT INTO task_weekly_estimates(task_id, week_start, estimated_hours, created_by)
SELECT
  task.id,
  TO_CHAR(
    DATE_TRUNC('week', COALESCE(task.start_date, task.due_date, task.created_at)),
    'YYYY-MM-DD'
  ),
  task.estimated_hours,
  task.created_by
FROM tasks task
WHERE task.estimated_hours IS NOT NULL
  AND task.estimated_hours > 0
  AND NOT EXISTS (
    SELECT 1 FROM task_weekly_estimates estimate
    WHERE estimate.task_id = task.id
  )
ON CONFLICT (task_id, week_start) DO NOTHING;

DO $migration$
DECLARE
  repaired_count INTEGER;
BEGIN
  LOOP
    UPDATE tasks child
    SET project_id = parent.project_id,
        section_name = COALESCE(NULLIF(BTRIM(parent.section_name), ''), 'General')
    FROM tasks parent
    WHERE child.parent_task_id = parent.id
      AND parent.project_id IS NOT NULL
      AND (
        child.project_id IS DISTINCT FROM parent.project_id
        OR child.section_name IS DISTINCT FROM COALESCE(NULLIF(BTRIM(parent.section_name), ''), 'General')
        OR NULLIF(BTRIM(child.section_name), '') IS NULL
      );
    GET DIAGNOSTICS repaired_count = ROW_COUNT;
    EXIT WHEN repaired_count = 0;
  END LOOP;
END $migration$;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_project_section_required;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_section_required
  CHECK (
    project_id IS NOT NULL
    AND NULLIF(BTRIM(section_name), '') IS NOT NULL
  );

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_project_id_active_projects_id_fk'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_project_id_active_projects_id_fk
      FOREIGN KEY (project_id) REFERENCES active_projects(id) ON DELETE CASCADE;
  END IF;
END $migration$;

DELETE FROM task_project_members member
WHERE NOT EXISTS (
  SELECT 1 FROM active_projects project
  WHERE project.id = member.project_id
);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_project_members_project_id_active_projects_id_fk'
  ) THEN
    ALTER TABLE task_project_members
      ADD CONSTRAINT task_project_members_project_id_active_projects_id_fk
      FOREIGN KEY (project_id) REFERENCES active_projects(id) ON DELETE CASCADE;
  END IF;
END $migration$;

UPDATE activo_entries
SET monto_total_usd = CASE
  WHEN monto_ars IS NOT NULL AND cotizacion IS NOT NULL AND cotizacion > 0
    AND (
      COALESCE(monto_total_usd, monto_usd, 0) = 0
      OR COALESCE(monto_total_usd, monto_usd) / NULLIF(monto_ars / cotizacion, 0)
        NOT BETWEEN 0.8 AND 1.2
    )
    THEN ROUND(monto_ars / cotizacion, 2)
  WHEN monto_usd IS NOT NULL THEN monto_usd
  ELSE monto_total_usd
END
WHERE (
    monto_ars IS NOT NULL
    AND cotizacion IS NOT NULL
    AND cotizacion > 0
    AND (
      COALESCE(monto_total_usd, monto_usd, 0) = 0
      OR COALESCE(monto_total_usd, monto_usd) / NULLIF(monto_ars / cotizacion, 0)
        NOT BETWEEN 0.8 AND 1.2
    )
  )
  OR (COALESCE(monto_total_usd, 0) = 0 AND monto_usd IS NOT NULL);

UPDATE pasivo_entries
SET monto_total_usd = CASE
  WHEN monto_ars IS NOT NULL AND cotizacion IS NOT NULL AND cotizacion > 0
    AND (
      COALESCE(monto_total_usd, monto_usd, 0) = 0
      OR COALESCE(monto_total_usd, monto_usd) / NULLIF(monto_ars / cotizacion, 0)
        NOT BETWEEN 0.8 AND 1.2
    )
    THEN ROUND(monto_ars / cotizacion, 2)
  WHEN monto_usd IS NOT NULL THEN monto_usd
  ELSE monto_total_usd
END
WHERE (
    monto_ars IS NOT NULL
    AND cotizacion IS NOT NULL
    AND cotizacion > 0
    AND (
      COALESCE(monto_total_usd, monto_usd, 0) = 0
      OR COALESCE(monto_total_usd, monto_usd) / NULLIF(monto_ars / cotizacion, 0)
        NOT BETWEEN 0.8 AND 1.2
    )
  )
  OR (COALESCE(monto_total_usd, 0) = 0 AND monto_usd IS NOT NULL);
`;
