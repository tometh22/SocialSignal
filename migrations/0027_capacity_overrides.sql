CREATE TABLE IF NOT EXISTS "capacity_overrides" (
  "id" serial PRIMARY KEY NOT NULL,
  "personnel_id" integer NOT NULL REFERENCES "personnel"("id") ON DELETE CASCADE,
  "week_start" varchar(10) NOT NULL,
  "max_hours" double precision NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "uq_cap_override_person_week" UNIQUE("personnel_id", "week_start")
);
CREATE INDEX IF NOT EXISTS "idx_cap_override_week" ON "capacity_overrides" ("week_start");
