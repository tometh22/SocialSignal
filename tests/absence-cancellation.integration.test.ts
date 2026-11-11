import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { absencePeriods, guardAbsenceCancellation } from "../server/services/absence-cancellation";
import { transitionAbsence, businessDaysByYear } from "../shared/utils/absence";

describe("absence cancellation rules", () => {
  it("counts each year and excludes holidays without using elapsed 24-hour periods", () => {
    expect(absencePeriods("2026-12-30", "2027-01-05")).toEqual(["2026-12", "2027-01"]);
    expect(businessDaysByYear("2026-12-30", "2027-01-05", new Set(["2027-01-01"]))).toEqual({ 2026: 2, 2027: 2 });
    expect(() => absencePeriods("2026-02-30", "2026-03-01")).toThrow();
  });
  it("allows Operations cancellation only for live requests and preserves the owner's approval workflow", () => {
    for (const status of ["pending", "approved", "cancellation_requested"] as const) expect(transitionAbsence(status, "cancel_by_operations")).toBe("cancelled");
    expect(transitionAbsence("approved", "request_cancellation")).toBe("cancellation_requested");
    for (const status of ["cancelled", "rejected"] as const) expect(() => transitionAbsence(status, "cancel_by_operations")).toThrow();
    expect(() => transitionAbsence("approved", "cancel_pending")).toThrow();
  });
});

const url = process.env.ABSENCE_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Absence tests require an isolated local database");
const schema = `absence_cancel_${process.pid}`;
const pool = new Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 4 });
const db = drizzle(pool);
describe.skipIf(!url)("absence cancellation / PostgreSQL period guards", () => {
  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE financial_close_periods(period_key text PRIMARY KEY, status text);
      CREATE TABLE payroll_periods(period text PRIMARY KEY, state text);
      CREATE TABLE personnel_monthly_settlements(personnel_id integer, period text, status text);`);
  });
  beforeEach(async () => { await pool.query("TRUNCATE financial_close_periods,payroll_periods,personnel_monthly_settlements"); });
  afterAll(async () => { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });
  const cancel = () => db.transaction(tx => guardAbsenceCancellation(tx, 1, "2026-12-30", "2027-01-05"));
  it.each(["CLOSED", "IN_REVIEW"])("blocks %s even in the second month and leaves its state untouched", async status => {
    await pool.query("INSERT INTO financial_close_periods VALUES('2027-01',$1)", [status]);
    await expect(cancel()).rejects.toMatchObject({ status: 409 });
    expect((await pool.query("SELECT status FROM financial_close_periods")).rows[0].status).toBe(status);
  });
  it("blocks a cut payroll and a published settlement but not someone else's settlement", async () => {
    await pool.query("INSERT INTO payroll_periods VALUES('2026-12','cut')");
    await expect(cancel()).rejects.toMatchObject({ status: 409 });
    await pool.query("DELETE FROM payroll_periods; INSERT INTO personnel_monthly_settlements VALUES(1,'2027-01','published')");
    await expect(cancel()).rejects.toMatchObject({ status: 409 });
    await pool.query("UPDATE personnel_monthly_settlements SET personnel_id=2");
    await expect(cancel()).resolves.toBeUndefined();
  });
  it("does not reopen a pre-close when no blocking close exists", async () => {
    await pool.query("INSERT INTO financial_close_periods VALUES('2027-01','PRE_CLOSE')");
    await expect(cancel()).resolves.toBeUndefined();
    expect((await pool.query("SELECT status FROM financial_close_periods")).rows[0].status).toBe("PRE_CLOSE");
  });
  it("serializes against a concurrent financial close, observing its committed status", async () => {
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN; SELECT pg_advisory_xact_lock(hashtext('financial-period:2027-01')); INSERT INTO financial_close_periods VALUES('2027-01','CLOSED')");
      const result = cancel().then(() => null, error => error);
      await connection.query("COMMIT");
      expect(await result).toMatchObject({ status: 409 });
    } finally { await connection.query("ROLLBACK"); connection.release(); }
  });
});
