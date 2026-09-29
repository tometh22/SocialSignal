import { describe, expect, it } from "vitest";
import { formatAmount, kindOf, measureOf } from "../client/src/components/objectives/objective-kind";
import { normalizeObjective } from "../client/src/lib/objectives-api";
import type { Objective } from "../client/src/lib/objectives-api";

const obj = (partial: Partial<Objective>): Objective => ({ id: 1, level: "company", title: "x", status: "planned", ...partial }) as Objective;

describe("objetivo, hito y hábito se distinguen", () => {
  it("el tipo sale de cómo se mide la meta", () => {
    expect(kindOf(obj({ targetKind: "metric" }))).toBe("objetivo");
    expect(kindOf(obj({ targetKind: "milestone" }))).toBe("hito");
    expect(kindOf(obj({ targetKind: "continuous" }))).toBe("habito");
  });

  it("un objetivo dice cuánto va en su propia unidad", () => {
    const suscripciones = normalizeObjective(obj({ targetKind: "metric", targetValue: "3.00" as unknown as number, targetUnit: "suscripciones", currentValue: "1" }));
    expect(measureOf(suscripciones).text).toBe("1 de 3 suscripciones");
    const facturacion = normalizeObjective(obj({ targetKind: "metric", targetValue: "655000.00" as unknown as number, targetUnit: "USD" }));
    expect(measureOf(facturacion).text).toBe("Sin medir · meta USD 655.000");
  });

  it("un hito no tiene porcentaje: está pendiente, se logró o no", () => {
    expect(measureOf(obj({ targetKind: "milestone" })).text).toBe("Pendiente");
    expect(measureOf(obj({ targetKind: "milestone", status: "done" })).text).toBe("Logrado");
    expect(measureOf(obj({ targetKind: "milestone", status: "missed" })).text).toBe("No se logró");
  });

  it("un hábito se cumple o no, y gris si nadie lo midió", () => {
    expect(measureOf(obj({ targetKind: "continuous" })).text).toBe("Sin medir");
    expect(measureOf(obj({ targetKind: "continuous", progressPercent: 100 })).text).toBe("Se cumple");
    expect(measureOf(obj({ targetKind: "continuous", progressPercent: 0 })).text).toBe("No se cumple");
  });

  it("escribe los montos en castellano", () => {
    expect(formatAmount(10000, "USD")).toBe("USD 10.000");
    expect(formatAmount(2, "propuestas")).toBe("2 propuestas");
  });
});
