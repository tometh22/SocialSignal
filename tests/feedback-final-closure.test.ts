import { computeAlerts } from "../client/src/lib/smart-alerts";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { taskDateBucket, taskCompletedThisWeek } from "../shared/utils/task-date-bucket";
import { absenceTimelineBars, absenceTimelineRange } from "../shared/utils/absence-timeline";
import { enumerateBusinessDays, isValidAbsenceDate } from "../shared/utils/absence";
import { calculateSettlementDifference, canResubmitSettlement } from "../shared/utils/monthly-settlement-declaration";
import { parseRemRows } from "../shared/utils/rem-import";
import { nextRecurringTaskDate, recurrenceFromDescription } from "../shared/utils/task-recurrence";
import { parseMasterFxRows } from "../shared/utils/master-fx";
import { insertPersonnelSchema } from "../shared/schema";
const now = new Date("2026-10-02T13:00:00Z");
const source = (file: string) => readFileSync(file, "utf8");

describe("Personnel birthday persistence", () => {
  it("retains birthdays on create and update", () => {
    expect(insertPersonnelSchema.parse({ name: "Carolina", roleId: 42, hourlyRate: 0, birthday: "1990-03-02" }).birthday).toBe("1990-03-02");
    expect(insertPersonnelSchema.partial().parse({ birthday: "1992-02-29" }).birthday).toBe("1992-02-29");
    expect(insertPersonnelSchema.partial().parse({ birthday: null }).birthday).toBeNull();
  });
  it("rejects non-existent birthdays", () => expect(insertPersonnelSchema.partial().safeParse({ birthday: "2026-02-31" }).success).toBe(false));
});

describe("Feedback closure: dates and task visibility", () => {
  it.each([
    [{ status: "todo" }, "no_date"],
    [{ status: "in_progress", startDate: "2026-10-05" }, "upcoming"],
    [{ status: "todo", startDate: "2026-10-02", dueDate: "2026-10-02" }, "in_progress"],
    [{ status: "blocked", dueDate: "2026-10-01" }, "overdue"],
    [{ status: "todo", dueDate: "2026-10-05" }, "in_progress"],
    [{ status: "done", dueDate: "2026-10-01" }, null],
    [{ status: "cancelled" }, null],
  ])("classifies %j as %s", (task, expected) => expect(taskDateBucket(task, now)).toBe(expected));
  it("uses Buenos Aires day when UTC has already crossed midnight", () => {
    expect(taskDateBucket({ status: "todo", dueDate: "2026-10-01" }, new Date("2026-10-02T01:00:00Z"))).toBe("in_progress");
  });
  it("only shows completions in the current week", () => {
    expect(taskCompletedThisWeek({ status: "done", completedAt: "2026-09-28T15:00:00Z" }, now)).toBe(true);
    expect(taskCompletedThisWeek({ status: "done", completedAt: "2026-09-27T15:00:00Z" }, now)).toBe(false);
  });
});

describe("Absence planning", () => {
  it("uses precise inclusive days and separate lanes for genuine overlaps", () => {
    const range = absenceTimelineRange(2026, 1);
    const bars = absenceTimelineBars([{ startDate: "2026-01-01", endDate: "2026-01-02" }, { startDate: "2026-01-02", endDate: "2026-01-03" }, { startDate: "2026-01-05", endDate: "2026-01-06" }], range);
    expect(bars.map(bar => bar.lane)).toEqual([0, 1, 0]);
    expect(bars[0].width).toBeCloseTo(2 / 31 * 100);
  });
  it("clips crossing-year absences without widening them to a whole month", () => {
    const bars = absenceTimelineBars([{ startDate: "2025-12-29", endDate: "2026-01-03" }], absenceTimelineRange(2026));
    expect(bars[0].left).toBe(0); expect(bars[0].width).toBeCloseTo(3 / 365 * 100);
  });
  it("handles leap years", () => expect(absenceTimelineRange(2028, 2).days).toBe(29));
  it("rejects invalid calendar dates", () => {
    expect(isValidAbsenceDate("2026-02-31")).toBe(false);
    expect(() => enumerateBusinessDays("2026-02-31", "2026-03-06", new Set())).toThrow();
  });
  it("counts cross-year weekdays excluding supplied holidays", () => {
    expect(enumerateBusinessDays("2026-12-31", "2027-01-04", new Set(["2027-01-01"]))).toEqual(["2026-12-31", "2027-01-04"]);
  });
  it("isolates the personal balance and management surface", () => {
    const page = source("client/src/pages/personnel-absences.tsx");
    expect(page).toContain('const isManagement = defaultTab === "team" && isOperations');
    expect(page).toContain('isManagement ? (teamPersonId ? Number(teamPersonId) : undefined) : myPerson?.id');
    expect(page).toContain("{!isManagement && <TabsContent");
  });
});

