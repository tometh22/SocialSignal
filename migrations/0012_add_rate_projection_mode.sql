-- Schema drift fix: rate_projection_mode was added to shared/schema.ts but no
-- migration was created, breaking SELECT * on quotations (used by the active
-- projects aggregator and others).
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "rate_projection_mode" text DEFAULT 'current';
