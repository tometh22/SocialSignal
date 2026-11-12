import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { tasks } from "../shared/schema";
import { personalTaskAfter, personalTaskOrder, taskBucketSql } from "../server/domain/task-list";
import { cursorPage } from "../server/utils/pagination";

const databaseUrl = process.env.TASK_LIST_TEST_DATABASE_URL;
if (databaseUrl && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Task ordering tests require a local test database");
}

describe.skipIf(!databaseUrl)("personal task deadline pagination", () => {
  const client = new Client({ connectionString: databaseUrl });
  const db = drizzle(client);
  beforeAll(async () => {
    await client.connect();
    // Connection-local table; no application data or shared schema is modified.
    await client.query("CREATE TEMP TABLE tasks (id integer PRIMARY KEY, status text, start_date timestamp, due_date timestamp)");
  });
  beforeEach(async () => { await client.query("TRUNCATE tasks"); });
  afterAll(async () => { await client.end(); });

  const page = async (beforeId?: number, limit = 2, bucket = "in_progress") => {
    const rows = await db.select({ id: tasks.id, dueDate: tasks.dueDate }).from(tasks)
      .where(and(eq(taskBucketSql("2026-11-06"), bucket), beforeId ? personalTaskAfter(beforeId) : undefined))
      .orderBy(...personalTaskOrder()).limit(limit + 1);
    return cursorPage(rows, limit);
  };

  it("puts the soonest deadlines first, regardless of creation or start date, and continues through ties and nulls", async () => {
    await client.query(`INSERT INTO tasks VALUES
      (1,'in_progress','2026-11-02','2026-11-06'),
      (2,'in_progress','2026-11-02','2026-11-16'),
      (3,'in_progress','2026-11-04','2026-11-30'),
      (4,'in_progress','2026-11-05','2027-01-31'),
      (5,'in_progress','2026-11-03','2026-11-06'),
      (6,'in_progress','2026-11-02',NULL),
      (7,'in_progress','2026-11-02',NULL),
      (8,'done','2026-11-02','2026-11-06')`);
    const ids: number[] = [];
    let cursor: number | undefined;
    do {
      const result = await page(cursor);
      ids.push(...result.items.map(task => task.id));
      cursor = result.nextCursor ?? undefined;
    } while (cursor);
    expect(ids).toEqual([5, 1, 2, 3, 4, 7, 6]);
  });

  it("finds an urgent old task on the first page even with more than 100 newer tasks", async () => {
    await client.query(`INSERT INTO tasks SELECT id,'in_progress','2026-11-01'::timestamp,
      CASE WHEN id=1 THEN '2026-11-06'::timestamp ELSE '2027-01-31'::timestamp END
      FROM generate_series(1,205) id`);
    const first = await page(undefined, 100);
    expect(first.items[0].id).toBe(1);
    const second = await page(first.nextCursor!, 100);
    const third = await page(second.nextCursor!, 100);
    const ids = [...first.items, ...second.items, ...third.items].map(task => task.id);
    expect(ids).toHaveLength(205);
    expect(new Set(ids).size).toBe(205);
    expect(third.nextCursor).toBeNull();
  });

  it("continues undated pages and orders overdue and upcoming buckets by deadline", async () => {
    await client.query(`INSERT INTO tasks VALUES
      (1,'todo',NULL,NULL),(2,'todo',NULL,NULL),(3,'todo',NULL,NULL),
      (4,'todo','2026-11-01','2026-11-02'),(5,'todo','2026-11-01','2026-11-05'),
      (6,'todo','2026-11-07','2026-11-08'),(7,'todo','2026-11-07','2026-12-01')`);
    const first = await page(undefined, 2, "no_date");
    expect(first.items.map(task => task.id)).toEqual([3, 2]);
    expect((await page(first.nextCursor!, 2, "no_date")).items.map(task => task.id)).toEqual([1]);
    expect((await page(undefined, 2, "overdue")).items.map(task => task.id)).toEqual([4, 5]);
    expect((await page(undefined, 2, "upcoming")).items.map(task => task.id)).toEqual([6, 7]);
  });
});
