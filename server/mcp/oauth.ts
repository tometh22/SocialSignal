import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError, InvalidRequestError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { MIND_SCOPE, MCP_SCOPES, validMcpScopes, type MindMcpConfig } from "./config";

export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
// Rechecked at every exchange, refresh and tool call. Admins still need room membership.
export const activeStatusUserSql = `u.is_active IS NOT FALSE AND
  (u.is_admin IS TRUE OR u.role = 'admin' OR 'status' = ANY(u.permissions))`;
const activeMindUserSql = `u.is_active IS NOT FALSE AND u.role IS DISTINCT FROM 'external_provider' AND
  (u.is_admin IS TRUE OR u.role='admin' OR u.permissions && ARRAY['crm','quotations','projects','operations','status','dashboard','finance','task_manager','admin']::text[])`;
// Old Status grants retain their original scope; broader access needs fresh consent.
const activeGrantUserSql = `((${activeMindUserSql} AND 'mind:read'=ANY(g.scopes)) OR
  (${activeStatusUserSql} AND 'status:read'=ANY(g.scopes) AND NOT ('mind:read'=ANY(g.scopes))))`;

export interface PendingMcpAuthorization {
  clientId: string; redirectUri: string; codeChallenge: string; resource: string;
  scopes: string[]; state?: string; expiresAt: number; csrf?: string; userId?: number;
}

declare module "express-session" {
  interface SessionData {
    mcpAuthorization?: PendingMcpAuthorization;
    mcpConnectionsCsrf?: string;
  }
}

export class MindOAuthProvider implements OAuthServerProvider {
  readonly clientsStore;
  constructor(private pool: Pool, readonly config: MindMcpConfig) {
    const client: OAuthClientInformationFull = {
      client_id: config.clientId, client_secret: config.clientSecret, client_name: "Mind",
      redirect_uris: config.redirectUris, token_endpoint_auth_method: "client_secret_post",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
      scope: MCP_SCOPES.join(" "),
    };
    this.clientsStore = { getClient: (id: string) => id === client.client_id ? client : undefined };
  }

