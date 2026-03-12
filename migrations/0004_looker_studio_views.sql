-- Migration: Create optimized SQL views for Looker Studio / BI tools
-- These views provide pre-joined, denormalized data ready for direct BI consumption.
-- Connect Looker Studio to PostgreSQL and use these views as data sources.

-- ============================================================================
-- VIEW 1: vw_looker_pnl_mensual
-- P&L mensual completo para dashboard CFO
-- ============================================================================
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
ORDER BY mfs.year, mfs.month_number;


-- ============================================================================
-- VIEW 2: vw_looker_proyectos_mensual
-- Rendimiento por proyecto/mes con nombres de cliente y proyecto
-- ============================================================================
CREATE OR REPLACE VIEW vw_looker_proyectos_mensual AS
SELECT
  apm.period_key,
  dp.year,
  dp.month,

  -- Proyecto
  ap.id AS project_id,
  q.project_name,
  c.name AS client_name,
  ap.status AS project_status,
  ap.is_always_on_macro,
  ap.is_finished,

  -- Horas
  COALESCE(apm.est_hours, 0)::numeric(10,2) AS horas_estimadas,
  COALESCE(apm.total_asana_hours, 0)::numeric(10,2) AS horas_asana,
  COALESCE(apm.total_billing_hours, 0)::numeric(10,2) AS horas_facturadas,

  -- Costos
  COALESCE(apm.total_cost_ars, 0)::numeric(14,2) AS costo_total_ars,
  COALESCE(apm.total_cost_usd, 0)::numeric(12,2) AS costo_total_usd,

  -- Vista Operativa
  COALESCE(apm.view_operativa_revenue, 0)::numeric(12,2) AS revenue_operativo,
  COALESCE(apm.view_operativa_cost, 0)::numeric(12,2) AS costo_operativo,
  COALESCE(apm.view_operativa_denom, 0)::numeric(12,2) AS presupuesto,
  COALESCE(apm.view_operativa_markup, 0)::numeric(10,4) AS markup,
  COALESCE(apm.view_operativa_margin, 0)::numeric(10,4) AS margen,
  COALESCE(apm.view_operativa_budget_util, 0)::numeric(10,4) AS utilizacion_presupuesto,

  -- Margen calculado (revenue - cost)
  (COALESCE(apm.view_operativa_revenue, 0) - COALESCE(apm.view_operativa_cost, 0))::numeric(12,2) AS ganancia_operativa,

  -- Eficiencia de horas
  CASE WHEN COALESCE(apm.est_hours, 0) > 0
    THEN ROUND((COALESCE(apm.total_asana_hours, 0) / apm.est_hours * 100)::numeric, 2)
    ELSE NULL
  END AS eficiencia_horas_pct,

  -- RC datos
  COALESCE(apm.rc_revenue_native, 0)::numeric(12,2) AS rc_revenue,
  COALESCE(apm.rc_cost_native, 0)::numeric(12,2) AS rc_costo,
  COALESCE(apm.rc_price_native, 0)::numeric(12,2) AS rc_precio,
  COALESCE(apm.fx, 0)::numeric(10,4) AS tipo_cambio,

  apm.computed_at
FROM agg_project_month apm
JOIN dim_period dp ON dp.period_key = apm.period_key
JOIN active_projects ap ON ap.id = apm.project_id
JOIN quotations q ON q.id = ap.quotation_id
JOIN clients c ON c.id = ap.client_id
ORDER BY apm.period_key, c.name, q.project_name;


-- ============================================================================
-- VIEW 3: vw_looker_costos_mensual
-- Costos directos, indirectos y provisiones por mes
-- ============================================================================
CREATE OR REPLACE VIEW vw_looker_costos_mensual AS
SELECT
  fcm.period_key,
  dp.year,
  dp.month,

  -- Costos directos
  COALESCE(fcm.direct_usd, 0)::numeric(14,2) AS costos_directos_usd,
  COALESCE(fcm.direct_ars, 0)::numeric(14,2) AS costos_directos_ars,

  -- Costos indirectos operativos
  COALESCE(fcm.indirect_usd, 0)::numeric(14,2) AS costos_indirectos_usd,
  COALESCE(fcm.indirect_ars, 0)::numeric(14,2) AS costos_indirectos_ars,

  -- Provisiones contables
  COALESCE(fcm.provisions_usd, 0)::numeric(14,2) AS provisiones_usd,
  COALESCE(fcm.provisions_ars, 0)::numeric(14,2) AS provisiones_ars,

  -- Totales calculados
  (COALESCE(fcm.direct_usd, 0) + COALESCE(fcm.indirect_usd, 0))::numeric(14,2) AS costo_operativo_total_usd,
  (COALESCE(fcm.direct_usd, 0) + COALESCE(fcm.indirect_usd, 0) + COALESCE(fcm.provisions_usd, 0))::numeric(14,2) AS costo_contable_total_usd,

  -- Distribución porcentual
  CASE WHEN (COALESCE(fcm.direct_usd, 0) + COALESCE(fcm.indirect_usd, 0)) > 0
    THEN ROUND((COALESCE(fcm.direct_usd, 0) / (COALESCE(fcm.direct_usd, 0) + COALESCE(fcm.indirect_usd, 0)) * 100)::numeric, 2)
    ELSE 0
  END AS pct_directos,

  CASE WHEN (COALESCE(fcm.direct_usd, 0) + COALESCE(fcm.indirect_usd, 0)) > 0
    THEN ROUND((COALESCE(fcm.indirect_usd, 0) / (COALESCE(fcm.direct_usd, 0) + COALESCE(fcm.indirect_usd, 0)) * 100)::numeric, 2)
    ELSE 0
  END AS pct_indirectos,

  -- Auditoría
  fcm.source_rows_count,
  fcm.direct_rows_count,
  fcm.indirect_rows_count,
  fcm.provisions_rows_count,
  fcm.etl_timestamp
