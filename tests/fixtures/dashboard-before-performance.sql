
    WITH periods AS (
      SELECT invoice_period period_key FROM revenue_events WHERE status <> 'cancelled'
      UNION SELECT period_key FROM activo_entries WHERE voided_at IS NULL
      UNION SELECT period_key FROM pasivo_entries WHERE voided_at IS NULL
      UNION SELECT period_key FROM cashflow_transactions WHERE voided_at IS NULL
      UNION SELECT period_key FROM fact_cost_month
    )
    SELECT p.period_key,
      COALESCE((SELECT sum(amount_usd) FROM revenue_events WHERE invoice_period=p.period_key AND status<>'cancelled'),0)::float facturacion_total,
      COALESCE((SELECT direct_usd FROM fact_cost_month WHERE period_key=p.period_key),0)::float costos_directos,
      COALESCE((SELECT sum(cost_usd) FROM fact_labor_month WHERE period_key=p.period_key),0)::float costos_directos_operativos,
      COALESCE((SELECT indirect_usd FROM fact_cost_month WHERE period_key=p.period_key),0)::float costos_indirectos,
      COALESCE((SELECT provisions_usd FROM fact_cost_month WHERE period_key=p.period_key),0)::float gasto_provisiones,
      COALESCE((SELECT sum(CASE WHEN COALESCE(currency,CASE WHEN monto_usd IS NOT NULL THEN 'USD' ELSE 'ARS' END)='ARS' THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END) FROM activo_entries WHERE period_key<=p.period_key AND voided_at IS NULL),0)::float cuentas_cobrar_usd,
      COALESCE((SELECT sum(CASE WHEN COALESCE(currency,CASE WHEN monto_usd IS NOT NULL THEN 'USD' ELSE 'ARS' END)='ARS' THEN COALESCE(outstanding_amount,0)/NULLIF(cotizacion,0) ELSE COALESCE(outstanding_amount,0) END) FROM pasivo_entries WHERE period_key<=p.period_key AND voided_at IS NULL),0)::float cuentas_pagar_usd,
      COALESCE((SELECT sum(CASE WHEN currency='ARS' THEN COALESCE(remaining_amount,monto_provision,0)/NULLIF((SELECT rate FROM exchange_rates WHERE year=left(p.period_key,4)::int AND month=right(p.period_key,2)::int AND is_active=true ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 1),0) ELSE COALESCE(remaining_amount,monto_provision,0) END) FROM provision_entries WHERE period_key<=p.period_key AND status IN ('APPROVED','ACTIVE')),0)::float provision_liability,
      COALESCE((SELECT sum(CASE WHEN currency='ARS' THEN opening_balance/NULLIF((SELECT rate FROM exchange_rates WHERE year=left(p.period_key,4)::int AND month=right(p.period_key,2)::int AND is_active=true ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 1),0) ELSE opening_balance END) FROM financial_accounts WHERE is_active=true AND (opening_balance_date IS NULL OR opening_balance_date < (p.period_key || '-01')::date + interval '1 month')),0)::float opening_cash,
      COALESCE((SELECT sum(CASE WHEN tipo_movimiento='Ingreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) WHEN tipo_movimiento='Egreso' AND transfer_group_id IS NULL THEN -COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END) FROM cashflow_transactions WHERE period_key<=p.period_key AND source<>'excel' AND voided_at IS NULL),0)::float cumulative_cashflow,
      COALESCE((SELECT sum(CASE WHEN tipo_movimiento='Ingreso' AND transfer_group_id IS NULL THEN COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) WHEN tipo_movimiento='Egreso' AND transfer_group_id IS NULL THEN -COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END) FROM cashflow_transactions WHERE period_key=p.period_key AND voided_at IS NULL),0)::float cashflow_neto,
      COALESCE((SELECT status='CLOSED' FROM financial_close_periods WHERE period_key=p.period_key),false) is_closed
    FROM periods p
    WHERE p.period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    ORDER BY p.period_key
  