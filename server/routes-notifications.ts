import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { and, eq, inArray, isNull, lt, desc, sql } from "drizzle-orm";
import { randomBytes as notificationRandomBytes } from "node:crypto";
import { db } from "./db";
import {
  users,
  userNotifications,
  userNotificationPreferences,
  userNotificationPushSubscriptions,
  userNotificationEmailDeliveries,
  userNotificationPushDeliveries,
  userNotificationThreadMutes,
} from "@shared/schema";
import { notificationAccess } from "./services/notification-access";
import {
  notificationPreferencePatch,
  saveNotificationPreferences,
} from "./services/notification-preferences";
import { canDecideQuotationApproval } from "@shared/utils/quotation-approval";
import { getTransactionalEmailConfig } from "./services/email-transport";
import {
  readPushDeviceToken,
  isPushEndpoint,
} from "./services/notification-device";
import {
  getWebPushPublicKey,
  retryUserNotificationEmailDelivery,
  sendUserWebPushTest,
} from "./services/user-notifications";

export function registerNotificationRoutes(
  app: Express,
  requireAuth: RequestHandler,
) {
  const route = (
    method: "get" | "post" | "put" | "patch" | "delete",
    path: string,
    handler: (req: Request, res: Response) => Promise<unknown>,
  ) => {
    app[method](path, requireAuth, (req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      if (
        req.params.id &&
        (!Number.isSafeInteger(Number(req.params.id)) ||
          Number(req.params.id) <= 0)
      )
        return res.status(400).json({ message: "Identificador inválido" });
      Promise.resolve(handler(req, res)).catch(next);
    });
  };
  route("get", "/api/notifications", async (req, res) => {
    const userId = Number((req.user as any)?.id);
    const requestedLimit = Number(req.query.limit ?? 20);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(50, Math.max(1, requestedLimit))
      : 20;
    const beforeId = Number(req.query.beforeId);
    const conditions = [
      eq(userNotifications.userId, userId),
      notificationAccess(userId),
    ];
    if (req.query.unreadOnly === "true")
      conditions.push(isNull(userNotifications.readAt));
    if (Number.isInteger(beforeId) && beforeId > 0)
      conditions.push(lt(userNotifications.id, beforeId));
    const [rows, unreadResult] = await Promise.all([
      db
        .select()
        .from(userNotifications)
        .where(and(...conditions))
        .orderBy(desc(userNotifications.id))
        .limit(limit + 1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.userId, userId),
            notificationAccess(userId),
            isNull(userNotifications.readAt),
          ),
        ),
    ]);
    const hasMore = rows.length > limit;
    const muted = await db
      .select()
      .from(userNotificationThreadMutes)
      .where(eq(userNotificationThreadMutes.userId, userId));
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      ...row,
      muted: muted.some((m) => m.threadKey === row.threadKey),
    }));
    res.json({
      items,
      unreadCount: unreadResult[0]?.count ?? 0,
      hasMore,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    });
  });
  route("get", "/api/notifications/preferences", async (req, res) => {
    const userId = Number((req.user as any)?.id);
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .limit(1);
    const [available] = await db
      .execute(
        sql`SELECT
      (EXISTS(SELECT 1 FROM review_room_members m JOIN review_rooms r ON r.id=m.room_id WHERE m.user_id=${userId} AND r.archived_at IS NULL)) AS rooms,
      EXISTS(SELECT 1 FROM personnel p JOIN users u ON lower(trim(u.email))=lower(trim(p.email)) WHERE u.id=${userId}) AS person`,
      )
      .then((r) => r.rows as { rooms: boolean; person: boolean }[]);
    const u = req.user!;
    const has = (permission: string) =>
      Boolean(
        u.isAdmin || u.role === "admin" || u.permissions?.includes(permission),
      );
    const availableCategories = [
      has("status") && available.rooms && "mind",
      has("status") && available.rooms && "daily",
      ["projects", "operations", "task_manager"].some(has) && "tasks",
      has("crm") && "crm",
      has("quotations") && canDecideQuotationApproval(u) && "quotations",
      (available.person || has("operations") || has("finance")) && "team",
    ].filter(Boolean);
    const suppressed = await db.execute(
      sql`SELECT reason FROM notification_email_suppressions WHERE email=lower(trim(${u.email}))`,
    );
    res.json({
      ...(preferences ?? {
        userId,
        desktopEnabled: false,
        emailEnabled: false,
        setupCompletedAt: null,
      }),
      availableCategories,
      emailSuppressed: Boolean(suppressed.rowCount),
    });
  });
  route("get", "/api/notifications/push/public-key", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ publicKey: getWebPushPublicKey() });
  });
  route("post", "/api/notifications/push/subscribe", async (req, res) => {
    const parsed = z
      .object({
        endpoint: z
          .string()
          .url()
          .max(2048)
          .refine(isPushEndpoint, "El servicio Web Push no es válido"),
        expirationTime: z.number().nullable().optional(),
        keys: z
          .object({
            p256dh: z.string().min(16).max(256),
            auth: z.string().min(8).max(256),
          })
          .strict(),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Suscripción Web Push inválida" });
    if (!getWebPushPublicKey())
      return res
        .status(503)
        .json({ message: "Web Push no está configurado en el servidor" });
    const userId = Number((req.user as any)?.id);
    const now = new Date();
    const deviceToken =
      readPushDeviceToken(req.headers.cookie) ||
      notificationRandomBytes(32).toString("hex");
    res.cookie("mind_push_device", deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 86400_000,
    });
    await db
      .insert(userNotificationPushSubscriptions)
      .values({
        userId,
        deviceToken,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userNotificationPushSubscriptions.endpoint,
        set: {
          userId,
          deviceToken,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
          updatedAt: now,
        },
      });
    res.json({ success: true });
  });
  route("delete", "/api/notifications/push/subscribe", async (req, res) => {
    const parsed = z
      .object({ endpoint: z.string().url() })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Suscripción Web Push inválida" });
    const userId = Number((req.user as any)?.id);
    await db
      .delete(userNotificationPushSubscriptions)
      .where(
        and(
          eq(userNotificationPushSubscriptions.userId, userId),
          eq(userNotificationPushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );
    res.json({ success: true });
  });
  route("post", "/api/notifications/push/test", async (req, res) => {
    const parsed = z
      .object({
        endpoint: z
          .string()
          .url()
          .max(2048)
          .refine(
            (value) => new URL(value).protocol === "https:",
            "El endpoint debe usar HTTPS",
          ),
        testId: z.string().uuid(),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Suscripción Web Push inválida" });
    const result = await sendUserWebPushTest(
      Number((req.user as any)?.id),
      parsed.data.endpoint,
      parsed.data.testId,
    );
    if (!result.ok)
      return res.status(result.status).json({ message: result.message });
    res.json({ success: true });
  });
  route("post", "/api/notifications/push/status", async (req, res) => {
    const input = z
      .object({ endpoint: z.string().url().max(2048) })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      return res.status(400).json({ message: "Dispositivo inválido" });
    const [device] = await db
      .select({ id: userNotificationPushSubscriptions.id })
      .from(userNotificationPushSubscriptions)
      .where(
        and(
          eq(userNotificationPushSubscriptions.userId, req.user!.id),
          eq(userNotificationPushSubscriptions.endpoint, input.data.endpoint),
        ),
      );
    res.json({ connected: Boolean(device) });
  });
  route("get", "/api/notifications/push/devices", async (req, res) => {
    const devices = await db
      .select({
        id: userNotificationPushSubscriptions.id,
        userAgent: userNotificationPushSubscriptions.userAgent,
        updatedAt: userNotificationPushSubscriptions.updatedAt,
        current: sql<boolean>`${userNotificationPushSubscriptions.deviceToken}=${readPushDeviceToken(req.headers.cookie) ?? ""}`,
      })
      .from(userNotificationPushSubscriptions)
      .where(eq(userNotificationPushSubscriptions.userId, req.user!.id));
    res.json(devices);
  });
  route("delete", "/api/notifications/push/devices/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).json({ message: "Dispositivo inválido" });
    await db
      .delete(userNotificationPushSubscriptions)
      .where(
        and(
          eq(userNotificationPushSubscriptions.id, id),
          eq(userNotificationPushSubscriptions.userId, req.user!.id),
        ),
      );
    res.json({ success: true });
  });
  route("post", "/api/notifications/:id/mute", async (req, res) => {
    const input = z.object({ muted: z.boolean() }).strict().safeParse(req.body);
    if (!input.success)
      return res.status(400).json({ message: "Preferencia inválida" });
    const [n] = await db
      .select()
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.id, Number(req.params.id)),
          eq(userNotifications.userId, req.user!.id),
          notificationAccess(req.user!.id),
        ),
      );
    if (!n?.threadKey)
      return res.status(404).json({ message: "Conversación no encontrada" });
    await db.transaction(async (tx) => {
      if (input.data.muted) {
        await tx
          .insert(userNotificationThreadMutes)
          .values({ userId: req.user!.id, threadKey: n.threadKey! })
          .onConflictDoNothing();
        await tx.execute(
          sql`UPDATE user_notification_email_deliveries d SET status='cancelled',locked_at=NULL,updated_at=NOW() FROM user_notifications n WHERE n.id=d.notification_id AND n.user_id=${req.user!.id} AND n.thread_key=${n.threadKey} AND d.status='pending'`,
        );
        await tx.execute(
          sql`UPDATE user_notification_push_deliveries d SET status='cancelled',locked_at=NULL FROM user_notifications n WHERE n.id=d.notification_id AND n.user_id=${req.user!.id} AND n.thread_key=${n.threadKey} AND d.status='pending'`,
        );
      } else
        await tx
          .delete(userNotificationThreadMutes)
          .where(
            and(
              eq(userNotificationThreadMutes.userId, req.user!.id),
              eq(userNotificationThreadMutes.threadKey, n.threadKey!),
            ),
          );
    });
    res.json({ success: true });
  });
  route("put", "/api/notifications/preferences", async (req, res) => {
    const parsed = notificationPreferencePatch.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Preferencias inválidas" });
    const preferences = await saveNotificationPreferences(
      req.user!.id,
      parsed.data,
    );
    res.json(preferences);
  });
  route("patch", "/api/notifications/read-all", async (req, res) => {
    const userId = Number((req.user as any)?.id);
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, userId),
          notificationAccess(userId),
          isNull(userNotifications.readAt),
        ),
      );
    res.json({ success: true });
  });
  route("patch", "/api/notifications/:id/read", async (req, res) => {
    const userId = Number((req.user as any)?.id);
    const [row] = await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, Number(req.params.id)),
          eq(userNotifications.userId, userId),
          notificationAccess(userId),
        ),
      )
      .returning();
    if (!row)
      return res.status(404).json({ message: "Notificación no encontrada" });
    res.json(row);
  });
  route("patch", "/api/notifications/read-many", async (req, res) => {
    const parsed = z
      .object({ ids: z.array(z.number().int().positive()).min(1).max(100) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Lista de notificaciones inválida" });
    const userId = Number((req.user as any)?.id);
    const rows = await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, userId),
          notificationAccess(userId),
          inArray(userNotifications.id, [...new Set(parsed.data.ids)]),
          isNull(userNotifications.readAt),
        ),
      )
      .returning({ id: userNotifications.id });
    res.json({ updated: rows.length });
  });

  route("get", "/api/admin/notification-email-deliveries", async (req, res) => {
    if (!req.user?.isAdmin && req.user?.role !== "admin")
      return res
        .status(403)
        .json({ message: "Se requiere acceso de administrador" });
    const counts = await db
      .select({
        status: userNotificationEmailDeliveries.status,
        count: sql<number>`count(*)::int`,
      })
      .from(userNotificationEmailDeliveries)
      .groupBy(userNotificationEmailDeliveries.status);
    const recent = await db
      .select({
        id: userNotificationEmailDeliveries.id,
        status: userNotificationEmailDeliveries.status,
        attempts: userNotificationEmailDeliveries.attempts,
        lastError: userNotificationEmailDeliveries.lastError,
        deliveryStatus: userNotificationEmailDeliveries.deliveryStatus,
        deliveredAt: userNotificationEmailDeliveries.deliveredAt,
        updatedAt: userNotificationEmailDeliveries.updatedAt,
        type: userNotifications.type,
        title: userNotifications.title,
      })
      .from(userNotificationEmailDeliveries)
      .innerJoin(
        userNotifications,
        eq(
          userNotifications.id,
          userNotificationEmailDeliveries.notificationId,
        ),
      )
      .where(
        sql`${userNotificationEmailDeliveries.status} IN ('pending','failed') OR ${userNotificationEmailDeliveries.deliveryStatus} IN ('bounced','complained','suppressed')`,
      )
      .orderBy(desc(userNotificationEmailDeliveries.updatedAt))
      .limit(50);
    const pushCounts = await db
      .select({
        status: userNotificationPushDeliveries.status,
        count: sql<number>`count(*)::int`,
      })
      .from(userNotificationPushDeliveries)
      .groupBy(userNotificationPushDeliveries.status);
    const deliveryCounts = await db
      .select({
        status: userNotificationEmailDeliveries.deliveryStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(userNotificationEmailDeliveries)
      .groupBy(userNotificationEmailDeliveries.deliveryStatus);
    const providerLogs = (
      await db.execute(
        sql`SELECT idempotency_key,provider,provider_id,recipient,status,delivery_status,last_error,updated_at FROM transactional_email_deliveries ORDER BY updated_at DESC LIMIT 20`,
      )
    ).rows;
    res.json({
      configured: Boolean(getTransactionalEmailConfig()),
      provider: getTransactionalEmailConfig()?.provider ?? null,
      webhookConfigured: Boolean(
        getTransactionalEmailConfig()?.provider === "resend"
          ? process.env.RESEND_WEBHOOK_SECRET
          : process.env.SENDGRID_WEBHOOK_PUBLIC_KEY,
      ),
      providerLogs,
      counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
      deliveryCounts: Object.fromEntries(
        deliveryCounts.filter((r) => r.status).map((r) => [r.status, r.count]),
      ),
      pushCounts: Object.fromEntries(
        pushCounts.map((r) => [r.status, r.count]),
      ),
      attention: recent,
    });
  });
  route(
    "post",
    "/api/admin/notification-email-deliveries/:id/retry",
    async (req, res) => {
      if (!req.user?.isAdmin && req.user?.role !== "admin")
        return res
          .status(403)
          .json({ message: "Se requiere acceso de administrador" });
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: "ID inválido" });
      const queued = await retryUserNotificationEmailDelivery(id);
      if (!queued)
        return res
          .status(409)
          .json({ message: "El email no existe o no está en estado de fallo" });
      res.json({ success: true });
    },
  );
  route(
    "post",
    "/api/admin/notification-email-suppressions/release",
    async (req, res) => {
      if (!req.user?.isAdmin && req.user?.role !== "admin")
        return res
          .status(403)
          .json({ message: "Se requiere acceso de administrador" });
      const parsed = z
        .object({ email: z.string().email().max(255) })
        .strict()
        .safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ message: "Email inválido" });
      await db.execute(
        sql`DELETE FROM notification_email_suppressions WHERE email=lower(trim(${parsed.data.email}))`,
      );
      res.json({ success: true });
    },
  );
}
