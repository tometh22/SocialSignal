import { describe, expect, it, vi, beforeEach } from "vitest";
import { addToRange } from "react-day-picker";
import { taskWorkflowBucket } from "../shared/utils/task-workflow";
import { taskDateBucket } from "../shared/utils/task-date-bucket";
import { reconcileHourSources } from "../shared/utils/hours-reconciliation";
import { currentBuenosAiresWeek, civilDateInBuenosAires } from "../shared/utils/buenos-aires-week";
import { computeHealthScore } from "../client/src/components/project-detail/health-score";
import { clientCalendarColor } from "../client/src/lib/client-calendar-color";

vi.mock("../server/db", () => ({ db: { transaction: vi.fn() } }));
import { db } from "../server/db";
import { tasks, taskTimeEntries, asanaTimeEntries } from "../shared/schema";
import { deleteEmptyTaskTrees } from "../server/domain/task-delete";
import { hoursCivilBoundary } from "../server/domain/personal-hours";
import { reconciliationBlockers } from "../server/domain/reconcile-task-costs";

const now = new Date("2026-10-09T01:00:00Z"); // Still Thursday in Buenos Aires.
describe("Feedback Mind 6-10: dates, workflow and personal hours", () => {
  it("classifies by civil dates instead of historic manual states", () => {
    expect(taskWorkflowBucket({ status: "in_progress", startDate: "2026-10-09" }, now)).toBe("upcoming");
    expect(taskWorkflowBucket({ status: "todo", dueDate: "2026-10-08" }, now)).toBe("in_progress");
    expect(taskWorkflowBucket({ status: "todo", dueDate: "2026-10-07" }, now)).toBe("overdue");
    expect(taskWorkflowBucket({ status: "todo" }, now)).toBe("no_date");
    expect(taskWorkflowBucket({ status: "done", dueDate: "2026-10-07" }, now)).toBe("done");
    expect(taskWorkflowBucket({ status: "cancelled" }, now)).toBeNull();
  });
  it("a blocked task retains its personal date group, but has board priority", () => {
    const task = { status: "blocked", dueDate: "2026-10-07" };
    expect(taskDateBucket(task, now)).toBe("overdue");
    expect(taskWorkflowBucket(task, now)).toBe("blocked");
  });
  it("keeps the first calendar click as a draft and completes on the second", () => {
    const first = new Date(2026, 9, 8), last = new Date(2026, 9, 11);
    const draft = addToRange(first, undefined);
    expect(draft).toEqual({ from: first, to: undefined });
    expect(addToRange(last, draft)).toEqual({ from: first, to: last });
    expect(addToRange(first, draft)).toEqual({ from: first, to: first });
    expect(addToRange(new Date(2026, 9, 7), { to: first })).toEqual({ from: new Date(2026, 9, 7), to: first });
  });
  it("uses civil entry dates and BA current week across month boundaries", () => {
    expect(hoursCivilBoundary("2026-10-01").toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(hoursCivilBoundary("2026-10-31", true).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(civilDateInBuenosAires(new Date("2026-10-05T02:59:59Z"))).toBe("2026-10-04");
    expect(currentBuenosAiresWeek(new Date("2026-10-05T02:59:59Z"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(currentBuenosAiresWeek(new Date("2026-10-05T03:00:00Z"))).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });
  const entry = (id: number, overrides = {}) => ({ id, projectId: 5, personnelId: 2, date: "2026-10-08", hours: 2, description: "Trabajo", ...overrides });
  it("deduplicates mirrors one-to-one without discarding repeated legitimate work", () => {
    expect(reconcileHourSources([entry(1), entry(2), entry(3)], [entry(4)])).toHaveLength(3);
    expect(reconcileHourSources([entry(1)], [entry(2), entry(3)])).toHaveLength(2);
    expect(reconcileHourSources([entry(1), entry(2)], [])).toHaveLength(2);
    expect(reconcileHourSources([], [entry(1), entry(2)])).toHaveLength(2);
    expect(reconcileHourSources([entry(1, { date: new Date("2026-10-08T03:00:00Z"), description: " TRABAJO " })], [entry(2)])).toHaveLength(1);
    expect(reconcileHourSources([entry(1, { personnelId: 3 })], [entry(2)])).toHaveLength(2);
    expect(reconcileHourSources([entry(1, { date: new Date("2026-10-08T03:00:00Z") })], [entry(2, { date: new Date("2026-10-08T00:00:00Z") })])).toHaveLength(1);
  });
});

describe("Financial applicability and reconciliation guards", () => {
  it("has neutral health when there is nothing applicable, evaluates available metrics", () => {
    const none = { markup: null, hasBudget: false, hasHoursEstimate: false, budgetUtilization: 0, hoursDeviation: 0 };
    expect(computeHealthScore(none)).toBeNull();
    expect(computeHealthScore({ ...none, hasBudget: true, budgetUtilization: 40 })).toBe(100);
    expect(computeHealthScore({ ...none, markup: 1 })).toBe(0);
  });
  it("blocks Excel, pre-cutover and closed periods independently", () => {
    expect(reconciliationBlockers("2026-10", 1, "2026-09", "OPEN")).toEqual([]);
    expect(reconciliationBlockers("2026-08", 0, "2026-09", "CLOSED")).toHaveLength(3);
    expect(reconciliationBlockers("2026-10", 1, null, "IN_REVIEW")).toHaveLength(1);
  });
  it("uses a stable client color and neutral missing-client color", () => {
    expect(clientCalendarColor(12)).toBe(clientCalendarColor(12));
    expect(clientCalendarColor(null)).toBe(clientCalendarColor(undefined));
    expect(clientCalendarColor(12)).not.toBe(clientCalendarColor(13));
  });
});

describe("Atomic deletion of a task tree", () => {
  let selected: any[], tree: any[], native: any[], imported: any[], tx: any, remove: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    selected = [{ id: 1, projectId: 9 }, { id: 2, projectId: 9 }];
    tree = [{ id: 1, parent_task_id: 5 }, { id: 2, parent_task_id: 1 }, { id: 3, parent_task_id: 2 }];
    native = []; imported = []; remove = vi.fn().mockResolvedValue([]);
    tx = {
      execute: vi.fn().mockResolvedValueOnce({ rows: [] }).mockImplementation(async () => ({ rows: tree })),
      select: vi.fn(() => ({ from: (table: any) => ({ where: () => ({ for: async () => selected, limit: async () => table === taskTimeEntries ? native : table === asanaTimeEntries ? imported : [] }) }) })),
      delete: vi.fn(() => ({ where: remove })),
    };
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));
  });
  it("deduplicates selected parent/child trees and returns surviving ancestors", async () => {
    const result = await deleteEmptyTaskTrees(9, [1, 2]);
    expect(result).toEqual({ deletedTaskIds: [1, 2, 3], parentTaskIds: [5] });
    expect(tx.delete).toHaveBeenCalledWith(tasks);
    expect(remove).toHaveBeenCalledOnce();
  });
  it.each(["native", "imported"])("rejects the whole batch when a descendant has %s hours", async source => {
    if (source === "native") native = [{ id: 17 }]; else imported = [{ gid: "old-entry" }];
    await expect(deleteEmptyTaskTrees(9, [1, 2])).rejects.toMatchObject({ status: 409 });
    expect(tx.execute).toHaveBeenCalledTimes(2); // Project and row locks before validation.
    expect(tx.delete).not.toHaveBeenCalled();
  });
  it("rejects stale selections and mixed project IDs before deletion", async () => {
    selected[1].projectId = 10;
    await expect(deleteEmptyTaskTrees(9, [1, 2])).rejects.toMatchObject({ status: 409 });
    expect(tx.delete).not.toHaveBeenCalled();
    selected = [selected[0]];
    await expect(deleteEmptyTaskTrees(9, [1, 2])).rejects.toMatchObject({ status: 409 });
  });
});
