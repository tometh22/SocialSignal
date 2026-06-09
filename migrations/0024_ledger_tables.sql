-- Phase 2-4: Create financial ledger tables (Activo, Pasivo, Provisiones, Cashflow)

CREATE TABLE IF NOT EXISTS "activo_entries" (
  "id" serial PRIMARY KEY,
  "period_key" varchar(7) NOT NULL,
  "tipo_activo" varchar(50),
  "concepto" text,
  "cliente_id" integer REFERENCES "clients"("id") ON DELETE SET NULL,
  "cliente_nombre" text,
  "monto_ars" numeric(14, 2),
  "monto_usd" numeric(12, 2),
  "cotizacion" numeric(10, 4),
  "monto_total_usd" numeric(12, 2),
  "fecha_facturacion" timestamp,
  "fecha_pago" timestamp,
  "fecha_vencimiento" timestamp,
  "vencido" boolean DEFAULT false,
  "cobrado_al_cierre" boolean DEFAULT false,
  "nro_factura" varchar(100),
  "razon_social" text,
  "override_manual" boolean DEFAULT false,
  "imported_at" timestamp DEFAULT now(),
  "import_batch" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_activo_period" ON "activo_entries" ("period_key");
CREATE INDEX IF NOT EXISTS "idx_activo_cliente" ON "activo_entries" ("cliente_nombre");

CREATE TABLE IF NOT EXISTS "pasivo_entries" (
  "id" serial PRIMARY KEY,
  "period_key" varchar(7) NOT NULL,
  "detalle" text NOT NULL,
  "subtipo_costo" varchar(60),
  "concepto" text,
  "descripcion" text,
  "monto_ars" numeric(14, 2),
  "monto_usd" numeric(12, 2),
  "cotizacion" numeric(10, 4),
  "monto_total_usd" numeric(12, 2),
  "fecha_emision" timestamp,
  "fecha_pago" timestamp,
  "fecha_vencimiento" timestamp,
  "vencido" boolean DEFAULT false,
  "pagado_al_cierre" boolean DEFAULT false,
  "override_manual" boolean DEFAULT false,
  "imported_at" timestamp DEFAULT now(),
  "import_batch" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_pasivo_period" ON "pasivo_entries" ("period_key");
CREATE INDEX IF NOT EXISTS "idx_pasivo_subtipo" ON "pasivo_entries" ("subtipo_costo");

CREATE TABLE IF NOT EXISTS "provision_entries" (
  "id" serial PRIMARY KEY,
  "period_key" varchar(7) NOT NULL,
  "project_id" integer REFERENCES "active_projects"("id") ON DELETE SET NULL,
  "cliente_nombre" text,
  "tipo" varchar(20) NOT NULL,
  "monto_costo" numeric(12, 2),
  "monto_provision" numeric(12, 2),
  "criterio" text,
  "mes_aplicacion" varchar(7),
  "unwound_amount" numeric(12, 2),
  "imported_at" timestamp DEFAULT now(),
  "import_batch" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_provision_period" ON "provision_entries" ("period_key");
CREATE INDEX IF NOT EXISTS "idx_provision_project" ON "provision_entries" ("project_id");

CREATE TABLE IF NOT EXISTS "cashflow_transactions" (
  "id" serial PRIMARY KEY,
  "fecha" timestamp NOT NULL,
  "period_key" varchar(7) NOT NULL,
  "tipo_movimiento" varchar(10) NOT NULL,
  "banco" varchar(30),
  "moneda" varchar(3),
  "cliente_nombre" text,
  "detalle_operacion" text,
  "concepto" text,
  "monto_ars" numeric(14, 2),
  "cotizacion" numeric(10, 4),
  "monto_usd" numeric(12, 2),
  "saldo_santander" numeric(14, 2),
  "saldo_boa" numeric(14, 2),
  "saldo_caja" numeric(14, 2),
  "saldo_total_usd" numeric(14, 2),
  "imported_at" timestamp DEFAULT now(),
  "import_batch" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cashflow_period" ON "cashflow_transactions" ("period_key");
CREATE INDEX IF NOT EXISTS "idx_cashflow_fecha" ON "cashflow_transactions" ("fecha");
CREATE INDEX IF NOT EXISTS "idx_cashflow_banco" ON "cashflow_transactions" ("banco");
