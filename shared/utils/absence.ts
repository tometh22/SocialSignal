export const ABSENCE_TYPES = ["vacation", "sick", "other", "epical_day"] as const;
export const ABSENCE_STATUSES = ["pending", "approved", "rejected", "cancellation_requested", "cancelled"] as const;
export type AbsenceType = typeof ABSENCE_TYPES[number];
export type AbsenceStatus = typeof ABSENCE_STATUSES[number];

export const ABSENCE_ACTIONS = [
  "approve", "reject", "cancel_pending", "request_cancellation",
  "approve_cancellation", "reject_cancellation",
] as const;
export type AbsenceAction = typeof ABSENCE_ACTIONS[number];

export function absenceConsumesAllowance(type: AbsenceType): "vacation" | "epical" | null {
  if (type === "vacation") return "vacation";
  if (type === "epical_day") return "epical";
  return null;
}

export function transitionAbsence(status: AbsenceStatus, action: AbsenceAction): AbsenceStatus {
  const transitions: Partial<Record<AbsenceStatus, Partial<Record<AbsenceAction, AbsenceStatus>>>> = {
    pending: { approve: "approved", reject: "rejected", cancel_pending: "cancelled" },
    approved: { request_cancellation: "cancellation_requested" },
    cancellation_requested: { approve_cancellation: "cancelled", reject_cancellation: "approved" },
  };
  const next = transitions[status]?.[action];
  if (!next) throw new Error(`Transición inválida: ${status} → ${action}`);
  return next;
}

export function enumerateBusinessDays(start: string, end: string, holidayDates: ReadonlySet<string>): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    throw new Error("Rango de fechas inválido");
  }
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last) {
    const iso = cursor.toISOString().slice(0, 10);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6 && !holidayDates.has(iso)) dates.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function businessDaysByYear(start: string, end: string, holidayDates: ReadonlySet<string>): Record<number, number> {
  return enumerateBusinessDays(start, end, holidayDates).reduce<Record<number, number>>((result, date) => {
    const year = Number(date.slice(0, 4));
    result[year] = (result[year] ?? 0) + 1;
    return result;
  }, {});
}
