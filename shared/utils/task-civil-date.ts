import { z } from "zod";

export function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Task dates describe days, independent of the viewer's timezone.
export const taskDateSchema = z.union([z.date(), z.string()]).transform((value, ctx) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !isValidCivilDate(value.slice(0, 10))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
    return z.NEVER;
  }
  if (typeof value === "string" && !isValidCivilDate(value) && !z.string().datetime({ offset: true }).safeParse(value).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Usá una fecha civil o un timestamp ISO válido" });
    return z.NEVER;
  }
  const date = value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
    return z.NEVER;
  }
  return date;
});

const dateBoundarySchema = z.string().refine(value => isValidCivilDate(value) || z.string().datetime({ offset: true }).safeParse(value).success && taskDateSchema.safeParse(value).success, "Fecha inválida");
export const taskDateWindowSchema = z.object({
  dateFrom: dateBoundarySchema.optional(), dateTo: dateBoundarySchema.optional(),
}).refine(value => !value.dateFrom || !value.dateTo || new Date(value.dateFrom) <= taskDateWindowEnd(value.dateTo), "Rango invertido");

export function taskDateWindowEnd(value: string): Date {
  return new Date(isValidCivilDate(value) ? `${value}T23:59:59.999Z` : value);
}

export function parseTaskCivilDate(value: string): Date {
  const day = value.slice(0, 10);
  return isValidCivilDate(day) ? new Date(`${day}T00:00:00`) : new Date(NaN);
}

/** A single endpoint occupies one day; two endpoints occupy their inclusive range. */
export function taskIsOnCivilDay(task: { startDate?: string | null; dueDate?: string | null }, day: string): boolean {
  const start = (task.startDate ?? task.dueDate)?.slice(0, 10);
  const end = (task.dueDate ?? task.startDate)?.slice(0, 10);
  return Boolean(start && end && start <= day && end >= day);
}
