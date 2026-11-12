import { describe, expect, it } from "vitest";
import {
  describeWarnerExposure,
  warnerFinancialSummaryText,
} from "../shared/pipeline-exposure";
import type { PipelineBilling } from "../shared/pipeline-finance";
const input = {
  open: 12,
  valueCoverage: 2,
  gross: "109300.00",
  warner: { open: 1, valueCoverage: 0, gross: null, valuePct: null },
};
describe("Lectura inequívoca de exposición Warner", () => {
  it("prioriza referencia histórica sin confundir 1/12 con dependencia financiera", () => {
    const result = describeWarnerExposure(input, { canSeeFinance: true });
    expect(result.headline.basis).toBe("historical-billing");
    expect(result.headline.value).toBe("≈80%");
    expect(result.headline.state).toBe("reference");
    expect(result.headline.caption).toContain("28/10/2026");
    expect(result.count.value).toBe("1 de 12");
    expect(result.count.state).toBe("neutral");
  });
  it("mantiene participación en valor pendiente aunque exista bruto de otros clientes", () => {
    const result = describeWarnerExposure(input, { canSeeFinance: true });
    expect(result.value.value).toBe("Pendiente");
    expect(result.monthly?.value).toBe("Pendiente");
    expect(result.value.caption).toContain("Warner: Pendiente");
  });
  it("no muestra información financiera a usuarios sin acceso", () => {
    const result = describeWarnerExposure(input, { canSeeFinance: false });
    expect(result.historical).toBeNull();
    expect(result.monthly).toBeNull();
    expect(result.headline.basis).toBe("pipeline-value");
    expect(JSON.stringify(result)).not.toContain("80%");
  });
  it("permite destacar facturación verificada con período sin sustituir un corte guardado", () => {
    const billing = {
      period: "2026-11",
      state: "verified",
      warnerSharePct: 60,
      warnerUsd: "60",
      totalUsd: "100",
      eventCount: 2,
      reason: null,
    } as PipelineBilling;
    expect(
      describeWarnerExposure(input, { canSeeFinance: true, billing }).headline,
    ).toMatchObject({
      basis: "monthly-billing",
      value: "60%",
      state: "verified",
    });
    const snapshot = describeWarnerExposure(input, {
      canSeeFinance: true,
      billing,
      snapshot: true,
    });
    expect(snapshot.headline.basis).toBe("historical-billing");
    expect(snapshot.monthly?.caption).toContain("no forma parte del corte");
  });
  it("no presenta cero oportunidades como exposición financiera nula", () => {
    const result = describeWarnerExposure(
      { ...input, open: 0, warner: { ...input.warner, open: 0 } },
      { canSeeFinance: true },
    );
    expect(result.count.value).toBe("Pendiente");
    expect(result.headline.value).toBe("≈80%");
  });
});

describe("Referencia financiera en resumen ejecutivo", () => {
  it("omite la referencia sin autorización financiera", () =>
    expect(warnerFinancialSummaryText({ canSeeFinance: false })).toBeNull());
  it("un corte nunca se completa con la facturación consultada después", () => {
    const billing = {
      period: "2026-11",
      state: "verified",
      warnerSharePct: 60,
      warnerUsd: "60",
      totalUsd: "100",
      eventCount: 2,
      reason: null,
    } as PipelineBilling;
    const text = warnerFinancialSummaryText({
      canSeeFinance: true,
      billing,
      snapshot: true,
    });
    expect(text).toContain("≈80%");
    expect(text).toContain("28/10/2026");
    expect(text).toContain("al corte: Pendiente");
    expect(text).not.toContain("60%");
  });
});
