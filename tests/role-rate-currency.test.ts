import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findArsRatesInUsdQuotation, resolveRoleRate } from "../shared/utils/role-rate";
import { calculateQuotationPricing } from "../shared/utils/quotation-pricing";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

// Roles reales del grupo PepsiCo (GRP-2026-000001): los canónicos nuevos tienen defaultRateUsd en 0/null.
const roles = new Map([
  [18, { defaultRate: 22466, defaultRateUsd: 0 }],
  [12, { defaultRate: 17500, defaultRateUsd: null }],
  [20, { defaultRate: 17500, defaultRateUsd: 0 }],
  [21, { defaultRate: 13686, defaultRateUsd: 0 }],
  [9, { defaultRate: 23100, defaultRateUsd: 15 }],
  [10, { defaultRate: 19250, defaultRateUsd: 12.5 }],
]);
const FX = 1540;

describe("tarifa de rol en la moneda de la cotización", () => {
  it("en USD usa defaultRateUsd si existe", () => {
    expect(resolveRoleRate(roles.get(9), "USD", FX)).toBe(15);
  });

  it("en USD convierte la tarifa en pesos cuando el rol no tiene tarifa USD (en vez de guardar pesos como dólares)", () => {
    expect(resolveRoleRate(roles.get(18), "USD", FX)).toBeCloseTo(14.59, 2);
    expect(resolveRoleRate(roles.get(12), "USD", FX)).toBeCloseTo(11.36, 2);
  });

  it("en ARS usa defaultRate y sólo convierte desde USD si no hay tarifa en pesos", () => {
    expect(resolveRoleRate(roles.get(18), "ARS", FX)).toBe(22466);
    expect(resolveRoleRate({ defaultRate: 0, defaultRateUsd: 10 }, "ARS", FX)).toBe(15400);
  });

  it("no inventa una tarifa si no hay forma de resolverla", () => {
    expect(resolveRoleRate({ defaultRate: 0, defaultRateUsd: 0 }, "USD", FX)).toBe(0);
    expect(resolveRoleRate({ defaultRate: 5000, defaultRateUsd: 0 }, "USD", 0)).toBe(0);
    expect(resolveRoleRate(null, "ARS", FX)).toBe(0);
  });

  it("regresión PepsiCo: el equipo bien convertido da miles de USD, no millones", () => {
    const hours: Array<[number, number]> = [[18, 47.5], [12, 39.5], [20, 13.5], [21, 16], [9, 131], [10, 38]];
    const team = (rateOf: (roleId: number) => number) => hours.map(([roleId, h]) => ({ hours: h, rate: rateOf(roleId), currency: "USD" as const }));
    const common = { quotationCurrency: "USD" as const, exchangeRate: FX, complexityFactor: 1, marginFactor: 1, toolsCostUSD: 0, additionalDeliverableCostUSD: 0, platformCostARS: 0, deviationPercentage: 0, discountPercentage: 0, inflationFactor: 1, priceMode: "auto" as const };
    const buggy = calculateQuotationPricing({ ...common, team: team((id) => (roles.get(id)!.defaultRateUsd || roles.get(id)!.defaultRate)) }).display.baseCost;
    const fixed = calculateQuotationPricing({ ...common, team: team((id) => resolveRoleRate(roles.get(id), "USD", FX)) }).display.baseCost;
    expect(buggy).toBeGreaterThan(2_000_000);
    expect(fixed).toBeLessThan(5_000);
    expect(fixed).toBeGreaterThan(3_000);
  });
});

describe("detección de tarifas en pesos dentro de una cotización USD", () => {
  const member = (roleId: number, rate: number, personnelId: number | null = null) => ({ roleId, personnelId, rate });

  it("marca los 4 roles del caso PepsiCo y no los dos que estaban bien", () => {
    const members = [member(18, 22466), member(12, 17500), member(20, 17500), member(21, 13686), member(9, 15), member(10, 12.5)];
    const found = findArsRatesInUsdQuotation({ currency: "USD", exchangeRate: FX, members, roles });
    expect(found.map((item) => item.roleId)).toEqual([18, 12, 20, 21]);
    expect(found[0].expectedUsdRate).toBeCloseTo(14.59, 2);
  });

  it("no marca tarifas ya convertidas, ni miembros con persona, ni cotizaciones en ARS", () => {
    expect(findArsRatesInUsdQuotation({ currency: "USD", exchangeRate: FX, members: [member(18, 14.59), member(12, 11.36)], roles })).toEqual([]);
    expect(findArsRatesInUsdQuotation({ currency: "USD", exchangeRate: FX, members: [member(18, 22466, 7)], roles })).toEqual([]);
    expect(findArsRatesInUsdQuotation({ currency: "ARS", exchangeRate: FX, members: [member(18, 22466)], roles })).toEqual([]);
  });

  it("no da falsos positivos cuando la tarifa USD legítima es parecida a la de pesos (rol con ambas iguales)", () => {
    const same = new Map([[1, { defaultRate: 50, defaultRateUsd: 50 }]]);
    expect(findArsRatesInUsdQuotation({ currency: "USD", exchangeRate: FX, members: [member(1, 50)], roles: same })).toEqual([]);
  });

  it("el servidor la aplica al crear y al editar, y el cliente usa el helper en todos los puntos de alta por rol", () => {
    const routes = source("server/routes.ts");
    expect(routes.match(/await assertRoleRatesMatchCurrency\(validatedData/g)?.length).toBe(2);
    expect(routes).toContain("está en pesos y la cotización es en USD");
    for (const file of [
      "client/src/components/quotation/professional-scope-builder.tsx",
      "client/src/context/optimized-quote-context.tsx",
      "client/src/components/optimized/EnhancedTeamConfig.tsx",
    ]) expect(source(file)).toContain("resolveRoleRate(");
    expect(source("client/src/context/optimized-quote-context.tsx")).not.toContain("defaultRateUsd || 50");
    expect(source("client/src/components/quotation/professional-scope-builder.tsx")).not.toContain("role.defaultRateUsd || role.defaultRate");
    // Si la receta se aplicó antes de que cargara el tipo de cambio, el rate 0 se completa solo después.
    expect(source("client/src/components/quotation/professional-scope-builder.tsx")).toContain("if (changed) updateTeamMembers(filled);");
  });
});
