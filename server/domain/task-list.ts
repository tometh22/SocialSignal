import { desc, sql } from "drizzle-orm";
import { tasks } from "@shared/schema";

// Keep the same order across pages: nearest deadline first, undated tasks last.
// The unique ID breaks ties, including tasks that have no deadline.
const deadline = sql`COALESCE(${tasks.dueDate}, 'infinity'::timestamp)`;
export function personalTaskOrder() {
  return [sql`${deadline} ASC`, desc(tasks.id)];
}

export function personalTaskAfter(beforeId: number) {
  const anchorDeadline = sql`(SELECT COALESCE(cursor_task.due_date, 'infinity'::timestamp)
    FROM ${tasks} AS cursor_task WHERE cursor_task.id = ${beforeId})`;
  return sql`(${deadline} > ${anchorDeadline} OR
    (${deadline} = ${anchorDeadline} AND ${tasks.id} < ${beforeId}))`;
}

// Same precedence as shared taskPersonalBucket: an overdue due date wins over start date.
export function taskBucketSql(today: string) {
  return sql<string>`CASE
    WHEN ${tasks.status}='cancelled' THEN NULL
    WHEN ${tasks.status}='done' THEN 'done'
    WHEN ${tasks.startDate} IS NULL AND ${tasks.dueDate} IS NULL THEN 'no_date'
    WHEN ${tasks.dueDate}::date < ${today}::date THEN 'overdue'
    WHEN ${tasks.startDate}::date > ${today}::date THEN 'upcoming'
    ELSE 'in_progress' END`;
}
