import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
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
  financialAccounts,
  exchangeRates,
  monthlyInflation,
  revenueEvents,
  plAdjustments,
  activeProjects,
  quotations,
} from "@shared/schema";
import { financialExtractionSchema, financialMissingFields, type FinancialExtraction } from "./financial-intake-extractor";
import { rebuildNativeFinancialFacts } from "./financial-native-builders";

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
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10) ? null : date;
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
  if (data.netAmount != null && (data.netAmount < 0 || data.netAmount > amount)) throw error("El neto debe estar entre cero y el total.");
  if (data.taxAmount != null && (data.taxAmount < 0 || data.taxAmount > amount)) throw error("Los impuestos deben estar entre cero y el total.");
  const usd = normalizedUsd(amount, currency, data.exchangeRate);
  const netOriginal = data.netAmount ?? (data.taxAmount == null ? amount : Math.max(0, amount - data.taxAmount));
  const netUsd = normalizedUsd(netOriginal, currency, data.exchangeRate);
  return {
    currency,
    originalAmount: String(amount),
    montoARS: currency === "ARS" ? String(amount) : null,
    montoUSD: currency === "USD" ? String(amount) : null,
    cotizacion: data.exchangeRate ? String(data.exchangeRate) : currency === "USD" ? "1" : null,
    montoTotalUSD: String(usd),
    netAmount: String(netOriginal),
    taxAmount: data.taxAmount == null ? null : String(data.taxAmount),
    grossAmount: String(amount),
    outstandingAmount: String(amount),
    usd,
    netUsd,
  };
}

async function ensureOpenPeriod(tx: any, periodKey: string): Promise<void> {
  const [period] = await tx.select({ status: financialClosePeriods.status })
    .from(financialClosePeriods)
    .where(eq(financialClosePeriods.periodKey, periodKey))
    .limit(1);
  if (["IN_REVIEW", "CLOSED"].includes(period?.status ?? "")) throw error(`El período ${periodKey} está ${period?.status === "CLOSED" ? "cerrado" : "en revisión"}. Reabrilo o devolvelo a pre-cierre antes de registrar cambios.`, 409);
  // Si apareció nueva información luego del pre-cierre, invalida ese control.
  // La persona responsable debe volver a ejecutarlo antes de pedir revisión.
  if (period?.status === "PRE_CLOSE") {
    await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, periodKey));
  }
}

async function resolveProjectId(tx: any, projectName: string | null): Promise<number | null> {
  if (!projectName) return null;
  const [project] = await tx.select({ id: activeProjects.id })
    .from(activeProjects)
    .leftJoin(quotations, eq(quotations.id, activeProjects.quotationId))
    .where(or(ilike(activeProjects.name, projectName.trim()), ilike(quotations.projectName, projectName.trim())))
    .limit(1);
  return project?.id ?? null;
}

async function resolveAccountId(tx: any, bank: string | null, currency: string | null): Promise<number | null> {
  if (!bank) return null;
  const bankMatch = `%${bank.trim().replace(/[%_]/g, "")}%`;
  const [account] = await tx.select({ id: financialAccounts.id }).from(financialAccounts).where(and(
    or(ilike(financialAccounts.name, bank.trim()), ilike(financialAccounts.bankName, bank.trim()), ilike(financialAccounts.name, bankMatch), ilike(financialAccounts.bankName, bankMatch)),
    currency ? eq(financialAccounts.currency, currency) : sql`true`,
    eq(financialAccounts.isActive, true),
  )).limit(1);
  return account?.id ?? null;
}

