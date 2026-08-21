import { describe, expect, it } from "vitest";
import {
  deriveQuotationGroupStatus,
  isQuotationConfigured,
  quotationGroupCurrencySubtotals,
} from "../shared/utils/quotation-groups";

describe("quotation groups", () => {
  it("derives partial and mixed outcomes without changing sibling proposals", () => {
    expect(deriveQuotationGroupStatus(["approved", "sent", "viewed"])).toBe("partial_acceptance");
    expect(deriveQuotationGroupStatus(["approved", "rejected", "in-negotiation"])).toBe("mixed");
    expect(deriveQuotationGroupStatus(["rejected", "expired"])).toBe("lost");
    expect(deriveQuotationGroupStatus(["approved", "approved", "approved"])).toBe("won");
  });

  it("never combines totals from different currencies", () => {
    expect(quotationGroupCurrencySubtotals([
      { currency: "USD", totalAmount: 10_000 },
      { currency: "ARS", totalAmount: 2_500_000 },
      { currency: "USD", totalAmount: 5_000 },
    ])).toEqual({ USD: 15_000, ARS: 2_500_000 });
  });

  it("requires the complete operational minimum before marking an item configured", () => {
    const ready = { completedStep: 6, hasScope: true, teamSize: 3, exchangeRate: 1450, totalAmount: 18_000 };
    expect(isQuotationConfigured(ready)).toBe(true);
    expect(isQuotationConfigured({ ...ready, teamSize: 0 })).toBe(false);
    expect(isQuotationConfigured({ ...ready, totalAmount: 0 })).toBe(false);
    expect(isQuotationConfigured({ ...ready, completedStep: 5 })).toBe(false);
  });
});
