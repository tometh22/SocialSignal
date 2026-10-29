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
import { runTeamPayroll } from "../server/jobs/team-payroll";
import { payrollDocumentModesMigrationSql } from "../server/migrations/payroll-document-modes";
import { settlementProgress } from "../shared/utils/settlement-progress";
import { personalInvoiceReviewQuery } from "../server/services/personal-invoice-review";
import { savePersonnelSettlement } from "../server/services/personnel-settlement-publication";
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
    await query(readFileSync("migrations/0091_payroll_document_modes.sql","utf8"));
    await query(payrollDocumentModesMigrationSql);
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
  const earlyNow = new Date("2026-10-28T15:00:00Z");
  async function publicationInput(overrides: Record<string, unknown> = {}) {
    const closing = (await query("SELECT * FROM monthly_closings WHERE personnel_id=1 AND year=2026 AND month=10")).rows[0];
    const current = (await query("SELECT * FROM personnel_monthly_settlements WHERE personnel_id=1 AND period=$1", [period])).rows[0];
    return { period, version: current?.workflow?.version ?? 0, publish: true, billingCurrency: "ARS", usdPercentage: 0,
      expectedBase: { closingId: closing.id, hours: closing.adjusted_hours, totalARS: closing.grand_total_ars },
      earlyPublication: { confirmed: true, reason: "Facturación anticipada con base revisada" }, ...overrides };
  }
  it("authorizes USD-only once, converts ARS additions at the same FX and rejects an ARS phase", async () => {
    await preparePayroll(period,2);
    const row=await savePersonnelSettlement(1,2,await publicationInput({billingCurrency:"USD",bonusUSD:3,bonusARS:1000,extrasARS:500}),earlyNow);
    expect(row.usdPercentage).toBe(100);expect(row.workflow.requiresInvoice).toBe(true);
    const sent=await changeSettlement(row.id,1,false,{phase:"usd",action:"submit",version:1,invoiceFx:1000,requiresInvoice:false});
    expect(sent.workflow.requiresInvoice).toBe(true);
    expect(sent.totalInvoiceUSD).toBe(14.5);expect(sent.finalInvoiceARS).toBe(0);
    const approved=await changeSettlement(row.id,2,true,{phase:"usd",action:"approve",version:2});
    expect(assertSettlementInvoiceAllowed(approved,"usd","USD")).toBe(14.5);
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(1);
    await query("INSERT INTO personal_monthly_invoices(settlement_id,invoice_currency,approval_status,declared_invoice_amount) VALUES($1,'USD','approved',14.5)",[row.id]);
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(0);
    await expect(changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:3})).rejects.toMatchObject({statusCode:400});
    expect(settlementProgress({closing:{id:1},settlement:approved,invoices:[{invoiceComponent:"usd",approvalStatus:"approved"}]}).group).toBe("done");
  });
  it("completes authorized USD without a phantom invoice, and cannot upload a document in that mode", async () => {
    await preparePayroll(period,2);
    const row=await savePersonnelSettlement(1,2,await publicationInput({billingCurrency:"USD",requiresInvoice:false}),earlyNow);
    await changeSettlement(row.id,1,false,{phase:"usd",action:"submit",version:1,invoiceFx:1000});
    const approved=await changeSettlement(row.id,2,true,{phase:"usd",action:"approve",version:2});
    expect(()=>assertSettlementInvoiceAllowed(approved,"usd","USD")).toThrow("sin factura");
    expect(settlementProgress({closing:{id:1},settlement:approved,invoices:[]})).toMatchObject({group:"done",label:"Liquidación autorizada sin factura"});
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(0);
    expect((await query("SELECT * FROM personal_monthly_invoices")).rows).toHaveLength(0);
    expect((await query("SELECT * FROM pasivo_entries")).rows).toHaveLength(0);
    const audit=(await query("SELECT after_data FROM financial_audit_events WHERE entity_id=$1 ORDER BY id DESC LIMIT 1",[row.id])).rows[0];
    expect(audit.after_data.requiresInvoice).toBe(false);
    await expect(savePersonnelSettlement(1,2,await publicationInput({requiresInvoice:true}),earlyNow)).rejects.toThrow("importes enviados");
  });
  it("preserves USD authorization and receipt checks for mixed settlements without invoices", async () => {
    await preparePayroll(period,2);
    const row=await savePersonnelSettlement(1,2,await publicationInput({billingCurrency:"MIXED",usdPercentage:90,requiresInvoice:false}),earlyNow);
    await changeSettlement(row.id,1,false,{phase:"usd",action:"submit",version:1,invoiceFx:1500});
    await expect(changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:2,receivedConfirmed:true,receivedFx:1505})).rejects.toThrow("autorizar primero");
    await changeSettlement(row.id,2,true,{phase:"usd",action:"approve",version:2});
    await expect(changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:3,receivedFx:1505})).rejects.toThrow("recibiste");
    const ars=await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:3,receivedConfirmed:true,receivedFx:1505});
    expect(ars.finalInvoiceARS).toBe(969.6);
    const done=await changeSettlement(row.id,2,true,{phase:"ars",action:"approve",version:4});
    expect(settlementProgress({closing:{id:1},settlement:done,invoices:[]}).group).toBe("done");
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(0);
  });
  it("rejects an invalid invoice requirement and unsupported currency instead of silently changing them", async () => {
    await preparePayroll(period,2);
    await expect(savePersonnelSettlement(1,2,await publicationInput({requiresInvoice:"false"}),earlyNow)).rejects.toMatchObject({statusCode:400});
    await expect(savePersonnelSettlement(1,2,await publicationInput({billingCurrency:"EUR"}),earlyNow)).rejects.toMatchObject({statusCode:400});
  });
  it("preserves the approved historical USD document when a legacy workflow has no USD authorization snapshot", async () => {
    const row=await published();
    await query("UPDATE personnel_monthly_settlements SET invoice_fx=1500,base_invoice_usd=6,total_invoice_usd=6 WHERE id=$1",[row.id]);
    await query("INSERT INTO personal_monthly_invoices(settlement_id,invoice_currency,approval_status) VALUES($1,'USD','approved')",[row.id]);
    const ars=await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:0,receivedConfirmed:true,receivedFx:1505});
    expect(ars.finalInvoiceARS).toBe(970);expect(ars.workflow.ars.status).toBe("pending");
  });
  it("requires an explicit early confirmation and the displayed base, while drafts remain available", async () => {
    await preparePayroll(period, 2);
    await expect(savePersonnelSettlement(1,2,await publicationInput({earlyPublication:undefined}),earlyNow)).rejects.toThrow("Publicar anticipadamente");
    await expect(savePersonnelSettlement(1,2,await publicationInput({earlyPublication:{confirmed:true,reason:"x"}}),earlyNow)).rejects.toThrow("motivo");
    await expect(savePersonnelSettlement(1,2,await publicationInput({expectedBase:undefined}),earlyNow)).rejects.toThrow("base actual");
    await expect(savePersonnelSettlement(1,2,await publicationInput({expectedBase:{closingId:0,hours:120,totalARS:1}}),earlyNow)).rejects.toThrow("base cambió");
    const draft=await savePersonnelSettlement(1,2,await publicationInput({publish:false,earlyPublication:undefined}),earlyNow);
    expect(draft.status).toBe("draft");
    expect((await query("SELECT * FROM payroll_periods")).rows).toHaveLength(0);
    expect((await query("SELECT * FROM financial_audit_events WHERE action='settlement_published_early'")).rows).toHaveLength(0);
  });
  it("publishes one person early, records who and why, and completes ARS authorization while hours stay open", async () => {
    await preparePayroll(period,2);
    const row=await savePersonnelSettlement(1,2,await publicationInput({extrasARS:1000}),earlyNow);
    expect(row.status).toBe("published");expect(row.workflow.publication).toEqual({beforeCut:true,actorId:2,at:earlyNow.toISOString(),reason:"Facturación anticipada con base revisada"});
    expect((await query("SELECT * FROM payroll_periods")).rows).toHaveLength(0);
    const audit=(await query("SELECT actor_user_id,reason,after_data FROM financial_audit_events WHERE action='settlement_published_early'")).rows[0];
    expect(audit.actor_user_id).toBe(2);expect(audit.reason).toContain("base revisada");expect(audit.after_data.operationalHoursRemainOpen).toBe(true);
    await query("INSERT INTO tasks(id,title) VALUES(1,'QA'); INSERT INTO task_time_entries(task_id,personnel_id,date,hours) VALUES(1,1,'2026-10-29',4)");
    const submitted=await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:1,extrasARS:500,extrasReason:"Monotributo pendiente"});
    expect(submitted.finalInvoiceARS).toBe(row.totalARS+1500);
    const approved=await changeSettlement(row.id,2,true,{phase:"ars",action:"approve",version:2});
    expect(assertSettlementInvoiceAllowed(approved,"single","ARS")).toBe(row.totalARS+1500);
    expect(approved.workflow.publication).toEqual(row.workflow.publication);
    await expect(savePersonnelSettlement(1,2,await publicationInput(),earlyNow)).rejects.toThrow("importes enviados");
  });
  it("keeps an early freelance base and invoices unchanged through preparation and the general cut", async () => {
    await query("UPDATE personnel SET contract_type='freelance'; INSERT INTO tasks(id,title) VALUES(1,'QA'); INSERT INTO task_time_entries(task_id,personnel_id,date,hours) VALUES(1,1,'2026-10-27',10)");
    await preparePayroll(period,2);
    const row=await savePersonnelSettlement(1,2,await publicationInput({billingCurrency:'MIXED',usdPercentage:90}),earlyNow);
    await changeSettlement(row.id,1,false,{phase:'usd',action:'submit',version:1,invoiceFx:1500});
    await changeSettlement(row.id,2,true,{phase:'usd',action:'approve',version:2});
    await query("INSERT INTO personal_monthly_invoices(user_id,personnel_id,settlement_id,period,invoice_component,invoice_currency,approval_status) VALUES(1,1,$1,$2,'usd','USD','approved')",[row.id,period]);
    const before=(await query("SELECT to_jsonb(m) closing,to_jsonb(s) settlement FROM monthly_closings m JOIN personnel_monthly_settlements s ON s.personnel_id=m.personnel_id")).rows[0];
    await query("INSERT INTO task_time_entries(task_id,personnel_id,date,hours) VALUES(1,1,'2026-10-29',3); INSERT INTO personnel(id,name,role_id,contract_type,monthly_hours) VALUES(3,'Otro colaborador',1,'full-time',160); INSERT INTO personnel_historical_costs(personnel_id,year,month,hourly_rate_ars,is_active) VALUES(3,2026,10,100,true)");
    expect((await payrollActualHours(period))[1]).toBe(13);
    await preparePayroll(period,2);
    await preparePayroll(period,2,{cut:true,now:new Date('2026-10-31T03:00:00Z')});
    const after=(await query("SELECT to_jsonb(m) closing,to_jsonb(s) settlement FROM monthly_closings m JOIN personnel_monthly_settlements s ON s.personnel_id=m.personnel_id WHERE m.personnel_id=1")).rows[0];
    expect(after).toEqual(before);expect(after.closing.adjusted_hours).toBe(10);
    expect((await query("SELECT status FROM personnel_monthly_settlements WHERE personnel_id=3")).rows[0].status).toBe('draft');
    expect((await query("SELECT * FROM personal_monthly_invoices WHERE settlement_id=$1",[row.id])).rows).toHaveLength(1);
    await expect(query("UPDATE task_time_entries SET hours=11 WHERE personnel_id=1")).rejects.toMatchObject({code:'23514'});
  });
  it("retains normal publication after the general cut and the initial early evidence on updates", async () => {
    await preparePayroll(period,2);
    const early=await savePersonnelSettlement(1,2,await publicationInput(),earlyNow);
    const updated=await savePersonnelSettlement(1,2,await publicationInput({earlyPublication:undefined,bonusARS:100}),earlyNow);
    expect(updated.workflow.publication).toEqual(early.workflow.publication);
    await preparePayroll(period,2,{cut:true,now:new Date('2026-10-31T03:00:00Z')});
    expect((await savePersonnelSettlement(1,2,await publicationInput({earlyPublication:undefined}),earlyNow)).workflow.publication).toEqual(early.workflow.publication);
    await query("DELETE FROM personnel_monthly_settlements");
    const normal=await savePersonnelSettlement(1,2,await publicationInput({earlyPublication:undefined}),earlyNow);
    expect(normal.workflow.publication?.beforeCut).toBe(false);
  });
  it("rejects future publication, stale versions, competing publications and financial review", async () => {
    await preparePayroll(period,2);
    const input=await publicationInput();
    const competing=await Promise.allSettled([savePersonnelSettlement(1,2,input,earlyNow),savePersonnelSettlement(1,2,input,earlyNow)]);
    expect(competing.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    await expect(savePersonnelSettlement(1,2,input,earlyNow)).rejects.toThrow('cambió');
    await query("INSERT INTO monthly_closings(personnel_id,year,month,adjusted_hours,grand_total_ars,total_cost) VALUES(1,2026,11,120,10000,10000)");
    const future={period:'2026-11',publish:false,billingCurrency:'ARS'};
    await savePersonnelSettlement(1,2,future,earlyNow);
    await expect(savePersonnelSettlement(1,2,{...future,publish:true,version:1,earlyPublication:input.earlyPublication},earlyNow)).rejects.toThrow('mes futuro');
    await query("INSERT INTO financial_close_periods(period_key,status) VALUES($1,'IN_REVIEW')",[period]);
    await expect(savePersonnelSettlement(1,2,await publicationInput(),earlyNow)).rejects.toThrow('financiero está bloqueado');
  });
  it("starts automation at its activation month without publishing or cutting history",async()=>{
    await query("INSERT INTO system_config(config_key,config_value,description) VALUES('payroll_automation_start',1,$1)",[period]);
    await runTeamPayroll(new Date("2026-10-31T03:00:00Z"));
    await runTeamPayroll(new Date("2026-10-31T03:00:00Z"));
    expect((await query("SELECT period,state FROM payroll_periods")).rows).toEqual([{period,state:"cut"}]);
    expect((await query("SELECT status FROM personnel_monthly_settlements")).rows).toEqual([{status:"draft"}]);
    expect((await query("SELECT count(*)::int n FROM financial_audit_events WHERE action='hours_cut'")).rows[0].n).toBe(1);
    expect((await query("SELECT * FROM personal_monthly_invoices")).rows).toHaveLength(0);
  });
  it("blocks an early cut and refreshes missing-rate issues after correction",async()=>{
    await expect(preparePayroll(period,2,{cut:true,now:new Date("2026-10-30T12:00:00Z")})).rejects.toMatchObject({statusCode:409});
    await query("DELETE FROM personnel_historical_costs");
    const initial=await preparePayroll(period,2,{cut:true,now:new Date("2026-10-31T03:00:00Z")});
    expect(initial.issues).toHaveLength(1);
    await query("INSERT INTO personnel_historical_costs(personnel_id,year,month,hourly_rate_ars,is_active) VALUES(1,2026,10,100,true)");
    const corrected=await preparePayroll(period,2);
    expect(corrected.created).toBe(1);expect(corrected.issues).toEqual([]);
    expect((await query("SELECT issues,state FROM payroll_periods WHERE period=$1",[period])).rows[0]).toEqual({issues:[],state:"cut"});
  });
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
  it("counts the entered civil dates consistently in both hour sources",async()=>{
    await query("INSERT INTO tasks(id,title,project_id) VALUES(1,'QA',1)");
    for (const date of ['2026-09-30 23:59:59','2026-10-01 00:00:00','2026-10-31 23:59:59','2026-11-01 00:00:00']) {
      await query("INSERT INTO task_time_entries(task_id,personnel_id,date,hours,description) VALUES(1,1,$1,2,'task boundary')",[date]);
      await query("INSERT INTO time_entries(personnel_id,project_id,date,hours,description,entry_type,approved) VALUES(1,1,$1,3,'legacy boundary','hours',true)",[date]);
    }
    expect((await payrollActualHours('2026-09'))[1]).toBe(5);
    expect((await payrollActualHours(period))[1]).toBe(10);
    expect((await payrollActualHours('2026-11'))[1]).toBe(5);
  });
  it("protects the first civil day at midnight for insertion, moving and deletion",async()=>{
    await query("INSERT INTO tasks(id,title,project_id) VALUES(1,'QA',1); INSERT INTO task_time_entries(task_id,personnel_id,date,hours) VALUES(1,1,'2026-10-01 00:00:00',2); INSERT INTO time_entries(personnel_id,project_id,date,hours,entry_type) VALUES(1,1,'2026-10-01 00:00:00',3,'hours')");
    await query("INSERT INTO payroll_periods(period,state) VALUES($1,'cut')",[period]);
    for (const table of ['task_time_entries','time_entries']) {
      await expect(query(`UPDATE ${table} SET date='2026-11-02'`)).rejects.toMatchObject({code:'23514'});
      await expect(query(`DELETE FROM ${table}`)).rejects.toMatchObject({code:'23514'});
      const fields=table==='task_time_entries' ? "task_id,personnel_id,date,hours" : "project_id,personnel_id,date,hours";
      await expect(query(`INSERT INTO ${table}(${fields}) VALUES(1,1,'2026-10-01 00:00:00',1)`)).rejects.toMatchObject({code:'23514'});
      await query(`INSERT INTO ${table}(${fields}) VALUES(1,1,'2026-11-01 00:00:00',1)`);
      await expect(query(`UPDATE ${table} SET date='2026-10-31 23:59:59' WHERE date='2026-11-01 00:00:00'`)).rejects.toMatchObject({code:'23514'});
    }
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
    expect((await query("SELECT * FROM fact_cost_month WHERE period_key=$1",[period])).rows).toHaveLength(0);
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(1);
    await query("INSERT INTO personal_monthly_invoices(settlement_id,invoice_currency,approval_status) VALUES($1,'ARS','approved')",[row.id]);
    expect((await query("SELECT * FROM financial_payroll_pending")).rows).toHaveLength(0);
  });
  it("prepares and authorizes payroll without rewriting imported financial totals",async()=>{
    await query("INSERT INTO fact_cost_month(period_key,amount_ars,amount_usd,source_rows_count) VALUES($1,123456,100,17)",[period]);
    const before=(await query("SELECT to_jsonb(f) data FROM fact_cost_month f WHERE period_key=$1",[period])).rows[0].data;
    const row=await published(false);
    await changeSettlement(row.id,1,false,{phase:"ars",action:"submit",version:0,extrasARS:1000,extrasReason:"Comisión bancaria"});
    await changeSettlement(row.id,2,true,{phase:"ars",action:"approve",version:1});
    expect((await query("SELECT to_jsonb(f) data FROM fact_cost_month f WHERE period_key=$1",[period])).rows[0].data).toEqual(before);
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
