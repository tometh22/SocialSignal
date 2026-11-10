import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import session from "express-session";
import pg from "pg";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { registerMindMcp } from "../server/mcp/routes";
import { MindOAuthProvider } from "../server/mcp/oauth";
import { MindStatusWriter, statusEditSchema } from "../server/mcp/status-write";
import { mcpOauthMigrationSql } from "../server/migrations/mcp-oauth";
import { mcpStatusActionsMigrationSql } from "../server/migrations/mcp-status-actions";
import type { MindMcpConfig } from "../server/mcp/config";
import { getAuthReturnPath } from "../client/src/lib/auth-return";

it("keeps the confirmation migration in sync and restricts login return paths", () => {
  expect(mcpStatusActionsMigrationSql.trim()).toBe(readFileSync("migrations/0095_mcp_status_actions.sql", "utf8").trim());
  const path = `/mcp/status-changes/${randomUUID()}`;
  expect(getAuthReturnPath(`?returnTo=${encodeURIComponent(path)}`)).toBe(path);
  for (const bad of [path + "?next=https://evil.example", path + "/../../admin", "//evil.example", "/mcp/status-changes/not-uuid"]) {
    expect(getAuthReturnPath(`?returnTo=${encodeURIComponent(bad)}`)).toBeNull();
  }
  expect(statusEditSchema.safeParse({ roomId: 10, kind: "custom", itemId: 200, requestId: randomUUID(), changes: { hiddenFromWeekly: true } }).success).toBe(false);
});

