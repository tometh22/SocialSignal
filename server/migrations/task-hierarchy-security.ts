/** Runtime copy of migrations/0038_task_hierarchy_security.sql. */
export const taskHierarchySecurityMigrationSql = String.raw`
INSERT INTO task_project_members (project_id, personnel_id, role)
SELECT DISTINCT source.project_id, source.personnel_id, 'member'
FROM (
  SELECT project_id, assignee_id AS personnel_id
  FROM tasks
  WHERE assignee_id IS NOT NULL
  UNION
  SELECT task.project_id, collaborator.value::integer AS personnel_id
  FROM tasks task
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(COALESCE(task.collaborator_ids, '[]'::jsonb)) = 'array'
        THEN COALESCE(task.collaborator_ids, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) collaborator(value)
  WHERE collaborator.value ~ '^[1-9][0-9]*$'
) source
JOIN active_projects project ON project.id = source.project_id
JOIN personnel person ON person.id = source.personnel_id
ON CONFLICT (project_id, personnel_id) DO NOTHING;

UPDATE tasks child
SET parent_task_id = NULL,
    updated_at = NOW()
WHERE child.parent_task_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tasks parent WHERE parent.id = child.parent_task_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tasks'::regclass
      AND conname = 'tasks_parent_task_id_fk'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_parent_task_id_fk
      FOREIGN KEY (parent_task_id)
      REFERENCES tasks(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

CREATE OR REPLACE FUNCTION prevent_task_parent_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_task_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.id IS NOT NULL AND NEW.parent_task_id = NEW.id THEN
    RAISE EXCEPTION 'A task cannot be its own parent' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT task.id, task.parent_task_id FROM tasks task WHERE task.id = NEW.parent_task_id
      UNION
      SELECT parent.id, parent.parent_task_id
      FROM tasks parent JOIN ancestors child ON child.parent_task_id = parent.id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Task hierarchy cycle detected' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_prevent_parent_cycle ON tasks;
CREATE TRIGGER tasks_prevent_parent_cycle
BEFORE INSERT OR UPDATE OF parent_task_id ON tasks
FOR EACH ROW EXECUTE FUNCTION prevent_task_parent_cycle();
`;
