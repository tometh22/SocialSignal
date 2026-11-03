import { and, eq, inArray } from "drizzle-orm";
import { quotations, quotationApprovals, quotationRevisions, users } from "@shared/schema";
import { canDecideQuotationApproval } from "@shared/utils/quotation-approval";
import { db } from "../db";
import { createUserNotifications } from "./user-notifications";

// Called only after submission commits. A delivery failure must not turn a
// successful submission into an error that encourages the user to submit twice.
export async function notifyQuotationApprovalRequests(quotationIds: number[]) {
  try {
    if (!quotationIds.length) return;
    const requests = await db.select({
      quotationId: quotations.id, quotationNumber: quotations.quotationNumber,
      projectName: quotations.projectName, revisionId: quotationApprovals.revisionId,
      requestedBy: quotationApprovals.requestedBy,
    }).from(quotations).innerJoin(quotationApprovals, eq(quotationApprovals.quotationId, quotations.id))
      .innerJoin(quotationRevisions, and(eq(quotationRevisions.id, quotationApprovals.revisionId), eq(quotationRevisions.revisionNumber, quotations.revisionNumber)))
      .where(and(inArray(quotations.id, quotationIds), eq(quotations.status, "pending"), eq(quotationApprovals.status, "pending")));
    const candidates = await db.select({ id: users.id, isAdmin: users.isAdmin, role: users.role, permissions: users.permissions })
      .from(users).where(eq(users.isActive, true));
    const seen = new Set<string>();
    for (const request of requests) {
      const eventKey = `quotation-approval:${request.quotationId}:${request.revisionId}`;
      if (seen.has(eventKey)) continue;
      seen.add(eventKey);
      await createUserNotifications(candidates.filter(user =>
        (user.isAdmin || user.role === "admin" || user.permissions?.includes("quotations"))
        && canDecideQuotationApproval(user, request.requestedBy),
      ).map(user => user.id), {
        eventKey, type: "quotation_approval", title: "Cotización pendiente de aprobación",
        message: `${request.quotationNumber || `#${request.quotationId}`} · ${request.projectName} requiere tu revisión.`,
        entityType: "quotation", entityId: request.quotationId,
        actionUrl: `/quotations/${request.quotationId}#commercial-approval`,
      });
    }
  } catch (error) {
    console.error("No se pudo notificar la aprobación de cotizaciones:", error instanceof Error ? error.message : error);
  }
}
