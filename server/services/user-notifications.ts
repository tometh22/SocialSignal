import { and, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { db, pool } from "../db";
import { userNotificationEmailDeliveries, userNotifications, userNotificationPreferences, userNotificationPushSubscriptions, users } from "@shared/schema";

export type UserNotificationInput = {
  eventKey: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEntities[char]);

const notificationCategory: Record<string, string> = {
  mind_reply: "Conversación en Mind",
  mind_daily: "Daily de Mind",
  task_assigned: "Tarea asignada",
  crm_reminder: "Recordatorio CRM",
  absence: "Novedad de equipo",
  absence_request: "Solicitud de ausencia",
  absence_cancellation: "Cancelación de ausencia",
  absence_decision: "Decisión de ausencia",
};

export function getNotificationPreferenceCategory(type: string) {
  if (type.startsWith("mind_")) return type === "mind_daily" ? "daily" : "mind";
  if (type.startsWith("task_")) return "tasks";
  if (type.startsWith("absence")) return "team";
  if (type.startsWith("crm_")) return "crm";
  return "team";
}

function getActionUrl(origin: string, actionUrl?: string) {
  if (!origin || !actionUrl || !actionUrl.startsWith("/") || actionUrl.startsWith("//")) return "";
  try {
    const appOrigin = new URL(origin);
    if (appOrigin.protocol !== "https:" && appOrigin.protocol !== "http:") return "";
    return new URL(actionUrl, appOrigin).toString();
  } catch {
    return "";
  }
}

function buildNotificationEmail(input: UserNotificationInput, url: string) {
  const safeTitle = escapeHtml(input.title);
  const safeMessage = escapeHtml(input.message);
  const safeUrl = escapeHtml(url);
  const category = escapeHtml(notificationCategory[input.type] ?? "Notificación");
  const action = url
    ? `<tr><td align="center" style="padding:24px 0 8px"><a href="${safeUrl}" style="background:#1d4ed8;border-radius:10px;color:#ffffff;display:inline-block;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:14px 24px;text-decoration:none">Abrir en Mind</a></td></tr><tr><td align="center" style="color:#64748b;font-family:Arial,sans-serif;font-size:12px;line-height:18px;padding:8px 20px 0">Si el botón no funciona, <a href="${safeUrl}" style="color:#1d4ed8;text-decoration:underline">abrí este enlace</a>.</td></tr>`
    : "";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${safeTitle}</title></head><body style="background:#f1f5f9;margin:0;padding:0"><div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${safeMessage}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px"><tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:22px 30px"><span style="color:#ffffff;font-family:Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:.2px">mind</span><span style="color:#94a3b8;font-family:Arial,sans-serif;font-size:12px;padding-left:9px">by Epical</span></td></tr><tr><td style="background:#ffffff;padding:34px 30px 28px"><div style="background:#eff6ff;border-radius:999px;color:#1d4ed8;display:inline-block;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;padding:7px 11px;text-transform:uppercase">${category}</div><h1 style="color:#0f172a;font-family:Arial,sans-serif;font-size:24px;line-height:32px;margin:20px 0 10px">${safeTitle}</h1><p style="color:#475569;font-family:Arial,sans-serif;font-size:16px;line-height:25px;margin:0">${safeMessage}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${action}</table></td></tr><tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;padding:20px 30px"><p style="color:#64748b;font-family:Arial,sans-serif;font-size:12px;line-height:19px;margin:0">Recibiste este correo porque tenés activadas las notificaciones por email de Mind. Podés cambiarlas desde las preferencias en la campana de notificaciones.</p><p style="color:#94a3b8;font-family:Arial,sans-serif;font-size:11px;line-height:17px;margin:12px 0 0">Epical · Notificaciones automáticas</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${input.title}\n\n${input.message}${url ? `\n\nAbrir en Mind: ${url}` : ""}\n\nRecibiste este correo porque tenés activadas las notificaciones por email de Mind. Podés cambiarlas desde las preferencias en la campana de notificaciones.`;
  return { html, text };
}

export async function createUserNotifications(userIds: number[], input: UserNotificationInput): Promise<boolean> {
  const recipients = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!recipients.length) return false;
  let inserted: { id: number; userId: number }[];
  try {
    inserted = await db.transaction(async (tx) => {
      const rows = await tx.insert(userNotifications).values(recipients.map((userId) => ({
        userId,
        eventKey: input.eventKey,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType ?? null,
        entityId: input.entityId,
        actionUrl: input.actionUrl ?? null,
      }))).onConflictDoNothing().returning({ id: userNotifications.id, userId: userNotifications.userId });
      if (rows.length) {
        const enabled = await tx.select({ userId: users.id, categoryPreferences: userNotificationPreferences.categoryPreferences }).from(users)
          .innerJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, users.id))
          .where(and(inArray(users.id, rows.map((row) => row.userId)), eq(userNotificationPreferences.emailEnabled, true), eq(users.isActive, true)));
        const preferenceByUser = new Map(enabled.map((row) => [row.userId, row.categoryPreferences ?? {}]));
        const category = getNotificationPreferenceCategory(input.type);
        const enabledIds = new Set(enabled
          .filter((row) => preferenceByUser.get(row.userId)?.[category]?.email !== false)
          .map((row) => row.userId));
        const deliveries = rows.filter((row) => enabledIds.has(row.userId)).map((row) => ({ notificationId: row.id, userId: row.userId }));
        if (deliveries.length) await tx.insert(userNotificationEmailDeliveries).values(deliveries).onConflictDoNothing();
      }
      return rows;
    });
  } catch (error) {
    console.error("No se pudo guardar la notificación:", error instanceof Error ? error.message : error);
    return false;
  }
  if (inserted.length) {
    void dispatchUserNotificationEmails();
    void dispatchUserNotificationPushes(inserted, input);
  }
  return true;
}

