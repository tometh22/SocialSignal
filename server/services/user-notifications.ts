import { getTransactionalEmailConfig, sendTransactionalEmail } from "./email-transport";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { notificationAccess } from "./notification-access";
import { reconcileNotificationEmailEvents } from "./notification-email-events";
import { defaultNotificationSettings, notificationSettingsSchema, notificationCategory as preferenceCategory, isActivityNotification, notificationSendAt, safeNotificationPath } from "@shared/utils/notification-policy";

import { db, pool } from "../db";
import { userNotificationEmailDeliveries, userNotifications, userNotificationPreferences, userNotificationPushSubscriptions, userNotificationPushDeliveries, userNotificationThreadMutes, users } from "@shared/schema";

export type UserNotificationInput = {
  eventKey: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
  threadKey?: string;
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
  quotation_approval: "Aprobación de cotización",
  mind_reply: "Conversación",
  mind_daily: "Daily de Mind",
  task_assigned: "Tarea asignada",
  task_reply: "Conversación de tarea",
  crm_reminder: "Recordatorio CRM",
  absence: "Novedad de equipo",
  absence_request: "Solicitud de ausencia",
  absence_cancellation: "Cancelación de ausencia",
  absence_decision: "Decisión de ausencia",
  monthly_settlement: "Conciliación mensual",
};

const discreetEmailCopy: Record<string, { subject: string; message: string }> = {
  quotation_approval: { subject: "Hay una cotización para aprobar", message: "Una cotización requiere tu revisión. Abrí Mind para consultar los detalles." },
  mind_reply: { subject: "Nueva respuesta en una conversación", message: "Alguien respondió en una conversación de Mind. Abrí Mind para leer el mensaje." },
  mind_daily: { subject: "Hay novedades en tu Daily", message: "Hay una actualización en el Daily de Mind. Abrí Mind para verla." },
  task_assigned: { subject: "Te asignaron una tarea", message: "Tenés una nueva tarea asignada. Abrí Mind para consultar los detalles." },
  task_reply: { subject: "Nueva respuesta en una tarea", message: "Hay una nueva respuesta en una conversación de tarea. Abrí Mind para leerla." },
  crm_reminder: { subject: "Tenés un recordatorio de CRM", message: "Hay una actividad de CRM que requiere tu atención. Abrí Mind para ver el recordatorio." },
  absence: { subject: "Novedad de equipo", message: "Hay una novedad relacionada con una ausencia del equipo. Abrí Mind para ver los detalles." },
  absence_request: { subject: "Hay una solicitud de ausencia", message: "Se registró o actualizó una solicitud de ausencia. Abrí Mind para revisarla." },
  absence_cancellation: { subject: "Se canceló una ausencia", message: "Hay una cancelación de ausencia para revisar. Abrí Mind para ver los detalles." },
  absence_decision: { subject: "Se tomó una decisión sobre una ausencia", message: "Se actualizó el estado de una solicitud de ausencia. Abrí Mind para ver la decisión." },
  monthly_settlement: { subject: "Hay una conciliación mensual para revisar", message: "Hay una actualización sobre una conciliación mensual. Abrí Mind para revisarla." },
};

export const getNotificationPreferenceCategory = preferenceCategory;

function getActionUrl(origin: string, actionUrl?: string) {
  if (!origin || !actionUrl || !actionUrl.startsWith("/") || actionUrl.startsWith("//")) return "";
  try {
    const appOrigin = new URL(origin);
    if (appOrigin.protocol !== "https:" && appOrigin.protocol !== "http:") return "";
    return new URL(safeNotificationPath(actionUrl), appOrigin).toString();
  } catch {
    return "";
  }
}

