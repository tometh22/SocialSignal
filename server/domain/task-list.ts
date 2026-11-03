import { sql } from "drizzle-orm";
import { tasks } from "@shared/schema";

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
