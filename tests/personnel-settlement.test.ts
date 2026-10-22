import { describe, expect, it } from "vitest";
import { calculatePersonnelSettlement } from "../server/services/personnel-settlement";

describe("personnel monthly settlement", () => {
  it("completa el total contractual del ejemplo confirmado por Vicky", () => {
    const result = calculatePersonnelSettlement({ totalARS: 10000, usdPercentage: 90, invoiceFx: 1500, receivedFx: 1505, extrasARS: 5000 });
    expect(result.totalInvoiceUSD).toBe(6);
    expect(result.finalInvoiceARS).toBe(5970);
    expect(result.financialCostARS).toBe(15000);
  });
  it("suma bono ARS y extras sin pedir TC a quien factura sólo en pesos", () => {
    const result = calculatePersonnelSettlement({ totalARS: 10000, usdPercentage: 0, bonusARS: 500, extrasARS: 1000 });
    expect(result.finalInvoiceARS).toBe(11500);
    expect(result.financialCostARS).toBe(11500);
    expect(result.totalInvoiceUSD).toBe(0);
    expect(result.financialCostUSD).toBeNull();
  });
  it("redondea los USD emitidos antes de calcular el saldo ARS", () => {
    const result = calculatePersonnelSettlement({ totalARS: 10000, usdPercentage: 90, invoiceFx: 1499, receivedFx: 1505 });
    expect(result.baseInvoiceUSD).toBe(6);
    expect(result.finalInvoiceARS).toBe(970);
  });
  it("calcula el tramo USD y la diferencia ARS con dos tipos de cambio", () => {
    expect(calculatePersonnelSettlement({
      totalARS: 2_000_000,
      usdPercentage: 50,
      invoiceFx: 1_000,
      receivedFx: 1_100,
    })).toEqual({
      plannedUSDARS: 1_000_000,
      baseInvoiceUSD: 1_000,
      totalInvoiceUSD: 1_000,
      pesifiedBaseARS: 1_100_000,
      finalInvoiceARS: 900_000,
      financialCostARS: 2_000_000,
      financialCostUSD: 1818.18,
    });
  });

  it("mantiene bono y extras como adicionales y reintegra la comisión", () => {
    const result = calculatePersonnelSettlement({
      totalARS: 2_000_000,
      usdPercentage: 50,
      bonusUSD: 100,
      extrasARS: 50_000,
      invoiceFx: 1_000,
      receivedFx: 1_100,
      bankCommissionUSD: 10,
    });
    expect(result.totalInvoiceUSD).toBe(1_100);
    expect(result.finalInvoiceARS).toBe(961_000);
    expect(result.financialCostARS).toBe(2_171_000);
  });

  it("no inventa importes finales antes de que el colaborador cargue los TC", () => {
    expect(calculatePersonnelSettlement({ totalARS: 500_000, usdPercentage: 40 })).toMatchObject({
      plannedUSDARS: 200_000,
      baseInvoiceUSD: null,
      finalInvoiceARS: null,
    });
  });
});
