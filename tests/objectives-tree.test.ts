import { describe, expect, it } from "vitest";
import {
  buildObjectiveTree,
  deadlineOf,
  flattenTree,
  formatDeadline,
  priorityRank,
} from "../client/src/lib/objectives-tree";
import type { Objective } from "../client/src/lib/objectives-api";

const HOY = "2026-09-16";

function obj(partial: Partial<Objective> & { id: string | number }): Objective {
  return { level: "company", title: `Objetivo ${partial.id}`, ...partial } as Objective;
}

describe("árbol de objetivos", () => {
  it("cuelga cada objetivo de su padre", () => {
    const tree = buildObjectiveTree([
      obj({ id: 1 }),
      obj({ id: 2, parentObjectiveId: 1 }),
      obj({ id: 3, parentObjectiveId: 2 }),
    ], HOY);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].objective.id).toBe(3);
    expect(tree[0].descendants).toBe(2);
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("no pierde un objetivo cuyo padre quedó fuera del filtro", () => {
    const tree = buildObjectiveTree([obj({ id: 9, parentObjectiveId: 404 })], HOY);
    expect(tree).toHaveLength(1);
    expect(tree[0].objective.id).toBe(9);
  });

  it("corta un ciclo en vez de colgarse", () => {
    const tree = buildObjectiveTree([
      obj({ id: 1, parentObjectiveId: 2 }),
      obj({ id: 2, parentObjectiveId: 1 }),
    ], HOY);
    expect(tree.length).toBeGreaterThan(0);
    expect(flattenTree(tree, new Set(["1", "2"])).length).toBeLessThanOrEqual(3);
  });

  it("ignora un objetivo que se declara padre de sí mismo", () => {
    const tree = buildObjectiveTree([obj({ id: 7, parentObjectiveId: 7 })], HOY);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(0);
  });
});

describe("orden de atención", () => {
  it("pone primero lo vencido y último lo continuo y lo logrado", () => {
    const vencido = obj({ id: "v", targetDate: "2026-09-01", targetKind: "milestone" });
    const pronto = obj({ id: "p", targetDate: "2026-09-20", targetKind: "milestone" });
    const lejano = obj({ id: "l", targetDate: "2026-12-31", targetKind: "milestone" });
    const sinFecha = obj({ id: "s", targetKind: "milestone" });
    const continuo = obj({ id: "c", targetKind: "continuous" });
    const logrado = obj({ id: "d", targetDate: "2026-09-01", status: "done" });
    expect(priorityRank(vencido, HOY)).toBe(0);
    expect(priorityRank(pronto, HOY)).toBe(1);
    expect(priorityRank(lejano, HOY)).toBe(2);
    expect(priorityRank(sinFecha, HOY)).toBe(3);
    expect(priorityRank(continuo, HOY)).toBe(4);
    expect(priorityRank(logrado, HOY)).toBe(5);

    const orden = buildObjectiveTree([logrado, continuo, sinFecha, lejano, pronto, vencido], HOY)
      .map((node) => node.objective.id);
    expect(orden).toEqual(["v", "p", "l", "s", "c", "d"]);
  });

  it("un objetivo logrado no se adelanta aunque esté vencido", () => {
    expect(priorityRank(obj({ id: 1, targetDate: "2026-01-01", status: "completada" }), HOY)).toBe(5);
  });
});

describe("vencimientos", () => {
  it("calcula los días que faltan", () => {
    expect(deadlineOf(obj({ id: 1, targetDate: "2026-09-20" }), HOY)).toMatchObject({ daysLeft: 4, overdue: false, soon: true });
    expect(deadlineOf(obj({ id: 2, targetDate: "2026-09-10" }), HOY)).toMatchObject({ daysLeft: -6, overdue: true });
    expect(deadlineOf(obj({ id: 3, targetDate: "2026-12-31" }), HOY)?.soon).toBe(false);
    expect(deadlineOf(obj({ id: 4 }), HOY)).toBeNull();
  });

  it("lo escribe en castellano", () => {
    expect(formatDeadline({ date: "x", daysLeft: 0, overdue: false, soon: true })).toBe("Vence hoy");
    expect(formatDeadline({ date: "x", daysLeft: 1, overdue: false, soon: true })).toBe("Vence mañana");
    expect(formatDeadline({ date: "x", daysLeft: 9, overdue: false, soon: true })).toBe("Vence en 9 días");
    expect(formatDeadline({ date: "x", daysLeft: -1, overdue: true, soon: false })).toBe("Venció ayer");
    expect(formatDeadline({ date: "x", daysLeft: -6, overdue: true, soon: false })).toBe("Venció hace 6 días");
  });
});

describe("flattenTree", () => {
  it("sólo baja por las ramas abiertas", () => {
    const tree = buildObjectiveTree([
      obj({ id: 1 }),
      obj({ id: 2, parentObjectiveId: 1 }),
      obj({ id: 3, parentObjectiveId: 2 }),
    ], HOY);
    expect(flattenTree(tree, new Set()).map((n) => n.objective.id)).toEqual([1]);
    expect(flattenTree(tree, new Set(["1"])).map((n) => n.objective.id)).toEqual([1, 2]);
    expect(flattenTree(tree, new Set(["1", "2"])).map((n) => n.objective.id)).toEqual([1, 2, 3]);
  });
});
