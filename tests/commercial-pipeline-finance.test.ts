import { describe, it, expect } from "vitest";
import {
  summarizeBilling,
  type BillingEvent,
} from "../server/pipeline/finance";
const mapping = [
  { clientId: 7, name: "Cuenta verificada", basis: "Conciliación de cuenta" },
];
const event = (patch: Partial<BillingEvent> = {}): BillingEvent => ({
  id: 1,
  clientName: "Cuenta verificada",
  clientId: 7,
  amountUsd: "100.00",
  invoicePeriod: "2026-11",
  confirmed: true,
  isEstimate: false,
  status: "confirmed",
  sourceTab: "Facturación",
  sourceRowId: "row:1",
  periodClosed: false,
  ...patch,
});
describe("Facturación separada del pipeline", () => {
  it("mantiene pendiente cuando no hay hechos reales", () => {
    const result = summarizeBilling([], mapping, "2026-11");
    expect(result.state).toBe("pending");
    expect(result.totalUsd).toBeNull();
    expect(result.warnerSharePct).toBeNull();
  });
  it("excluye proyecciones aunque estén confirmadas y eventos cancelados", () => {
    const result = summarizeBilling(
      [
        event({ isEstimate: true }),
        event({ status: "cancelled" }),
        event({ confirmed: false }),
      ],
      mapping,
      "2026-11",
    );
    expect(result.totalUsd).toBeNull();
    expect(result.excludedEstimateCount).toBe(2);
  });
  it("usa período y base facturación canónica con trazabilidad", () => {
    const result = summarizeBilling(
      [
        event(),
        event({ id: 2, clientId: 8, clientName: "Otra", amountUsd: "25.00" }),
        event({ invoicePeriod: "2026-10", amountUsd: "999.00" }),
      ],
      mapping,
      "2026-11",
    );
    expect(result.state).toBe("verified");
    expect(result.totalUsd).toBe("125.00");
    expect(result.warnerUsd).toBe("100.00");
    expect(result.warnerSharePct).toBe(80);
    expect(result.events.map((e) => e.id)).toEqual([1, 2]);
  });
  it("nunca clasifica por coincidencias parciales ni contradice ID estable", () => {
    const result = summarizeBilling(
      [
        event({ clientId: null, clientName: "Cuenta verificada subsidiaria" }),
        event({ clientId: 999 }),
      ],
      mapping,
      "2026-11",
    );
    expect(result.warnerSharePct).toBe(0);
  });
  it("requiere origen y mapeo antes de publicar participación", () => {
    expect(
      summarizeBilling([event({ sourceRowId: null })], mapping, "2026-11")
        .warnerSharePct,
    ).toBeNull();
    expect(
      summarizeBilling([event()], [], "2026-11").warnerSharePct,
    ).toBeNull();
  });
  it("incluye notas de crédito con signo y conserva cero verificado", () => {
    const result = summarizeBilling(
      [event({ amountUsd: "100.10" }), event({ id: 2, amountUsd: "-0.10" })],
      mapping,
      "2026-11",
    );
    expect(result.totalUsd).toBe("100.00");
    expect(
      summarizeBilling([event({ amountUsd: "0" })], mapping, "2026-11")
        .totalUsd,
    ).toBe("0.00");
  });
});
