/** Month arithmetic on "YYYY-MM" keys, shared by server and client. */
export function addMonths(periodKey: string, delta: number): string {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** system_config key holding the first month that is reported only from Mind ("YYYY-MM" in description). */
export const FINANCE_NATIVE_START_KEY = "finance_native_start_period";
export const isPeriodKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