type InsertedNotification = { id: number; userId: number };

function getPushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@epical.com";
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey };
  } catch (error) {
    console.error("La configuración VAPID para Web Push no es válida:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function getWebPushPublicKey() {
  return getPushConfig()?.publicKey ?? null;
}

const pushTestLastSentAt = new Map<string, number>();

export async function sendUserWebPushTest(userId: number, endpoint: string) {
  if (!getPushConfig()) return { ok: false as const, status: 503, message: "Web Push no está configurado en el servidor." };
  const rateLimitKey = `${userId}:${endpoint}`;
  const now = Date.now();
  if (now - (pushTestLastSentAt.get(rateLimitKey) ?? 0) < 30_000) {
    return { ok: false as const, status: 429, message: "Esperá unos segundos antes de volver a probar." };
  }

  const [row] = await db.select({
    id: userNotificationPushSubscriptions.id,
    endpoint: userNotificationPushSubscriptions.endpoint,
    p256dh: userNotificationPushSubscriptions.p256dh,
    auth: userNotificationPushSubscriptions.auth,
  }).from(userNotificationPushSubscriptions)
    .innerJoin(users, eq(users.id, userNotificationPushSubscriptions.userId))
    .innerJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, users.id))
    .where(and(
      eq(userNotificationPushSubscriptions.userId, userId),
      eq(userNotificationPushSubscriptions.endpoint, endpoint),
      eq(userNotificationPreferences.desktopEnabled, true),
      eq(users.isActive, true),
    )).limit(1);
  if (!row) return { ok: false as const, status: 404, message: "Este dispositivo todavía no está conectado a Mind." };

  pushTestLastSentAt.set(rateLimitKey, now);
  try {
    const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || "";
    await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({
      title: "Prueba de notificaciones de Mind",
      body: "Tu navegador recibió correctamente este aviso.",
      url: getActionUrl(origin, "/notifications") || "/notifications",
      tag: `mind-push-test-${userId}`,
    }), { TTL: 60 });
    return { ok: true as const };
  } catch (error: any) {
    pushTestLastSentAt.delete(rateLimitKey);
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await db.delete(userNotificationPushSubscriptions).where(eq(userNotificationPushSubscriptions.id, row.id));
      return { ok: false as const, status: 410, message: "El navegador venció esta suscripción. Volvé a activar las notificaciones." };
    }
    console.error("No se pudo entregar el aviso de prueba Web Push:", error instanceof Error ? error.message : error);
    return { ok: false as const, status: 502, message: "El servicio de notificaciones no aceptó el aviso de prueba." };
  }
}

