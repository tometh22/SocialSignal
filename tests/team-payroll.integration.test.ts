import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import * as schema from "../shared/schema";

const setup = vi.hoisted(() => ({ url: process.env.FINANCIAL_TEST_DATABASE_URL, schema: `team_payroll_test_${process.pid}` }));
if (setup.url && !["localhost","127.0.0.1","[::1]"].includes(new URL(setup.url).hostname)) throw new Error("Only a local test database is allowed");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg"); const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString:setup.url,options:`-c search_path=${setup.schema}`,max:4 });
  return { pool,db:drizzle(pool) };
});
vi.mock("../server/services/user-notifications",()=>({createUserNotifications:vi.fn(async()=>true)}));
import { pool, db } from "../server/db";
import { personalInvoiceReviewQuery } from "../server/services/personal-invoice-review";
import { preparePayroll, payrollActualHours } from "../server/services/monthly-payroll";
import { changeSettlement, assertSettlementInvoiceAllowed } from "../server/services/personnel-settlement-workflow";

let admin: Client;
const query = (text:string,values?:unknown[])=>pool.query(text,values);
const period="2026-10";
const tables=[schema.users,schema.personnel,schema.monthlyClosings,schema.personnelMonthlySettlements,schema.personalMonthlyInvoices,schema.exchangeRates,schema.personnelHistoricalCosts,schema.systemConfig,schema.financialAuditEvents,schema.financialClosePeriods,schema.holidays,schema.timeEntries,schema.taskTimeEntries,schema.tasks,schema.factLaborMonth,schema.dimPeriod,schema.factCostMonth,schema.factRCMonth,schema.pasivoEntries,schema.revenueEvents,schema.provisionEntries,schema.provisionMovements];

