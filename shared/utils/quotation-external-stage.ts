import { z } from "zod";
export const externalQuotationStages = ["internally-approved", "sent", "in-negotiation", "approved"] as const;
export const externalStageSchema = z.object({
  stage: z.enum(externalQuotationStages),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(`${value}T12:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value; }, "Fecha inválida"),
  channel: z.enum(["email", "meeting", "message", "other"]),
  reason: z.string().trim().min(3).max(2000),
  variantId: z.number().int().positive().nullable().optional(),
  expectedLockVersion: z.number().int().nonnegative(),
  expectedRevisionNumber: z.number().int().positive(),
}).strict();
export function assertExternalQuotationStage(current: string, target: string) {
  const rank: Record<string, number> = { draft: 0, pending: 0, "internally-approved": 1, sent: 2, viewed: 2, "in-negotiation": 3, approved: 4 };
  if (!(current in rank) || !(target in rank) || rank[target] <= rank[current]) {
    throw Object.assign(new Error("Esta etapa ya fue registrada o requiere una nueva revisión para cambiarla."), { statusCode: 409 });
  }
}
