import type { Task } from "@shared/schema";
import { nextRecurringTaskDates, taskRecurrenceSchema } from "@shared/utils/task-recurrence";

type RecurringOccurrence = Pick<Task, "id" | "projectId" | "startDate" | "dueDate" | "recurrenceRule" | "recurrenceSourceTaskId">;

function occurrenceDate(task: RecurringOccurrence): Date | null {
  const start = task.startDate?.toISOString().slice(0, 10);
  const due = task.dueDate?.toISOString().slice(0, 10);
  const day = start && due && start < due ? start : due ?? start;
  return day ? new Date(`${day}T12:00:00Z`) : null;
}

function monthlyAnchorDay(current: RecurringOccurrence, history: readonly RecurringOccurrence[], interval: number): number | undefined {
  const currentDate = occurrenceDate(current);
  if (!currentDate) return undefined;
  const byId = new Map(history.map(task => [task.id, task]));
  const visited = new Set([current.id]);
  const dates = [currentDate];
  let cursor = current;

  // The existing source links retain the original day without new stored fields.
  while (cursor.recurrenceSourceTaskId != null && !visited.has(cursor.recurrenceSourceTaskId)) {
    const source = byId.get(cursor.recurrenceSourceTaskId);
    if (!source || source.projectId !== current.projectId) break;
    const sourceRule = taskRecurrenceSchema.safeParse(source.recurrenceRule);
    if (!sourceRule.success || sourceRule.data.frequency !== "monthly" || sourceRule.data.interval !== interval) break;
    const sourceDate = occurrenceDate(source);
    if (!sourceDate) break;
    const childDate = dates[dates.length - 1];
    const months = (childDate.getUTCFullYear() - sourceDate.getUTCFullYear()) * 12 + childDate.getUTCMonth() - sourceDate.getUTCMonth();
    if (months <= 0 || months % interval !== 0) break;
    dates.push(sourceDate);
    visited.add(source.id);
    cursor = source;
  }

  let anchorDay = dates[dates.length - 1].getUTCDate();
  for (let index = dates.length - 2; index >= 0; index--) {
    const child = dates[index];
    const lastDay = new Date(Date.UTC(child.getUTCFullYear(), child.getUTCMonth() + 1, 0)).getUTCDate();
    const scheduledDay = Math.min(anchorDay, lastDay);
    const legacyDay = Math.min(dates[index + 1].getUTCDate(), lastDay);
    // Preserve both corrected and previously clamped occurrences. A different
    // date starts a new anchor, so ordinary rescheduling is still respected.
    if (child.getUTCDate() !== scheduledDay && child.getUTCDate() !== legacyDay) anchorDay = child.getUTCDate();
  }
  return anchorDay;
}

export function nextRecurringTaskDatesForTask(
  current: RecurringOccurrence,
  history: readonly RecurringOccurrence[],
  now = new Date(),
) {
  const rule = taskRecurrenceSchema.parse(current.recurrenceRule);
  const anchorDay = rule.frequency === "monthly" ? monthlyAnchorDay(current, history, rule.interval) : undefined;
  return nextRecurringTaskDates(rule, current.startDate, current.dueDate, now, anchorDay);
}