async function revenueLinkForDocument(tx: any, externalId: string | null): Promise<{ id: number; type: string } | null> {
  const intakeId = Number(externalId?.match(/^intake:(\d+):(activo|pasivo)$/)?.[1]);
  if (!intakeId) return null;
  const [source] = await tx.select({ linkedRecords: financialIntakeItems.linkedRecords }).from(financialIntakeItems).where(eq(financialIntakeItems.id, intakeId)).limit(1);
  const links = Array.isArray(source?.linkedRecords) ? source.linkedRecords as Array<{ type?: string; id?: number }> : [];
  const link = links.find((candidate) => ["revenue_event", "revenue_event_linked"].includes(candidate.type ?? "") && Number.isInteger(candidate.id));
  return link?.id ? { id: link.id, type: link.type! } : null;
}

async function findMatchingFeeRevenue(tx: any, data: FinancialExtraction, projectId: number | null, periodKey: string, amountUsd: number) {
  const conditions: any[] = [
    eq(revenueEvents.invoicePeriod, periodKey),
    sql`abs(${revenueEvents.amountUsd}::numeric - ${amountUsd}) < 0.01`,
    sql`${revenueEvents.status} <> 'cancelled'`,
  ];
  if (projectId) conditions.push(eq(revenueEvents.projectId, projectId));
  else if (data.projectName) conditions.push(ilike(revenueEvents.projectName, data.projectName.trim()));
  else conditions.push(ilike(revenueEvents.clientName, (data.clientName ?? data.counterparty ?? "").trim()));
  const candidates = await tx.select().from(revenueEvents).where(and(...conditions)).limit(10);
  for (const candidate of candidates) {
    const sourceIntakeId = Number(candidate.sourceRowId?.match(/^intake:(\d+):revenue$/)?.[1]);
    if (!sourceIntakeId) continue;
    const [source] = await tx.select({ documentKind: financialIntakeItems.documentKind }).from(financialIntakeItems).where(eq(financialIntakeItems.id, sourceIntakeId)).limit(1);
    if (source?.documentKind === "fee_confirmation") return candidate;
  }
  return null;
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
    isInternalTransfer: boolean;
    transferReference: string | null;
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
  const bank = overrides.bank ?? data.bank;
  const accountId = await resolveAccountId(tx, bank, resolved.currency);
  if (overrides.lineIndex != null && (overrides.reference || overrides.description)) {
    const duplicateConditions: any[] = [
      eq(cashflowTransactions.fecha, fecha),
      eq(cashflowTransactions.tipoMovimiento, direction === "IN" ? "Ingreso" : "Egreso"),
      eq(cashflowTransactions.originalAmount, String(amount)),
      eq(cashflowTransactions.moneda, resolved.currency),
      isNull(cashflowTransactions.voidedAt),
      sql`${cashflowTransactions.source} <> 'excel'`,
    ];
    if (accountId) duplicateConditions.push(eq(cashflowTransactions.accountId, accountId));
    else if (bank) duplicateConditions.push(ilike(cashflowTransactions.banco, bank.trim()));
    if (overrides.reference) duplicateConditions.push(ilike(cashflowTransactions.concepto, overrides.reference.trim()));
    else duplicateConditions.push(ilike(cashflowTransactions.detalleOperacion, overrides.description!.trim()));
    const [duplicate] = await tx.select({ id: cashflowTransactions.id }).from(cashflowTransactions).where(and(...duplicateConditions)).limit(1);
    if (duplicate) throw error(`El movimiento ${Number(overrides.lineIndex) + 1} ya coincide con Cashflow #${duplicate.id}. Revisá el extracto antes de publicar.`, 409);
  }
  const [created] = await tx.insert(cashflowTransactions).values({
    fecha,
    periodKey,
    tipoMovimiento: direction === "IN" ? "Ingreso" : "Egreso",
    banco: bank,
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
    reconciliationStatus: overrides.isInternalTransfer ? "matched" : "unmatched",
    transferGroupId: overrides.isInternalTransfer
      ? `intake:${intakeItemId}:transfer:${overrides.transferReference || overrides.reference || "unresolved"}`
      : null,
    accountId,
    projectId: await resolveProjectId(tx, data.projectName),
    createdBy: userId,
    updatedBy: userId,
  }).returning();
  await audit(tx, { periodKey, entityType: "cashflow_transaction", entityId: created.id, action: "created_from_intake", afterData: created, intakeItemId, actorUserId: userId });
  return { record: created, amountOriginal: amount, amountUSD: resolved.usd, periodKey };
}

