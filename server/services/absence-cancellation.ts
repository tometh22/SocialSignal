import { sql } from "drizzle-orm";
import { isValidAbsenceDate } from "../../shared/utils/absence";

export function absencePeriods(start: string, end: string): string[] {
  if (!isValidAbsenceDate(start) || !isValidAbsenceDate(end) || start > end) throw new Error("Rango de fechas inválido");
  const periods: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T12:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    periods.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return periods;
}

/** Shares the finance lock with closing/publication. Never silently reopens a period. */
export async function guardAbsenceCancellation(tx: { execute: (query: any) => Promise<any> }, personId: number, start: string, end: string) {
  for (const period of absencePeriods(start, end)) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + period}))`);
    const result = await tx.execute(sql`
      SELECT EXISTS (SELECT 1 FROM financial_close_periods WHERE period_key=${period} AND status IN ('CLOSED','IN_REVIEW'))
        OR EXISTS (SELECT 1 FROM payroll_periods WHERE period=${period} AND state='cut')
        OR EXISTS (SELECT 1 FROM personnel_monthly_settlements WHERE personnel_id=${personId} AND period=${period} AND status='published') AS blocked
    `);
    if (result.rows[0]?.blocked) throw Object.assign(new Error(`El período ${period} tiene un cierre o liquidación bloqueada. Coordiná su reapertura antes de cancelar la ausencia.`), { status: 409 });
  }
}
