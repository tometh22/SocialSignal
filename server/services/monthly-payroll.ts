import { rebuildNativeFinancialFacts } from "./financial-native-builders";
import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { personnel, monthlyClosings, personnelMonthlySettlements, exchangeRates, financialAuditEvents, holidays } from "@shared/schema";
import { resolveCanonicalPersonnelRate } from "../domain/personnel-rate";
import { reconcileHourSources } from "@shared/utils/hours-reconciliation";
import { payableMonthlyHours } from "@shared/utils/payroll-hours";
import { settlementWorkflow } from "@shared/utils/settlement-workflow";
import { lastPayrollBusinessDay } from "@shared/utils/payroll-calendar";
import { lockSettlementPeriod } from "./personnel-settlement-workflow";

export async function payrollActualHours(period: string, runner: any = db): Promise<Record<number, number>> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw Object.assign(new Error("Período inválido"), { statusCode: 400 });
  const result = await runner.execute(sql`
    SELECT personnel_id AS "personnelId",project_id AS "projectId",date,hours,description,'legacy' source FROM time_entries
    WHERE date >= (${period}||'-01')::date AND date < (${period}||'-01')::date + interval '1 month' AND entry_type='hours' AND approved IS DISTINCT FROM false
    UNION ALL
    SELECT tte.personnel_id,t.project_id,tte.date,tte.hours,tte.description,'task' FROM task_time_entries tte JOIN tasks t ON t.id=tte.task_id
    WHERE tte.date >= (${period}||'-01')::date AND tte.date < (${period}||'-01')::date + interval '1 month'
  `);
  const records = result.rows.map((r: any) => ({ ...r, hours: Number(r.hours) }));
  const entries = reconcileHourSources(records.filter((r: any) => r.source === "task"), records.filter((r: any) => r.source === "legacy"));
  const totals: Record<number, number> = {};
  for (const entry of entries) totals[entry.personnelId] = (totals[entry.personnelId] ?? 0) + entry.hours;
  return totals;
}

export async function payrollCalendar(period: string, runner: any = db) {
  const days = await runner.select({ date: holidays.date }).from(holidays);
  const day = lastPayrollBusinessDay(period, days.map((h: any) => h.date));
  return { day, cutoffAt: new Date(`${day}T23:59:00-03:00`), timezone: "America/Argentina/Buenos_Aires" };
}

