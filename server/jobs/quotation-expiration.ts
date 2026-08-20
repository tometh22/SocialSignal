import cron from "node-cron";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { crmActivities, crmLeads, quotations, quotationEvents } from "@shared/schema";

export async function expireCommercialQuotations(now = new Date()): Promise<number> {
  return await db.transaction(async (tx) => {
    const expired = await tx.update(quotations).set({
      status: "expired",
      updatedAt: now,
      lockVersion: sql`${quotations.lockVersion} + 1`,
    }).where(and(
      inArray(quotations.status, ["sent", "viewed", "in-negotiation"]),
      lt(quotations.expiresAt, now),
    )).returning();

    for (const quotation of expired) {
      await tx.insert(quotationEvents).values({
        quotationId: quotation.id,
        eventType: "expired",
        eventKey: `expired:${quotation.id}:${quotation.revisionNumber}`,
        actorType: "system",
        metadata: { expiresAt: quotation.expiresAt?.toISOString() || null },
      }).onConflictDoNothing();
      if (quotation.leadId) {
        await tx.update(crmLeads).set({
          stage: "lost",
          lostAt: now,
          lostReason: "La propuesta venció sin decisión del cliente",
          updatedAt: now,
        }).where(eq(crmLeads.id, quotation.leadId));
        await tx.insert(crmActivities).values({
          leadId: quotation.leadId,
          quotationId: quotation.id,
          type: "followup",
          title: `Cotización ${quotation.quotationNumber || `#${quotation.id}`} vencida`,
          content: "La propuesta venció sin una decisión registrada. Revisar seguimiento comercial.",
          activityDate: now,
        });
      }
    }
    return expired.length;
  });
}

export function startQuotationExpirationJob(): void {
  cron.schedule("7 * * * *", async () => {
    try {
      const count = await expireCommercialQuotations();
      if (count > 0) console.log(`[Quotation lifecycle] ${count} cotizaciones marcadas como vencidas`);
    } catch (error) {
      console.error("[Quotation lifecycle] Error expiring quotations:", error);
    }
  }, { timezone: "America/Argentina/Buenos_Aires" });
}
