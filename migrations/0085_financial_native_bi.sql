-- Preserve the existing BI column contract; no live master dependency.
CREATE OR REPLACE VIEW vw_looker_pnl_mensual AS
SELECT
  mfs.period_key,
  mfs.year,
  mfs.month_number,
  mfs.month_label,

  -- Balance
  COALESCE(mfs.total_activo, 0)::numeric(14,2) AS total_activo,
  COALESCE(mfs.total_pasivo, 0)::numeric(14,2) AS total_pasivo,
  COALESCE(mfs.balance_neto, 0)::numeric(14,2) AS balance_neto,
  COALESCE(mfs.caja_total, 0)::numeric(14,2) AS caja_total,
  COALESCE(mfs.inversiones, 0)::numeric(14,2) AS inversiones,

  -- Cashflow
  COALESCE(mfs.cashflow_ingresos, 0)::numeric(14,2) AS cashflow_ingresos,
  COALESCE(mfs.cashflow_egresos, 0)::numeric(14,2) AS cashflow_egresos,
  COALESCE(mfs.cashflow_neto, 0)::numeric(14,2) AS cashflow_neto,

  -- Cuentas
  COALESCE(mfs.cuentas_cobrar_usd, 0)::numeric(12,2) AS cuentas_cobrar_usd,
  COALESCE(mfs.cuentas_pagar_usd, 0)::numeric(12,2) AS cuentas_pagar_usd,

  -- Facturación y costos
  COALESCE(mfs.facturacion_total, 0)::numeric(14,2) AS facturacion_total,
  COALESCE(mfs.costos_directos, 0)::numeric(14,2) AS costos_directos,
  COALESCE(mfs.costos_indirectos, 0)::numeric(14,2) AS costos_indirectos,

  -- Resultados
  COALESCE(mfs.ebit_operativo, 0)::numeric(14,2) AS ebit_operativo,
  COALESCE(mfs.beneficio_neto, 0)::numeric(14,2) AS beneficio_neto,
  COALESCE(mfs.markup_promedio, 0)::numeric(10,4) AS markup_promedio,

  -- Provisiones
  COALESCE(mfs.pasivo_facturacion_adelantada, 0)::numeric(14,2) AS provision_facturacion_adelantada,
  COALESCE(mfs.iva_compras, 0)::numeric(12,2) AS iva_compras,
  COALESCE(mfs.impuestos_usa, 0)::numeric(12,2) AS impuestos_usa,

  -- KPIs calculados
  CASE WHEN COALESCE(mfs.facturacion_total, 0) > 0
    THEN ROUND((COALESCE(mfs.ebit_operativo, 0) / mfs.facturacion_total * 100)::numeric, 2)
    ELSE 0
  END AS margen_ebit_pct,

  CASE WHEN COALESCE(mfs.facturacion_total, 0) > 0
    THEN ROUND((COALESCE(mfs.costos_directos, 0) / mfs.facturacion_total * 100)::numeric, 2)
    ELSE 0
  END AS costos_directos_pct,

  CASE WHEN COALESCE(mfs.facturacion_total, 0) > 0
    THEN ROUND(((COALESCE(mfs.facturacion_total, 0) - COALESCE(mfs.costos_directos, 0)) / mfs.facturacion_total * 100)::numeric, 2)
    ELSE 0
  END AS margen_bruto_pct,

  mfs.updated_at
FROM monthly_financial_summary mfs
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='app_mode_cutover_date')
   OR mfs.period_key < (SELECT description FROM system_config WHERE config_key='app_mode_cutover_date')
   OR EXISTS (SELECT 1 FROM financial_close_periods WHERE period_key=mfs.period_key AND status='CLOSED')
ORDER BY mfs.year, mfs.month_number;

-- BI retains historical cash and reads current movements from the native ledger.
CREATE OR REPLACE VIEW vw_looker_cashflow AS
WITH movements AS (
 SELECT id,date,period_key,bank,currency,concept,category,reference,type,amount_usd,created_at
 FROM cash_movements cm
 WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key='app_mode_cutover_date')
    OR cm.period_key < (SELECT description FROM system_config WHERE config_key='app_mode_cutover_date')
 UNION ALL
 SELECT -id,fecha,period_key,banco,moneda,concepto,NULL::text,external_id,
   CASE WHEN tipo_movimiento='Ingreso' THEN 'IN' ELSE 'OUT' END,
   COALESCE(monto_usd,monto_ars/NULLIF(cotizacion,0)),created_at
 FROM cashflow_transactions cf
 WHERE voided_at IS NULL AND transfer_group_id IS NULL AND source<>'excel'
   AND EXISTS (SELECT 1 FROM system_config WHERE config_key='app_mode_cutover_date' AND cf.period_key>=description)
)
SELECT id,date,period_key::varchar(10),EXTRACT(YEAR FROM date)::integer AS year,EXTRACT(MONTH FROM date)::integer AS month,
 bank::varchar(100),currency::varchar(20) AS moneda_original,concept::varchar(300) AS concepto,
 category::varchar(100) AS categoria,reference::varchar(200) AS referencia,type::varchar(10) AS tipo,
 amount_usd::numeric(14,2) AS monto_usd,
 (CASE WHEN type='IN' THEN amount_usd ELSE -amount_usd END)::numeric(14,2) AS monto_neto_usd,
 created_at
FROM movements ORDER BY date DESC;
