const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCivilDate(value: string): Date {
  const match = CIVIL_DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid civil date: ${value}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatCivilDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function currentCivilWeekRange(
  now = new Date(),
  timeZone = "America/Argentina/Buenos_Aires",
): { dateFrom: string; dateTo: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  const localDate = parseCivilDate(`${part("year")}-${part("month")}-${part("day")}`);
  const mondayOffset = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - mondayOffset);
  const dateFrom = formatCivilDate(localDate);
  localDate.setDate(localDate.getDate() + 6);
  return { dateFrom, dateTo: formatCivilDate(localDate) };
}
