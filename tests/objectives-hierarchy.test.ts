import { describe, expect, it } from "vitest";
import { OBJECTIVE_PLAN_2026, PLAN_YEAR } from "@shared/objectives-plan-2026";
import {
  OBJECTIVE_PARENTS,
  parseTargetDate,
  parseTargetValue,
  targetKindFor,
} from "@shared/objectives-hierarchy";

const SLUGS = new Set(OBJECTIVE_PLAN_2026.objectives.map((o) => o.slug));

describe("jerarquía del plan 2026", () => {
  it("todo padre declarado existe, y ningún slug del mapa es inventado", () => {
    for (const [slug, parent] of Object.entries(OBJECTIVE_PARENTS)) {
      expect(SLUGS.has(slug), `slug inexistente: ${slug}`).toBe(true);
      expect(SLUGS.has(parent), `padre inexistente: ${parent} (de ${slug})`).toBe(true);
    }
  });

  it("las raíces son exactamente los 23 objetivos de empresa", () => {
    const roots = OBJECTIVE_PLAN_2026.objectives.filter((o) => o.parentSlug === null);
    expect(roots).toHaveLength(23);
    expect(roots.every((o) => o.level === "company")).toBe(true);
  });

  it("ningún objetivo de área o persona queda suelto", () => {
    const huerfanos = OBJECTIVE_PLAN_2026.objectives.filter((o) => o.level !== "company" && !o.parentSlug);
    expect(huerfanos.map((o) => o.slug)).toEqual([]);
  });

  it("no hay ciclos y el árbol no pasa de tres niveles", () => {
    const parentOf = new Map(OBJECTIVE_PLAN_2026.objectives.map((o) => [o.slug, o.parentSlug]));
    for (const objective of OBJECTIVE_PLAN_2026.objectives) {
      const visto = new Set<string>([objective.slug]);
      let actual = parentOf.get(objective.slug) ?? null;
      let profundidad = 0;
      while (actual) {
        expect(visto.has(actual), `ciclo en ${objective.slug}`).toBe(false);
        visto.add(actual);
        actual = parentOf.get(actual) ?? null;
        profundidad += 1;
        expect(profundidad).toBeLessThanOrEqual(2);
      }
    }
  });

  it("un objetivo de persona nunca cuelga de otro de persona", () => {
    const levelOf = new Map(OBJECTIVE_PLAN_2026.objectives.map((o) => [o.slug, o.level]));
    for (const objective of OBJECTIVE_PLAN_2026.objectives) {
      if (!objective.parentSlug) continue;
      expect(levelOf.get(objective.parentSlug)).not.toBe("person");
    }
  });
});

describe("lectura de la meta", () => {
  it("saca la fecha de corte del texto", () => {
    expect(parseTargetDate("Renovación firmada al 21 de diciembre", 2026)).toBe("2026-12-21");
    expect(parseTargetDate("Producto y precio aprobados al 30 de septiembre", 2026)).toBe("2026-09-30");
    expect(parseTargetDate("2 propuestas durante el cuatrimestre", 2026)).toBe("2026-12-31");
    expect(parseTargetDate("Al menos 3 casos al cierre del año", 2026)).toBe("2026-12-31");
  });

  it("no confunde el arranque con el vencimiento", () => {
    // "desde el 15 de septiembre" es cuándo empieza, no cuándo vence.
    expect(parseTargetDate("6 ediciones durante el cuatrimestre, desde el 15 de septiembre", 2026)).toBe("2026-12-31");
    expect(parseTargetDate("60 cuentas y 120 contactos al 15 de septiembre", 2026)).toBe("2026-09-15");
  });

  it("un objetivo continuo no vence", () => {
    expect(parseTargetDate("100% de las alertas reportadas en <48h", 2026, "company-client-alerts")).toBeNull();
    expect(targetKindFor("company-client-alerts", "100% de las alertas")).toBe("continuous");
  });

  it("extrae el número y la unidad, sin tomar preposiciones como unidad", () => {
    expect(parseTargetValue("USD 655K; piso aceptable USD 610K")).toEqual({ value: 655_000, unit: "USD" });
    expect(parseTargetValue("60 cuentas objetivo LATAM")).toEqual({ value: 60, unit: "cuentas" });
    expect(parseTargetValue("Al menos 8 en el cuatrimestre")).toEqual({ value: 8, unit: null });
    expect(parseTargetValue("4 de 5 cuentas clave")).toEqual({ value: 4, unit: null });
  });

  it("clasifica los 87 objetivos sin dejar ninguno afuera", () => {
    const tipos = { metric: 0, milestone: 0, continuous: 0 };
    for (const objective of OBJECTIVE_PLAN_2026.objectives) tipos[objective.targetKind] += 1;
    expect(tipos.metric + tipos.milestone + tipos.continuous).toBe(OBJECTIVE_PLAN_2026.objectives.length);
    expect(tipos.continuous).toBeGreaterThan(0);
    expect(tipos.metric).toBeGreaterThan(0);
  });

  it("un objetivo con fecha nunca es continuo, y uno continuo nunca tiene fecha", () => {
    for (const objective of OBJECTIVE_PLAN_2026.objectives) {
      if (objective.targetKind === "continuous") {
        expect(objective.targetDate, objective.slug).toBeNull();
        expect(objective.targetValue, objective.slug).toBeNull();
      }
    }
  });

  it("la mayoría de los objetivos queda con fecha de corte", () => {
    const conFecha = OBJECTIVE_PLAN_2026.objectives.filter((o) => o.targetDate).length;
    expect(conFecha).toBeGreaterThanOrEqual(50);
    expect(PLAN_YEAR).toBe(2026);
  });
});
