import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { quotationGroups, quotationGroupItems, quotations } from "@shared/schema";
import type { db } from "../db";

type Executor = Pick<typeof db, "select" | "update" | "execute">;

/** Caller owns the transaction. Restore only rows archived by this operation. */
export async function setQuotationGroupArchived(tx: Executor, groupId: number, archived: boolean, actorId: number | null, now = new Date()) {
  await tx.execute(sql`SELECT id FROM quotation_groups WHERE id = ${groupId} FOR UPDATE`);
  const [group] = await tx.select({ id: quotationGroups.id, archivedAt: quotationGroups.archivedAt }).from(quotationGroups).where(eq(quotationGroups.id, groupId));
  if (!group) return null;
  if (!archived && !group.archivedAt) return { id: groupId, changedQuotationIds: [], idempotentReplay: true };
  const items = await tx.select({ quotationId: quotationGroupItems.quotationId }).from(quotationGroupItems).where(eq(quotationGroupItems.groupId, groupId));
  const ids = items.map(item => item.quotationId);
  const changed = ids.length ? await tx.update(quotations).set({
    archivedAt: archived ? group.archivedAt ?? now : null,
    updatedAt: now,
    updatedBy: actorId,
    lockVersion: sql`${quotations.lockVersion} + 1`,
  }).where(and(inArray(quotations.id, ids), archived ? isNull(quotations.archivedAt) : eq(quotations.archivedAt, group.archivedAt!))).returning({ id: quotations.id }) : [];
  await tx.update(quotationGroups).set({ archivedAt: archived ? group.archivedAt ?? now : null, updatedAt: now, updatedBy: actorId }).where(eq(quotationGroups.id, groupId));
  return { id: groupId, changedQuotationIds: changed.map(row => row.id), idempotentReplay: changed.length === 0 && Boolean(group.archivedAt) === archived };
}
