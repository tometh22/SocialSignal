import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { personnelMonthlySettlements, personalMonthlyInvoices, personnel, users, financialClosePeriods } from "@shared/schema";
import { calculatePersonnelSettlement } from "./personnel-settlement";
import { settlementWorkflow, settlementPhases, type SettlementPhase } from "@shared/utils/settlement-workflow";
import { createUserNotifications } from "./user-notifications";

function fail(message: string, statusCode = 409): never { throw Object.assign(new Error(message), { statusCode }); }
export async function lockSettlementPeriod(tx: any, period: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + period}))`);
  const [close] = await tx.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, period));
  if (["CLOSED", "IN_REVIEW"].includes(close?.status)) fail("El cierre financiero está bloqueado. Finanzas debe devolverlo a corrección o reabrirlo.");
  if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, period));
}

export async function notifySettlement(row: any, audience: "person" | "operations" | "finance", title: string) {
  const [person] = await db.select().from(personnel).where(eq(personnel.id, row.personnelId));
  const recipients = await db.select({ id: users.id }).from(users).where(audience === "person"
    ? sql`lower(trim(${users.email}))=lower(trim(${person?.email ?? ""})) AND ${users.isActive}=true`
    : sql`${users.isActive}=true AND (${users.isAdmin}=true OR ${audience}=ANY(${users.permissions}))`);
  await createUserNotifications(recipients.map(r => r.id), {
    eventKey: `team-settlement:${row.id}:${row.workflow?.version ?? 0}:${audience}:${title}`,
    type: "monthly_settlement", title,
    message: `${audience !== "person" ? person?.name + ": " : ""}${row.period}. Abrí el cierre para ver el siguiente paso.`,
    entityId: row.id, actionUrl: audience === "person" ? `/my-invoices?period=${row.period}` : audience === "finance" ? `/finance/facturas-equipo?period=${row.period}` : `/operations/liquidaciones-equipo?period=${row.period}`,
  });
}

export async function changeSettlement(id: number, actorId: number, operations: boolean, input: any) {
  const [lookup] = await db.select().from(personnelMonthlySettlements).where(eq(personnelMonthlySettlements.id, id));
  if (!lookup) fail("Liquidación no encontrada", 404);
  const saved = await db.transaction(async tx => {
    await lockSettlementPeriod(tx, lookup.period);
    const [row] = await tx.select().from(personnelMonthlySettlements).where(eq(personnelMonthlySettlements.id, id)).for("update");
    if (row.status !== "published") fail("Operaciones todavía no publicó las condiciones");
    if (!operations) {
      const [owner] = await tx.select({ id: users.id }).from(users).innerJoin(personnel, sql`lower(trim(${personnel.email}))=lower(trim(${users.email}))`).where(and(eq(personnel.id, row.personnelId), eq(users.id, actorId)));
      if (!owner) fail("No podés modificar esta liquidación", 403);
    }
    const flow = settlementWorkflow(row.workflow);
    if (Number(input.version) !== flow.version) fail("La liquidación cambió. Actualizá la pantalla antes de continuar.");
    const phase: SettlementPhase = input.phase;
    if (!["usd", "ars"].includes(phase)) fail("Tramo inválido", 400);
    if (!settlementPhases(row).includes(phase)) fail("Este tramo no corresponde a la moneda publicada", 400);
    const action = String(input.action);
    if (!operations && action !== "submit") fail("La autorización corresponde a Operaciones", 403);
    if (operations && !["approve", "reject", "reopen"].includes(action)) fail("Acción inválida", 400);
    const invoices = await tx.select().from(personalMonthlyInvoices).where(eq(personalMonthlyInvoices.settlementId, id));
    const phaseInvoice = invoices.find(i => i.invoiceComponent === phase || (i.invoiceComponent === "single" && i.invoiceCurrency?.toLowerCase() === phase));
    if (phaseInvoice) fail("El tramo ya tiene una factura. Debe resolverse el comprobante antes de cambiar la liquidación.");
    const usesUSD = row.usdPercentage > 0 || row.bonusUSD > 0;
    if (phase === "usd" && !usesUSD) fail("Esta liquidación sólo requiere ARS", 400);
    if (phase === "usd" && flow.ars.status !== "draft") fail("El tramo ARS ya está iniciado; no se puede cambiar la base USD.");
    const now = new Date().toISOString();
    const updates: any = {};
    if (action === "submit") {
      if (flow[phase].status === "approved" || flow[phase].status === "pending") fail("El importe está enviado. Operaciones puede devolverlo con un motivo.");
      if (phase === "usd") {
        updates.invoiceFx = Number(input.invoiceFx);
        if (!Number.isFinite(updates.invoiceFx) || updates.invoiceFx <= 0) fail("Ingresá el TC comprador de tu banco al facturar", 400);
      } else {
        if (usesUSD) {
          const usdInvoice = invoices.find(i => (i.invoiceComponent === "usd" || i.invoiceCurrency === "USD") && i.approvalStatus === "approved");
          if (flow.requiresInvoice === false && flow.usd.status !== "approved") fail("Operaciones debe autorizar primero el importe USD.");
          if (flow.requiresInvoice !== false && !usdInvoice) fail("Primero debe estar aprobada la factura USD por Administración.");
          if (input.receivedConfirmed !== true) fail("Confirmá que recibiste los USD en tu cuenta", 400);
          updates.receivedFx = Number(input.receivedFx);
          if (!Number.isFinite(updates.receivedFx) || updates.receivedFx <= 0) fail("Ingresá el TC comprador de tu banco al recibir el dinero", 400);
          flow.receivedConfirmed = true;
        }
        updates.bankCommissionUSD = Number(input.bankCommissionUSD ?? 0);
        flow.extrasARS = Number(input.extrasARS ?? 0);
        if (![updates.bankCommissionUSD, flow.extrasARS].every(v => Number.isFinite(v) && v >= 0)) fail("Extras o comisión inválidos", 400);
        if (!usesUSD && updates.bankCommissionUSD) fail("En sólo ARS ingresá la comisión en pesos", 400);
        flow.extrasReason = String(input.extrasReason ?? "").trim().slice(0, 2000);
        if ((flow.extrasARS > 0 || updates.bankCommissionUSD > 0) && flow.extrasReason.length < 5) fail("Detallá el concepto de los extras o comisión", 400);
      }
      const calc = calculatePersonnelSettlement({ ...row, ...updates, extrasARS: row.extrasARS + flow.extrasARS });
      const amount = phase === "usd" ? calc.totalInvoiceUSD : calc.finalInvoiceARS;
      if (amount == null) fail("Faltan datos para calcular el importe", 400);
      if (amount < 0) fail("El saldo ARS es negativo. Operaciones debe resolver la diferencia antes de emitir; no se genera una factura negativa.");
      Object.assign(updates, { baseInvoiceUSD: calc.baseInvoiceUSD, totalInvoiceUSD: calc.totalInvoiceUSD, pesifiedBaseARS: calc.pesifiedBaseARS, finalInvoiceARS: calc.finalInvoiceARS });
      flow[phase] = { status: "pending", amount, actorId, at: now };
    } else {
      const reason = String(input.reason ?? "").trim().slice(0, 2000);
      if (action === "reopen") {
        if (flow[phase].status !== "approved") fail("Sólo se puede devolver un importe autorizado sin factura");
      } else if (flow[phase].status !== "pending") fail("No hay un importe pendiente de autorización");
      if (action !== "approve" && reason.length < 5) fail("Indicá el motivo de la devolución", 400);
      flow[phase] = { ...flow[phase], status: action === "approve" ? "approved" : "rejected", reason, actorId, at: now };
    }
    flow.version++;
    flow.events = [...(flow.events ?? []), { action: `${action}_${phase}`, actorId, at: now, amount: flow[phase].amount, reason: flow[phase].reason }];
    const [result] = await tx.update(personnelMonthlySettlements).set({ ...updates, workflow: flow, updatedAt: new Date() }).where(eq(personnelMonthlySettlements.id, id)).returning();

    return result;
  });
  const withoutInvoice = saved.workflow.requiresInvoice === false;
  const title = !operations ? "Importe pendiente de autorización" : input.action === "approve"
    ? withoutInvoice ? "Liquidación autorizada sin factura" : "Importe autorizado para facturar"
    : withoutInvoice ? "Revisá los datos de tu liquidación" : "Revisá tu importe antes de facturar";
  await notifySettlement(saved, operations ? "person" : "operations", title).catch(console.error);
  return saved;
}

export function assertSettlementInvoiceAllowed(row: any, component: string, currency: string) {
  if (settlementWorkflow(row.workflow).requiresInvoice === false) fail("Esta liquidación está publicada sin factura; no corresponde subir un comprobante.");
  const phase: SettlementPhase = currency === "USD" ? "usd" : "ars";
  if (!settlementPhases(row).includes(phase)) fail("La moneda no corresponde a la liquidación publicada", 400);
  if (component !== "single" && component !== phase) fail("Moneda incompatible con el tramo", 400);
  const approved = settlementWorkflow(row.workflow)[phase];
  if (approved.status !== "approved") fail("Operaciones debe autorizar este importe antes de emitir y subir la factura.");
  if (!(Number(approved.amount) > 0)) fail("Este tramo no requiere factura porque su saldo es cero.");
  return Number(approved.amount);
}
