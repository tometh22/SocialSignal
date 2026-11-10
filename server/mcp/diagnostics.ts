import type { RequestHandler } from "express";

// Never log OAuth bodies, headers, codes, tokens or arbitrary error descriptions.
// The SDK returns its errors as JSON rather than passing them to Express errors.
const reasons = new Map([
  ["Invalid client_id", "unknown_client"],
  ["Client secret is required", "missing_client_secret"],
  ["Invalid client_secret", "incorrect_client_secret"],
  ["Client secret has expired", "expired_client_secret"],
  ["code_verifier does not match the challenge", "pkce_mismatch"],
  ["Código inválido o vencido", "invalid_authorization_code"],
  ["Código inválido, usado o vencido", "authorization_exchange_rejected"],
  ["Refresh token inválido, usado o vencido", "refresh_rejected"],
  ["Recurso inválido", "resource_mismatch"],
]);
const errors = new Set(["invalid_request", "invalid_client", "invalid_grant", "invalid_scope",
  "invalid_target", "unsupported_grant_type", "server_error", "too_many_requests"]);

export const logMcpTokenFailure: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 400) {
      console.warn("[MCP] OAuth token exchange failed", {
        status: res.statusCode,
        error: errors.has(body?.error) ? body.error : "unknown_error",
        reason: reasons.get(body?.error_description) ?? "unspecified",
        grantType: ["authorization_code", "refresh_token"].includes(req.body?.grant_type)
          ? req.body.grant_type : "other",
        hasClientId: typeof req.body?.client_id === "string",
        hasClientSecret: typeof req.body?.client_secret === "string",
        hasAuthorizationHeader: Boolean(req.get("authorization")),
        hasRedirectUri: typeof req.body?.redirect_uri === "string",
        hasCodeVerifier: typeof req.body?.code_verifier === "string",
        hasResource: typeof req.body?.resource === "string",
      });
    }
    return json(body);
  };
  next();
};