  private checkResource(resource?: URL) {
    if (resource && resource.href !== this.config.resource) throw new InvalidTargetError("Recurso inválido");
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    this.checkResource(params.resource);
    const scopes = params.scopes?.length ? [...new Set(params.scopes)] : [MIND_SCOPE];
    if (!validMcpScopes(scopes)) {
      throw new InvalidScopeError("Se permite mind:read, status:read y offline_access");
    }
    if (!this.config.redirectUris.includes(params.redirectUri) || !/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)
      || (params.state?.length ?? 0) > 2048) throw new InvalidRequestError("Solicitud OAuth inválida");
    res.req.session.mcpAuthorization = {
      clientId: client.client_id, redirectUri: params.redirectUri, codeChallenge: params.codeChallenge,
      resource: this.config.resource, scopes, state: params.state, expiresAt: Date.now() + 10 * 60_000,
    };
    await new Promise<void>((resolve, reject) => res.req.session.save(err => err ? reject(err) : resolve()));
    res.redirect(303, "/mcp/consent");
  }

  async createCode(userId: number, pending: PendingMcpAuthorization): Promise<string> {
    if (!validMcpScopes(pending.scopes)) throw new InvalidScopeError("Scope inválido");
    const code = randomToken();
    const result = await this.pool.query(`INSERT INTO mcp_oauth_grants
      (id, user_id, client_id, resource, scopes, redirect_uri, code_challenge, code_hash, code_expires_at)
      SELECT $1,u.id,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes' FROM users u
      WHERE u.id=$2 AND ${pending.scopes.includes(MIND_SCOPE) ? activeMindUserSql : activeStatusUserSql} RETURNING id`,
    [randomUUID(), userId, pending.clientId, pending.resource, pending.scopes, pending.redirectUri, pending.codeChallenge, tokenHash(code)]);
    if (!result.rowCount) throw new InvalidGrantError("Usuario sin acceso al alcance solicitado");
    return code;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    const { rows } = await this.pool.query(`SELECT code_challenge FROM mcp_oauth_grants
      WHERE code_hash=$1 AND client_id=$2 AND revoked_at IS NULL AND code_expires_at>now()`, [tokenHash(code), client.client_id]);
    if (!rows[0]) throw new InvalidGrantError("Código inválido o vencido");
    return rows[0].code_challenge;
  }

  private tokens(access: string, refresh: string | null, scopes: string[]): OAuthTokens {
    return { access_token: access, token_type: "Bearer", expires_in: 3600,
      ...(refresh ? { refresh_token: refresh } : {}), scope: scopes.join(" ") };
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL) {
    this.checkResource(resource);
    const access = randomToken(), refresh = randomToken();
    // Single atomic update: concurrent exchanges cannot reuse a code. PKCE is checked by the SDK token handler.
    const { rows } = await this.pool.query(`UPDATE mcp_oauth_grants g SET code_hash=NULL,
      access_token_hash=$4, access_expires_at=now()+interval '1 hour',
      refresh_token_hash=CASE WHEN 'offline_access'=ANY(g.scopes) THEN $5 ELSE NULL END,
      refresh_expires_at=CASE WHEN 'offline_access'=ANY(g.scopes) THEN now()+interval '30 days' ELSE NULL END
      FROM users u WHERE g.user_id=u.id AND ${activeGrantUserSql}
      AND g.code_hash=$1 AND g.client_id=$2 AND g.redirect_uri=$3 AND g.resource=$6
      AND g.revoked_at IS NULL AND g.code_expires_at>now() RETURNING g.scopes`,
    [tokenHash(code), client.client_id, redirectUri, tokenHash(access), tokenHash(refresh), this.config.resource]);
    if (!rows[0]) throw new InvalidGrantError("Código inválido, usado o vencido");
    return this.tokens(access, rows[0].scopes.includes("offline_access") ? refresh : null, rows[0].scopes);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, token: string, scopes?: string[], resource?: URL) {
    this.checkResource(resource);
    if (scopes && !validMcpScopes(scopes)) {
      throw new InvalidScopeError("Scope inválido");
    }
    const access = randomToken(), refresh = randomToken();
    const { rows } = await this.pool.query(`UPDATE mcp_oauth_grants g SET
      access_token_hash=$3, access_expires_at=now()+interval '1 hour',
      refresh_token_hash=CASE WHEN 'offline_access'=ANY(COALESCE($5::text[],g.scopes)) THEN $4 ELSE NULL END,
      refresh_expires_at=CASE WHEN 'offline_access'=ANY(COALESCE($5::text[],g.scopes)) THEN g.refresh_expires_at ELSE NULL END,
      scopes=COALESCE($5::text[],g.scopes)
      FROM users u WHERE g.user_id=u.id AND ${activeGrantUserSql}
      AND g.refresh_token_hash=$1 AND g.client_id=$2 AND g.resource=$6
      AND g.revoked_at IS NULL AND g.refresh_expires_at>now()
      AND ($5::text[] IS NULL OR $5::text[] <@ g.scopes) RETURNING g.scopes`,
    [tokenHash(token), client.client_id, tokenHash(access), tokenHash(refresh), scopes ?? null, this.config.resource]);
    if (!rows[0]) throw new InvalidGrantError("Refresh token inválido, usado o vencido");
    return this.tokens(access, rows[0].scopes.includes("offline_access") ? refresh : null, rows[0].scopes);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const { rows } = await this.pool.query(`SELECT g.user_id,g.client_id,g.scopes,g.access_expires_at,g.resource
      FROM mcp_oauth_grants g JOIN users u ON u.id=g.user_id
      WHERE g.access_token_hash=$1 AND g.revoked_at IS NULL AND g.access_expires_at>now()
      AND g.client_id=$2 AND g.resource=$3 AND ${activeGrantUserSql}`,
    [tokenHash(token), this.config.clientId, this.config.resource]);
    const grant = rows[0];
    if (!grant) throw new InvalidTokenError("Acceso inválido, vencido o revocado");
    return { token, clientId: grant.client_id, scopes: grant.scopes, resource: new URL(grant.resource),
      expiresAt: Math.floor(new Date(grant.access_expires_at).getTime()/1000), extra: { userId: grant.user_id } };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    await this.pool.query(`UPDATE mcp_oauth_grants SET revoked_at=now()
      WHERE client_id=$1 AND (access_token_hash=$2 OR refresh_token_hash=$2)`, [client.client_id, tokenHash(request.token)]);
  }
}
