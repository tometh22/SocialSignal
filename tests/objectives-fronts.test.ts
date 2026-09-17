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
import { RETIRED_OBJECTIVES } from "@shared/objectives-retirement";
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

  it("distingue un estándar incumplido de uno que nadie midió", () => {
    // Pintar los dos de rojo convierte el semáforo en ruido: hoy los 19
    // estándares del plan están sin medir y nada está realmente mal.
    const base = asObjectives();
    const sinMedir = buildObjectivesMap(base, HOY);
    expect(sinMedir.standardsUnmeasured).toHaveLength(sinMedir.standards.length);
    expect(sinMedir.standardsBreached).toHaveLength(0);

    const primero = String(sinMedir.standards[0].id);
    const segundo = String(sinMedir.standards[1].id);
    const medido = base.map((objective) => {
      if (String(objective.id) === primero) return { ...objective, progressPercent: 40 };
      if (String(objective.id) === segundo) return { ...objective, progressPercent: 100 };
      return objective;
    });
    const mapa = buildObjectivesMap(medido, HOY);
    expect(mapa.standardsBreached.map((o) => String(o.id))).toEqual([primero]);
    expect(mapa.standardsUnmeasured.map((o) => String(o.id))).not.toContain(primero);
    expect(mapa.standardsUnmeasured.map((o) => String(o.id))).not.toContain(segundo);
    expect(mapa.standardsBreached.length + mapa.standardsUnmeasured.length).toBe(mapa.standards.length - 1);
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

describe("qué es realmente un objetivo", () => {
  it("separa los 15 objetivos de las entradas que no lo son", () => {
    const mapa = buildObjectivesMap(asObjectives(), HOY);
    expect(mapa.counts).toEqual({ objetivo: 15, bajada: 46, estandar: 22, checkpoint: 4 });
    const total = Object.values(mapa.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(OBJECTIVE_PLAN_2026.objectives.length);
  });

  it("los objetivos de los frentes más el norte suman los 15", () => {
    const mapa = buildObjectivesMap(asObjectives(), HOY);
    const enFrentes = mapa.fronts.reduce((total, front) => total + front.objectives_, 0);
    expect(enFrentes + (mapa.northStar ? 1 : 0) + mapa.northSupport.length).toBe(mapa.counts.objetivo);
  });

  it("un frente no cuenta sus estándares como objetivos", () => {
    const mapa = buildObjectivesMap(asObjectives(), HOY);
    const opsCaja = mapa.fronts.find((front) => front.id === "front-ops-cash")!;
    expect(opsCaja.standards_).toBeGreaterThan(0);
    expect(opsCaja.objectives_).toBeLessThan(opsCaja.objectives_ + opsCaja.standards_);
  });

  it("ningún frente queda vacío ni aparece un falso 'sin clasificar'", () => {
    // Antes, filtrar por persona dejaba ramas sin raíz que caían en el balde
    // de "sin frente" con un mensaje de error, y frentes en cero que decían
    // "sin urgencias". El mapa ya no se filtra, así que no puede pasar.
    const mapa = buildObjectivesMap(asObjectives(), HOY);
    expect(mapa.unplaced).toEqual([]);
    for (const front of mapa.fronts) expect(front.objectives_ + front.standards_).toBeGreaterThan(0);
  });

  it("sólo un objetivo de empresa puede caer en 'sin frente'", () => {
    const rama: Objective = { id: 9999, slug: "area-huerfana", level: "area", title: "Rama sin padre", parentObjectiveId: 123456 } as Objective;
    const empresa: Objective = { id: 9998, slug: "company-sin-frente", level: "company", title: "Empresa sin frente" } as Objective;
    const mapa = buildObjectivesMap([...asObjectives(), rama, empresa], HOY);
    expect(mapa.unplaced.map((o) => o.slug)).toEqual(["company-sin-frente"]);
  });
});


describe("entradas retiradas", () => {
  it("las quince declaradas existen en el plan", () => {
    for (const slug of Object.keys(RETIRED_OBJECTIVES)) {
      expect(SLUGS.has(slug), `slug inexistente: ${slug}`).toBe(true);
    }
    expect(Object.keys(RETIRED_OBJECTIVES)).toHaveLength(15);
  });

  it("una retirada no cuenta ni aparece en el mapa, pero no se pierde", () => {
    const base = asObjectives();
    const retirados = new Set(Object.keys(RETIRED_OBJECTIVES));
    const conRetiro = base.map((objective) =>
      retirados.has(String(objective.slug)) ? { ...objective, retiredAt: "2026-09-17T00:00:00Z" } : objective,
    );
    const mapa = buildObjectivesMap(conRetiro, HOY);
    expect(mapa.retired).toHaveLength(15);
    expect(mapa.counts.objetivo).toBe(15);
    // La bajada baja exactamente en las nueve retiradas que no eran acciones.
    expect(mapa.counts.bajada).toBe(31);
    const enMapa = new Set<string>();
    const walk = (nodes: typeof mapa.fronts[number]["objectives"]) => {
      for (const node of nodes) { enMapa.add(String(node.objective.slug)); walk(node.children); }
    };
    for (const front of mapa.fronts) walk(front.objectives);
    for (const slug of retirados) expect(enMapa.has(slug), `${slug} sigue en el mapa`).toBe(false);
  });

  it("cada acción que reemplaza a un objetivo retirado existe y apunta a un objetivo vivo", () => {
    const porSlug = new Map(OBJECTIVE_PLAN_2026.objectives.map((o) => [o.slug, o]));
    const reemplazos = OBJECTIVE_PLAN_2026.actions.filter((a) => a.sortOrder > 60);
    expect(reemplazos).toHaveLength(7);
    for (const action of reemplazos) {
      expect(action.objectiveSlug).toBeTruthy();
      const objetivo = porSlug.get(action.objectiveSlug!);
      expect(objetivo, `${action.slug} apunta a un objetivo inexistente`).toBeDefined();
      expect(RETIRED_OBJECTIVES[action.objectiveSlug!], `${action.slug} cuelga de un objetivo retirado`).toBeUndefined();
      expect(objetivo!.level).toBe("company");
      expect(action.dueDate).toMatch(/^2026-\d{2}-\d{2}$/);
    }
  });

  it("las tres conductas del CEO pasaron a ser estándares", () => {
    const porSlug = new Map(OBJECTIVE_PLAN_2026.objectives.map((o) => [o.slug, o]));
    for (const slug of ["person-tomas-annual-billing", "person-tomas-sales-focus", "person-tomas-no-build-focus"]) {
      expect(porSlug.get(slug)!.targetKind, slug).toBe("continuous");
      expect(porSlug.get(slug)!.targetDate, slug).toBeNull();
    }
  });
});