async function dispatchUserNotificationPushes(inserted: InsertedNotification[], input: UserNotificationInput) {
  const config = getPushConfig();
  if (!config) return;
  try {
    const rows = await db.select({
      subscriptionId: userNotificationPushSubscriptions.id,
      endpoint: userNotificationPushSubscriptions.endpoint,
      p256dh: userNotificationPushSubscriptions.p256dh,
      auth: userNotificationPushSubscriptions.auth,
      userId: users.id,
      categoryPreferences: userNotificationPreferences.categoryPreferences,
      discreetMode: userNotificationPreferences.discreetMode,
    }).from(userNotificationPushSubscriptions)
      .innerJoin(users, eq(users.id, userNotificationPushSubscriptions.userId))
      .innerJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, users.id))
      .where(and(
        inArray(users.id, [...new Set(inserted.map((item) => item.userId))]),
        eq(userNotificationPreferences.desktopEnabled, true),
        eq(users.isActive, true),
      ));

    const insertedIdByUser = new Map(inserted.map((item) => [item.userId, item.id]));
    const category = getNotificationPreferenceCategory(input.type);
    const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || "";
    const actionUrl = getActionUrl(origin, input.actionUrl) || "/notifications";
    await Promise.all(rows.map(async (row) => {
      if (row.categoryPreferences?.[category]?.desktop === false) return;
      const discreet = row.discreetMode !== false;
      const notificationId = insertedIdByUser.get(row.userId);
      const payload = JSON.stringify({
        title: discreet ? "Tenés una novedad en Mind" : input.title,
        body: discreet ? "Abrí Mind para ver los detalles." : input.message,
        url: actionUrl,
        tag: `mind-${notificationId ?? row.subscriptionId}`,
      });
      try {
        await webpush.sendNotification({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        }, payload, { TTL: 60 * 60 * 24 });
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await db.delete(userNotificationPushSubscriptions).where(eq(userNotificationPushSubscriptions.id, row.subscriptionId));
          return;
        }
        console.error("No se pudo enviar una notificación Web Push:", error instanceof Error ? error.message : error);
      }
    }));
  } catch (error) {
    console.error("No se pudieron preparar notificaciones Web Push:", error instanceof Error ? error.message : error);
  }
}

const retryDelaysMs = [15_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000];
let dispatchRunning = false;

type ClaimedDelivery = { id: number; notification_id: number; attempts: number };

