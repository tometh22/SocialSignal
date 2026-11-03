import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { NATIVE_DASHBOARD_SQL } from "../server/domain/financial-dashboard-query";

const url = process.env.FINANCIAL_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw Error("Use a local test database");
describe.skipIf(!url)("financial dashboard SQL preserves balances while removing correlated ledger scans", () => {
  let client: Client;
  const schema = `perf_dashboard_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    client = new Client({ connectionString: url }); await client.connect();
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE revenue_events(invoice_period text,status text,amount_usd numeric);
      CREATE TABLE activo_entries(period_key text,voided_at timestamp,currency text,monto_usd numeric,outstanding_amount numeric,cotizacion numeric);
      CREATE TABLE pasivo_entries(LIKE activo_entries);
      CREATE TABLE cashflow_transactions(period_key text,voided_at timestamp,monto_usd numeric,monto_ars numeric,cotizacion numeric,source text,tipo_movimiento text,transfer_group_id text);
      CREATE TABLE fact_cost_month(period_key text,direct_usd numeric,indirect_usd numeric,provisions_usd numeric);
      CREATE TABLE fact_labor_month(period_key text,cost_usd numeric);
      CREATE TABLE provision_entries(period_key text,status text,currency text,remaining_amount numeric,monto_provision numeric);
      CREATE TABLE financial_accounts(currency text,opening_balance numeric,opening_balance_date date,is_active boolean);
      CREATE TABLE financial_close_periods(period_key text,status text);
      CREATE TABLE exchange_rates(id serial,year int,month int,rate numeric,is_active boolean,rate_type text,updated_at timestamp DEFAULT now());
      INSERT INTO revenue_events VALUES ('2026-01','active',100),('2026-01','cancelled',999),('2026-02','active',200);
      INSERT INTO activo_entries VALUES ('2026-01',NULL,'USD',100,100,1),('2026-02',NULL,'ARS',NULL,2000,1000),('2026-01',now(),'USD',999,999,1);
      INSERT INTO pasivo_entries VALUES ('2026-01',NULL,'ARS',NULL,1000,1000);
      INSERT INTO fact_cost_month VALUES ('2026-01',10,5,2),('2026-02',20,6,3),('2026-03',0,0,0);
      INSERT INTO fact_labor_month VALUES ('2026-01',4),('2026-01',6);
      INSERT INTO provision_entries VALUES ('2025-12','ACTIVE','ARS',1000,2000),('2026-01','APPROVED','USD',500,500),('2026-01','REJECTED','USD',999,999);
      INSERT INTO exchange_rates(year,month,rate,is_active,rate_type) VALUES (2026,1,1000,true,'end_of_month'),(2026,2,2000,true,'end_of_month'),(2026,2,999,true,'average');
      INSERT INTO financial_accounts VALUES ('ARS',1000,NULL,true),('USD',5,NULL,true),('USD',7,'2026-03-01',true),('USD',999,NULL,false);
      INSERT INTO financial_close_periods VALUES ('2026-01','CLOSED');
      INSERT INTO cashflow_transactions VALUES ('2026-01',NULL,100,NULL,1,'native','Ingreso',NULL),('2026-02',NULL,20,NULL,1,'native','Egreso',NULL),('2026-02',NULL,99,NULL,1,'excel','Ingreso',NULL),('2026-02',NULL,999,NULL,1,'native','Ingreso','internal');
    `);
  });
  afterAll(async () => { await client?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client?.end(); });
  it("matches the previous query, including FX precedence, voids, closed months and provision-only history", async () => {
    const reference = readFileSync(new URL("./fixtures/dashboard-before-performance.sql", import.meta.url), "utf8");
    const before = (await client.query(reference)).rows;
    const after = (await client.query(NATIVE_DASHBOARD_SQL)).rows;
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({ period_key: "2026-01", facturacion_total: 100, costos_directos_operativos: 10, provision_liability: 501, opening_cash: 6, is_closed: true });
    expect(after[1]).toMatchObject({ period_key: "2026-02", cuentas_cobrar_usd: 102, cuentas_pagar_usd: 1, provision_liability: 500.5, opening_cash: 5.5, cumulative_cashflow: 80, cashflow_neto: 79 });
    expect(after[2]).toMatchObject({ period_key: "2026-03", opening_cash: 12, provision_liability: 500 });
  });
});
