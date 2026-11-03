// Preaggregate each ledger once, then compute historical balances with window functions.
export const NATIVE_DASHBOARD_SQL = `
    WITH periods AS (
      SELECT invoice_period period_key FROM revenue_events WHERE status <> 'cancelled'
      UNION SELECT period_key FROM activo_entries WHERE voided_at IS NULL
      UNION SELECT period_key FROM pasivo_entries WHERE voided_at IS NULL
      UNION SELECT period_key FROM cashflow_transactions WHERE voided_at IS NULL
      UNION SELECT period_key FROM fact_cost_month
    ), ledger_periods AS (
      SELECT period_key FROM periods
      UNION SELECT period_key FROM provision_entries WHERE status IN ('APPROVED','ACTIVE')
    ), revenue AS (
      SELECT invoice_period period_key, sum(amount_usd) amount FROM revenue_events
      WHERE status <> 'cancelled' GROUP BY invoice_period
    ), labor AS (
      SELECT period_key, sum(cost_usd) amount FROM fact_labor_month GROUP BY period_key
    ), receivables AS (
      SELECT period_key, sum(CASE WHEN COALESCE(currency,CASE WHEN monto_usd IS NOT NULL THEN 'USD' ELSE 'ARS' END)='ARS'
        THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END) amount
      FROM activo_entries WHERE voided_at IS NULL GROUP BY period_key
    ), payables AS (
      SELECT period_key, sum(CASE WHEN COALESCE(currency,CASE WHEN monto_usd IS NOT NULL THEN 'USD' ELSE 'ARS' END)='ARS'
        THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END) amount
      FROM pasivo_entries WHERE voided_at IS NULL GROUP BY period_key
    ), provisions AS (
      SELECT period_key,
        sum(CASE WHEN currency='ARS' THEN COALESCE(remaining_amount,monto_provision,0) ELSE 0 END) ars,
        sum(CASE WHEN currency='ARS' THEN 0 ELSE COALESCE(remaining_amount,monto_provision,0) END) usd
      FROM provision_entries WHERE status IN ('APPROVED','ACTIVE') GROUP BY period_key
    ), cash AS (
      SELECT period_key,
        sum(CASE WHEN tipo_movimiento='Ingreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0)
          WHEN tipo_movimiento='Egreso' AND transfer_group_id IS NULL THEN -COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END) amount,
        sum(CASE WHEN source<>'excel' AND transfer_group_id IS NULL THEN
          CASE WHEN tipo_movimiento='Ingreso' THEN COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0)
            WHEN tipo_movimiento='Egreso' THEN -COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END ELSE 0 END) native_amount
      FROM cashflow_transactions WHERE voided_at IS NULL GROUP BY period_key
    ), running AS (
      SELECT p.period_key,
        sum(COALESCE(r.amount,0)) OVER w cuentas_cobrar_usd,
        sum(COALESCE(y.amount,0)) OVER w cuentas_pagar_usd,
        sum(COALESCE(v.ars,0)) OVER w provision_ars,
        sum(COALESCE(v.usd,0)) OVER w provision_usd,
        sum(COALESCE(c.native_amount,0)) OVER w cumulative_cashflow,
        COALESCE(c.amount,0) cashflow_neto
      FROM ledger_periods p
      LEFT JOIN receivables r USING(period_key) LEFT JOIN payables y USING(period_key)
      LEFT JOIN provisions v USING(period_key) LEFT JOIN cash c USING(period_key)
      WINDOW w AS (ORDER BY p.period_key ROWS UNBOUNDED PRECEDING)
    )
    SELECT p.period_key,
      COALESCE(r.amount,0)::float facturacion_total,
      COALESCE(f.direct_usd,0)::float costos_directos,
      COALESCE(l.amount,0)::float costos_directos_operativos,
      COALESCE(f.indirect_usd,0)::float costos_indirectos,
      COALESCE(f.provisions_usd,0)::float gasto_provisiones,
      COALESCE(p.cuentas_cobrar_usd,0)::float cuentas_cobrar_usd,
      COALESCE(p.cuentas_pagar_usd,0)::float cuentas_pagar_usd,
      (COALESCE(p.provision_ars/NULLIF(fx.rate,0),0)+p.provision_usd)::float provision_liability,
      COALESCE((SELECT sum(CASE WHEN currency='ARS' THEN opening_balance/NULLIF(fx.rate,0) ELSE opening_balance END)
        FROM financial_accounts WHERE is_active=true AND (opening_balance_date IS NULL OR opening_balance_date < (p.period_key || '-01')::date + interval '1 month')),0)::float opening_cash,
      p.cumulative_cashflow::float cumulative_cashflow, p.cashflow_neto::float cashflow_neto,
      COALESCE(closed.status='CLOSED',false) is_closed
    FROM running p
    JOIN periods selected USING(period_key)
    LEFT JOIN revenue r USING(period_key) LEFT JOIN labor l USING(period_key)
    LEFT JOIN fact_cost_month f USING(period_key) LEFT JOIN financial_close_periods closed USING(period_key)
    LEFT JOIN LATERAL (
      SELECT rate FROM exchange_rates WHERE year=left(p.period_key,4)::int AND month=right(p.period_key,2)::int AND is_active=true
      ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 1
    ) fx ON true
    WHERE p.period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    ORDER BY p.period_key
  `;
