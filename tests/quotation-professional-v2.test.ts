import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SERVICE_BLUEPRINT_SEEDS,
  HISTORICAL_PROPOSAL_EVIDENCE,
  estimateBlueprintWorkload,
  runProposalQa,
} from "../shared/quotation-professional";
import {
  applyAgentPatch,
  buildDefaultProposalDocument,
  renderProposalPdf,
  renderProposalPptx,
} from "../server/services/proposal-studio";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("professional service catalog and workload", () => {
  it("ships the six versioned commercial modalities with stable sold-item IDs", () => {
    expect(SERVICE_BLUEPRINT_SEEDS.map((seed) => seed.definition.modality)).toEqual([
      "demo", "one_shot", "event_pack", "monthly_fee", "annual_program", "renewal",
    ]);
    for (const seed of SERVICE_BLUEPRINT_SEEDS) {
      expect(seed.version).toBe(1);
      expect(seed.definition.deliverables.length).toBeGreaterThan(0);
      expect(new Set(seed.definition.deliverables.map((item) => item.id)).size).toBe(seed.definition.deliverables.length);
      expect(estimateBlueprintWorkload(seed.definition).totalHours).toBeGreaterThan(0);
    }
    expect(HISTORICAL_PROPOSAL_EVIDENCE.find((item) => item.label === "Warner")?.use).toBe("classification-only-until-file");
    expect(HISTORICAL_PROPOSAL_EVIDENCE.filter((item) => item.outcome === "won")).toHaveLength(6);
  });

  it("derives hours from cycles, coverage, language, SLA and design", () => {
    const base = structuredClone(SERVICE_BLUEPRINT_SEEDS.find((seed) => seed.definition.modality === "monthly_fee")!.definition);
    const baseline = estimateBlueprintWorkload(base);
    base.coverage.languages = ["es", "en"];
    base.coverage.slaLevel = "real_time";
    base.coverage.designLevel = "executive";
    base.deliverables[0].quantity += 2;
    const expanded = estimateBlueprintWorkload(base);
    expect(expanded.totalHours).toBeGreaterThan(baseline.totalHours);
    expect(expanded.byRole.analyst).toBeGreaterThan(baseline.byRole.analyst);
    expect(expanded.lines.some((line) => line.sourceName === "Pulso táctico mensual")).toBe(true);
  });
});

describe("canonical proposal, QA and safe agent edits", () => {
  const definition = SERVICE_BLUEPRINT_SEEDS[2].definition;
  const document = buildDefaultProposalDocument({
    locale: "es",
    quotation: {
      projectName: "Intelligence Pack Mundial",
      quotationNumber: "COT-2026-000001",
      revisionNumber: 2,
      scopeSnapshot: definition,
      quotationCurrency: "USD",
      projectDuration: "2 meses",
      paymentTermsDays: 30,
      paymentSchedule: [{ label: "Anticipo", percentage: 50 }, { label: "Entrega", percentage: 50 }],
      commercialTerms: "Valores expresados en USD.",
    },
    client: { name: "Uber" },
    variants: [
      { id: 1, name: "Esencial", total: 18_000 },
      { id: 2, name: "Recomendada", total: 24_000, recommended: true },
      { id: 3, name: "Expandida", total: 31_000 },
    ],
    team: [{ roleName: "Project Manager" }, { roleName: "Analista" }],
  });

  it("keeps exact scenario totals in the document data", () => {
    const scenarios = document.blocks.find((block) => block.type === "scenarios")!;
    expect(scenarios.data.totals).toEqual([18_000, 24_000, 31_000]);
    expect(runProposalQa({ document, expectedClientName: "Uber", knownClientNames: ["Uber", "PeYa", "Kimberly-Clark"], expectedGrandTotals: [18_000, 24_000, 31_000], paymentSchedule: [{ percentage: 50 }, { percentage: 50 }] })).toEqual([]);
  });

  it("blocks the historical contamination, placeholder, closing and price errors", () => {
    const dirty = structuredClone(document);
    dirty.blocks.find((block) => block.type === "context")!.body = "Trabajo para PeYa — X (35%)";
    dirty.blocks.push({ ...dirty.blocks.find((block) => block.type === "team")!, id: crypto.randomUUID(), title: "Nota posterior" });
    dirty.blocks.find((block) => block.type === "scenarios")!.data.totals = [1, 2, 3];
    const codes = runProposalQa({ document: dirty, expectedClientName: "Uber", knownClientNames: ["Uber", "PeYa", "Kimberly-Clark"], expectedGrandTotals: [18_000, 24_000, 31_000], paymentSchedule: [{ percentage: 35 }] }).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["client-leak", "placeholder", "after-closing", "commercial-mismatch", "payment-schedule"]));
  });

  it("applies only typed editorial operations and preserves commercial data", () => {
    const context = document.blocks.find((block) => block.type === "context")!;
    const totalsBefore = structuredClone(document.blocks.find((block) => block.type === "scenarios")!.data.totals);
    const edited = applyAgentPatch(document, { summary: "Más directo", operations: [{ type: "rewrite_block", blockId: context.id, title: "El desafío", body: "Una decisión clara.", bullets: [] }] });
    expect(edited.blocks.find((block) => block.id === context.id)?.body).toBe("Una decisión clara.");
    expect(edited.blocks.find((block) => block.type === "scenarios")!.data.totals).toEqual(totalsBefore);
    const scenarios = document.blocks.find((block) => block.type === "scenarios")!;
    expect(() => applyAgentPatch(document, { summary: "Cambiar inversión", operations: [{ type: "rewrite_block", blockId: scenarios.id, title: scenarios.title, body: "Precio nuevo", bullets: ["USD 1"] }] })).toThrow("bloque comercial protegido");
  });

  it("exports a real PDF and editable widescreen PPTX from the same content", async () => {
    const [pdf, pptx] = await Promise.all([
      renderProposalPdf(document, { title: "Intelligence Pack", quotationNumber: "COT-2026-000001" }),
      renderProposalPptx(document, { title: "Intelligence Pack", quotationNumber: "COT-2026-000001" }),
    ]);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pptx.subarray(0, 2).toString()).toBe("PK");
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pptx.length).toBeGreaterThan(20_000);
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length).toBe(document.blocks.length);
  }, 20_000);
});

describe("end-to-end implementation contracts", () => {
  it("includes idempotent migrations, stale reconciliation and transactional handoff", () => {
    const migration = source("migrations/0046_professional_quotation_studio.sql");
    const routes = source("server/routes.ts");
    const studioRoutes = source("server/routes-proposal-studio.ts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS service_blueprints");
    expect(migration).toContain("UPDATE quotation_variants SET is_legacy = true");
    expect(studioRoutes).toContain("/reconcile");
    expect(source("server/services/proposal-studio.ts")).toContain("store: false");
    expect(routes).toContain("La cotización ya fue materializada en un proyecto");
    expect(routes).toContain("sourceScopeItemId");
    expect(routes).toContain("tx.insert(projectCycles)");
    expect(routes).toContain("commercialMotion} <> 'demo'");
  });
});
