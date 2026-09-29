import { describe, expect, it } from "vitest";
import { OBJECTIVE_PLAN_2026 } from "@shared/objectives-plan-2026";
import { RETIRED_OBJECTIVES } from "@shared/objectives-retirement";
import { buildObjectivesMap, objectivePickerGroups } from "../client/src/lib/objectives-tree";
import type { Objective } from "../client/src/lib/objectives-api";

// El plan tal como lo sirve la API: ids propios, padre por id, retirados marcados.
const ids = new Map(OBJECTIVE_PLAN_2026.objectives.map((objective, index) => [objective.slug, index + 1]));
const objectives: Objective[] = OBJECTIVE_PLAN_2026.objectives.map((objective) => ({
  id: ids.get(objective.slug)!,
  slug: objective.slug,
  level: objective.level,
  title: objective.title,
  targetKind: objective.targetKind,
  targetDate: objective.targetDate,
  status: "planned",
  parentObjectiveId: objective.parentSlug ? ids.get(objective.parentSlug) ?? null : null,
  retiredAt: objective.slug in RETIRED_OBJECTIVES ? "2026-09-17T00:00:00Z" : null,
}));

describe("a qué objetivo se cuelga una acción", () => {
  const groups = objectivePickerGroups(buildObjectivesMap(objectives, "2026-09-29"));
  const options = groups.flatMap((group) => group.options);

  it("ofrece los 15 objetivos del plan, no las ~70 entradas", () => {
    expect(options).toHaveLength(15);
    expect(new Set(options.map((option) => option.id)).size).toBe(15);
  });

  it("los agrupa en la meta del año y los cinco frentes", () => {
    expect(groups.map((group) => group.label)).toEqual([
      "Meta del año",
      "Cerrar lo que está abierto",
      "Nuevos negocios",
      "Renovar y retener",
      "Productos propios",
      "Operación y caja",
    ]);
  });

  it("no ofrece hábitos, meses ni lo ya cerrado", () => {
    const titles = options.map((option) => option.title);
    expect(titles.some((title) => /^(Septiembre|Octubre|Noviembre|Diciembre):/.test(title))).toBe(false);
    expect(titles).not.toContain("Caja proyectada a 13 semanas protegida");
    const closed = objectives.map((objective) => objective.slug === "company-warner-mexico" ? { ...objective, status: "done" } : objective);
    const again = objectivePickerGroups(buildObjectivesMap(closed, "2026-09-29")).flatMap((group) => group.options);
    expect(again).toHaveLength(14);
  });
});
