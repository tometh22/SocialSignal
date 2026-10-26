import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { civilDateInBuenosAires } from "@shared/utils/buenos-aires-week";
import { payrollCalendar, preparePayroll } from "../services/monthly-payroll";
import { notifySettlement } from "../services/personnel-settlement-workflow";
import { createUserNotifications } from "../services/user-notifications";

export async function runTeamPayroll(now = new Date()) {
  const period = civilDateInBuenosAires(now).slice(0,7);
  const previous = new Date(`${period}-01T12:00:00Z`); previous.setUTCMonth(previous.getUTCMonth()-1);
  const activation = (await db.execute(sql`SELECT description FROM system_config WHERE config_key='payroll_automation_start'`)).rows[0] as any;
  for (const candidate of [previous.toISOString().slice(0,7), period]) {
    if (candidate < (activation?.description ?? period)) continue;
    const calendar = await payrollCalendar(candidate);
    const state = (await db.execute(sql`SELECT state FROM payroll_periods WHERE period=${candidate}`)).rows[0] as any;
    // An explicitly reopened period stays open until Operations cuts it again.
    if (now >= calendar.cutoffAt && !state) {
      const result = await preparePayroll(candidate, null, {cut:true,now});
      const recipients = (await db.execute(sql`SELECT id FROM users WHERE is_active=true AND (is_admin=true OR 'operations'=ANY(permissions))`)).rows as any[];
      await createUserNotifications(recipients.map(r=>r.id), { eventKey:`payroll-cut:${candidate}`,type:"monthly_settlement",title:"Corte de horas preparado",message:`${candidate}: ${result.created} borradores preparados. ${result.issues.length} pendientes para revisar.`,actionUrl:`/operations/monthly-closing?period=${candidate}` });
    }
  }
}

export function startTeamPayroll() {
  const run = () => runTeamPayroll().catch(error => console.error("[team-payroll]", error.message));
  cron.schedule("59 23 * * *", run, {timezone:"America/Argentina/Buenos_Aires"});
  cron.schedule("*/5 * * * *", run, {timezone:"America/Argentina/Buenos_Aires"});
  cron.schedule("0 9 * * 1-5", () => remindTeamPayroll().catch(error => console.error("[team-payroll reminders]",error.message)), {timezone:"America/Argentina/Buenos_Aires"});
  void run();
}

export async function remindTeamPayroll(now = new Date()) {
  const { personnelMonthlySettlements, personalMonthlyInvoices } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const { settlementWorkflow } = await import("@shared/utils/settlement-workflow");
  const rows = await db.select().from(personnelMonthlySettlements).where(eq(personnelMonthlySettlements.status,"published"));
  for (const row of rows) {
    const flow = settlementWorkflow(row.workflow);
    const invoices = await db.select().from(personalMonthlyInvoices).where(eq(personalMonthlyInvoices.settlementId,row.id));
    const needed = (flow.usd.amount && flow.usd.amount > 0 ? 1 : 0) + (flow.ars.amount && flow.ars.amount > 0 ? 1 : 0);
    if (flow.ars.status === "approved" && invoices.filter(i=>i.approvalStatus === "approved").length >= needed) continue;
    const audience = [flow.usd.status,flow.ars.status].includes("pending") ? "operations" : invoices.some(i=>i.approvalStatus === "pending") ? "finance" : "person";
    await notifySettlement(row,audience,`Cierre pendiente · ${civilDateInBuenosAires(now)}`);
  }
}
