import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { registerBiRoutes } from "../server/routes-bi";

describe("BI routes authenticate before touching financial data", () => {
  let server: Server;
  let base: string;
  const query = vi.fn(async () => ({ rows: [{ amount: 10 }] }));
  beforeAll(async () => {
    const app = express();
    registerBiRoutes(app, { query } as any, (req, res, next) => {
      if (!req.headers["x-test-role"]) { res.status(401).end(); return; }
      req.user = { permissions: req.headers["x-test-role"] === "finance" ? ["finance"] : [], isAdmin: false } as any;
      next();
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { vi.unstubAllEnvs(); await new Promise<void>(resolve => server.close(() => resolve())); });
  it("rejects anonymous and non-financial users without querying a view", async () => {
    query.mockClear();
    expect((await fetch(`${base}/api/bi/pnl-mensual`)).status).toBe(401);
    expect((await fetch(`${base}/api/bi/pnl-mensual`, { headers: { "x-test-role": "member" } })).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it("allows financial sessions and never publishes a cacheable response", async () => {
    const response = await fetch(`${base}/api/bi/pnl-mensual`, { headers: { "x-test-role": "finance" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual([{ amount: 10 }]);
  });
  it("supports a service token and rejects invalid tokens even with a session", async () => {
    vi.stubEnv("BI_ACCESS_TOKEN", "test-service-credential");
    expect((await fetch(`${base}/api/bi/cashflow`, { headers: { Authorization: "Bearer incorrect", "x-test-role": "finance" } })).status).toBe(401);
    expect((await fetch(`${base}/api/bi/cashflow`, { headers: { Authorization: "Bearer test-service-credential" } })).status).toBe(200);
  });
});
