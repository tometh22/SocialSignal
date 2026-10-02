import { describe, expect, it } from "vitest";
// The migration CLI also imports this dependency-free parser in Node.
// @ts-ignore JavaScript release tooling has no declaration file.
import { parseAsanaTasks, actualMinutes, civilDate } from "../scripts/lib/asana-task-csv.mjs";
import { insertTaskSchema } from "../shared/schema";
import { asanaMigrationProvenanceSql } from "../server/migrations/asana-migration-provenance";

const header = "Task ID,Created At,Completed At,Last Modified,Name,Section/Column,Assignee,Assignee Email,Start Date,Due Date,Notes,Parent task,Actual time\n";
const row = (id: string, name: string, parent = "", completed = "", section = "Etapa 1") => `${id},2026-09-01,${completed},2026-09-02,${name},${section},Lola Cámara,lola@example.com,2026-09-01,2026-09-02,,${parent},1:15\n`;

describe("Asana data migration", () => {
  it("keeps civil dates, completion, notes, and minute precision", () => {
    const task = parseAsanaTasks(header + row("123", "Informe", "", "2026-09-02")).tasks[0];
    expect(task.gid).toBe("123");
    expect(task.startDate).toBe("2026-09-01T12:00:00Z");
    expect(task.status).toBe("done");
    expect(task.actualMinutes).toBe(75);
    expect(actualMinutes("")).toBeNull();
    expect(actualMinutes("0:00")).toBe(0);
  });
  it("rejects rolled dates and malformed durations", () => {
    expect(() => civilDate("2026-02-30")).toThrow();
    expect(() => actualMinutes("1:75")).toThrow();
  });
  it("preserves nested hierarchy in export order", () => {
    const tasks = parseAsanaTasks(header + row("1", "Informe") + row("2", "Análisis", "Informe", "", "") + row("3", "Revisión", "Análisis", "", "")).tasks;
    expect(tasks[1].parentGid).toBe("1");
    expect(tasks[2].parentGid).toBe("2");
    expect(tasks[2].section).toBe("Etapa 1");
  });
  it("retains unresolvable external parent names without inventing IDs", () => {
    const task = parseAsanaTasks(header + row("1", "Revisión", "Informe externo")).tasks[0];
    expect(task.parentResolution).toBe("missing");
    expect(task.parentGid).toBeNull();
    expect(task.parentName).toBe("Informe externo");
  });
  it("deduplicates source IDs and preserves every duplicate source row", () => {
    const parsed = parseAsanaTasks(header + row("1", "Informe") + row("1", "Informe"));
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.duplicateRows).toBe(1);
    expect(parsed.tasks[0].sourceDuplicates).toHaveLength(1);
  });
  it("preserves genuinely unnamed Asana tasks", () => {
    expect(parseAsanaTasks(header + row("1", "")).tasks[0].title).toBe("");
  });
  it("does not let task clients overwrite source provenance", () => {
    const task = insertTaskSchema.parse({ title: "Informe", projectId: 1, asanaTaskGid: "fake", asanaSource: { actualMinutes: 999 } });
    expect(task).not.toHaveProperty("asanaTaskGid");
    expect(task).not.toHaveProperty("asanaSource");
  });
  it("makes source identifiers unique per project and keeps financial links relational", () => {
    expect(asanaMigrationProvenanceSql).toContain("tasks(project_id,asana_task_gid)");
    expect(asanaMigrationProvenanceSql).toContain("PRIMARY KEY(project_id,quotation_id)");
    expect(asanaMigrationProvenanceSql).toContain("REFERENCES active_projects(id)");
  });
});