describe.skipIf(!setup.url)("team payroll workflow with PostgreSQL",()=>{
  beforeAll(async()=>{
    admin=new Client({connectionString:setup.url});await admin.connect();await admin.query(`CREATE SCHEMA ${setup.schema}`);
    const dialect=new PgDialect();
    for(const table of tables){
      const config=getTableConfig(table);
      const columns=config.columns.map(c=>{
        const def=c.default;
        const defaultSQL=def instanceof SQL ? dialect.sqlToQuery(def).sql : def === undefined ? undefined : typeof def === "number" || typeof def === "boolean" ? String(def) : `'${(Array.isArray(def) && c.getSQLType().endsWith("[]") ? "{"+def.join(",")+"}" : typeof def === "object" ? JSON.stringify(def) : String(def)).replaceAll("'","''")}'`;
        return `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY":""}${defaultSQL ? " DEFAULT "+defaultSQL:""}`;
      });
      await query(`CREATE TABLE "${config.name}" (${columns.join(",")})`);
    }
    await query("ALTER TABLE system_config ADD UNIQUE(config_key); ALTER TABLE monthly_closings ADD UNIQUE(personnel_id,year,month); ALTER TABLE personnel_monthly_settlements ADD UNIQUE(personnel_id,period); ALTER TABLE fact_rc_month ADD UNIQUE(project_id,period_key); ALTER TABLE fact_cost_month ADD UNIQUE(period_key)");
    const migration=readFileSync("migrations/0089_team_settlement_workflow.sql","utf8");
    await query(migration);await query(migration);
  });
  beforeEach(async()=>{
    await query(`TRUNCATE ${tables.map(t=>getTableConfig(t).name).join(",")},payroll_periods RESTART IDENTITY CASCADE`);
    await query("INSERT INTO users(id,email,is_active,permissions) VALUES(1,'person@example.test',true,'{}'),(2,'ops@example.test',true,'{operations}'); INSERT INTO personnel(id,name,email,role_id,hourly_rate,contract_type,monthly_hours) VALUES(1,'Victoria','person@example.test',1,1,'part-time',120); INSERT INTO personnel_historical_costs(personnel_id,year,month,hourly_rate_ars,is_active) VALUES(1,2026,10,83.33333333333333,true); INSERT INTO exchange_rates(year,month,rate,rate_type,is_active) VALUES(2026,10,1500,'end_of_month',true)");
  });
  afterAll(async()=>{await pool.end();if(admin){await admin.query(`DROP SCHEMA ${setup.schema} CASCADE`);await admin.end();}});

  async function published(mixed=true){
    await query("UPDATE personnel SET monthly_hours=100; UPDATE personnel_historical_costs SET hourly_rate_ars=100");
    await preparePayroll(period,2,{cut:true,now:new Date("2026-10-31T03:00:00Z")});
    return (await query("UPDATE personnel_monthly_settlements SET status='published',billing_currency_snapshot=$1,usd_percentage=$2,planned_usd_ars=$3 WHERE personnel_id=1 RETURNING *",[mixed?"MIXED":"ARS",mixed?90:0,mixed?9000:0])).rows[0];
  }
  it("returns the same review revision as Drizzle regardless of server or browser timezone", async () => {
    await query("INSERT INTO personal_monthly_invoices(user_id,personnel_id,period,updated_at) VALUES(1,1,$1,'2026-10-22 16:06:10.119')", [period]);
    const [invoice] = await db.select().from(schema.personalMonthlyInvoices);
    const result = await db.execute(personalInvoiceReviewQuery(period));
    const revision = result.rows[0].updated_at as string;
    expect(revision).toBe("2026-10-22T16:06:10.119Z");
    expect(new Date(revision).getTime()).toBe(invoice.updatedAt.getTime());
    expect(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }).format(new Date(revision))).toBe("13:06");
    await query("UPDATE personal_monthly_invoices SET updated_at = updated_at + interval '1 millisecond'");
    const [changed] = await db.select().from(schema.personalMonthlyInvoices);
    expect(new Date(revision).getTime()).not.toBe(changed.updatedAt.getTime());
  });
  it("prepares 120 contractual hours, freezes source hours, keeps paid leave out of deductions",async()=>{
    await query("INSERT INTO tasks(id,title) VALUES(1,'QA'); INSERT INTO task_time_entries(task_id,personnel_id,date,hours) VALUES(1,1,'2026-10-10',92.5)");
    const result=await preparePayroll(period,2,{cut:true,now:new Date("2026-10-31T03:00:00Z")});
    expect(result.created).toBe(1);
    const row=(await query("SELECT * FROM monthly_closings")).rows[0];
    expect(row.actual_hours).toBe(92.5);expect(row.adjusted_hours).toBe(120);expect(row.total_cost).toBe(9999.6);
    await expect(query("UPDATE task_time_entries SET hours=93 WHERE personnel_id=1")).rejects.toMatchObject({code:"23514"});
    expect((await preparePayroll(period,2,{cut:true,now:new Date("2026-10-31T03:00:00Z")})).alreadyCut).toBe(true);
  });
  it("keeps duplicate hours within a source and rejects unapproved legacy entries",async()=>{
    await query("INSERT INTO tasks(id,title,project_id) VALUES(1,'QA',1); INSERT INTO task_time_entries(task_id,personnel_id,date,hours,description) VALUES(1,1,'2026-10-10',2,'x'),(1,1,'2026-10-10',2,'x'); INSERT INTO time_entries(personnel_id,project_id,date,hours,description,entry_type,approved) VALUES(1,1,'2026-10-10',2,'x','hours',true),(1,1,'2026-10-10',50,'unapproved','hours',false)");
    expect((await payrollActualHours(period))[1]).toBe(4);
  });
  it("authorizes USD then receipt and ARS, preserving the confirmed 5970 example",async()=>{
    const row=await published();
    const submitted=await changeSettlement(row.id,1,false,{phase:"usd",action:"submit",version:0,invoiceFx:1500});
    expect(submitted.totalInvoiceUSD).toBe(6);
    expect(()=>assertSettlementInvoiceAllowed(submitted,"usd","USD")).toThrow("autorizar");
    await expect(changeSettlement(row.id,1,false,{phase:"usd",action:"approve",version:1})).rejects.toMatchObject({statusCode:403});
    const approved=await changeSettlement(row.id,2,true,{phase:"usd",action:"approve",version:1});
    expect(assertSettlementInvoiceAllowed(approved,"usd","USD")).toBe(6);
    await expect(changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:2,receivedFx:1505,receivedConfirmed:true,extrasARS:5000,extrasReason:"Comisión bancaria"})).rejects.toThrow("factura USD");
    await query("INSERT INTO personal_monthly_invoices(user_id,personnel_id,settlement_id,period,invoice_component,invoice_currency,declared_invoice_amount,approval_status) VALUES(1,1,$1,$2,'usd','USD',6,'approved')",[row.id,period]);
    const ars=await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:2,receivedFx:1505,receivedConfirmed:true,extrasARS:5000,extrasReason:"Comisión bancaria"});
    expect(ars.finalInvoiceARS).toBe(5970);
    const final=await changeSettlement(row.id,2,true,{phase:"ars",action:"approve",version:3});
    expect(assertSettlementInvoiceAllowed(final,"ars","ARS")).toBe(5970);
    expect(final.workflow.events).toHaveLength(4);
    const cost=(await query("SELECT * FROM financial_team_cost_month")).rows[0];
    expect(Number(cost.indirect_ars)).toBe(15000);expect(Number(cost.direct_ars)).toBe(0);
    expect(Number((await query("SELECT amount_ars FROM fact_cost_month WHERE period_key=$1",[period])).rows[0].amount_ars)).toBe(15000);
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(1);
    await query("INSERT INTO personal_monthly_invoices(settlement_id,invoice_currency,approval_status) VALUES($1,'ARS','approved')",[row.id]);
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(0);
  });
  it("supports ARS-only extras with no FX and rejects stale approvals",async()=>{
    const row=await published(false);
    await query("DELETE FROM exchange_rates");
    const pending=await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:0,extrasARS:5000,extrasReason:"Monotributo y comisión"});
    expect(pending.finalInvoiceARS).toBe(15000);
    expect(Number((await query("SELECT indirect_ars FROM financial_team_cost_month")).rows[0].indirect_ars)).toBe(10000);
    await expect(changeSettlement(row.id,2,true,{phase:"ars",action:"approve",version:0})).rejects.toThrow("cambió");
    const rejected=await changeSettlement(row.id,2,true,{phase:"ars",action:"reject",version:1,reason:"Corregir comisión"});
    expect(rejected.workflow.ars.status).toBe("rejected");
    const corrected=await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:2,extrasARS:1000,extrasReason:"Comisión corregida"});
    expect(corrected.finalInvoiceARS).toBe(11000);
    await changeSettlement(row.id,2,true,{phase:"ars",action:"approve",version:3});
    expect(Number((await query("SELECT indirect_ars FROM financial_team_cost_month")).rows[0].indirect_ars)).toBe(11000);
  });
  it("serializes competing approvals and blocks edits of invoiced USD",async()=>{
    const row=await published();await changeSettlement(row.id,1,false,{phase:"usd",action:"submit",version:0,invoiceFx:1500});
    const results=await Promise.allSettled([changeSettlement(row.id,2,true,{phase:"usd",action:"approve",version:1}),changeSettlement(row.id,2,true,{phase:"usd",action:"approve",version:1})]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    await query("INSERT INTO personal_monthly_invoices(settlement_id,invoice_component,invoice_currency) VALUES($1,'usd','USD')",[row.id]);
    await expect(changeSettlement(row.id,2,true,{phase:"usd",action:"reopen",version:2,reason:"Otro cambio"})).rejects.toThrow("factura");
  });
  it("rejects another person's input and changes after financial review",async()=>{
    const row=await published(false);
    await expect(changeSettlement(row.id,2,false,{phase:"ars",action:"submit",version:0})).rejects.toMatchObject({statusCode:403});
    await query("INSERT INTO financial_close_periods(period_key,status) VALUES($1,'IN_REVIEW')",[period]);
    await expect(changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:0})).rejects.toMatchObject({statusCode:409});
  });
});