function buildNotificationEmail(input: UserNotificationInput, url: string, brandUrl: string) {
  const safeTitle = escapeHtml(input.title);
  const safeMessage = escapeHtml(input.message);
  const safeUrl = escapeHtml(url);
  const safeBrandUrl = escapeHtml(brandUrl);
  const preferencesUrl = new URL("/notifications#preferencias", url || brandUrl || "https://mind.epical.digital").toString();
  const category = escapeHtml(notificationCategory[input.type] ?? "Notificación");
  const action = url
    ? `<tr><td align="center" style="padding:24px 0 8px"><a href="${safeUrl}" style="background:#1d4ed8;border-radius:10px;color:#ffffff;display:inline-block;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:14px 24px;text-decoration:none">Abrir en Mind</a></td></tr><tr><td align="center" style="color:#64748b;font-family:Arial,sans-serif;font-size:12px;line-height:18px;padding:8px 20px 0">Si el botón no funciona, <a href="${safeUrl}" style="color:#1d4ed8;text-decoration:underline">abrí este enlace</a>.</td></tr>`
    : "";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${safeTitle}</title></head><body style="background:#f1f5f9;margin:0;padding:0"><div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${safeMessage}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px"><tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:22px 30px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle" style="padding-right:11px"><img src="${safeBrandUrl}" width="38" height="38" alt="" style="display:block;border:0;border-radius:9px"></td><td valign="middle"><div style="color:#ffffff;font-family:Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-.5px">mind <span style="border:1px solid #ffffff33;border-radius:99px;background:#ffffff12;color:#ffffff85;font-size:9px;letter-spacing:1px;padding:3px 6px;vertical-align:middle">OS</span></div><div style="color:#94a3b8;font-family:Arial,sans-serif;font-size:9px;font-weight:600;letter-spacing:.7px;margin-top:5px">EPICAL INTELLIGENCE</div></td></tr></table></td></tr><tr><td style="background:#ffffff;padding:34px 30px 28px"><div style="background:#eff6ff;border-radius:999px;color:#1d4ed8;display:inline-block;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;padding:7px 11px;text-transform:uppercase">${category}</div><h1 style="color:#0f172a;font-family:Arial,sans-serif;font-size:24px;line-height:32px;margin:20px 0 10px">${safeTitle}</h1><p style="color:#475569;font-family:Arial,sans-serif;font-size:16px;line-height:25px;margin:0;white-space:pre-line">${safeMessage}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${action}</table></td></tr><tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;padding:20px 30px"><p style="color:#64748b;font-family:Arial,sans-serif;font-size:12px;line-height:19px;margin:0">Recibiste este correo porque tenés activadas las notificaciones por email de Mind. Podés <a href="${escapeHtml(preferencesUrl)}" style="color:#1d4ed8">cambiar tus preferencias</a> cuando quieras.</p><p style="color:#94a3b8;font-family:Arial,sans-serif;font-size:11px;line-height:17px;margin:12px 0 0">Mind OS · Epical Intelligence</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${input.title}\n\n${input.message}${url ? `\n\nAbrir en Mind: ${url}` : ""}\n\nRecibiste este correo porque tenés activadas las notificaciones por email de Mind. Preferencias: ${preferencesUrl}`;
  return { html, text };
}

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

