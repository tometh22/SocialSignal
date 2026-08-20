import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveQuotationPersonnelRate } from "../shared/utils/quotation-personnel-rate";

const baseRate = {
  year: 2026,
  month: 8,
  hourlyRateARS: 150_000,
  hourlyRateUSD: 100,
  exchangeRate: 1_500,
};

describe("quotation personnel currency resolution", () => {
  it("converts ARS-billed people with the quote snapshot, not historical USD", () => {
    expect(resolveQuotationPersonnelRate({
      billingCurrency: "ARS",
      quotationCurrency: "USD",
      quotationExchangeRate: 2_000,
      historicalRates: [baseRate],
      referenceYear: 2026,
      referenceMonth: 8,
    })).toBe(75);
  });

  it("converts USD-billed people with the quote snapshot, not historical ARS", () => {
    expect(resolveQuotationPersonnelRate({
      billingCurrency: "USD",
      quotationCurrency: "ARS",
      quotationExchangeRate: 2_000,
      historicalRates: [baseRate],
      referenceYear: 2026,
      referenceMonth: 8,
    })).toBe(200_000);
  });

  it("combines mixed contracts component by component", () => {
    expect(resolveQuotationPersonnelRate({
      billingCurrency: "mixed",
      usdBillingFraction: 0.9,
      quotationCurrency: "USD",
      quotationExchangeRate: 2_000,
      historicalRates: [baseRate],
      referenceYear: 2026,
      referenceMonth: 8,
    })).toBeCloseTo(97.5);
  });

  it("uses the latest available historical period at or before the quote month", () => {
    expect(resolveQuotationPersonnelRate({
      billingCurrency: "ARS",
      quotationCurrency: "USD",
      quotationExchangeRate: 2_000,
      historicalRates: [
        { ...baseRate, month: 9, hourlyRateARS: 180_000 },
        { ...baseRate, month: 7, hourlyRateARS: 140_000 },
      ],
      referenceYear: 2026,
      referenceMonth: 8,
    })).toBe(70);
  });

  it("averages resolved rates without reusing each month's old FX", () => {
    expect(resolveQuotationPersonnelRate({
      billingCurrency: "ARS",
      quotationCurrency: "USD",
      quotationExchangeRate: 2_000,
      historicalRates: [
        { ...baseRate, month: 7, hourlyRateARS: 140_000, hourlyRateUSD: 140 },
        { ...baseRate, month: 8, hourlyRateARS: 160_000, hourlyRateUSD: 80 },
      ],
      referenceYear: 2026,
      referenceMonth: 8,
      rateMode: "annual_avg",
      averageYear: 2026,
    })).toBe(75);
  });
});

describe("quotation exchange-rate safeguards", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  it("never snapshots a hard-coded loading fallback", () => {
    const hook = source("client/src/hooks/use-currency.tsx");
    expect(hook).toContain("never snapshot a made-up fallback");
    expect(hook).not.toContain("?? 1200");
    expect(hook).not.toContain("|| 1200");
  });

  it("ships the supplied 2026 forecast and live source corroboration", () => {
    const migration = source("migrations/0045_exchange_rate_forecast_2026.sql");
    const service = source("server/services/liveFx.ts");
    const sync = source("server/services/fxSync.ts");
    expect(migration).toContain("(2,  1425.0000");
    expect(migration).toContain("(12, 1760.0000");
    expect(service).toContain("https://dolarapi.com/v1/dolares/blue");
    expect(service).toContain("https://dolarhoy.com/cotizaciondolarblue");
    expect(sync).toContain("systemConfig.configKey");
  });
});
