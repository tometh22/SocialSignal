export type AvailabilityAbsence = { personnelId?: number | null; startDate: string; endDate: string; status?: string | null };

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sólo las ausencias aprobadas de la persona restan disponibilidad (no pendientes, rechazadas ni canceladas). */
export function approvedAbsenceRanges(absences: AvailabilityAbsence[], personnelId: number) {
  return absences
    .filter((a) => Number(a.personnelId) === personnelId && a.status === "approved")
    .map((a) => ({ start: (a.startDate || "").slice(0, 10), end: (a.endDate || "").slice(0, 10) }));
}

/**
 * Días hábiles (lunes a viernes, sin feriados) entre dos fechas civiles `YYYY-MM-DD` inclusive,
 * y cuántos de ellos caen dentro de un rango de ausencia. La comparación es por string para no
 * perder el último día por corrimiento de zona horaria.
 */
export function countWorkdays(
  from: string,
  to: string,
  holidayKeys: Set<string>,
  absenceRanges: { start: string; end: string }[] = [],
) {
  const [fy, fm, fd] = from.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = to.slice(0, 10).split("-").map(Number);
  const cursor = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  let workdays = 0;
  let absentWorkdays = 0;
  while (cursor <= end) {
    const dow = cursor.getDay();
    const key = dayKey(cursor);
    if (dow !== 0 && dow !== 6 && !holidayKeys.has(key)) {
      workdays++;
      if (absenceRanges.some((r) => key >= r.start && key <= r.end)) absentWorkdays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { workdays, absentWorkdays };
}
