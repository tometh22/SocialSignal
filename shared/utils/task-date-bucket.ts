import { civilDateInBuenosAires, isCompletedInCurrentBuenosAiresWeek } from "./buenos-aires-week";

export type TaskDateBucket = "upcoming" | "in_progress" | "overdue" | "no_date";
export type DatedTask = { status: string; startDate?: string | Date | null; dueDate?: string | Date | null; completedAt?: string | Date | null };
const civilDate = (value: string | Date | null | undefined) => value instanceof Date ? value.toISOString().slice(0, 10) : value?.slice(0, 10) || null;

export function taskDateBucket(task: DatedTask, now = new Date()): TaskDateBucket | null {
  if (task.status === "done" || task.status === "cancelled") return null;
  const today = civilDateInBuenosAires(now);
  const start = civilDate(task.startDate);
  const due = civilDate(task.dueDate);
  if (!start && !due) return "no_date";
  if (due && due < today) return "overdue";
  if (start && start > today) return "upcoming";
  // A due date alone does not say that the task starts in the future.
  return "in_progress";
}

export function taskCompletedThisWeek(task: DatedTask, now = new Date()): boolean {
  return task.status === "done" && isCompletedInCurrentBuenosAiresWeek(task.completedAt, now);
}