async function applyReceivablePayment(tx: any, input: { data: FinancialExtraction; cashflowId: number; amountOriginal: number; amountUSD: number; userId: number; intakeItemId: number }): Promise<LinkedRecord | null> {
  if (!input.data.documentNumber) return null;
  const receivableConditions: any[] = [
    eq(activoEntries.nroFactura, input.data.documentNumber),
    isNull(activoEntries.voidedAt),
  ];
  const receivableParty = input.data.counterparty ?? input.data.clientName;
  if (receivableParty) receivableConditions.push(or(ilike(activoEntries.razonSocial, receivableParty), ilike(activoEntries.clienteNombre, receivableParty)));
  const [candidate] = await tx.select().from(activoEntries).where(and(...receivableConditions)).limit(1);
  if (!candidate) return null;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-document:receivable:' + candidate.id}))`);
  const [document] = await tx.select().from(activoEntries).where(eq(activoEntries.id, candidate.id)).limit(1);
  if (!document) return null;
  const gross = Number(document.grossAmount ?? document.originalAmount ?? document.montoUSD ?? document.montoARS ?? 0);
  const current = Number(document.outstandingAmount ?? gross);
  if (current <= 0) return null;
  const documentCurrency = document.currency ?? (document.montoUSD != null ? "USD" : "ARS");
  const paymentInDocumentCurrency = documentCurrency === input.data.currency
    ? input.amountOriginal
    : documentCurrency === "USD"
      ? input.amountUSD
      : input.amountUSD * Number(input.data.exchangeRate ?? document.cotizacion ?? 0);
  if (!(paymentInDocumentCurrency > 0)) throw error("No se pudo convertir el cobro a la moneda de la factura.");
  const appliedOriginal = Math.min(current, paymentInDocumentCurrency);
  const appliedUSD = input.amountUSD * (appliedOriginal / paymentInDocumentCurrency);
  const next = Math.max(0, current - appliedOriginal);
  const status = next === 0 ? "PAID" : "PARTIAL";
  await tx.update(activoEntries).set({ outstandingAmount: String(next), status, cobradoAlCierre: next === 0, fechaPago: input.data.paymentDate ? asDate(input.data.paymentDate) : new Date(), updatedBy: input.userId, updatedAt: new Date() }).where(eq(activoEntries.id, document.id));
  const [application] = await tx.insert(financialDocumentApplications).values({
    direction: "receivable", activoEntryId: document.id, cashflowTransactionId: input.cashflowId,
    amountOriginal: String(appliedOriginal), amountUSD: String(appliedUSD), appliedAt: input.data.paymentDate ? asDate(input.data.paymentDate)! : new Date(),
    notes: input.data.description, createdBy: input.userId,
  }).returning();
  const revenueLink = await revenueLinkForDocument(tx, document.externalId);
  if (status === "PAID" && revenueLink) {
    await tx.update(revenueEvents).set({ collectionPeriodActual: (input.data.paymentDate ?? input.data.issueDate ?? input.data.periodKey)?.slice(0, 7) ?? input.data.periodKey, updatedAt: new Date() }).where(eq(revenueEvents.id, revenueLink.id));
  }
  if (paymentInDocumentCurrency <= current + 0.01) await tx.update(cashflowTransactions).set({ reconciliationStatus: "matched", updatedBy: input.userId, updatedAt: new Date() }).where(eq(cashflowTransactions.id, input.cashflowId));
  await audit(tx, { periodKey: input.data.periodKey, entityType: "activo_entry", entityId: document.id, action: status === "PAID" ? "paid" : "partially_paid", afterData: { outstandingAmount: next, status, applicationId: application.id }, intakeItemId: input.intakeItemId, actorUserId: input.userId });
  return { type: "financial_document_application", id: application.id };
}

