import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
const url=process.env.FINANCIAL_TEST_DATABASE_URL;
// This suite owns a temporary schema and must never target an external database.
if(url && !["127.0.0.1","localhost","[::1]"].includes(new URL(url).hostname)) throw Error("Financial integration tests require a local test database.");
const schema=`finance_cutover_test_${process.pid}`;
let c:Client;
const query=(s:string,values?:unknown[])=>c.query(s,values);
const rejected=(s:string,values?:unknown[])=>expect(query(s,values)).rejects.toMatchObject({code:"23514"});
describe.skipIf(!url)("financial cutover in PostgreSQL",()=>{
  beforeAll(async()=>{
    c=new Client({connectionString:url});await c.connect();
    await query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE users(id integer PRIMARY KEY);
      CREATE TABLE system_config(config_key text PRIMARY KEY,description text);
      CREATE TABLE financial_close_periods(period_key text PRIMARY KEY,status text,updated_at timestamp);
      CREATE TABLE exchange_rates(id serial PRIMARY KEY,year int,month int,rate numeric,rate_type text,is_active boolean,updated_at timestamp);
      CREATE TABLE fact_estimated_cost_month(id serial PRIMARY KEY,month_key text,detalle text,subtipo_costo text,monto_total_usd numeric);
      CREATE TABLE monthly_financial_summary(id serial PRIMARY KEY,period_key text,amount numeric);
      CREATE TABLE revenue_events(id serial PRIMARY KEY,invoice_period text,delivery_start text,delivery_end text,collection_period_actual text,period_closed boolean,updated_at timestamp,amount numeric);
      CREATE TABLE personnel_historical_costs(id serial PRIMARY KEY,year int,month int,amount numeric);
      INSERT INTO users VALUES(1);
      INSERT INTO system_config VALUES('app_mode_cutover_date','2026-08');
    `);
    for(const table of ["fact_labor_month","fact_cost_month","fact_rc_month","activo_entries","pasivo_entries","cashflow_transactions","provision_entries","provision_movements","pl_adjustments","cash_movements"]){
      await query(`CREATE TABLE ${table}(id serial PRIMARY KEY,period_key text,source text,amount numeric,outstanding_amount numeric,status text)`);
    }
    for(const table of ["income_sot","financial_sot"])await query(`CREATE TABLE ${table}(id serial PRIMARY KEY,month_key text,amount numeric)`);
    await query("INSERT INTO fact_cost_month(period_key,amount) VALUES('2026-07',7),('2026-08',8)");
    const migration=readFileSync("migrations/0084_financial_cutover.sql","utf8");
    await query(migration);await query(migration); // idempotency
  });
  afterAll(async()=>{if(c){await query(`DROP SCHEMA ${schema} CASCADE`);await c.end();}});
  it("allows historical imports and rejects operational Excel writes",async()=>{
    await query("INSERT INTO income_sot(month_key,amount) VALUES('2026-07',10)");
    await rejected("INSERT INTO income_sot(month_key,amount) VALUES('2026-08',10)");
    await rejected("UPDATE income_sot SET month_key='2026-08'");
    await rejected("INSERT INTO activo_entries(period_key,source,amount) VALUES('2026-10','excel',10)");
    await query("INSERT INTO activo_entries(period_key,source,amount) VALUES('2026-10','mind',10)");
  });
  it("excludes preexisting Excel aggregates after cutover until native rebuild",async()=>{
    expect((await query("SELECT period_key FROM financial_native_cost_month ORDER BY period_key")).rows).toEqual([{period_key:'2026-07'}]);
    await rejected("INSERT INTO fact_cost_month(period_key,amount) VALUES('2026-09',9)");
    await query("UPDATE fact_cost_month SET data_source='mind',amount=80 WHERE period_key='2026-08'");
    expect((await query("SELECT amount FROM financial_native_cost_month WHERE period_key='2026-08'")).rows[0].amount).toBe('80');
  });
  it("only native close can publish a post-cutover summary",async()=>{
    await rejected("INSERT INTO monthly_financial_summary(period_key,amount) VALUES('2026-10',100)");
    await query("INSERT INTO financial_close_periods VALUES('2026-10','IN_REVIEW',now())");
    await query("BEGIN; SELECT set_config('mind.financial_writer','close',true)");
    await query("INSERT INTO monthly_financial_summary(period_key,amount) VALUES('2026-10',100)");
    await query("COMMIT");
    await query("UPDATE financial_close_periods SET status='CLOSED' WHERE period_key='2026-10'");
    await rejected("UPDATE monthly_financial_summary SET amount=200 WHERE period_key='2026-10'");
    await rejected("DELETE FROM monthly_financial_summary WHERE period_key='2026-10'");
  });
  it("moving a native row cannot bypass a closed source month",async()=>{
    await rejected("UPDATE activo_entries SET period_key='2026-11' WHERE period_key='2026-10'");
  });
  it("locks tariff, FX and revenue delivery months",async()=>{
    await rejected("INSERT INTO exchange_rates(year,month,rate) VALUES(2026,10,1500)");
    await rejected("INSERT INTO personnel_historical_costs(year,month,amount) VALUES(2026,10,10)");
    await rejected("INSERT INTO revenue_events(invoice_period,delivery_start,delivery_end,amount) VALUES('2026-11','2026-09','2026-11',10)");
  });
  it("allows close metadata without allowing a revenue amount edit",async()=>{
    await query("INSERT INTO revenue_events(invoice_period,amount) VALUES('2026-12',100)");
    await query("INSERT INTO financial_close_periods VALUES('2026-12','IN_REVIEW',now())");
    await query("BEGIN; SELECT set_config('mind.financial_writer','close',true)");
    await query("UPDATE revenue_events SET period_closed=true,updated_at=now() WHERE invoice_period='2026-12'");
    await query("COMMIT");
    await rejected("UPDATE revenue_events SET amount=200 WHERE invoice_period='2026-12'");
    await query("UPDATE financial_close_periods SET status='OPEN' WHERE period_key='2026-12'");
  });
  it("settles an old invoice in an open month without changing its economic amount",async()=>{
    await query("BEGIN; SELECT set_config('mind.financial_payment_period','2026-12',true)");
    await query("UPDATE activo_entries SET outstanding_amount=5,status='PARTIAL' WHERE period_key='2026-10'");
    await query("COMMIT");
    expect((await query("SELECT amount,outstanding_amount FROM activo_entries WHERE period_key='2026-10'")).rows[0]).toEqual({amount:'10',outstanding_amount:'5'});
    await query("BEGIN; SELECT set_config('mind.financial_payment_period','2026-12',true)");
    await rejected("UPDATE activo_entries SET amount=20 WHERE period_key='2026-10'");
    await query("ROLLBACK");
    await query("BEGIN; SELECT set_config('mind.financial_payment_period','2026-10',true)");
    await rejected("UPDATE activo_entries SET outstanding_amount=0 WHERE period_key='2026-10'");
    await query("ROLLBACK");
  });
  it("invalidates a pre-close when financial inputs change",async()=>{
    await query("INSERT INTO financial_close_periods VALUES('2026-11','PRE_CLOSE',now())");
    await query("INSERT INTO pasivo_entries(period_key,source,amount) VALUES('2026-11','mind',15)");
    expect((await query("SELECT status FROM financial_close_periods WHERE period_key='2026-11'")).rows[0].status).toBe("OPEN");
  });
  it("expands budgets by month and preserves missing FX as unknown",async()=>{
    await query("INSERT INTO financial_cost_plans(concept,category,cost_type,currency,monthly_amount,start_period,end_period,created_by,updated_by) VALUES('Software','Estructura','indirect','ARS',15000,'2026-11','2026-12',1,1)");
    let rows=(await query("SELECT * FROM financial_cost_forecast_month WHERE source='mind' ORDER BY month_key")).rows;
    expect(rows).toHaveLength(2);expect(rows[0].monto_total_usd).toBeNull();expect(rows[0].missing_fx).toBe(true);
    await query("INSERT INTO exchange_rates(year,month,rate,rate_type,is_active,updated_at) VALUES(2026,11,1500,'end_of_month',true,now())");
    rows=(await query("SELECT * FROM financial_cost_forecast_month WHERE source='mind' ORDER BY month_key")).rows;
    expect(Number(rows[0].monto_total_usd)).toBe(10);expect(rows[1].monto_total_usd).toBeNull();
  });
  it("protects the old budget window on edits and deletions",async()=>{
    await query("UPDATE financial_close_periods SET status='CLOSED' WHERE period_key='2026-11'");
    await rejected("UPDATE financial_cost_plans SET start_period='2026-12'");
    await rejected("DELETE FROM financial_cost_plans");
  });
  it("rechecks close status after waiting for a concurrent close",async()=>{
    const other=new Client({connectionString:url});await other.connect();
    try{
      await other.query(`SET search_path TO ${schema}; SET statement_timeout='5s'`);
      await query("BEGIN; SELECT pg_advisory_xact_lock(hashtext('financial-period:2027-01'))");
      const pending=other.query("INSERT INTO pasivo_entries(period_key,source,amount) VALUES('2027-01','mind',20)").then(()=>null,e=>e);
      await query("INSERT INTO financial_close_periods VALUES('2027-01','CLOSED',now()); COMMIT");
      expect(await pending).toMatchObject({code:"23514"});
    }finally{await other.end();}
  });
});