export async function sendUserWebPushTest(userId: number, endpoint: string, testId: string) {
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
  if (pushTestLastSentAt.size > 1000) {
    for (const [key, at] of pushTestLastSentAt) if (now - at > 30_000) pushTestLastSentAt.delete(key);
  }
  try {
    const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || "";
    await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({
      title: "Prueba de notificaciones de Mind",
      body: "Tu navegador recibió correctamente este aviso.",
      url: getActionUrl(origin, "/notifications") || "/notifications",
      tag: `mind-push-test-${userId}-${now}`,
      renotify: true,
      testId,
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


type NotificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function createUserNotifications(userIds: number[], input: UserNotificationInput, transaction?: NotificationTransaction): Promise<boolean> {
  const candidates = [...new Set(userIds.filter(id => Number.isInteger(id) && id > 0))];
  if (!candidates.length) return true;
  const write = async (tx: NotificationTransaction) => {
    const eligible = await tx.select({ id: users.id }).from(users).where(and(inArray(users.id, candidates), notificationAccess(users.id, input)));
    if (!eligible.length) return;
    const rows = await tx.insert(userNotifications).values(eligible.map(({ id }) => ({
      ...input, createdAt:new Date(), userId: id, actionUrl: safeNotificationPath(input.actionUrl),
      threadKey: input.threadKey ?? `${input.type}:${input.entityType ?? "notice"}:${input.entityId ?? input.eventKey}`,
    }))).onConflictDoNothing().returning();
    for (const row of rows) {
      const [prefs] = await tx.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, row.userId));
      const [muted] = await tx.select().from(userNotificationThreadMutes).where(and(eq(userNotificationThreadMutes.userId, row.userId), eq(userNotificationThreadMutes.threadKey, row.threadKey!)));
      if (!prefs || muted) continue;
      const settings = notificationSettingsSchema.parse(prefs.settings ?? defaultNotificationSettings);
      const category = preferenceCategory(row.type)!;
      const activity = isActivityNotification(row.type);
      const digest = activity && settings.activityEmailMode === "daily";
      const now = new Date();
      if (prefs.emailEnabled && prefs.categoryPreferences?.[category]?.email !== false && !(activity && settings.activityEmailMode === "off")) {
        const due = notificationSendAt(now, settings, digest);
        const batchKey = digest ? `digest:${row.userId}:${due.toISOString()}` : `notification:${row.id}`;
        await tx.insert(userNotificationEmailDeliveries).values({ notificationId: row.id, userId: row.userId, nextAttemptAt: due, batchKey }).onConflictDoNothing();
        await tx.execute(sql`INSERT INTO notification_email_batches(batch_key,user_id) VALUES(${batchKey},${row.userId}) ON CONFLICT DO NOTHING`);
      }
      if (prefs.desktopEnabled && prefs.categoryPreferences?.[category]?.desktop !== false) {
        const subscriptions = await tx.select({ id: userNotificationPushSubscriptions.id }).from(userNotificationPushSubscriptions).where(eq(userNotificationPushSubscriptions.userId, row.userId));
        if (subscriptions.length) await tx.insert(userNotificationPushDeliveries).values(subscriptions.map(sub => ({ notificationId: row.id, subscriptionId: sub.id, nextAttemptAt: notificationSendAt(now, settings) }))).onConflictDoNothing();
      }
    }
  };
  // A transactional caller rolls back the business mutation if the outbox cannot
  // be saved. A committed event is never acknowledged without its delivery work.
  if (transaction) { await write(transaction); return true; }
  try { await db.transaction(write); return true; }
  catch (error) { console.error("No se pudo guardar la notificación:", error instanceof Error ? error.message : error); return false; }
}

const retryDelaysMs = [15_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000];
let dispatchRunning = false;
let pushRunning = false;
const origin = () => process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || "";

export async function dispatchUserNotificationPushes() {
  if (pushRunning || !getPushConfig()) return;
  pushRunning = true;
  try {
    const claimed = await pool.query(`WITH due AS (
      SELECT id FROM user_notification_push_deliveries WHERE (status='pending' AND next_attempt_at<=NOW())
        OR (status='processing' AND locked_at<NOW()-INTERVAL '5 minutes') ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 25
    ) UPDATE user_notification_push_deliveries d SET status='processing', attempts=d.attempts+1, locked_at=NOW()
      FROM due WHERE due.id=d.id RETURNING d.*`);
    await Promise.all(claimed.rows.map(async (delivery) => {
      const [row] = await db.select({ n: userNotifications, sub: userNotificationPushSubscriptions, prefs: userNotificationPreferences,
        allowed: notificationAccess(userNotifications.userId),
        muted: sql<boolean>`EXISTS(SELECT 1 FROM user_notification_thread_mutes m WHERE m.user_id=${userNotifications.userId} AND m.thread_key=${userNotifications.threadKey})`,
      }).from(userNotificationPushDeliveries)
        .innerJoin(userNotifications, eq(userNotifications.id, userNotificationPushDeliveries.notificationId))
        .innerJoin(userNotificationPushSubscriptions, eq(userNotificationPushSubscriptions.id, userNotificationPushDeliveries.subscriptionId))
        .leftJoin(userNotificationPreferences, eq(userNotificationPreferences.userId, userNotifications.userId))
        .where(eq(userNotificationPushDeliveries.id, delivery.id));
      const set = async (fields: Partial<typeof userNotificationPushDeliveries.$inferInsert>) => db.update(userNotificationPushDeliveries).set({ ...fields, lockedAt: null }).where(and(eq(userNotificationPushDeliveries.id, delivery.id), eq(userNotificationPushDeliveries.lockedAt, delivery.locked_at)));
      const category = row && preferenceCategory(row.n.type);
      if (!row || !row.allowed || row.muted || row.n.readAt || !category || row.sub.userId !== row.n.userId || !row.prefs?.desktopEnabled || row.prefs.categoryPreferences?.[category]?.desktop === false || Date.now() - row.n.createdAt.getTime() > 24 * 3600_000) {
        await set({ status: "cancelled" }); return;
      }
      const due = notificationSendAt(new Date(), notificationSettingsSchema.parse(row.prefs.settings));
      if (due.getTime() > Date.now() + 1000) { await set({ status: "pending", nextAttemptAt: due, attempts: Math.max(0, delivery.attempts - 1) }); return; }
      try {
        const discreet = row.prefs.discreetMode !== false;
        await webpush.sendNotification({ endpoint: row.sub.endpoint, keys: { p256dh: row.sub.p256dh, auth: row.sub.auth } }, JSON.stringify({
          title: discreet ? "Tenés una novedad en Mind" : row.n.title,
          body: discreet ? "Abrí Mind para ver los detalles." : row.n.message,
          url: getActionUrl(origin(), row.n.actionUrl ?? undefined) || "/notifications", tag: `mind-${row.n.id}`, userId: row.n.userId,
        }), { TTL: 3600, timeout: 15_000 });
        await set({ status: "sent", lastError: null });
      } catch (error: any) {
        if ([404, 410].includes(error?.statusCode)) { await db.delete(userNotificationPushSubscriptions).where(eq(userNotificationPushSubscriptions.id, row.sub.id)); return; }
        const delay = (!error?.statusCode || error.statusCode === 429 || error.statusCode >= 500) ? retryDelaysMs[delivery.attempts - 1] : undefined;
        await set({ status: delay === undefined ? "failed" : "pending", nextAttemptAt: new Date(Date.now() + (delay ?? 0)), lastError: `Web Push: ${error?.statusCode ?? "error de red"}` });
      }
    }));
  } catch (error) { console.error("No se pudo procesar la cola Web Push:", error instanceof Error ? error.message : error); }
  finally { pushRunning = false; }
}

type MailPayload = { from: string; to: string; subject: string; html: string; text: string; ids: number[]; discreet: boolean };
export async function dispatchUserNotificationEmails() {
  if (dispatchRunning || !getTransactionalEmailConfig()) return;
  dispatchRunning = true;
  try {
    // Bootstrap legacy deliveries, without dropping pending work at deployment.
    await pool.query(`INSERT INTO notification_email_batches(batch_key,user_id)
      SELECT DISTINCT COALESCE(batch_key,'notification:'||notification_id),user_id FROM user_notification_email_deliveries WHERE status IN ('pending','processing') ON CONFLICT DO NOTHING`);
    const claimed = await pool.query(`WITH due AS (
      SELECT b.batch_key FROM notification_email_batches b WHERE
        (b.status='pending' AND EXISTS(SELECT 1 FROM user_notification_email_deliveries d WHERE COALESCE(d.batch_key,'notification:'||d.notification_id)=b.batch_key
          AND ((d.status='pending' AND d.next_attempt_at<=NOW()) OR (d.status='processing' AND d.locked_at<NOW()-INTERVAL '5 minutes'))))
        OR (b.status='processing' AND b.updated_at<NOW()-INTERVAL '5 minutes')
      ORDER BY b.updated_at FOR UPDATE SKIP LOCKED LIMIT 10
    ) UPDATE notification_email_batches b SET status='processing',updated_at=NOW() FROM due WHERE b.batch_key=due.batch_key RETURNING b.*`);
    for (const batch of claimed.rows) {
      await processEmailBatch(batch);
    }
  } catch (error) { console.error("No se pudo procesar la cola de emails:", error instanceof Error ? error.message : error); }
  finally { dispatchRunning = false; }
}

async function processEmailBatch(batch: { batch_key: string; user_id: number; payload: MailPayload | null; updated_at: Date }) {
  const deliveries = await db.select({ d: userNotificationEmailDeliveries, n: userNotifications,
    allowed: notificationAccess(userNotifications.userId),
    muted: sql<boolean>`EXISTS(SELECT 1 FROM user_notification_thread_mutes m WHERE m.user_id=${userNotifications.userId} AND m.thread_key=${userNotifications.threadKey})`,
  }).from(userNotificationEmailDeliveries).innerJoin(userNotifications, eq(userNotifications.id, userNotificationEmailDeliveries.notificationId))
    .where(sql`COALESCE(${userNotificationEmailDeliveries.batchKey}, 'notification:'||${userNotificationEmailDeliveries.notificationId})=${batch.batch_key} AND ${userNotificationEmailDeliveries.status} IN ('pending','processing')`);
  const [user] = await db.select().from(users).where(eq(users.id, batch.user_id));
  const [prefs] = await db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, batch.user_id));
  const settings = notificationSettingsSchema.parse(prefs?.settings ?? defaultNotificationSettings);
  const suppressed = user?.email ? (await pool.query("SELECT 1 FROM notification_email_suppressions WHERE email=lower(trim($1))",[user.email])).rowCount : 0;
  const eligible = deliveries.filter(({ allowed, muted, n }) => {
    const category = preferenceCategory(n.type);
    return !suppressed && allowed && !muted && !n.readAt && user?.isActive && user.email && prefs?.emailEnabled && category && prefs.categoryPreferences?.[category]?.email !== false && !(isActivityNotification(n.type) && settings.activityEmailMode === "off");
  });
  const ids = eligible.map(row => row.d.id).sort((a,b) => a-b);
  const discarded = deliveries.filter(row => !ids.includes(row.d.id)).map(row => row.d.id);
  if (discarded.length) await db.update(userNotificationEmailDeliveries).set({ status: "cancelled", lockedAt: null, updatedAt: new Date() }).where(inArray(userNotificationEmailDeliveries.id, discarded));
  const discreet = prefs?.discreetMode !== false;
  // An immutable retry payload must not disclose revoked access or a newer
  // privacy choice. Stop that attempt rather than resend an obsolete snapshot.
  if (!ids.length || (batch.payload && (JSON.stringify(batch.payload.ids) !== JSON.stringify(ids) || (discreet && !batch.payload.discreet) || batch.payload.to !== user.email))) {
    if (ids.length) await db.update(userNotificationEmailDeliveries).set({ status: "cancelled", lockedAt: null, lastError: "Las preferencias o el acceso cambiaron durante el envío.", updatedAt: new Date() }).where(inArray(userNotificationEmailDeliveries.id, ids));
    await pool.query("UPDATE notification_email_batches SET status='cancelled',updated_at=NOW() WHERE batch_key=$1", [batch.batch_key]); return;
  }
  const due = notificationSendAt(new Date(), settings);
  if (due.getTime() > Date.now() + 1000) {
    await db.update(userNotificationEmailDeliveries).set({ status: "pending", nextAttemptAt: due, lockedAt: null }).where(inArray(userNotificationEmailDeliveries.id, ids));
    await pool.query("UPDATE notification_email_batches SET status='pending',updated_at=NOW() WHERE batch_key=$1", [batch.batch_key]); return;
  }
  const attempts = Math.max(...eligible.map(row => row.d.attempts)) + 1;
  await db.update(userNotificationEmailDeliveries).set({ status: "processing", attempts, lockedAt: new Date(), updatedAt: new Date() }).where(inArray(userNotificationEmailDeliveries.id, ids));
  let payload = batch.payload;
  if (!payload) {
    const digest = batch.batch_key.startsWith("digest:");
    const latest = eligible.at(-1)!.n;
    const title = digest ? `Tu resumen de Mind · ${eligible.length} novedades` : discreet ? discreetEmailCopy[latest.type]?.subject ?? "Tenés una novedad en Mind" : latest.title;
    const message = digest ? (discreet ? `Tenés ${eligible.length} novedades en tus conversaciones y dailies. Abrí Mind para revisarlas.` : eligible.slice(0, 30).map(({ n }) => `${n.title}: ${n.message}`).join("\n\n")) : discreet ? discreetEmailCopy[latest.type]?.message ?? "Abrí Mind para ver los detalles." : latest.message;
    const content = buildNotificationEmail({ eventKey: batch.batch_key, type: digest ? "digest" : latest.type, title, message }, getActionUrl(origin(), digest ? "/notifications" : latest.actionUrl ?? "/notifications"), getActionUrl(origin(), "/mind-email-brand.png"));
    payload = { from: getTransactionalEmailConfig()!.from, to: user.email, subject: title, ...content, ids, discreet };
    await pool.query("UPDATE notification_email_batches SET payload=$2 WHERE batch_key=$1", [batch.batch_key, JSON.stringify(payload)]);
  }
  try {
    const { ids: _ids, discreet: _discreet, ...body } = payload;
    // Keep the provider identity used by the pre-upgrade worker for individual
    // notifications. A recovered lease must not become a second email request.
    const deliveryKey = batch.batch_key.startsWith("digest:") ? batch.batch_key : `${eligible[0].n.eventKey}:${batch.user_id}`;
    const [response] = await sendTransactionalEmail(body,deliveryKey);
    const result = { id:response.headers["x-message-id"] };
    await db.transaction(async tx => {
      await tx.update(userNotificationEmailDeliveries).set({ status: "sent", deliveryStatus: "accepted", deliveryProvider:getTransactionalEmailConfig()!.provider,sentAt: new Date(), resendEmailId: result.id!, lastError: null, lockedAt: null, updatedAt: new Date() }).where(inArray(userNotificationEmailDeliveries.id, ids));
      await tx.execute(sql`UPDATE notification_email_batches SET status='sent',provider_id=${result.id},updated_at=NOW() WHERE batch_key=${batch.batch_key}`);
      await reconcileNotificationEmailEvents(result.id!,tx,getTransactionalEmailConfig()!.provider);
    });
  } catch (error: any) {
    const delay = error?.retryAfterMs ?? (error?.retryable !== false ? retryDelaysMs[attempts - 1] : undefined);
    const status = delay === undefined ? "failed" : "pending";
    await db.transaction(async tx => {
      await tx.update(userNotificationEmailDeliveries).set({ status, attempts:error?.retryAfterMs ? attempts-1 : attempts, nextAttemptAt: new Date(Date.now() + (delay ?? 0)), lockedAt: null, lastError: error instanceof Error ? error.message.slice(0,500) : "Error de envío", updatedAt: new Date() }).where(inArray(userNotificationEmailDeliveries.id, ids));
      await tx.execute(sql`UPDATE notification_email_batches SET status=${status},updated_at=NOW() WHERE batch_key=${batch.batch_key}`);
    });
  }
}

