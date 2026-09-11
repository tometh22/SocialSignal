import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  activoEntries,
  pasivoEntries,
  provisionEntries,
  provisionMovements,
  cashflowTransactions,
  financialDocumentApplications,
  financialIntakeItems,
  financialAuditEvents,
  financialClosePeriods,
  exchangeRates,
  revenueEvents,
  plAdjustments,
  activeProjects,
} from "@shared/schema";
import { financialExtractionSchema, type FinancialExtraction } from "./financial-intake-extractor";

interface LinkedRecord {
  type: string;
  id: number;
}

export interface FinancialPostingResult {
  linkedRecords: LinkedRecord[];
  warnings: string[];
}

function error(message: string, statusCode = 400): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function asDate(value: string | null, fallback?: Date): Date | null {
  if (!value) return fallback ?? null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback ?? null : date;
}

function requirePeriod(data: FinancialExtraction): string {
  if (!data.periodKey || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.periodKey)) {
    throw error("Confirmá el período contable antes de publicar.");
  }
  return data.periodKey;
}

function requireAmount(data: FinancialExtraction): number {
  const amount = Number(data.totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw error("Confirmá un importe total mayor a cero.");
  return amount;
}

function normalizedUsd(amount: number, currency: FinancialExtraction["currency"], fx: number | null): number {
  if (currency === "USD") return amount;
  if (currency === "ARS" && fx && fx > 0) return amount / fx;
  throw error("Para importes que no están en USD necesitás confirmar una cotización válida.");
}

function moneyColumns(data: FinancialExtraction, amount: number) {
  const currency = data.currency;
  if (!currency) throw error("Confirmá la moneda antes de publicar.");
  if (!new Set(["ARS", "USD"]).has(currency)) {
    throw error("Por ahora la contabilización admite ARS o USD. Convertí o confirmá la moneda.");
  }
  const usd = normalizedUsd(amount, currency, data.exchangeRate);
  return {
    currency,
    originalAmount: String(amount),
    montoARS: currency === "ARS" ? String(amount) : null,
    montoUSD: currency === "USD" ? String(amount) : null,
    cotizacion: data.exchangeRate ? String(data.exchangeRate) : currency === "USD" ? "1" : null,
    montoTotalUSD: String(usd),
    netAmount: data.netAmount == null ? null : String(data.netAmount),
    taxAmount: data.taxAmount == null ? null : String(data.taxAmount),
    grossAmount: String(amount),
    outstandingAmount: String(amount),
    usd,
  };
}

async function ensureOpenPeriod(tx: any, periodKey: string): Promise<void> {
  const [period] = await tx.select({ status: financialClosePeriods.status })
    .from(financialClosePeriods)
    .where(eq(financialClosePeriods.periodKey, periodKey))
    .limit(1);
  if (period?.status === "CLOSED") throw error(`El período ${periodKey} está cerrado. Reabrilo antes de registrar cambios.`, 409);
}

async function resolveProjectId(tx: any, projectName: string | null): Promise<number | null> {
  if (!projectName) return null;
  const [project] = await tx.select({ id: activeProjects.id })
    .from(activeProjects)
    .where(ilike(activeProjects.name, projectName.trim()))
    .limit(1);
  return project?.id ?? null;
}

async function audit(
  tx: any,
  input: { periodKey?: string | null; entityType: string; entityId?: number | null; action: string; afterData?: Record<string, unknown>; intakeItemId: number; actorUserId: number },
) {
  await tx.insert(financialAuditEvents).values({
    periodKey: input.periodKey ?? null,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    afterData: input.afterData ?? null,
    intakeItemId: input.intakeItemId,
    actorUserId: input.actorUserId,
  });
}

async function createCashflow(
  tx: any,
  intakeItemId: number,
  userId: number,
  data: FinancialExtraction,
  overrides: Partial<{
    date: string | null;
    description: string | null;
    amount: number;
    currency: "ARS" | "USD" | "EUR" | "OTHER";
    direction: "IN" | "OUT";
    bank: string | null;
    reference: string | null;
    lineIndex: number;
  }> = {},
) {
  const periodKey = overrides.date?.slice(0, 7) || requirePeriod(data);
  await ensureOpenPeriod(tx, periodKey);
  const amount = overrides.amount ?? requireAmount(data);
  const currency = overrides.currency ?? data.currency;
  const resolved = moneyColumns({ ...data, currency }, amount);
  const direction = overrides.direction
    ?? (data.documentKind === "customer_collection" ? "IN" : "OUT");
  const fecha = asDate(overrides.date ?? data.paymentDate ?? data.issueDate, new Date());
  if (!fecha) throw error("Confirmá la fecha del movimiento.");
  const suffix = overrides.lineIndex == null ? "movement" : `line:${overrides.lineIndex}`;
  const [created] = await tx.insert(cashflowTransactions).values({
    fecha,
    periodKey,
    tipoMovimiento: direction === "IN" ? "Ingreso" : "Egreso",
    banco: overrides.bank ?? data.bank,
    moneda: resolved.currency,
    clienteNombre: data.clientName,
    counterparty: data.counterparty,
    detalleOperacion: overrides.description ?? data.description,
    concepto: overrides.reference ?? data.documentNumber,
    montoARS: resolved.montoARS,
    cotizacion: resolved.cotizacion,
    montoUSD: resolved.montoTotalUSD,
    originalAmount: resolved.originalAmount,
    externalId: `intake:${intakeItemId}:${suffix}`,
    source: "mind_intake",
    reconciliationStatus: "unmatched",
    projectId: await resolveProjectId(tx, data.projectName),
    createdBy: userId,
    updatedBy: userId,
  }).returning();
  await audit(tx, { periodKey, entityType: "cashflow_transaction", entityId: created.id, action: "created_from_intake", afterData: created, intakeItemId, actorUserId: userId });
  return { record: created, amountOriginal: amount, amountUSD: resolved.usd };
}

async function applyReceivablePayment(tx: any, input: { data: FinancialExtraction; cashflowId: number; amountOriginal: number; amountUSD: number; userId: number; intakeItemId: number }): Promise<LinkedRecord | null> {
  if (!input.data.documentNumber) return null;
  const [document] = await tx.select().from(activoEntries).where(and(
    eq(activoEntries.nroFactura, input.data.documentNumber),
    isNull(activoEntries.voidedAt),
  )).limit(1);
  if (!document) return null;
  const gross = Number(document.grossAmount ?? document.originalAmount ?? document.montoUSD ?? document.montoARS ?? 0);
  const current = Number(document.outstandingAmount ?? gross);
  const next = Math.max(0, current - input.amountOriginal);
  const status = next === 0 ? "PAID" : "PARTIAL";
  await tx.update(activoEntries).set({ outstandingAmount: String(next), status, cobradoAlCierre: next === 0, fechaPago: input.data.paymentDate ? asDate(input.data.paymentDate) : new Date(), updatedBy: input.userId, updatedAt: new Date() }).where(eq(activoEntries.id, document.id));
  const [application] = await tx.insert(financialDocumentApplications).values({
    direction: "receivable", activoEntryId: document.id, cashflowTransactionId: input.cashflowId,
    amountOriginal: String(input.amountOriginal), amountUSD: String(input.amountUSD), appliedAt: input.data.paymentDate ? asDate(input.data.paymentDate)! : new Date(),
    notes: input.data.description, createdBy: input.userId,
  }).returning();
  await audit(tx, { periodKey: input.data.periodKey, entityType: "activo_entry", entityId: document.id, action: status === "PAID" ? "paid" : "partially_paid", afterData: { outstandingAmount: next, status, applicationId: application.id }, intakeItemId: input.intakeItemId, actorUserId: input.userId });
  return { type: "financial_document_application", id: application.id };
}

async function applyPayablePayment(tx: any, input: { data: FinancialExtraction; cashflowId: number; amountOriginal: number; amountUSD: number; userId: number; intakeItemId: number }): Promise<LinkedRecord | null> {
  if (!input.data.documentNumber) return null;
  const [document] = await tx.select().from(pasivoEntries).where(and(
    eq(pasivoEntries.documentNumber, input.data.documentNumber),
    isNull(pasivoEntries.voidedAt),
  )).limit(1);
  if (!document) return null;
  const gross = Number(document.grossAmount ?? document.originalAmount ?? document.montoUSD ?? document.montoARS ?? 0);
  const current = Number(document.outstandingAmount ?? gross);
  const next = Math.max(0, current - input.amountOriginal);
  const status = next === 0 ? "PAID" : "PARTIAL";
  await tx.update(pasivoEntries).set({ outstandingAmount: String(next), status, pagadoAlCierre: next === 0, fechaPago: input.data.paymentDate ? asDate(input.data.paymentDate) : new Date(), updatedBy: input.userId, updatedAt: new Date() }).where(eq(pasivoEntries.id, document.id));
  const [application] = await tx.insert(financialDocumentApplications).values({
    direction: "payable", pasivoEntryId: document.id, cashflowTransactionId: input.cashflowId,
    amountOriginal: String(input.amountOriginal), amountUSD: String(input.amountUSD), appliedAt: input.data.paymentDate ? asDate(input.data.paymentDate)! : new Date(),
    notes: input.data.description, createdBy: input.userId,
  }).returning();
  await audit(tx, { periodKey: input.data.periodKey, entityType: "pasivo_entry", entityId: document.id, action: status === "PAID" ? "paid" : "partially_paid", afterData: { outstandingAmount: next, status, applicationId: application.id }, intakeItemId: input.intakeItemId, actorUserId: input.userId });
  return { type: "financial_document_application", id: application.id };
}

export async function postFinancialIntakeItem(intakeItemId: number, userId: number): Promise<FinancialPostingResult> {
  return db.transaction(async (tx) => {
    // Serializa dos clics simultáneos sobre la misma carga. Los índices únicos
    // siguen siendo la última barrera de idempotencia para los asientos.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-intake:' + intakeItemId}))`);
    const [item] = await tx.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, intakeItemId)).limit(1);
    if (!item) throw error("La carga no existe.", 404);
    if (item.status === "posted") return { linkedRecords: item.linkedRecords ?? [], warnings: ["La carga ya estaba contabilizada."] };
    if (["processing", "received", "failed", "rejected"].includes(item.status)) throw error("La carga todavía no está lista para contabilizar.", 409);

    const data = financialExtractionSchema.parse(item.extractedData);
    if (data.documentKind === "unknown") throw error("Elegí el tipo de operación antes de publicar.");
    if (data.missingFields.length > 0) throw error(`Completá los campos pendientes: ${data.missingFields.join(", ")}.`);

    const linkedRecords: LinkedRecord[] = [];
    const warnings: string[] = [...data.warnings];

    if (data.documentKind === "customer_invoice") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const money = moneyColumns(data, amount);
      const projectId = await resolveProjectId(tx, data.projectName);
      const [activo] = await tx.insert(activoEntries).values({
        periodKey, tipoActivo: "Cuentas a Cobrar", concepto: "Factura", detalle: data.description,
        clienteNombre: data.clientName ?? data.counterparty, razonSocial: data.counterparty,
        nroFactura: data.documentNumber, fechaFacturacion: asDate(data.issueDate), fechaVencimiento: asDate(data.dueDate),
        projectId, documentType: "invoice", status: "PENDING", source: "mind_intake", externalId: `intake:${intakeItemId}:activo`,
        originalAmount: money.originalAmount, netAmount: money.netAmount, taxAmount: money.taxAmount, grossAmount: money.grossAmount,
        outstandingAmount: money.outstandingAmount, currency: money.currency, montoARS: money.montoARS, montoUSD: money.montoUSD,
        cotizacion: money.cotizacion, montoTotalUSD: money.montoTotalUSD, overrideManual: true, createdBy: userId, updatedBy: userId,
      }).returning();
      linkedRecords.push({ type: "activo_entry", id: activo.id });
      await audit(tx, { periodKey, entityType: "activo_entry", entityId: activo.id, action: "created_from_intake", afterData: activo, intakeItemId, actorUserId: userId });

      const [revenue] = await tx.insert(revenueEvents).values({
        projectId, clientName: data.clientName ?? data.counterparty ?? "Cliente sin resolver", projectName: data.projectName,
        amountUsd: String(money.usd), amountNative: money.originalAmount, currency: money.currency, fxRate: money.cotizacion,
        invoicePeriod: periodKey, deliveryStart: periodKey, deliveryEnd: periodKey, deliveryCurve: "invoice",
        collectionPeriodExpected: data.dueDate?.slice(0, 7) ?? null,
        paymentTermsDays: data.paymentTermsDays, confirmed: true, status: "confirmed", sourceTab: "mind_intake",
        sourceRowId: `intake:${intakeItemId}:revenue`, isEstimate: false, periodClosed: false, note: data.description,
        deliveryStart: data.deliveryStart ?? periodKey, deliveryEnd: data.deliveryEnd ?? data.deliveryStart ?? periodKey,
        deliveryCurve: data.deliveryCurve ?? "invoice",
      }).returning();
      linkedRecords.push({ type: "revenue_event", id: revenue.id });
      await audit(tx, { periodKey, entityType: "revenue_event", entityId: revenue.id, action: "created_from_intake", afterData: revenue, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "supplier_invoice") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const money = moneyColumns(data, amount);
      const [pasivo] = await tx.insert(pasivoEntries).values({
        periodKey, detalle: data.counterparty ?? "Proveedor sin resolver", vendorName: data.counterparty,
        concepto: data.documentNumber, descripcion: data.description, documentNumber: data.documentNumber,
        fechaEmision: asDate(data.issueDate), fechaVencimiento: asDate(data.dueDate), projectId: await resolveProjectId(tx, data.projectName),
        subtipoCosto: data.costSubtype, status: "PENDING", costTreatment: data.costTreatment ?? "unclassified", source: "mind_intake", externalId: `intake:${intakeItemId}:pasivo`,
        originalAmount: money.originalAmount, netAmount: money.netAmount, taxAmount: money.taxAmount, grossAmount: money.grossAmount,
        outstandingAmount: money.outstandingAmount, currency: money.currency, montoARS: money.montoARS, montoUSD: money.montoUSD,
        cotizacion: money.cotizacion, montoTotalUSD: money.montoTotalUSD, overrideManual: true, createdBy: userId, updatedBy: userId,
      }).returning();
      linkedRecords.push({ type: "pasivo_entry", id: pasivo.id });
      await audit(tx, { periodKey, entityType: "pasivo_entry", entityId: pasivo.id, action: "created_from_intake", afterData: pasivo, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "customer_collection" || data.documentKind === "supplier_payment") {
      const movement = await createCashflow(tx, intakeItemId, userId, data);
      linkedRecords.push({ type: "cashflow_transaction", id: movement.record.id });
      const application = data.documentKind === "customer_collection"
        ? await applyReceivablePayment(tx, { data, cashflowId: movement.record.id, amountOriginal: movement.amountOriginal, amountUSD: movement.amountUSD, userId, intakeItemId })
        : await applyPayablePayment(tx, { data, cashflowId: movement.record.id, amountOriginal: movement.amountOriginal, amountUSD: movement.amountUSD, userId, intakeItemId });
      if (application) linkedRecords.push(application);
      else warnings.push("No se encontró un documento para conciliar; el movimiento quedó pendiente de matching.");
    } else if (data.documentKind === "bank_statement") {
      if (data.lineItems.length === 0) throw error("El extracto no contiene movimientos extraídos para publicar.");
      for (let index = 0; index < data.lineItems.length; index++) {
        const line = data.lineItems[index];
        const movement = await createCashflow(tx, intakeItemId, userId, data, { ...line, lineIndex: index });
        linkedRecords.push({ type: "cashflow_transaction", id: movement.record.id });
      }
    } else if (data.documentKind === "fee_confirmation") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const money = moneyColumns(data, amount);
      const [revenue] = await tx.insert(revenueEvents).values({
        projectId: await resolveProjectId(tx, data.projectName), clientName: data.clientName ?? data.counterparty ?? "Cliente sin resolver",
        projectName: data.projectName, amountUsd: String(money.usd), amountNative: money.originalAmount, currency: money.currency,
        fxRate: money.cotizacion, invoicePeriod: periodKey, deliveryStart: data.deliveryStart ?? periodKey, deliveryEnd: data.deliveryEnd ?? data.deliveryStart ?? periodKey,
        deliveryCurve: data.deliveryCurve ?? "invoice", paymentTermsDays: data.paymentTermsDays, confirmed: true, status: "confirmed",
        sourceTab: "mind_intake", sourceRowId: `intake:${intakeItemId}:revenue`, isEstimate: false, periodClosed: false, note: data.description,
      }).returning();
      linkedRecords.push({ type: "revenue_event", id: revenue.id });
      await audit(tx, { periodKey, entityType: "revenue_event", entityId: revenue.id, action: "created_from_intake", afterData: revenue, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "exchange_rate") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const rate = Number(data.exchangeRate ?? data.totalAmount);
      if (!Number.isFinite(rate) || rate <= 0) throw error("Confirmá una cotización mayor a cero.");
      const [year, month] = periodKey.split("-").map(Number);
      const [fx] = await tx.insert(exchangeRates).values({ year, month, rate: String(rate), rateType: "end_of_month", specificDate: asDate(data.issueDate), notes: data.description, source: "Manual", isActive: true, createdBy: userId, updatedBy: userId }).returning();
      linkedRecords.push({ type: "exchange_rate", id: fx.id });
      await audit(tx, { periodKey, entityType: "exchange_rate", entityId: fx.id, action: "created_from_intake", afterData: fx, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "provision") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const [provision] = await tx.insert(provisionEntries).values({
        periodKey, projectId: await resolveProjectId(tx, data.projectName), clienteNombre: data.clientName ?? data.counterparty,
        tipo: /recuper/i.test(data.description ?? "") ? "RECUPERO" : "NUEVA_PROVISION", montoProvision: String(amount),
        criterio: data.description, mesAplicacion: periodKey, currency: data.currency ?? "USD", status: "PROPOSED",
        remainingAmount: String(amount), createdBy: userId,
      }).returning();
      const [movement] = await tx.insert(provisionMovements).values({ provisionId: provision.id, periodKey, movementType: "initial", amount: String(amount), currency: data.currency ?? "USD", note: data.description, createdBy: userId }).returning();
      linkedRecords.push({ type: "provision_entry", id: provision.id }, { type: "provision_movement", id: movement.id });
      await audit(tx, { periodKey, entityType: "provision_entry", entityId: provision.id, action: "proposed_from_intake", afterData: provision, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "tax_settlement") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const money = moneyColumns(data, amount);
      const [adjustment] = await tx.insert(plAdjustments).values({ periodKey, type: "impuesto", concept: data.description ?? data.documentNumber ?? "Liquidación impositiva", amountUsd: String(money.usd) }).returning();
      const [pasivo] = await tx.insert(pasivoEntries).values({
        periodKey, detalle: data.counterparty ?? "Impuestos", vendorName: data.counterparty, subtipoCosto: "Impuestos",
        concepto: data.documentNumber, descripcion: data.description, documentNumber: data.documentNumber,
        fechaEmision: asDate(data.issueDate), fechaVencimiento: asDate(data.dueDate), status: "PENDING", costTreatment: "provision",
        source: "mind_intake", externalId: `intake:${intakeItemId}:tax`, originalAmount: money.originalAmount,
        netAmount: money.netAmount, taxAmount: money.taxAmount, grossAmount: money.grossAmount, outstandingAmount: money.outstandingAmount,
        currency: money.currency, montoARS: money.montoARS, montoUSD: money.montoUSD, cotizacion: money.cotizacion,
        montoTotalUSD: money.montoTotalUSD, overrideManual: true, createdBy: userId, updatedBy: userId,
      }).returning();
      linkedRecords.push({ type: "pl_adjustment", id: adjustment.id }, { type: "pasivo_entry", id: pasivo.id });
      await audit(tx, { periodKey, entityType: "tax_settlement", entityId: adjustment.id, action: "created_from_intake", afterData: { adjustment, pasivo }, intakeItemId, actorUserId: userId });
    }

    await tx.update(financialIntakeItems).set({ status: "posted", linkedRecords, reviewedBy: userId, reviewedAt: new Date(), postedAt: new Date(), updatedAt: new Date() }).where(eq(financialIntakeItems.id, intakeItemId));
    await audit(tx, { periodKey: data.periodKey, entityType: "financial_intake_item", entityId: intakeItemId, action: "posted", afterData: { linkedRecords, warnings }, intakeItemId, actorUserId: userId });
    return { linkedRecords, warnings };
  });
}
