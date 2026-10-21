import { describe, expect, it } from "vitest";
import { taskHourOwner, taskHourAttribution } from "../shared/utils/task-hour-owner";
import { filterHoursTasks, hoursSectionKey, hoursSectionOptions, reconcileSectionHours, validHoursSection } from "../shared/utils/hours-section";

describe("hours follow the assigned person without extending permissions", () => {
  it("uses the subtask owner first, then its parent's owner, never the logger", () => {
    expect(taskHourOwner({ assigneeId: 2 }, { assigneeId: 1 })).toBe(2);
    expect(taskHourOwner({}, { assigneeId: 1 })).toBe(1);
    expect(taskHourOwner({})).toBeNull();
    expect(taskHourAttribution(2, 1, true)).toEqual({ personnelId: 2 });
    expect(taskHourAttribution(2, null, true)).toEqual({ personnelId: 2 });
  });
  it("allows self logging but rejects other people's hours without existing management access", () => {
    expect(taskHourAttribution(2, 2, false, 2)).toEqual({ personnelId: 2 });
    expect(taskHourAttribution(2, 1, false)).toMatchObject({ status: 403 });
    expect(taskHourAttribution(2, null, false)).toMatchObject({ status: 403 });
  });
  it("rejects a stale timer or spoofed target, even for managers", () => {
    expect(taskHourAttribution(2, 1, true, 3)).toMatchObject({ status: 409 });
    expect(taskHourAttribution(2, 2, false, "bogus")).toMatchObject({ status: 409 });
    expect(taskHourAttribution(null, 1, true)).toMatchObject({ status: 400 });
  });
});

describe("hours dashboard section scope", () => {
  const tasks = [
    { id: 1, projectId: 10, sectionName: "Seguimiento" },
    { id: 2, projectId: 20, sectionName: "Seguimiento" },
    { id: 3, projectId: 10, sectionName: "Análisis" },
    { id: 4, projectId: 10, sectionName: null },
    { id: 5, projectId: 10, sectionName: "unsectioned" },
  ];
  it("intersects project and section for real task context and planned estimates, including empty projects", () => {
    expect(filterHoursTasks(tasks, 10, "named:Seguimiento").map(t => t.id)).toEqual([1]);
    expect(filterHoursTasks(tasks, null, "named:Seguimiento").map(t => t.id)).toEqual([1, 2]);
    expect(filterHoursTasks(tasks, 99)).toEqual([]);
    expect(filterHoursTasks(tasks, 10, "named:Missing")).toEqual([]);
  });
  it("keeps literal reserved names, accents and unsectioned records distinct", () => {
    expect(hoursSectionKey("unsectioned")).toBe("named:unsectioned");
    expect(hoursSectionKey(null)).toBe("unsectioned");
    expect(hoursSectionOptions(tasks).filter(x => x.value === "named:Seguimiento")).toHaveLength(1);
    expect(validHoursSection(["named:Análisis"])).toBe(false);
    expect(validHoursSection("named:")).toBe(false);
    expect(validHoursSection("named:" + "x".repeat(251))).toBe(false);
    expect(validHoursSection("named:Análisis")).toBe(true);
  });
  it("attributes matched legacy imports to the task section without double counting or losing unmatched history", () => {
    const base = { projectId: 10, personnelId: 2, date: "2026-10-21", hours: 2, description: "Seguimiento" };
    const task = [{ ...base, sectionName: "Seguimiento" }, { ...base, hours: 3, sectionName: "Análisis" }];
    const legacy = [{ ...base, sectionName: null }, { ...base, hours: 4, sectionName: null }];
    expect(reconcileSectionHours(task, legacy).reduce((sum, e) => sum + e.hours, 0)).toBe(9);
    expect(reconcileSectionHours(task, legacy, "named:Seguimiento").map(e => e.hours)).toEqual([2]);
    expect(reconcileSectionHours(task, legacy, "named:Análisis").map(e => e.hours)).toEqual([3]);
    expect(reconcileSectionHours(task, legacy, "unsectioned").map(e => e.hours)).toEqual([4]);
  });
});
