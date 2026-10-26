import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { projectStatusReviews, weeklyStatusItems, statusUpdateEntries, statusChangeLog } from "@shared/schema";

/** One atomic write for the canonical state, its update entry, and its audit event. */
export async function saveStatusCurrentAction(roomId: number, reference: { projectId: number } | { customId: number }, content: string, userId: number, expected?: string | null) {
  const value = content.trim();
  return db.transaction(async tx => {
    const projectId = 'projectId' in reference ? reference.projectId : null;
    const customId = 'customId' in reference ? reference.customId : null;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${roomId}, ${projectId ?? customId!})`);
    const [current] = projectId != null
      ? await tx.select().from(projectStatusReviews).where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId))).for('update')
      : await tx.select().from(weeklyStatusItems).where(and(eq(weeklyStatusItems.roomId, roomId), eq(weeklyStatusItems.id, customId!))).for('update');
    if (!current && customId != null) throw Object.assign(new Error('Ítem no encontrado'), { statusCode: 404 });
    if (expected !== undefined && (current?.currentAction ?? '') !== (expected ?? '')) throw Object.assign(new Error('El Estado actual cambió. Actualizá antes de guardar.'), { statusCode: 409 });
    if (current?.currentAction === value) return current;
    const update = { currentAction: value, updatedAt: new Date(), updatedBy: userId };
    let saved;
    if (projectId != null) {
      [saved] = current
        ? await tx.update(projectStatusReviews).set(update).where(eq(projectStatusReviews.id, current.id)).returning()
        : await tx.insert(projectStatusReviews).values({ roomId, projectId, ...update }).returning();
    } else [saved] = await tx.update(weeklyStatusItems).set(update).where(eq(weeklyStatusItems.id, customId!)).returning();
    await tx.insert(statusUpdateEntries).values({ roomId, projectId, weeklyStatusItemId: customId, content: value, authorId: userId });
    await tx.insert(statusChangeLog).values({ roomId, projectId, weeklyStatusItemId: customId, userId, fieldName: 'currentAction', oldValue: current?.currentAction ?? null, newValue: value });
    return saved;
  });
}
