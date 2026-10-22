import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { createOAuthMetadata, mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MIND_SCOPE, MCP_SCOPES, type MindMcpConfig } from "./config";
import { MindOAuthProvider, randomToken } from "./oauth";
import { MindStatusReader } from "./status";
import { createMindMcpServer } from "./tools";
import { MindDataReader, MindDataError } from "./data";

type BrowserUser = { id: number; firstName: string; lastName: string; isActive?: boolean | null;
  isAdmin?: boolean | null; role?: string; permissions?: string[] | null };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(res: Response, title: string, body: string, callbackOrigin?: string) {
  // no-referrer makes browsers send Origin: null on native form POSTs, failing CSRF validation.
  // Keep the origin while excluding paths and query strings from the referrer.
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "strict-origin", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${callbackOrigin ? ` ${callbackOrigin}` : ""}; frame-ancestors 'none'; base-uri 'none'` });
  res.type("html").send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escape(title)} · Mind</title><style>body{font:16px/1.6 system-ui;background:#0b0f17;color:#eef2ff;margin:0;padding:40px 20px}
    main{max-width:560px;margin:6vh auto;background:#161c29;border:1px solid #334155;border-radius:20px;padding:32px}
    h1{font-size:26px;line-height:1.2}p,li{color:#cbd5e1}button,a{font:inherit}button{padding:12px 18px;border:0;border-radius:8px;cursor:pointer;background:#f43f5e;color:white;margin:8px 8px 0 0}
    button.secondary{background:#334155}a{color:#fda4af}code{overflow-wrap:anywhere}hr{border:0;border-top:1px solid #334155}</style>
    <main><p>EPICAL · MIND</p><h1>${escape(title)}</h1>${body}</main></html>`);
}

