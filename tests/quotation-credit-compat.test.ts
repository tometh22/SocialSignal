import { describe, expect, it } from "vitest";
import { insertQuotationSchema } from "../shared/schema";
import { createDefaultCreditProgram } from "../shared/utils/credit-program";
import { validatePricingSnapshot } from "../server/services/quotation-pricing-snapshot";

const base = { clientId: 1, projectName: "QA aprobación", projectType: "on-demand", analysisType: "standard", mentionsVolume: "medium", countriesCovered: "1", clientEngagement: "medium", baseCost: 100, complexityAdjustment: 0, markupAmount: 100, totalAmount: 200, toolsCost: 50, pricingVersion: 2, exchangeRateAtQuote: 1500, quotationCurrency: "USD", status: "draft" };

describe("legacy credit sentinel during quotation approval", () => {
  it.each(["on-demand", "one-shot", "fee-mensual"])("accepts persisted {} for a %s quotation without inventing credit terms", projectType => {
    const parsed = insertQuotationSchema.parse({ ...base, projectType, creditProgram: {} });
    expect(parsed.creditProgram).toBeNull();
    expect(() => validatePricingSnapshot(parsed)).not.toThrow();
    expect(parsed.totalAmount).toBe(200);
    expect(parsed.toolsCost).toBe(50);
  });
  it("preserves absent and complete disabled programs", () => {
    expect(insertQuotationSchema.parse(base).creditProgram).toBeUndefined();
    expect(insertQuotationSchema.parse({ ...base, creditProgram: null }).creditProgram).toBeNull();
    const disabled = createDefaultCreditProgram(new Date("2026-10-01T12:00:00Z"));
    expect(insertQuotationSchema.parse({ ...base, creditProgram: disabled }).creditProgram).toEqual(disabled);
  });
  it.each([{ enabled: true }, { enabled: false }, [], "", { totalCredits: 47 }])("rejects malformed nonempty programs: %j", creditProgram => {
    expect(insertQuotationSchema.safeParse({ ...base, creditProgram }).success).toBe(false);
  });
  it("keeps actual credit packages strict and preserves their agreed terms", () => {
    for (const creditProgram of [null, {}, createDefaultCreditProgram()]) {
      const parsed = insertQuotationSchema.parse({ ...base, projectType: "credit-pack", creditProgram });
      expect(() => validatePricingSnapshot(parsed)).toThrow("Completá y activá");
    }
    const creditProgram = { ...createDefaultCreditProgram(new Date("2026-10-01T12:00:00Z")), enabled: true };
    const parsed = insertQuotationSchema.parse({ ...base, projectType: "credit-pack", creditProgram });
    expect(() => validatePricingSnapshot(parsed)).not.toThrow();
    expect(parsed.creditProgram).toEqual(creditProgram);
    expect(() => validatePricingSnapshot({ ...parsed, creditProgram: { ...creditProgram, validityEnd: "2026-09-30" } })).toThrow("vigencia");
    expect(insertQuotationSchema.safeParse({ ...base, creditProgram: { ...creditProgram, packagePriceUSD: 0 } }).success).toBe(false);
  });
  it("does not bypass FX and pricing-version requirements", () => {
    const parsed = insertQuotationSchema.parse({ ...base, creditProgram: {} });
    expect(() => validatePricingSnapshot({ ...parsed, exchangeRateAtQuote: "0" })).toThrow("tipo de cambio");
    expect(() => validatePricingSnapshot({ ...parsed, status: "approved", pricingVersion: 1 })).toThrow("pricing v2");
  });
});
