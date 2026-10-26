import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectEffortBenchmark } from "../shared/quotation-professional";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const benchmark = (overrides: Record<string, unknown> = {}) => ({
  serviceBlueprintId: null,
  serviceBlueprintSlug: null,
  projectType: "fee-mensual",
  durationMonths: 3,
  sampleSize: 2,
  averageActualHours: 120,
  medianActualHours: 110,
  ...overrides,
});

describe("quotation effort benchmark selection", () => {
  it("prefers the exact recipe version, then the recipe family, then same type and duration", () => {
    const exact = benchmark({ serviceBlueprintId: 12, serviceBlueprintSlug: "fee-inteligencia", sampleSize: 2 });
    const family = benchmark({ serviceBlueprintSlug: "fee-inteligencia", sampleSize: 8 });
    const generic = benchmark({ sampleSize: 20 });
    const otherDuration = benchmark({ serviceBlueprintSlug: "fee-inteligencia", durationMonths: 12, sampleSize: 100 });
    const input = { serviceBlueprintId: 12, serviceBlueprintSlug: "fee-inteligencia", projectType: "always-on", durationMonths: 3 };

    expect(selectEffortBenchmark([generic, family, exact, otherDuration], input)).toEqual(exact);
    expect(selectEffortBenchmark([generic, family, otherDuration], input)).toEqual(family);
    expect(selectEffortBenchmark([generic, otherDuration], input)).toEqual(generic);
    expect(selectEffortBenchmark([otherDuration], input)).toBeNull();
  });

  it("does not treat unrelated legacy/task mirrors as separate actual work", () => {
    const query = source("server/queries/quotation-effort-benchmarks.ts");
    expect(query).toContain("source_occurrence > legacy_count");
    expect(query).toContain("LOWER(BTRIM(COALESCE(description, '')))");
    expect(query).toContain("ROUND(hours::numeric, 4)");
    expect(query).toContain("project.status NOT IN ('cancelled', 'voided')");
    expect(query).toContain("duration_months");
    expect(query).toContain("WHEN quote.project_type IN ('fee-mensual', 'always-on', 'credit-pack') THEN 'fee-mensual'");
  });

  it("preserves user-created recipe versions during seed initialization", () => {
    const seeds = source("server/services/service-blueprints.ts");
    expect(seeds).toContain("lt(serviceBlueprints.version, seed.version)");
    expect(seeds).not.toContain("ne(serviceBlueprints.version, seed.version)");
  });

  it("lets Operations load the catalog and historical data used by its admin page", () => {
    const routes = source("server/routes-proposal-studio.ts");
    expect(routes).toContain('app.get("/api/service-blueprints", requireAuth, requirePermission("quotations", "operations")');
    expect(routes).toContain('app.get("/api/quotation-effort-benchmarks", requireAuth, requirePermission("quotations", "operations")');
  });

  it("does not allow an unsaved calibration draft to be published", () => {
    const admin = source("client/src/pages/service-blueprints-admin.tsx");
    expect(admin).toContain("editingId === item.id && isDraftDirty");
    expect(admin).toContain("Guardá el borrador antes de publicarlo.");
  });
});
