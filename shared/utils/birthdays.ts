export type BirthdayEntry = { name: string; month: number; day: number };
export type UpcomingBirthday = BirthdayEntry & { daysUntil: number; date: Date };

/** `YYYY-MM-DD` → mes/día. El año se ignora a propósito (no se expone). */
export function parseBirthdayMonthDay(value: string | null | undefined): { month: number; day: number } | null {
  const match = /^\d{4}-(\d{2})-(\d{2})(?:$|T)/.exec(String(value ?? "").trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  // 2000 es bisiesto: el 29/02 es válido; 30/02 o 31/04 no.
  const daysInMonth = new Date(2000, month, 0).getDate();
  if (day > daysInMonth) return null;
  return { month, day };
}

/** El 29/02 se celebra el 28/02 en los años no bisiestos (no el 1/03). */
function occurrenceInYear(month: number, day: number, year: number): Date {
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return new Date(year, month - 1, 28);
  return date;
}

export function nextBirthday(entry: Pick<BirthdayEntry, "month" | "day">, today: Date): { date: Date; daysUntil: number } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let date = occurrenceInYear(entry.month, entry.day, start.getFullYear());
  if (date < start) date = occurrenceInYear(entry.month, entry.day, start.getFullYear() + 1);
  return { date, daysUntil: Math.round((date.getTime() - start.getTime()) / 86_400_000) };
}

export function upcomingBirthdays(entries: BirthdayEntry[], today: Date, horizonDays = 30): UpcomingBirthday[] {
  return entries
    .map((entry) => ({ ...entry, ...nextBirthday(entry, today) }))
    .filter((entry) => entry.daysUntil <= horizonDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, "es"));
}
