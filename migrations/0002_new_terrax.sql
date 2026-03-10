CREATE TYPE "public"."view_type" AS ENUM('original', 'operativa', 'usd');--> statement-breakpoint
CREATE TABLE "agg_project_month" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"est_hours" numeric(10, 2),
	"total_asana_hours" numeric(10, 2),
	"total_billing_hours" numeric(10, 2),
	"total_cost_ars" numeric(14, 2),
	"total_cost_usd" numeric(12, 2),
	"view_operativa_revenue" numeric(12, 2),
	"view_operativa_cost" numeric(12, 2),
	"view_operativa_denom" numeric(12, 2),
	"view_operativa_markup" numeric(10, 4),
	"view_operativa_margin" numeric(10, 4),
	"view_operativa_budget_util" numeric(10, 4),
	"rc_revenue_native" numeric(12, 2),
	"rc_cost_native" numeric(12, 2),
	"rc_price_native" numeric(12, 2),
	"fx" numeric(10, 4),
	"flags" jsonb DEFAULT '[]'::jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agg_project_month_project_id_period_key_unique" UNIQUE("project_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"period_key" varchar(10) NOT NULL,
	"bank" varchar(100),
	"currency" varchar(20),
	"concept" varchar(300) NOT NULL,
	"amount_usd" numeric(14, 2) NOT NULL,
	"type" varchar(10) NOT NULL,
	"category" varchar(100),
	"reference" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costos_rechazados" (
	"id" serial PRIMARY KEY NOT NULL,
	"rejected_at" timestamp DEFAULT now() NOT NULL,
	"reject_reason" varchar(100) NOT NULL,
	"period_key" varchar(20),
	"client_name" varchar(255),
	"project_name" varchar(255),
	"tipo_costo" varchar(100),
	"subtipo_costo" varchar(100),
	"amount_ars" numeric(14, 2),
	"amount_usd" numeric(12, 2),
	"month_raw" varchar(50),
	"year_raw" varchar(50),
	"raw_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costs_norm" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_key" varchar(100) NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"usd" numeric(12, 2) NOT NULL,
	"hours_worked" numeric(8, 2),
	"source_row_id" varchar(255) NOT NULL,
	"anomaly" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "costs_norm_source_row_id_unique" UNIQUE("source_row_id"),
	CONSTRAINT "costs_norm_project_key_month_key_source_row_id_unique" UNIQUE("project_key","month_key","source_row_id")
);
--> statement-breakpoint
CREATE TABLE "costs_sot" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_key" varchar(100) NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"currency_native" varchar(3) DEFAULT 'ARS' NOT NULL,
	"cost_display" numeric(12, 2) NOT NULL,
	"cost_usd" numeric(12, 2) NOT NULL,
	"flags" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "costs_sot_project_key_month_key_unique" UNIQUE("project_key","month_key")
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255),
	"content" text,
	"activity_date" timestamp DEFAULT now() NOT NULL,
	"quotation_id" integer,
	"email_metadata" json,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"position" varchar(150),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"stage" varchar(50) DEFAULT 'new' NOT NULL,
	"source" varchar(100),
	"estimated_value_usd" double precision,
	"notes" text,
	"client_id" integer,
	"assigned_to" integer,
	"lost_reason" text,
	"won_at" timestamp,
	"lost_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "crm_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"notified_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"color" varchar(50) DEFAULT 'slate' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"follow_up_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_stages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "dim_client_alias" (
	"id" serial PRIMARY KEY NOT NULL,
	"alias_norm" varchar(255) NOT NULL,
	"client_id" integer,
	"client_raw" varchar(255) NOT NULL,
	"source" varchar(50) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dim_client_alias_alias_norm_unique" UNIQUE("alias_norm")
);
--> statement-breakpoint
CREATE TABLE "dim_period" (
	"period_key" varchar(7) PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"first_day" timestamp NOT NULL,
	"business_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dim_person_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer,
	"project_id" integer,
	"period_key" varchar(7) NOT NULL,
	"hourly_rate_ars" numeric(10, 2) NOT NULL,
	"source" varchar(50),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dim_person_rate_person_id_project_id_period_key_unique" UNIQUE("person_id","project_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "dim_project_alias" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"alias_norm" varchar(255) NOT NULL,
	"project_id" integer NOT NULL,
	"project_raw" varchar(255) NOT NULL,
	"source" varchar(50) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_client_project_alias" UNIQUE("client_id","alias_norm")
);
--> statement-breakpoint
CREATE TABLE "direct_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"persona" text NOT NULL,
	"rol" text,
	"mes" text NOT NULL,
	"año" integer NOT NULL,
	"tipo_gasto" text,
	"especificacion" text,
	"proyecto" text,
	"tipo_proyecto" text,
	"cliente" text,
	"horas_objetivo" double precision,
	"horas_reales_asana" double precision NOT NULL,
	"horas_para_facturacion" double precision,
	"valor_hora_local_currency" numeric(10, 2),
	"valor_hora_persona" double precision NOT NULL,
	"costo_total" double precision NOT NULL,
	"tipo_cambio" numeric(10, 4),
	"fx_cost" numeric(10, 4),
	"monto_total_usd" numeric(12, 2),
	"project_id" integer,
	"personnel_id" integer,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"row_number" integer,
	"import_batch" varchar(100),
	"unique_key" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "direct_costs_unique_key_unique" UNIQUE("unique_key")
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"rate" numeric(10, 4) NOT NULL,
	"rate_type" varchar(20) DEFAULT 'end_of_month' NOT NULL,
	"specific_date" timestamp,
	"notes" text,
	"source" text DEFAULT 'Manual',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "fact_cost_month" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"direct_usd" numeric(14, 2) DEFAULT '0' NOT NULL,
	"direct_ars" numeric(14, 2) DEFAULT '0' NOT NULL,
	"indirect_usd" numeric(14, 2) DEFAULT '0' NOT NULL,
	"indirect_ars" numeric(14, 2) DEFAULT '0' NOT NULL,
	"provisions_usd" numeric(14, 2) DEFAULT '0' NOT NULL,
	"provisions_ars" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_usd" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_ars" numeric(14, 2) DEFAULT '0',
	"source_rows_count" integer DEFAULT 0,
	"direct_rows_count" integer DEFAULT 0,
	"indirect_rows_count" integer DEFAULT 0,
	"provisions_rows_count" integer DEFAULT 0,
	"etl_timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fact_cost_month_period_key_unique" UNIQUE("period_key")
);
--> statement-breakpoint
CREATE TABLE "fact_labor_month" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"person_id" integer,
	"period_key" varchar(7) NOT NULL,
	"client_key" varchar(255),
	"project_key" varchar(255),
	"person_key" varchar(255),
	"target_hours" numeric(10, 2) DEFAULT '0',
	"asana_hours" numeric(10, 2) DEFAULT '0',
	"billing_hours" numeric(10, 2) DEFAULT '0',
	"hourly_rate_ars" numeric(10, 2),
	"cost_ars" numeric(12, 2),
	"cost_usd" numeric(12, 2),
	"fx" numeric(10, 4),
	"role_name" varchar(100),
	"flags" jsonb DEFAULT '[]'::jsonb,
	"source_row_id" text,
	"loaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fact_labor_month_project_id_person_key_period_key_unique" UNIQUE("project_id","person_key","period_key")
);
--> statement-breakpoint
CREATE TABLE "fact_rc_month" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"revenue_usd" numeric(12, 2),
	"cost_usd" numeric(12, 2),
	"revenue_ars" numeric(14, 2),
	"cost_ars" numeric(14, 2),
	"quote_native" numeric(12, 2),
	"fx_rate" numeric(10, 4),
	"price_native" numeric(12, 2),
	"fx" numeric(10, 4),
	"source_row_id" text,
	"loaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fact_rc_month_project_id_period_key_unique" UNIQUE("project_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "financial_sot" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"project_type" text,
	"month_key" varchar(7) NOT NULL,
	"year" integer NOT NULL,
	"revenue_usd" numeric(16, 2),
	"revenue_ars" numeric(16, 2),
	"cost_usd" numeric(16, 2),
	"cost_ars" numeric(16, 2),
	"quotation" numeric(16, 2),
	"fx" numeric(12, 6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "financial_sot_client_name_project_name_month_key_unique" UNIQUE("client_name","project_name","month_key")
);
--> statement-breakpoint
CREATE TABLE "google_sheets_project_billing" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"billing_month" text NOT NULL,
	"billing_year" integer NOT NULL,
	"collection_month" text,
	"collection_year" integer,
	"amount_ars" double precision,
	"amount_usd" double precision,
	"adjustment" double precision DEFAULT 0,
	"base_value" double precision,
	"invoiced" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_sheets_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"project_type" text NOT NULL,
	"is_confirmed" boolean DEFAULT true NOT NULL,
	"payment_terms" integer,
	"first_billing_month" text,
	"first_billing_year" integer NOT NULL,
	"created_date" timestamp NOT NULL,
	"original_currency" text NOT NULL,
	"original_amount_ars" double precision,
	"original_amount_usd" double precision,
	"current_amount_ars" double precision,
	"current_amount_usd" double precision,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"google_sheets_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_sheets_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"client_name" varchar(200) NOT NULL,
	"project_name" varchar(200) NOT NULL,
	"month" varchar(50) NOT NULL,
	"year" integer NOT NULL,
	"sales_type" varchar(50) NOT NULL,
	"amount_local" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'ARS' NOT NULL,
	"fx_applied" numeric(10, 4),
	"amount_usd" numeric(12, 2),
	"fx_source" varchar(50),
	"fx_at" timestamp,
	"revenue_type" varchar(20) DEFAULT 'fee' NOT NULL,
	"status" varchar(20) DEFAULT 'emitido' NOT NULL,
	"recognized_month" varchar(7),
	"confirmed" varchar(10) DEFAULT 'SI' NOT NULL,
	"month_number" integer,
	"client_id" integer,
	"project_id" integer,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"row_number" integer,
	"import_batch" varchar(100),
	"unique_key" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_sheets_sales_unique_key_unique" UNIQUE("unique_key")
);
--> statement-breakpoint
CREATE TABLE "income_sot" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"year" integer NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"project_type" text,
	"confirmed" boolean DEFAULT true NOT NULL,
	"status_hint" text,
	"fx_ref" numeric(12, 6),
	"amount_local_ars" numeric(16, 2),
	"amount_local_usd" numeric(16, 2),
	"revenue_usd" numeric(16, 2) NOT NULL,
	"revenue_usd_with_vat" numeric(16, 2),
	"revenue_ars_with_vat" numeric(16, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "income_sot_client_name_project_name_month_key_unique" UNIQUE("client_name","project_name","month_key")
);
--> statement-breakpoint
CREATE TABLE "indirect_cost_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indirect_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"period" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_financial_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"year" integer NOT NULL,
	"month_number" integer NOT NULL,
	"month_label" varchar(20),
	"cierre_date" timestamp,
	"total_activo" numeric(14, 2),
	"total_pasivo" numeric(14, 2),
	"balance_neto" numeric(14, 2),
	"caja_total" numeric(14, 2),
	"inversiones" numeric(14, 2),
	"cashflow_ingresos" numeric(14, 2),
	"cashflow_egresos" numeric(14, 2),
	"cashflow_neto" numeric(14, 2),
	"cuentas_cobrar_usd" numeric(12, 2),
	"cuentas_pagar_usd" numeric(12, 2),
	"facturacion_total" numeric(14, 2),
	"costos_directos" numeric(14, 2),
	"costos_indirectos" numeric(14, 2),
	"iva_compras" numeric(12, 2),
	"impuestos_usa" numeric(12, 2),
	"pasivo_facturacion_adelantada" numeric(14, 2),
	"ebit_operativo" numeric(14, 2),
	"beneficio_neto" numeric(14, 2),
	"markup_promedio" numeric(10, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_financial_summary_period_key_unique" UNIQUE("period_key")
);
--> statement-breakpoint
CREATE TABLE "monthly_hour_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"adjusted_hours" double precision NOT NULL,
	"reason" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"previous_price" double precision NOT NULL,
	"new_price" double precision NOT NULL,
	"previous_scope" text,
	"new_scope" text,
	"previous_team" text,
	"new_team" text,
	"change_type" text NOT NULL,
	"client_feedback" text,
	"internal_notes" text,
	"negotiation_reason" text,
	"adjustment_percentage" double precision,
	"proposal_link" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "non_billable_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"end_date" timestamp,
	"hours" numeric(5, 2) NOT NULL,
	"description" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "personnel_historical_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"hourly_rate_ars" numeric(10, 2),
	"monthly_salary_ars" numeric(12, 2),
	"hourly_rate_usd" numeric(10, 2),
	"monthly_salary_usd" numeric(12, 2),
	"exchange_rate_id" integer,
	"adjustment_reason" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "pl_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" varchar(10) NOT NULL,
	"type" varchar(50) NOT NULL,
	"concept" varchar(200),
	"amount_usd" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_aggregates" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_period_id" integer NOT NULL,
	"view_type" "view_type" NOT NULL,
	"currency_native" varchar(3) NOT NULL,
	"base_data" jsonb NOT NULL,
	"view_data" jsonb NOT NULL,
	"quotation_data" jsonb,
	"actuals_data" jsonb,
	"flags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_aggregates_project_period_id_view_type_unique" UNIQUE("project_period_id","view_type")
);
--> statement-breakpoint
CREATE TABLE "project_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"excel_client" varchar(255) NOT NULL,
	"excel_project" varchar(255) NOT NULL,
	"source" varchar(50) DEFAULT 'migration' NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"last_matched_at" timestamp,
	"match_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unique_excel_mapping" UNIQUE("excel_client","excel_project")
);
--> statement-breakpoint
CREATE TABLE "project_financial_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"total_revenue_usd" numeric(12, 2) DEFAULT '0',
	"total_invoiced_usd" numeric(12, 2) DEFAULT '0',
	"total_collected_usd" numeric(12, 2) DEFAULT '0',
	"current_monthly_rate_usd" numeric(12, 2),
	"last_revenue_month" integer,
	"last_revenue_year" integer,
	"outstanding_invoices_usd" numeric(12, 2) DEFAULT '0',
	"pending_collection_usd" numeric(12, 2) DEFAULT '0',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "project_financial_summary_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_financial_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"invoice_number" varchar(100),
	"invoice_date" timestamp,
	"invoice_amount_usd" numeric(12, 2),
	"invoice_amount_ars" numeric(15, 2),
	"collection_date" timestamp,
	"collected_amount_usd" numeric(12, 2),
	"collected_amount_ars" numeric(15, 2),
	"payment_method" varchar(50),
	"exchange_rate_used" numeric(8, 4),
	"notes" text,
	"invoice_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_monthly_revenue" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount_usd" numeric(12, 2) NOT NULL,
	"amount_ars" numeric(15, 2),
	"exchange_rate" numeric(8, 4),
	"invoiced" boolean DEFAULT false,
	"invoice_date" timestamp,
	"invoice_number" varchar(100),
	"collected" boolean DEFAULT false,
	"collection_date" timestamp,
	"revenue_source" varchar(50) DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_monthly_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"sales_amount_usd" numeric(12, 2) NOT NULL,
	"sales_amount_ars" numeric(15, 2),
	"sales_type" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"fx" numeric(10, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_periods_project_id_period_key_unique" UNIQUE("project_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "project_price_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"previous_price" double precision NOT NULL,
	"new_price" double precision NOT NULL,
	"adjustment_percentage" double precision NOT NULL,
	"effective_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"client_notified" boolean DEFAULT false NOT NULL,
	"client_approval" boolean,
	"approval_date" timestamp,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_pricing_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"effective_from_year" integer NOT NULL,
	"effective_from_month" integer NOT NULL,
	"effective_to_year" integer,
	"effective_to_month" integer,
	"monthly_amount_usd" numeric(12, 2) NOT NULL,
	"monthly_amount_ars" numeric(15, 2),
	"change_reason" text,
	"scope_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_review_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"content" text NOT NULL,
	"note_date" timestamp DEFAULT now() NOT NULL,
	"author_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_status_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"health_status" varchar(20) DEFAULT 'verde',
	"margin_status" varchar(20) DEFAULT 'medio',
	"team_strain" varchar(20) DEFAULT 'bajo',
	"main_risk" text,
	"current_action" text,
	"next_milestone" text,
	"next_milestone_date" timestamp,
	"deadline" timestamp,
	"owner_id" integer,
	"decision_needed" varchar(30) DEFAULT 'ninguna',
	"hidden_from_weekly" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"variant_name" text NOT NULL,
	"variant_description" text,
	"variant_order" integer DEFAULT 1 NOT NULL,
	"base_cost" double precision NOT NULL,
	"complexity_adjustment" double precision NOT NULL,
	"markup_amount" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"is_selected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rc_unmatched_staging" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"cliente_raw" varchar(255) NOT NULL,
	"proyecto_raw" varchar(255) NOT NULL,
	"cliente_norm" varchar(255) NOT NULL,
	"proyecto_norm" varchar(255) NOT NULL,
	"motivo" varchar(100) NOT NULL,
	"fuzzy_score" double precision,
	"candidate_project_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_norm" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_key" varchar(100) NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"usd" numeric(12, 2) NOT NULL,
	"source_row_id" varchar(255) NOT NULL,
	"anomaly" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_norm_source_row_id_unique" UNIQUE("source_row_id"),
	CONSTRAINT "sales_norm_project_key_month_key_source_row_id_unique" UNIQUE("project_key","month_key","source_row_id")
);
--> statement-breakpoint
CREATE TABLE "targets_norm" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_key" varchar(100) NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"target_hours" numeric(8, 2) NOT NULL,
	"rate_usd" numeric(10, 2),
	"source_row_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "targets_norm_source_row_id_unique" UNIQUE("source_row_id"),
	CONSTRAINT "targets_norm_project_key_month_key_source_row_id_unique" UNIQUE("project_key","month_key","source_row_id")
);
--> statement-breakpoint
CREATE TABLE "task_own_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color_index" integer DEFAULT 0 NOT NULL,
	"privacy" text DEFAULT 'team' NOT NULL,
	"created_by_personnel_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"hours" double precision NOT NULL,
	"description" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"project_id" integer,
	"section_name" text DEFAULT 'General',
	"assignee_id" integer,
	"collaborator_ids" jsonb DEFAULT '[]'::jsonb,
	"start_date" timestamp,
	"due_date" timestamp,
	"estimated_hours" double precision,
	"logged_hours" double precision DEFAULT 0,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"parent_task_id" integer,
	"position" integer DEFAULT 0,
	"completed_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_breakdown" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_period_id" integer NOT NULL,
	"person_name" varchar(255) NOT NULL,
	"role_name" varchar(255) NOT NULL,
	"target_hours" numeric(8, 2),
	"hours_real" numeric(8, 2),
	"hourly_rate_ars" numeric(10, 2),
	"cost_ars" numeric(12, 2),
	"cost_usd" numeric(12, 2),
	"is_from_excel" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_breakdown_project_period_id_person_name_role_name_unique" UNIQUE("project_period_id","person_name","role_name")
);
--> statement-breakpoint
CREATE TABLE "unquoted_personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"estimated_hours" double precision NOT NULL,
	"hourly_rate" double precision NOT NULL,
	"assigned_date" timestamp DEFAULT now() NOT NULL,
	"assigned_by" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "weekly_status_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"health_status" varchar(20) DEFAULT 'verde',
	"margin_status" varchar(20) DEFAULT 'medio',
	"team_strain" varchar(20) DEFAULT 'medio',
	"main_risk" text,
	"current_action" text,
	"next_milestone" text,
	"deadline" timestamp,
	"owner_id" integer,
	"decision_needed" varchar(30) DEFAULT 'ninguna',
	"hidden_from_weekly" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_modo_comments" ALTER COLUMN "total_score" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "budget" double precision;--> statement-breakpoint
