import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import session from "express-session";
import pg from "pg";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { registerMindMcp } from "../server/mcp/routes";
import { MindOAuthProvider, tokenHash } from "../server/mcp/oauth";
import { MindStatusReader } from "../server/mcp/status";
import { mcpOauthMigrationSql } from "../server/migrations/mcp-oauth";
import type { MindMcpConfig } from "../server/mcp/config";

// CI provisions PostgreSQL. Locally point only TEST_MCP_DATABASE_URL at a disposable database.
describe.skipIf(!process.env.TEST_MCP_DATABASE_URL)("Mind MCP: PostgreSQL + OAuth + real MCP client", () => {
  let pool: pg.Pool, adminPool: pg.Pool, http: Server, config: MindMcpConfig, provider: MindOAuthProvider, reader: MindStatusReader;
  const schema = `mcp_test_${randomUUID().replaceAll("-", "")}`;
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let clientInfo: NonNullable<ReturnType<MindOAuthProvider["clientsStore"]["getClient"]>>;

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL });
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL, options: `-c search_path=${schema} -c timezone=UTC` });
    await pool.query(readFileSync("tests/fixtures/mcp.sql", "utf8"));
    await pool.query(mcpOauthMigrationSql);
    const app = express();
    app.use(express.json()); app.use(express.urlencoded({ extended: false }));
    app.use(session({ secret: "test-session-only", resave: false, saveUninitialized: false }));
    // Test-only login: production uses the existing Mind login and signed session cookie.
    app.post("/test/login", (req, res) => { req.session.userId = req.body.userId; res.json({ ok: true }); });
    http = createServer(app);
    await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(http.address() as any).port}`;
    config = { origin, resource: `${origin}/mcp`, clientId: "test-mind", clientSecret: "secret".repeat(8), redirectUris: ["https://chatgpt.com/test/callback"] };
    registerMindMcp(app, pool, config, async id => {
      const { rows } = await pool.query('SELECT id,first_name AS "firstName",last_name AS "lastName",is_active AS "isActive",is_admin AS "isAdmin",role,permissions FROM users WHERE id=$1', [id]);
      return rows[0];
    });
    provider = new MindOAuthProvider(pool, config); reader = new MindStatusReader(pool, config.origin);
    clientInfo = provider.clientsStore.getClient(config.clientId)!;
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE mcp_oauth_grants");
    await pool.query("UPDATE users SET is_active=true,permissions=ARRAY['status'],is_admin=false WHERE id IN(1,2,3)");
    await pool.query("INSERT INTO review_room_members VALUES(10,1) ON CONFLICT DO NOTHING");
    await pool.query("UPDATE review_rooms SET archived_at=NULL WHERE id=10");
  });
  afterAll(async () => {
    if (http) await new Promise<void>((resolve, reject) => http.close(err => err ? reject(err) : resolve()));
    await pool?.end();
    if (adminPool) { await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await adminPool.end(); }
  });
  const request = (path: string, init: RequestInit = {}) => fetch(`${config.origin}${path}`, { ...init, redirect: "manual" });
  async function issue(userId = 1, scopes = ["status:read", "offline_access"]) {
    const code = await provider.createCode(userId, { clientId: config.clientId, redirectUri: config.redirectUris[0],
      resource: config.resource, codeChallenge: challenge, scopes, expiresAt: Date.now()+10000 });
    const response = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUris[0], resource: config.resource });
    expect(response.status).toBe(200); return response.json();
  }
  function token(params: Record<string, string>) {
    return request("/token", { method: "POST", body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }) });
  }
  async function login(userId: number, cookie = "") {
    const res = await request("/test/login", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ userId }) });
    return res.headers.get("set-cookie")?.split(";")[0] ?? cookie;
  }
  async function begin(scopes = "status:read offline_access") {
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUris[0], response_type: "code",
      code_challenge: challenge, code_challenge_method: "S256", scope: scopes, state: "preserved-state", resource: config.resource });
    const res = await request(`/authorize?${params}`);
    return { res, params, cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "" };
  }

  it("advertises OAuth discovery, requires bearer credentials and refuses other origins", async () => {
    const metadata = await (await request("/.well-known/oauth-protected-resource/mcp")).json();
    expect(metadata.resource).toBe(config.resource);
    const auth = await (await request("/.well-known/oauth-authorization-server")).json();
    expect(auth.code_challenge_methods_supported).toEqual(["S256"]);
    expect(auth.scopes_supported).toContain("offline_access");
    expect(auth.authorization_response_iss_parameter_supported).toBe(true);
    expect(auth.token_endpoint_auth_methods_supported).toEqual(["client_secret_post"]);
    const denied = await request("/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(denied.status).toBe(401); expect(denied.headers.get("www-authenticate")).toContain("resource_metadata");
    const badOrigin = await request("/mcp", { method: "POST", headers: { Origin: "https://evil.example" } });
    expect(badOrigin.status).toBe(403);
    expect((await request("/mcp", { method: "GET" })).status).toBe(405);
  });

  it("completes login → explicit consent → PKCE token exchange, never giving the agent the Mind session", async () => {
    const start = await begin(); expect(start.res.status).toBe(303);
    const anonymous = await request("/mcp/consent", { headers: { cookie: start.cookie } });
    expect(anonymous.headers.get("location")).toBe("/auth?returnTo=%2Fmcp%2Fconsent");
    const cookie = await login(1, start.cookie);
    const consent = await request("/mcp/consent", { headers: { cookie } });
    expect(consent.headers.get("referrer-policy")).toBe("strict-origin");
    expect(consent.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(consent.headers.get("content-security-policy")).toContain("form-action 'self' https://chatgpt.com");
    const html = await consent.text(); expect(html).toContain("Autorizar lectura");
    const csrf = html.match(/name="csrf" value="([^"]+)"/)![1];
    const rejected = await request("/mcp/consent", { method: "POST", headers: { cookie, Origin: config.origin }, body: new URLSearchParams({ csrf: "wrong", decision: "allow" }) });
    expect(rejected.status).toBe(403);
    for (const origin of [undefined, "null", "https://evil.example"]) {
      const headers: Record<string, string> = { cookie };
      if (origin !== undefined) headers.Origin = origin;
      const forged = await request("/mcp/consent", { method: "POST", headers, body: new URLSearchParams({ csrf, decision: "allow" }) });
      expect(forged.status).toBe(403);
    }
    const accepted = await request("/mcp/consent", { method: "POST", headers: { cookie, Origin: config.origin }, body: new URLSearchParams({ csrf, decision: "allow" }) });
    const redirect = new URL(accepted.headers.get("location")!);
    expect(redirect.searchParams.get("state")).toBe("preserved-state");
    expect(redirect.searchParams.get("iss")).toBe(new URL(config.origin).href);
    const code = redirect.searchParams.get("code")!;
    const wrong = await token({ grant_type: "authorization_code", code, code_verifier: "b".repeat(43), redirect_uri: config.redirectUris[0] });
    expect(wrong.status).toBe(400);
    const wrongRedirect = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: "https://evil.example/callback" });
    expect(wrongRedirect.status).toBe(400);
    const ok = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUris[0] });
    expect(ok.status).toBe(200); const grant = await ok.json();
    expect(grant.scope).toBe("status:read offline_access");
    const reused = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUris[0] });
    expect(reused.status).toBe(400);
    expect((await request("/mcp", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: "{}" })).status).toBe(401);
    const stored = (await pool.query("SELECT * FROM mcp_oauth_grants")).rows[0];
    expect(stored.access_token_hash).toBe(tokenHash(grant.access_token));
    expect(JSON.stringify(stored)).not.toContain(grant.refresh_token);
  });

  it("rejects unregistered callbacks, unsupported scopes, wrong resource/client secret and cancelled consent", async () => {
    const { params } = await begin();
    params.set("redirect_uri", "https://evil.example/callback");
    expect((await request(`/authorize?${params}`)).status).toBe(400);
    const invalidScope = await begin("status:write");
    expect(invalidScope.res.headers.get("location")).toContain("invalid_scope");
    expect(new URL(invalidScope.res.headers.get("location")!).searchParams.get("iss")).toBe(new URL(config.origin).href);
    const invalidResource = (await begin()).params; invalidResource.set("resource", "https://evil.example/mcp");
    expect((await request(`/authorize?${invalidResource}`)).headers.get("location")).toContain("invalid_target");
    expect((await token({ grant_type: "refresh_token", refresh_token: "bad", client_secret: "wrong" })).status).toBe(400);
    const start = await begin(); const cookie = await login(1, start.cookie);
    const html = await (await request("/mcp/consent", { headers: { cookie } })).text();
    const csrf = html.match(/name="csrf" value="([^"]+)"/)![1];
    const deny = await request("/mcp/consent", { method: "POST", headers: { cookie, Origin: config.origin }, body: new URLSearchParams({ csrf, decision: "deny" }) });
    expect(deny.headers.get("location")).toContain("error=access_denied");
    expect(new URL(deny.headers.get("location")!).searchParams.get("iss")).toBe(new URL(config.origin).href);
    expect((await pool.query("SELECT * FROM mcp_oauth_grants")).rowCount).toBe(0);
  });

  it("rotates refresh tokens, rejects replay/audience changes and supports scope reduction", async () => {
    const first = await issue();
    const wrongResource = await token({ grant_type: "refresh_token", refresh_token: first.refresh_token, resource: "https://elsewhere.example/mcp" });
    expect(wrongResource.status).toBe(400);
    const refreshed = await token({ grant_type: "refresh_token", refresh_token: first.refresh_token });
    expect(refreshed.status).toBe(200); const second = await refreshed.json();
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect((await token({ grant_type: "refresh_token", refresh_token: first.refresh_token })).status).toBe(400);
    await expect(provider.verifyAccessToken(first.access_token)).rejects.toThrow();
    const reduced = await token({ grant_type: "refresh_token", refresh_token: second.refresh_token, scope: "status:read" });
    expect(await reduced.json()).not.toHaveProperty("refresh_token");
    const onlineOnly = await issue(1, ["status:read"]); expect(onlineOnly).not.toHaveProperty("refresh_token");
  });

  it("allows only one concurrent exchange of an authorization code", async () => {
    const code = await provider.createCode(1, { clientId: config.clientId, redirectUri: config.redirectUris[0], resource: config.resource,
      scopes: ["status:read"], codeChallenge: challenge, expiresAt: Date.now()+10000 });
    const results = await Promise.allSettled([1,2].map(() => provider.exchangeAuthorizationCode(clientInfo, code, undefined, config.redirectUris[0])));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects expired grants, deactivated users and removed Status permissions", async () => {
    const grant = await issue();
    await pool.query("UPDATE users SET is_active=false WHERE id=1");
    await expect(provider.verifyAccessToken(grant.access_token)).rejects.toThrow();
    expect((await token({ grant_type: "refresh_token", refresh_token: grant.refresh_token })).status).toBe(400);
    await pool.query("UPDATE users SET is_active=true,permissions='{}' WHERE id=1");
    await expect(provider.verifyAccessToken(grant.access_token)).rejects.toThrow();
    await pool.query("UPDATE users SET permissions=ARRAY['status'] WHERE id=1");
    await pool.query("UPDATE mcp_oauth_grants SET access_expires_at=now()-interval '1 second',refresh_expires_at=now()-interval '1 second'");
    await expect(provider.verifyAccessToken(grant.access_token)).rejects.toThrow();
    expect((await token({ grant_type: "refresh_token", refresh_token: grant.refresh_token })).status).toBe(400);
    const code = await provider.createCode(1, { clientId: config.clientId, redirectUri: config.redirectUris[0], resource: config.resource,
      scopes: ["status:read"], codeChallenge: challenge, expiresAt: Date.now()+10000 });
    await pool.query("UPDATE mcp_oauth_grants SET code_expires_at=now()-interval '1 second' WHERE code_hash=$1", [tokenHash(code)]);
    expect((await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUris[0] })).status).toBe(400);
  });

  it("uses the actual MCP SDK client to discover and query three read-only tools", async () => {
    const grant = await issue();
    const client = new Client({ name: "integration-test", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL(config.resource), { requestInit: { headers: { Authorization: `Bearer ${grant.access_token}` } } }));
    try {
      const { tools } = await client.listTools(); expect(tools).toHaveLength(3);
      expect(tools.every(t => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false)).toBe(true);
      const rooms = await client.callTool({ name: "list_status_rooms", arguments: { query: "Vick" } });
      expect((rooms.structuredContent as any).items.map((r: any) => r.id)).toEqual([10]);
      const status = await client.callTool({ name: "get_status", arguments: { roomId: 10 } });
      const items = (status.structuredContent as any).items;
      expect(items.map((i: any) => i.kind)).toEqual(["custom","project"]);
      expect(items[1].title).toBe("Nombre operativo"); expect(items[0].decision_needed).toBe("priorizacion");
      const events = await client.callTool({ name: "get_status_activity", arguments: { roomId: 10 } });
      expect((events.structuredContent as any).items).toHaveLength(3);
      expect(JSON.stringify(events)).not.toMatch(/SECRETA|OCULT/);
      expect((await client.callTool({ name: "get_status", arguments: { roomId: 20 } })).isError).toBe(true);
      expect((await client.callTool({ name: "get_status", arguments: { roomId: 10, limit: 999 } })).isError).toBe(true);
      expect((await client.callTool({ name: "get_status_activity", arguments: { roomId: 10, itemId: 100 } })).isError).toBe(true);
      await pool.query("DELETE FROM review_room_members WHERE room_id=10 AND user_id=1");
      expect((await client.callTool({ name: "get_status", arguments: { roomId: 10 } })).isError).toBe(true);
    } finally { await client.close(); }
  });

  it("paginates without losing projects/custom topics, filters activity and protects hidden/archived rooms even for admins", async () => {
    const first = await reader.getStatus(1,10,1,0); expect(first.nextOffset).toBe(1);
    const second = await reader.getStatus(1,10,1,first.nextOffset!); expect(second.nextOffset).toBeNull();
    expect([...first.items,...second.items].map(i => i.id)).toEqual([200,100]);
    const since = new Date(Date.now()-86400000).toISOString(), until = new Date(Date.now()+10000).toISOString();
    const filtered = await reader.getActivity(1,10,since,until,"custom",200,25,0);
    expect(filtered.items.map(i => i.type)).toEqual(["update"]);
    expect((await reader.listRooms(3,"",25,0)).items).toEqual([]);
    await pool.query("UPDATE users SET is_admin=true WHERE id=1");
    await expect(reader.getStatus(1,20,25,0)).rejects.toThrow();
    await expect(reader.getStatus(1,30,25,0)).rejects.toThrow();
    await pool.query("UPDATE review_rooms SET archived_at=now() WHERE id=10");
    await expect(reader.getActivity(1,10,since,until,undefined,undefined,25,0)).rejects.toThrow();
  });

  it("revokes access through the user's connections page, enforces CSRF and ownership", async () => {
    const one = await issue(1), two = await issue(2);
    const cookie = await login(1);
    const connections = await request("/mcp/connections", { headers: { cookie } });
    expect(connections.headers.get("referrer-policy")).toBe("strict-origin");
    const html = await connections.text();
    const csrf = html.match(/name="csrf" value="([^"]+)"/)![1];
    const id = html.match(/name="id" value="([^"]+)"/)![1];
    const foreignId = (await pool.query("SELECT id FROM mcp_oauth_grants WHERE user_id=2")).rows[0].id;
    expect(html).not.toContain(foreignId);
    const revoke = (id: string, origin = config.origin) => request("/mcp/connections", { method: "POST", headers: { cookie, Origin: origin }, body: new URLSearchParams({ csrf, id }) });
    expect((await revoke(id,"https://evil.example")).status).toBe(403);
    expect((await revoke(id,"null")).status).toBe(403);
    await revoke(foreignId); await expect(provider.verifyAccessToken(two.access_token)).resolves.toBeDefined();
    expect((await revoke(id)).status).toBe(303);
    await expect(provider.verifyAccessToken(one.access_token)).rejects.toThrow();
    expect((await token({ grant_type: "refresh_token", refresh_token: one.refresh_token })).status).toBe(400);
    await provider.revokeToken(clientInfo,{ token: two.access_token });
    await expect(provider.verifyAccessToken(two.access_token)).rejects.toThrow();
  });
});
