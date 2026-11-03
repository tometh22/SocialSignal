import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { financialIntakeItems } from "../shared/schema";
const setup = vi.hoisted(() => ({ url: process.env.FINANCIAL_TEST_DATABASE_URL, schema: `intake_queue_${process.pid}` }));
if (setup.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(setup.url).hostname)) throw Error("Use a local test database");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg"), { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: setup.url, options: `-c search_path=${setup.schema}`, max: 3 });
  return { pool, db: drizzle(pool) };
});
vi.mock("../server/services/financial-intake-extractor", async importOriginal => {
  const actual = await importOriginal<typeof import("../server/services/financial-intake-extractor")>();
  return { ...actual, extractFinancialIntake: vi.fn(async (input: { text: string }) => actual.extractFinancialTextHeuristically(input.text)) };
});
import { pool } from "../server/db";
import { processFinancialIntakeQueue } from "../server/services/financial-intake-queue";
import { extractFinancialIntake, extractFinancialTextHeuristically } from "../server/services/financial-intake-extractor";

describe.skipIf(!setup.url)("durable financial extraction queue", () => {
  let admin: Client;
  beforeAll(async () => {
    admin = new Client({ connectionString: setup.url }); await admin.connect();
    await admin.query(`CREATE SCHEMA ${setup.schema}`);
    const columns = getTableConfig(financialIntakeItems).columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`);
    await pool.query(`CREATE TABLE financial_intake_items (${columns.join(",")})`);
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await pool.query("TRUNCATE financial_intake_items");
    await pool.query("INSERT INTO financial_intake_items(id,input_kind,original_text,status,updated_at) VALUES (1,'text','Factura cliente USD 100 el 03/11/2026','received',now())");
  });
  afterAll(async () => { await pool.end(); await admin?.query(`DROP SCHEMA ${setup.schema} CASCADE`); await admin?.end(); });
  it("claims once and persists a reviewable result without timestamp/timezone round trips", async () => {
    await Promise.all([processFinancialIntakeQueue(), processFinancialIntakeQueue()]);
    expect(extractFinancialIntake).toHaveBeenCalledTimes(1);
    expect((await pool.query("SELECT status,extracted_data->>'totalAmount' amount FROM financial_intake_items")).rows[0]).toEqual({ status: "needs_review", amount: "100" });
  });
  it("does not overwrite a rejection performed while extraction is running", async () => {
    vi.mocked(extractFinancialIntake).mockImplementationOnce(async () => {
      await pool.query("UPDATE financial_intake_items SET status='rejected',updated_at=now() WHERE id=1");
      return extractFinancialTextHeuristically("Factura cliente USD 100");
    });
    await processFinancialIntakeQueue();
    expect((await pool.query("SELECT status FROM financial_intake_items")).rows[0].status).toBe("rejected");
  });
  it("reclaims an abandoned lease after a worker crash", async () => {
    await pool.query("UPDATE financial_intake_items SET status='processing',updated_at=now()-interval '16 minutes'");
    await processFinancialIntakeQueue();
    expect((await pool.query("SELECT status FROM financial_intake_items")).rows[0].status).toBe("needs_review");
  });
});
