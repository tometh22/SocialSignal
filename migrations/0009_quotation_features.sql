-- Feature: Fecha de expiración, Win/Loss tracking, Quotation templates
--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "loss_reason" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "project_type" text NOT NULL,
  "analysis_type" text NOT NULL,
  "mentions_volume" text NOT NULL DEFAULT 'medium',
  "countries_covered" text NOT NULL DEFAULT '1',
  "client_engagement" text NOT NULL DEFAULT 'medium',
  "team_config" text NOT NULL,
  "complexity_config" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotation_templates_created_by" ON "quotation_templates"("created_by");
