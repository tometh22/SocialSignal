import { describe, expect, it } from "vitest";
import { OBJECTIVE_PLAN_2026 } from "@shared/objectives-plan-2026";

describe("objective plan 2026 coverage", () => {
  it("contains the complete company/area/person plan and weekly actions", () => {
    const { objectives, accounts, actions } = OBJECTIVE_PLAN_2026;
    expect(objectives).toHaveLength(87);
    expect(accounts).toHaveLength(25);
    expect(actions).toHaveLength(60);

    expect(new Set(objectives.map((objective) => objective.slug)).size).toBe(objectives.length);
    expect(new Set(actions.map((action) => action.slug)).size).toBe(actions.length);
    expect(new Set(objectives.map((objective) => objective.level))).toEqual(new Set(["company", "area", "person"]));

    const objectiveSlugs = new Set(objectives.map((objective) => objective.slug));
    const accountSlugs = new Set(accounts.map((account) => account.slug));
    expect(actions.every((action) => !action.objectiveSlug || objectiveSlugs.has(action.objectiveSlug))).toBe(true);
    expect(actions.every((action) => !action.accountSlug || accountSlugs.has(action.accountSlug))).toBe(true);
    expect(actions.every((action) => /^\d{4}-\d{2}-\d{2}$/.test(action.weekStart))).toBe(true);
    expect(actions.reduce<Record<string, number>>((counts, action) => {
      counts[action.month] = (counts[action.month] ?? 0) + 1;
      return counts;
    }, {})).toEqual({ septiembre: 24, octubre: 17, noviembre: 11, diciembre: 8 });
  });

  it("preserves the dates and ownership corrections called out in the source", () => {
    const { objectives, actions } = OBJECTIVE_PLAN_2026;
    expect(objectives.find((objective) => objective.slug === "company-cash-runway")?.ownerName).toBe("Vicky");
    expect(actions.find((action) => action.slug === "sep-w1-tomas-ask-pau-warner-mexico")?.dueDate).toBe("2026-09-30");
    expect(actions.find((action) => action.slug === "oct-w5-santi-frontier-content")?.dueDate).toBe("2026-11-06");
    expect(actions.find((action) => action.slug === "dec-w3-vicky-kimberly-deadline")?.dueDate).toBe("2026-12-21");
  });
});
