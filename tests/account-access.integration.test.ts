import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { users } from "../shared/schema";
import { accountAccessLinksMigrationSql } from "../server/migrations/account-access-links";
import type { IStorage } from "../server/storage";

const fixture = vi.hoisted(() => ({ url: process.env.ACCOUNT_ACCESS_TEST_DATABASE_URL, schema: `account_access_${process.pid}`, send: vi.fn() }));
if (fixture.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(fixture.url).hostname)) throw Error("A local database is required");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}`, max: 4 });
  return { pool, db: drizzle(pool) };
});
vi.mock("../server/services/email-transport", () => ({
  getTransactionalEmailConfig: () => process.env.RESEND_API_KEY ? { provider: "resend" } : null,
  sendTransactionalEmail: fixture.send,
}));
import { db, pool } from "../server/db";
import { setupAuth, hashPassword } from "../server/auth";
import { registerAdminUserRoutes } from "../server/routes-admin-users";
import { comparePasswords } from "../server/services/passwords";

describe.skipIf(!fixture.url)("account invitations and recovery with PostgreSQL", () => {
  let admin: Pool, server: Server, base: string;
  let testIp = 0;
  let initialPassword: string;
  let store: session.Store;
  const http = (path: string, body?: unknown, userId = 1, method = body ? "POST" : "GET", cookie?: string) => fetch(base + path, {
    method, headers: { "Content-Type": "application/json", "X-Forwarded-For": `127.0.0.${testIp}`, ...(userId ? { "x-test-user": String(userId) } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const create = (extra = {}) => http("/api/admin/users", { firstName: "Vicky", lastName: "Prueba", email: "new@example.test", permissions: ["status"], ...extra });
  const link = (index = fixture.send.mock.calls.length - 1) => {
    const message = fixture.send.mock.calls[index][0];
    const url = new URL(message.text.match(/https:\/\/\S+#token=[a-f0-9]{64}/)[0]);
    return { url, token: new URLSearchParams(url.hash.slice(1)).get("token")!, purpose: url.pathname === "/accept-invitation" ? "invitation" : "password_reset" };
  };
  const complete = (token = link().token, purpose = link().purpose, password = "mi-contraseña-segura") => http("/api/account-links/complete", { token, purpose, password, confirmPassword: password }, 0);

  beforeAll(async () => {
    admin = new Pool({ connectionString: fixture.url });
    await admin.query(`CREATE SCHEMA ${fixture.schema}`);
    await pool.query(`CREATE TABLE users(id SERIAL PRIMARY KEY,first_name VARCHAR(100) NOT NULL,last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,avatar VARCHAR(255),is_admin BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,permissions TEXT[] DEFAULT '{}',role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),updated_at TIMESTAMP NOT NULL DEFAULT NOW());
      CREATE TABLE password_reset_tokens(id SERIAL PRIMARY KEY,token TEXT UNIQUE,email TEXT,used BOOLEAN DEFAULT false,expires_at TIMESTAMP);
      CREATE TABLE sessions(sid VARCHAR PRIMARY KEY,sess JSON NOT NULL,expire TIMESTAMP NOT NULL);`);
    await pool.query(accountAccessLinksMigrationSql);
    await pool.query(accountAccessLinksMigrationSql);
    const PgStore = connectPgSimple(session);
    store = new PgStore({ pool, tableName: "sessions", pruneSessionInterval: false });
    const storage = {
      sessionStore: store,
      getUser: async (id: number) => (await db.select().from(users).where(eq(users.id, id)))[0],
      getUserByEmail: async (email: string) => (await db.select().from(users).where(sql`lower(${users.email})=lower(${email})`))[0],
      getAllUsers: async () => db.select().from(users),
      deleteUser: async (id: number) => (await db.delete(users).where(eq(users.id, id)).returning()).length > 0,
      getPersonnel: async () => [],
    } as unknown as IStorage;
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    const { requireAuth } = setupAuth(app, storage);
    registerAdminUserRoutes(app, storage, (req, res, next) => {
      if (req.get("x-test-user")) req.session.userId = Number(req.get("x-test-user"));
      return requireAuth(req, res, next);
    }, (req, res, next) => { if (!req.user?.isAdmin) { res.status(403).end(); return; } next(); });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
    initialPassword = await hashPassword("contraseña-original");
  });
  beforeEach(async () => {
    testIp++;
    vi.stubEnv("RESEND_API_KEY", "fake-test-only");
    vi.stubEnv("APP_URL", "https://mind.example.test");
    fixture.send.mockReset().mockResolvedValue([{ headers: { "x-message-id": "fake-provider" } }]);
    await pool.query("TRUNCATE users,account_access_links,password_reset_tokens,sessions RESTART IDENTITY CASCADE");
    await pool.query(`INSERT INTO users(first_name,last_name,email,password,is_admin,permissions) VALUES
      ('Admin','Uno','admin@example.test',$1,true,'{}'),('Miembro','Dos','member@example.test',$1,false,'{status}')`, [initialPassword]);
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    (store as any)?.close?.();
    await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${fixture.schema} CASCADE`); await admin.end(); }
  });

  it("creates the user and single-use invitation atomically without requesting/storing a known password", async () => {
    const response = await create({ email: "  NEW@Example.Test ", firstName: "<Vicky>" });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const user = await response.json();
    expect(user).toMatchObject({ email: "new@example.test", permissions: ["status"], invitation: { status: "pending" } });
    expect(user.password).toBeUndefined(); expect(user.token).toBeUndefined();
    const { token, url } = link();
    expect(url.origin).toBe("https://mind.example.test"); expect(url.search).toBe("");
    const saved = (await pool.query("SELECT * FROM account_access_links")).rows[0];
    expect(saved.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(new Date(saved.expires_at).getTime() - Date.now()).toBeGreaterThan(47 * 3600_000);
    expect(fixture.send).toHaveBeenCalledOnce();
    expect(fixture.send.mock.calls[0][0]).toMatchObject({ to: "new@example.test", subject: "Te invitaron a Mind" });
    expect(fixture.send.mock.calls[0][0].html).toContain("&lt;Vicky&gt;");
    const list = await (await http("/api/admin/users")).json();
    expect(list.find((row: any) => row.id === user.id).invitation.status).toBe("pending");
  });
  it("accepts an invitation, logs in with the chosen password, and refuses replay", async () => {
    await create();
    const { token, purpose } = link();
    expect((await http("/api/account-links/validate", { token, purpose }, 0)).status).toBe(200);
    expect((await complete()).status).toBe(200);
    expect((await http("/api/login", { email: "new@example.test", password: "mi-contraseña-segura" }, 0)).status).toBe(200);
    expect((await complete(token, purpose, "otra-contraseña-segura")).status).toBe(400);
    const list = await (await http("/api/admin/users")).json();
    expect(list.find((row: any) => row.email === "new@example.test").invitation.status).toBe("accepted");
  });
  it("does not consume a token on password mismatch/weak passwords or purpose confusion", async () => {
    await create();
    const { token, purpose } = link();
    expect((await http("/api/account-links/complete", { token, purpose, password: "corta", confirmPassword: "corta" }, 0)).status).toBe(400);
    expect((await http("/api/account-links/complete", { token, purpose, password: "contraseña-larga", confirmPassword: "diferente" }, 0)).status).toBe(400);
    expect((await complete(token, "password_reset")).status).toBe(400);
    expect((await complete(token, purpose)).status).toBe(200);
  });
  it("expires links and rejects unknown/legacy plaintext tokens", async () => {
    await create();
    await pool.query("UPDATE account_access_links SET expires_at=NOW()-INTERVAL '1 second'");
    expect((await complete()).status).toBe(400);
    expect((await complete("a".repeat(64), "invitation")).status).toBe(400);
    const list = await (await http("/api/admin/users")).json();
    expect(list.find((row: any) => row.email === "new@example.test").invitation.status).toBe("expired");
  });
  it("resends with a fresh link, invalidates the previous one, and serializes concurrent resends", async () => {
    const user = await (await create()).json();
    const previous = link();
    expect((await http(`/api/admin/users/${user.id}/invitation`, {})).status).toBe(429);
    await pool.query("UPDATE account_access_links SET created_at=NOW()-INTERVAL '2 minutes'");
    const responses = await Promise.all([http(`/api/admin/users/${user.id}/invitation`, {}), http(`/api/admin/users/${user.id}/invitation`, {})]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 429]);
    expect(link().token).not.toBe(previous.token);
    expect((await complete(previous.token, previous.purpose)).status).toBe(400);
    expect((await complete()).status).toBe(200);
  });
  it("allows exactly one concurrent password change and revokes sessions and sibling tokens", async () => {
    await http("/api/admin/users/2/invitation", {});
    const invite = link();
    const login = await http("/api/login", { email: "member@example.test", password: "contraseña-original" }, 0);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    await http("/api/forgot-password", { email: "member@example.test" }, 0);
    const reset = link();
    const responses = await Promise.all([complete(reset.token, reset.purpose, "primera-contraseña"), complete(reset.token, reset.purpose, "segunda-contraseña")]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    expect((await complete(invite.token, invite.purpose)).status).toBe(400);
    expect((await http("/api/current-user", undefined, 0, "GET", cookie)).status).toBe(401);
    const saved = (await pool.query("SELECT password FROM users WHERE id=2")).rows[0].password;
    expect(await comparePasswords("contraseña-original", saved)).toBe(false);
  });
  it("keeps existing passwords working until the invitation is accepted", async () => {
    expect((await http("/api/admin/users/2/invitation", {})).status).toBe(200);
    expect((await http("/api/login", { email: "member@example.test", password: "contraseña-original" }, 0)).status).toBe(200);
  });
  it.each([{ email: "changed@example.test" }, { isActive: false }, { password: "contraseña-del-admin" }])("invalidates links on admin account changes: %j", async change => {
    await http("/api/admin/users/2/invitation", {});
    const before = link();
    expect((await http("/api/admin/users/2", change, 1, "PATCH")).status).toBe(200);
    expect((await complete(before.token, before.purpose)).status).toBe(400);
  });
  it("sends real recovery messages through the shared transport and hides account existence", async () => {
    const known = await http("/api/forgot-password", { email: "  MEMBER@EXAMPLE.TEST " }, 0);
    const unknown = await http("/api/forgot-password", { email: "missing@example.test" }, 0);
    await pool.query("UPDATE users SET is_active=false WHERE id=1");
    const inactive = await http("/api/forgot-password", { email: "admin@example.test" }, 0);
    expect(await known.json()).toEqual(await unknown.json());
    expect(await inactive.json()).toEqual({ message: "Si el correo corresponde a una cuenta activa, recibirás un enlace para restablecer tu contraseña." });
    expect(fixture.send).toHaveBeenCalledOnce();
    const reset = link(); expect(reset.purpose).toBe("password_reset");
    expect((await complete()).status).toBe(200);
  });
  it("reports partial success honestly when a provider fails and lets administrators recover", async () => {
    fixture.send.mockRejectedValueOnce(new Error("provider timeout"));
    const response = await create();
    expect(response.status).toBe(201);
    const user = await response.json();
    expect(user.invitation.status).toBe("failed");
    expect((await pool.query("SELECT id FROM users WHERE id=$1", [user.id])).rowCount).toBe(1);
    await pool.query("UPDATE account_access_links SET created_at=NOW()-INTERVAL '2 minutes'");
    expect((await http(`/api/admin/users/${user.id}/invitation`, {})).status).toBe(200);
  });
  it("rolls back the account if its invitation cannot be persisted", async () => {
    await pool.query(`CREATE FUNCTION reject_link_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insert failure'; END $$;
      CREATE TRIGGER reject_link_insert BEFORE INSERT ON account_access_links FOR EACH ROW EXECUTE FUNCTION reject_link_insert()`);
    try {
      expect((await create()).status).toBe(500);
      expect((await pool.query("SELECT count(*)::int AS total FROM users")).rows[0].total).toBe(2);
      expect(fixture.send).not.toHaveBeenCalled();
    } finally { await pool.query("DROP TRIGGER reject_link_insert ON account_access_links; DROP FUNCTION reject_link_insert()"); }
  });
  it("keeps a committed account reviewable if recording provider acceptance fails", async () => {
    await pool.query(`CREATE FUNCTION reject_link_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test update failure'; END $$;
      CREATE TRIGGER reject_link_update BEFORE UPDATE ON account_access_links FOR EACH ROW EXECUTE FUNCTION reject_link_update()`);
    try {
      const response = await create();
      expect(response.status).toBe(201);
      expect(fixture.send).toHaveBeenCalledOnce();
      const list = await (await http("/api/admin/users")).json();
      expect(list.find((row: any) => row.email === "new@example.test").invitation.status).toBe("unconfirmed");
    } finally { await pool.query("DROP TRIGGER reject_link_update ON account_access_links; DROP FUNCTION reject_link_update()"); }
  });
  it("rejects missing mail configuration before creating a user and case-insensitive duplicates", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await create()).status).toBe(503);
    expect((await pool.query("SELECT count(*)::int AS total FROM users")).rows[0].total).toBe(2);
    vi.stubEnv("RESEND_API_KEY", "test");
    expect((await create({ email: "MEMBER@EXAMPLE.TEST" })).status).toBe(409);
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it("requires an administrator, validates data and refuses invitations to inactive users", async () => {
    expect((await http("/api/admin/users/2/invitation", {}, 0)).status).toBe(401);
    expect((await http("/api/admin/users/2/invitation", {}, 2)).status).toBe(403);
    expect((await http("/api/admin/users", {}, 2)).status).toBe(403);
    expect((await create({ email: "invalid" })).status).toBe(400);
    expect((await create({ permissions: ["made_up"] })).status).toBe(400);
    await pool.query("UPDATE users SET is_active=false WHERE id=2");
    expect((await http("/api/admin/users/2/invitation", {})).status).toBe(409);
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it("rate limits anonymous recovery requests without sending duplicates", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt++) responses.push(await http("/api/forgot-password", { email: "member@example.test" }, 0));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200, 200, 429]);
    expect(fixture.send).toHaveBeenCalledOnce();
  });
});
