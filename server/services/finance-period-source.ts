import { pool } from "../db";

/**
 * One source per month, shared by every Finance surface.
 *
 * A month is reported from the Master while it has a Master summary and Mind has
 * neither a close (any status) nor native sales loaded through Carga financiera.
 * As soon as either exists, the month belongs to Mind: the Master import stops
 * touching it and pages read only the records created in Mind.
 *
 * The cutover date is not used here on purpose: it marks when Mind may start
 * receiving native data, not proof that a month already migrated.
 */
export const MASTER_PERIODS_SQL = `
  SELECT m.period_key
    FROM monthly_financial_summary m
    LEFT JOIN financial_close_periods c ON c.period_key = m.period_key
   WHERE c.period_key IS NULL
     AND m.facturacion_total IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM revenue_events r
        WHERE r.invoice_period = m.period_key AND r.source_tab = 'mind_intake'
     )
   ORDER BY m.period_key`;

type Runner = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export async function getMasterSourcedPeriods(runner: Runner = pool): Promise<string[]> {
  const { rows } = await runner.query(MASTER_PERIODS_SQL);
  return rows.map(row => String(row.period_key));
}

export type FinancePeriodSource = "master" | "mind";

export async function getPeriodSource(periodKey: string, runner: Runner = pool): Promise<FinancePeriodSource> {
  const { rows } = await runner.query(`SELECT 1 FROM (${MASTER_PERIODS_SQL}) p WHERE p.period_key = $1`, [periodKey]);
  return rows.length ? "master" : "mind";
}

/** SQL predicate selecting the rows that belong to the period's source. */
export const ledgerSourcePredicate = (source: FinancePeriodSource, column = "source") =>
  source === "master" ? `${column} = 'excel'` : `${column} <> 'excel'`;
