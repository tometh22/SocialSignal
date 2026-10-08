import { describe, it, expect } from "vitest";
import { measurableProjectMarkup, portfolioProjectHealth, hasEvaluableProjectHealth } from "../shared/utils/portfolio-health";
const commercial = { projectCategory: "billable", metrics: { revenueUSDNormalized: 300, costUSDNormalized: 100, markup: 3 } };
describe("portfolio health eligibility", () => {
  it("excludes internal costs even if a legacy markup is supplied", () => {
    expect(measurableProjectMarkup({ ...commercial, projectCategory: "internal" })).toBeNull();
    expect(portfolioProjectHealth({ ...commercial, projectCategory: "internal" })).toBe("neutral");
  });
  it("does not turn missing revenue or missing markup into a pricing emergency", () => {
    expect(portfolioProjectHealth({ ...commercial, metrics: { ...commercial.metrics, revenueUSDNormalized: 0, markup: 0 } })).toBe("neutral");
    expect(portfolioProjectHealth({ ...commercial, metrics: { ...commercial.metrics, markup: null } })).toBe("neutral");
  });
  it("excludes partially calculated or unsynchronized costs", () => {
    expect(portfolioProjectHealth({ ...commercial, costCoverage: { pendingHours: 1 } })).toBe("neutral");
    expect(portfolioProjectHealth({ ...commercial, costCoverage: { syncPending: true } })).toBe("neutral");
  });
  it("keeps genuine commercial thresholds", () => {
    expect(portfolioProjectHealth(commercial)).toBe("healthy");
    expect(portfolioProjectHealth({ ...commercial, metrics: { ...commercial.metrics, markup: 2.1 } })).toBe("warning");
    expect(portfolioProjectHealth({ ...commercial, metrics: { ...commercial.metrics, markup: 1.8 } })).toBe("critical");
  });
  it("keeps a project without applicable metrics neutral, while allowing an operational budget or plan", () => {
    const missing = { markup: null, revenue: 0, cost: 288, budget: 0, estimatedHours: 0 };
    expect(hasEvaluableProjectHealth(missing)).toBe(false);
    expect(hasEvaluableProjectHealth({ ...missing, budget: 300 })).toBe(true);
    expect(hasEvaluableProjectHealth({ ...missing, estimatedHours: 10 })).toBe(true);
  });
});
