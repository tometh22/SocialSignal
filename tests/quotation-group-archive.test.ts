import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import { setQuotationGroupArchived } from "../server/domain/quotation-group-archive";

// Use an isolated schema on the disposable CI/test database, never application data.
describe.skipIf(!process.env.TEST_MCP_DATABASE_URL)("quotation group archive transaction", () => {
  let admin: pg.Pool, pool: pg.Pool, db: ReturnType<typeof drizzle<typeof schema>>;
  const namespace = `group_archive_test_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL, options: `-c search_path=${namespace}` });
    db = drizzle({ client: pool, schema });
    await pool.query(`
      CREATE TABLE quotation_groups (id int PRIMARY KEY, archived_at timestamp, updated_at timestamp, updated_by int);
      CREATE TABLE quotation_group_items (group_id int, quotation_id int);
      CREATE TABLE quotations (id int PRIMARY KEY, archived_at timestamp, updated_at timestamp, updated_by int, lock_version int DEFAULT 0, status text);
    `);
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE quotations, quotation_groups, quotation_group_items;
      INSERT INTO quotation_groups(id) VALUES (1), (2);
      INSERT INTO quotations(id, status, archived_at) VALUES (10,'draft',NULL), (11,'approved',NULL), (12,'draft','2026-01-01'), (20,'draft',NULL);
      INSERT INTO quotation_group_items VALUES (1,10), (1,11), (1,12), (2,20);`);
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await admin.end(); }
  });

  it("archives only the selected group atomically, preserves statuses, and restores only its own archived rows", async () => {
    const result = await db.transaction(tx => setQuotationGroupArchived(tx, 1, true, 7));
    expect(result?.changedQuotationIds.sort()).toEqual([10, 11]);
    const { rows } = await pool.query("SELECT id,status,archived_at FROM quotations ORDER BY id");
    expect(rows.map(row => row.status)).toEqual(["draft", "approved", "draft", "draft"]);
    expect(rows[0].archived_at).not.toBeNull();
    expect(rows[3].archived_at).toBeNull();
    const restored = await db.transaction(tx => setQuotationGroupArchived(tx, 1, false, 7));
    expect(restored?.changedQuotationIds.sort()).toEqual([10, 11]);
    const after = await pool.query("SELECT id FROM quotations WHERE archived_at IS NOT NULL");
    expect(after.rows).toEqual([{ id: 12 }]);
  });
  it("repairs a previously archived group whose proposals stayed active", async () => {
    await pool.query("UPDATE quotation_groups SET archived_at='2026-10-01' WHERE id=1");
    const repaired = await db.transaction(tx => setQuotationGroupArchived(tx, 1, true, 7));
    expect(repaired?.changedQuotationIds.sort()).toEqual([10, 11]);
    expect(repaired?.idempotentReplay).toBe(false);
    const restored = await db.transaction(tx => setQuotationGroupArchived(tx, 1, false, 7));
    expect(restored?.changedQuotationIds.sort()).toEqual([10, 11]);
    expect((await pool.query("SELECT archived_at FROM quotations WHERE id=12")).rows[0].archived_at).not.toBeNull();
  });
  it("serializes duplicate requests and is idempotent on archive and restore", async () => {
    const results = await Promise.all([1, 2].map(() => db.transaction(tx => setQuotationGroupArchived(tx, 1, true, 7))));
    expect(results.filter(row => row?.idempotentReplay)).toHaveLength(1);
    expect(results.flatMap(row => row!.changedQuotationIds).sort()).toEqual([10, 11]);
    await db.transaction(tx => setQuotationGroupArchived(tx, 1, false, 7));
    expect(await db.transaction(tx => setQuotationGroupArchived(tx, 1, false, 7))).toMatchObject({ idempotentReplay: true });
  });
  it("rolls back the entire group if audit persistence fails", async () => {
    await expect(db.transaction(async tx => {
      await setQuotationGroupArchived(tx, 1, true, 7);
      throw new Error("audit unavailable");
    })).rejects.toThrow("audit unavailable");
    expect((await pool.query("SELECT archived_at FROM quotation_groups WHERE id=1")).rows[0].archived_at).toBeNull();
    expect((await pool.query("SELECT archived_at FROM quotations WHERE id=10")).rows[0].archived_at).toBeNull();
    expect(await db.transaction(tx => setQuotationGroupArchived(tx, 99, true, 7))).toBeNull();
  });
});
