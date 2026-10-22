export function lastPayrollBusinessDay(period: string, holidays: string[]): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Período inválido");
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0, 12));
  const excluded = new Set(holidays);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || excluded.has(date.toISOString().slice(0, 10))) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
