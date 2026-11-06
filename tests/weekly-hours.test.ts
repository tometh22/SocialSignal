import { describe, expect, it } from "vitest";
import { summarizeWeeklyHours } from "../shared/utils/weekly-hours";
import { weeklyEstimateOverlapsRange } from "../shared/utils/taskEstimates";

describe("weekly real and estimated hours", () => {
  it("includes estimated-only and real-only weeks in chronological order", () => {
    expect(summarizeWeeklyHours([
      { date: "2026-11-10", hours: 2 },
      { date: "2026-11-02", hours: 1.5 },
      { date: "2026-11-06", hours: 2.5 },
    ], [
      { weekStart: "2026-11-16", estimatedHours: 8 },
      { weekStart: "2026-11-02", estimatedHours: 6 },
      { weekStart: "2026-11-02", estimatedHours: 4 },
    ])).toEqual([
      { week: "2026-11-02", hours: 4, estimatedHours: 10 },
      { week: "2026-11-09", hours: 2, estimatedHours: 0 },
      { week: "2026-11-16", hours: 0, estimatedHours: 8 },
    ]);
  });

  it("preserves the recorded civil date for legacy midnight timestamps and date-only inputs", () => {
    expect(summarizeWeeklyHours([
      { date: new Date("2026-11-09T01:00:00Z"), hours: 2 },
      { date: "2026-11-09", hours: 3 },
      { date: "2026-11-08", hours: 1 },
    ], [])).toEqual([
      { week: "2026-11-02", hours: 1, estimatedHours: 0 },
      { week: "2026-11-09", hours: 5, estimatedHours: 0 },
    ]);
  });

  it("keeps full overlapping-week estimates consistent with period totals, including planning without recorded hours", () => {
    const estimates = [
      { weekStart: "2026-10-19", estimatedHours: 100 },
      { weekStart: "2026-10-26", estimatedHours: 10 },
      { weekStart: "2026-11-30", estimatedHours: 20 },
      { weekStart: "2026-12-07", estimatedHours: 100 },
    ].filter(estimate => weeklyEstimateOverlapsRange(estimate.weekStart, { dateFrom: "2026-11-01", dateTo: "2026-11-30" }));
    const weeks = summarizeWeeklyHours([], estimates);
    expect(weeks).toEqual([
      { week: "2026-10-26", hours: 0, estimatedHours: 10 },
      { week: "2026-11-30", hours: 0, estimatedHours: 20 },
    ]);
    expect(weeks.reduce((sum, week) => sum + week.estimatedHours, 0)).toBe(30);
    expect(summarizeWeeklyHours([], [])).toEqual([]);
  });
});