FROM fact_cost_month fcm
JOIN dim_period dp ON dp.period_key = fcm.period_key
ORDER BY dp.year, dp.month;


-- ============================================================================
-- VIEW 4: vw_looker_equipo_mensual
-- Horas y costos por persona/proyecto/mes
-- ============================================================================
CREATE OR REPLACE VIEW vw_looker_equipo_mensual AS
SELECT
  flm.period_key,
  dp.year,
  dp.month,

  -- Proyecto
  ap.id AS project_id,
  q.project_name,
  c.name AS client_name,

  -- Persona
  p.id AS person_id,
  p.name AS persona,
  flm.role_name AS rol,

  -- Horas
  COALESCE(flm.target_hours, 0)::numeric(10,2) AS horas_target,
  COALESCE(flm.asana_hours, 0)::numeric(10,2) AS horas_asana,
  COALESCE(flm.billing_hours, 0)::numeric(10,2) AS horas_facturadas,

  -- Costos
  COALESCE(flm.hourly_rate_ars, 0)::numeric(10,2) AS tarifa_hora_ars,
  COALESCE(flm.cost_ars, 0)::numeric(12,2) AS costo_ars,
  COALESCE(flm.cost_usd, 0)::numeric(12,2) AS costo_usd,
  COALESCE(flm.fx, 0)::numeric(10,4) AS tipo_cambio,

  -- Eficiencia
  CASE WHEN COALESCE(flm.target_hours, 0) > 0
    THEN ROUND((COALESCE(flm.asana_hours, 0) / flm.target_hours * 100)::numeric, 2)
    ELSE NULL
  END AS eficiencia_horas_pct,

  flm.loaded_at
FROM fact_labor_month flm
JOIN dim_period dp ON dp.period_key = flm.period_key
JOIN active_projects ap ON ap.id = flm.project_id
JOIN quotations q ON q.id = ap.quotation_id
JOIN clients c ON c.id = ap.client_id
LEFT JOIN personnel p ON p.id = flm.person_id
ORDER BY flm.period_key, c.name, q.project_name, p.name;


-- ============================================================================
-- VIEW 5: vw_looker_cashflow
-- Movimientos de caja para análisis de flujo
-- ============================================================================
CREATE OR REPLACE VIEW vw_looker_cashflow AS
SELECT
  cm.id,
  cm.date,
  cm.period_key,
  EXTRACT(YEAR FROM cm.date)::integer AS year,
  EXTRACT(MONTH FROM cm.date)::integer AS month,

  cm.bank,
  cm.currency AS moneda_original,
  cm.concept AS concepto,
  cm.category AS categoria,
  cm.reference AS referencia,
  cm.type AS tipo, -- IN / OUT

  -- Montos
  COALESCE(cm.amount_usd, 0)::numeric(14,2) AS monto_usd,

  -- Signado (positivo para IN, negativo para OUT)
  CASE WHEN cm.type = 'IN'
    THEN COALESCE(cm.amount_usd, 0)::numeric(14,2)
    ELSE (-1 * COALESCE(cm.amount_usd, 0))::numeric(14,2)
  END AS monto_neto_usd,

  cm.created_at
FROM cash_movements cm
ORDER BY cm.date DESC;


-- ============================================================================
-- VIEW 6: vw_looker_revenue_por_cliente
-- Revenue acumulado por cliente (para pie charts y rankings)
-- ============================================================================
CREATE OR REPLACE VIEW vw_looker_revenue_por_cliente AS
SELECT
  c.id AS client_id,
  c.name AS cliente,
  apm.period_key,
  dp.year,
  dp.month,

  COUNT(DISTINCT apm.project_id) AS cantidad_proyectos,
  SUM(COALESCE(apm.view_operativa_revenue, 0))::numeric(14,2) AS revenue_total,
  SUM(COALESCE(apm.view_operativa_cost, 0))::numeric(14,2) AS costo_total,
  SUM(COALESCE(apm.view_operativa_revenue, 0) - COALESCE(apm.view_operativa_cost, 0))::numeric(14,2) AS ganancia_total,

  CASE WHEN SUM(COALESCE(apm.view_operativa_revenue, 0)) > 0
    THEN ROUND((SUM(COALESCE(apm.view_operativa_revenue, 0) - COALESCE(apm.view_operativa_cost, 0))
          / SUM(apm.view_operativa_revenue) * 100)::numeric, 2)
    ELSE 0
  END AS margen_pct

FROM agg_project_month apm
JOIN active_projects ap ON ap.id = apm.project_id
JOIN clients c ON c.id = ap.client_id
JOIN dim_period dp ON dp.period_key = apm.period_key
GROUP BY c.id, c.name, apm.period_key, dp.year, dp.month
ORDER BY dp.year, dp.month, revenue_total DESC;
