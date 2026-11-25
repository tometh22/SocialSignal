import { sql } from "drizzle-orm";
import { createUserNotifications } from "./user-notifications";
import type { db } from "../db";

type NotificationTransaction = Pick<Parameters<Parameters<typeof db.transaction>[0]>[0], "select" | "insert" | "execute">;

export const statusItemFieldLabels: Record<string, string> = {
  healthStatus: "el semáforo",
  marginStatus: "la rentabilidad",
  teamStrain: "la carga del equipo",
  mainRisk: "el riesgo principal",
  currentAction: "el estado actual",
  nextMilestone: "el próximo paso",
  nextMilestoneDate: "la fecha del próximo paso",
  deadline: "el deadline",
  ownerId: "el responsable",
  decisionNeeded: "la decisión",
};

function describeFields(fields: string[]) {
  const labels = [...new Set(fields.map(field => statusItemFieldLabels[field]).filter(Boolean))];
  if (!labels.length) return "el tema";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

export type StatusItemUpdate = {
  roomId: number;
  kind: "project" | "custom";
  itemId: number;
  authorId: number;
  fields: string[];
  /** Unique per change so retries never duplicate the alert. */
  eventKey: string;
  /** Users already notified for the same change, such as @mentions. */
  excludeUserIds?: number[];
  updateEntryId?: number;
};

/**
 * Alert every room member when a work-table item changes. Uses the shared outbox,
 * so each person's email mode (immediate, daily digest, off) and thread mutes apply.
 */
export async function notifyStatusItemUpdated(tx: NotificationTransaction, update: StatusItemUpdate) {
  if (!update.fields.length) return;
  const excluded = new Set([update.authorId, ...(update.excludeUserIds ?? [])]);
  const members = await tx.execute(sql`SELECT user_id FROM review_room_members WHERE room_id=${update.roomId}`);
  const recipients = members.rows.map((row: any) => Number(row.user_id)).filter(id => !excluded.has(id));
  if (!recipients.length) return;
  const title = update.kind === "project"
    ? await tx.execute(sql`SELECT COALESCE(p.name, q.project_name) AS title FROM active_projects p
        LEFT JOIN quotations q ON q.id=p.quotation_id WHERE p.id=${update.itemId}`)
    : await tx.execute(sql`SELECT title FROM weekly_status_items WHERE id=${update.itemId} AND room_id=${update.roomId}`);
  const author = await tx.execute(sql`SELECT concat_ws(' ', first_name, last_name) AS name FROM users WHERE id=${update.authorId}`);
  const itemTitle = (title.rows[0] as any)?.title || "un tema";
  const authorName = String((author.rows[0] as any)?.name || "").trim() || "Alguien";
  const itemKey = `${update.kind === "project" ? "p" : "c"}_${update.itemId}`;
  await createUserNotifications(recipients, {
    eventKey: update.eventKey,
    type: "mind_update",
    title: `Se actualizó “${itemTitle}”`,
    message: `${authorName} actualizó ${describeFields(update.fields)} en la mesa de trabajo.`,
    entityType: "review_room",
    entityId: update.roomId,
    threadKey: `mind:${update.roomId}:${itemKey}`,
    actionUrl: `/review/${update.roomId}?item=${itemKey}${update.updateEntryId ? `&updateId=${update.updateEntryId}` : ""}`,
  }, tx);
}