describe.skipIf(!process.env.TEST_MCP_DATABASE_URL)("Status editing with browser confirmation", () => {
  let pool: pg.Pool, admin: pg.Pool, http: Server, config: MindMcpConfig, provider: MindOAuthProvider, writer: MindStatusWriter;
  const schema = `mcp_write_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL });
    pool = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL, options: `-c search_path=${schema} -c timezone=UTC` });
    const app = express();
    app.use(express.json()); app.use(express.urlencoded({ extended: false }));
    app.use(session({ secret: "test-session", resave: false, saveUninitialized: false }));
    app.post("/test/login", (req, res) => { req.session.userId = req.body.id; res.json({ ok: true }); });
    http = createServer(app);
    await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
    config = { origin, resource: `${origin}/mcp`, clientId: "test-mind", clientSecret: "s".repeat(40), redirectUris: ["https://chatgpt.com/callback"] };
    registerMindMcp(app, pool, config, async id => (await pool.query(`SELECT id,first_name AS "firstName",last_name AS "lastName",
      is_active AS "isActive",is_admin AS "isAdmin",role,permissions FROM users WHERE id=$1`, [id])).rows[0]);
    provider = new MindOAuthProvider(pool, config); writer = new MindStatusWriter(pool, config);
  });
  beforeEach(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
    await pool.query(readFileSync("tests/fixtures/mcp.sql", "utf8"));
    await pool.query(mcpOauthMigrationSql); await pool.query(mcpStatusActionsMigrationSql);
  });
  afterAll(async () => {
    if (http) await new Promise<void>(resolve => http.close(() => resolve()));
    await pool?.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  async function issue(userId = 1, scopes = ["mind:read", "status:write", "offline_access"]) {
    const code = await provider.createCode(userId, { clientId: config.clientId, redirectUri: config.redirectUris[0], resource: config.resource,
      codeChallenge: "a".repeat(43), scopes, expiresAt: Date.now() + 60000 });
    const tokens = await provider.exchangeAuthorizationCode(provider.clientsStore.getClient(config.clientId)!, code, undefined, config.redirectUris[0]);
    const auth = await provider.verifyAccessToken(tokens.access_token);
    return { userId, grantId: String(auth.extra!.grantId), tokens };
  }
  const edit = (changes: Record<string, unknown> = { healthStatus: "verde", currentAction: "Avance confirmado" }) =>
    ({ operation: "edit", roomId: 10, kind: "project", itemId: 100, requestId: randomUUID(), changes });
  const note = () => ({ operation: "note", roomId: 10, kind: "custom", itemId: 200, requestId: randomUUID(), content: "Nota nueva" });
  const request = (path: string, init: RequestInit = {}) => fetch(config.origin + path, { ...init, redirect: "manual" });
  async function login(id: number) {
    const response = await request("/test/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  async function form(id: string, cookie: string) {
    const res = await request(`/mcp/status-changes/${id}`, { headers: { cookie } });
    const html = await res.text();
    return { res, html, csrf: html.match(/name="csrf" value="([^"]+)"/)?.[1] };
  }
  const submit = (id: string, cookie: string, csrf: string, decision = "allow", origin: string | undefined = config.origin) => request(`/mcp/status-changes/${id}`, {
    method: "POST", headers: { cookie, ...(origin ? { Origin: origin } : {}) }, body: new URLSearchParams({ csrf, decision }),
  });

  it("requires explicit OAuth consent for Status editing and explains the confirmation step", async () => {
    const cookie = await login(1);
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUris[0], response_type: "code",
      code_challenge: "a".repeat(43), code_challenge_method: "S256", scope: "mind:read status:write offline_access", state: "consent-test" });
    expect((await request(`/authorize?${params}`, { headers: { cookie } })).status).toBe(303);
    const consent = await request("/mcp/consent", { headers: { cookie } });
    const html = await consent.text();
    expect(html).toContain("Autorizar lectura y edición de Status");
    expect(html).toContain("Cada cambio requiere que lo revises y confirmes");
    const csrf = html.match(/name="csrf" value="([^"]+)"/)![1];
    const accepted = await request("/mcp/consent", { method: "POST", headers: { cookie, Origin: config.origin },
      body: new URLSearchParams({ csrf, decision: "allow" }) });
    expect(accepted.status).toBe(303);
    expect((await pool.query("SELECT scopes FROM mcp_oauth_grants")).rows[0].scopes).toEqual(["mind:read", "status:write", "offline_access"]);
    await pool.query("UPDATE users SET permissions=ARRAY['crm'] WHERE id=1");
    await request(`/authorize?${params}`, { headers: { cookie } });
    expect((await request("/mcp/consent", { headers: { cookie } })).status).toBe(403);
  });

  it("prepares without changing Status, binds request IDs and commits once with audit and room isolation", async () => {
    const identity = await issue(), input = edit();
    const results = await Promise.all([writer.prepare(identity, input), writer.prepare(identity, input)]);
    expect(results[0].id).toBe(results[1].id);
    expect(results[0].state).toBe("pending");
    expect((await pool.query("SELECT health_status FROM project_status_reviews WHERE id=1")).rows[0].health_status).toBe("rojo");
    await expect(writer.prepare(identity, { ...input, changes: { healthStatus: "amarillo" } })).rejects.toThrow("requestId");
    const committed = await Promise.all([writer.decide(1, results[0].id, true), writer.decide(1, results[0].id, true)]);
    expect(committed.every(r => r.state === "applied")).toBe(true);
    expect((await pool.query("SELECT health_status,current_action,updated_by FROM project_status_reviews WHERE id=1")).rows[0])
      .toEqual({ health_status: "verde", current_action: "Avance confirmado", updated_by: 1 });
    expect((await pool.query("SELECT main_risk,current_action FROM project_status_reviews WHERE id=2")).rows[0])
      .toEqual({ main_risk: "SECRETO DE OTRA SALA", current_action: null });
    expect((await pool.query("SELECT * FROM status_change_log WHERE user_id=1")).rowCount).toBe(2);
    expect((await pool.query("SELECT * FROM status_update_entries WHERE project_id=100 AND room_id=10")).rowCount).toBe(1);
  });

  it("requires browser session, correct account, origin and CSRF; GET and bearer alone never commit", async () => {
    const identity = await issue();
    const p = await writer.prepare(identity, { ...note(), content: '<script>alert("x")</script> & nota' });
    const path = `/mcp/status-changes/${p.id}`;
    const anon = await request(path, { headers: { Authorization: `Bearer ${identity.tokens.access_token}` } });
    expect(anon.status).toBe(303); expect(anon.headers.get("location")).toContain(encodeURIComponent(path));
    const other = await login(2);
    expect((await form(p.id, other)).res.status).toBe(404);
    const cookie = await login(1), preview = await form(p.id, cookie);
    expect(preview.res.status).toBe(200);
    expect(preview.res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(preview.html).toContain("&lt;script&gt;"); expect(preview.html).not.toContain('<script>');
    expect((await writer.inspect(1, p.id)).state).toBe("pending");
    for (const origin of ["", "null", "https://evil.example"]) expect((await submit(p.id, cookie, preview.csrf!, "allow", origin)).status).toBe(403);
    expect((await submit(p.id, cookie, "wrong")).status).toBe(403);
    expect((await submit(p.id, cookie, preview.csrf!, "other")).status).toBe(403);
    expect((await submit(p.id, cookie, preview.csrf!)).status).toBe(303);
    expect((await form(p.id, cookie)).html).toContain("Cambio guardado");
    expect((await submit(p.id, cookie, preview.csrf!)).status).toBe(303);
    expect((await pool.query("SELECT * FROM project_review_notes WHERE weekly_status_item_id=200 AND author_id=1")).rowCount).toBe(1);
  });

  it("blocks read-only grants and refresh-based scope escalation", async () => {
    const identity = await issue(1, ["mind:read", "offline_access"]);
    await expect(writer.prepare(identity, edit())).rejects.toThrow("status:write");
    await expect(provider.exchangeRefreshToken(provider.clientsStore.getClient(config.clientId)!, identity.tokens.refresh_token!, ["mind:read", "status:write", "offline_access"])).rejects.toThrow();
    await pool.query("UPDATE users SET permissions=ARRAY['crm'] WHERE id=1");
    await expect(issue()).rejects.toThrow();
  });

  it.each([
    "UPDATE mcp_oauth_grants SET revoked_at=now()",
    "UPDATE mcp_oauth_grants SET scopes=ARRAY['mind:read']",
    "UPDATE mcp_oauth_grants SET access_expires_at=now()-interval '1 day',refresh_expires_at=now()-interval '1 day'",
    "UPDATE users SET is_active=false WHERE id=1",
    "UPDATE users SET permissions='{}' WHERE id=1",
    "UPDATE users SET role='external_provider' WHERE id=1",
    "DELETE FROM review_room_members WHERE room_id=10 AND user_id=1",
    "UPDATE review_room_members SET role='viewer' WHERE room_id=10 AND user_id=1",
    "UPDATE review_rooms SET archived_at=now() WHERE id=10",
    "UPDATE project_status_reviews SET hidden_from_weekly=true WHERE id=1",
  ])("rechecks access before committing: %s", async sql => {
    const identity = await issue(), p = await writer.prepare(identity, edit());
    await pool.query(sql);
    await expect(writer.decide(1, p.id, true)).rejects.toThrow();
    expect((await pool.query("SELECT health_status FROM project_status_reviews WHERE id=1")).rows[0].health_status).toBe("rojo");
    expect((await pool.query("SELECT state FROM mcp_status_actions WHERE id=$1", [p.id])).rows[0].state).toBe("pending");
  });

  it("rejects foreign/hidden items and does not grant admins a membership bypass", async () => {
    const identity = await issue();
    for (const input of [{ ...edit(), roomId: 20 }, { ...edit(), itemId: 101 }, { ...note(), itemId: 201 }, { ...note(), roomId: 20 }]) {
      await expect(writer.prepare(identity, input)).rejects.toThrow();
    }
    await pool.query("UPDATE users SET is_admin=true WHERE id=3");
    await expect(writer.prepare(await issue(3), edit())).rejects.toThrow("membresía");
  });

  it("rejects stale, expired and cancelled requests without overwriting or inserting", async () => {
    const identity = await issue();
    const stale = await writer.prepare(identity, edit());
    await pool.query("UPDATE project_status_reviews SET current_action='Edición humana' WHERE id=1");
    await expect(writer.decide(1, stale.id, true)).rejects.toThrow("cambió");
    const expired = await writer.prepare(identity, note());
    await pool.query("UPDATE mcp_status_actions SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.id]);
    expect((await writer.inspect(1, expired.id)).state).toBe("expired");
    await expect(writer.decide(1, expired.id, true)).rejects.toThrow("vencida");
    const cancelled = await writer.prepare(identity, note());
    expect((await writer.decide(1, cancelled.id, false)).state).toBe("cancelled");
    expect((await writer.decide(1, cancelled.id, true)).state).toBe("cancelled");
    expect((await pool.query("SELECT * FROM project_review_notes WHERE weekly_status_item_id=200")).rowCount).toBe(0);
  });

  it("validates enums, ownership, supported dates and exact field allowlist", async () => {
    const identity = await issue();
    for (const changes of [{ healthStatus: "blue" }, { ownerId: 4 }, { ownerId: 999 }, { hiddenFromWeekly: true }, { roomId: 20 },
      { title: "Renombrar" }, { deadline: "2026-99-99" }, { currentAction: "x".repeat(20001) }, {}]) {
      await expect(writer.prepare(identity, edit(changes))).rejects.toThrow();
    }
    await expect(writer.prepare(identity, { ...edit({ nextMilestoneDate: "2026-11-20T10:00:00Z" }), kind: "custom", itemId: 200 })).rejects.toThrow("fecha de hito");
    const p = await writer.prepare(identity, { ...edit({ ownerId: 2, deadline: "2026-11-20T10:00:00-03:00", mainRisk: null }), kind: "custom", itemId: 200 });
    expect(p.changes.find((c: any) => c.field === "ownerId").afterName).toBe("Vicky Test");
    await writer.decide(1, p.id, true);
    expect((await pool.query("SELECT owner_id,deadline FROM weekly_status_items WHERE id=200")).rows[0])
      .toEqual({ owner_id: 2, deadline: new Date("2026-11-20T13:00:00Z") });
  });

  it("rolls back state and proposal if the audit insert fails", async () => {
    const p = await writer.prepare(await issue(), edit());
    await pool.query("ALTER TABLE status_change_log ADD CONSTRAINT test_reject CHECK (user_id <> 1)");
    await expect(writer.decide(1, p.id, true)).rejects.toThrow();
    expect((await pool.query("SELECT health_status FROM project_status_reviews WHERE id=1")).rows[0].health_status).toBe("rojo");
    expect((await writer.inspect(1, p.id)).state).toBe("pending");
  });

  it("rolls back a note when its notification outbox fails", async () => {
    const notifyingWriter = new MindStatusWriter(pool, config, async () => { throw new Error("outbox failed"); });
    const p = await notifyingWriter.prepare(await issue(), note());
    await expect(notifyingWriter.decide(1, p.id, true)).rejects.toThrow("outbox failed");
    expect((await pool.query("SELECT * FROM project_review_notes WHERE weekly_status_item_id=200")).rowCount).toBe(0);
    expect((await writer.inspect(1, p.id)).state).toBe("pending");
  });

  it("exposes safe MCP tools; old tokens cannot prepare and no MCP tool can confirm", async () => {
    for (const scopes of [["mind:read", "offline_access"], ["mind:read", "status:write", "offline_access"]]) {
      const identity = await issue(1, scopes);
      const client = new Client({ name: "write-test", version: "1" });
      await client.connect(new StreamableHTTPClientTransport(new URL(config.resource), { requestInit: { headers: { Authorization: `Bearer ${identity.tokens.access_token}` } } }));
      try {
        const list = await client.listTools();
        const write = list.tools.find(t => t.name === "prepare_status_edit")!;
        expect(write.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
        expect(list.tools.map(t => t.name)).not.toContain("confirm_status_change");
        const input = edit(); const { operation, ...args } = input;
        const result = await client.callTool({ name: "prepare_status_edit", arguments: args });
        if (!scopes.includes("status:write")) expect(result.isError).toBe(true);
        else {
          expect(result.isError).not.toBe(true);
          expect(result.structuredContent).toMatchObject({ state: "pending" });
          const p = result.structuredContent as { id: string };
          const check = await client.callTool({ name: "get_status_change", arguments: { id: p.id } });
          expect(check.structuredContent).toMatchObject({ state: "pending" });
        }
      } finally { await client.close(); }
    }
  });
});
