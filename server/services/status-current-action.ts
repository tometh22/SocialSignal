import { and, desc, eq, sql } from "drizzle-orm";
import { createUserNotifications } from "./user-notifications";
import { db } from "../db";
import { projectStatusReviews, weeklyStatusItems, projectReviewNotes, statusUpdateEntries, statusChangeLog } from "@shared/schema";

/** One atomic write for the canonical state, its update entry, and its audit event. */
export async function saveStatusCurrentAction(roomId: number, reference: { projectId: number } | { customId: number }, content: string, userId: number, expected?: string | null, mentionIds: number[] = []) {
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
    const [entry] = await tx.insert(statusUpdateEntries).values({ roomId, projectId, weeklyStatusItemId: customId, content: value, authorId: userId }).returning({ id: statusUpdateEntries.id });
    if (mentionIds.length) {
      const itemKey = projectId != null ? `p_${projectId}` : `c_${customId}`;
      await createUserNotifications(mentionIds.filter(id => id !== userId), {
        eventKey: `mind-mention:${entry.id}`,
        type: "mind_mention",
        title: "Te mencionaron en Status",
        message: "Abrí el tema para leer la actualización.",
        entityType: "review_room",
        entityId: roomId,
        actionUrl: `/review/${roomId}?item=${itemKey}&updateId=${entry.id}`,
      }, tx);
    }
    await tx.insert(statusChangeLog).values({ roomId, projectId, weeklyStatusItemId: customId, userId, fieldName: 'currentAction', oldValue: current?.currentAction ?? null, newValue: value });
    return { ...saved, updateEntryId: entry.id };
  });
}


export async function editStatusUpdate(roomId: number, entryId: number, authorId: number, content: string) {
  return db.transaction(async tx => {
    const where = and(eq(statusUpdateEntries.id, entryId), eq(statusUpdateEntries.roomId, roomId));
    const [target] = await tx.select().from(statusUpdateEntries).where(where);
    if (!target) throw Object.assign(new Error("Update no encontrado"), { statusCode: 404 });
    if (target.authorId !== authorId) throw Object.assign(new Error("Solo el autor puede editarlo"), { statusCode: 403 });
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${roomId}, ${target.projectId ?? target.weeklyStatusItemId!})`);
    const [entry] = await tx.select().from(statusUpdateEntries).where(where).for("update");
    if (!entry) throw Object.assign(new Error("Update no encontrado"), { statusCode: 404 });
    if (entry.content === content) return { ...entry, currentActionChanged: false };
    const editedAt = new Date();
    let currentActionChanged = false;
    const item = entry.projectId != null
      ? eq(statusUpdateEntries.projectId, entry.projectId)
      : eq(statusUpdateEntries.weeklyStatusItemId, entry.weeklyStatusItemId!);
    const [latest] = await tx.select({ id: statusUpdateEntries.id }).from(statusUpdateEntries)
      .where(and(eq(statusUpdateEntries.roomId, roomId), item))
      .orderBy(desc(statusUpdateEntries.createdAt), desc(statusUpdateEntries.id)).limit(1);

    if (latest?.id === entryId) {
      const values = { currentAction: content, updatedBy: authorId, updatedAt: editedAt };
      if (entry.projectId != null) {
        const [changed] = await tx.update(projectStatusReviews).set(values).where(and(
          eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, entry.projectId),
          eq(projectStatusReviews.currentAction, entry.content),
        )).returning({ id: projectStatusReviews.id });
        currentActionChanged = Boolean(changed);
      } else {
        const [changed] = await tx.update(weeklyStatusItems).set(values).where(and(
          eq(weeklyStatusItems.roomId, roomId), eq(weeklyStatusItems.id, entry.weeklyStatusItemId!),
          eq(weeklyStatusItems.currentAction, entry.content),
        )).returning({ id: weeklyStatusItems.id });
        currentActionChanged = Boolean(changed);
      }
    }
    const [updated] = await tx.update(statusUpdateEntries).set({ content, editedAt }).where(where).returning();
    return { ...updated, currentActionChanged };
  });
}


export async function editStatusNote(roomId: number, noteId: number, authorId: number, content: string) {
  return db.transaction(async tx => {
    const where = and(eq(projectReviewNotes.id, noteId), eq(projectReviewNotes.roomId, roomId));
    const [note] = await tx.select().from(projectReviewNotes).where(where).for("update");
    if (!note) throw Object.assign(new Error("Comentario no encontrado"), { statusCode: 404 });
    if (note.authorId !== authorId) throw Object.assign(new Error("Solo el autor puede editarlo"), { statusCode: 403 });
    if (note.content === content) return note;

    const [updated] = await tx.update(projectReviewNotes).set({ content, editedAt: new Date() }).where(where).returning();
    return updated;
  });
}
