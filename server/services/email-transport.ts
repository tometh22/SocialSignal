import { createHash } from "node:crypto";
import { pool } from "../db";
import { reconcileNotificationEmailEvents } from "./notification-email-events";

type Email = {
  from?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: {
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }[];
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
export function getTransactionalEmailConfig() {
  const provider =
    process.env.MAIL_PROVIDER ||
    (process.env.RESEND_API_KEY ? "resend" : "sendgrid");
  const apiKey =
    provider === "resend"
      ? process.env.RESEND_API_KEY
      : provider === "sendgrid"
        ? process.env.SENDGRID_API_KEY
        : undefined;
  const from =
    provider === "resend"
      ? process.env.RESEND_FROM_EMAIL
      : process.env.SENDGRID_FROM_EMAIL;
  return apiKey && from ? { provider, apiKey, from } : null;
}

// Shared transport for notifications, CRM, IPC and proposals. Accepted is kept
// separate from delivered; ambiguous SendGrid responses require reconciliation.
export async function sendTransactionalEmail(
  email: Email,
  idempotencyKey: string,
) {
  const config = getTransactionalEmailConfig();
  if (!config)
    throw Object.assign(
      new Error("El proveedor de email no está configurado."),
      { retryable: true },
    );
  const payload = { ...email, from: config.from };
  const hash = createHash("sha256")
    .update(
      JSON.stringify(canonical({ provider: config.provider, ...payload })),
    )
    .digest("hex");
  const key = createHash("sha256").update(idempotencyKey).digest("hex");
  const reserved = await pool.query(
    `INSERT INTO transactional_email_deliveries(idempotency_key,payload_hash,provider,recipient)
    VALUES($1,$2,$3,$4) ON CONFLICT(idempotency_key) DO UPDATE SET status='processing',updated_at=NOW()
    WHERE transactional_email_deliveries.payload_hash=EXCLUDED.payload_hash
      AND (transactional_email_deliveries.provider <> 'resend' OR transactional_email_deliveries.created_at>NOW()-INTERVAL '23 hours') AND
      (transactional_email_deliveries.status='failed' OR (transactional_email_deliveries.provider='resend' AND transactional_email_deliveries.status='processing' AND transactional_email_deliveries.updated_at<NOW()-INTERVAL '5 minutes'))
    RETURNING idempotency_key`,
    [key, hash, config.provider, payload.to],
  );
  if (!reserved.rowCount) {
    const existing = (
      await pool.query(
        "SELECT * FROM transactional_email_deliveries WHERE idempotency_key=$1",
        [key],
      )
    ).rows[0];
    if (existing?.payload_hash !== hash)
      throw Object.assign(
        new Error("El contenido del envío cambió. Revisá el intento anterior."),
        { retryable: false },
      );
    if (existing.status === "accepted")
      return [{ headers: { "x-message-id": existing.provider_id as string } }];
    if (
      existing.provider === "resend" &&
      Date.now() - new Date(existing.created_at).getTime() > 23 * 3600_000
    ) {
      await pool.query(
        "UPDATE transactional_email_deliveries SET status='uncertain',last_error='Venció el plazo seguro de reintento. Revisá el proveedor.',updated_at=NOW() WHERE idempotency_key=$1",
        [key],
      );
      throw Object.assign(
        new Error(
          "Venció el plazo seguro de reintento. Revisá el proveedor antes de reenviar.",
        ),
        { retryable: false },
      );
    }
    if (
      existing.provider === "sendgrid" &&
      existing.status === "processing" &&
      Date.now() - new Date(existing.updated_at).getTime() > 5 * 60_000
    ) {
      await pool.query(
        "UPDATE transactional_email_deliveries SET status='uncertain',last_error='Entrega incierta. Revisá SendGrid antes de reenviar.',updated_at=NOW() WHERE idempotency_key=$1",
        [key],
      );
      throw Object.assign(
        new Error(
          "La entrega requiere revisión en SendGrid antes de reenviar.",
        ),
        { retryable: false },
      );
    }
    throw Object.assign(
      new Error(
        existing.status === "uncertain"
          ? "La entrega requiere revisión en el proveedor antes de reenviar."
          : "Este envío todavía está en proceso.",
      ),
      {
        retryable: existing.status === "processing",
        retryAfterMs: existing.status === "processing" ? 5 * 60_000 : undefined,
      },
    );
  }
  try {
    let providerId: string;
    if (config.provider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(
          canonical({
            ...payload,
            attachments: payload.attachments?.map((a) => ({
              content: a.content,
              filename: a.filename,
            })),
          }),
        ),
        signal: AbortSignal.timeout(15_000),
      });
      const result = (await response.json().catch(() => ({}))) as {
        id?: string;
      };
      if (!response.ok)
        throw Object.assign(
          new Error(`Resend respondió HTTP ${response.status}.`),
          {
            retryable: response.status === 429 || response.status >= 500,
            definitive: true,
          },
        );
      if (!result.id)
        throw Object.assign(
          new Error("Resend no devolvió un identificador de envío."),
          { retryable: true },
        );
      providerId = result.id;
    } else {
      const { default: sendgrid } = await import("@sendgrid/mail");
      sendgrid.setApiKey(config.apiKey);
      const [result] = await sendgrid.send(payload);
      providerId = String(result.headers["x-message-id"] ?? "");
      if (!providerId)
        throw new Error("SendGrid no devolvió un identificador de envío.");
    }
    await pool.query(
      "UPDATE transactional_email_deliveries SET status='accepted',provider_id=$2,delivery_status='accepted',last_error=NULL,updated_at=NOW() WHERE idempotency_key=$1",
      [key, providerId],
    );
    await reconcileNotificationEmailEvents(
      providerId,
      undefined,
      config.provider,
    ).catch((error) =>
      console.error(
        "No se pudo conciliar el estado de entrega:",
        error instanceof Error ? error.message : error,
      ),
    );
    return [{ headers: { "x-message-id": providerId } }];
  } catch (error: any) {
    const code = error?.response?.statusCode ?? error?.code;
    const definitive =
      error?.definitive ||
      (typeof code === "number" && code >= 400 && code <= 599);
    const uncertain = config.provider === "sendgrid" && !definitive;
    const retryable =
      !uncertain &&
      (error?.retryable ?? (!definitive || code === 429 || code >= 500));
    const message = uncertain
      ? "Entrega incierta en SendGrid. Revisá el proveedor antes de reenviar."
      : error instanceof Error
        ? error.message
        : "Falló el envío";
    await pool.query(
      "UPDATE transactional_email_deliveries SET status=$2,last_error=$3,updated_at=NOW() WHERE idempotency_key=$1",
      [key, uncertain ? "uncertain" : "failed", message.slice(0, 500)],
    );
    throw Object.assign(new Error(message), { retryable });
  }
}
