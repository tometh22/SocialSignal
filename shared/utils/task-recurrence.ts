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
export function recurrenceLabel(rule: TaskRecurrence | null | undefined) {
  if (!rule) return "Sin repetición";
  if (rule.frequency === "monthly") return "Mensual";
  if (rule.interval === 2) return "Lunes cada dos semanas";
  if (rule.weekdays?.join(",") === "1,3") return "Lunes y miércoles";
  return "Semanal";
}
