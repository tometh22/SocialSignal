import { createHash } from "node:crypto";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { clients, clientBillingEntities, roles, quotations, quotationTeamMembers, quotationVariants, quotationRevisions, quotationApprovals, quotationEvents, proposalDocuments } from "@shared/schema";
import { stableQuotationSnapshot } from "@shared/utils/quotation-commercial";
import { canWithdrawQuotationApproval } from "@shared/utils/quotation-approval";
import type { db } from "../db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = { id: number; isAdmin?: boolean | null; role?: string | null; permissions?: string[] | null };

export async function buildQuotationSnapshot(executor: any, quotationId: number) {
  const [quotation] = await executor.select().from(quotations).where(eq(quotations.id, quotationId));
  if (!quotation) throw new Error("Quotation not found");
  const [clientRows, billingRows, baseTeam, variants, allVariantMembers] = await Promise.all([
    executor.select().from(clients).where(eq(clients.id, quotation.clientId)),
    quotation.billingEntityId
      ? executor.select().from(clientBillingEntities).where(eq(clientBillingEntities.id, quotation.billingEntityId))
      : Promise.resolve([]),
    executor.select({
      id: quotationTeamMembers.id,
      roleId: quotationTeamMembers.roleId,
      roleName: roles.name,
      hours: quotationTeamMembers.hours,
      rate: quotationTeamMembers.rate,
      cost: quotationTeamMembers.cost,
      personnelId: quotationTeamMembers.personnelId,
    }).from(quotationTeamMembers)
      .leftJoin(roles, eq(roles.id, quotationTeamMembers.roleId))
      .where(and(eq(quotationTeamMembers.quotationId, quotationId), isNull(quotationTeamMembers.variantId))),
    executor.select().from(quotationVariants)
      .where(eq(quotationVariants.quotationId, quotationId))
      .orderBy(asc(quotationVariants.variantOrder)),
    executor.select({
      id: quotationTeamMembers.id,
      variantId: quotationTeamMembers.variantId,
      roleId: quotationTeamMembers.roleId,
      roleName: roles.name,
      hours: quotationTeamMembers.hours,
      rate: quotationTeamMembers.rate,
      cost: quotationTeamMembers.cost,
      personnelId: quotationTeamMembers.personnelId,
    }).from(quotationTeamMembers)
      .leftJoin(roles, eq(roles.id, quotationTeamMembers.roleId))
      .where(and(eq(quotationTeamMembers.quotationId, quotationId), isNotNull(quotationTeamMembers.variantId))),
  ]);
  return {
    quotation,
    client: clientRows[0] ?? null,
    billingEntity: billingRows[0] ?? null,
    team: baseTeam,
    variants: variants.map((variant: any) => ({
      ...variant,
      team: allVariantMembers.filter((member: any) => member.variantId === variant.id),
    })),
  };
}

export async function persistQuotationRevision(
  executor: any,
  quotationId: number,
  actorUserId: number | null,
  reason: string,
) {
  const snapshot = await buildQuotationSnapshot(executor, quotationId);
  const serialized = stableQuotationSnapshot(snapshot);
  const documentHash = createHash("sha256").update(serialized).digest("hex");
  const revisionNumber = Number(snapshot.quotation.revisionNumber) || 1;
  const [revision] = await executor.insert(quotationRevisions).values({
    quotationId,
    revisionNumber,
    status: snapshot.quotation.status,
    snapshot,
    documentHash,
    reason,
    createdBy: actorUserId,
  }).onConflictDoNothing().returning();
  const effectiveRevision = revision ?? (await executor.select().from(quotationRevisions).where(and(
    eq(quotationRevisions.quotationId, quotationId),
    eq(quotationRevisions.revisionNumber, revisionNumber),
  )))[0];
  const effectiveDocumentHash = revision ? documentHash : effectiveRevision.documentHash;
  await executor.update(quotations).set({ documentHash: effectiveDocumentHash }).where(eq(quotations.id, quotationId));
  return {
    revision: effectiveRevision,
    snapshot: revision ? snapshot : effectiveRevision.snapshot,
    documentHash: effectiveDocumentHash,
  };
}


// Share the quotation row lock with approval decisions: only one operation can win.
export async function withdrawQuotationApproval(tx: Transaction, id: number, expectedLockVersion: number, actor: Actor, reason: string) {
  const [current] = await tx.select().from(quotations).where(eq(quotations.id, id)).for("update");
  if (!current) throw Object.assign(new Error("No se encontró la cotización"), { statusCode: 404 });
  if (current.status !== "pending" || current.archivedAt || current.lockVersion !== expectedLockVersion) {
    throw Object.assign(new Error("La cotización cambió. Actualizá antes de retirar la solicitud."), { statusCode: 409 });
  }
  const [currentRevision] = await tx.select({ id: quotationRevisions.id }).from(quotationRevisions)
    .where(and(eq(quotationRevisions.quotationId, id), eq(quotationRevisions.revisionNumber, current.revisionNumber)));
  const approvals = currentRevision ? await tx.select().from(quotationApprovals)
    .where(eq(quotationApprovals.revisionId, currentRevision.id)) : [];
  if (!canWithdrawQuotationApproval(actor, current.createdBy, approvals.map(row => row.requestedBy))) {
    throw Object.assign(new Error("Sólo quien creó o solicitó la cotización, o una persona autorizada para aprobar, puede retirar la solicitud."), { statusCode: 403 });
  }
  const now = new Date();
  const [updated] = await tx.update(quotations).set({
    status: "draft", revisionNumber: current.revisionNumber + 1,
    updatedBy: actor.id, updatedAt: now, lockVersion: sql`${quotations.lockVersion} + 1`,
    internalApprovedAt: null, internalApprovedBy: null,
  }).where(eq(quotations.id, id)).returning();
  await tx.update(quotationApprovals).set({ status: "cancelled", decidedAt: now, decisionReason: reason })
    .where(and(eq(quotationApprovals.quotationId, id), eq(quotationApprovals.status, "pending")));
  await tx.update(proposalDocuments).set({ isStale: true, qaStatus: "pending", status: "draft", updatedBy: actor.id, updatedAt: now })
    .where(eq(proposalDocuments.quotationId, id));
  const { revision } = await persistQuotationRevision(tx, id, actor.id, reason);
  await tx.insert(quotationEvents).values({
    quotationId: id, revisionId: revision.id, eventType: "approval-withdrawn",
    eventKey: `approval-withdrawn:${id}:${current.revisionNumber}`, actorUserId: actor.id,
    metadata: { reason, fromRevision: current.revisionNumber, previousLockVersion: current.lockVersion },
  });
  return updated;
}
