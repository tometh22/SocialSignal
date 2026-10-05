import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acceptedScopeCostAndNet, quotedOperationalCost } from "../shared/utils/quotation-profitability";
import { calculateMarginDrift } from "../shared/utils/quotation-margin-drift";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("costo y precio de lo aceptado (lista, detalle, rentabilidad y deriva de margen)", () => {
  it("el precio se mide neto de IVA cuando los precios lo incluyen", () => {
    const { net } = acceptedScopeCostAndNet({ baseCost: 1000, totalAmount: 2420, taxRate: 21, pricesIncludeTax: true });
    expect(net).toBeCloseTo(2000, 2);
    expect(acceptedScopeCostAndNet({ baseCost: 1000, totalAmount: 2000, taxRate: 21, pricesIncludeTax: false }).net).toBe(2000);
  });

  it("incluye herramientas, plataforma y entregables adicionales en el costo, igual que la lista", () => {
    const quotation = { baseCost: 1000, complexityAdjustment: 50, toolsCost: 100, platformCost: 200, additionalDeliverableCost: 30, totalAmount: 3000 };
    expect(acceptedScopeCostAndNet(quotation).cost).toBe(1380);
    expect(acceptedScopeCostAndNet(quotation).cost).toBe(quotedOperationalCost(quotation));
  });

  it("con una variante aceptada usa el costo de ESA variante, no el de la cotización base", () => {
    const quotation = { baseCost: 1000, complexityAdjustment: 0, toolsCost: 100, totalAmount: 5000 };
    const variant = { baseCost: 4000, complexityAdjustment: 200 };
    expect(acceptedScopeCostAndNet(quotation, variant).cost).toBe(4300);
    expect(acceptedScopeCostAndNet(quotation, null).cost).toBe(1100);
  });

  it("la deriva de margen con IVA incluido no subestima la erosión (usa el neto)", () => {
    const team = [{ personnelId: 1, hours: 10, originalRate: 100, currentRate: 130 }];
    const gross = calculateMarginDrift({ lockedTotal: 2420, quotedCost: 1000, team });
    const net = calculateMarginDrift({ lockedTotal: acceptedScopeCostAndNet({ baseCost: 1000, totalAmount: 2420, taxRate: 21, pricesIncludeTax: true }).net, quotedCost: 1000, team });
    expect(net.originalMarginPercentage).toBeCloseTo(50, 1);
    expect(net.marginErosionPoints).toBeGreaterThan(gross.marginErosionPoints);
  });

  it("el servidor usa el mismo cálculo en la deriva de margen (detalle y resumen) y en la rentabilidad", () => {
    const routes = source("server/routes.ts");
    expect(routes.match(/acceptedScopeCostAndNet\(/g)?.length).toBe(3);
    expect(routes).toContain("lockedTotal: scope.net, quotedCost: scope.cost");
    expect(routes).toContain("const { cost: quotedCost, net: revenue } = acceptedScopeCostAndNet(quotation, acceptedVariant);");
  });

  it("el detalle muestra el costo operativo total cuando difiere del subtotal base + complejidad", () => {
    const detail = source("client/src/pages/quotation-detail.tsx");
    expect(detail).toContain("operationalCostTotal");
    expect(detail).toContain("Costo operativo total:");
    expect(detail).toContain("Subtotal (costo base + complejidad):");
  });
});
