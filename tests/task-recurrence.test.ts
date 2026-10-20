import { describe, expect, it } from "vitest";
import { nextRecurringTaskDates, type TaskRecurrence } from "../shared/utils/task-recurrence";

const weekly: TaskRecurrence = { frequency: "weekly", interval: 1 };
const now = (day: string) => new Date(`${day}T15:00:00Z`);

describe("recurring task date ranges", () => {
  it("repeats Monday–Wednesday as Monday–Wednesday the following week", () => {
    expect(nextRecurringTaskDates(weekly, "2026-10-19", "2026-10-21", now("2026-10-21")))
      .toEqual({ startDate: "2026-10-26", dueDate: "2026-10-28" });
  });

  it("repeats a range as a whole even with Monday/Wednesday weekday settings", () => {
    expect(nextRecurringTaskDates({ ...weekly, weekdays: [1, 3] }, "2026-10-19", "2026-10-21", now("2026-10-19")))
      .toEqual({ startDate: "2026-10-26", dueDate: "2026-10-28" });
  });

  it("keeps the original cadence and duration when completion is late", () => {
    expect(nextRecurringTaskDates(weekly, "2026-10-19", "2026-10-21", now("2026-11-04")))
      .toEqual({ startDate: "2026-11-09", dueDate: "2026-11-11" });
  });

  it("preserves fortnightly cadence across a year boundary", () => {
    expect(nextRecurringTaskDates({ ...weekly, interval: 2, weekdays: [1] }, "2026-12-21", "2026-12-23", now("2026-12-23")))
      .toEqual({ startDate: "2027-01-04", dueDate: "2027-01-06" });
  });

  it("preserves durations that cross a month boundary", () => {
    expect(nextRecurringTaskDates(weekly, "2026-10-26", "2026-11-04", now("2026-11-04")))
      .toEqual({ startDate: "2026-11-09", dueDate: "2026-11-18" });
  });

  it("anchors monthly ranges on their start and clamps short months", () => {
    expect(nextRecurringTaskDates({ frequency: "monthly", interval: 1 }, "2028-01-31", "2028-02-02", now("2028-02-02")))
      .toEqual({ startDate: "2028-02-29", dueDate: "2028-03-02" });
  });

  it("keeps distinct Monday and Wednesday occurrences for single-day tasks", () => {
    expect(nextRecurringTaskDates({ ...weekly, weekdays: [1, 3] }, "2026-10-19", "2026-10-19", now("2026-10-19")))
      .toEqual({ startDate: "2026-10-21", dueDate: "2026-10-21" });
  });

  it.each([
    [null, "2026-10-19"],
    ["2026-10-19", null],
    [null, null],
  ])("handles a partial or missing range (%s, %s)", (start, due) => {
    expect(nextRecurringTaskDates(weekly, start, due, now("2026-10-19")))
      .toEqual({ startDate: "2026-10-26", dueDate: "2026-10-26" });
  });

  it("uses civil task dates and the completion day in Buenos Aires", () => {
    expect(nextRecurringTaskDates(weekly, new Date("2026-10-19T00:00:00Z"), new Date("2026-10-21T12:00:00Z"), new Date("2026-10-26T01:00:00Z")))
      .toEqual({ startDate: "2026-10-26", dueDate: "2026-10-28" });
  });

  it("keeps the range on successive completions", () => {
    const next = nextRecurringTaskDates(weekly, "2026-10-19", "2026-10-21", now("2026-10-21"));
    expect(nextRecurringTaskDates(weekly, next.startDate, next.dueDate, now("2026-10-28")))
      .toEqual({ startDate: "2026-11-02", dueDate: "2026-11-04" });
  });
});
