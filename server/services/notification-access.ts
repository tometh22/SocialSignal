import { sql, type SQLWrapper } from "drizzle-orm";
import { userNotifications } from "@shared/schema";
import { PgDialect } from "drizzle-orm/pg-core";

type Scope = {
  type: string | SQLWrapper;
  entityId?: number | null | SQLWrapper;
  eventKey: string | SQLWrapper;
  actionUrl?: string | null | SQLWrapper;
};
// Candidates come from the event's participants, never from their role alone.
// Reuse this predicate at creation, inbox reads and every delivery attempt.
export function notificationAccess(
  userId: number | SQLWrapper,
  n: Scope = userNotifications,
) {
  const id = n.entityId ?? null;
  const url = n.actionUrl ?? "";
  const admin = sql`(u.is_admin = true OR u.role = 'admin')`;
  const section = (
    name:
      | "status"
      | "projects"
      | "task_manager"
      | "operations"
      | "crm"
      | "quotations"
      | "finance",
  ) =>
    sql`(${admin} OR ${sql.raw(`'${name}'`)} = ANY(COALESCE(u.permissions, '{}'::text[])))`;
  return sql`EXISTS (
    SELECT 1 FROM users u WHERE u.id = ${userId} AND u.is_active = true AND CASE
    WHEN ${n.type} IN ('mind_reply', 'mind_daily') THEN
      ${section("status")} AND EXISTS (SELECT 1 FROM review_rooms r JOIN review_room_members m ON m.room_id = r.id
        WHERE r.id = ${id} AND r.archived_at IS NULL AND m.user_id = u.id)
    WHEN ${n.type} IN ('task_assigned', 'task_reply') THEN
      (${section("projects")} OR ${section("task_manager")} OR ${section("operations")})
      AND EXISTS (SELECT 1 FROM tasks notification_task JOIN active_projects p ON p.id = notification_task.project_id WHERE notification_task.id = ${id}
        AND (${section("operations")} OR (p.status = 'active' AND EXISTS (
          SELECT 1 FROM task_project_members m JOIN personnel person ON person.id = m.personnel_id
          WHERE m.project_id = p.id AND lower(trim(person.email)) = lower(trim(u.email))))))
    WHEN ${n.type} = 'crm_reminder' THEN ${section("crm")} AND EXISTS (SELECT 1 FROM crm_leads l WHERE l.id = ${id})
    WHEN ${n.type} = 'quotation_approval' THEN ${section("quotations")}
      AND (${section("operations")} OR 'quotations_approve' = ANY(COALESCE(u.permissions, '{}'::text[])))
      AND EXISTS (SELECT 1 FROM quotations q JOIN quotation_approvals a ON a.quotation_id = q.id
        JOIN quotation_revisions r ON r.id = a.revision_id AND r.revision_number = q.revision_number
        WHERE q.id = ${id} AND q.status = 'pending' AND q.archived_at IS NULL AND a.status = 'pending' AND a.requested_by IS DISTINCT FROM u.id)
    WHEN ${n.type} IN ('absence', 'absence_request', 'absence_cancellation', 'absence_decision') THEN
      EXISTS (SELECT 1 FROM personnel_absences a JOIN personnel p ON p.id = a.personnel_id WHERE a.id = ${id} AND
        CASE WHEN ${url} LIKE '/operations/%' THEN ${section("operations")}
        ELSE lower(trim(p.email)) = lower(trim(u.email)) END)
    WHEN ${n.type} = 'monthly_settlement' THEN CASE
      WHEN ${url} LIKE '/operations/%' THEN ${section("operations")}
      WHEN ${url} LIKE '/finance/%' THEN ${section("finance")}
      WHEN ${url} LIKE '/my-invoices%' THEN CASE
        WHEN ${n.eventKey} LIKE 'team-settlement:%' THEN EXISTS (
          SELECT 1 FROM personnel_monthly_settlements s JOIN personnel p ON p.id = s.personnel_id
          WHERE s.id = ${id} AND s.status = 'published' AND lower(trim(p.email)) = lower(trim(u.email)))
        ELSE EXISTS (SELECT 1 FROM monthly_settlement_declarations d JOIN personnel p ON p.id = d.personnel_id
          WHERE d.id = ${id} AND lower(trim(p.email)) = lower(trim(u.email))) END
      ELSE false END
    ELSE false END
  )`;
}

// The MCP reader uses pg directly. Compile the same fixed predicate against its
// `t` alias; all columns and section literals are application-owned constants.
export const notificationInboxRowPolicy = new PgDialect().sqlToQuery(
  notificationAccess(sql.raw("t.user_id"), {
    type: sql.raw("t.type"),
    entityId: sql.raw("t.entity_id"),
    eventKey: sql.raw("t.event_key"),
    actionUrl: sql.raw("t.action_url"),
  }),
).sql;
