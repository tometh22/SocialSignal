// Generado a partir de migrations/0047_financial_intelligence.sql — mantener en sync.
export const financialIntelligenceMigrationSql = String.raw`
-- 0047 Financial Intelligence
--
-- Motivación (análisis del 2026-08-20):
-- El Excel MAESTRO guarda UN número de ingreso por proyecto/mes que significa
-- "facturación" pero se lee como "resultado". Toda la ambigüedad entre
-- "el año cierra en 641k" y "el año cierra en 581k" nace de ahí.
--
-- revenue_events guarda el hecho económico con sus TRES fechas
-- (facturación / entrega / cobro) para que las tres bases se deriven
-- en vez de elegirse.

CREATE TABLE IF NOT EXISTS revenue_events (
  id serial PRIMARY KEY,

  project_id integer REFERENCES active_projects(id) ON DELETE SET NULL,
  client_name varchar(180) NOT NULL,
  project_name varchar(255),

  amount_usd numeric(14,2) NOT NULL,
  amount_native numeric(16,2),
  currency varchar(3) NOT NULL DEFAULT 'USD',
  fx_rate numeric(12,4),

  -- Las tres fechas. invoice_period es la única obligatoria: es lo que
  -- el Excel ya tiene hoy y garantiza que la migración no pierda nada.
  invoice_period varchar(7) NOT NULL,
  delivery_start varchar(7),
  delivery_end varchar(7),
  delivery_curve varchar(20) NOT NULL DEFAULT 'invoice',
  collection_period_expected varchar(7),
  collection_period_actual varchar(7),
  payment_terms_days integer,

  -- Pipeline
  confirmed boolean NOT NULL DEFAULT true,
  probability numeric(5,2),
  status varchar(20) NOT NULL DEFAULT 'confirmed',

  -- Procedencia y confianza
  source_tab varchar(80),
  source_row_id text,
  is_estimate boolean NOT NULL DEFAULT false,
  period_closed boolean NOT NULL DEFAULT false,

  note text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT revenue_events_curve_check
    CHECK (delivery_curve IN ('invoice', 'linear', 'input_method')),
  CONSTRAINT revenue_events_status_check
    CHECK (status IN ('pipeline', 'confirmed', 'invoiced', 'collected', 'cancelled')),
  CONSTRAINT revenue_events_probability_check
    CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  -- Si hay ventana de entrega, tiene que estar completa y ordenada
  CONSTRAINT revenue_events_delivery_window_check
    CHECK (
      (delivery_start IS NULL AND delivery_end IS NULL)
      OR (delivery_start IS NOT NULL AND delivery_end IS NOT NULL AND delivery_end >= delivery_start)
    ),
  -- input_method / linear exigen ventana de entrega declarada
  CONSTRAINT revenue_events_curve_requires_window_check
    CHECK (delivery_curve = 'invoice' OR delivery_start IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS revenue_events_invoice_period_idx ON revenue_events(invoice_period);
CREATE INDEX IF NOT EXISTS revenue_events_delivery_idx ON revenue_events(delivery_start, delivery_end);
CREATE INDEX IF NOT EXISTS revenue_events_collection_idx ON revenue_events(collection_period_expected);
CREATE INDEX IF NOT EXISTS revenue_events_client_idx ON revenue_events(client_name);
CREATE INDEX IF NOT EXISTS revenue_events_status_idx ON revenue_events(status);
CREATE UNIQUE INDEX IF NOT EXISTS revenue_events_source_row_idx
  ON revenue_events(source_tab, source_row_id)
  WHERE source_row_id IS NOT NULL;

-- Partidas no recurrentes. Permite mostrar el YTD "limpio" al lado del reportado.
-- Caso que lo motivó: la provisión de bonos de dic-2025 (18.000) se revirtió como
-- ingreso en ene-2026 e infla el 24% del resultado neto del año.
CREATE TABLE IF NOT EXISTS one_off_items (
  id serial PRIMARY KEY,
  period_key varchar(7) NOT NULL,
  concept varchar(180) NOT NULL,
  amount_usd numeric(14,2) NOT NULL,
  kind varchar(40) NOT NULL,
  affects varchar(20) NOT NULL,
  counterpart_period varchar(7),
  note text,
  detected_by varchar(60),
  confirmed_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT one_off_items_kind_check
    CHECK (kind IN ('provision_reversal', 'provision_charge', 'one_shot_revenue',
                    'extraordinary_cost', 'fx_effect', 'other')),
  CONSTRAINT one_off_items_affects_check
    CHECK (affects IN ('revenue', 'cost', 'both'))
);

CREATE INDEX IF NOT EXISTS one_off_items_period_idx ON one_off_items(period_key);

-- Salida de los detectores de calidad de dato.
CREATE TABLE IF NOT EXISTS data_quality_findings (
  id serial PRIMARY KEY,
  detector varchar(60) NOT NULL,
  severity varchar(20) NOT NULL,
  period_key varchar(7),
  entity varchar(180),
  title varchar(255) NOT NULL,
  detail text,
  expected_value numeric(16,2),
  actual_value numeric(16,2),
  delta numeric(16,2),
  source_ref text,
  status varchar(20) NOT NULL DEFAULT 'open',
  first_seen_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp,
  muted_until timestamp,

  CONSTRAINT data_quality_findings_severity_check
    CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT data_quality_findings_status_check
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'muted'))
);

-- Fingerprint estable: un mismo hallazgo no se duplica entre corridas.
CREATE UNIQUE INDEX IF NOT EXISTS data_quality_findings_fingerprint_idx
  ON data_quality_findings(detector, COALESCE(period_key, ''), COALESCE(entity, ''));
CREATE INDEX IF NOT EXISTS data_quality_findings_status_idx ON data_quality_findings(status, severity);

-- Términos de pago contractuales por cliente, para contrastar contra la cobranza real.
-- Caso que lo motivó: Warner tiene 90 días contractuales y cobra a ~115,
-- y las facturas que vencen en diciembre entran en enero.
CREATE TABLE IF NOT EXISTS client_payment_terms (
  id serial PRIMARY KEY,
  client_name varchar(180) NOT NULL UNIQUE,
  contractual_days integer NOT NULL,
  note text,
  updated_at timestamp NOT NULL DEFAULT now()
);
`;
