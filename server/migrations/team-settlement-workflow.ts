export const teamSettlementWorkflowMigrationSql = String.raw`
ALTER TABLE personnel_monthly_settlements ADD COLUMN IF NOT EXISTS bonus_ars double precision NOT NULL DEFAULT 0;
ALTER TABLE personnel_monthly_settlements ADD COLUMN IF NOT EXISTS workflow jsonb NOT NULL DEFAULT '{"version":0,"usd":{"status":"draft"},"ars":{"status":"draft"},"extrasARS":0}'::jsonb;

-- Historical invoices keep their evidence. New invoices require explicit Operations authorization.
CREATE INDEX IF NOT EXISTS settlement_workflow_pending_idx ON personnel_monthly_settlements(period) WHERE status='published';

CREATE TABLE IF NOT EXISTS payroll_periods (
  period varchar(7) PRIMARY KEY CHECK(period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  state text NOT NULL CHECK(state IN ('open','cut')),
  cutoff_at timestamptz,
  issues jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION guard_payroll_hours() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item jsonb; month_key text;
BEGIN
  FOR item IN SELECT x FROM unnest(ARRAY[CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END]) x WHERE x IS NOT NULL ORDER BY left(x->>'date',7)
  LOOP
    month_key := left(item->>'date',7);
    PERFORM pg_advisory_xact_lock(hashtext('financial-period:'||month_key));
    IF EXISTS(SELECT 1 FROM payroll_periods WHERE period=month_key AND state='cut') THEN
      -- Cost synchronization is allowed; changing original hours is not.
      IF TG_OP='UPDATE' AND (to_jsonb(OLD)-ARRAY['total_cost','hourly_rate_at_time','exchange_rate_id','cost_sync_pending','updated_at'])=(to_jsonb(NEW)-ARRAY['total_cost','hourly_rate_at_time','exchange_rate_id','cost_sync_pending','updated_at']) THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Las horas de % tienen corte operativo. Operaciones debe reabrir el corte para corregirlas.',month_key USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS payroll_hours_cut ON time_entries;
CREATE TRIGGER payroll_hours_cut BEFORE INSERT OR UPDATE OR DELETE ON time_entries FOR EACH ROW EXECUTE FUNCTION guard_payroll_hours();
DROP TRIGGER IF EXISTS payroll_hours_cut ON task_time_entries;
CREATE TRIGGER payroll_hours_cut BEFORE INSERT OR UPDATE OR DELETE ON task_time_entries FOR EACH ROW EXECUTE FUNCTION guard_payroll_hours();

-- Reconcile contractual pay to operational project hours. Unallocated fixed
-- capacity and approved additions are overhead; invoices remain balance-only.
CREATE OR REPLACE VIEW financial_team_cost_month AS
WITH model AS (
  SELECT period_key,person_id,sum(COALESCE(cost_ars,0)) model_ars,sum(COALESCE(cost_usd,0)) model_usd
  FROM fact_labor_month WHERE left(source_row_id,4)='app_' GROUP BY period_key,person_id
), bases AS (
  SELECT to_char(make_date(year,month,1),'YYYY-MM') period_key,personnel_id person_id,COALESCE(grand_total_ars,total_cost)::numeric base_ars
  FROM monthly_closings
), combined AS (
  SELECT COALESCE(m.period_key,b.period_key) period_key,COALESCE(m.person_id,b.person_id) person_id,
    COALESCE(m.model_ars,0)::numeric model_ars,COALESCE(m.model_usd,0)::numeric model_usd,
    b.base_ars, s.status, s.bonus_usd::numeric bonus_usd,
    COALESCE(s.bonus_ars,0)::numeric+COALESCE(s.extras_ars,0)::numeric + CASE WHEN s.workflow->'ars'->>'status'='approved' THEN COALESCE((s.workflow->>'extrasARS')::numeric,0)+COALESCE(s.bank_commission_usd,0)::numeric*COALESCE(s.received_fx,0)::numeric ELSE 0 END additions_ars,
    fx.rate::numeric fx
  FROM model m FULL OUTER JOIN bases b USING(period_key,person_id)
  LEFT JOIN personnel_monthly_settlements s ON s.personnel_id=COALESCE(m.person_id,b.person_id) AND s.period=COALESCE(m.period_key,b.period_key) AND s.status='published'
  LEFT JOIN LATERAL (SELECT rate FROM exchange_rates WHERE year=left(COALESCE(m.period_key,b.period_key),4)::int AND month=right(COALESCE(m.period_key,b.period_key),2)::int AND is_active=true AND rate>0 ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 1) fx ON true
)
SELECT period_key,person_id,
  CASE WHEN base_ars IS NULL THEN model_ars ELSE LEAST(model_ars,base_ars) END direct_ars,
  CASE WHEN base_ars IS NULL THEN model_usd ELSE LEAST(model_ars,base_ars)/NULLIF(fx,0) END direct_usd,
  GREATEST(COALESCE(base_ars,model_ars)-model_ars,0)+COALESCE(additions_ars,0)+CASE WHEN COALESCE(bonus_usd,0)>0 THEN bonus_usd*fx ELSE 0 END indirect_ars,
  GREATEST(COALESCE(base_ars,model_ars)-model_ars,0)/NULLIF(fx,0)+COALESCE(additions_ars,0)/NULLIF(fx,0)+COALESCE(bonus_usd,0) indirect_usd,
  CASE WHEN model_ars>0 AND base_ars IS NOT NULL THEN LEAST(1,base_ars/model_ars) ELSE 1 END allocation_factor
FROM combined;

CREATE OR REPLACE VIEW financial_payroll_pending AS
WITH expected AS (
 SELECT to_char(make_date(year,month,1),'YYYY-MM') period_key,personnel_id person_id FROM monthly_closings
 UNION SELECT period_key,person_id FROM fact_labor_month WHERE left(source_row_id,4)='app_' AND COALESCE(asana_hours,0)>0
)
SELECT e.period_key,e.person_id
FROM expected e LEFT JOIN personnel_monthly_settlements s ON s.period=e.period_key AND s.personnel_id=e.person_id
WHERE s.status IS DISTINCT FROM 'published' OR s.workflow->'ars'->>'status' IS DISTINCT FROM 'approved'
  OR ((s.usd_percentage>0 OR s.bonus_usd>0) AND s.workflow->'usd'->>'status' IS DISTINCT FROM 'approved')
  OR (COALESCE((s.workflow->'usd'->>'amount')::numeric,0)>0 AND NOT EXISTS(SELECT 1 FROM personal_monthly_invoices i WHERE i.settlement_id=s.id AND i.invoice_currency='USD' AND i.approval_status='approved'))
  OR (COALESCE((s.workflow->'ars'->>'amount')::numeric,0)>0 AND NOT EXISTS(SELECT 1 FROM personal_monthly_invoices i WHERE i.settlement_id=s.id AND i.invoice_currency='ARS' AND i.approval_status='approved'));

INSERT INTO system_config(config_key,config_value,description) VALUES('payroll_automation_start',1,to_char(current_date,'YYYY-MM')) ON CONFLICT(config_key) DO NOTHING;
`;
