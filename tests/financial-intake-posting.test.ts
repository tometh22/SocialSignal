import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  item: null as any,
  inserts: [] as Array<{ table: unknown; values: any }>,
  selectRows: new Map<unknown, any[]>(),
  nextId: 100,
}));

vi.mock("../server/db", () => ({ db: { transaction: async (fn: (tx: any) => unknown) => fn(fakeTx()) }, pool: {} }));
vi.mock("../server/services/financial-native-builders", () => ({ rebuildNativeFinancialFacts: vi.fn() }));

import { activoEntries, financialIntakeItems, pasivoEntries, plAdjustments, revenueEvents } from "@shared/schema";
import { computeSaleBreakdown, postFinancialIntakeItem, taxSettlementPlan } from "../server/services/financial-intake-posting";
import { extractFinancialTextHeuristically, financialExtractionSchema, type FinancialExtraction } from "../server/services/financial-intake-extractor";
import { monthlyTargetHoursFromWeeklyPlan } from "../server/etl/time-entries-to-fact-labor";

/** Transacción mínima: registra inserts y devuelve filas configuradas por tabla. */
function fakeTx() {
  const chain = (rows: () => any[]) => {
    const query: any = {
      from: (table: unknown) => { query.table = table; return query; },
      leftJoin: () => query, innerJoin: () => query, where: () => query, limit: () => query, for: () => query,
      then: (resolve: (value: any[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows.call(query)).then(resolve, reject),
    };
    return query;
  };
  return {
    execute: vi.fn(async () => ({ rows: [] })),
    select: () => chain(function (this: any) {
      if (this.table === financialIntakeItems) return [state.item];
      return state.selectRows.get(this.table) ?? [];
    }),
    insert: (table: unknown) => ({
      values: (values: any) => {
        const row = { id: state.nextId++, ...values };
        state.inserts.push({ table, values: row });
        const result: any = Promise.resolve(undefined);
        result.returning = async () => [row];
        result.onConflictDoUpdate = () => result;
        return result;
      },
    }),
    update: () => ({ set: () => ({ where: () => { const result: any = Promise.resolve(undefined); result.returning = async () => []; return result; } }) }),
  };
}

function extraction(overrides: Partial<FinancialExtraction>): FinancialExtraction {
  return financialExtractionSchema.parse({
    documentKind: "customer_invoice", suggestedTarget: "activo", periodKey: "2027-01", issueDate: "2027-01-10", dueDate: null,
    paymentDate: null, documentNumber: "A-0001", counterparty: "Acme SA", clientName: "Acme", projectName: null, description: "Fee enero",
    currency: "USD", netAmount: null, taxAmount: null, totalAmount: 1210, exchangeRate: null, bank: null, paymentTermsDays: 30,
    costTreatment: null, costSubtype: null, deliveryStart: null, deliveryEnd: null, deliveryCurve: null, lineItems: [], confidence: 0.9,
    fieldConfidence: {}, missingFields: [], warnings: [],
    ...overrides,
  });
}

async function post(data: FinancialExtraction | Record<string, unknown>) {
  state.item = { id: 7, status: "approved", extractedData: data, linkedRecords: [] };
  return postFinancialIntakeItem(7, 1);
}
const inserted = (table: unknown) => state.inserts.filter((entry) => entry.table === table).map((entry) => entry.values);

beforeEach(() => {
  state.inserts = [];
  state.selectRows = new Map();
  state.nextId = 100;
});

describe("ventas con IVA e IIBB separados", () => {
  it("registra la venta neta de IVA y el IIBB como deuda impositiva aparte", async () => {
    const result = await post(extraction({ ivaAmount: 210, iibbAmount: 30 }));
    const [activo] = inserted(activoEntries);
    expect(activo).toMatchObject({ grossAmount: "1210", netAmount: "1000", taxAmount: "210", outstandingAmount: "1210" });
    const [revenue] = inserted(revenueEvents);
    expect(Number(revenue.amountUsd)).toBe(1000);
    expect(revenue.adjustmentAmountUsd).toBeNull();
    const [iibb] = inserted(pasivoEntries);
    expect(iibb).toMatchObject({ subtipoCosto: "IIBB", costTreatment: "tax", netAmount: "30", montoTotalUSD: "30", currency: "USD", externalId: "intake:7:iibb", documentNumber: null });
    expect(result.linkedRecords).toEqual(expect.arrayContaining([{ type: "pasivo_entry", id: iibb.id }]));
  });

  it("no crea IIBB cuando no se informa y aplica el Ajuste del Máster a la venta", async () => {
    await post(extraction({ currency: "ARS", exchangeRate: 1000, totalAmount: 121000, ivaAmount: 21000, salesAdjustmentAmount: 5000, salesAdjustmentNote: "Inflación" }));
    const [revenue] = inserted(revenueEvents);
    expect(Number(revenue.amountUsd)).toBeCloseTo(105);
    expect(revenue.amountNative).toBe("105000");
    expect(Number(revenue.adjustmentAmountUsd)).toBeCloseTo(5);
    expect(revenue.adjustmentNote).toBe("Inflación");
    expect(inserted(pasivoEntries)).toHaveLength(0);
  });

  it("acepta cargas guardadas antes de los campos nuevos y conserva el neto por impuesto total", async () => {
    const legacy: Record<string, unknown> = { ...extraction({ totalAmount: 121, taxAmount: 21 }) };
    for (const key of ["ivaAmount", "iibbAmount", "salesAdjustmentAmount", "salesAdjustmentNote", "isMarketingCost", "taxConcept", "createsPayable"]) delete legacy[key];
    await post(legacy);
    expect(Number(inserted(revenueEvents)[0].amountUsd)).toBe(100);
    expect(inserted(activoEntries)[0].taxAmount).toBe("21");
  });

  it("separa IVA e IIBB también en un fee confirmado", async () => {
    await post(extraction({ documentKind: "fee_confirmation", suggestedTarget: "revenue", documentNumber: null, ivaAmount: 210, iibbAmount: 35 }));
    expect(Number(inserted(revenueEvents)[0].amountUsd)).toBe(1000);
    expect(inserted(pasivoEntries)[0]).toMatchObject({ subtipoCosto: "IIBB", costTreatment: "tax", netAmount: "35" });
  });

  it("rechaza un ajuste que deja la venta en negativo", () => {
    expect(() => computeSaleBreakdown(extraction({ netAmount: 100, totalAmount: 121, salesAdjustmentAmount: -150 }), 121)).toThrow("negativo");
  });
});

describe("facturas de proveedor", () => {
  it("permite cargar deuda sin costo y marcar costo de marketing", async () => {
    await post(extraction({ documentKind: "supplier_invoice", suggestedTarget: "pasivo", clientName: null, costTreatment: "balance_only", isMarketingCost: true }));
    expect(inserted(pasivoEntries)[0]).toMatchObject({ costTreatment: "balance_only", isMarketing: true });
  });

  it("no marca marketing por defecto", async () => {
    await post(extraction({ documentKind: "supplier_invoice", suggestedTarget: "pasivo", clientName: null, costTreatment: "indirect" }));
    expect(inserted(pasivoEntries)[0]).toMatchObject({ costTreatment: "indirect", isMarketing: false });
  });
});

describe("liquidación impositiva e intereses", () => {
  const settlement = (overrides: Partial<FinancialExtraction>) => extraction({ documentKind: "tax_settlement", suggestedTarget: "tax", clientName: null, counterparty: "ARCA", totalAmount: 500, ...overrides });

  it.each(["IVA", "IIBB", "Impuestos USA"] as const)("guarda %s como concepto canónico", async (concept) => {
    await post(settlement({ taxConcept: concept }));
    expect(inserted(plAdjustments)[0]).toMatchObject({ type: "impuesto", concept, amountUsd: "500" });
    expect(inserted(pasivoEntries)[0]).toMatchObject({ subtipoCosto: concept, costTreatment: "balance_only" });
  });

  it("registra Intereses Oxean como interés y la deuda sólo si queda pendiente", async () => {
    await post(settlement({ taxConcept: "Intereses Oxean", counterparty: "Oxean" }));
    expect(inserted(plAdjustments)[0]).toMatchObject({ type: "interes", concept: "Intereses Oxean" });
    expect(inserted(pasivoEntries)[0]).toMatchObject({ subtipoCosto: "Intereses Oxean", costTreatment: "balance_only" });

    state.inserts = [];
    const result = await post(settlement({ taxConcept: "Intereses Oxean", counterparty: "Oxean", createsPayable: false, documentNumber: "INT-2" }));
    expect(inserted(plAdjustments)).toHaveLength(1);
    expect(inserted(pasivoEntries)).toHaveLength(0);
    expect(result.linkedRecords.map((record) => record.type)).toEqual(["pl_adjustment"]);
  });

  it("avisa si el IIBB del mes ya se cargó por venta", async () => {
    state.selectRows.set(pasivoEntries, [{ id: 55 }]);
    const result = await post(settlement({ taxConcept: "IIBB" }));
    expect(result.warnings.join(" ")).toContain("Pasivo #55");
  });

  it("exige elegir el concepto antes de publicar", async () => {
    await expect(post(settlement({ taxConcept: null }))).rejects.toThrow("taxConcept");
    expect(() => taxSettlementPlan(settlement({ taxConcept: null }))).toThrow("Intereses Oxean");
  });
});

describe("extracción de los campos nuevos", () => {
  it("reconoce el concepto de una liquidación y los intereses de Oxean", () => {
    expect(extractFinancialTextHeuristically("Liquidación IIBB septiembre 2026 ARS 50.000").data).toMatchObject({ documentKind: "tax_settlement", taxConcept: "IIBB" });
    expect(extractFinancialTextHeuristically("Intereses Oxean octubre 2026 USD 1.200").data).toMatchObject({ documentKind: "tax_settlement", taxConcept: "Intereses Oxean" });
  });

  it("acepta tratamiento solo deuda e impuesto", () => {
    expect(extraction({ costTreatment: "balance_only" }).costTreatment).toBe("balance_only");
    expect(extraction({ costTreatment: "tax" }).costTreatment).toBe("tax");
  });
});

describe("horas objetivo desde la planificación de capacidad", () => {
  it("reparte cada semana según los días hábiles del mes e ignora tareas sin responsable", () => {
    const rows = [
      { projectId: 1, personnelId: 9, weekStart: "2026-09-28", estimatedHours: 10 },
      { projectId: 1, personnelId: 9, weekStart: "2026-10-05", estimatedHours: 8 },
      { projectId: 1, personnelId: null, weekStart: "2026-10-05", estimatedHours: 20 },
    ];
    expect(monthlyTargetHoursFromWeeklyPlan(rows, "2026-09").get("1::9")).toBeCloseTo(6);
    expect(monthlyTargetHoursFromWeeklyPlan(rows, "2026-10").get("1::9")).toBeCloseTo(12);
    expect(monthlyTargetHoursFromWeeklyPlan(rows, "2026-10").size).toBe(1);
  });
});

describe("formulario de revisión y migración", () => {
  const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

  it("ofrece los campos nuevos con textos claros", () => {
    const page = read("client/src/pages/financial-intake.tsx");
    for (const text of ['value="balance_only">Solo deuda, sin costo', 'label="IVA"', 'label="IIBB"', 'label="Ajuste de venta"', "Es un gasto de marketing", "Queda pendiente de pago", '"Intereses Oxean"']) expect(page).toContain(text);
  });

  it("registra la migración de columnas nuevas al iniciar", () => {
    expect(read("server/index.ts")).toContain("0100 financial intake details");
    const migration = read("server/migrations/financial-intake-details.ts");
    expect(migration).toContain("is_marketing boolean NOT NULL DEFAULT false");
    expect(migration).toContain("adjustment_amount_usd numeric(14,2)");
  });
});
