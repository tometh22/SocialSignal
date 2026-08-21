import { describe, expect, it } from "vitest";
import { calculateMarginDrift, MARGIN_DRIFT_THRESHOLDS } from "../shared/utils/quotation-margin-drift";

describe("quotation margin drift", () => {
  it("reports no erosion when current rates match the quoted rates", () => {
    const result = calculateMarginDrift({
      lockedTotal: 4_000,
      team: [
        { personnelId: 1, hours: 100, originalRate: 10, currentRate: 10 },
        { personnelId: 2, hours: 50, originalRate: 20, currentRate: 20 },
      ],
    });
    expect(result.originalCost).toBe(2_000);
    expect(result.currentCost).toBe(2_000);
    expect(result.costDeltaPercentage).toBe(0);
    expect(result.marginErosionPoints).toBe(0);
    expect(result.severity).toBe("ok");
  });

  it("flags watch when peso costs outran the exchange rate moderately", () => {
    // Costo original 2.000 sobre un precio fijo de 4.000 = 50% de margen.
    // El equipo ahora cuesta 2.400 (peso inflacionó más que el dólar) → margen 40%.
    const result = calculateMarginDrift({
      lockedTotal: 4_000,
      team: [
        { personnelId: 1, hours: 100, originalRate: 10, currentRate: 12 },
        { personnelId: 2, hours: 50, originalRate: 20, currentRate: 24 },
      ],
    });
    expect(result.originalCost).toBe(2_000);
    expect(result.currentCost).toBe(2_400);
    expect(result.costDeltaPercentage).toBe(20);
    expect(result.originalMarginPercentage).toBe(50);
    expect(result.currentMarginPercentage).toBe(40);
    expect(result.marginErosionPoints).toBe(10);
    expect(result.marginErosionPoints).toBeGreaterThanOrEqual(MARGIN_DRIFT_THRESHOLDS.watch);
    expect(result.marginErosionPoints).toBeLessThan(MARGIN_DRIFT_THRESHOLDS.critical);
    expect(result.severity).toBe("watch");
  });

  it("flags critical when the margin is nearly gone", () => {
    const result = calculateMarginDrift({
      lockedTotal: 4_000,
      team: [{ personnelId: 1, hours: 100, originalRate: 20, currentRate: 39 }],
    });
    expect(result.originalCost).toBe(2_000);
    expect(result.currentCost).toBe(3_900);
    expect(result.currentMarginPercentage).toBeCloseTo(2.5, 5);
    expect(result.severity).toBe("critical");
  });

  it("flags critical when current cost already exceeds the locked price", () => {
    const result = calculateMarginDrift({
      lockedTotal: 4_000,
      team: [{ personnelId: 1, hours: 100, originalRate: 20, currentRate: 45 }],
    });
    expect(result.currentMarginPercentage).toBeLessThan(0);
    expect(result.severity).toBe("critical");
  });

  it("keeps the original rate and counts as unresolved when current rate is unavailable", () => {
    const result = calculateMarginDrift({
      lockedTotal: 1_000,
      team: [
        { personnelId: 1, hours: 10, originalRate: 10, currentRate: null },
        { personnelId: null, hours: 5, originalRate: 8, currentRate: null },
      ],
    });
    expect(result.unresolvedMembers).toBe(2);
    expect(result.totalMembers).toBe(2);
    expect(result.currentCost).toBe(result.originalCost);
    expect(result.severity).toBe("ok");
  });

  it("treats a locked total of zero as fully eroded without dividing by zero", () => {
    const result = calculateMarginDrift({
      lockedTotal: 0,
      team: [{ personnelId: 1, hours: 10, originalRate: 10, currentRate: 10 }],
    });
    expect(result.originalMarginPercentage).toBe(0);
    expect(result.currentMarginPercentage).toBe(0);
    expect(Number.isFinite(result.marginErosionPoints)).toBe(true);
  });

  it("allows negative drift when costs actually fell (currency moved in Epical's favor)", () => {
    const result = calculateMarginDrift({
      lockedTotal: 4_000,
      team: [{ personnelId: 1, hours: 100, originalRate: 20, currentRate: 15 }],
    });
    expect(result.marginErosionPoints).toBeLessThan(0);
    expect(result.severity).toBe("ok");
  });
});