export async function retryUserNotificationEmailDelivery(id: number) {
  return db.transaction(async tx => {
    const [row] = await tx.update(userNotificationEmailDeliveries).set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null, updatedAt: new Date() })
      .where(and(eq(userNotificationEmailDeliveries.id,id),eq(userNotificationEmailDeliveries.status,"failed"))).returning();
    if (!row) return false;
    // Retry the original immutable batch with the same provider idempotency key.
    const key = row.batchKey ?? `notification:${row.notificationId}`;
    await tx.update(userNotificationEmailDeliveries).set({ status: "pending", attempts: 0, nextAttemptAt: new Date() }).where(and(eq(userNotificationEmailDeliveries.batchKey,key),eq(userNotificationEmailDeliveries.status,"failed")));
    await tx.execute(sql`UPDATE notification_email_batches SET status='pending',updated_at=NOW() WHERE batch_key=${key}`);
    return true;
  });
}

export function startUserNotificationEmailWorker() {
  let reconciling = false;
  let lastReconciled = 0;
  const reconcile = async () => {
    if (reconciling || Date.now()-lastReconciled < 60_000) return;
    reconciling=true;
    try {
      // Approval requests remain durable until decided. Recover missed enqueue
      // work after a crash between the quotation commit and its notification.
      const pending=await pool.query("SELECT id FROM quotations WHERE status='pending' AND archived_at IS NULL ORDER BY id");
      const {notifyQuotationApprovalRequests}=await import("./quotation-approval-notifications");
      for(let i=0;i<pending.rows.length;i+=100) await notifyQuotationApprovalRequests(pending.rows.slice(i,i+100).map(r=>r.id));
      lastReconciled=Date.now();
    } catch(error) {console.error("No se pudieron recuperar los avisos de aprobación:",error instanceof Error?error.message:error);}
    finally {reconciling=false;}
  };
  const run = () => { void reconcile(); void dispatchUserNotificationEmails(); void dispatchUserNotificationPushes(); };
  run(); const timer = setInterval(run, 15_000); timer.unref(); return () => clearInterval(timer);
}
