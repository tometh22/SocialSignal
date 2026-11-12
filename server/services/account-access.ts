import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import type { AccountLinkPurpose, InvitationStatus } from "@shared/account-access";
import { pool } from "../db";
import { hashPassword } from "./passwords";
import { getTransactionalEmailConfig, sendTransactionalEmail } from "./email-transport";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidLink = () => Object.assign(new Error("El enlace venció, ya fue utilizado o fue reemplazado. Pedí uno nuevo."), { statusCode: 400 });
const publicColumns = `id, first_name AS "firstName", last_name AS "lastName", email,
  is_admin AS "isAdmin", is_active AS "isActive", permissions, role, created_at AS "createdAt"`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

// Never derive a password-bearing link from a request's Host header.
export function accountAppUrl() {
  const url = new URL(process.env.APP_URL || process.env.PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "https://mind.epical.digital" : "http://localhost:5000"));
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("APP_URL debe usar HTTPS");
  return url.origin;
}

export function assertAccountEmailConfigured() {
  accountAppUrl();
  if (!getTransactionalEmailConfig()) throw Object.assign(new Error("Configurá el proveedor de correo antes de invitar usuarios."), { statusCode: 503 });
}

async function transaction<T>(action: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

type Link = { id: number; token: string; email: string; firstName: string; purpose: AccountLinkPurpose; expiresAt: Date };
async function reserveLink(client: PoolClient, userId: number, purpose: AccountLinkPurpose): Promise<Link> {
  // All issuance and consumption lock the user first, including concurrent resends.
  const user = (await client.query("SELECT email, first_name, is_active FROM users WHERE id=$1 FOR UPDATE", [userId])).rows[0];
  if (!user || user.is_active === false) throw Object.assign(new Error("El usuario no existe o está desactivado."), { statusCode: 409 });
  const recent = await client.query("SELECT id FROM account_access_links WHERE user_id=$1 AND purpose=$2 AND created_at>NOW()-INTERVAL '1 minute' LIMIT 1", [userId, purpose]);
  if (recent.rowCount) throw Object.assign(new Error("Esperá un minuto antes de solicitar otro enlace."), { statusCode: 429 });
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + (purpose === "invitation" ? 48 : 1) * 3600_000);
  await client.query("UPDATE account_access_links SET revoked_at=NOW() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL AND revoked_at IS NULL", [userId, purpose]);
  const result = await client.query(`INSERT INTO account_access_links(user_id,email,purpose,token_hash,expires_at)
    VALUES($1,$2,$3,$4,$5) RETURNING id`, [userId, user.email, purpose, digest(token), expiresAt]);
  return { id: result.rows[0].id, token, email: user.email, firstName: user.first_name, purpose, expiresAt };
}

async function deliverLink(link: Link) {
  const invitation = link.purpose === "invitation";
  // Fragments stay out of HTTP access logs and Referer headers.
  const url = `${accountAppUrl()}/${invitation ? "accept-invitation" : "reset-password"}#token=${link.token}`;
  const title = invitation ? "Te invitaron a Mind" : "Restablecé tu contraseña de Mind";
  const action = invitation ? "Crear mi contraseña" : "Restablecer contraseña";
  const intro = invitation ? "Ya tenés una cuenta en Mind. Elegí tu contraseña para empezar." : "Recibimos una solicitud para restablecer tu contraseña.";
  const expiry = invitation ? "48 horas" : "1 hora";
  let sent = false;
  try {
    await sendTransactionalEmail({
      to: link.email, subject: title,
      text: `Hola ${link.firstName},\n\n${intro}\n\n${action}: ${url}\n\nIngresás con ${link.email}. El enlace vence en ${expiry} y se puede usar una sola vez. Si recibís otro enlace, usá el más reciente.\n\nSi no esperabas este correo, podés ignorarlo.`,
      html: `<div style="font-family:Arial,sans-serif;color:#172033;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:26px">${title}</h1><p>Hola ${escapeHtml(link.firstName)},</p><p>${intro}</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#e64069;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">${action}</a></p><p>Ingresás con <strong>${escapeHtml(link.email)}</strong>.</p><p>El enlace vence en ${expiry} y se puede usar una sola vez. Si recibís otro enlace, usá el más reciente.</p><p style="color:#64748b;font-size:13px">Si no esperabas este correo, podés ignorarlo. Tu contraseña actual se mantiene hasta que elijas una nueva.</p></div>`,
    }, `account-access:${link.id}`);
    sent = true;
  } catch {
    // Never log provider payloads or URLs: they contain a bearer credential.
    console.error(`No se pudo confirmar el envío del enlace de acceso ${link.id}`);
  }
  try {
    await pool.query("UPDATE account_access_links SET delivery_status=$2,sent_at=CASE WHEN $2='accepted' THEN NOW() ELSE NULL END WHERE id=$1", [link.id, sent ? "accepted" : "failed"]);
  } catch { console.error(`No se pudo registrar el estado del enlace de acceso ${link.id}`); }
  // A failed metadata write must not turn a committed account creation into a 500.
  return sent;
}

