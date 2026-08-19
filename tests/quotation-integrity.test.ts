import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { requirePermission } from "../server/middleware/requirePermission";
import {
  insertNegotiationHistorySchema,
  insertQuotationSchema,
  insertQuotationTeamMemberSchema,
} from "../shared/schema";
import { calculateQuotationComplexityFactor } from "../shared/utils/quotation-complexity";
import { calculateQuotationPricing } from "../shared/utils/quotation-pricing";
import {
  assertQuotationTransition,
  canTransitionQuotation,
} from "../shared/utils/quotation-workflow";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("quotation integrity domain", () => {
  it("enforces the shared status machine", () => {
    expect(canTransitionQuotation("draft", "approved")).toBe(true);
    expect(canTransitionQuotation("approved", "draft")).toBe(false);
    expect(canTransitionQuotation("in-negotiation", "approved")).toBe(true);
    expect(() => assertQuotationTransition("approved", "rejected")).toThrow("No se puede cambiar");
  });

  it("uses one canonical complexity vocabulary including legacy aliases", () => {
    expect(calculateQuotationComplexityFactor({
      analysisType: "advanced",
      mentionsVolume: "high",
      countriesCovered: "4-6",
      clientEngagement: "very-high",
    })).toBeCloseTo(0.68);
    expect(calculateQuotationComplexityFactor({
      analysisType: "deep",
      mentionsVolume: "large",
      countriesCovered: "6-10",
      clientEngagement: "high",
    })).toBeCloseTo(0.60);
  });

  it("prices additional deliverables in the same deterministic pipeline", () => {
    const result = calculateQuotationPricing({
      quotationCurrency: "USD",
      exchangeRate: 1_000,
      team: [{ hours: 10, rate: 20, currency: "USD" }],
      marginFactor: 2,
      additionalDeliverableCostUSD: 50,
    });
    expect(result.display.additionalDeliverableCost).toBe(50);
    expect(result.display.total).toBe(450);
  });

  it("keeps manual price as the final client total", () => {
    const result = calculateQuotationPricing({
      quotationCurrency: "ARS",
      exchangeRate: 1_000,
      team: [{ hours: 10, rate: 100, currency: "ARS" }],
      priceMode: "manual",
      manualPrice: 10_000,
      manualPriceCurrency: "ARS",
      toolsCostUSD: 1,
      additionalDeliverableCostUSD: 1,
      platformCostARS: 500,
      deviationPercentage: 10,
      discountPercentage: 5,
      inflationFactor: 1.2,
    });
    expect(result.canonicalARS.total).toBe(10_000);
  });

  it("rejects invalid financial and negotiation inputs", () => {
    const baseQuote = {
      clientId: 1,
      projectName: "Audit",
      projectType: "on-demand",
      analysisType: "standard",
      mentionsVolume: "medium",
      countriesCovered: "1",
      clientEngagement: "medium",
      baseCost: 100,
      complexityAdjustment: 0,
      markupAmount: 100,
      totalAmount: 200,
    };
    expect(insertQuotationSchema.safeParse({ ...baseQuote, discountPercentage: 100 }).success).toBe(false);
    expect(insertQuotationSchema.safeParse({ ...baseQuote, proposalLink: "not-a-url" }).success).toBe(false);
    expect(insertQuotationTeamMemberSchema.safeParse({
      quotationId: 1, roleId: 1, hours: -1, rate: 10, cost: -10,
    }).success).toBe(false);
    expect(insertNegotiationHistorySchema.safeParse({
      quotationId: 1,
      previousPrice: 100,
      newPrice: 0,
      changeType: "invented",
    }).success).toBe(false);
  });
});

describe("quotation integration contracts", () => {
  it("denies authenticated users without quotation permission", () => {
    const middleware = requirePermission("quotations");
    const next = vi.fn();
    const response: any = {
      status: vi.fn(),
      json: vi.fn(),
    };
    response.status.mockReturnValue(response);
    middleware({ user: { id: 7, permissions: ["projects"] } } as any, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    middleware({ user: { id: 8, permissions: ["quotations"] } } as any, response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("protects every quotation prefix on the server", () => {
    const routes = source("server/routes.ts");
    const guard = routes.slice(
      routes.indexOf("// Quotations are commercially sensitive"),
      routes.indexOf("// Quotations routes"),
    );
    for (const prefix of [
      "/api/quotations",
      "/api/quotation-team",
      "/api/quotation-variants",
      "/api/quotation-templates",
    ]) expect(guard).toContain(prefix);
    expect(guard).toContain('requirePermission("quotations")');
    expect(routes).toContain("quotationMetadataPatchSchema");
    expect(routes).toContain(".partial().strict()");
  });

  it("persists variant teams and copies the selected scenario to projects", () => {
    const routes = source("server/routes.ts");
    const storage = source("server/storage.ts");
    const variants = source("client/src/components/optimized/QuotationVariants.tsx");

    expect(routes).toContain("teamMembers: z.array(quotationTeamPayloadSchema)");
    expect(routes).toContain("variantId: createdVariant.id");
    expect(variants).toContain("teamMembers: effectiveTeam.map");
    expect(storage).toContain("copyQuotationTeamToProject(quotationId: number, projectId: number, variantId?");
    expect(storage).toContain("eq(quotationTeamMembers.variantId, variantId)");
  });

  it("stores and displays quote money in its declared currency exactly once", () => {
    const context = source("client/src/context/optimized-quote-context.tsx");
    const management = source("client/src/pages/manage-quotes.tsx");
    const routes = source("server/routes.ts");

    expect(context).toContain("baseCost: pricingResult.display.baseCost");
    expect(management).toContain("formatCurrencyWithConversion(quote.totalAmount, currency)");
    expect(management).not.toContain("quote.totalAmount / fxAtQuote");
    expect(routes).toContain("const sourceCurrency = quotation.quotationCurrency");
    expect(routes).toContain("Number(quotation.exchangeRateAtQuote)");
  });

  it("restores drafts instead of deleting them on mount", () => {
    const context = source("client/src/context/optimized-quote-context.tsx");
    const restore = context.slice(
      context.indexOf("// Restore a recent local draft"),
      context.indexOf("// Calculate recommended roles"),
    );
    expect(restore).toContain("setQuotationData");
    expect(restore).not.toContain("pending-draft-restore");
  });
});
