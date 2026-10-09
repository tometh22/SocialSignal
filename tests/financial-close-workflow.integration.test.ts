import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const setup = vi.hoisted(() => ({
  url: process.env.FINANCIAL_TEST_DATABASE_URL,
  schema: `financial_workflow_test_${process.pid}`,
}));
if (setup.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(setup.url).hostname)) {
  throw new Error("Financial integration tests require a local test database.");
}
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: setup.url, options: `-c search_path=${setup.schema}`, max: 3 });
  return { pool, db: drizzle(pool) };
});
// This suite exercises the real SQL checklist and state transitions. Labor and
// aggregate builders have separate coverage and are not run against this fixture.
vi.mock("../server/etl/time-entries-to-fact-labor", () => ({
  getCutoverDate: vi.fn(async () => "2026-08"),
  buildFactLaborInTransaction: vi.fn(async () => ({})),
}));
vi.mock("../server/services/financial-native-builders", () => ({ rebuildNativeFinancialFacts: vi.fn(async () => {}) }));
import { pool } from "../server/db";
import { closeFinancialPeriod, requestFinancialCloseReview, returnFinancialCloseForCorrection, runFinancialPreClose } from "../server/services/financial-close";

let admin: Client;
const period = "2026-10";
const query = (text: string, values?: unknown[]) => pool.query(text, values);
const status = async () => (await query("SELECT status FROM financial_close_periods WHERE period_key=$1", [period])).rows[0]?.status;

