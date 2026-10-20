import { z } from "zod";
import { civilDateInBuenosAires } from "./buenos-aires-week";
export const taskRecurrenceSchema = z.object({ frequency: z.enum(["weekly", "monthly"]), interval: z.number().int().min(1).max(12).default(1), weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional() }).strict();
export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;
export function recurrenceFromDescription(description?: string | null): TaskRecurrence | null {
  const text = (description ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!text.includes("recurrente")) return null;
  if (text.includes("lunes") && text.includes("miercoles")) return { frequency: "weekly", interval: 1, weekdays: [1, 3] };
  if (text.includes("lunes") && /15 dias|quincenal/.test(text)) return { frequency: "weekly", interval: 2, weekdays: [1] };
  if (/mensual/.test(text)) return { frequency: "monthly", interval: 1 };
  if (/semanal/.test(text)) return { frequency: "weekly", interval: 1 };
  return null;
}
export function nextRecurringTaskDate(rule: TaskRecurrence, previousDue: string | Date | null | undefined, now = new Date()): string {
  const today = civilDateInBuenosAires(now);
  const due = previousDue instanceof Date ? previousDue.toISOString().slice(0, 10) : previousDue?.slice(0, 10);
  const anchor = new Date(`${due || today}T12:00:00Z`);
  if (rule.frequency === "monthly") {
    const anchorDay = anchor.getUTCDate();
    for (let n = 1; n < 2400; n++) {
      const month = anchor.getUTCMonth() + rule.interval * n;
      const last = new Date(Date.UTC(anchor.getUTCFullYear(), month + 1, 0)).getUTCDate();
      const next = new Date(Date.UTC(anchor.getUTCFullYear(), month, Math.min(anchorDay, last), 12)).toISOString().slice(0, 10);
      if (next > today && (!due || next > due)) return next;
    }
  } else {
    const weekdays = rule.weekdays?.length ? rule.weekdays : [anchor.getUTCDay()];
    const monday = new Date(anchor); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const start = new Date(`${due && due > today ? due : today}T12:00:00Z`);
    for (let n = 1; n <= 366 * 20; n++) {
      const candidate = new Date(start); candidate.setUTCDate(candidate.getUTCDate() + n);
      const week = Math.floor((candidate.getTime() - monday.getTime()) / (7 * 86400000));
      if (week % rule.interval === 0 && weekdays.includes(candidate.getUTCDay())) return candidate.toISOString().slice(0, 10);
    }
  }
  throw new Error("No se pudo calcular la próxima fecha recurrente");
}

/** Repeat a dated range from its start, keeping its duration in civil days. */
export function nextRecurringTaskDates(
  rule: TaskRecurrence,
  previousStart: string | Date | null | undefined,
  previousDue: string | Date | null | undefined,
  now = new Date(),
): { startDate: string; dueDate: string } {
  const civilDay = (value: typeof previousStart) => value instanceof Date ? value.toISOString().slice(0, 10) : value?.slice(0, 10);
  const start = civilDay(previousStart);
  const due = civilDay(previousDue);
  if (!start || !due || start >= due) {
    const next = nextRecurringTaskDate(rule, due ?? start, now);
    return { startDate: next, dueDate: next };
  }

  const anchor = new Date(`${start}T12:00:00Z`);
  const duration = new Date(`${due}T12:00:00Z`).getTime() - anchor.getTime();
  // A multi-day occurrence repeats as a whole (e.g. Monday–Wednesday).
  // Weekday lists describe individual occurrences only for single-day tasks.
  const rangeRule = rule.frequency === "weekly" ? { ...rule, weekdays: [anchor.getUTCDay()] } : rule;
  const nextStart = nextRecurringTaskDate(rangeRule, start, now);
  const nextDue = new Date(new Date(`${nextStart}T12:00:00Z`).getTime() + duration);
  return { startDate: nextStart, dueDate: nextDue.toISOString().slice(0, 10) };
}

export function recurrenceLabel(rule: TaskRecurrence | null | undefined) {
  if (!rule) return "Sin repetición";
  if (rule.frequency === "monthly") return "Mensual";
  if (rule.interval === 2) return "Lunes cada dos semanas";
  if (rule.weekdays?.join(",") === "1,3") return "Lunes y miércoles";
  return "Semanal";
}