ALTER TABLE "active_projects" ADD COLUMN "is_finished" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "rework_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "client_general_feedback" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "contract_type" text DEFAULT 'full-time' NOT NULL;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "monthly_fixed_salary" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "monthly_hours" double precision DEFAULT 160 NOT NULL;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "include_in_real_costs" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jan_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jan_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jan_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "feb_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "feb_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "feb_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "mar_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "mar_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "mar_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "apr_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "apr_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "apr_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "may_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "may_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "may_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jun_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jun_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jun_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jul_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jul_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "jul_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "aug_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "aug_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "aug_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "sep_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "sep_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "sep_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "oct_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "oct_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "oct_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "nov_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "nov_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "nov_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "dec_2025_contract_type" text;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "dec_2025_hourly_rate_ars" double precision;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "dec_2025_monthly_salary_ars" double precision;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD COLUMN "variant_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "margin_factor" double precision DEFAULT 2;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "tools_cost" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "price_mode" text DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "manual_price" double precision;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "exchange_rate_at_quote" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "proposal_link" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "quotation_type" text DEFAULT 'recurring';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "lead_id" integer;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "default_rate_usd" double precision;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "exchange_rate_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "agg_project_month" ADD CONSTRAINT "agg_project_month_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agg_project_month" ADD CONSTRAINT "agg_project_month_period_key_dim_period_period_key_fk" FOREIGN KEY ("period_key") REFERENCES "public"."dim_period"("period_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_reminders" ADD CONSTRAINT "crm_reminders_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_reminders" ADD CONSTRAINT "crm_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_client_alias" ADD CONSTRAINT "dim_client_alias_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_person_rate" ADD CONSTRAINT "dim_person_rate_person_id_personnel_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_person_rate" ADD CONSTRAINT "dim_person_rate_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_person_rate" ADD CONSTRAINT "dim_person_rate_period_key_dim_period_period_key_fk" FOREIGN KEY ("period_key") REFERENCES "public"."dim_period"("period_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_project_alias" ADD CONSTRAINT "dim_project_alias_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_project_alias" ADD CONSTRAINT "dim_project_alias_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_costs" ADD CONSTRAINT "direct_costs_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_costs" ADD CONSTRAINT "direct_costs_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_cost_month" ADD CONSTRAINT "fact_cost_month_period_key_dim_period_period_key_fk" FOREIGN KEY ("period_key") REFERENCES "public"."dim_period"("period_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_labor_month" ADD CONSTRAINT "fact_labor_month_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_labor_month" ADD CONSTRAINT "fact_labor_month_person_id_personnel_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_labor_month" ADD CONSTRAINT "fact_labor_month_period_key_dim_period_period_key_fk" FOREIGN KEY ("period_key") REFERENCES "public"."dim_period"("period_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_rc_month" ADD CONSTRAINT "fact_rc_month_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_rc_month" ADD CONSTRAINT "fact_rc_month_period_key_dim_period_period_key_fk" FOREIGN KEY ("period_key") REFERENCES "public"."dim_period"("period_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_sheets_project_billing" ADD CONSTRAINT "google_sheets_project_billing_project_id_google_sheets_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."google_sheets_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_sheets_sales" ADD CONSTRAINT "google_sheets_sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_sheets_sales" ADD CONSTRAINT "google_sheets_sales_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indirect_costs" ADD CONSTRAINT "indirect_costs_category_id_indirect_cost_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."indirect_cost_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indirect_costs" ADD CONSTRAINT "indirect_costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_hour_adjustments" ADD CONSTRAINT "monthly_hour_adjustments_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_hour_adjustments" ADD CONSTRAINT "monthly_hour_adjustments_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_hour_adjustments" ADD CONSTRAINT "monthly_hour_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_history" ADD CONSTRAINT "negotiation_history_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_history" ADD CONSTRAINT "negotiation_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_billable_hours" ADD CONSTRAINT "non_billable_hours_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_billable_hours" ADD CONSTRAINT "non_billable_hours_category_id_indirect_cost_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."indirect_cost_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_billable_hours" ADD CONSTRAINT "non_billable_hours_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_historical_costs" ADD CONSTRAINT "personnel_historical_costs_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_historical_costs" ADD CONSTRAINT "personnel_historical_costs_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_historical_costs" ADD CONSTRAINT "personnel_historical_costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_historical_costs" ADD CONSTRAINT "personnel_historical_costs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_aggregates" ADD CONSTRAINT "project_aggregates_project_period_id_project_periods_id_fk" FOREIGN KEY ("project_period_id") REFERENCES "public"."project_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_aliases" ADD CONSTRAINT "project_aliases_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_aliases" ADD CONSTRAINT "project_aliases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_financial_summary" ADD CONSTRAINT "project_financial_summary_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_financial_summary" ADD CONSTRAINT "project_financial_summary_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_financial_transactions" ADD CONSTRAINT "project_financial_transactions_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_financial_transactions" ADD CONSTRAINT "project_financial_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_revenue" ADD CONSTRAINT "project_monthly_revenue_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_revenue" ADD CONSTRAINT "project_monthly_revenue_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_sales" ADD CONSTRAINT "project_monthly_sales_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_monthly_sales" ADD CONSTRAINT "project_monthly_sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_periods" ADD CONSTRAINT "project_periods_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_price_adjustments" ADD CONSTRAINT "project_price_adjustments_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_price_adjustments" ADD CONSTRAINT "project_price_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pricing_changes" ADD CONSTRAINT "project_pricing_changes_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pricing_changes" ADD CONSTRAINT "project_pricing_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_review_notes" ADD CONSTRAINT "project_review_notes_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_review_notes" ADD CONSTRAINT "project_review_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_reviews" ADD CONSTRAINT "project_status_reviews_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_reviews" ADD CONSTRAINT "project_status_reviews_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_variants" ADD CONSTRAINT "quotation_variants_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_unmatched_staging" ADD CONSTRAINT "rc_unmatched_staging_candidate_project_id_active_projects_id_fk" FOREIGN KEY ("candidate_project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_own_projects" ADD CONSTRAINT "task_own_projects_created_by_personnel_id_personnel_id_fk" FOREIGN KEY ("created_by_personnel_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_project_members" ADD CONSTRAINT "task_project_members_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_personnel_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_breakdown" ADD CONSTRAINT "team_breakdown_project_period_id_project_periods_id_fk" FOREIGN KEY ("project_period_id") REFERENCES "public"."project_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unquoted_personnel" ADD CONSTRAINT "unquoted_personnel_project_id_active_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."active_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unquoted_personnel" ADD CONSTRAINT "unquoted_personnel_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unquoted_personnel" ADD CONSTRAINT "unquoted_personnel_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_status_items" ADD CONSTRAINT "weekly_status_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reject_reason_idx" ON "costos_rechazados" USING btree ("reject_reason");--> statement-breakpoint
CREATE INDEX "reject_period_idx" ON "costos_rechazados" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "rejected_at_idx" ON "costos_rechazados" USING btree ("rejected_at");--> statement-breakpoint
CREATE INDEX "mfs_period_idx" ON "monthly_financial_summary" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "mfs_year_month_idx" ON "monthly_financial_summary" USING btree ("year","month_number");--> statement-breakpoint
CREATE INDEX "rc_unmatched_period_idx" ON "rc_unmatched_staging" USING btree ("period_key");--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD CONSTRAINT "quotation_team_members_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD CONSTRAINT "quotation_team_members_variant_id_quotation_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."quotation_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD CONSTRAINT "quotation_team_members_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_team_members" ADD CONSTRAINT "quotation_team_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" DROP COLUMN "retrabajo";--> statement-breakpoint
ALTER TABLE "deliverables" DROP COLUMN "feedback_general_cliente";