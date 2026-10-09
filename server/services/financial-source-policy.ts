/** One policy for scheduled jobs, manual imports and historical backfills. */
export const FINANCIAL_PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function excelImportBlocker(cutover: string | null, period?: string, status?: string | null): string | null {
  if (period !== undefined && !FINANCIAL_PERIOD.test(period)) return "El período debe usar el formato YYYY-MM.";
  if (["CLOSED", "IN_REVIEW"].includes(status ?? "")) return `El período ${period} está cerrado o en revisión.`;
  if (cutover && (!period || period >= cutover)) {
    return `Mind es la fuente financiera desde ${cutover}. Cargá los datos en Mind; Excel sólo admite backfill histórico anterior al corte.`;
  }
  return null;
}

export async function getFinancialCutover(): Promise<string | null> {
  const { pool } = await import("../db");
  const { rows } = await pool.query("SELECT description FROM system_config WHERE config_key='app_mode_cutover_date'");
  const value = rows[0]?.description;
  if (value != null && !FINANCIAL_PERIOD.test(value)) throw new Error("La fecha de corte financiero es inválida. Revisá Configuración.");
  return value ?? null;
}

/** No period means an operational import; a period is an explicit historical backfill. */
export async function assertExcelFinancialImportAllowed(period?: string): Promise<void> {
  const cutover = await getFinancialCutover();
  let status: string | undefined;
  if (period) {
    const { pool } = await import("../db");
    const { rows } = await pool.query("SELECT status FROM financial_close_periods WHERE period_key=$1", [period]);
    status = rows[0]?.status;
  }
  const reason = excelImportBlocker(cutover, period, status);
  if (reason) throw Object.assign(new Error(reason), { statusCode: 409 });
}
