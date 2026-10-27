import { z } from "zod";
import { insertQuotationSchema } from "@shared/schema";

export const validatePricingSnapshot = (quotation: z.infer<typeof insertQuotationSchema>) => {
  if ((quotation.pricingVersion ?? 1) >= 2 && !(Number(quotation.exchangeRateAtQuote) > 0)) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      path: ["exchangeRateAtQuote"],
      message: "Pricing v2 requiere un tipo de cambio positivo confirmado",
    }]);
  }
  if (quotation.status === "approved" && (quotation.pricingVersion ?? 1) < 2) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      path: ["pricingVersion"],
      message: "La finalización requiere pricing v2",
    }]);
  }
  if (quotation.projectType === "credit-pack" && !quotation.creditProgram?.enabled) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      path: ["creditProgram"],
      message: "Completá y activá la bolsa de créditos antes de continuar con su aprobación",
    }]);
  }
  if (quotation.creditProgram?.enabled) {
    const start = new Date(`${quotation.creditProgram.validityStart}T00:00:00`);
    const end = new Date(`${quotation.creditProgram.validityEnd}T23:59:59`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: ["creditProgram", "validityEnd"],
        message: "La vigencia de la bolsa debe finalizar después de su inicio",
      }]);
    }
  }
};
