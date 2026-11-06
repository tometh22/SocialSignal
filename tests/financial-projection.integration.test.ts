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
import { getFinancialScenario } from "../server/services/financial-scenario";
import { calculateFinancialScenario } from "../shared/financial-scenario";

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
        costos_indirectos numeric, ebit_operativo numeric, cierre_date timestamp,
        beneficio_neto numeric, margen_neto numeric
      );
      CREATE TABLE fact_cost_month (period_key text PRIMARY KEY, direct_usd numeric, indirect_usd numeric, provisions_usd numeric);
      CREATE TABLE fact_estimated_cost_month (month_key text, monto_total_usd numeric, id serial, detalle text, subtipo_costo text, puesto text);
      CREATE TABLE pasivo_entries (
        id serial PRIMARY KEY, period_key text, detalle text, concepto text, descripcion text, vendor_name text,
        subtipo_costo text, fecha_emision timestamp, source text DEFAULT 'excel', cost_treatment text DEFAULT 'unclassified',
        net_amount numeric, currency text, cotizacion numeric, monto_total_usd numeric, monto_usd numeric, monto_ars numeric, voided_at timestamp
      );
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
      fact_cost_month, fact_estimated_cost_month, revenue_events, pasivo_entries`);
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

  it("keeps the full imported annual base even when an operational cutover is configured", async () => {
    await pool.query(`
      INSERT INTO system_config VALUES ('app_mode_cutover_date', '2026-08');
      INSERT INTO monthly_financial_summary (period_key, facturacion_total, ebit_operativo)
        SELECT '2026-' || lpad(month::text, 2, '0'), month * 1000 + 0.12, month * 100
        FROM generate_series(1, 12) month;
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.facturacion.total).toBe(78001.44);
    expect(result.meses.map(month => month.fuenteFacturacion)).toEqual(Array(12).fill('master'));
    expect(result.meses[7].facturacion).toBe(8000.12);
    expect(result.meses[11].facturacion).toBe(12000.12);
  });

  it("replaces only months with native revenue and retains later months of the annual base", async () => {
    await pool.query(`
      INSERT INTO system_config VALUES ('app_mode_cutover_date', '2026-08');
      INSERT INTO monthly_financial_summary VALUES
        ('2026-07', 10000, NULL, NULL, 5000, '2026-07-31'),
        ('2026-08', 999999, NULL, NULL, 999999, '2026-08-31'),
        ('2026-09', 6500, NULL, NULL, 1500, NULL);
      INSERT INTO revenue_events (invoice_period, amount_usd, delivery_start, delivery_end, delivery_curve)
        VALUES ('2026-08', 12000, '2026-08', '2027-07', 'linear');
      INSERT INTO revenue_events (invoice_period, amount_usd, confirmed, probability)
        VALUES ('2026-08', 4000, false, 25);
      INSERT INTO revenue_events (invoice_period, amount_usd, status)
        VALUES ('2026-08', 999999, 'cancelled');
      INSERT INTO fact_cost_month VALUES ('2026-08', 2000, 500);
    `);
    const result = await getNativeProjectionSummary(2026);
    expect(result.facturacion).toEqual({ ejecutado: 10000, proyectado: 19500, total: 29500 });
    expect(result.meses[7]).toMatchObject({ cierre: false, fuenteFacturacion: 'mind', facturacion: 13000, costos: 2500, resultado: 10500 });
    expect(result.meses[8]).toMatchObject({ fuenteFacturacion: 'master', facturacion: 6500, costos: 5000, resultado: 1500 });
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
    expect(result.meses[0]).toMatchObject({ cierre: true, fuenteFacturacion: 'cierre', facturacion: 10000, costos: 10000, resultado: 0 });
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

  it("loads annual scenario detail without adding card estimates, voids or balance-only documents", async () => {
    await pool.query(`
      INSERT INTO system_config VALUES ('app_mode_cutover_date','2026-01');
      INSERT INTO monthly_financial_summary (period_key,facturacion_total,ebit_operativo,beneficio_neto,margen_neto) VALUES
        ('2026-01',1000,400,250,25), ('2026-02',100,100,100,100), ('2026-11',1000,400,1000,100);
      INSERT INTO fact_estimated_cost_month (month_key,monto_total_usd,detalle,subtipo_costo) VALUES
        ('2026-01',200,'Tarjeta USA','Tarjeta'), ('2026-11',200,'Tarjeta USA','Tarjeta');
      INSERT INTO pasivo_entries (period_key,detalle,concepto,subtipo_costo,monto_total_usd,fecha_emision) VALUES
        ('2026-01','Tarjeta USA','REPLIT PURCHASE','Tarjeta',100,'2026-01-15');
      INSERT INTO pasivo_entries (period_key,detalle,monto_total_usd,voided_at) VALUES ('2026-01','Void',999,now());
      INSERT INTO pasivo_entries (period_key,detalle,monto_total_usd,cost_treatment) VALUES ('2026-01','Balance',999,'balance_only');
    `);
    const data = await getFinancialScenario(2026);
    expect(data.costs).toHaveLength(2);
    expect(data.costs[0]).toMatchObject({ description: 'REPLIT PURCHASE', amountUsd: 100, source: 'ledger', date: '2026-01-15' });
    expect(data.costs[1]).toMatchObject({ source: 'estimate', periodKey: '2026-11', amountUsd: 200 });
    const result = calculateFinancialScenario(data, data.costs.map(cost => cost.id));
    expect(result.excludedUsd).toBe(300);
    expect(result.baseNetProfitUsd).toBe(350);
    expect(result.adjustedNetProfitUsd).toBe(450);
    expect(result.netMonthCount).toBe(2);
    expect(result.months[1].netProfitUsd).toBe(100);
    expect(result.months[10].adjustedNetProfitUsd).toBeNull();
  });

  it("uses net invoice amounts and period provisions for native months; missing FX stays unknown", async () => {
    await pool.query(`
      INSERT INTO revenue_events (invoice_period,amount_usd) VALUES ('2026-06',1000);
      INSERT INTO fact_cost_month VALUES ('2026-06',600,100,50);
      INSERT INTO pasivo_entries (period_key,detalle,concepto,source,cost_treatment,net_amount,currency,cotizacion,monto_total_usd) VALUES
        ('2026-06','OpenAI','API','mind_intake','indirect',200,'ARS',2,121),
        ('2026-06','Neon','DB','mind_intake','indirect',200,'ARS',NULL,121);
    `);
    const data = await getFinancialScenario(2026);
    expect(data.months[5].netProfitUsd).toBe(250);
    const openai = data.costs.find(cost => cost.concept === 'OpenAI')!;
    expect(openai.amountUsd).toBe(100);
    expect(data.costs.find(cost => cost.concept === 'Neon')?.amountUsd).toBeNull();
    expect(calculateFinancialScenario(data, data.costs.map(cost => cost.id))).toMatchObject({
      excludedUsd: 100, adjustedCostUsd: 600, adjustedEbitUsd: 400, adjustedNetProfitUsd: 350,
    });
  });
});