// @ts-ignore Release tooling is deliberately executable in plain Node.
import { parseAsanaTaskJson, parseAsanaTimeJson } from "../scripts/lib/asana-task-json.mjs";
import { filterTasksByOrigin } from "../shared/utils/task-origin";
import { asanaSourceTimeSql } from "../server/migrations/asana-source-time";
const sourceTask = (gid: string, extra = {}) => ({ gid, name: `Task ${gid}`, completed: false, created_at: "2026-09-01T15:30:00Z", actual_time_minutes: 0, ...extra });
describe("Full Asana source reconciliation", () => {
  it("keeps exact parent IDs even when several parents have the same name", () => {
    const child = sourceTask("3", { parent: { gid: "2", name: "Same" } });
    const parsed = parseAsanaTaskJson({ data: [sourceTask("1", { name: "Same" }), sourceTask("2", { name: "Same", memberships: [{ project: { gid: "90" }, section: { name: "Reports" } }], subtasks: [child] })] }, "90");
    expect(parsed.tasks).toHaveLength(3); expect(parsed.tasks[2].parentGid).toBe("2"); expect(parsed.tasks[2].section).toBe("Reports"); expect(parsed.tasks[2].raw).not.toHaveProperty("subtasks");
  });
  it("deduplicates tasks present both in a project and under another task", () => {
    const child = sourceTask("2", { parent: { gid: "1" } });
    expect(parseAsanaTaskJson({ data: [sourceTask("1", { subtasks: [child] }), child] }, "90").tasks).toHaveLength(2);
  });
  it("preserves milestone and exact completion timestamps", () => {
    const task = parseAsanaTaskJson({ data: [sourceTask("1", { completed: true, completed_at: "2026-09-02T00:01:23Z", resource_subtype: "milestone" })] }, "90").tasks[0];
    expect(task.isMilestone).toBe(true); expect(task.completedAt).toBe("2026-09-02T00:01:23.000Z"); expect(task.status).toBe("done");
  });
  it("rejects missing nested fields, cycles and unfinished pagination", () => {
    expect(() => parseAsanaTaskJson({ data: [sourceTask("1", { subtasks: [{ gid: "2" }] })] }, "90")).toThrow();
    expect(() => parseAsanaTaskJson({ data: [sourceTask("1", { parent: { gid: "2" } }), sourceTask("2", { parent: { gid: "1" } })] }, "90")).toThrow();
    expect(() => parseAsanaTaskJson({ data: [], next_page: { offset: "next" } }, "90")).toThrow();
  });
  it("retains source time when its task or author has been deleted", () => {
    const entry = parseAsanaTimeJson({ data: [{ gid: "10", attributable_to: { gid: "90" }, entered_on: "2025-09-01", duration_minutes: 37, task: null, created_by: null }] }, "90")[0];
    expect(entry.taskGid).toBeNull(); expect(entry.authorGid).toBeNull(); expect(entry.minutes).toBe(37); expect(entry.date).toBe("2025-09-01T12:00:00Z");
  });
  it("rejects duplicate time IDs, wrong project attribution and invalid minutes", () => {
    const entry = { gid: "10", attributable_to: { gid: "90" }, entered_on: "2025-09-01", duration_minutes: 1 };
    expect(() => parseAsanaTimeJson({ data: [entry, entry] }, "90")).toThrow(); expect(() => parseAsanaTimeJson({ data: [entry] }, "91")).toThrow(); expect(() => parseAsanaTimeJson({ data: [{ ...entry, duration_minutes: -1 }] }, "90")).toThrow();
  });
  it("keeps native task context when filtering imported tasks", () => {
    const tasks = [{ id: 1, asanaTaskGid: "source" }, { id: 2, parentTaskId: 1 }, { id: 3 }];
    expect(filterTasksByOrigin(tasks, "native").map(t => t.id)).toEqual([1, 2, 3]); expect(filterTasksByOrigin(tasks, "asana").map(t => t.id)).toEqual([1]); expect(filterTasksByOrigin(tasks, "all")).toBe(tasks);
  });
  it("stores original time independently of financial posting", () => {
    expect(asanaSourceTimeSql).toContain("CREATE TABLE IF NOT EXISTS asana_time_entries"); expect(asanaSourceTimeSql).not.toContain("fact_labor_month"); expect(asanaSourceTimeSql).toContain("ON DELETE SET NULL");
  });
});

import { groupTasksBySection } from "../shared/utils/task-sections";
describe("flat project task responses", () => {
  it("retains empty sections and task order", () => {
    const tasks = [{ id: 1, sectionName: "Work" }, { id: 2, sectionName: "Work" }];
    const grouped = groupTasksBySection(tasks, ["Empty", "Work"]);
    expect(Object.keys(grouped)).toEqual(["Empty", "Work"]); expect(grouped.Empty).toEqual([]); expect(grouped.Work).toEqual(tasks);
  });
  it("includes unlisted sections and null section names", () => {
    expect(Object.keys(groupTasksBySection([{ sectionName: null }, { sectionName: "New" }], []))).toEqual(["General", "New"]);
  });
  it("treats prototype-like section names as ordinary section names", () => {
    const task = { sectionName: "__proto__" };const grouped = groupTasksBySection([task], ["constructor"]);
    expect(grouped.__proto__).toEqual([task]);expect(grouped.constructor).toEqual([]);expect(Object.getPrototypeOf(grouped)).toBeNull();
  });
});
