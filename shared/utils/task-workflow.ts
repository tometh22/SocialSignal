import { taskDateBucket, type DatedTask } from "./task-date-bucket";

export const TASK_DATE_LABELS = { upcoming: "Próximas", in_progress: "En curso", overdue: "Con retraso", no_date: "Sin fecha", blocked: "Bloqueadas", done: "Finalizadas" } as const;
export type TaskWorkflowBucket = keyof typeof TASK_DATE_LABELS;
export function taskPersonalBucket(task: DatedTask, now = new Date()): Exclude<TaskWorkflowBucket, "blocked"> | null {
  if (task.status === "cancelled") return null;
  if (task.status === "done") return "done";
  return taskDateBucket(task, now);
}


export function taskWorkflowBucket(task: DatedTask, now = new Date()): TaskWorkflowBucket | null {
  return task.status === "blocked" ? "blocked" : taskPersonalBucket(task, now);
}
