import { describe, expect, it } from "vitest";
import { descendantIds } from "../server/services/objective-branch";

describe("eliminar un objetivo", () => {
  const rows = [
    { id: 1, parentObjectiveId: null },
    { id: 2, parentObjectiveId: 1 },
    { id: 3, parentObjectiveId: 2 },
    { id: 4, parentObjectiveId: 1 },
    { id: 5, parentObjectiveId: null },
  ];

  it("se lleva todo lo que cuelga, a cualquier profundidad", () => {
    expect(descendantIds(1, rows).sort()).toEqual([1, 2, 3, 4]);
  });

  it("no toca ramas vecinas", () => {
    expect(descendantIds(2, rows).sort()).toEqual([2, 3]);
    expect(descendantIds(5, rows)).toEqual([5]);
  });

  it("no se cuelga con un ciclo en los datos", () => {
    expect(descendantIds(7, [{ id: 7, parentObjectiveId: 8 }, { id: 8, parentObjectiveId: 7 }]).sort()).toEqual([7, 8]);
  });
});
