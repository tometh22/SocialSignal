import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import CapacityProjectPlanning from "../client/src/components/tasks/CapacityProjectPlanning";
import { capacityGroupSchema, capacityWeekSchema, capacityProjectHours, type CapacityPlanning, type CapacityMode } from "../shared/utils/capacity-planning";
import { absenceNotificationDestination, settlementReviewDestination } from "../shared/utils/notification-destinations";
import { readFileSync } from "node:fs";

function planning(mode: CapacityMode): CapacityPlanning {
  return { projects: [{ id: 1, name: "Project", clientName: "Client", mode, sectionNames: ["Base", "Empty"], memberIds: [1] }],
    tasks: [{ id: 1, projectId: 1, personnelId: 1, title: "Base task", sectionName: "Base", estimatedHours: 10, isExtra: false },
      { id: 2, projectId: 1, personnelId: 1, title: "Extra task", sectionName: "Base", estimatedHours: 2, isExtra: true }],
    groups: [{ projectId: 1, personnelId: 1, scope: "project", sectionName: "", estimatedHours: 30 }, { projectId: 1, personnelId: 1, scope: "section", sectionName: "Base", estimatedHours: 16 }] };
}
const render = (data: CapacityPlanning, isOperations = true) => renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
  React.createElement(CapacityProjectPlanning, { planning: data, personnelId: 1, weekStart: "2026-11-02", isOperations })));

describe("capacity planning", () => {
  it.each(["task", "section", "project"] as const)("renders the %s mode with a single selected base and explicit extras", mode => {
    const data = planning(mode);
    const total = { task: 12, section: 18, project: 32 }[mode];
    expect(capacityProjectHours(mode, data.tasks, data.groups)).toBe(total);
    const html = render(data);
    expect(html).toContain(`${total} h est.`);
    expect(html).toContain('aria-label="Modalidad de estimación de Project"');
    if (mode !== "task") expect(html).toContain('aria-label="Extra: Extra task"');
    if (mode === "section") expect(html).toContain('aria-label="Horas de Empty en Project"');
  });
  it("lets a member estimate an assigned empty project without granting mode management", () => {
    const data = planning("project"); data.tasks = []; data.groups = [];
    const html = render(data, false);
    expect(html).toContain('aria-label="Horas base de Project"');
    expect(html).not.toContain("<select");
  });
  it("requires finite nonnegative hours, a real Monday and a section when appropriate", () => {
    const base = { projectId: 1, personnelId: 1, scope: "project", weekStart: "2026-11-02", estimatedHours: 20 };
    for (const estimatedHours of [-1, Infinity, NaN, 10001]) expect(capacityGroupSchema.safeParse({ ...base, estimatedHours }).success).toBe(false);
    for (const weekStart of ["2026-11-03", "2026-02-30", "invalid", "2026-11-02T00:00:00Z"]) expect(capacityWeekSchema.safeParse(weekStart).success).toBe(false);
    expect(capacityGroupSchema.safeParse({ ...base, scope: "section" }).success).toBe(false);
    expect(capacityGroupSchema.parse({ ...base, estimatedHours: 0 }).estimatedHours).toBe(0);
  });
});

describe("notification destinations", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  it("sends absence requests, resubmissions and cancellations to the operations screen", () => {
    expect(absenceNotificationDestination("operations")).toBe("/operations/absences");
    expect(absenceNotificationDestination("person")).toBe("/absences");
    expect(routes.match(/actionUrl: absenceNotificationDestination\("operations"\)/g)).toHaveLength(3);
  });
  it("keeps legacy settlement review in the operations closing with its period", () => {
    const url = new URL(settlementReviewDestination("2026-10"), "https://example.test");
    expect(url.pathname).toBe("/operations/monthly-closing");
    expect(url.searchParams.get("period")).toBe("2026-10");
    expect(routes).toContain("actionUrl: settlementReviewDestination(");
  });
});
