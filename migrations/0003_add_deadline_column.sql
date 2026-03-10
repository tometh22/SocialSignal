ALTER TABLE "project_status_reviews" ADD COLUMN IF NOT EXISTS "deadline" timestamp;
ALTER TABLE "weekly_status_items" ADD COLUMN IF NOT EXISTS "deadline" timestamp;
