import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { financialAuditEvents, monthlyClosings, personnel, personnelMonthlySettlements, personalMonthlyInvoices } from "@shared/schema";
import { civilDateInBuenosAires } from "@shared/utils/buenos-aires-week";
import { settlementWorkflow } from "@shared/utils/settlement-workflow";
import { calculatePersonnelSettlement } from "./personnel-settlement";
import { lockSettlementPeriod } from "./personnel-settlement-workflow";

function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}

/** Called only by the Operations route. Publishing freezes pay, not operational hours. */
export async function savePersonnelSettlement(personnelId: number, actorId: number, input: any, now = new Date()) {
  const period = String(input?.period ?? "");
  if (!Number.isInteger(personnelId) || personnelId <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) fail("Persona o período inválido", 400);
  const [year, month] = period.split("-").map(Number);
  const publish = input?.publish === true;
  return db.transaction(async tx => {
    await lockSettlementPeriod(tx, period);
    const [person] = await tx.select().from(personnel).where(eq(personnel.id, personnelId));
    if (!person) fail("Persona no encontrada", 404);
    const [closing] = await tx.select().from(monthlyClosings).where(and(eq(monthlyClosings.personnelId, personnelId), eq(monthlyClosings.year, year), eq(monthlyClosings.month, month))).for("update");
    if (!closing) fail("Primero prepará la base de esta persona en Cierre del equipo → Base a cobrar");
    const [current] = await tx.select().from(personnelMonthlySettlements).where(and(eq(personnelMonthlySettlements.personnelId, personnelId), eq(personnelMonthlySettlements.period, period))).for("update");
    if (current?.status === "published" && !publish) fail("La liquidación ya está publicada. Para cambiarla, revisá los datos y elegí Actualizar publicación.");
    const flow = settlementWorkflow(current?.workflow);
    if (Number(input.version ?? 0) !== flow.version) fail("La liquidación cambió. Actualizá antes de publicar.");
    const [document] = current ? await tx.select({ id: personalMonthlyInvoices.id }).from(personalMonthlyInvoices).where(eq(personalMonthlyInvoices.settlementId, current.id)).limit(1) : [];
    if (document || [flow.usd.status, flow.ars.status].some(status => status === "pending" || status === "approved")) fail("Ya hay importes enviados o facturas. Resolvé los tramos antes de cambiar las condiciones.");

    const totalARS = Number(closing.grandTotalARS ?? closing.totalCost ?? 0);
    const hoursSnapshot = Number(closing.adjustedHours ?? 0);
    const expected = input.expectedBase;
    if (expected && (Number(expected.closingId) !== closing.id || Number(expected.totalARS) !== totalARS || Number(expected.hours) !== hoursSnapshot)) fail("La base cambió. Volvé a Base a cobrar y revisála antes de publicar.");
    const cut = Boolean((await tx.execute(sql`SELECT 1 FROM payroll_periods WHERE period=${period} AND state='cut'`)).rows.length);
    const beforeCut = publish && !cut;
    const reason = String(input.earlyPublication?.reason ?? "").trim().slice(0, 2000);
    if (publish && period > civilDateInBuenosAires(now).slice(0, 7)) fail("No se puede publicar un mes futuro. Podés guardar sus condiciones como borrador.");
    if (beforeCut && !flow.publication?.beforeCut) {
      if (input.earlyPublication?.confirmed !== true || reason.length < 5) fail("Las horas siguen abiertas. Elegí Publicar anticipadamente y confirmá el motivo para fijar la base de esta persona sin cerrar las horas del equipo.");
      if (!expected) fail("Revisá la base actual antes de confirmar la publicación anticipada.");
    }

    const nonNegative = (value: unknown, field: string) => {
      const parsed = Number(value ?? 0);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`${field} inválido`, 400);
      return parsed;
    };
    const requestedCurrency = String(input.billingCurrency ?? closing.billingCurrency ?? person.billingCurrency ?? "ARS").toUpperCase();
    const billingCurrency = ["ARS", "USD", "MIXED"].includes(requestedCurrency) ? requestedCurrency : "ARS";
    const requestedPercentage = nonNegative(input.usdPercentage, "Porcentaje USD");
    const usdPercentage = billingCurrency === "USD" ? 100 : billingCurrency === "ARS" ? 0 : requestedPercentage;
    if (usdPercentage > 100) fail("El porcentaje USD debe estar entre 0 y 100", 400);
    const bonusUSD = billingCurrency !== "ARS" ? nonNegative(input.bonusUSD, "Bono USD") : 0;
    const bonusARS = nonNegative(input.bonusARS, "Bono ARS");
    const extrasARS = nonNegative(input.extrasARS, "Extra ARS");
    const calculated = calculatePersonnelSettlement({ totalARS, usdPercentage, bonusUSD, bonusARS, extrasARS, invoiceFx: null, receivedFx: null, bankCommissionUSD: 0 });
    const at = now.toISOString();
    const publication = flow.publication ?? (publish ? { beforeCut, actorId, at, ...(beforeCut ? { reason } : {}) } : undefined);
    const action = !publish ? "settlement_draft_saved" : current?.status === "published" ? "settlement_publication_updated" : beforeCut ? "settlement_published_early" : "settlement_published";
    const values = {
      contractTypeSnapshot: person.contractType ?? "full-time", billingCurrencySnapshot: billingCurrency,
      hoursSnapshot, hourlyRateARSSnapshot: hoursSnapshot > 0 ? totalARS / hoursSnapshot : 0, totalARS,
      usdPercentage, plannedUSDARS: calculated.plannedUSDARS, bonusUSD, bonusARS, extrasARS,
      baseInvoiceUSD: calculated.baseInvoiceUSD, totalInvoiceUSD: calculated.totalInvoiceUSD,
      pesifiedBaseARS: calculated.pesifiedBaseARS, finalInvoiceARS: calculated.finalInvoiceARS,
      adminNotes: String(input.adminNotes ?? "").trim().slice(0, 2000) || null,
      status: publish ? "published" : "draft",
      publishedBy: publish ? actorId : current?.publishedBy ?? null,
      publishedAt: publish ? now : current?.publishedAt ?? null, updatedAt: now,
      workflow: { ...settlementWorkflow(), version: flow.version + 1, publication, events: [...(flow.events ?? []), ...(publish ? [{ action, actorId, at, ...(beforeCut ? { reason: publication?.reason } : {}) }] : [])] },
    };
    const [saved] = await tx.insert(personnelMonthlySettlements).values({ personnelId, period, createdBy: actorId, ...values })
      .onConflictDoUpdate({ target: [personnelMonthlySettlements.personnelId, personnelMonthlySettlements.period], set: { ...values, invoiceFx: null, receivedFx: null, bankCommissionUSD: 0 } }).returning();
    await tx.insert(financialAuditEvents).values({
      periodKey: period, entityType: "personnel_settlement", entityId: saved.id, action, actorUserId: actorId,
      reason: beforeCut ? publication?.reason : null,
      beforeData: current ? { status: current.status, version: flow.version, totalARS: current.totalARS } : null,
      afterData: { personnelId, closingId: closing.id, status: saved.status, version: saved.workflow.version, totalARS, hours: hoursSnapshot, beforeCut, operationalHoursRemainOpen: !cut },
    });
    return saved;
  });
}
