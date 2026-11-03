import { describe, expect, it, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
const setup = vi.hoisted(() => ({ url: process.env.FINANCIAL_TEST_DATABASE_URL }));
if (setup.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(setup.url).hostname)) throw Error("Use a local test database");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg");
  return { pool: new Pool({ connectionString: setup.url, max: 2 }) };
});
import { pool } from "../server/db";
import { jobLockPool, withJobLock } from "../server/services/job-lock";

describe.skipIf(!setup.url)("cross-connection job ownership", () => {
  afterAll(async () => { await jobLockPool.end(); await pool.end(); });
  it("skips a job held by another connection and releases ownership after failures", async () => {
    const name = `test-${randomUUID()}`;
    const other = await pool.connect();
    try {
      await other.query("SELECT pg_advisory_lock(71291,hashtext($1))", [name]);
      const work = vi.fn(async () => 42);
      expect(await withJobLock(name, work)).toBeUndefined();
      expect(work).not.toHaveBeenCalled();
      await other.query("SELECT pg_advisory_unlock(71291,hashtext($1))", [name]);
      expect(await withJobLock(name, work)).toBe(42);
      await expect(withJobLock(name, async () => { throw Error("failure"); })).rejects.toThrow("failure");
      const reclaimed = await other.query("SELECT pg_try_advisory_lock(71291,hashtext($1)) locked", [name]);
      expect(reclaimed.rows[0].locked).toBe(true);
      await other.query("SELECT pg_advisory_unlock(71291,hashtext($1))", [name]);
    } finally { other.release(true); }
  });
});
