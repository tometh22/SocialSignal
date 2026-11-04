import { and, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  userNotificationPreferences,
  userNotifications,
  userNotificationEmailDeliveries,
  userNotificationPushDeliveries,
} from "@shared/schema";
import {
  notificationSettingsSchema,
  notificationCategories,
  notificationTypes,
  notificationCategory,
} from "@shared/utils/notification-policy";

export const notificationPreferencePatch = z
  .object({
    desktopEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    discreetMode: z.boolean().optional(),
    categoryPreferences: z
      .record(
        z.enum(notificationCategories),
        z
          .object({
            desktop: z.boolean().optional(),
            email: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
    settings: notificationSettingsSchema.optional(),
    setupCompleted: z.boolean().optional(),
  })
  .strict();

export async function saveNotificationPreferences(
  userId: number,
  patch: z.infer<typeof notificationPreferencePatch>,
) {
  const { setupCompleted, categoryPreferences, ...channels } = patch;
  return db.transaction(async (tx) => {
    await tx
      .insert(userNotificationPreferences)
      .values({ userId })
      .onConflictDoNothing();
    const [current] = await tx
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .for("update");
    const merged = { ...current.categoryPreferences };
    for (const [category, values] of Object.entries(categoryPreferences ?? {}))
      merged[category] = { ...merged[category], ...values };
    const [saved] = await tx
      .update(userNotificationPreferences)
      .set({
        ...channels,
        categoryPreferences: merged,
        ...(setupCompleted ? { setupCompletedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userNotificationPreferences.userId, userId))
      .returning();
    // Turning a channel off cancels its outstanding work; turning it back on
    // does not unexpectedly deliver an older backlog.
    if (patch.emailEnabled === false)
      await tx.execute(
        sql`UPDATE user_notification_email_deliveries SET status='cancelled',locked_at=NULL,updated_at=NOW() WHERE user_id=${userId} AND status='pending'`,
      );
    if (patch.desktopEnabled === false)
      await tx.execute(
        sql`UPDATE user_notification_push_deliveries d SET status='cancelled',locked_at=NULL FROM user_notifications n WHERE n.id=d.notification_id AND n.user_id=${userId} AND d.status='pending'`,
      );
    if(patch.settings?.activityEmailMode === "off") await tx.execute(sql`UPDATE user_notification_email_deliveries d SET status='cancelled',locked_at=NULL,updated_at=NOW() FROM user_notifications n WHERE n.id=d.notification_id AND n.user_id=${userId} AND n.type IN ('mind_reply','mind_daily','task_reply') AND d.status='pending'`);
    for (const [category, channels] of Object.entries(
      categoryPreferences ?? {},
    )) {
      const types = notificationTypes.filter(
        (type) => notificationCategory(type) === category,
      );
      const ids = tx
        .select({ id: userNotifications.id })
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.userId, userId),
            inArray(userNotifications.type, types),
          ),
        );
      if (channels.email === false)
        await tx
          .update(userNotificationEmailDeliveries)
          .set({ status: "cancelled", lockedAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(userNotificationEmailDeliveries.status, "pending"),
              inArray(userNotificationEmailDeliveries.notificationId, ids),
            ),
          );
      if (channels.desktop === false)
        await tx
          .update(userNotificationPushDeliveries)
          .set({ status: "cancelled", lockedAt: null })
          .where(
            and(
              eq(userNotificationPushDeliveries.status, "pending"),
              inArray(userNotificationPushDeliveries.notificationId, ids),
            ),
          );
    }
    return saved;
  });
}
