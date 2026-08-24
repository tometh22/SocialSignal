import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  buildPriceAdjustmentProposal,
  calculateAccumulatedIpc,
  calculateAdjustedPrice,
  clampToMonthStart,
  isDueForAdjustment,
} from "../shared/utils/quotation-ipc-adjustment";

describe("addCalendarMonths", () => {
  it("rolls over into the next year", () => {
    expect(addCalendarMonths(new Date(Date.UTC(2026, 10, 15)), 3)).toEqual(new Date(Date.UTC(2027, 1, 1)));
  });
});

describe("clampToMonthStart", () => {
  it("keeps the year/month but resets the day to the 1st", () => {
    expect(clampToMonthStart(new Date(Date.UTC(2026, 0, 28)))).toEqual(new Date(Date.UTC(2026, 0, 1)));
  });
  it("is a no-op when already the 1st", () => {
    expect(clampToMonthStart(new Date(Date.UTC(2026, 5, 1)))).toEqual(new Date(Date.UTC(2026, 5, 1)));
  });
});

describe("isDueForAdjustment", () => {
  it("is not due before the cadence period elapses", () => {
    expect(isDueForAdjustment("ipc_quarterly", new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 2, 15)))).toBe(false);
  });
  it("is due exactly on the period boundary", () => {
    expect(isDueForAdjustment("ipc_quarterly", new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1)))).toBe(true);
  });
  it("uses 12 months for annual_review", () => {
    expect(isDueForAdjustment("annual_review", new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 10, 1)))).toBe(false);
    expect(isDueForAdjustment("annual_review", new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2027, 0, 1)))).toBe(true);
  });
});

describe("calculateAccumulatedIpc", () => {
  it("compounds monthly variation instead of summing it", () => {
    const values = [
      { year: 2026, month: 1, monthlyPercentage: 2 },
      { year: 2026, month: 2, monthlyPercentage: 2 },
    ];
    // (1.02 * 1.02 - 1) * 100 = 4.04, no 4.00
    const result = calculateAccumulatedIpc(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 2, 1)), values);
    expect(result).toBeCloseTo(4.04, 2);
  });

  it("returns null when a month in the period is missing", () => {
    const values = [{ year: 2026, month: 1, monthlyPercentage: 2 }];
    const result = calculateAccumulatedIpc(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 2, 1)), values);
    expect(result).toBeNull();
  });

  it("handles a period that crosses a year boundary", () => {
    const values = [
      { year: 2026, month: 12, monthlyPercentage: 3 },
      { year: 2027, month: 1, monthlyPercentage: 1 },
      { year: 2027, month: 2, monthlyPercentage: 1 },
    ];
    const result = calculateAccumulatedIpc(new Date(Date.UTC(2026, 11, 1)), new Date(Date.UTC(2027, 2, 1)), values);
    expect(result).not.toBeNull();
    // 1.03 * 1.01 * 1.01 = 1.050703 → +5.0703%, redondeado a 5.070
    expect(result).toBeCloseTo(5.07, 2);
  });
});

describe("calculateAdjustedPrice", () => {
  it("applies the accumulated percentage to the previous price", () => {
    expect(calculateAdjustedPrice(100_000, 6.121)).toBe(106_121);
  });
  it("rounds to two decimals", () => {
    expect(calculateAdjustedPrice(1_000, 3.333)).toBe(1_033.33);
  });
});

describe("buildPriceAdjustmentProposal", () => {
  const monthlyValues = [
    { year: 2026, month: 1, monthlyPercentage: 2 },
    { year: 2026, month: 2, monthlyPercentage: 2 },
    { year: 2026, month: 3, monthlyPercentage: 2 },
  ];

  it("returns null when not yet due", () => {
    const proposal = buildPriceAdjustmentProposal({
      cadence: "ipc_quarterly",
      sinceDate: new Date(Date.UTC(2026, 0, 1)),
      now: new Date(Date.UTC(2026, 1, 1)),
      previousTotalAmount: 100_000,
      monthlyValues,
    });
    expect(proposal).toBeNull();
  });

  it("returns null when due but IPC data for the period is incomplete", () => {
    const proposal = buildPriceAdjustmentProposal({
      cadence: "ipc_quarterly",
      sinceDate: new Date(Date.UTC(2026, 0, 1)),
      now: new Date(Date.UTC(2026, 3, 1)),
      previousTotalAmount: 100_000,
      monthlyValues: monthlyValues.slice(0, 2), // falta marzo
    });
    expect(proposal).toBeNull();
  });

  it("builds a full proposal once due and the period's data is complete", () => {
    const proposal = buildPriceAdjustmentProposal({
      cadence: "ipc_quarterly",
      sinceDate: new Date(Date.UTC(2026, 0, 1)),
      now: new Date(Date.UTC(2026, 3, 1)),
      previousTotalAmount: 100_000,
      monthlyValues,
    });
    expect(proposal).not.toBeNull();
    // 1.02^3 = 1.061208 → +6.1208%, redondeado a 6.121
    expect(proposal!.accumulatedIpcPercentage).toBeCloseTo(6.121, 3);
    // El precio se calcula con el % YA redondeado (no con el valor crudo),
    // para que el número que se le muestra a quien aprueba sea exactamente
    // el que explica el precio propuesto: 100.000 × 1,06121 = 106.121.
    expect(proposal!.proposedTotalAmount).toBe(106_121);
    expect(proposal!.periodStart).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(proposal!.periodEnd).toEqual(new Date(Date.UTC(2026, 3, 1)));
  });
});
