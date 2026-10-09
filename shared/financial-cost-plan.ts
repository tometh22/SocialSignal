import { z } from "zod";
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usá YYYY-MM.");
export const financialCostPlanInput = z.object({
  concept: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(100),
  costType: z.enum(["direct", "indirect"]),
  currency: z.enum(["ARS", "USD"]),
  monthlyAmount: z.number().finite().positive().max(1e11),
  startPeriod: period,
  endPeriod: period,
  notes: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().default(true),
  version: z.number().int().positive().optional(),
}).superRefine((v, ctx) => {
  const index = (p: string) => Number(p.slice(0,4)) * 12 + Number(p.slice(5));
  const span = index(v.endPeriod) - index(v.startPeriod);
  if (span < 0 || span > 59) ctx.addIssue({ code: "custom", path: ["endPeriod"], message: "La vigencia debe abarcar entre 1 y 60 meses." });
});
export type FinancialCostPlanInput = z.infer<typeof financialCostPlanInput>;
export type FinancialCostPlan = FinancialCostPlanInput & { id: number; version: number };
