import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { MindOAuthProvider } from "../server/mcp/oauth";
import { logMcpTokenFailure } from "../server/mcp/diagnostics";
import type { Pool } from "pg";

describe("MCP token diagnostics", () => {
  let http: Server, origin: string;
  const secret = "test-secret-never-log".repeat(2);
  beforeAll(async () => {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    const provider = new MindOAuthProvider({} as Pool, {
      origin: "https://mind.example", resource: "https://mind.example/mcp",
      clientId: "mind-test", clientSecret: secret, redirectUris: ["https://chatgpt.com/callback"],
    });
    app.use("/token", logMcpTokenFailure, tokenHandler({ provider, rateLimit: false }));
    app.post("/unexpected", logMcpTokenFailure, (_req, res) => res.status(400).json({
      error: "sensitive-error", error_description: "sensitive-description",
    }));
    http = createServer(app);
    await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await new Promise<void>(resolve => http.close(() => resolve())); });

  it.each([
    [{ client_id: "unknown", client_secret: secret }, "unknown_client"],
    [{ client_id: "mind-test" }, "missing_client_secret"],
    [{ client_id: "mind-test", client_secret: "wrong-secret" }, "incorrect_client_secret"],
  ])("identifies SDK client rejection without logging credentials: %s", async (credentials, reason) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await fetch(`${origin}/token`, { method: "POST", headers: { Authorization: "Basic private-value" },
      body: new URLSearchParams({ ...credentials, grant_type: "authorization_code", code: "private-code",
        code_verifier: "private-verifier", redirect_uri: "https://chatgpt.com/callback?private-state" }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_client");
    expect(warn).toHaveBeenCalledWith("[MCP] OAuth token exchange failed", expect.objectContaining({
      error: "invalid_client", reason, grantType: "authorization_code", hasAuthorizationHeader: true,
    }));
    const logged = JSON.stringify(warn.mock.calls);
    for (const value of [secret, "wrong-secret", "private-value", "private-code", "private-verifier", "private-state"]) {
      expect(logged).not.toContain(value);
    }
  });

  it("does not echo arbitrary errors or descriptions into logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await fetch(`${origin}/unexpected`, { method: "POST" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "sensitive-error", error_description: "sensitive-description" });
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ error: "unknown_error", reason: "unspecified" }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive");
  });
});
