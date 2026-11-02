import { navigationAreas } from "@/lib/app-navigation";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Feedback Mind V2 visibility for Victoria Achabal", () => {
  it("exposes the operational project surfaces in the main navigation", () => {
    const areas = navigationAreas({ permissions: ['operations', 'projects'] });
    const projects = areas.find(area => area.id === 'projects')!.items.map(item => item.href);
    expect(projects).toEqual(expect.arrayContaining(['/active-projects', '/tasks/projects/kanban', '/tasks/team-calendar']));
    expect(areas.find(area => area.id === 'operations')!.items.map(item => item.href)).toContain('/operations/absences');
    expect(navigationAreas({ permissions: ['task_manager'] }).find(area => area.id === 'projects')!.items[0].href).toBe('/tasks/projects');

    const absences = source("client/src/pages/personnel-absences.tsx");
    expect(absences).toContain("Gestión de Operaciones: aprobá solicitudes, administrá cupos");
    expect(absences).toContain("Solicitá tus días y consultá el estado");
  });

  it("shows and edits only the current career-plan classification", () => {
    const admin = source("client/src/pages/admin-fixed.tsx");
    const inlinePersonnel = source("client/src/components/admin/inline-edit-personnel.tsx");
    const routes = source("server/routes.ts");

    expect(admin).toContain("isCanonicalRoleClassification(role)");
    expect(admin).toContain("role.isActive !== false");
    expect(admin).toContain("Plan de carrera vigente");
    expect(inlinePersonnel).not.toContain("form.roleId");
    expect(inlinePersonnel).not.toContain('aria-label="Rol histórico"');
    expect(inlinePersonnel).toContain("Completá Nivel, Subnivel y Área");
    expect(routes).toContain("?? null,\n    sublevel: normalizePersonnelSublevel");
  });

  it("makes project status explicit without requiring drag and drop", () => {
    const kanban = source("client/src/pages/tasks/projects-kanban.tsx");

    expect(kanban).toContain("Estado operativo");
    expect(kanban).toContain('aria-label={`Estado operativo de ${project.name || "proyecto"}`}');
    expect(kanban).toContain("moveMutation.mutate({ projectId: project.id, workflowStage:");
  });

  it("labels closed months and projections in the monthly personnel grid", () => {
    const historicalCosts = source("client/src/components/admin/HistoricalCostsTable.tsx");

    expect(historicalCosts).toContain("isClosedPeriod(selectedYear, index + 1)");
    expect(historicalCosts).toContain('"Real cerrado"');
    expect(historicalCosts).toContain('"Mes actual"');
    expect(historicalCosts).toContain('"Proyección"');
  });
});