/** Freeze hours once, prepare drafts without authorizing payments or invoices. */
export async function preparePayroll(period: string, actorId: number | null, options: { cut?: boolean; now?: Date } = {}) {
  const calendar = await payrollCalendar(period);
  const now = options.now ?? new Date();
  if (options.cut && now < calendar.cutoffAt) throw Object.assign(new Error("El corte se habilita al finalizar el último día hábil, a las 23:59 de Buenos Aires."), { statusCode: 409 });
  return db.transaction(async tx => {
    await lockSettlementPeriod(tx, period);
    const existing = (await tx.execute(sql`SELECT * FROM payroll_periods WHERE period=${period} FOR UPDATE`)).rows[0] as any;
    if (options.cut && existing?.state === "cut") return { created: 0, issues: existing.issues ?? [], alreadyCut: true };
    if (options.cut) await tx.execute(sql`INSERT INTO payroll_periods(period,state,cutoff_at) VALUES(${period},'cut',${calendar.cutoffAt}) ON CONFLICT(period) DO UPDATE SET state='cut',cutoff_at=EXCLUDED.cutoff_at,updated_at=now()`);
    const totals = await payrollActualHours(period, tx);
    const [year, month] = period.split("-").map(Number);
    const [fxRow] = await tx.select().from(exchangeRates).where(and(eq(exchangeRates.year, year), eq(exchangeRates.month, month), eq(exchangeRates.isActive, true))).orderBy(desc(exchangeRates.updatedAt));
    const people = await tx.select().from(personnel).where(sql`${personnel.activeUntil} IS NULL OR ${personnel.activeUntil}>=${period + '-01'}`);
    const issues: string[] = [];
    let created = 0;
    for (const person of people) {
      if (!person.includeInRealCosts) continue;
      const [published] = await tx.select().from(personnelMonthlySettlements).where(and(eq(personnelMonthlySettlements.personnelId, person.id), eq(personnelMonthlySettlements.period, period)));
      if (published?.status === "published") continue;
      let [closing] = await tx.select().from(monthlyClosings).where(and(eq(monthlyClosings.personnelId, person.id), eq(monthlyClosings.year, year), eq(monthlyClosings.month, month)));
      const rate = await resolveCanonicalPersonnelRate(person.id, new Date(`${period}-01T12:00:00Z`), tx);
      const actualHours = totals[person.id] ?? 0;
      if (person.contractType === "freelance" && actualHours === 0 && !closing) continue;
      if (!rate.hourlyRateARS || rate.error) { issues.push(`${person.name}: falta tarifa o cotización`); continue; }
      const fx = rate.exchangeRate ?? Number(fxRow?.rate ?? 0);
      // Rebuild only unpublished bases, keeping explicit unpaid-leave adjustments.
      const adjustedHours = payableMonthlyHours(person, actualHours, Number(closing?.adjustments?.unpaidHours ?? 0), closing?.notes ?? "");
      const totalARS = Math.round(adjustedHours * rate.hourlyRateARS * 100) / 100;
      const currency = person.billingCurrency.toUpperCase();
      if (currency !== "ARS" && !(fx > 0)) { issues.push(`${person.name}: falta cotización mensual`); continue; }
      const fraction = currency === "USD" ? 1 : currency === "MIXED" ? Number(person.usdBillingFraction ?? 0) : 0;
      const values = { actualHours, adjustedHours, hourlyRate: currency === "ARS" ? rate.hourlyRateARS : rate.hourlyRateARS / fx, totalCost: totalARS, grandTotalARS: totalARS, grandTotalUSD: fx > 0 ? totalARS / fx : null, billingCurrency: person.billingCurrency, usdBillingFraction: fraction, totalCostARS: totalARS * (1-fraction), totalCostUSD: fx > 0 ? totalARS * fraction / fx : 0, exchangeRateAtClose: fx > 0 ? fx : null, closedBy: actorId, adjustments: { unpaidHours: Number(closing?.adjustments?.unpaidHours ?? 0) } };
      [closing] = await tx.insert(monthlyClosings).values({ personnelId: person.id, year, month, ...values }).onConflictDoUpdate({ target: [monthlyClosings.personnelId, monthlyClosings.year, monthlyClosings.month], set: values }).returning();
      if (published) {
        await tx.update(personnelMonthlySettlements).set({ hoursSnapshot: adjustedHours, hourlyRateARSSnapshot: rate.hourlyRateARS, totalARS, plannedUSDARS: totalARS*published.usdPercentage/100, workflow: { ...settlementWorkflow(published.workflow), version: (published.workflow?.version ?? 0)+1 }, updatedAt: new Date() }).where(eq(personnelMonthlySettlements.id, published.id));
        created++; continue;
      }
      const [prior] = await tx.select().from(personnelMonthlySettlements).where(and(eq(personnelMonthlySettlements.personnelId, person.id), eq(personnelMonthlySettlements.status, "published"), sql`${personnelMonthlySettlements.period}<${period}`)).orderBy(desc(personnelMonthlySettlements.period));
      await tx.insert(personnelMonthlySettlements).values({ personnelId: person.id, period, contractTypeSnapshot: person.contractType, billingCurrencySnapshot: prior?.billingCurrencySnapshot ?? (currency === "ARS" ? "ARS" : "MIXED"), hoursSnapshot: adjustedHours, hourlyRateARSSnapshot: rate.hourlyRateARS, totalARS, usdPercentage: prior?.usdPercentage ?? fraction*100, plannedUSDARS: totalARS*(prior?.usdPercentage ?? fraction*100)/100, createdBy: actorId, status: "draft" });
      created++;
    }
    if (options.cut) await tx.execute(sql`UPDATE payroll_periods SET issues=${JSON.stringify(issues)}::jsonb WHERE period=${period}`);
    await tx.insert(financialAuditEvents).values({ periodKey: period, entityType: "payroll", action: options.cut ? "hours_cut" : "drafts_prepared", actorUserId: actorId, afterData: { created, issues, cutoffAt: calendar.cutoffAt } });
    await rebuildNativeFinancialFacts(period, tx);
    return { created, issues, alreadyCut: false };
  });
}