export async function dispatchUserNotificationEmails() {
  if (dispatchRunning) return;
  dispatchRunning = true;
  try {
    const claimed = await pool.query<ClaimedDelivery>(`
      WITH candidates AS (
        SELECT id
        FROM user_notification_email_deliveries
        WHERE (status = 'pending' AND next_attempt_at <= NOW())
           OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes')
        ORDER BY next_attempt_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 10
      )
      UPDATE user_notification_email_deliveries AS delivery
      SET status = 'processing', attempts = delivery.attempts + 1,
          locked_at = NOW(), updated_at = NOW()
      FROM candidates
      WHERE delivery.id = candidates.id
      RETURNING delivery.id, delivery.notification_id, delivery.attempts
    `);
    if (!claimed.rows.length) return;
    const ids = claimed.rows.map((row) => row.id);
    const payloads = await db.select({
      deliveryId: userNotificationEmailDeliveries.id,
      userId: userNotificationEmailDeliveries.userId,
      email: users.email,
      isActive: users.isActive,
      emailEnabled: userNotificationPreferences.emailEnabled,
      categoryPreferences: userNotificationPreferences.categoryPreferences,
      discreetMode: userNotificationPreferences.discreetMode,
      eventKey: userNotifications.eventKey,
      type: userNotifications.type,
      title: userNotifications.title,
      message: userNotifications.message,
      actionUrl: userNotifications.actionUrl,
    }).from(userNotificationEmailDeliveries)
      .innerJoin(userNotifications, eq(userNotifications.id, userNotificationEmailDeliveries.notificationId))
      .innerJoin(users, eq(users.id, userNotificationEmailDeliveries.userId))
      .leftJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, users.id))
      .where(inArray(userNotificationEmailDeliveries.id, ids));

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || "";
    for (const delivery of claimed.rows) {
      const payload = payloads.find((row) => row.deliveryId === delivery.id);
      const preferenceCategory = payload ? getNotificationPreferenceCategory(payload.type) : "team";
      if (!payload || !payload.email || !payload.isActive || !payload.emailEnabled || payload.categoryPreferences?.[preferenceCategory]?.email === false) {
        await updateDelivery(delivery.id, { status: "cancelled", lockedAt: null, updatedAt: new Date(), lastError: "El destinatario ya no tiene notificaciones por email activas." });
        continue;
      }
      if (!apiKey || !from) {
        await updateDelivery(delivery.id, { status: "failed", lockedAt: null, updatedAt: new Date(), lastError: "Falta configurar RESEND_API_KEY o RESEND_FROM_EMAIL." });
        console.error(`Email de notificación ${delivery.id} falló: configuración de Resend incompleta.`);
        continue;
      }
      const url = getActionUrl(origin, payload.actionUrl ?? undefined);
      const messageTitle = payload.discreetMode ? "Tenés una nueva notificación en Mind" : payload.title;
      const messageBody = payload.discreetMode ? "Ingresá a Mind para ver los detalles." : payload.message;
      const { html, text } = buildNotificationEmail({
        eventKey: payload.eventKey,
        type: payload.type,
        title: messageTitle,
        message: messageBody,
        actionUrl: payload.actionUrl ?? undefined,
      }, url);
      const idempotencyKey = createHash("sha256").update(`${payload.eventKey}:${payload.userId}`).digest("hex");
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ from, to: payload.email, subject: messageTitle, html, text }),
          signal: AbortSignal.timeout(15_000),
        });
        const result = await response.json().catch(() => ({})) as { id?: string };
        if (response.ok) {
          await updateDelivery(delivery.id, { status: "sent", sentAt: new Date(), resendEmailId: result.id ?? null, lastError: null, lockedAt: null, updatedAt: new Date() });
          console.info(`Email de notificación ${delivery.id} enviado por Resend.`);
        } else {
          const retryable = response.status === 429 || response.status >= 500;
          await recordDeliveryFailure(delivery, `Resend respondió HTTP ${response.status}.`, retryable);
        }
      } catch (error) {
        await recordDeliveryFailure(delivery, error instanceof Error ? error.message.slice(0, 500) : "Error de red al contactar Resend.", true);
      }
    }
  } catch (error) {
    console.error("No se pudo procesar la cola de emails de Mind:", error instanceof Error ? error.message : error);
  } finally {
    dispatchRunning = false;
  }
}

async function updateDelivery(id: number, fields: Partial<typeof userNotificationEmailDeliveries.$inferInsert>) {
  await db.update(userNotificationEmailDeliveries).set(fields).where(eq(userNotificationEmailDeliveries.id, id));
}

async function recordDeliveryFailure(delivery: ClaimedDelivery, message: string, retryable: boolean) {
  const retryDelay = retryable ? retryDelaysMs[delivery.attempts - 1] : undefined;
  if (retryDelay !== undefined) {
    await updateDelivery(delivery.id, { status: "pending", nextAttemptAt: new Date(Date.now() + retryDelay), lockedAt: null, lastError: message.slice(0, 500), updatedAt: new Date() });
    console.warn(`Email de notificación ${delivery.id}: reintento ${delivery.attempts}/${retryDelaysMs.length} programado.`);
  } else {
    await updateDelivery(delivery.id, { status: "failed", lockedAt: null, lastError: message.slice(0, 500), updatedAt: new Date() });
    console.error(`Email de notificación ${delivery.id} quedó en fallo permanente tras ${delivery.attempts} intento(s).`);
  }
}

export async function retryUserNotificationEmailDelivery(id: number) {
  const [row] = await db.update(userNotificationEmailDeliveries)
    .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null, updatedAt: new Date() })
    .where(and(eq(userNotificationEmailDeliveries.id, id), eq(userNotificationEmailDeliveries.status, "failed")))
    .returning({ id: userNotificationEmailDeliveries.id });
  if (row) void dispatchUserNotificationEmails();
  return Boolean(row);
}

export function startUserNotificationEmailWorker() {
  void dispatchUserNotificationEmails();
  const timer = setInterval(() => void dispatchUserNotificationEmails(), 15_000);
  timer.unref();
}
