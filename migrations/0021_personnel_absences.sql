-- Tabla para ausencias de personal (vacaciones, enfermedad, otros)
CREATE TABLE IF NOT EXISTS "personnel_absences" (
  "id" serial PRIMARY KEY NOT NULL,
  "personnel_id" integer NOT NULL REFERENCES "personnel"("id") ON DELETE CASCADE,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "type" text NOT NULL DEFAULT 'vacation',
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personnel_absences_pid"
  ON "personnel_absences"("personnel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personnel_absences_dates"
  ON "personnel_absences"("start_date", "end_date");
