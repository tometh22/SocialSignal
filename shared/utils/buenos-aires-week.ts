const BUENOS_AIRES_TIME_ZONE = "America/Argentina/Buenos_Aires";

function civilDateInBuenosAires(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUENOS_AIRES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function currentBuenosAiresWeek(now = new Date()): { from: string; to: string } {
  const civilToday = civilDateInBuenosAires(now);
  const cursor = new Date(`${civilToday}T12:00:00Z`);
  const mondayOffset = (cursor.getUTCDay() + 6) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - mondayOffset);
  const from = cursor.toISOString().slice(0, 10);
  cursor.setUTCDate(cursor.getUTCDate() + 6);
  return { from, to: cursor.toISOString().slice(0, 10) };
}

export function isCompletedInCurrentBuenosAiresWeek(
  completedAt: string | Date | null | undefined,
  now = new Date(),
): boolean {
  if (!completedAt) return false;
  const completion = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(completion.getTime())) return false;
  const completedDate = civilDateInBuenosAires(completion);
  const week = currentBuenosAiresWeek(now);
  return completedDate >= week.from && completedDate <= week.to;
}
