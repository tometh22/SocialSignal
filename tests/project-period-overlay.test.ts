import { describe, expect, it } from "vitest";
import { withProjectPeriodMetrics } from "../server/domain/metrics/project-period-overlay";
import type { FinancialProjectMetrics } from "../server/domain/view-aggregator";

const period: FinancialProjectMetrics = {
  projectId: 90, projectKey: "epical|general", clientName: "Epical", projectName: "General", projectType: null,
  currencyNative: "ARS", isOneShot: false,
  metrics: { revenueDisplay: 0, costDisplay: 450720, revenueUSDNormalized: 0, costUSDNormalized: 288,
    profitUSD: -288, margin: null, markup: null, totalHours: 13.2 },
};

describe("current-period project metrics", () => {
  it("makes portfolio rows and detail agree while keeping native display separate from USD", () => {
    const result = withProjectPeriodMetrics({ costUSDNormalized: 0, costUSD: 0, markup: 3, margin: 0.5, workedHours: 10, status: "active" }, period);
    expect(result.costUSDNormalized ?? result.costUSD).toBe(288);
    expect(result.costUSD).toBe(288);
    expect(result.costDisplay).toEqual({ amount: 450720, currency: "ARS" });
    expect(result.markupRatio ?? result.markup).toBeNull();
    expect(result.marginFrac ?? result.margin).toBeNull();
    expect(result.totalHours).toBe(13.2);
    expect(result.workedHours).toBe(13.2);
    expect(result.status).toBe("active");
  });
  it("replaces previous normalized values with genuine zero values for the selected period", () => {
    const result = withProjectPeriodMetrics({ costUSDNormalized: 288, revenueUSDNormalized: 500 }, {
      ...period, currencyNative: "USD", metrics: { ...period.metrics, costDisplay: 0, costUSDNormalized: 0, profitUSD: 0, totalHours: 0 },
    });
    expect(result.costUSDNormalized).toBe(0);
    expect(result.costDisplay).toEqual({ amount: 0, currency: "USD" });
    expect(result.revenueUSDNormalized).toBe(0);
  });
});
