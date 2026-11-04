import {
  createHmac,
  timingSafeEqual,
  createPublicKey,
  verify,
} from "node:crypto";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";

export function verifyNotificationWebhook(
  body: Buffer,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret: string,
  now = Date.now(),
) {
  if (
    !secret.startsWith("whsec_") ||
    !headers.id ||
    !headers.timestamp ||
    !headers.signature ||
    !/^\d+$/.test(headers.timestamp) ||
    Math.abs(now / 1000 - Number(headers.timestamp)) > 300
  )
    throw new Error("Firma inválida");
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`${headers.id}.${headers.timestamp}.`)
    .update(body)
    .digest();
  const valid = headers.signature.split(" ").some((signature) => {
    const [version, encoded] = signature.split(",");
    const received = Buffer.from(encoded ?? "", "base64");
    return (
      version === "v1" &&
      received.length === expected.length &&
      timingSafeEqual(received, expected)
    );
  });
  if (!valid) throw new Error("Firma inválida");
  return z
    .object({
      type: z.string(),
      created_at: z.string().datetime({ offset: true }),
      data: z.object({ email_id: z.string() }).passthrough(),
    })
    .parse(JSON.parse(body.toString("utf8")));
}

export async function reconcileNotificationEmailEvents(
  providerId: string,
  tx: Pick<typeof db, "execute"> = db,
  provider = "resend",
) {
  // Terminal states win even if the provider delivers events out of order.
  await tx.execute(sql`UPDATE user_notification_email_deliveries d SET
    delivery_status = e.state,
    delivered_at = CASE WHEN e.state='delivered' THEN e.occurred_at ELSE d.delivered_at END,
    updated_at=NOW()
    FROM (SELECT replace(type,'email.','') AS state,occurred_at FROM notification_email_events WHERE provider_id=${providerId} AND provider=${provider}
      AND type IN ('email.sent','email.delivery_delayed','email.delivered','email.failed','email.bounced','email.complained','email.suppressed')
      ORDER BY CASE type WHEN 'email.complained' THEN 7 WHEN 'email.bounced' THEN 6 WHEN 'email.suppressed' THEN 5
        WHEN 'email.failed' THEN 4 WHEN 'email.delivered' THEN 3 WHEN 'email.delivery_delayed' THEN 2 ELSE 1 END DESC,occurred_at DESC LIMIT 1) e
    WHERE d.resend_email_id=${providerId} AND d.delivery_provider=${provider}`);
  await tx.execute(sql`INSERT INTO notification_email_suppressions(email,reason)
    SELECT DISTINCT lower(trim(b.payload->>'to')),d.delivery_status FROM notification_email_batches b
    JOIN user_notification_email_deliveries d ON d.resend_email_id=b.provider_id
    WHERE b.provider_id=${providerId} AND d.delivery_provider=${provider} AND d.delivery_status IN ('bounced','complained','suppressed') AND b.payload->>'to' IS NOT NULL
    ON CONFLICT(email) DO UPDATE SET reason=EXCLUDED.reason`);
  await tx.execute(sql`UPDATE transactional_email_deliveries d SET delivery_status=e.state,updated_at=NOW()
    FROM (SELECT replace(type,'email.','') AS state FROM notification_email_events WHERE provider_id=${providerId} AND provider=${provider}
      AND type IN ('email.sent','email.delivery_delayed','email.delivered','email.failed','email.bounced','email.complained','email.suppressed')
      ORDER BY CASE type WHEN 'email.complained' THEN 7 WHEN 'email.bounced' THEN 6 WHEN 'email.suppressed' THEN 5 WHEN 'email.failed' THEN 4 WHEN 'email.delivered' THEN 3 WHEN 'email.delivery_delayed' THEN 2 ELSE 1 END DESC,occurred_at DESC LIMIT 1) e
    WHERE d.provider=${provider} AND d.provider_id=${providerId}`);
}

export async function recordNotificationEmailEvent(
  eventId: string,
  event: ReturnType<typeof verifyNotificationWebhook>,
  provider = "resend",
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO notification_email_events(event_id,provider_id,provider,type,occurred_at)
      VALUES(${eventId},${event.data.email_id},${provider},${event.type},${new Date(event.created_at)}) ON CONFLICT DO NOTHING`);
    await reconcileNotificationEmailEvents(event.data.email_id, tx, provider);
  });
}

export function verifySendgridWebhook(
  body: Buffer,
  headers: { timestamp?: string; signature?: string },
  publicKey: string,
  now = Date.now(),
) {
  if (
    !headers.timestamp ||
    !headers.signature ||
    !/^\d+$/.test(headers.timestamp) ||
    Math.abs(now / 1000 - Number(headers.timestamp)) > 300
  )
    throw Error("Firma inválida");
  const key = publicKey.includes("BEGIN PUBLIC KEY")
    ? createPublicKey(publicKey)
    : createPublicKey({
        key: Buffer.from(publicKey, "base64"),
        format: "der",
        type: "spki",
      });
  if (
    !verify(
      "sha256",
      Buffer.concat([Buffer.from(headers.timestamp), body]),
      key,
      Buffer.from(headers.signature, "base64"),
    )
  )
    throw Error("Firma inválida");
  return z
    .array(
      z.object({
        event: z.string(),
        sg_event_id: z.string(),
        sg_message_id: z.string(),
        timestamp: z.number().int().nonnegative(),
      }),
    )
    .max(1000)
    .parse(JSON.parse(body.toString("utf8")));
}
export async function recordSendgridEvents(
  events: ReturnType<typeof verifySendgridWebhook>,
) {
  const types: Record<string, string> = {
    processed: "email.sent",
    deferred: "email.delivery_delayed",
    delivered: "email.delivered",
    bounce: "email.bounced",
    dropped: "email.failed",
    spamreport: "email.complained",
  };
  for (const event of events) {
    if (!types[event.event]) continue;
    await recordNotificationEmailEvent(
      `sendgrid:${event.sg_event_id}`,
      {
        type: types[event.event],
        created_at: new Date(event.timestamp * 1000).toISOString(),
        data: { email_id: event.sg_message_id.split(".")[0] },
      },
      "sendgrid",
    );
  }
}
