export const payrollDocumentModesMigrationSql = String.raw`
-- Currency and the explicitly published invoice requirement determine pending work.
-- No business records are rewritten; legacy workflows still require invoices.
CREATE OR REPLACE VIEW financial_payroll_pending AS
WITH expected AS (
 SELECT to_char(make_date(year,month,1),'YYYY-MM') period_key,personnel_id person_id FROM monthly_closings
 UNION SELECT period_key,person_id FROM fact_labor_month WHERE left(source_row_id,4)='app_' AND COALESCE(asana_hours,0)>0
)
SELECT e.period_key,e.person_id
FROM expected e LEFT JOIN personnel_monthly_settlements s ON s.period=e.period_key AND s.personnel_id=e.person_id
WHERE s.status IS DISTINCT FROM 'published'
  OR (s.billing_currency_snapshot<>'USD' AND s.workflow->'ars'->>'status' IS DISTINCT FROM 'approved')
  OR ((s.usd_percentage>0 OR s.bonus_usd>0) AND s.workflow->'usd'->>'status' IS DISTINCT FROM 'approved')
  OR (COALESCE(s.workflow->>'requiresInvoice','true')<>'false' AND (
    (COALESCE((s.workflow->'usd'->>'amount')::numeric,0)>0 AND NOT EXISTS(SELECT 1 FROM personal_monthly_invoices i WHERE i.settlement_id=s.id AND i.invoice_currency='USD' AND i.approval_status='approved'))
    OR (COALESCE((s.workflow->'ars'->>'amount')::numeric,0)>0 AND NOT EXISTS(SELECT 1 FROM personal_monthly_invoices i WHERE i.settlement_id=s.id AND i.invoice_currency='ARS' AND i.approval_status='approved'))
  ));
`;