export function registerMindMcp(app: Express, pool: Pool, config: MindMcpConfig | null,
  getUser: (id: number) => Promise<BrowserUser | undefined>) {
  if (!config) {
    app.all("/mcp", (_req, res) => res.status(503).json({ error: "El conector Mind no está configurado." }));
    app.get("/mcp/connections", (_req, res) => page(res.status(503), "Conexiones de agentes",
      '<p>La conexión con agentes todavía no está habilitada. Contactá al administrador de Mind.</p><p><a href="/review">Volver a Status</a></p>'));
    return;
  }
  const provider = new MindOAuthProvider(pool, config);
  const reader = new MindStatusReader(pool, config.origin);
  const dataReader = new MindDataReader(pool, config.origin);
  const issuer = new URL(config.origin).href;
  // RFC 9207 lets ChatGPT use its stable callback. The issuer must match exactly,
  // including the trailing slash, on both successful and error redirects.
  app.get("/.well-known/oauth-authorization-server", cors(), (_req, res) => res.json({
    ...createOAuthMetadata({ provider, issuerUrl: new URL(issuer), scopesSupported: MCP_SCOPES }),
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    authorization_response_iss_parameter_supported: true,
  }));
  app.use("/authorize", (_req, res, next) => {
    const location = res.location.bind(res);
    res.location = (address: string) => {
      // The SDK validates registered redirect URIs before issuing these error redirects.
      // Its internal relative redirect to /mcp/consent is left unchanged.
      if (/^https?:\/\//.test(address)) {
        const target = new URL(address);
        target.searchParams.set("iss", issuer);
        return location(target.href);
      }
      return location(address);
    };
    next();
  });
  // The SDK supplies discovery, exact redirect validation, PKCE S256, client authentication and rate limits.
  app.use(mcpAuthRouter({ provider, issuerUrl: new URL(config.origin), resourceServerUrl: new URL(config.resource),
    scopesSupported: MCP_SCOPES, resourceName: "Mind" }));

  const safe = (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, _next: NextFunction) => { void fn(req, res).catch(() => {
      console.error("[MCP] Falló una operación del conector");
      if (!res.headersSent) res.status(500).json({ error: "No se pudo completar la operación." });
    }); };
  const browserUser = async (req: Request, res: Response) => {
    const user = req.session.userId ? await getUser(req.session.userId) : undefined;
    if (!user || user.isActive === false) {
      res.redirect(303, `/auth?returnTo=${encodeURIComponent(req.path === "/mcp/connections" ? "/mcp/connections" : "/mcp/consent")}`);
      return;
    }
    const broad = req.path === "/mcp/connections" || req.session.mcpAuthorization?.scopes.includes(MIND_SCOPE);
    const permissions = broad ? ["crm", "quotations", "projects", "operations", "status", "dashboard", "finance", "task_manager", "admin"] : ["status"];
    if (user.role === "external_provider" || !(user.isAdmin || user.role === "admin" || permissions.some(p => user.permissions?.includes(p)))) {
      page(res.status(403), "Acceso no disponible", "<p>Tu cuenta no tiene permiso para el acceso solicitado.</p>");
      return;
    }
    return user;
  };
  const validPost = (req: Request, csrf: string | undefined) => req.get("origin") === config.origin &&
    typeof csrf === "string" && typeof req.body?.csrf === "string" && req.body.csrf === csrf;

  app.get("/mcp/consent", safe(async (req, res) => {
    const pending = req.session.mcpAuthorization;
    if (!pending || pending.expiresAt < Date.now()) {
      page(res.status(400), "Solicitud vencida", "<p>Volvé al agente e iniciá la conexión con Mind otra vez.</p>"); return;
    }
    const user = await browserUser(req, res); if (!user) return;
    pending.csrf = randomToken(); pending.userId = user.id;
    const broad = pending.scopes.includes(MIND_SCOPE);
    page(res, broad ? "Conectar Mind" : "Conectar Mind Status", `<p>Vas a autorizar a <strong>${broad ? "Mind" : "Mind Status"}</strong> con la cuenta de ${escape(user.firstName)} ${escape(user.lastName)}.</p>
      <p>${broad ? "El agente podrá consultar todos los módulos de negocio que permiten tus permisos: cotizaciones y propuestas, CRM y clientes, proyectos, tareas y horas, operaciones y personal, costos y finanzas, objetivos, Status, tus conversaciones y datos personales. Incluye información comercial y financiera sensible cuando tu cuenta tiene acceso. Las salas y conversaciones requieren membresía. No se comparten contraseñas, tokens ni configuración secreta." : "El agente podrá leer las salas activas de las que sos miembro, sus participantes, proyectos, temas, riesgos, decisiones, notas e historial."} No podrá modificar datos.</p>
      <p>${pending.scopes.includes("offline_access") ? "El acceso puede renovarse durante 30 días sin volver a iniciar sesión." : "El acceso vence en una hora."}
      Podés revocarlo desde <a href="/mcp/connections">Conexiones de agentes</a>.</p>
      <p>Al autorizar, volverás a <code>${escape(new URL(pending.redirectUri).host)}</code>.</p>
      <form method="post" action="/mcp/consent"><input type="hidden" name="csrf" value="${escape(pending.csrf)}">
      <button name="decision" value="allow">Autorizar lectura</button><button class="secondary" name="decision" value="deny">Cancelar</button></form>`, new URL(pending.redirectUri).origin);
  }));
  app.post("/mcp/consent", safe(async (req, res) => {
    const user = await browserUser(req, res); if (!user) return;
    const pending = req.session.mcpAuthorization;
    if (!pending || pending.expiresAt < Date.now() || pending.userId !== user.id || !validPost(req, pending.csrf)
      || !["allow", "deny"].includes(req.body.decision)) {
      res.status(403).json({ error: "Solicitud inválida o vencida. Volvé a iniciar la conexión." }); return;
    }
    delete req.session.mcpAuthorization;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    const target = new URL(pending.redirectUri);
    target.searchParams.set("iss", issuer);
    if (pending.state !== undefined) target.searchParams.set("state", pending.state);
    if (req.body.decision === "allow") target.searchParams.set("code", await provider.createCode(user.id, pending));
    else target.searchParams.set("error", "access_denied");
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }).redirect(303, target.href);
  }));
  app.get("/mcp/connections", safe(async (req, res) => {
    const user = await browserUser(req, res); if (!user) return;
    req.session.mcpConnectionsCsrf = randomToken();
    const { rows } = await pool.query(`SELECT id,created_at,scopes FROM mcp_oauth_grants WHERE user_id=$1 AND revoked_at IS NULL
      AND (access_expires_at>now() OR refresh_expires_at>now()) ORDER BY created_at DESC`, [user.id]);
    page(res, "Conexiones de agentes", `<p>Accesos de lectura autorizados por ${escape(user.firstName)} ${escape(user.lastName)}.</p>` +
      (rows.length ? rows.map(row => `<hr><p>${row.scopes.includes(MIND_SCOPE) ? "Mind · Todos tus módulos autorizados" : "Mind Status · Solo Status"} · ${escape(new Date(row.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }))}</p>
        <form method="post" action="/mcp/connections"><input type="hidden" name="csrf" value="${escape(req.session.mcpConnectionsCsrf)}">
        <input type="hidden" name="id" value="${escape(row.id)}"><button>Revocar acceso</button></form>`).join("") : "<p>No tenés conexiones activas.</p>") +
      '<p><a href="/review">Volver a Status</a></p>');
  }));
  app.post("/mcp/connections", safe(async (req, res) => {
    const user = await browserUser(req, res); if (!user) return;
    if (!validPost(req, req.session.mcpConnectionsCsrf) || typeof req.body.id !== "string") {
      res.status(403).json({ error: "Solicitud inválida." }); return;
    }
    await pool.query("UPDATE mcp_oauth_grants SET revoked_at=now() WHERE id=$1 AND user_id=$2", [req.body.id, user.id]);
    res.redirect(303, "/mcp/connections");
  }));

  const allowedOrigins = new Set([config.origin, "https://chatgpt.com"]);
  app.use("/mcp", (req, res, next) => {
    if (req.path !== "/") return next();
    if (req.get("origin") && !allowedOrigins.has(req.get("origin")!)) {
      res.status(403).json({ error: "Origin no permitido" }); return;
    }
    next();
  });
  app.options("/mcp", cors({ origin: [...allowedOrigins], allowedHeaders: ["Content-Type", "Authorization", "MCP-Protocol-Version"], methods: ["POST", "GET", "DELETE"] }));
  app.use("/mcp", cors({ origin: [...allowedOrigins], exposedHeaders: ["WWW-Authenticate"] }));
  const bearer = requireBearerAuth({ verifier: provider, expectedResource: new URL(config.resource),
    resourceMetadataUrl: `${config.origin}/.well-known/oauth-protected-resource/mcp` });
  app.post("/mcp", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }), bearer, safe(async (req, res) => {
    const token = req.auth!.token;
    const server = createMindMcpServer(reader, async () => Number((await provider.verifyAccessToken(token)).extra!.userId), {
      reader: dataReader,
      authenticate: async () => {
        const auth = await provider.verifyAccessToken(token);
        if (!auth.scopes.includes(MIND_SCOPE)) throw new MindDataError("Esta conexión solo autorizó Status. Actualizá y reconectá el plugin solicitando mind:read offline_access para consultar los demás módulos.");
        return Number(auth.extra!.userId);
      },
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }));
  app.all("/mcp", (_req, res) => res.set("Allow", "POST, OPTIONS").status(405).json({ error: "Usá POST (Streamable HTTP sin sesión)." }));
}
