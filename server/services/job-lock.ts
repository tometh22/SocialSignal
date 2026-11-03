import { publishAppEvent } from "./app-events";
import { pool } from "../db";
import pg from "pg";

// Lock holders must not consume the web pool: their callback also queries PostgreSQL.
export const jobLockPool = new pg.Pool({ connectionString: pool.options.connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 3, connectionTimeoutMillis: 1000, idleTimeoutMillis: 30_000, application_name: "mind-job-locks" });
jobLockPool.on("error", error => console.error("Job lock connection failed", error));
const local = new Set<string>();
let stopping = false;
const active = new Set<Promise<unknown>>();

export async function withJobLock<T>(name: string, work: () => Promise<T>, options: { wait?: boolean } = {}): Promise<T | undefined> {
  if (stopping || local.has(name)) return undefined;
  local.add(name);
  let finish!: () => void;
  const completion = new Promise<void>(resolve => { finish = resolve; });
  active.add(completion);
  let client: pg.PoolClient | undefined;
  let acquired = false;
  try {
    client = await jobLockPool.connect();
    const result = await client.query(options.wait ? "SELECT pg_advisory_lock(71291, hashtext($1)), true AS locked" : "SELECT pg_try_advisory_lock(71291, hashtext($1)) AS locked", [name]);
    acquired = result.rows[0].locked;
    if (!acquired) return undefined;
    try { return await work(); }
    finally { await publishAppEvent({ topic: "cache" }).catch(error => console.error("Job cache invalidation failed", error)); }
  } finally {
    if (client) {
      try { if (acquired) await client.query("SELECT pg_advisory_unlock(71291, hashtext($1))", [name]); client.release(); }
      catch { client.release(true); }
    }
    local.delete(name);
    active.delete(completion);
    finish();
  }
}

export async function stopJobs() {
  stopping = true;
  const { default: cron } = await import("node-cron");
  for (const task of cron.getTasks().values()) await task.stop();
  await Promise.allSettled([...active]);
  await jobLockPool.end();
}
