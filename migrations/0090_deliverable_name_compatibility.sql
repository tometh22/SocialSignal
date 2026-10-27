-- Production retains a required legacy title alongside the canonical name.
-- Keep both writer generations compatible without replacing existing titles.
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS title text;
UPDATE deliverables SET title = name WHERE title IS NULL AND name IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_deliverable_name_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
      NEW.title := NEW.name;
    ELSIF NEW.title IS DISTINCT FROM OLD.title AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
      NEW.name := NEW.title;
    END IF;
  END IF;
  NEW.name := COALESCE(NEW.name, NEW.title);
  NEW.title := COALESCE(NEW.title, NEW.name);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deliverable_name_title_compat ON deliverables;
CREATE TRIGGER deliverable_name_title_compat
BEFORE INSERT OR UPDATE OF name, title ON deliverables
FOR EACH ROW EXECUTE FUNCTION sync_deliverable_name_title();