export async function createInvitedUser(input: { firstName: string; lastName: string; email: string; permissions: string[]; isAdmin: boolean }) {
  assertAccountEmailConfigured();
  // The account cannot be accessed with an administrator-chosen/default password.
  const password = await hashPassword(randomBytes(48).toString("hex"));
  const { user, link } = await transaction(async client => {
    const existing = await client.query("SELECT id FROM users WHERE lower(email)=lower($1)", [input.email]);
    if (existing.rowCount) throw Object.assign(new Error("El email ya está registrado"), { statusCode: 409 });
    const result = await client.query(`INSERT INTO users(first_name,last_name,email,password,permissions,is_admin,is_active)
      VALUES($1,$2,$3,$4,$5,$6,true) RETURNING ${publicColumns}`, [input.firstName, input.lastName, input.email, password, input.permissions, input.isAdmin]);
    const user = result.rows[0];
    const link = await reserveLink(client, user.id, "invitation");
    return { user, link };
  });
  const sent = await deliverLink(link);
  return { ...user, invitation: { status: sent ? "pending" : "failed", expiresAt: link.expiresAt.toISOString() } satisfies InvitationStatus };
}

export async function sendAccountLink(userId: number, purpose: AccountLinkPurpose) {
  assertAccountEmailConfigured();
  const link = await transaction(client => reserveLink(client, userId, purpose));
  return { sent: await deliverLink(link), expiresAt: link.expiresAt.toISOString() };
}

export async function getInvitationStatuses(userIds: number[]): Promise<Map<number, InvitationStatus>> {
  if (!userIds.length) return new Map();
  const { rows } = await pool.query(`SELECT DISTINCT ON (a.user_id) a.*,u.email AS current_email
    FROM account_access_links a JOIN users u ON u.id=a.user_id
    WHERE a.user_id=ANY($1::int[]) AND a.purpose='invitation' ORDER BY a.user_id,a.id DESC`, [userIds]);
  return new Map(rows.map(row => [row.user_id, {
    status: row.consumed_at ? "accepted" : row.revoked_at || row.email !== row.current_email ? "revoked" :
      new Date(row.expires_at).getTime() <= Date.now() ? "expired" : row.delivery_status === "failed" ? "failed" :
      row.delivery_status === "accepted" ? "pending" : "unconfirmed",
    sentAt: row.sent_at?.toISOString(), expiresAt: row.expires_at.toISOString(),
  }]));
}

export async function validateAccountLink(token: string, purpose: AccountLinkPurpose) {
  const { rows } = await pool.query(`SELECT a.user_id,u.email,u.first_name AS "firstName" FROM account_access_links a
    JOIN users u ON u.id=a.user_id WHERE a.token_hash=$1 AND a.purpose=$2 AND a.expires_at>NOW()
    AND a.consumed_at IS NULL AND a.revoked_at IS NULL AND u.is_active IS NOT FALSE AND a.email=u.email`, [digest(token), purpose]);
  if (!rows[0]) throw invalidLink();
  return rows[0] as { user_id: number; email: string; firstName: string };
}

export async function completeAccountLink(token: string, purpose: AccountLinkPurpose, password: string) {
  const target = await validateAccountLink(token, purpose);
  const hashed = await hashPassword(password);
  await transaction(async client => {
    const user = (await client.query("SELECT email,is_active FROM users WHERE id=$1 FOR UPDATE", [target.user_id])).rows[0];
    if (!user || user.is_active === false) throw invalidLink();
    const consumed = await client.query(`UPDATE account_access_links SET consumed_at=NOW()
      WHERE token_hash=$1 AND purpose=$2 AND user_id=$3 AND email=$4 AND expires_at>NOW()
      AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id`, [digest(token), purpose, target.user_id, user.email]);
    if (!consumed.rowCount) throw invalidLink();
    await client.query("UPDATE users SET password=$2,updated_at=NOW() WHERE id=$1", [target.user_id, hashed]);
    await revokeAccountLinks(client, target.user_id);
    await client.query("DELETE FROM sessions WHERE sess->>'userId'=$1", [String(target.user_id)]);
  });
}

export async function revokeAccountLinks(client: Pick<PoolClient, "query">, userId: number) {
  await client.query("UPDATE account_access_links SET revoked_at=NOW() WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL", [userId]);
  // Retire the old recovery mechanism too, including tokens issued before this release.
  await client.query("UPDATE password_reset_tokens SET used=true WHERE email=(SELECT email FROM users WHERE id=$1)", [userId]);
}
