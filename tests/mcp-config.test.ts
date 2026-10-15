import { describe, expect, it } from "vitest";
import { readMcpConfig } from "../server/mcp/config";
import { readFileSync } from "node:fs";
import { mcpOauthMigrationSql } from "../server/migrations/mcp-oauth";
import { getAuthReturnPath } from "../client/src/lib/auth-return";

const env = { NODE_ENV: "production", MIND_MCP_PUBLIC_URL: "https://mind.example",
  MIND_MCP_CLIENT_ID: "mind-test", MIND_MCP_CLIENT_SECRET: "a".repeat(32),
  MIND_MCP_REDIRECT_URIS: "https://chatgpt.com/callback" };

describe("MCP configuration", () => {
  it("is disabled until explicitly configured", () => expect(readMcpConfig({})).toBeNull());
  it("uses a fixed HTTPS origin and explicit client", () => {
    expect(readMcpConfig(env)).toMatchObject({ origin: "https://mind.example", resource: "https://mind.example/mcp" });
    for (const value of ["http://mind.example", "https://mind.example/mcp", "https://user:pass@mind.example", "https://mind.example?q=x"]) {
      expect(() => readMcpConfig({ ...env, MIND_MCP_PUBLIC_URL: value })).toThrow();
    }
  });
  it("rejects unsafe redirects and weak/missing client secrets", () => {
    for (const value of ["https://chatgpt.com/*", "http://chatgpt.com/callback", "https://chatgpt.com/callback#fragment", ""]) {
      expect(() => readMcpConfig({ ...env, MIND_MCP_REDIRECT_URIS: value })).toThrow();
    }
    expect(() => readMcpConfig({ ...env, MIND_MCP_CLIENT_SECRET: "short" })).toThrow();
  });
  it("keeps the SQL and startup migrations identical", () => {
    expect(mcpOauthMigrationSql.trim()).toBe(readFileSync("migrations/0086_mcp_oauth.sql", "utf8").trim());
  });
  it("only returns to the two known Mind pages after login", () => {
    expect(getAuthReturnPath("?returnTo=%2Fmcp%2Fconsent")).toBe("/mcp/consent");
    expect(getAuthReturnPath("?returnTo=/mcp/connections")).toBe("/mcp/connections");
    for (const value of ["https://evil.example", "//evil.example", "/mcp/consent?redirect=evil", "/other", ""]) {
      expect(getAuthReturnPath(`?returnTo=${encodeURIComponent(value)}`)).toBeNull();
    }
  });
});
