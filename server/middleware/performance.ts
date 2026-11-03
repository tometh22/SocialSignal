import type { Express, RequestHandler } from "express";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Pool } from "pg";
import { requirePermission } from "./requirePermission";

const bounds = [50, 100, 200, 400, 700, 1000, 2500, 5000, Infinity];
const requests = new Map<string, { count: number; errors: number; durationMs: number; buckets: number[] }>();
const vitalBounds: Record<string, number[]> = {
  LCP: [1000, 1500, 2000, 2500, 4000, 6000, Infinity], INP: [50, 100, 200, 500, 1000, 2500, Infinity],
  CLS: [0.05, 0.1, 0.25, 0.5, 1, Infinity], FCP: [500, 1000, 1800, 3000, 5000, Infinity], TTFB: [100, 300, 800, 1800, 3000, Infinity],
};
const vitals = new Map<string, { count: number; total: number; buckets: number[]; upperBounds: Array<number | string> }>();
const lag = monitorEventLoopDelay({ resolution: 20 });
lag.enable();
const vitalSchema = z.object({ name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]), value: z.number().finite().nonnegative().max(3_600_000) });

export const requestPerformance: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.once("finish", () => {
    if (!req.path.startsWith("/api") || req.path.startsWith("/api/telemetry")) return;
    // Route templates avoid IDs, query strings, names and unbounded metric cardinality.
    const route = typeof req.route?.path === "string" ? req.baseUrl + req.route.path : "unmatched";
    const key = `${req.method} ${route}`;
    if (!requests.has(key) && requests.size >= 500) return;
    const entry = requests.get(key) ?? { count: 0, errors: 0, durationMs: 0, buckets: bounds.map(() => 0) };
    const elapsed = performance.now() - started;
    entry.count++; entry.errors += Number(res.statusCode >= 500); entry.durationMs += elapsed;
    entry.buckets[bounds.findIndex(bound => elapsed <= bound)]++;
    requests.set(key, entry);
  });
  next();
};

export function registerPerformanceRoutes(app: Express, pool: Pool, requireAuth: RequestHandler) {
  app.post("/api/telemetry/vitals", requireAuth, rateLimit({ windowMs: 60_000, limit: 30, legacyHeaders: false }), (req, res) => {
    const result = vitalSchema.safeParse(req.body);
    if (!result.success) { res.status(400).end(); return; }
    const { name, value } = result.data;
    const thresholds = vitalBounds[name];
    const entry = vitals.get(name) ?? { count: 0, total: 0, buckets: thresholds.map(() => 0), upperBounds: thresholds.map(value => Number.isFinite(value) ? value : "Infinity") };
    entry.count++; entry.total += value;
    entry.buckets[thresholds.findIndex(bound => value <= bound)]++;
    vitals.set(name, entry);
    res.status(204).end();
  });
  app.get("/api/admin/performance", requireAuth, requirePermission("admin"), (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ uptimeSeconds: process.uptime(), memory: process.memoryUsage(), cpu: process.cpuUsage(),
      eventLoopMs: { p95: lag.percentile(95) / 1e6, p99: lag.percentile(99) / 1e6 },
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      bucketUpperBoundsMs: bounds.map(bound => Number.isFinite(bound) ? bound : "Infinity"),
      requests: Object.fromEntries(requests), vitals: Object.fromEntries(vitals), scope: "current-process" });
  });
}
