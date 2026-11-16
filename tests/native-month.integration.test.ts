import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A full month that belongs to Mind, computed from Mind records only.
 * Run with NATIVE_MONTH_TEST_DATABASE_URL pointing at a disposable local database
 * created with `drizzle-kit push` (the test truncates finance tables).
 */
const url = process.env.NATIVE_MONTH_TEST_DATABASE_URL;

describe.skipIf(!url)("mes de Mind con saldos iniciales", () => {
  let pool: any;
  let computeNativeMonth: typeof import("../server/services/native-month").computeNativeMonth;
  let rebuild: typeof import("../server/services/financial-native-builders").rebuildNativeFinancialFacts;
  let getPeriodSource: typeof import("../server/services/finance-period-source").getPeriodSource;
  let nativeLedgerSummary: typeof import("../server/services/native-ledger-view").nativeLedgerSummary;

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/mind_e2e")) throw new Error("Only a local mind_e2e* database");
    process.env.DATABASE_URL = url;
    ({ pool } = await import("../server/db"));
    ({ computeNativeMonth } = await import("../server/services/native-month"));
    ({ rebuildNativeFinancialFacts: rebuild } = await import("../server/services/financial-native-builders"));
    ({ getPeriodSource } = await import("../server/services/finance-period-source"));
    ({ nativeLedgerSummary } = await import("../server/services/native-ledger-view"));
    await pool.query(`TRUNCATE financial_document_applications, active_projects, clients, provision_movements, provision_entries, activo_entries, pasivo_entries, cashflow_transactions,
      revenue_events, fact_cost_month, fact_labor_month, fact_rc_month, fact_estimated_cost_month, pl_adjustments, financial_accounts, financial_close_periods, monthly_financial_summary RESTART IDENTITY CASCADE`);
    await pool.query(`DELETE FROM system_config WHERE config_key IN ('finance_native_start_period')`);
    await pool.query(`DELETE FROM exchange_rates WHERE year=2027`);
    const q = (text: string, params: unknown[] = []) => pool.query(text, params);
    await q(`INSERT INTO system_config(config_key, config_value, description) VALUES ('finance_native_start_period', 0, '2027-01')`);
    // The Máster still has a summary for 2027-01: the switchover makes it a Mind month anyway.
    await q(`INSERT INTO monthly_financial_summary(period_key, year, month_number, month_label, facturacion_total) VALUES ('2027-01', 2027, 1, '01 ene', 99999), ('2026-12', 2026, 12, '12 dic', 50000)`);
    const { rows: [user] } = await q(`INSERT INTO users(first_name, last_name, email, password) VALUES ('Prueba', 'Finanzas', 'native-month@example.test', 'x') ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name RETURNING id`);
    await q(`INSERT INTO exchange_rates(year, month, rate, rate_type, is_active, created_by) VALUES (2027, 1, 1500, 'end_of_month', true, $1)`, [user.id]);
    await q(`INSERT INTO financial_accounts(name, bank_name, currency, opening_balance, opening_balance_date, account_type, is_active) VALUES
      ('Santander', 'Santander', 'ARS', 1500000, '2027-01-01', 'bank', true), ('Bank Of America', 'Bank Of America', 'USD', 10000, '2027-01-01', 'bank', true)`);
    // Opening balances (source 'opening'): not sales, not costs.
    const { rows: [openingInvoice] } = await q(`INSERT INTO activo_entries(period_key, tipo_activo, concepto, cliente_nombre, currency, monto_usd, monto_total_usd, gross_amount, outstanding_amount, source, status, document_type, fecha_vencimiento)
      VALUES ('2027-01', 'Clientes a cobrar', 'Saldo inicial', 'Warner', 'USD', 5000, 5000, 5000, 5000, 'opening', 'PENDING', 'opening_balance', '2027-01-20') RETURNING id`);
    await q(`INSERT INTO activo_entries(period_key, tipo_activo, concepto, currency, monto_usd, monto_total_usd, gross_amount, source, status, document_type) VALUES ('2027-01', 'Mediano Plazo', 'Cripto', 'USD', 2000, 2000, 2000, 'opening', 'PENDING', 'investment_valuation')`);
    await q(`INSERT INTO pasivo_entries(period_key, detalle, subtipo_costo, currency, monto_usd, monto_total_usd, gross_amount, net_amount, outstanding_amount, cost_treatment, source, status, fecha_vencimiento)
      VALUES ('2027-01', 'Estudio contable', 'Servicios', 'USD', 1500, 1500, 1500, 1500, 1500, 'balance_only', 'opening', 'PENDING', '2027-02-10')`);
    const { rows: [provision] } = await q(`INSERT INTO provision_entries(period_key, cliente_nombre, tipo, monto_provision, remaining_amount, currency, status) VALUES ('2027-01', 'Warner Insights', 'NUEVA_PROVISION', 1000, 1000, 'USD', 'ACTIVE') RETURNING id`);
    await q(`INSERT INTO provision_movements(provision_id, period_key, movement_type, amount, currency) VALUES ($1, '2027-01', 'opening', 1000, 'USD')`, [provision.id]);
    // January activity in Mind.
    await q(`INSERT INTO revenue_events(client_name, project_name, amount_usd, currency, invoice_period, confirmed, status, source_tab) VALUES
      ('Kimberly', 'Fee', 10000, 'USD', '2027-01', true, 'confirmed', 'mind_intake'),
      ('Prospecto', 'Propuesta', 3000, 'USD', '2027-01', false, 'confirmed', 'mind_budget')`);
    await q(`INSERT INTO activo_entries(period_key, tipo_activo, concepto, cliente_nombre, currency, monto_usd, monto_total_usd, gross_amount, outstanding_amount, source, status, fecha_vencimiento)
      VALUES ('2027-01', 'Cuentas a Cobrar', 'Factura', 'Kimberly', 'USD', 10000, 10000, 10000, 10000, 'mind_intake', 'PENDING', '2027-02-28')`);
    const { rows: [cash] } = await q(`INSERT INTO cashflow_transactions(fecha, period_key, tipo_movimiento, banco, moneda, monto_usd, source, reconciliation_status) VALUES ('2027-01-15T12:00:00Z', '2027-01', 'Ingreso', 'Bank Of America', 'USD', 4000, 'mind_intake', 'matched') RETURNING id`);
    await q(`INSERT INTO financial_document_applications(direction, activo_entry_id, cashflow_transaction_id, amount_original, amount_usd, applied_at) VALUES ('receivable', $1, $2, 4000, 4000, '2027-01-15T12:00:00Z')`, [openingInvoice.id, cash.id]);
    await q(`INSERT INTO pasivo_entries(period_key, detalle, subtipo_costo, currency, monto_usd, monto_total_usd, gross_amount, net_amount, outstanding_amount, cost_treatment, source, status) VALUES
      ('2027-01', 'Software', 'Software', 'USD', 2000, 2000, 2000, 2000, 2000, 'indirect', 'mind_intake', 'PENDING'),
      ('2027-01', 'IIBB enero', 'IIBB', 'USD', 300, 300, 300, 300, 300, 'indirect', 'mind_intake', 'PENDING'),
      ('2027-01', 'IRS', 'Impuestos USA', 'USD', 800, 800, 800, 800, 800, 'balance_only', 'mind_intake', 'PENDING')`);
    await q(`INSERT INTO pl_adjustments(period_key, type, concept, amount_usd) VALUES ('2027-01', 'impuesto', 'Impuestos USA', 800), ('2027-01', 'impuesto', 'IVA', 999)`);
    await q(`INSERT INTO dim_period(period_key, year, month, first_day) VALUES ('2027-01', 2027, 1, '2027-01-01') ON CONFLICT DO NOTHING`);
    const { rows: [client] } = await q(`INSERT INTO clients(name) VALUES ('Kimberly') RETURNING id`);
    const { rows: [project] } = await q(`INSERT INTO active_projects(client_id) VALUES ($1) RETURNING id`, [client.id]);
    await q(`INSERT INTO fact_labor_month(period_key, project_id, cost_usd) VALUES ('2027-01', $1, 3000)`, [project.id]);
    await rebuild("2027-01");
  });
  afterAll(async () => { await pool?.end(); });

  it("el mes de cambio es de Mind aunque el Máster tenga datos", async () => {
    expect(await getPeriodSource("2027-01")).toBe("mind");
    expect(await getPeriodSource("2026-12")).toBe("master");
  });

  it("resultado: sin estimados, sin IVA y con impuestos debajo del EBIT", async () => {
    const month = await computeNativeMonth("2027-01", { today: new Date("2027-02-05T00:00:00Z") });
    expect(month.ventas).toBe(10000);
    expect(month.costosDirectos).toBe(3000);
    expect(month.costosIndirectos).toBe(2000);
    expect(month.ebit).toBe(5000);
    expect(month.impuestosYIntereses).toBe(1100);
    expect(month.gastoProvisiones).toBe(0);
    expect(month.beneficioNeto).toBe(3900);
  });

  it("saldos al cierre con saldos iniciales y cobros aplicados", async () => {
    const month = await computeNativeMonth("2027-01", { today: new Date("2027-02-05T00:00:00Z") });
    expect(month.cajaPorCuenta).toEqual({ Santander: 1000, "Bank Of America": 14000 });
    expect(month.caja).toBe(15000);
    expect(month.cuentasCobrar).toBe(11000);
    expect(month.cuentasPagar).toBe(3800);
    expect(month.impuestosUsaPorPagar).toBe(800);
    expect(month.provisiones).toBe(1000);
    expect(month.inversiones).toBe(2000);
    expect(month.activoTotal).toBe(28000);
    expect(month.pasivoTotal).toBe(5600);
    expect(month.balanceNeto).toBe(22400);
    expect(month.cashflowNeto).toBe(4000);
    // Due in Feb–Mar: 10,000 to collect, 1,500 to pay.
    expect(month.cashflow60Dias).toBe(8500);
  });

  it("Por cobrar del mes muestra lo pendiente al cierre, incluido el saldo inicial", async () => {
    const summary = await nativeLedgerSummary("activo", "2027-01");
    expect(summary).toMatchObject({ total: 10000, settled: 4000, pending: 11000 });
  });
});
