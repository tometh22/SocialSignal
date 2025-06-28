CREATE TABLE "client_modo_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"quarter" integer NOT NULL,
	"year" integer NOT NULL,
	"general_quality" numeric(3, 2),
	"insights_clarity" numeric(3, 2),
	"presentation" numeric(3, 2),
	"nps" numeric(3, 2),
	"client_survey" numeric(3, 2),
	"operations_feedback" numeric(3, 2),
	"hours_compliance" numeric(3, 2),
	"client_feedback" numeric(3, 2),
	"brief_compliance" numeric(3, 2),
	"total_score" numeric(4, 2) NOT NULL,
	"comments" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "cost_multipliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"multiplier" double precision DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"delivery_month" text NOT NULL,
	"mes_entrega" integer,
	"analyst_id" integer,
	"pm_id" integer,
	"delivery_on_time" boolean DEFAULT false,
	"delay" integer,
	"retrabajo" boolean DEFAULT false,
	"narrative_quality" numeric(3, 2),
	"graphics_effectiveness" numeric(3, 2),
	"format_design" numeric(3, 2),
	"relevant_insights" numeric(3, 2),
	"operations_feedback" numeric(3, 2),
	"hours_estimated" numeric(5, 2),
	"hours_actual" numeric(5, 2),
	"client_feedback" numeric(3, 2),
	"feedback_general_cliente" numeric(3, 2),
	"brief_compliance" numeric(3, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"project_id" integer,
	"delivery_date" timestamp,
	"due_date" timestamp,
	"frequency" text,
	"deliverable_type" text,
	"specific_budget" numeric(8, 2),
	"parent_project_id" integer
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"rate" numeric(8, 4) NOT NULL,
	"effective_from" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "monthly_inflation" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"inflation_rate" double precision NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "project_base_team" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"estimated_hours" double precision NOT NULL,
	"hourly_rate" double precision NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "project_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_project_id" integer NOT NULL,
	"template_id" integer,
	"cycle_name" text NOT NULL,
	"cycle_type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"subproject_id" integer,
	"actual_cost" double precision,
	"budget_variance" double precision,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quarterly_nps_surveys" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"quarter" integer NOT NULL,
	"year" integer NOT NULL,
	"report_quality" integer,
	"insights_clarity" integer,
	"brief_objectives" integer,
	"report_presentation" integer,
	"improvement_suggestions" text,
	"strengths_feedback" text,
	"nps_score" integer,
	"nps_category" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "quick_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"period_name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_hours" double precision DEFAULT 0 NOT NULL,
	"total_cost" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" integer
);
--> statement-breakpoint
CREATE TABLE "quick_time_entry_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"quick_time_entry_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"hours" double precision NOT NULL,
	"hourly_rate" double precision NOT NULL,
	"total_cost" double precision NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "recurring_project_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_project_id" integer NOT NULL,
	"template_name" text NOT NULL,
	"deliverable_type" text NOT NULL,
	"frequency" text NOT NULL,
	"day_of_month" integer,
	"day_of_week" integer,
	"estimated_hours" double precision,
	"base_budget" double precision,
	"description" text,
	"is_active" boolean DEFAULT true,
	"auto_create_days_in_advance" integer DEFAULT 7,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "recurring_template_personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"estimated_hours" double precision,
	"is_required" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" text NOT NULL,
	"config_value" double precision NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "system_config_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
ALTER TABLE "quotation_team_members" ALTER COLUMN "personnel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "client_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "parent_project_id" integer;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "is_always_on_macro" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "macro_monthly_budget" double precision;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "deliverable_frequency" text;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "deliverable_type" text;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "deliverable_budget" double precision;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "additional_deliverable_cost" double precision;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "deliverable_description" text;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "subproject_name" text;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "completion_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "completed_date" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "logo_url" varchar(255);--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD COLUMN "fte" double precision;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD COLUMN "dedication" double precision;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "platform_cost" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "deviation_percentage" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_percentage" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "project_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "apply_inflation_adjustment" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "inflation_method" text DEFAULT 'automatic';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "manual_inflation_rate" double precision;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "projected_cost_ars" double precision;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "usd_exchange_rate" double precision;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "quotation_currency" text DEFAULT 'ARS';--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "component_id" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "total_cost" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "hourly_rate_at_time" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "entry_type" varchar(20) DEFAULT 'hours' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "is_date_range" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "period_description" text;--> statement-breakpoint
ALTER TABLE "client_modo_comments" ADD CONSTRAINT "client_modo_comments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_modo_comments" ADD CONSTRAINT "client_modo_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_multipliers" ADD CONSTRAINT "cost_multipliers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_analyst_id_personnel_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_pm_id_personnel_id_fk" FOREIGN KEY ("pm_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_parent_project_id_active_projects_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_history" ADD CONSTRAINT "exchange_rate_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_inflation" ADD CONSTRAINT "monthly_inflation_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_base_team" ADD CONSTRAINT "project_base_team_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_base_team" ADD CONSTRAINT "project_base_team_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_base_team" ADD CONSTRAINT "project_base_team_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cycles" ADD CONSTRAINT "project_cycles_parent_project_id_active_projects_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cycles" ADD CONSTRAINT "project_cycles_template_id_recurring_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_project_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cycles" ADD CONSTRAINT "project_cycles_subproject_id_active_projects_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_nps_surveys" ADD CONSTRAINT "quarterly_nps_surveys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_nps_surveys" ADD CONSTRAINT "quarterly_nps_surveys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_time_entries" ADD CONSTRAINT "quick_time_entries_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_time_entries" ADD CONSTRAINT "quick_time_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_time_entries" ADD CONSTRAINT "quick_time_entries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_time_entry_details" ADD CONSTRAINT "quick_time_entry_details_quick_time_entry_id_quick_time_entries_id_fk" FOREIGN KEY ("quick_time_entry_id") REFERENCES "public"."quick_time_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_time_entry_details" ADD CONSTRAINT "quick_time_entry_details_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_time_entry_details" ADD CONSTRAINT "quick_time_entry_details_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_project_templates" ADD CONSTRAINT "recurring_project_templates_parent_project_id_active_projects_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_project_templates" ADD CONSTRAINT "recurring_project_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_personnel" ADD CONSTRAINT "recurring_template_personnel_template_id_recurring_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_project_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_template_personnel" ADD CONSTRAINT "recurring_template_personnel_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_projects" ADD CONSTRAINT "active_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_component_id_project_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."project_components"("id") ON DELETE no action ON UPDATE no action;