describe.skipIf(!setup.url)("financial close checklist and review in PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: setup.url }); await admin.connect();
    await admin.query(`CREATE SCHEMA ${setup.schema}`);
    await query(`
      CREATE TABLE users(id integer PRIMARY KEY);
      INSERT INTO users VALUES (1);
      CREATE TABLE exchange_rates(id serial PRIMARY KEY,year int,month int,rate numeric,rate_type text,is_active boolean,updated_at timestamp);
      CREATE TABLE financial_accounts(is_active boolean,opening_balance_date date);
      CREATE TABLE system_config(config_key text,config_value numeric,description text);
      CREATE TABLE fact_labor_month(period_key text,source_row_id text,asana_hours numeric,cost_usd numeric,flags jsonb,person_id int);
      CREATE TABLE income_sot(month_key text);
      CREATE TABLE revenue_events(invoice_period text,status text);
      CREATE TABLE activo_entries(source text DEFAULT 'mind',period_key text,voided_at timestamp,monto_total_usd numeric,monto_usd numeric,monto_ars numeric,cotizacion numeric);
      CREATE TABLE pasivo_entries(LIKE activo_entries);
      CREATE TABLE cashflow_transactions(source text DEFAULT 'mind',period_key text,voided_at timestamp,monto_usd numeric,monto_ars numeric,cotizacion numeric,reconciliation_status text,transfer_group_id text,tipo_movimiento text);
      CREATE TABLE provision_entries(period_key text,status text,import_batch text);
      CREATE TABLE personnel_monthly_settlements(personnel_id int,period text,status text,billing_currency_snapshot text);
      CREATE TABLE personal_monthly_invoices(period text,approval_status text,declared_invoice_amount numeric);
      INSERT INTO financial_accounts VALUES(true,'2026-08-01');
      INSERT INTO exchange_rates(year,month,rate,rate_type,is_active,updated_at) VALUES(2026,10,1500,'end_of_month',true,now());
    `);
    await query(readFileSync("migrations/0058_financial_native_intake.sql", "utf8"));
  });
  beforeEach(async () => {
    await query("TRUNCATE financial_audit_events,financial_close_checks,financial_close_periods,financial_intake_items,fact_labor_month,system_config,cashflow_transactions RESTART IDENTITY CASCADE");
  });
  afterAll(async () => {
    await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${setup.schema} CASCADE`); await admin.end(); }
  });

  it("blocks review while Operations still has incomplete costs", async () => {
    await query("INSERT INTO fact_labor_month VALUES($1,'app_1',2,10,'[\"partial_cost\",\"missing_rate\"]',1)", [period]);
    await runFinancialPreClose(period, 1);
    expect((await query("SELECT status FROM financial_close_checks WHERE code='labor_costs_complete'")).rows[0].status).toBe("failed");
    await expect(requestFinancialCloseReview(period, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(await status()).toBe("PRE_CLOSE");
    await query("UPDATE fact_labor_month SET flags='[]'");
    await runFinancialPreClose(period, 1);
    await requestFinancialCloseReview(period, 1);
    expect(await status()).toBe("IN_REVIEW");
  });

  it("returns review to editable state with an audited reason and requires a new pre-close", async () => {
    await runFinancialPreClose(period, 1); await requestFinancialCloseReview(period, 1);
    await returnFinancialCloseForCorrection(period, 1, "Corregir factura del proveedor");
    expect(await status()).toBe("OPEN");
    const audit = (await query("SELECT action,actor_user_id,reason FROM financial_audit_events WHERE action='returned_for_correction'")).rows[0];
    expect(audit).toEqual({ action: "returned_for_correction", actor_user_id: 1, reason: "Corregir factura del proveedor" });
    await expect(requestFinancialCloseReview(period, 1)).rejects.toMatchObject({ statusCode: 409 });
    await expect(closeFinancialPeriod(period, 1)).rejects.toMatchObject({ statusCode: 409 });
    await runFinancialPreClose(period, 1); await requestFinancialCloseReview(period, 1);
    expect(await status()).toBe("IN_REVIEW");
  });

  it("does not let the correction action reopen a closed period", async () => {
    await expect(returnFinancialCloseForCorrection(period, 1, "x")).rejects.toMatchObject({ statusCode: 400 });
    await query("INSERT INTO financial_close_periods(period_key,status) VALUES($1,'CLOSED')", [period]);
    await expect(returnFinancialCloseForCorrection(period, 1, "Intento de reapertura")).rejects.toMatchObject({ statusCode: 409 });
    expect(await status()).toBe("CLOSED");
  });

  it("serializes duplicate correction requests", async () => {
    await runFinancialPreClose(period, 1); await requestFinancialCloseReview(period, 1);
    const results = await Promise.allSettled([
      returnFinancialCloseForCorrection(period, 1, "Primera devolución"),
      returnFinancialCloseForCorrection(period, 1, "Segunda devolución"),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await query("SELECT count(*)::int n FROM financial_audit_events WHERE action='returned_for_correction'")).rows[0].n).toBe(1);
  });

  it("rechecks late intake before freezing a period with a previously clean checklist", async () => {
    await runFinancialPreClose(period, 1); await requestFinancialCloseReview(period, 1);
    await query("INSERT INTO financial_intake_items(input_kind,status,created_by,extracted_data) VALUES('text','needs_review',1,$1::jsonb)", [JSON.stringify({ periodKey: period })]);
    await expect(closeFinancialPeriod(period, 1)).rejects.toThrow("Bandeja del período procesada");
    expect(await status()).toBe("IN_REVIEW");
  });

  it("detects a pending statement by its dated lines even without a document period", async () => {
    await query("INSERT INTO financial_intake_items(input_kind,status,created_by,extracted_data) VALUES('file','needs_review',1,$1::jsonb)", [JSON.stringify({ periodKey: null, lineItems: [{ date: '2026-10-15' }] })]);
    await runFinancialPreClose(period, 1);
    expect((await query("SELECT status FROM financial_close_checks WHERE code='intake_queue_empty'")).rows[0].status).toBe("failed");
    await expect(requestFinancialCloseReview(period, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not reuse an accepted exception when its evidence changes", async () => {
    await query("INSERT INTO cashflow_transactions(period_key,monto_usd,reconciliation_status) VALUES($1,10,'unmatched')", [period]);
    await runFinancialPreClose(period, 1);
    await query("UPDATE financial_close_checks SET status='accepted',resolution='Revisado por Finanzas' WHERE code='cashflow_reconciled'");
    await runFinancialPreClose(period, 1);
    expect((await query("SELECT status FROM financial_close_checks WHERE code='cashflow_reconciled'")).rows[0].status).toBe("accepted");
    await query("INSERT INTO cashflow_transactions(period_key,monto_usd,reconciliation_status) VALUES($1,20,'unmatched')", [period]);
    await runFinancialPreClose(period, 1);
    expect((await query("SELECT status,resolution FROM financial_close_checks WHERE code='cashflow_reconciled'")).rows[0]).toEqual({ status: "failed", resolution: null });
  });
});
