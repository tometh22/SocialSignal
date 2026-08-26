import { describe, expect, it } from "vitest";
import { calculateQuotationPricing } from "../shared/utils/quotation-pricing";

// Cotejo de la lógica del pipeline de pricing: cada palanca (margen, complejidad,
// descuento, desviación, precio manual, moneda) debe mover el total de la forma
// esperada. Valores calculados a mano. Es la misma función que usan cliente y
// servidor, así que fija el contrato compartido.
describe("calculateQuotationPricing — respuesta a cada palanca", () => {
  // team ARS de costo 10.000 (100 h × 100)
  const teamARS = [{ hours: 100, rate: 100, currency: "ARS" as const }];

  it("base: total = costo × marginFactor", () => {
    const r = calculateQuotationPricing({ quotationCurrency: "ARS", exchangeRate: 1, team: teamARS, marginFactor: 2 });
    expect(r.canonicalARS.baseCost).toBe(10_000);
    expect(r.canonicalARS.total).toBe(20_000);
  });

  it("complejidad infla el subtotal antes del markup", () => {
    // (10.000 × 1,2) × 2 = 24.000
    const r = calculateQuotationPricing({ quotationCurrency: "ARS", exchangeRate: 1, team: teamARS, marginFactor: 2, complexityFactor: 0.2 });
    expect(r.canonicalARS.complexityAdjustment).toBe(2_000);
    expect(r.canonicalARS.total).toBe(24_000);
  });

  it("descuento reduce el total por el porcentaje", () => {
    // 20.000 × (1 - 0,10) = 18.000
    const r = calculateQuotationPricing({ quotationCurrency: "ARS", exchangeRate: 1, team: teamARS, marginFactor: 2, discountPercentage: 10 });
    expect(r.canonicalARS.total).toBe(18_000);
  });

  it("desviación aumenta el total por el porcentaje", () => {
    // 20.000 × (1 + 0,10) = 22.000
    const r = calculateQuotationPricing({ quotationCurrency: "ARS", exchangeRate: 1, team: teamARS, marginFactor: 2, deviationPercentage: 10 });
    expect(r.canonicalARS.total).toBe(22_000);
  });

  it("precio manual es el total final exacto (back-solve del markup)", () => {
    const r = calculateQuotationPricing({
      quotationCurrency: "ARS", exchangeRate: 1, team: teamARS, marginFactor: 2,
      priceMode: "manual", manualPrice: 50_000, manualPriceCurrency: "ARS",
      toolsCostUSD: 1, deviationPercentage: 10, discountPercentage: 5,
    });
    expect(r.canonicalARS.total).toBe(50_000);
  });

  it("cotización en USD: canonicalARS en pesos, display dividido por el TC", () => {
    // costo 20 USD × TC 1000 = 20.000 ARS; × margen 2 = 40.000 ARS; display USD = 40
    const r = calculateQuotationPricing({
      quotationCurrency: "USD", exchangeRate: 1000,
      team: [{ hours: 10, rate: 2, currency: "USD" }], marginFactor: 2,
    });
    expect(r.canonicalARS.total).toBe(40_000);
    expect(r.display.total).toBe(40);
    expect(r.displayCurrency).toBe("USD");
  });

  it("tipo de cambio <= 0 es rechazado", () => {
    expect(() => calculateQuotationPricing({ quotationCurrency: "ARS", exchangeRate: 0, team: teamARS })).toThrow();
  });
});
