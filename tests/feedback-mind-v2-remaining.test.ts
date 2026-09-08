import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_SERVICE_PROJECT_TYPES,
  SERVICE_BLUEPRINT_SEEDS,
  canonicalProjectTypeForModality,
  normalizeCanonicalProjectType,
} from "../shared/quotation-professional";
import { projectTypes } from "../shared/schema";
import { analyzeQuotationBriefHeuristically } from "../server/services/quotation-brief";
import { resolveCanonicalRoleForBlueprintKey } from "../shared/utils/personnel-classification";
import { validateQuotationStep } from "../client/src/utils/quotation-ux";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Feedback Mind V2 remaining product decisions", () => {
  it("uses one four-item service taxonomy everywhere new quotations are created", () => {
    expect(projectTypes).toEqual(CANONICAL_SERVICE_PROJECT_TYPES);
    expect(projectTypes.map((item) => item.label)).toEqual([
      "One Shot",
      "Fee",
      "Intelligence Event Track",
      "Demo",
    ]);
    expect(SERVICE_BLUEPRINT_SEEDS.map((seed) => seed.definition.modality)).toEqual([
      "demo",
      "one_shot",
      "event_pack",
      "monthly_fee",
    ]);
    expect(source("client/src/components/optimized/basic-info.tsx")).not.toContain('label="Modalidad de servicio"');
  });

  it("maps historical service labels to the canonical categories", () => {
    expect(canonicalProjectTypeForModality("annual_program")).toBe("fee-mensual");
    expect(canonicalProjectTypeForModality("renewal")).toBe("fee-mensual");
    expect(canonicalProjectTypeForModality("credit_pack")).toBe("fee-mensual");
    expect(normalizeCanonicalProjectType("always-on")).toBe("fee-mensual");
    expect(normalizeCanonicalProjectType("credit-pack")).toBe("fee-mensual");
    expect(source("server/services/service-blueprints.ts")).toContain('status: "archived"');
  });

  it("classifies regional, renewal and credit briefs as Fee", () => {
    const candidates = SERVICE_BLUEPRINT_SEEDS.map((seed, index) => ({
      id: index + 1,
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      definition: seed.definition,
    }));
    for (const brief of [
      "Necesitamos un programa regional recurrente durante doce meses para varias marcas.",
      "Queremos renovar el servicio y mantener entregas mensuales durante el próximo año.",
      "Buscamos una bolsa de créditos para pedidos recurrentes del equipo regional.",
    ]) {
      expect(analyzeQuotationBriefHeuristically(brief, candidates).modality).toBe("monthly_fee");
    }
  });

  it("chooses the service in step two instead of blocking the Brief with a duplicate selector", () => {
    const quotation = {
      client: { id: 1, name: "Cliente" },
      project: { name: "Proyecto", type: "", duration: "" },
      commercialMotion: "new_business",
    } as any;
    expect(validateQuotationStep(1, quotation)).toEqual([]);
    expect(validateQuotationStep(2, quotation)[0]?.field).toBe("professional-scope");
  });

  it("stores role profiles in each recipe and honors a recipe-specific override", () => {
    const roles = [
      { id: 1, roleLevel: "4 Lead", area: "Operaciones", isActive: true },
      { id: 2, roleLevel: "3 Senior", area: "Operaciones", isActive: true },
    ];
    expect(resolveCanonicalRoleForBlueprintKey("pm", roles)?.id).toBe(1);
    expect(resolveCanonicalRoleForBlueprintKey("pm", roles, { level: "3 Senior", area: "Operaciones" })?.id).toBe(2);
    expect(SERVICE_BLUEPRINT_SEEDS.every((seed) => Object.keys(seed.definition.roleProfiles).length > 0)).toBe(true);
    expect(source("client/src/components/quotation/professional-scope-builder.tsx")).toContain("Perfiles sugeridos:");
  });

  it("renders the monthly project distribution as an accessible donut", () => {
    const home = source("client/src/pages/tasks/tasks-home.tsx");
    expect(home).toContain('aria-label="Donut de distribución porcentual de las horas del mes por proyecto"');
    expect(home).toContain("<PieChart");
    expect(home).toContain('innerRadius="56%"');
    expect(home).not.toContain("<BarChart");
  });
});
