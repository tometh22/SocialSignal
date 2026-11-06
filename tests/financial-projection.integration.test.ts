import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

const setup = vi.hoisted(() => ({
  url: process.env.FINANCIAL_TEST_DATABASE_URL,
  schema: `financial_projection_${process.pid}`,
}));
if (setup.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(setup.url).hostname)) {
  throw Error("Use a local test database");
}
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg");
  return { pool: new Pool({ connectionString: setup.url, options: `-c search_path=${setup.schema}`, max: 3 }) };
});

import { pool } from "../server/db";
import { getNativeProjectionSummary } from "../server/services/financial-native-dashboard";

describe.skipIf(!setup.url)("financial projection sources", () => {
  let admin: Client;
  beforeAll(async () => {
    admin = new Client({ connectionString: setup.url });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${setup.schema}`);
    await pool.query(`
      CREATE TABLE system_config (config_key text PRIMARY KEY, description text);
      CREATE TABLE financial_close_periods (period_key text PRIMARY KEY, status text);
      CREATE TABLE monthly_financial_summary (
        period_key text PRIMARY KEY, facturacion_total numeric, costos_directos numeric,
        costos_indirectos numeric, ebit_operativo numeric, cierre_date timestamp
      );
      CREATE TABLE fact_cost_month (period_key text PRIMARY KEY, direct_usd numeric, indirect_usd numeric);
      CREATE TABLE fact_estimated_cost_month (month_key text, monto_total_usd numeric);
      CREATE TABLE revenue_events (
        id serial PRIMARY KEY, client_name text DEFAULT 'Cliente', project_name text, project_id integer,
        amount_usd numeric, invoice_period text, delivery_start text, delivery_end text,
        delivery_curve text, collection_period_expected text, collection_period_actual text,
        payment_terms_days integer, confirmed boolean DEFAULT true, probability numeric,
        status text DEFAULT 'active', is_estimate boolean DEFAULT false, source_tab text DEFAULT 'mind_intake'
      );
    `);
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE system_config, financial_close_periods, monthly_financial_summary,
      fact_cost_month, fact_estimated_cost_month, revenue_events`);
  });
  afterAll(async () => {
    await pool.end();
    await admin?.query(`DROP SCHEMA ${setup.schema} CASCADE`);
    await admin?.end();
  });

  it("recovers imported revenue and closures when there are no native events", async () => {
    await pool.query(`
      INSERT INTO monthly_financial_summary VALUES
        ('2026-01', 50000, 29000, 2000, 20000, '2026-01-31'),
        ('2026-02', 60000, NULL, NULL, 25000, NULL),
        ('2025-01', 999999, NULL, NULL, 999999, NULL);
      INSERT INTO fact_estimated_cost_month VALUES ('2026-01', 45000), ('2026-02', 46000);
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.facturacion).toEqual({ ejecutado: 50000, proyectado: 60000, total: 110000 });
    expect(result.costos).toEqual({ ejecutado: 30000, proyectado: 35000, total: 65000 });
    expect(result.resultado).toEqual({ ejecutado: 20000, proyectado: 25000, total: 45000 });
    expect(result.mesesCerrados).toBe(1);
    expect(result.mesesProyectados).toBe(11);
    expect(result.meses).toHaveLength(12);
    expect(result.meses[0]).toMatchObject({ month: 1, monthLabel: '01 ene', cierre: true });
  });

  it("keeps history before cutover and uses invoicing, including weighted pipeline, from cutover onward", async () => {
    await pool.query(`
      INSERT INTO system_config VALUES ('app_mode_cutover_date', '2026-08');
      INSERT INTO monthly_financial_summary VALUES
        ('2026-07', 10000, NULL, NULL, 5000, '2026-07-31'),
        ('2026-08', 999999, NULL, NULL, 999999, '2026-08-31'),
        ('2026-09', 999999, NULL, NULL, 999999, NULL);
      INSERT INTO revenue_events (invoice_period, amount_usd, delivery_start, delivery_end, delivery_curve)
        VALUES ('2026-08', 12000, '2026-08', '2027-07', 'linear');
      INSERT INTO revenue_events (invoice_period, amount_usd, confirmed, probability)
        VALUES ('2026-08', 4000, false, 25);
      INSERT INTO revenue_events (invoice_period, amount_usd, status)
        VALUES ('2026-08', 999999, 'cancelled');
      INSERT INTO fact_cost_month VALUES ('2026-08', 2000, 500);
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.facturacion).toEqual({ ejecutado: 10000, proyectado: 13000, total: 23000 });
    expect(result.meses[7]).toMatchObject({ cierre: false, facturacion: 13000, costos: 2500, resultado: 10500 });
    expect(result.meses[8].facturacion).toBe(0);
  });

  it("does not add historical totals to imported events or revive history after native cancellation", async () => {
    await pool.query(`
      INSERT INTO monthly_financial_summary VALUES
        ('2026-01', 10000, NULL, NULL, 5000, NULL),
        ('2026-02', 20000, NULL, NULL, 10000, NULL),
        ('2026-03', 30000, NULL, NULL, 15000, NULL);
      INSERT INTO revenue_events (invoice_period, amount_usd, source_tab, status) VALUES
        ('2026-01', 10000, 'excel', 'active'),
        ('2026-02', 25000, 'mind_intake', 'active'),
        ('2026-03', 30000, 'mind_intake', 'cancelled');
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.meses.slice(0, 3).map(month => month.facturacion)).toEqual([10000, 25000, 0]);
    expect(result.facturacion.total).toBe(35000);
  });

  it("preserves closed snapshots including zero EBIT and stops using them when reopened", async () => {
    await pool.query(`
      INSERT INTO system_config VALUES ('app_mode_cutover_date', '2026-01');
      INSERT INTO financial_close_periods VALUES ('2026-01', 'CLOSED'), ('2026-02', 'OPEN');
      INSERT INTO monthly_financial_summary VALUES
        ('2026-01', 10000, 7000, 500, 0, '2026-01-31'),
        ('2026-02', 999999, NULL, NULL, 999999, '2026-02-28');
      INSERT INTO revenue_events (invoice_period, amount_usd) VALUES ('2026-01', 999999), ('2026-02', 2000);
      INSERT INTO fact_cost_month VALUES ('2026-02', 1000, 500);
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.meses[0]).toMatchObject({ cierre: true, facturacion: 10000, costos: 10000, resultado: 0 });
    expect(result.meses[1]).toMatchObject({ cierre: false, facturacion: 2000, costos: 1500, resultado: 500 });
    expect(result.facturacion).toEqual({ ejecutado: 10000, proyectado: 2000, total: 12000 });
  });

  it("does not turn a missing closed snapshot into zero revenue", async () => {
    await pool.query(`
      INSERT INTO financial_close_periods VALUES ('2026-01', 'CLOSED');
      INSERT INTO revenue_events (invoice_period, amount_usd) VALUES ('2026-01', 2500);
      INSERT INTO fact_cost_month VALUES ('2026-01', 500, 100);
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.meses[0]).toMatchObject({ cierre: true, facturacion: 2500, costos: 600, resultado: 1900 });
  });
});
