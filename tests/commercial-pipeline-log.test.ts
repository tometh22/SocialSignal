import { describe, it, expect } from "vitest";
import {
  describeChanges,
  formatValue,
} from "../client/src/components/pipeline/change-list";
import { parseSummary } from "../client/src/components/pipeline/summary-preview";

describe("Registro del pipeline: lectura de cambios", () => {
  it("una conciliación sin estado previo muestra solo los datos iniciales con valor", () => {
    // Forma real de las entradas "conciliación inicial": { after, inputHash }.
    const set = describeChanges({
      inputHash: "0c85",
      after: {
        account: "Cuenta sintética",
        usd: "104400.00",
        next: null,
        leadId: null,
        clientId: 66,
        ownerId: 5,
        owner: "Responsable sintético",
        crmUpdatedAtReference: null,
        sources: [{ key: "a" }, { key: "b" }],
        stage: "Propuesta",
      },
    });
    expect(set.mode).toBe("create");
    expect(set.items.map((i) => i.key)).toEqual([
      "account",
      "stage",
      "usd",
      "owner",
      "sources",
    ]);
    expect(set.items.every((i) => i.before === undefined)).toBe(true);
  });
  it("una edición lista solo campos visibles que cambiaron, con antes y después", () => {
    const set = describeChanges({
      before: { stage: "Reunión / demo", usd: null, version: 1, leadId: 3 },
      after: { stage: "Propuesta", usd: "4900", version: 2, leadId: 4 },
    });
    expect(set.mode).toBe("edit");
    expect(set.items).toEqual([
      { key: "stage", before: "Reunión / demo", after: "Propuesta" },
      { key: "usd", before: null, after: "4900" },
    ]);
  });
  it("oculta registros solo técnicos y formatea valores legibles", () => {
    expect(describeChanges({ inputHash: "abc" }).items).toEqual([]);
    expect(describeChanges({}).items).toEqual([]);
    expect(formatValue("usd", "104400.00")).toBe("USD 104.400");
    expect(formatValue("threshold", 50)).toBe("50%");
    expect(formatValue("steps", [true, false])).toBe("1/2 pasos");
    expect(formatValue("warner", false)).toBe("No");
    expect(formatValue("next", null)).toBe("vacío");
  });
});

describe("Resumen para Fede: vista previa", () => {
  it("separa título, filas y lista de hitos sin alterar el texto", () => {
    const blocks = parseSummary(
      [
        "Pipeline comercial · 2026-11 · corte 12/11/2026",
        "Abiertas: 12. Bruto: USD 109.300,00 (2/12).",
        "Propuesta: 7 · USD 109.300,00 (2/7)",
        "Próximos hitos:",
        "Cuenta A: Revisar alcance · 2026-11-20",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      "title",
      "pair",
      "pair",
      "list",
    ]);
    expect(blocks[3]).toMatchObject({
      heading: "Próximos hitos",
      items: ["Cuenta A: Revisar alcance · 2026-11-20"],
    });
  });
});
