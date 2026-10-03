import { PROJECT_ROLE_OPTIONS } from "../client/src/constants/project-roles";
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { taskIsOnCivilDay, taskDateSchema, taskDateWindowSchema, taskDateWindowEnd, isValidCivilDate, parseTaskCivilDate } from "../shared/utils/task-civil-date";
import { filterTaskTree } from "../shared/utils/task-tree-filter";
import { taskDateBucket } from "../shared/utils/task-date-bucket";
import { sumTaskLoggedHours } from "../shared/utils/task-hours-total";
import { isTaskRelatedQuery } from "../shared/utils/task-cache-key";
import { isTaskProjectManager, TASK_PROJECT_ROLES } from "../shared/task-project-roles";
import { insertTaskSchema, insertTaskTimeEntrySchema, insertTaskWeeklyEstimateSchema } from "../shared/schema";
import { parseHoursInput, roundToMinute } from "../client/src/lib/task-hours";
import { calcElapsed, getStoredTimer, writeStoredTimer, TIMER_CHANGE_EVENT, timerHours } from "../client/src/lib/task-timer";

const source = (path: string) => readFileSync(path, "utf8");
afterEach(() => vi.unstubAllGlobals());

describe("Asana module QA: civil dates and boundary validation", () => {
  it.each(["2026-02-30", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "not-a-date", "3", "02/30/2026", "2026-2-3"])("rejects impossible day %s", day => {
    expect(isValidCivilDate(day)).toBe(false);
    expect(taskDateSchema.safeParse(day).success).toBe(false);
  });
  it("recognizes leap days and stores civil task dates at noon", () => {
    expect(isValidCivilDate("2024-02-29")).toBe(true);
    expect(isValidCivilDate("2026-02-29")).toBe(false);
    expect(taskDateSchema.parse("2026-10-05").toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });
  it("rejects impossible civil days even inside ISO timestamps", () => {
    expect(taskDateSchema.safeParse("2026-02-30T12:00:00Z").success).toBe(false);
  });
  it("keeps valid historical ISO filters compatible", () => {
    expect(taskDateWindowSchema.safeParse({ dateFrom: "2026-10-05T03:00:00Z", dateTo: "2026-10-06T02:59:59Z" }).success).toBe(true);
    expect(taskDateWindowEnd("2026-10-06T02:59:59Z").toISOString()).toBe("2026-10-06T02:59:59.000Z");
  });
  it("includes the last civil day and rejects reversed windows", () => {
    expect(taskDateWindowEnd("2026-10-05").toISOString()).toBe("2026-10-05T23:59:59.999Z");
    expect(taskDateWindowSchema.safeParse({ dateFrom: "2026-10-06", dateTo: "2026-10-05" }).success).toBe(false);
    expect(taskDateWindowSchema.safeParse({ dateFrom: "2026-10-05", dateTo: "2026-10-05" }).success).toBe(true);
  });
  it("renders the same civil day for midnight and noon source timestamps", () => {
    for (const time of ["00:00:00", "12:00:00"]) {
      const date = parseTaskCivilDate(`2026-10-05T${time}Z`);
      expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 10, 5]);
    }
  });
  it("validates creation and weekly planning, not only updates", () => {
    expect(insertTaskSchema.safeParse({ title: "  ", projectId: 1 }).success).toBe(false);
    expect(insertTaskSchema.safeParse({ title: "Task", projectId: 1, collaboratorIds: [-1] }).success).toBe(false);
    expect(insertTaskWeeklyEstimateSchema.safeParse({ taskId: 1, weekStart: "2026-02-30", estimatedHours: 2 }).success).toBe(false);
    expect(insertTaskTimeEntrySchema.safeParse({ taskId: 1, personnelId: 1, date: "2026-02-30", hours: 1 }).success).toBe(false);
  });
});

describe("Asana module QA: hours and shared timer", () => {
  const tree = [{ id: 1, parentTaskId: null, loggedHours: 5 }, { id: 2, parentTaskId: 1, loggedHours: 3 }, { id: 3, parentTaskId: 2, loggedHours: 2 }, { id: 4, parentTaskId: null, loggedHours: 1 }];
  it("does not count nested accumulated hours twice", () => expect(sumTaskLoggedHours(tree)).toBe(6));
  it("retains a visible child when its parent is filtered out", () => expect(sumTaskLoggedHours(tree.slice(1))).toBe(4));
  it("supports empty and unknown totals", () => expect(sumTaskLoggedHours([{ id: 1 }])).toBe(0));
  it.each(["1m", "1:01", "1,5", "2h15", "45min"])("keeps minute precision for %s", input => {
    const expected = { "1m": 1 / 60, "1:01": 61 / 60, "1,5": 1.5, "2h15": 2.25, "45min": .75 }[input];
    expect(roundToMinute(parseHoursInput(input)!)).toBe(expected);
  });
  it("timer preserves one minute without rounding to .02 hours", () => expect(timerHours(60)).toBe(1 / 60));
  it("future or invalid timer anchors never produce negative time", () => {
    expect(calcElapsed("2026-10-05T12:00:00Z", Date.parse("2026-10-05T11:00:00Z"))).toBe(0);
    expect(calcElapsed("invalid")).toBe(0);
  });
  it("notifies every timer instance in the same tab on start and stop", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    const target = new EventTarget(); vi.stubGlobal("window", target);
    const observed: unknown[] = []; target.addEventListener(TIMER_CHANGE_EVENT, () => observed.push(getStoredTimer()));
    const timer = { taskId: 1, taskTitle: "QA", personnelId: 2, startTime: "2026-10-05T12:00:00Z" };
    writeStoredTimer(timer); writeStoredTimer(null);
    expect(observed).toEqual([timer, null]);
  });
  it("ignores malformed persisted timers", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ taskId: -1, startTime: "invalid" }) });
    expect(getStoredTimer()).toBeNull();
  });
});

