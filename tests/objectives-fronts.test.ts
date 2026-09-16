import { describe, expect, it } from "vitest";
import { OBJECTIVE_PLAN_2026 } from "@shared/objectives-plan-2026";
import {
  COMPANY_FRONT,
  MONTHLY_NON_NEGOTIABLES,
  MONTH_CHECKPOINT_SLUGS,
  NORTH_STAR,
  NORTH_STAR_SUPPORT,
  areaGroupOf,
  planMonthOf,
  tierFor,
} from "@shared/objectives-fronts";
import { buildObjectivesMap, dueWithin } from "../client/src/lib/objectives-tree";
import type { Objective } from "../client/src/lib/objectives-api";

const SLUGS = new Set(OBJECTIVE_PLAN_2026.objectives.map((o) => o.slug));
const HOY = "2026-09-16";

/** El plan como lo devolvería la API, con ids estables. */
function asObjectives(): Objective[] {
  const idBySlug = new Map(OBJECTIVE_PLAN_2026.objectives.map((o, i) => [o.slug, i + 1]));
  return OBJECTIVE_PLAN_2026.objectives.map((o) => ({
    id: idBySlug.get(o.slug)!,
    slug: o.slug,
    level: o.level,
    title: o.title,
    target: o.target,
    targetKind: o.targetKind,
    targetDate: o.targetDate,
    targetValue: o.targetValue,
    status: o.status,
    progressPercent: o.progressPercent,
    parentObjectiveId: o.parentSlug ? idBySlug.get(o.parentSlug) ?? null : null,
  })) as Objective[];
}

describe("mapa de frentes", () => {
  it("clasifica los 23 objetivos de empresa sin dejar ninguno suelto", () => {
    const empresa = OBJECTIVE_PLAN_2026.objectives.filter((o) => o.level === "company").map((o) => o.slug);
    const cubiertos = new Set([...Object.keys(COMPANY_FRONT), NORTH_STAR, ...NORTH_STAR_SUPPORT, ...MONTH_CHECKPOINT_SLUGS]);
    expect(empresa.filter((s) => !cubiertos.has(s))).toEqual([]);
    expect([...cubiertos].filter((s) => !SLUGS.has(s))).toEqual([]);
  });

  it("todo objetivo de área cae en un grupo", () => {
    const sinGrupo = OBJECTIVE_PLAN_2026.objectives.filter((o) => o.level === "area" && !areaGroupOf(o.slug));
    expect(sinGrupo.map((o) => o.slug)).toEqual([]);
  });

  it("el primer nivel pasa de 23 nodos a un norte y cinco frentes", () => {
    const mapa = buildObjectivesMap(asObjectives(), HOY);
    expect(mapa.northStar?.objective.slug).toBe(NORTH_STAR);
    expect(mapa.fronts).toHaveLength(5);
    expect(mapa.checkpoints).toHaveLength(4);
    expect(mapa.unplaced).toEqual([]);
  });

  it("no pierde ningún objetivo entre las cajas", () => {
    const todos = asObjectives();
    const mapa = buildObjectivesMap(todos, HOY);
    const vistos = new Set<string>();
    const walk = (nodes: typeof mapa.fronts[number]["objectives"]) => {
      for (const node of nodes) {
        vistos.add(String(node.objective.slug));
        walk(node.children);
      }
    };
    for (const front of mapa.fronts) walk(front.objectives);
    if (mapa.northStar) walk([mapa.northStar]);
    walk(mapa.northSupport);
    for (const checkpoint of mapa.checkpoints) vistos.add(String(checkpoint.slug));
    expect(vistos.size).toBe(todos.length);
  });

  it("los estándares no vencen y quedan en su propio panel", () => {
    const mapa = buildObjectivesMap(asObjectives(), HOY);
    expect(mapa.standards.length).toBeGreaterThan(0);
    for (const standard of mapa.standards) {
      expect(standard.targetKind).toBe("continuous");
      expect(standard.targetDate ?? null).toBeNull();
    }
  });

  it("un objetivo de empresa sin frente se muestra aparte en vez de desaparecer", () => {
    const huerfano: Objective = { id: 9999, slug: "company-inventado", level: "company", title: "Sin frente" } as Objective;
    const mapa = buildObjectivesMap([...asObjectives(), huerfano], HOY);
    expect(mapa.unplaced.map((o) => o.slug)).toEqual(["company-inventado"]);
  });
});

describe("prioridad declarada", () => {
  it("toma los innegociables del mes que corre", () => {
    expect(planMonthOf("2026-09-16")).toBe(9);
    expect(planMonthOf("2026-12-01")).toBe(12);
    expect(planMonthOf("2027-01-05")).toBeNull();
    expect(tierFor("company-warner-mexico", "2026-09-16")).toBe("innegociable");
    expect(tierFor("company-warner-mexico", "2026-11-16")).toBe("soporte");
    expect(tierFor("company-bcra-decision", "2026-11-16")).toBe("innegociable");
  });

  it("todos los innegociables declarados existen en el plan", () => {
    for (const [mes, slugs] of Object.entries(MONTHLY_NON_NEGOTIABLES)) {
      for (const slug of slugs) expect(SLUGS.has(slug), `${slug} (mes ${mes})`).toBe(true);
    }
  });

  it("un innegociable se ordena antes que un soporte que vence antes", () => {
    const innegociable: Objective = { id: 1, slug: "company-warner-mexico", level: "company", title: "Warner", targetDate: "2026-12-31", targetKind: "milestone" } as Objective;
    const soporte: Objective = { id: 2, slug: "company-coelsa-retention", level: "company", title: "COELSA", targetDate: "2026-09-20", targetKind: "milestone" } as Objective;
    const orden = dueWithin([soporte, innegociable], 400, HOY).map((o) => o.slug);
    expect(orden[0]).toBe("company-warner-mexico");
  });
});

describe("vista del lunes", () => {
  it("lista lo que vence en los próximos 14 días", () => {
    const proximos = dueWithin(asObjectives(), 14, HOY);
    expect(proximos.length).toBeGreaterThan(0);
    for (const objective of proximos) {
      expect(objective.targetKind).not.toBe("continuous");
    }
  });
});
