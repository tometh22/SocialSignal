import { pool } from "../db";

/**
 * One source per month, shared by every Finance surface.
 *
 * A month is reported from the Master while it has a Master summary and Mind has
 * neither a close (any status) nor native sales loaded through Carga financiera.
 * As soon as either exists, the month belongs to Mind: the Master import stops
 * touching it and pages read only the records created in Mind.
 *
 * From the switchover month (system_config "finance_native_start_period", set
 * on the Saldos iniciales page) every month belongs to Mind even if the Máster
 * still has data for it. The older app_mode_cutover_date is not used here: it
 * marks when Mind started receiving operational data, not a finance switchover.
 */
export const MASTER_PERIODS_SQL = `
  SELECT m.period_key
    FROM monthly_financial_summary m
    LEFT JOIN financial_close_periods c ON c.period_key = m.period_key
   WHERE c.period_key IS NULL
     AND m.facturacion_total IS NOT NULL
     AND m.period_key < COALESCE((SELECT description FROM system_config WHERE config_key = 'finance_native_start_period' AND description ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' LIMIT 1), '9999-12')
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

export async function getNativeStartPeriod(runner: Runner = pool): Promise<string | null> {
  const { rows } = await runner.query(`SELECT description FROM system_config WHERE config_key = 'finance_native_start_period' LIMIT 1`);
  const value = rows[0]?.description;
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}
