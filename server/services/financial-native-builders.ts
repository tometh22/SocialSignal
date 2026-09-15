import { sql } from "drizzle-orm";
import { db } from "../db";

type SqlRunner = Pick<typeof db, "execute">;

/**
 * Reconstruye las tablas estrella del período desde fuentes nativas. Es
 * idempotente y puede correr después de cada publicación o durante pre-cierre.
 */
export async function rebuildNativeFinancialFacts(periodKey: string, runner: SqlRunner = db): Promise<void> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) return;
  const [year, month] = periodKey.split("-").map(Number);
  const firstDay = `${periodKey}-01`;

  await runner.execute(sql`
    INSERT INTO dim_period(period_key, year, month, first_day)
    VALUES (${periodKey}, ${year}, ${month}, ${firstDay}::date)
    ON CONFLICT (period_key) DO NOTHING
  `);

  await runner.execute(sql`
    WITH fx AS (
      SELECT COALESCE((SELECT rate::numeric FROM exchange_rates WHERE year=${year} AND month=${month} AND is_active=true ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END, updated_at DESC, id DESC LIMIT 1), 1) AS rate
    ), labor_by_person AS (
      SELECT person_id, COALESCE(sum(cost_usd),0) model_usd, COALESCE(sum(cost_ars),0) model_ars, count(*)::int rows
      FROM fact_labor_month WHERE period_key=${periodKey}
      GROUP BY person_id
    ), labor AS (
      -- El costo del equipo se devenga 100% desde el cierre de Operaciones.
      -- La modalidad, fecha e importe de las facturas sólo alimentan Pasivo.
      SELECT
        COALESCE(sum(model_usd),0) direct_usd,
        COALESCE(sum(model_ars),0) direct_ars,
        COALESCE(sum(rows),0)::int rows
      FROM labor_by_person
    ), bills AS (
      SELECT
        COALESCE(sum(CASE WHEN cost_treatment='direct' THEN COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END,monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END),0) direct_usd,
        COALESCE(sum(CASE WHEN cost_treatment IN ('indirect','unclassified') THEN COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END,monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END),0) indirect_usd,
        COALESCE(sum(CASE WHEN cost_treatment='provision' THEN COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END,monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0),0) ELSE 0 END),0) provision_usd,
        COALESCE(sum(CASE WHEN cost_treatment='direct' THEN COALESCE(CASE WHEN currency='ARS' THEN net_amount ELSE net_amount*(SELECT rate FROM fx) END,monto_ars,CASE WHEN currency='USD' THEN monto_usd*(SELECT rate FROM fx) ELSE original_amount END,0) ELSE 0 END),0) direct_ars,
        COALESCE(sum(CASE WHEN cost_treatment IN ('indirect','unclassified') THEN COALESCE(CASE WHEN currency='ARS' THEN net_amount ELSE net_amount*(SELECT rate FROM fx) END,monto_ars,CASE WHEN currency='USD' THEN monto_usd*(SELECT rate FROM fx) ELSE original_amount END,0) ELSE 0 END),0) indirect_ars,
        count(*)::int rows,
        count(*) FILTER (WHERE cost_treatment='direct')::int direct_rows,
        count(*) FILTER (WHERE cost_treatment IN ('indirect','unclassified'))::int indirect_rows,
        count(*) FILTER (WHERE cost_treatment='provision')::int provision_rows
      FROM pasivo_entries WHERE period_key=${periodKey} AND voided_at IS NULL
    ), provision_lines AS (
      SELECT pm.amount::numeric amount, pm.currency
      FROM provision_movements pm
      JOIN provision_entries pe ON pe.id=pm.provision_id
      WHERE pm.period_key=${periodKey}
        AND pe.status IN ('APPROVED','ACTIVE','RELEASED')
      UNION ALL
      SELECT CASE WHEN pe.tipo='RECUPERO' THEN -pe.monto_provision::numeric ELSE pe.monto_provision::numeric END amount, pe.currency
      FROM provision_entries pe
      WHERE pe.period_key=${periodKey}
        AND pe.status IN ('APPROVED','ACTIVE','RELEASED')
        AND NOT EXISTS (
          SELECT 1 FROM provision_movements pm
          WHERE pm.provision_id=pe.id AND pm.movement_type='initial'
        )
    ), provisions AS (
      SELECT
        COALESCE(sum(CASE WHEN currency='ARS' THEN amount/(SELECT rate FROM fx) ELSE amount END),0) usd,
        COALESCE(sum(CASE WHEN currency='ARS' THEN amount ELSE amount*(SELECT rate FROM fx) END),0) ars,
        count(*)::int rows
      FROM provision_lines
    )
    INSERT INTO fact_cost_month(period_key,direct_usd,direct_ars,indirect_usd,indirect_ars,provisions_usd,provisions_ars,amount_usd,amount_ars,source_rows_count,direct_rows_count,indirect_rows_count,provisions_rows_count,etl_timestamp)
    SELECT ${periodKey}, labor.direct_usd+bills.direct_usd, labor.direct_ars+bills.direct_ars,
      bills.indirect_usd,bills.indirect_ars,bills.provision_usd+provisions.usd,provisions.ars,
      labor.direct_usd+bills.direct_usd+bills.indirect_usd+bills.provision_usd+provisions.usd,
      labor.direct_ars+bills.direct_ars+bills.indirect_ars+provisions.ars,
      labor.rows+bills.rows+provisions.rows, labor.rows+bills.direct_rows,bills.indirect_rows,bills.provision_rows+provisions.rows,now()
    FROM labor,bills,provisions
    ON CONFLICT (period_key) DO UPDATE SET
      direct_usd=EXCLUDED.direct_usd,direct_ars=EXCLUDED.direct_ars,indirect_usd=EXCLUDED.indirect_usd,indirect_ars=EXCLUDED.indirect_ars,
      provisions_usd=EXCLUDED.provisions_usd,provisions_ars=EXCLUDED.provisions_ars,amount_usd=EXCLUDED.amount_usd,amount_ars=EXCLUDED.amount_ars,
      source_rows_count=EXCLUDED.source_rows_count,direct_rows_count=EXCLUDED.direct_rows_count,indirect_rows_count=EXCLUDED.indirect_rows_count,
      provisions_rows_count=EXCLUDED.provisions_rows_count,etl_timestamp=now()
  `);

  await runner.execute(sql`DELETE FROM fact_rc_month WHERE period_key=${periodKey}`);
  await runner.execute(sql`
    WITH fx AS (
      SELECT COALESCE((SELECT rate::numeric FROM exchange_rates WHERE year=${year} AND month=${month} AND is_active=true ORDER BY CASE WHEN rate_type='end_of_month' THEN 0 WHEN rate_type='average' THEN 1 ELSE 2 END,updated_at DESC,id DESC LIMIT 1),1) rate
    ), revenue AS (
      SELECT project_id,
        sum(CASE
          WHEN delivery_curve='linear' AND delivery_start IS NOT NULL AND delivery_end IS NOT NULL AND ${periodKey} BETWEEN delivery_start AND delivery_end
            THEN amount_usd / NULLIF(((left(delivery_end,4)::int-left(delivery_start,4)::int)*12 + right(delivery_end,2)::int-right(delivery_start,2)::int + 1),0)
          WHEN COALESCE(delivery_start,invoice_period)=${periodKey} THEN amount_usd ELSE 0 END) revenue_usd,
        sum(CASE
          WHEN currency='ARS' AND delivery_curve='linear' AND delivery_start IS NOT NULL AND delivery_end IS NOT NULL AND ${periodKey} BETWEEN delivery_start AND delivery_end
            THEN amount_native / NULLIF(((left(delivery_end,4)::int-left(delivery_start,4)::int)*12 + right(delivery_end,2)::int-right(delivery_start,2)::int + 1),0)
          WHEN currency='ARS' AND COALESCE(delivery_start,invoice_period)=${periodKey} THEN amount_native
          ELSE 0 END) revenue_ars
      FROM revenue_events
      WHERE project_id IS NOT NULL AND status <> 'cancelled'
        AND (invoice_period=${periodKey} OR ${periodKey} BETWEEN COALESCE(delivery_start,invoice_period) AND COALESCE(delivery_end,delivery_start,invoice_period))
      GROUP BY project_id
    ), modeled_labor AS (
      SELECT project_id,person_id,sum(COALESCE(cost_usd,0)) model_usd,sum(COALESCE(cost_ars,0)) model_ars
      FROM fact_labor_month WHERE period_key=${periodKey} GROUP BY project_id,person_id
    ), labor AS (
      -- La distribución proyecto/Epical es la del cierre operativo. No vuelve a
      -- repartirse ni cambia cuando llega una factura.
      SELECT project_id, sum(model_usd) cost_usd, sum(model_ars) cost_ars
      FROM modeled_labor
      GROUP BY project_id
    ), bills AS (
      SELECT project_id,
        sum(COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END,monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0),0)) cost_usd,
        sum(COALESCE(CASE WHEN currency='ARS' THEN net_amount ELSE net_amount*(SELECT rate FROM fx) END,monto_ars,CASE WHEN currency='USD' THEN monto_usd*(SELECT rate FROM fx) ELSE original_amount END,0)) cost_ars
      FROM pasivo_entries WHERE period_key=${periodKey} AND voided_at IS NULL AND project_id IS NOT NULL AND cost_treatment='direct'
      GROUP BY project_id
    ), combined AS (
      SELECT COALESCE(revenue.project_id,labor.project_id,bills.project_id) project_id,
        COALESCE(revenue.revenue_usd,0) revenue_usd,COALESCE(revenue.revenue_ars,0) revenue_ars,
        COALESCE(labor.cost_usd,0)+COALESCE(bills.cost_usd,0) cost_usd,
        COALESCE(labor.cost_ars,0)+COALESCE(bills.cost_ars,0) cost_ars
      FROM revenue FULL OUTER JOIN labor USING(project_id) FULL OUTER JOIN bills USING(project_id)
    )
    INSERT INTO fact_rc_month(project_id,period_key,revenue_usd,cost_usd,revenue_ars,cost_ars,quote_native,fx_rate,price_native,fx,source_row_id,loaded_at)
    SELECT project_id,${periodKey},revenue_usd,cost_usd,revenue_ars,cost_ars,
      CASE WHEN revenue_ars<>0 THEN revenue_ars ELSE revenue_usd END,(SELECT rate FROM fx),
      CASE WHEN revenue_ars<>0 THEN revenue_ars ELSE revenue_usd END,(SELECT rate FROM fx),${'mind_native:' + periodKey},now()
    FROM combined
  `);
}