async function applyPayablePayment(tx: any, input: { data: FinancialExtraction; cashflowId: number; amountOriginal: number; amountUSD: number; userId: number; intakeItemId: number }): Promise<LinkedRecord | null> {
  if (!input.data.documentNumber) return null;
  const payableConditions: any[] = [
    eq(pasivoEntries.documentNumber, input.data.documentNumber),
    isNull(pasivoEntries.voidedAt),
  ];
  if (input.data.counterparty) payableConditions.push(or(ilike(pasivoEntries.vendorName, input.data.counterparty), ilike(pasivoEntries.detalle, input.data.counterparty)));
  const [candidate] = await tx.select().from(pasivoEntries).where(and(...payableConditions)).limit(1);
  if (!candidate) return null;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-document:payable:' + candidate.id}))`);
  const [document] = await tx.select().from(pasivoEntries).where(eq(pasivoEntries.id, candidate.id)).limit(1);
  if (!document) return null;
  const gross = Number(document.grossAmount ?? document.originalAmount ?? document.montoUSD ?? document.montoARS ?? 0);
  const current = Number(document.outstandingAmount ?? gross);
  if (current <= 0) return null;
  const documentCurrency = document.currency ?? (document.montoUSD != null ? "USD" : "ARS");
  const paymentInDocumentCurrency = documentCurrency === input.data.currency
    ? input.amountOriginal
    : documentCurrency === "USD"
      ? input.amountUSD
      : input.amountUSD * Number(input.data.exchangeRate ?? document.cotizacion ?? 0);
  if (!(paymentInDocumentCurrency > 0)) throw error("No se pudo convertir el pago a la moneda de la factura.");
  const appliedOriginal = Math.min(current, paymentInDocumentCurrency);
  const appliedUSD = input.amountUSD * (appliedOriginal / paymentInDocumentCurrency);
  const next = Math.max(0, current - appliedOriginal);
  const status = next === 0 ? "PAID" : "PARTIAL";
  await tx.update(pasivoEntries).set({ outstandingAmount: String(next), status, pagadoAlCierre: next === 0, fechaPago: input.data.paymentDate ? asDate(input.data.paymentDate) : new Date(), updatedBy: input.userId, updatedAt: new Date() }).where(eq(pasivoEntries.id, document.id));
  const [application] = await tx.insert(financialDocumentApplications).values({
    direction: "payable", pasivoEntryId: document.id, cashflowTransactionId: input.cashflowId,
    amountOriginal: String(appliedOriginal), amountUSD: String(appliedUSD), appliedAt: input.data.paymentDate ? asDate(input.data.paymentDate)! : new Date(),
    notes: input.data.description, createdBy: input.userId,
  }).returning();
  if (paymentInDocumentCurrency <= current + 0.01) await tx.update(cashflowTransactions).set({ reconciliationStatus: "matched", updatedBy: input.userId, updatedAt: new Date() }).where(eq(cashflowTransactions.id, input.cashflowId));
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

    const parsedData = financialExtractionSchema.parse(item.extractedData);
    const data = { ...parsedData, missingFields: financialMissingFields(parsedData) };
    if (data.documentKind === "unknown") throw error("Elegí el tipo de operación antes de publicar.");
    if (data.missingFields.length > 0) throw error(`Completá los campos pendientes: ${data.missingFields.join(", ")}.`);
    const lockPeriods = new Set<string>();
    if (data.periodKey) lockPeriods.add(data.periodKey);
    if (data.documentKind === "bank_statement") data.lineItems.forEach((line) => { if (line.date) lockPeriods.add(line.date.slice(0, 7)); });
    if (data.documentKind === "exchange_rate") data.lineItems.forEach((line) => { if (line.date) lockPeriods.add(line.date.slice(0, 7)); });
    for (const periodKey of [...lockPeriods].sort()) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
    }

    // El hash evita repetir el mismo archivo; esta firma de negocio evita que
    // una foto distinta o un texto manual vuelvan a publicar el mismo hecho.
    let duplicateResult: any = null;
    if (data.documentNumber) {
      duplicateResult = await tx.execute(sql`
        SELECT id FROM financial_intake_items
        WHERE id <> ${intakeItemId} AND status = 'posted' AND document_kind = ${data.documentKind}
          AND lower(extracted_data->>'documentNumber') = lower(${data.documentNumber})
          AND lower(COALESCE(extracted_data->>'counterparty', extracted_data->>'clientName', ''))
              = lower(${data.counterparty ?? data.clientName ?? ""})
        LIMIT 1
      `);
    } else if (["customer_collection", "supplier_payment"].includes(data.documentKind)) {
      duplicateResult = await tx.execute(sql`
        SELECT id FROM financial_intake_items
        WHERE id <> ${intakeItemId} AND status = 'posted' AND document_kind = ${data.documentKind}
          AND COALESCE(extracted_data->>'paymentDate', extracted_data->>'issueDate', '') = ${data.paymentDate ?? data.issueDate ?? ""}
          AND NULLIF(extracted_data->>'totalAmount','')::numeric = ${String(data.totalAmount)}::numeric
          AND lower(COALESCE(extracted_data->>'counterparty', extracted_data->>'clientName', ''))
              = lower(${data.counterparty ?? data.clientName ?? ""})
        LIMIT 1
      `);
    }
    const duplicateRows = Array.isArray(duplicateResult) ? duplicateResult : duplicateResult?.rows;
    if (duplicateRows?.length) throw error(`Esta operación coincide con la carga #${duplicateRows[0].id}, ya contabilizada.`, 409);

    const linkedRecords: LinkedRecord[] = [];
    const warnings: string[] = [...data.warnings];
    const periodsToRebuild = new Set<string>(data.periodKey ? [data.periodKey] : []);

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

      const matchingFee = await findMatchingFeeRevenue(tx, data, projectId, periodKey, money.netUsd);
      if (matchingFee) {
        const [revenue] = await tx.update(revenueEvents).set({
          projectId, clientName: data.clientName ?? data.counterparty ?? matchingFee.clientName, projectName: data.projectName ?? matchingFee.projectName,
          amountUsd: String(money.netUsd), amountNative: money.netAmount, currency: money.currency, fxRate: money.cotizacion,
          invoicePeriod: periodKey, collectionPeriodExpected: data.dueDate?.slice(0, 7) ?? matchingFee.collectionPeriodExpected,
          paymentTermsDays: data.paymentTermsDays ?? matchingFee.paymentTermsDays, confirmed: true, status: "confirmed", isEstimate: false,
          deliveryStart: data.deliveryStart ?? matchingFee.deliveryStart ?? periodKey,
          deliveryEnd: data.deliveryEnd ?? matchingFee.deliveryEnd ?? data.deliveryStart ?? periodKey,
          deliveryCurve: data.deliveryCurve ?? matchingFee.deliveryCurve ?? "invoice", note: data.description ?? matchingFee.note, updatedAt: new Date(),
        }).where(eq(revenueEvents.id, matchingFee.id)).returning();
        linkedRecords.push({ type: "revenue_event_linked", id: revenue.id });
        await audit(tx, { periodKey, entityType: "revenue_event", entityId: revenue.id, action: "invoice_linked", afterData: revenue, intakeItemId, actorUserId: userId });
      } else {
        const [revenue] = await tx.insert(revenueEvents).values({
          projectId, clientName: data.clientName ?? data.counterparty ?? "Cliente sin resolver", projectName: data.projectName,
          amountUsd: String(money.netUsd), amountNative: money.netAmount, currency: money.currency, fxRate: money.cotizacion,
          invoicePeriod: periodKey,
          collectionPeriodExpected: data.dueDate?.slice(0, 7) ?? null,
          paymentTermsDays: data.paymentTermsDays, confirmed: true, status: "confirmed", sourceTab: "mind_intake",
          sourceRowId: `intake:${intakeItemId}:revenue`, isEstimate: false, periodClosed: false, note: data.description,
          deliveryStart: data.deliveryStart ?? periodKey, deliveryEnd: data.deliveryEnd ?? data.deliveryStart ?? periodKey,
          deliveryCurve: data.deliveryCurve ?? "invoice",
        }).returning();
        linkedRecords.push({ type: "revenue_event", id: revenue.id });
        await audit(tx, { periodKey, entityType: "revenue_event", entityId: revenue.id, action: "created_from_intake", afterData: revenue, intakeItemId, actorUserId: userId });
      }
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
      periodsToRebuild.add(movement.periodKey);
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
        periodsToRebuild.add(movement.periodKey);
        linkedRecords.push({ type: "cashflow_transaction", id: movement.record.id });
      }
    } else if (data.documentKind === "fee_confirmation") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const money = moneyColumns(data, amount);
      const [revenue] = await tx.insert(revenueEvents).values({
        projectId: await resolveProjectId(tx, data.projectName), clientName: data.clientName ?? data.counterparty ?? "Cliente sin resolver",
        projectName: data.projectName, amountUsd: String(money.netUsd), amountNative: money.netAmount, currency: money.currency,
        fxRate: money.cotizacion, invoicePeriod: periodKey, deliveryStart: data.deliveryStart ?? periodKey, deliveryEnd: data.deliveryEnd ?? data.deliveryStart ?? periodKey,
        deliveryCurve: data.deliveryCurve ?? "invoice", paymentTermsDays: data.paymentTermsDays, confirmed: true, status: "confirmed",
        sourceTab: "mind_intake", sourceRowId: `intake:${intakeItemId}:revenue`, isEstimate: false, periodClosed: false, note: data.description,
      }).returning();
      linkedRecords.push({ type: "revenue_event", id: revenue.id });
      await audit(tx, { periodKey, entityType: "revenue_event", entityId: revenue.id, action: "created_from_intake", afterData: revenue, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "exchange_rate") {
      const rateRows = data.lineItems.length
        ? data.lineItems.map((line) => ({ periodKey: line.date!.slice(0, 7), rate: line.amount, date: line.date, note: line.description, estimated: true }))
        : [{ periodKey: requirePeriod(data), rate: Number(data.exchangeRate ?? data.totalAmount), date: data.issueDate, note: data.description, estimated: false }];
      for (const rateRow of rateRows) {
        await ensureOpenPeriod(tx, rateRow.periodKey);
        if (!Number.isFinite(rateRow.rate) || rateRow.rate <= 0) throw error("Confirmá una cotización mayor a cero.");
        const [year, month] = rateRow.periodKey.split("-").map(Number);
        const [fx] = await tx.insert(exchangeRates).values({ year, month, rate: String(rateRow.rate), rateType: rateRow.estimated ? "estimated" : "end_of_month", specificDate: asDate(rateRow.date), notes: rateRow.note, source: rateRow.estimated || /\brem\b/i.test(data.description ?? "") ? "REM" : "Manual", isActive: true, createdBy: userId, updatedBy: userId }).returning();
        linkedRecords.push({ type: "exchange_rate", id: fx.id });
        periodsToRebuild.add(rateRow.periodKey);
        await audit(tx, { periodKey: rateRow.periodKey, entityType: "exchange_rate", entityId: fx.id, action: "created_from_intake", afterData: fx, intakeItemId, actorUserId: userId });
      }
    } else if (data.documentKind === "inflation") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const rawRate = requireAmount(data);
      const inflationRate = rawRate > 1 ? rawRate / 100 : rawRate;
      if (!(inflationRate > 0 && inflationRate <= 1)) throw error("La inflación mensual debe estar entre 0% y 100%.");
      const [year, month] = periodKey.split("-").map(Number);
      const [existing] = await tx.select().from(monthlyInflation).where(and(eq(monthlyInflation.year, year), eq(monthlyInflation.month, month))).limit(1);
      const [saved] = existing
        ? await tx.update(monthlyInflation).set({ inflationRate, source: data.counterparty ?? "Mind", updatedBy: userId, updatedAt: new Date() }).where(eq(monthlyInflation.id, existing.id)).returning()
        : await tx.insert(monthlyInflation).values({ year, month, inflationRate, source: data.counterparty ?? "Mind", updatedBy: userId }).returning();
      linkedRecords.push({ type: "monthly_inflation", id: saved.id });
      await audit(tx, { periodKey, entityType: "monthly_inflation", entityId: saved.id, action: existing ? "updated_from_intake" : "created_from_intake", afterData: saved, intakeItemId, actorUserId: userId });
    } else if (data.documentKind === "provision") {
      const periodKey = requirePeriod(data);
      await ensureOpenPeriod(tx, periodKey);
      const amount = requireAmount(data);
      const isRecovery = /recuper/i.test(data.description ?? "");
      const [provision] = await tx.insert(provisionEntries).values({
        periodKey, projectId: await resolveProjectId(tx, data.projectName), clienteNombre: data.clientName ?? data.counterparty,
        tipo: isRecovery ? "RECUPERO" : "NUEVA_PROVISION", montoProvision: String(amount),
        criterio: data.description, mesAplicacion: periodKey, currency: data.currency ?? "USD", status: "PROPOSED",
        remainingAmount: String(isRecovery ? 0 : amount), createdBy: userId,
      }).returning();
      const [movement] = await tx.insert(provisionMovements).values({ provisionId: provision.id, periodKey, movementType: isRecovery ? "recovery" : "initial", amount: String(isRecovery ? -amount : amount), currency: data.currency ?? "USD", note: data.description, createdBy: userId }).returning();
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
        fechaEmision: asDate(data.issueDate), fechaVencimiento: asDate(data.dueDate), status: "PENDING", costTreatment: "balance_only",
        source: "mind_intake", externalId: `intake:${intakeItemId}:tax`, originalAmount: money.originalAmount,
        netAmount: money.netAmount, taxAmount: money.taxAmount, grossAmount: money.grossAmount, outstandingAmount: money.outstandingAmount,
        currency: money.currency, montoARS: money.montoARS, montoUSD: money.montoUSD, cotizacion: money.cotizacion,
        montoTotalUSD: money.montoTotalUSD, overrideManual: true, createdBy: userId, updatedBy: userId,
      }).returning();
      linkedRecords.push({ type: "pl_adjustment", id: adjustment.id }, { type: "pasivo_entry", id: pasivo.id });
      await audit(tx, { periodKey, entityType: "tax_settlement", entityId: adjustment.id, action: "created_from_intake", afterData: { adjustment, pasivo }, intakeItemId, actorUserId: userId });
    }

    for (const periodKey of periodsToRebuild) await rebuildNativeFinancialFacts(periodKey, tx);
    await tx.update(financialIntakeItems).set({ status: "posted", linkedRecords, reviewedBy: userId, reviewedAt: new Date(), postedAt: new Date(), updatedAt: new Date() }).where(eq(financialIntakeItems.id, intakeItemId));
    await audit(tx, { periodKey: data.periodKey, entityType: "financial_intake_item", entityId: intakeItemId, action: "posted", afterData: { linkedRecords, warnings }, intakeItemId, actorUserId: userId });
    return { linkedRecords, warnings };
  });
}
