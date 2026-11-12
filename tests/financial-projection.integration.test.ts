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
import { getNativeProjectionSummary, fetchNativeExecutiveDashboard, invalidateNativeDashboard } from "../server/services/financial-native-dashboard";
import { getFinancialScenario } from "../server/services/financial-scenario";
vi.mock('../server/services/financial-master-scenario', async importOriginal => ({
  ...await importOriginal<typeof import('../server/services/financial-master-scenario')>(),
  getMasterScenarioSnapshot: vi.fn(),
}));
import { getMasterScenarioSnapshot } from '../server/services/financial-master-scenario';
import { dashboardSnapshot, dashboardRow, dashboardHeaders } from './fixtures/master-dashboard';
import { getFinancialProjection } from '../server/services/financial-projection';
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

      ALTER TABLE monthly_financial_summary ADD COLUMN year integer, ADD COLUMN month_number integer,
        ADD COLUMN month_label text, ADD COLUMN margen_operativo numeric, ADD COLUMN markup_promedio numeric,
        ADD COLUMN proyeccion_resultado numeric, ADD COLUMN caja_total numeric, ADD COLUMN inversiones numeric,
        ADD COLUMN cuentas_cobrar_usd numeric, ADD COLUMN total_activo numeric, ADD COLUMN impuestos_usa numeric,
        ADD COLUMN pasivo_facturacion_adelantada numeric, ADD COLUMN cuentas_pagar_usd numeric,
        ADD COLUMN total_pasivo numeric, ADD COLUMN balance_neto numeric, ADD COLUMN cashflow_neto numeric, ADD COLUMN balance_60_dias numeric;
      ALTER TABLE pasivo_entries ADD COLUMN outstanding_amount numeric;
      CREATE TABLE activo_entries (period_key text, voided_at timestamp, currency text, monto_usd numeric, outstanding_amount numeric, cotizacion numeric);
      CREATE TABLE cashflow_transactions (period_key text, voided_at timestamp, tipo_movimiento text, transfer_group_id text, monto_usd numeric, monto_ars numeric, cotizacion numeric, source text);
      CREATE TABLE provision_entries (period_key text, status text, currency text, remaining_amount numeric, monto_provision numeric);
      CREATE TABLE fact_labor_month (period_key text, cost_usd numeric);
      CREATE TABLE financial_accounts (currency text, opening_balance numeric, is_active boolean, opening_balance_date date);
      CREATE TABLE exchange_rates (year integer, month integer, is_active boolean, rate_type text, rate numeric, updated_at timestamp, id serial);
    `);
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE system_config, financial_close_periods, monthly_financial_summary,
      fact_cost_month, fact_estimated_cost_month, revenue_events, pasivo_entries, activo_entries, cashflow_transactions,
      provision_entries, fact_labor_month, financial_accounts, exchange_rates`);
    invalidateNativeDashboard();
    vi.mocked(getMasterScenarioSnapshot).mockReset();
  });
  afterAll(async () => {
    await pool.end();
    await admin?.query(`DROP SCHEMA ${setup.schema} CASCADE`);
    await admin?.end();
  });

  it("keeps Master totals and balances before and after cutover despite imported native ledger rows", async () => {
    vi.mocked(getMasterScenarioSnapshot).mockResolvedValue(dashboardSnapshot([dashboardRow(1), dashboardRow(8), dashboardRow(12)]));
    await pool.query(`
      INSERT INTO system_config VALUES ('app_mode_cutover_date','2026-08');
      INSERT INTO monthly_financial_summary (period_key,facturacion_total,ebit_operativo) VALUES
        ('2026-01',99999,99999), ('2026-08',99999,99999), ('2026-12',99999,99999);
      INSERT INTO fact_cost_month VALUES ('2026-01',9000,5000,2000), ('2026-08',9000,5000,2000);
      INSERT INTO activo_entries VALUES ('2026-01',NULL,'USD',99999,99999,1);
      INSERT INTO pasivo_entries (period_key,monto_usd,outstanding_amount) VALUES ('2026-01',99999,99999);
      INSERT INTO cashflow_transactions VALUES ('2026-01',NULL,'Egreso',NULL,99999,NULL,1,'excel');
      INSERT INTO revenue_events (invoice_period,amount_usd,source_tab) VALUES ('2026-01',99999,'excel');
    `);
    const result = await fetchNativeExecutiveDashboard(2026,undefined,undefined,true);
    expect(result.data).toHaveLength(3);
    expect(result.filtered).toMatchObject({ ventasDelMes: 3000, ebitOperativo: 1200, beneficioNeto: 600,
      activoLiquido: 100, clientesACobrar: 300, pasivoProveedores: 50, balanceNeto: 330, cashflow: -75, fuenteDatos: 'master' });
    expect((await fetchNativeExecutiveDashboard(2026,8)).filtered?.ventasDelMes).toBe(1000);
    expect((await fetchNativeExecutiveDashboard(2026,undefined,1)).filtered?.ventasDelMes).toBe(1000);
    expect((await fetchNativeExecutiveDashboard(undefined,undefined,undefined,undefined,2026,1,2026,8)).filtered?.ventasDelMes).toBe(2000);
    expect((await fetchNativeExecutiveDashboard(2024,1)).filtered).toBeNull();
  });

  it("keeps a native close immutable, uses native reopened/revenue months, and does not revive cancelled income", async () => {
    vi.mocked(getMasterScenarioSnapshot).mockRejectedValue(new Error('Master should not be read'));
    await pool.query(`
      INSERT INTO monthly_financial_summary (period_key,year,month_number,facturacion_total,ebit_operativo,beneficio_neto)
        VALUES ('2026-01',2026,1,800,300,250), ('2026-02',2026,2,99999,99999,99999),
        ('2026-03',2026,3,99999,99999,99999), ('2026-04',2026,4,99999,99999,99999);
      INSERT INTO financial_close_periods VALUES ('2026-01','CLOSED'), ('2026-02','OPEN');
      INSERT INTO revenue_events (invoice_period,amount_usd,status) VALUES ('2026-01',99999,'active'),
        ('2026-03',1500,'active'), ('2026-04',99999,'cancelled');
      INSERT INTO fact_cost_month VALUES ('2026-03',500,100,50);
    `);
    const result = await fetchNativeExecutiveDashboard(2026,undefined,undefined,true);
    expect(result.data.map(month => month.ventasDelMes)).toEqual([800,0,1500,0]);
    expect(result.data[0]).toMatchObject({ fuenteDatos:'cierre', cierre:true, beneficioNeto:250 });
    expect(result.data[2]).toMatchObject({ fuenteDatos:'mind', ebitOperativo:900, beneficioNeto:850 });
    expect(result.filtered?.ventasDelMes).toBe(2300);
    expect(getMasterScenarioSnapshot).not.toHaveBeenCalled();
  });

  it("surfaces a missing Master instead of silently replacing it with zero-native facts", async () => {
    await pool.query("INSERT INTO monthly_financial_summary (period_key,facturacion_total) VALUES ('2026-01',1000)");
    vi.mocked(getMasterScenarioSnapshot).mockRejectedValueOnce(new Error('Sheets unavailable'));
    await expect(fetchNativeExecutiveDashboard(2026,1)).rejects.toThrow('Sheets unavailable');
    vi.mocked(getMasterScenarioSnapshot).mockResolvedValueOnce(dashboardSnapshot([dashboardRow(1)]));
    expect((await fetchNativeExecutiveDashboard(2026,1)).filtered?.ventasDelMes).toBe(1000);
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

  it("reconciles live Master detail and totals instead of imported liabilities or stale summaries", async () => {
    const summaryHeader = dashboardHeaders;
    vi.mocked(getMasterScenarioSnapshot).mockResolvedValue({
      summary: [summaryHeader, dashboardRow(1,1000,900,900)],
      actual: [['Detalle', 'Subtipo de costo', 'Mes', 'Año Facturación', 'Año', ...Array(13).fill(''), 'Monto Total USD'],
        ['Tarjeta USA', 'Tarjeta', '01 ene', null, 2026, '', '', 'REPLIT PURCHASE', ...Array(10).fill(null), 100]],
      estimates: [['Mes', 'Año', '', 'Detalle', ...Array(8).fill(''), 'Monto Total USD'],
        ['01 ene', 2026, null, 'Tarjeta USA', ...Array(8).fill(null), 500]],
      liabilities: [['Detalle', '', 'Mes', 'Año', ...Array(9).fill(''), 'Monto Total USD'],
        ['Tarjeta USA', 'Tarjeta', '01 ene', 2026, ...Array(9).fill(null), 999]],
      readAt: '2026-11-06T12:00:00Z',
    });
    await pool.query(`
      INSERT INTO monthly_financial_summary (period_key,facturacion_total,ebit_operativo,beneficio_neto)
        VALUES ('2026-01',900,400,250);
      INSERT INTO pasivo_entries (period_key,detalle,concepto,monto_total_usd)
        VALUES ('2026-01','Tarjeta USA','REPLIT PURCHASE',999);
    `);
    const data = await getFinancialScenario(2026);
    expect(data.costs).toHaveLength(1);
    expect(data.costs[0]).toMatchObject({ description: 'REPLIT PURCHASE', amountUsd: 100, source: 'master' });
    const result = calculateFinancialScenario(data, data.costs.map(cost => cost.id));
    expect(result.adjustedNetProfitUsd).toBe(1000);
    expect(result.adjustedCostUsd).toBe(0);
    expect((await getFinancialProjection(2026)).facturacion.total).toBe(1000);
    expect((await getFinancialProjection(2026)).costos.total).toBe(100);
    vi.mocked(getMasterScenarioSnapshot).mockRejectedValueOnce(new Error('Sheets unavailable'));
    await expect(getFinancialScenario(2026)).rejects.toThrow('Sheets unavailable');
  });

  it("shares Master closing dates and rounds annual totals only after summing both execution groups", async () => {
    const january = dashboardRow(1,1000.004,400.004,200);
    const december = dashboardRow(12,1000.004,400.004,200);
    january[2] = 46053; december[2] = 80000;
    const snapshot = dashboardSnapshot([january,december]);
    snapshot.actual = [Array(19).fill('')];
    for (const [index,name] of [[0,'Detalle'],[2,'Mes'],[4,'Año'],[18,'Monto Total USD']] as const) snapshot.actual[0][index]=name;
    snapshot.estimates = [Array(13).fill('')];
    for (const [index,name] of [[0,'Mes'],[1,'Año'],[3,'Detalle'],[12,'Monto Total USD']] as const) snapshot.estimates[0][index]=name;
    snapshot.liabilities = [Array(14).fill('')];
    for (const [index,name] of [[0,'Detalle'],[2,'Mes'],[3,'Año'],[13,'Monto Total USD']] as const) snapshot.liabilities[0][index]=name;
    vi.mocked(getMasterScenarioSnapshot).mockResolvedValue(snapshot);
    await pool.query(`INSERT INTO monthly_financial_summary (period_key,facturacion_total,ebit_operativo)
      VALUES ('2026-01',1000,400), ('2026-12',1000,400)`);
    const projection = await getFinancialProjection(2026);
    expect(projection.mesesCerrados).toBe(1);
    expect(projection.meses[0].cierre).toBe(true);
    expect(projection.meses[11].cierre).toBe(false);
    expect(projection.facturacion).toEqual({ejecutado:1000,proyectado:1000,total:2000.01});
    expect(projection.resultado.total).toBe(800.01);
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
