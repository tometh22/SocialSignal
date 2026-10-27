import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL, eq } from "drizzle-orm";
import { quotations, insertQuotationSchema } from "../shared/schema";
import { validatePricingSnapshot } from "../server/services/quotation-pricing-snapshot";
import { createDefaultCreditProgram } from "../shared/utils/credit-program";
import { creditProgramMigrationSql } from "../server/migrations/credit-program";

const url = process.env.FINANCIAL_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Only a local test database is allowed");
const namespace = `credit_approval_test_${process.pid}`;
let client: Client;
const base = { clientId: 1, projectName: "QA legado", projectType: "on-demand", analysisType: "standard", mentionsVolume: "medium", countriesCovered: "1", clientEngagement: "medium", baseCost: 100, complexityAdjustment: 0, markupAmount: 100, totalAmount: 200, toolsCost: 50, pricingVersion: 2, exchangeRateAtQuote: "1500", quotationCurrency: "USD", status: "draft" };

describe.skipIf(!url)("quotation credit compatibility with PostgreSQL", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: url }); await client.connect();
    await client.query(`CREATE SCHEMA ${namespace}; SET search_path TO ${namespace}`);
    const dialect = new PgDialect();
    const columns = getTableConfig(quotations).columns.map(c => {
      const v = c.default;
      const d = v instanceof SQL ? dialect.sqlToQuery(v).sql : v === undefined ? undefined : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${(typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll("'", "''")}'`;
      return `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}${d ? " DEFAULT " + d : ""}`;
    });
    await client.query(`CREATE TABLE quotations (${columns.join(",")})`);
  });
  afterAll(async () => { if (client) { await client.query(`DROP SCHEMA ${namespace} CASCADE`); await client.end(); } });
  it("reads a legacy empty program through Drizzle and validates its commercial snapshot", async () => {
    const db = drizzle(client);
    const [saved] = await db.insert(quotations).values({ ...base, creditProgram: {} as any }).returning();
    const [persisted] = await db.select().from(quotations).where(eq(quotations.id, saved.id));
    const parsed = insertQuotationSchema.parse(persisted);
    expect(parsed.creditProgram).toBeNull();
    expect(() => validatePricingSnapshot(parsed)).not.toThrow();
    expect((await db.select().from(quotations).where(eq(quotations.id, saved.id)))[0].creditProgram).toEqual({});
  });
  it("repeated startup migration preserves NULL, legacy {}, and actual credit terms", async () => {
    const db = drizzle(client);
    const program = { ...createDefaultCreditProgram(new Date("2026-10-01T12:00:00Z")), enabled: true };
    await db.insert(quotations).values([{ ...base, creditProgram: null }, { ...base, projectType: "credit-pack", creditProgram: program }]);
    const before = (await client.query("SELECT to_jsonb(q) data FROM quotations q ORDER BY id")).rows;
    await client.query(creditProgramMigrationSql);
    await client.query(readFileSync("migrations/0056_quotation_credit_program.sql", "utf8"));
    expect((await client.query("SELECT to_jsonb(q) data FROM quotations q ORDER BY id")).rows).toEqual(before);
  });
});