describe("Settlement declarations", () => {
  it.each([[100, 1500, 1540, -4000], [100, 1600, 1540, 6000], [100, 1540, 1540, 0], [100.25, 1540.25, 1540, 25.06]])("calculates the signed, rounded difference", (usd, bank, closing, expected) => expect(calculateSettlementDifference(usd, bank, closing)).toBe(expected));
  it("rejects invalid amounts and rates", () => {
    for (const rate of [0, -1, Infinity, NaN]) expect(() => calculateSettlementDifference(100, rate, 1500)).toThrow();
  });
  it("keeps approved declarations immutable", () => {
    expect(canResubmitSettlement("approved")).toBe(false);
    expect(canResubmitSettlement("rejected")).toBe(true);
    const routes = source("server/routes.ts");
    expect(routes).toContain("setWhere: sql`${monthlySettlementDeclarations.status} <> 'approved'`");
    expect(routes).toContain("eq(monthlySettlementDeclarations.submittedAt, new Date(input.submittedAt))");
    expect(routes).toContain("previous: previous ?? null");
  });
});

describe("REM future import", () => {
  it("preserves ES and US decimals instead of multiplying rates by 100", () => {
    expect(parseRemRows("2027;1;1540,25\n2027,2,1540.25\n2027-3,1,540.25").map(row => row.rate)).toEqual([1540.25, 1540.25, 1540.25]);
  });
  it.each(["2027;13;1500", "2027;1;0", "2027;1;NaN", "bad row", "2027;1;1500\n2027;1;1550"])('rejects invalid input %s without silently dropping rows', text => expect(() => parseRemRows(text)).toThrow());
  it("does not recreate inactive historical forecast rows at each restart", () => {
    const migration = source("server/migrations/exchange-rate-forecast-2026.ts");
    expect(migration).not.toContain("existing.is_active = TRUE");
    expect(migration).toContain("2026 * 100 + forecast.month");
  });
});

describe("Excel recurring tasks", () => {
  it("recognizes only explicit recurring descriptions", () => {
    expect(recurrenceFromDescription("Es una tarea recurrente. Lunes y Miércoles de cada semana")).toEqual({ frequency: "weekly", interval: 1, weekdays: [1, 3] });
    expect(recurrenceFromDescription("Son tareas recurrentes mensuales.")).toEqual({ frequency: "monthly", interval: 1 });
    expect(recurrenceFromDescription("Informe semanal")).toBeNull();
  });
  it("schedules Monday and Wednesday, strictly after completion", () => {
    expect(nextRecurringTaskDate({ frequency: "weekly", interval: 1, weekdays: [1, 3] }, null, new Date("2026-10-05T16:00:00Z"))).toBe("2026-10-07");
  });
  it("keeps the biweekly Monday cadence", () => {
    expect(nextRecurringTaskDate({ frequency: "weekly", interval: 2, weekdays: [1] }, "2026-10-05", new Date("2026-10-05T16:00:00Z"))).toBe("2026-10-19");
  });
  it("clamps monthly day at month end and skips elapsed instances", () => {
    expect(nextRecurringTaskDate({ frequency: "monthly", interval: 1 }, "2026-01-31", new Date("2026-01-31T16:00:00Z"))).toBe("2026-02-28");
    expect(nextRecurringTaskDate({ frequency: "monthly", interval: 1 }, "2026-01-31", now)).toBe("2026-10-31");
  });
  it("protects against generating two successors", () => {
    expect(source("migrations/0071_task_recurrence.sql")).toContain("CREATE UNIQUE INDEX");
    expect(source("server/routes.ts")).toContain('if ((current.status === "done") === completing) return current');
  });
});

describe("Master FX source dates and observed versus future rates", () => {
  it("parses numeric month prefixes, Spanish abbreviations and thousands", () => {
    const rows = parseMasterFxRows([["01 ene 2026","1.470"],["09 sep 2026","1.560"],["10 oct 2026","1.565"],["01 ene 2027","1.661"],["07 ago 2027","1.844","Prox 12 meses por falta de información"]], now);
    expect(rows.map(row=>row.month)).toEqual([1,9,10,1,8]);
    expect(rows.map(row=>row.tipoCambio)).toEqual([1470,1560,1565,1661,1844]);
    expect(rows.map(row=>row.rateType)).toEqual(["end_of_month","end_of_month","estimated","estimated","estimated"]);
  });
  it("does not turn an explicitly estimated historical row into observed data", () => expect(parseMasterFxRows([["01 ene 2026","1.470","Proyección REM"]],now)[0].rateType).toBe("estimated"));
  it("rejects duplicated periods", () => expect(()=>parseMasterFxRows([["01 ene 2026","1470"],["01 ene 2026","1490"]],now)).toThrow());
});

it("uses the database row version for absence concurrency, preserving timestamp microseconds", () => { expect(source("server/routes.ts")).toContain("sql`xmin::text = ${current.rowVersion}`"); });

it("does not report urgent zero markup when portfolio costs are unknown", () => { const result=computeAlerts([{projectId:1,projectName:"Imported",clientName:"Warner",revenue:29230,cost:0,markup:0,margin:0,budget:29230,budgetUsed:0,totalHours:0,estimatedHours:0,teamSize:0,status:"active"}]);expect(result.insights.join(" ")).toContain("no hay costos reales suficientes");expect(result.insights.join(" ")).not.toContain("Acción urgente"); });

it("persists empty imported and copied project sections without placeholder tasks", () => { const routes=source("server/routes.ts"); expect(routes).toContain("taskSectionNames: [...new Set(item.sections.map(section => section.name))]");expect(routes).toContain("for (const name of project?.names ?? []) sections[name] = []");expect(source("client/src/components/tasks/ProjectTaskList.tsx")).toContain('apiRequest("/api/tasks/section", "POST", { projectId: data.projectId, sectionName: data.sectionName })'); });
