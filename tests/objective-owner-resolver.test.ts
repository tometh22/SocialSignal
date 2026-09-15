import { describe, expect, it } from "vitest";
import { buildNameIndex, resolveOwner } from "../server/services/objective-owner-resolver";
import { OBJECTIVE_PLAN_2026 } from "@shared/objectives-plan-2026";

// The canonical personnel names as they exist in production. "Tomas Facio" is
// the reason this resolver needs aliases at all: a first-name fallback used to
// hand Tomás Criado's objectives to him.
const PERSONNEL = [
  { id: 28, name: "Tomi Criado" },
  { id: 29, name: "Vicky Puricelli" },
  { id: 30, name: "Victoria Achabal" },
  { id: 41, name: "Tomas Facio" },
  { id: 47, name: "Santiago Berisso" },
  { id: 55, name: "Paula Setrini" },
  { id: 56, name: "Sil Vera" },
];

function resolve(shortName: string) {
  const unresolved = new Set<string>();
  const id = resolveOwner(shortName, PERSONNEL, buildNameIndex(PERSONNEL), unresolved);
  return { id, unresolved };
}

describe("objective owner resolution", () => {
  it("resolves the partners to their canonical personnel records", () => {
    expect(resolve("Tomás").id).toBe(28);
    expect(resolve("Vicky").id).toBe(29);
    expect(resolve("Acha").id).toBe(30);
  });

  it("never resolves Tomás to the unrelated Tomas Facio", () => {
    const facio = PERSONNEL.find((person) => person.name === "Tomas Facio")!.id;
    expect(resolve("Tomás").id).not.toBe(facio);
    expect(resolve("Tomas").id).not.toBe(facio);
  });

  it("resolves supporting owners used by weekly actions", () => {
    expect(resolve("Sil").id).toBe(56);
    expect(resolve("Pau").id).toBe(55);
    expect(resolve("Santi").id).toBe(47);
  });

  it("leaves the PMs pool unassigned instead of guessing a person", () => {
    const { id, unresolved } = resolve("PMs");
    expect(id).toBeNull();
    expect(unresolved.size).toBe(0);
  });

  it("reports an unknown owner instead of picking an ambiguous match", () => {
    const ambiguous = [
      { id: 1, name: "Juan Perez" },
      { id: 2, name: "Juan Gomez" },
    ];
    const unresolved = new Set<string>();
    expect(resolveOwner("Juan", ambiguous, buildNameIndex(ambiguous), unresolved)).toBeNull();
    expect([...unresolved]).toEqual(["Juan"]);
  });

  it("assigns every 2026 objective to a partner or to Acha", () => {
    const unresolved = new Set<string>();
    const index = buildNameIndex(PERSONNEL);
    const owners = OBJECTIVE_PLAN_2026.objectives.map((objective) =>
      resolveOwner(objective.ownerName, PERSONNEL, index, unresolved),
    );
    expect(unresolved.size).toBe(0);
    expect(owners.every((id) => id != null)).toBe(true);
    expect(new Set(owners)).toEqual(new Set([28, 29, 30]));
  });
});
