// Keep in sync with migrations/0084_financial_cutover.sql.
export const financialCutoverMigrationSql = String.raw`-- Existing aggregate costs remain historical until rebuilt from native inputs.
ALTER TABLE fact_cost_month ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'excel';
CREATE OR REPLACE VIEW financial_native_cost_month AS
SELECT f.* FROM fact_cost_month f
WHERE f.data_source='mind'
   OR NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='app_mode_cutover_date')
   OR f.period_key < (SELECT description FROM system_config WHERE config_key='app_mode_cutover_date');

-- Native forecast inputs; historical Excel facts remain available for comparison only.
CREATE TABLE IF NOT EXISTS financial_cost_plans (
  id serial PRIMARY KEY,
  concept text NOT NULL,
  category text NOT NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('direct','indirect')),
  currency text NOT NULL CHECK (currency IN ('ARS','USD')),
  monthly_amount numeric(16,4) NOT NULL CHECK (monthly_amount > 0),
  start_period varchar(7) NOT NULL CHECK (start_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  end_period varchar(7) NOT NULL CHECK (end_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND end_period >= start_period),
  notes text,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by integer NOT NULL REFERENCES users(id),
  updated_by integer NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK ((left(end_period,4)::int-left(start_period,4)::int)*12+right(end_period,2)::int-right(start_period,2)::int <= 59)
);

CREATE OR REPLACE VIEW financial_cost_forecast_month AS
WITH cutoff AS (
  SELECT description AS period FROM system_config WHERE config_key='app_mode_cutover_date'
), native AS (
  SELECT c.*, to_char(m, 'YYYY-MM') AS month_key
  FROM financial_cost_plans c
  CROSS JOIN LATERAL generate_series((c.start_period || '-01')::date, (c.end_period || '-01')::date, interval '1 month') m
  WHERE c.active
)
SELECT f.month_key, f.detalle, f.subtipo_costo, f.monto_total_usd, 'excel_history'::text AS source, false AS missing_fx
FROM fact_estimated_cost_month f
WHERE NOT EXISTS (SELECT 1 FROM cutoff) OR f.month_key < (SELECT period FROM cutoff)
UNION ALL
SELECT n.month_key, n.concept, n.category,
  CASE WHEN n.currency='USD' THEN n.monthly_amount ELSE n.monthly_amount / NULLIF(fx.rate,0) END,
  'mind'::text, n.currency='ARS' AND (fx.rate IS NULL OR fx.rate<=0)
FROM native n
LEFT JOIN LATERAL (
  SELECT rate FROM exchange_rates
  WHERE year=left(n.month_key,4)::int AND month=right(n.month_key,2)::int AND is_active
  ORDER BY CASE rate_type WHEN 'end_of_month' THEN 0 WHEN 'average' THEN 1 WHEN 'daily' THEN 2 ELSE 3 END, updated_at DESC, id DESC LIMIT 1
) fx ON true
WHERE NOT EXISTS (SELECT 1 FROM cutoff) OR n.month_key >= (SELECT period FROM cutoff);

-- Defense in depth: every writer uses the same lock as close/reopen. Both the
-- old and new period are checked, so moving a row cannot bypass a closed month.
CREATE OR REPLACE FUNCTION protect_financial_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_row jsonb; new_row jsonb; periods text[] := '{}'; p text; close_status text; cutoff text;
  row_data jsonb; start_key text; end_key text; settlement boolean := false; payment_period text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  IF TG_OP='UPDATE' AND old_row=new_row THEN RETURN NEW; END IF;
  -- Closing markers are bookkeeping metadata, not a change to recognized revenue.
  IF TG_TABLE_NAME='revenue_events' AND TG_OP='UPDATE'
    AND COALESCE(current_setting('mind.financial_writer',true),'') IN ('close','reopen')
    AND old_row - ARRAY['period_closed','updated_at'] = new_row - ARRAY['period_closed','updated_at'] THEN RETURN NEW; END IF;

  -- A receipt/payment in an OPEN later month may settle an older invoice.
  -- Its economic fields stay immutable; the frozen monthly snapshot is untouched.
  payment_period := current_setting('mind.financial_payment_period',true);
  IF TG_OP='UPDATE' AND payment_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    IF TG_TABLE_NAME IN ('activo_entries','pasivo_entries')
      AND old_row - ARRAY['outstanding_amount','status','cobrado_al_cierre','pagado_al_cierre','fecha_pago','updated_by','updated_at']
        = new_row - ARRAY['outstanding_amount','status','cobrado_al_cierre','pagado_al_cierre','fecha_pago','updated_by','updated_at']
      AND payment_period >= old_row->>'period_key' THEN settlement := true;
    ELSIF TG_TABLE_NAME='revenue_events'
      AND old_row - ARRAY['collection_period_actual','updated_at'] = new_row - ARRAY['collection_period_actual','updated_at'] THEN
      settlement := true;
      periods := array_append(periods,old_row->>'collection_period_actual');
      periods := array_append(periods,new_row->>'collection_period_actual');
    END IF;
  END IF;
  IF settlement THEN periods := array_append(periods,payment_period); END IF;
  FOREACH row_data IN ARRAY ARRAY[old_row,new_row] LOOP
    IF row_data IS NULL OR settlement THEN CONTINUE; END IF;
    IF TG_ARGV[0]='year_month' THEN
      periods := array_append(periods, (row_data->>'year') || '-' || lpad(row_data->>'month',2,'0'));
    ELSIF TG_ARGV[0]='range' THEN
      FOR p IN SELECT to_char(m,'YYYY-MM') FROM generate_series(((row_data->>'start_period')||'-01')::date,((row_data->>'end_period')||'-01')::date,interval '1 month') m LOOP
        periods := array_append(periods,p);
      END LOOP;
    ELSIF TG_ARGV[0]='revenue' THEN
      periods := array_append(periods,row_data->>'invoice_period');
      periods := array_append(periods,row_data->>'collection_period_actual');
      start_key := COALESCE(row_data->>'delivery_start',row_data->>'invoice_period');
      end_key := COALESCE(row_data->>'delivery_end',start_key);
      FOR p IN SELECT to_char(m,'YYYY-MM') FROM generate_series((start_key||'-01')::date,(end_key||'-01')::date,interval '1 month') m LOOP
        periods := array_append(periods,p);
      END LOOP;
    ELSE
      periods := array_append(periods,row_data->>TG_ARGV[0]);
    END IF;
  END LOOP;
  SELECT description INTO cutoff FROM system_config WHERE config_key='app_mode_cutover_date';
  FOR p IN SELECT DISTINCT v FROM unnest(periods) v WHERE v IS NOT NULL ORDER BY v LOOP
    PERFORM pg_advisory_xact_lock(hashtext('financial-period:' || p));
    SELECT status INTO close_status FROM financial_close_periods WHERE period_key=p;
    IF close_status='CLOSED' OR (close_status='IN_REVIEW' AND NOT (
      TG_TABLE_NAME='monthly_financial_summary' AND COALESCE(current_setting('mind.financial_writer',true),'')='close'
    )) THEN
      RAISE EXCEPTION 'El período % está cerrado o en revisión. Reabrilo antes de modificar datos financieros.',p USING ERRCODE='23514';
    END IF;
    IF cutoff IS NOT NULL AND p >= cutoff AND (
      TG_ARGV[1]='excel' OR
      (TG_TABLE_NAME='provision_entries' AND COALESCE(new_row->>'import_batch',old_row->>'import_batch') IS NOT NULL) OR
      (TG_TABLE_NAME='fact_cost_month' AND COALESCE(new_row->>'data_source',old_row->>'data_source')<>'mind') OR
      (TG_TABLE_NAME='monthly_financial_summary' AND COALESCE(current_setting('mind.financial_writer',true),'')<>'close') OR
      (TG_ARGV[1]='source' AND NOT settlement AND (old_row->>'source'='excel' OR new_row->>'source'='excel')) OR
      (TG_TABLE_NAME='revenue_events' AND NOT settlement AND (old_row->>'source_tab'='google_sheets_sales' OR new_row->>'source_tab'='google_sheets_sales'))
    ) THEN
      RAISE EXCEPTION 'Excel no puede modificar el período %: Mind es la fuente desde %.',p,cutoff USING ERRCODE='23514';
    END IF;
    IF close_status='PRE_CLOSE' THEN
      UPDATE financial_close_periods SET status='OPEN',updated_at=now() WHERE period_key=p;
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('monthly_financial_summary','period_key','native'),
    ('fact_labor_month','period_key','native'),('fact_cost_month','period_key','native'),('fact_rc_month','period_key','native'),
    ('activo_entries','period_key','source'),('pasivo_entries','period_key','source'),('cashflow_transactions','period_key','source'),
    ('provision_entries','period_key','source'),('provision_movements','period_key','native'),('pl_adjustments','period_key','native'),
    ('exchange_rates','year_month','native'),('personnel_historical_costs','year_month','native'),
    ('revenue_events','revenue','native'),('financial_cost_plans','range','native'),
    ('fact_estimated_cost_month','month_key','excel'),('income_sot','month_key','excel'),('financial_sot','month_key','excel'),
    ('cash_movements','period_key','excel')
  ) AS t(tab,period_column,origin) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS financial_period_guard ON %I',r.tab);
    EXECUTE format('CREATE TRIGGER financial_period_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_financial_period(%L,%L)',r.tab,r.period_column,r.origin);
  END LOOP;
END $$;
`;