describe("Asana module QA: frontend/backend contracts", () => {
  it.each(["/api/tasks", "/api/tasks/project", "/api/tasks/projects", "/api/tasks/team-calendar", "/api/tasks/my-hours", "/api/quotations/341/profitability", "/api/capacity/weekly", "projects"])("refreshes %s after task mutations", path => expect(isTaskRelatedQuery([path, 1])).toBe(true));
  it("does not invalidate unrelated administration queries", () => expect(isTaskRelatedQuery(["/api/personnel"])).toBe(false));
  it("accepts every role the member selector offers", () => {
    expect(TASK_PROJECT_ROLES).toEqual(["owner", "pm", "analyst", "datatech", "setup", "member"]);
    expect(PROJECT_ROLE_OPTIONS.map(role => role.value)).toEqual(TASK_PROJECT_ROLES);
    expect(isTaskProjectManager("pm")).toBe(true); expect(isTaskProjectManager("owner")).toBe(true); expect(isTaskProjectManager("analyst")).toBe(false);
    expect(source("server/routes.ts")).toContain("z.enum(TASK_PROJECT_ROLES)");
  });
  it("duplicates full task trees through an atomic server endpoint", () => {
    expect(source("client/src/components/tasks/ProjectTaskList.tsx")).toContain("/duplicate`, \"POST\"");
    expect(source("server/routes.ts")).toContain("copyEstimates: true");
    expect(source("server/routes.ts")).toContain("La tarea padre debe pertenecer al mismo proyecto");
  });
  it("uses minute parsing for every detail input", () => {
    const detail=source("client/src/components/tasks/TaskDetailPanel.tsx");
    expect(detail).toContain('roundToMinute, parseHoursInput, formatHours');
    expect(detail).not.toContain("roundToQuarterHour"); expect(detail).not.toContain("function parseHoursInput");
  });
  it("refreshes Kanban when a portfolio project closes or is voided", () => expect(source("client/src/pages/active-projects-next.tsx")).toContain("void invalidateTaskQueries()"));
  it("calendar sends civil days and does not shift legacy midnight values", () => {
    const calendar=source("client/src/pages/team-calendar.tsx");
    expect(calendar).toContain('dateTo: format(calEnd, "yyyy-MM-dd")'); expect(calendar).toContain("taskIsOnCivilDay(task");
  });
});


describe("Asana module QA: visible hierarchy and completion", () => {
  const tree = [{ id: 1, title: "Report" }, { id: 2, parentTaskId: 1, title: "Analysis" }, { id: 3, parentTaskId: 2, title: "Deep result" }, { id: 4, title: "Unrelated" }];
  it("keeps all ancestors of a matching third-level task", () => expect(filterTaskTree(tree, "DEEP").map(t => t.id)).toEqual([1, 2, 3]));
  it("keeps the input when no search is entered", () => expect(filterTaskTree(tree, " ")).toBe(tree));
  it("returns no rows for an absent search", () => expect(filterTaskTree(tree, "missing")).toEqual([]));
  it("is safe with malformed cyclic legacy references", () => expect(filterTaskTree([{ id: 1, title: "Match", parentTaskId: 2 }, { id: 2, title: "Parent", parentTaskId: 1 }], "Match")).toHaveLength(2));
  it("does not label the beginning of an ongoing range as overdue", () => expect(taskDateBucket({ status: "in_progress", startDate: "2026-10-01", dueDate: "2026-10-10" }, new Date("2026-10-03T15:00:00Z"))).toBe("in_progress"));
  it("uses actual completed counts rather than treating cancellations as done", () => {
    for (const path of ["client/src/pages/tasks/projects-hub.tsx", "client/src/pages/tasks/project-tasks-page.tsx"]) {
      expect(source(path)).toContain("project.completedCount"); expect(source(path)).not.toContain("project.taskCount - project.pendingCount");
    }
  });
  it("applies existing closing safeguards to task hours", () => expect(source("server/routes.ts").match(/requireProjectUnlocked\(projectIdFromTask\)/g)).toHaveLength(3));
});

it("quick timers persist and share state with the global timer", () => {
  const quick = source("client/src/components/tasks/QuickTaskHours.tsx");
  expect(quick).toContain("useActiveTimer({ trackElapsed: open })");
  expect(quick).not.toContain("setTimerStartedAt");
  expect(quick).toContain("disabled={isRunning}");
});

it("single-date calendar tasks appear only on that day", () => {
  const task={dueDate:"2026-10-05T00:00:00Z"};
  expect(taskIsOnCivilDay(task,"2026-10-04")).toBe(false); expect(taskIsOnCivilDay(task,"2026-10-05")).toBe(true); expect(taskIsOnCivilDay(task,"2026-10-06")).toBe(false);
  expect(taskIsOnCivilDay({startDate:"2026-10-05"},"2026-10-06")).toBe(false);
  expect(taskIsOnCivilDay({startDate:"2026-10-05",dueDate:"2026-10-07"},"2026-10-06")).toBe(true);
});

it("empty projects can create the first task from the toolbar", () => {
  expect(source("client/src/components/tasks/ProjectTaskList.tsx")).toContain('firstSectionAutoAdd > 0 && <NewTaskRow');
  expect(source("client/src/pages/tasks/project-tasks-page.tsx")).toContain('setView("list"); setQuickAddTrigger');
});
it("task and section controls use backend capabilities", () => {
  expect(source("client/src/components/tasks/TaskDetailPanel.tsx")).toContain('task.canDelete &&');
  expect(source("client/src/components/tasks/ProjectTaskList.tsx")).toContain('data?.canManageSections &&');
});
