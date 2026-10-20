import { describe, expect, it } from "vitest";
import { nextRecurringTaskDatesForTask } from "../server/services/task-recurrence";

type Occurrence = Parameters<typeof nextRecurringTaskDatesForTask>[0];
const date = (day: string) => new Date(`${day}T12:00:00Z`);
const occurrence = (id: number, start: string, due = start, source: number | null = null): Occurrence => ({
  id, projectId: 1, startDate: date(start), dueDate: date(due),
  recurrenceRule: { frequency: "monthly", interval: 1 }, recurrenceSourceTaskId: source,
});

describe("monthly recurring task history", () => {
  it("keeps January 31 → February 28 → March 31 across saved successors", () => {
    const jan = occurrence(1, "2027-01-31");
    const febDates = nextRecurringTaskDatesForTask(jan, [jan], date("2027-01-31"));
    expect(febDates).toEqual({ startDate: "2027-02-28", dueDate: "2027-02-28" });
    const feb = occurrence(2, febDates.startDate, febDates.dueDate, jan.id);
    expect(nextRecurringTaskDatesForTask(feb, [jan, feb], date("2027-02-28")))
      .toEqual({ startDate: "2027-03-31", dueDate: "2027-03-31" });
  });

  it("keeps the 31st throughout a year of saved occurrences", () => {
    const history = [occurrence(1, "2027-01-31")];
    for (const expected of ["2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31", "2027-06-30", "2027-07-31", "2027-08-31", "2027-09-30", "2027-10-31", "2027-11-30", "2027-12-31", "2028-01-31"]) {
      const current = history[history.length - 1];
      const next = nextRecurringTaskDatesForTask(current, history, current.dueDate!);
      expect(next).toEqual({ startDate: expected, dueDate: expected });
      history.push(occurrence(current.id + 1, next.startDate, next.dueDate, current.id));
    }
  });

  it.each([
    ["2027-01-30", "2027-02-28", "2027-03-30"],
    ["2028-01-31", "2028-02-29", "2028-03-31"],
  ])("recovers the original day after clamping %s to %s", (initial, clamped, expected) => {
    const source = occurrence(1, initial);
    const current = occurrence(2, clamped, clamped, 1);
    expect(nextRecurringTaskDatesForTask(current, [source, current], date(clamped)))
      .toEqual({ startDate: expected, dueDate: expected });
  });

  it("does not promote an actual February 28 anchor to month end", () => {
    const feb = occurrence(1, "2027-02-28");
    expect(nextRecurringTaskDatesForTask(feb, [feb], date("2027-02-28")))
      .toEqual({ startDate: "2027-03-28", dueDate: "2027-03-28" });
  });

  it("keeps the original range duration when the next month returns to the 31st", () => {
    const jan = occurrence(1, "2027-01-31", "2027-02-02");
    const next = nextRecurringTaskDatesForTask(jan, [jan], date("2027-02-02"));
    expect(next).toEqual({ startDate: "2027-02-28", dueDate: "2027-03-02" });
    const feb = occurrence(2, next.startDate, next.dueDate, 1);
    expect(nextRecurringTaskDatesForTask(feb, [jan, feb], date("2027-03-02")))
      .toEqual({ startDate: "2027-03-31", dueDate: "2027-04-02" });
  });

  it("skips elapsed months without losing the original anchor", () => {
    const jan = occurrence(1, "2027-01-31");
    const feb = occurrence(2, "2027-02-28", "2027-02-28", 1);
    expect(nextRecurringTaskDatesForTask(feb, [jan, feb], date("2027-04-02")))
      .toEqual({ startDate: "2027-04-30", dueDate: "2027-04-30" });
  });

  it("keeps a two-month interval through successive short months", () => {
    const first = occurrence(1, "2026-12-31");
    first.recurrenceRule!.interval = 2;
    const history = [first];
    for (const expected of ["2027-02-28", "2027-04-30", "2027-06-30", "2027-08-31"]) {
      const current = history[history.length - 1];
      const next = nextRecurringTaskDatesForTask(current, history, current.dueDate!);
      expect(next).toEqual({ startDate: expected, dueDate: expected });
      const successor = occurrence(current.id + 1, next.startDate, next.dueDate, current.id);
      successor.recurrenceRule!.interval = 2;
      history.push(successor);
    }
  });

  it("recovers the anchor even when older successors already drifted to the 28th", () => {
    const history = [occurrence(1, "2027-01-31"), occurrence(2, "2027-02-28", "2027-02-28", 1), occurrence(3, "2027-03-28", "2027-03-28", 2)];
    const before = JSON.stringify(history);
    expect(nextRecurringTaskDatesForTask(history[2], history, date("2027-03-28")))
      .toEqual({ startDate: "2027-04-30", dueDate: "2027-04-30" });
    expect(JSON.stringify(history)).toBe(before);
  });

  it.each(["startDate", "dueDate"] as const)("recovers the anchor from a source with only %s", field => {
    const jan = occurrence(1, "2027-01-31");
    jan[field === "startDate" ? "dueDate" : "startDate"] = null;
    const feb = occurrence(2, "2027-02-28", "2027-02-28", 1);
    expect(nextRecurringTaskDatesForTask(feb, [jan, feb], date("2027-02-28")))
      .toEqual({ startDate: "2027-03-31", dueDate: "2027-03-31" });
  });

  it("respects a rescheduled day instead of restoring the old one", () => {
    const history = [occurrence(1, "2027-01-31"), occurrence(2, "2027-02-28", "2027-02-28", 1), occurrence(3, "2027-03-15", "2027-03-15", 2)];
    expect(nextRecurringTaskDatesForTask(history[2], history, date("2027-03-15")))
      .toEqual({ startDate: "2027-04-15", dueDate: "2027-04-15" });
  });

  it.each(["missing", "other project", "different frequency", "different interval", "different month phase"])("does not infer an anchor from %s history", scenario => {
    const source = occurrence(1, "2027-01-31");
    const current = occurrence(2, "2027-02-28", "2027-02-28", 1);
    if (scenario === "other project") source.projectId = 2;
    if (scenario === "different frequency") source.recurrenceRule!.frequency = "weekly";
    if (scenario === "different interval") source.recurrenceRule!.interval = 2;
    if (scenario === "different month phase") { source.recurrenceRule!.interval = 2; current.recurrenceRule!.interval = 2; }
    const expected = current.recurrenceRule!.interval === 2 ? "2027-04-28" : "2027-03-28";
    expect(nextRecurringTaskDatesForTask(current, scenario === "missing" ? [current] : [source, current], date("2027-02-28")))
      .toEqual({ startDate: expected, dueDate: expected });
  });

  it("terminates safely when source references contain a cycle", () => {
    const jan = occurrence(1, "2027-01-31", "2027-01-31", 2);
    const feb = occurrence(2, "2027-02-28", "2027-02-28", 1);
    expect(nextRecurringTaskDatesForTask(feb, [jan, feb], date("2027-02-28")))
      .toEqual({ startDate: "2027-03-31", dueDate: "2027-03-31" });
  });

  it("uses the current date for an undated task without inventing an old anchor", () => {
    const jan = occurrence(1, "2027-01-31");
    const current = { ...occurrence(2, "2027-02-28", "2027-02-28", 1), startDate: null, dueDate: null };
    expect(nextRecurringTaskDatesForTask(current, [jan, current], date("2027-02-28")))
      .toEqual({ startDate: "2027-03-28", dueDate: "2027-03-28" });
  });

  it("keeps weekly range and weekday behavior unchanged", () => {
    const current = occurrence(1, "2027-02-01", "2027-02-03");
    current.recurrenceRule = { frequency: "weekly", interval: 1, weekdays: [1, 3] };
    expect(nextRecurringTaskDatesForTask(current, [current], date("2027-02-03")))
      .toEqual({ startDate: "2027-02-08", dueDate: "2027-02-10" });
    current.dueDate = current.startDate;
    expect(nextRecurringTaskDatesForTask(current, [current], date("2027-02-01")))
      .toEqual({ startDate: "2027-02-03", dueDate: "2027-02-03" });
  });
});
