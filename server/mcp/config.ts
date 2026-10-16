export const MCP_SCOPE = "status:read";
export const MIND_SCOPE = "mind:read";
export const MCP_SCOPES = [MIND_SCOPE, MCP_SCOPE, "offline_access"];
export const validMcpScopes = (scopes: string[]) => scopes.some(s => s === MIND_SCOPE || s === MCP_SCOPE)
  && scopes.every(s => MCP_SCOPES.includes(s));

export interface MindMcpConfig {
  origin: string;
  resource: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
}

/** Explicit configuration prevents Host-header poisoning and accidental publication. */
export function readMcpConfig(env: NodeJS.ProcessEnv = process.env): MindMcpConfig | null {
  if (!env.MIND_MCP_PUBLIC_URL) return null;
  const url = new URL(env.MIND_MCP_PUBLIC_URL);
  const local = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || !["http:", "https:"].includes(url.protocol)
    || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("MIND_MCP_PUBLIC_URL debe ser el origen HTTPS de Mind, sin ruta ni credenciales.");
  }
  const clientId = env.MIND_MCP_CLIENT_ID?.trim();
  const clientSecret = env.MIND_MCP_CLIENT_SECRET;
  const redirectUris = env.MIND_MCP_REDIRECT_URIS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
  if (!clientId || !clientSecret || clientSecret.length < 32 || !redirectUris.length) {
    throw new Error("MCP requiere MIND_MCP_CLIENT_ID, MIND_MCP_CLIENT_SECRET (mínimo 32 caracteres) y MIND_MCP_REDIRECT_URIS.");
  }
  for (const value of redirectUris) {
    const redirect = new URL(value);
    const localRedirect = local && ["localhost", "127.0.0.1"].includes(redirect.hostname);
    if ((!localRedirect && redirect.protocol !== "https:") || redirect.username || redirect.password
      || redirect.hash || value.includes("*")) throw new Error("Redirect OAuth inválido: usá URLs HTTPS exactas, sin comodines.");
  }
  return { origin: url.origin, resource: `${url.origin}/mcp`, clientId, clientSecret, redirectUris };
}
