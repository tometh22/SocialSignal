-- Add updatedBy to project_status_reviews
ALTER TABLE "project_status_reviews" ADD COLUMN IF NOT EXISTS "updated_by" integer REFERENCES "users"("id");

-- Add updatedBy to weekly_status_items
ALTER TABLE "weekly_status_items" ADD COLUMN IF NOT EXISTS "updated_by" integer REFERENCES "users"("id");

-- Create status_change_log table
CREATE TABLE IF NOT EXISTS "status_change_log" (
  "id" serial PRIMARY KEY,
  "project_id" integer REFERENCES "active_projects"("id") ON DELETE CASCADE,
  "weekly_status_item_id" integer REFERENCES "weekly_status_items"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "users"("id"),
  "field_name" varchar(30) NOT NULL,
  "old_value" text,
  "new_value" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS "idx_status_change_log_project" ON "status_change_log" ("project_id") WHERE "project_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_status_change_log_custom_item" ON "status_change_log" ("weekly_status_item_id") WHERE "weekly_status_item_id" IS NOT NULL;
