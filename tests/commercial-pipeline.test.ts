import { describe, it, expect } from "vitest";
import {
  opportunitySchema,
  validateOpportunity,
  summarize,
  metrics,
  alerts,
  localDay,
  executiveSummary,
} from "../shared/pipeline";
import { visibleRows } from "../server/pipeline/access";
const row = (patch = {}) =>
  opportunitySchema.parse({
    account: "Cuenta sintética",
    scope: "Pipeline",
    evidence: "Propuesta enviada",
    evidenceDate: "2026-11-01",
    sources: [
      { key: "e1", title: "Fuente", url: "https://example.org/propuesta" },
    ],
    ...patch,
  });
describe("Pipeline comercial: reglas canónicas", () => {
  it("conserva null y cobertura vacía", () =>
    expect(metrics([row()])).toMatchObject({
      open: 1,
      gross: null,
      weighted: null,
      valueCoverage: 0,
      weightedCoverage: 0,
    }));
  it("cero verificado es un término válido", () =>
    expect(
      metrics([
        row({
          usd: "0",
          valueNote: "Sin cargo",
          probability: "0",
          probabilityReason: "Decisión",
          probabilitySource: "e1",
        }),
      ]),
    ).toMatchObject({
      gross: "0.00",
      weighted: "0.00",
      valueCoverage: 1,
      weightedCoverage: 1,
    }));
  it("pondera una tasa respaldada sin asignarla por etapa", () => {
    expect(
      metrics([
        row({
          usd: "104400",
          valueNote: "Alcance anual",
          probability: "25",
          probabilityReason: "Decisión aprobada",
          probabilitySource: "e1",
        }),
      ]).weighted,
    ).toBe("26100.00");
    expect(
      metrics([
        row({ usd: "100", valueNote: "Propuesta", stage: "Negociación" }),
      ]).weighted,
    ).toBeNull();
  });
  it("rechaza probabilidad sin evidencia y conserva bruto", () => {
    const r = row({ usd: "10", valueNote: "Propuesta", probability: "25" });
    expect(metrics([r])).toMatchObject({ gross: "10.00", weighted: null });
    expect(() => validateOpportunity(r)).toThrow("probabilidad");
  });
  it("excluye confirmadas, descartadas, revisión y alternativas reemplazadas", () => {
    const result = metrics([
      row({
        scope: "Cerrada / confirmada",
        status: "Confirmada",
        usd: "100",
        valueNote: "Aceptada",
      }),
      row({ scope: "Descartada" }),
      row({ scope: "Validación CRM" }),
      row({ eligible: false, exclusionReason: "Alternativa no elegida" }),
    ]);
    expect(result.open).toBe(0);
    expect(result.gross).toBeNull();
  });
  it("no convierte moneda ni anualiza fees sin evidencia", () => {
    expect(
      metrics([
        row({ originalAmount: "2700", currency: "USD", priceBasis: "mensual" }),
      ]).gross,
    ).toBeNull();
    expect(
      metrics([
        row({
          usd: "6500",
          originalAmount: "6500",
          currency: "EUR",
          valueNote: "Sin equivalencia",
        }),
      ]).gross,
    ).toBeNull();
  });
  it("Warner sin importe no se vuelve cero", () => {
    const result = summarize([
      row({ usd: "100", valueNote: "Propuesta" }),
      row({ warner: true }),
    ]);
    expect(result.warner.valuePct).toBeNull();
    expect(result.warner.countPct).toBe(50);
    expect(result.warner.partial).toBe(true);
    expect(
      summarize([row({ usd: "100", valueNote: "Propuesta" })]).warner.valuePct,
    ).toBe(0);
  });
  it("redondea al final con precisión decimal", () =>
    expect(
      metrics([
        row({
          usd: "0.01",
          valueNote: "Precio",
          probability: "50",
          probabilityReason: "Aprobado",
          probabilitySource: "e1",
        }),
        row({
          usd: "0.01",
          valueNote: "Precio",
          probability: "50",
          probabilityReason: "Aprobado",
          probabilitySource: "e1",
        }),
      ]).weighted,
    ).toBe("0.01"));
  it("usa días calendario de Buenos Aires y no toma vencimiento como cierre", () => {
    expect(localDay(new Date("2026-11-12T00:22:51Z"))).toBe("2026-11-11");
    expect(
      alerts(
        row({ evidenceDate: "2026-10-12", nextDate: "2026-11-15" }),
        "2026-11-11",
      ),
    ).toContain("Evidencia desactualizada");
    expect(
      alerts(row({ evidenceDate: "2026-10-13" }), "2026-11-11"),
    ).not.toContain("Evidencia desactualizada");
    expect(alerts(row({ nextDate: "2026-11-15" }))).toContain(
      "Sin fecha objetivo",
    );
  });
  it("valida fechas, importes, URLs y ejes contradictorios", () => {
    for (const patch of [
      { closeDate: "2026-02-30" },
      { usd: "Infinity" },
      { probability: "101" },
      { stage: "Confirmada" },
      { sources: [{ key: "x", title: "x", url: "javascript:alert(1)" }] },
    ])
      expect(() => validateOpportunity(row(patch))).toThrow();
  });
  it("distingue omitido y null en PATCH", () => {
    expect(opportunitySchema.partial().parse({})).toEqual({});
    expect(opportunitySchema.partial().parse({ closeDate: null })).toEqual({
      closeDate: null,
    });
  });
  it("no entrega fuentes ni filas de cotizaciones a lectores sin permiso", () => {
    const rows = [row(), row({ quotationId: 7 })];
    expect(visibleRows(rows, { permissions: ["crm"] })).toHaveLength(1);
    expect(
      visibleRows(rows, { permissions: ["crm", "quotations"] }),
    ).toHaveLength(2);
  });
  it("resumen muestra pendientes y cobertura", () => {
    const text = executiveSummary([row()], "2026-11", "2026-11-12T00:22:51Z");
    expect(text).toContain("Bruto: Pendiente (0/1)");
    expect(text).toContain("Comparación anterior: Pendiente");
  });
});
