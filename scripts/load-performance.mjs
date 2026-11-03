import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";

const base = new URL(process.env.PERFORMANCE_BASE_URL || "http://127.0.0.1:55942");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) throw new Error("Use an isolated local target; forward staging to localhost if needed");
const users = Math.max(1, Math.min(200, Number(process.env.PERFORMANCE_CONCURRENCY) || 10));
const seconds = Math.max(5, Math.min(120, Number(process.env.PERFORMANCE_SECONDS) || 30));
const accounts = [0, 1];
const sessions = await Promise.all(accounts.map(async index => {
  const response = await fetch(new URL("/api/login", base), { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
    body: JSON.stringify({ email: `e2e-${index}@example.test`, password: "mind-local-test-only" }) });
  if (!response.ok) throw new Error("Seed the dedicated E2E database before running load tests");
  return response.headers.getSetCookie().map(cookie => cookie.split(";", 1)[0]).join("; ");
}));
const routes = [
  ["/api/tasks/my-tasks?limit=100", "/api/crm/leads?limit=50", "/api/quotations?limit=50", "/api/v2/executive/dashboard?year=2026&month=11"],
  ["/api/tasks/my-tasks?limit=100", "/api/search?q=Proyecto", "/api/notifications?limit=20", "/api/tasks/project/1?layout=flat"],
];
const results = new Map();
const deadline = performance.now() + seconds * 1000;
await Promise.all(Array.from({ length: users }, async (_, worker) => {
  const account = worker % accounts.length;
  let sequence = worker;
  while (performance.now() < deadline) {
    const route = routes[account][sequence++ % routes[account].length];
    const record = results.get(route) ?? { durations: [], errors: 0, bytes: 0 };
    results.set(route, record);
    const started = performance.now();
    try {
      const response = await fetch(new URL(route, base), { headers: { Cookie: sessions[account] }, signal: AbortSignal.timeout(10_000) });
      record.bytes += (await response.arrayBuffer()).byteLength;
      if (!response.ok) record.errors++;
    } catch { record.errors++; }
    record.durations.push(performance.now() - started);
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  }
}));
const report = { concurrentWorkers: users, accounts: accounts.length, durationSeconds: seconds, node: process.version,
  note: "Local synthetic read workload on two fixture accounts; does not certify production capacity or financial write concurrency.", routes: {} };
let failed = false;
for (const [route, result] of results) {
  const sorted = result.durations.sort((a, b) => a - b);
  const percentile = p => Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] * 100) / 100;
  const errorRate = result.errors / sorted.length;
  report.routes[route] = { requests: sorted.length, errors: result.errors, errorRate, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), bytes: result.bytes };
  if (errorRate >= .005 || percentile(.95) > 400) failed = true;
}
console.log(JSON.stringify(report, null, 2));
if (process.env.PERFORMANCE_REPORT) await fs.writeFile(process.env.PERFORMANCE_REPORT, JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
