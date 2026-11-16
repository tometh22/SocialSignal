import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  BUDGET_SOURCE, budgetCostBasis, budgetCostInputSchema, budgetEditBlock, budgetSaleInputSchema, buildBudgetMonths,
  computeBudgetCostAmounts, computeBudgetSaleAmounts, type BudgetCostRow, type BudgetSaleRow,
} from "../shared/finance-budget";

const mocks = vi.hoisted(() => {
  const chain = (rows: unknown[]) => {
    const query: any = { from: () => query, where: () => query, orderBy: () => query, limit: async () => rows, then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
    return query;
  };
  const deleteWhere = vi.fn(async () => undefined);
  return {
    chain,
    selectRows: [] as unknown[][],
    deleteWhere,
    db: {
      select: vi.fn(() => chain(mocks.selectRows.shift() ?? [])),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      delete: vi.fn(() => ({ where: deleteWhere })),
      transaction: vi.fn(),
      execute: vi.fn(async () => ({ rows: [] })),
    },
    source: vi.fn(async (_period: string) => "mind" as "master" | "mind"),
  };
});
vi.mock("../server/db", () => ({ db: mocks.db, pool: { query: vi.fn() } }));
vi.mock("../server/db.js", () => ({ db: mocks.db, pool: { query: vi.fn() } }));
vi.mock("../server/services/finance-period-source", () => ({
  getPeriodSource: mocks.source,
  getMasterSourcedPeriods: vi.fn(async () => []),
}));

import { createBudgetRouter } from "../server/routes-budget";
import { runEstimatedCostsETL } from "../server/etl/costos-estimados-etl";

const cost = (input: Record<string, unknown>) => computeBudgetCostAmounts(budgetCostInputSchema.parse({ period: "2027-01", detalle: "Ana", subtipoCosto: "Equipo", ...input }));

describe("costos estimados: validación y monto total", () => {
  it("calcula el Monto Total USD como la planilla", () => {
    expect(cost({ mode: "usd", amount: 1500 })).toMatchObject({ monedaOriginalUsd: 1500, monedaOriginalArs: null, montoTotalUsd: 1500 });
    expect(cost({ mode: "ars", amount: 1_200_000, exchangeRate: 1200 })).toMatchObject({ monedaOriginalArs: 1_200_000, cotizacion: 1200, montoTotalUsd: 1000 });
    expect(cost({ mode: "hours", hours: 120, hourlyRate: 25, rateCurrency: "USD" })).toMatchObject({ horasUnidades: 120, valorHora: 25, monedaOriginalUsd: 3000, montoTotalUsd: 3000 });
    expect(cost({ mode: "hours", hours: 100, hourlyRate: 15_000, rateCurrency: "ARS", exchangeRate: 1500 })).toMatchObject({ monedaOriginalArs: 1_500_000, montoTotalUsd: 1000 });
  });

  it("rechaza filas incompletas con mensajes en castellano", () => {
    const issues = (input: Record<string, unknown>) => {
      const parsed = budgetCostInputSchema.safeParse({ period: "2027-01", detalle: "Ana", subtipoCosto: "Equipo", ...input });
      return parsed.success ? [] : parsed.error.issues.map(issue => issue.message);
    };
    expect(issues({ mode: "ars", amount: 1000 })).toContain("Indicá la cotización ARS/USD para pasar el monto a dólares.");
    expect(issues({ mode: "usd", amount: 0 })).toContain("Indicá un monto distinto de cero.");
    expect(issues({ mode: "hours", hours: 10 })).toContain("Indicá un valor hora mayor a cero.");
    expect(issues({ mode: "usd", amount: 10, detalle: " " })).toContain("Indicá el detalle.");
    expect(issues({ mode: "usd", amount: 10, period: "2027-13" })).toContain("Elegí un mes válido (AAAA-MM).");
  });
});

describe("ventas estimadas", () => {
  const sale = (input: Record<string, unknown>) => budgetSaleInputSchema.safeParse({ period: "2027-03", clientName: "Warner", currency: "USD", amount: 10_000, confirmed: false, probability: 40, ...input });
  it("pondera por probabilidad las no confirmadas y suma completas las confirmadas", () => {
    const pending = sale({});
    expect(pending.success && computeBudgetSaleAmounts(pending.data)).toMatchObject({ amountUsd: 10_000, probability: 40, status: "pipeline", weightedUsd: 4_000 });
    const confirmed = sale({ confirmed: true, probability: null });
    expect(confirmed.success && computeBudgetSaleAmounts(confirmed.data)).toMatchObject({ probability: 100, status: "confirmed", weightedUsd: 10_000 });
    const ars = sale({ currency: "ARS", amount: 1_500_000, exchangeRate: 1500, probability: 50 });
    expect(ars.success && computeBudgetSaleAmounts(ars.data)).toMatchObject({ amountUsd: 1000, amountNative: 1_500_000, fxRate: 1500, weightedUsd: 500 });
  });
  it("exige probabilidad y cotización cuando corresponde", () => {
    expect(sale({ probability: null }).success).toBe(false);
    expect(sale({ currency: "ARS", exchangeRate: null }).success).toBe(false);
    expect(sale({ probability: 120 }).success).toBe(false);
  });
});

describe("una sola fuente por mes", () => {
  it("los meses del Máster son de solo lectura", () => {
    expect(budgetEditBlock("2026-12", "master", null, "cost")).toMatch(/Diciembre 2026 se informa desde el Máster.*«Costos estimados»/);
    expect(budgetEditBlock("2026-12", "master", null, "sale")).toMatch(/«Proyectos confirmados y estimados»/);
    expect(budgetEditBlock("2027-01", "mind", "CLOSED", "cost")).toMatch(/está cerrado/);
    expect(budgetEditBlock("2027-01", "mind", "OPEN", "cost")).toBeNull();
  });

  it("nunca suma filas del Máster y de Mind en el mismo mes", () => {
    expect(budgetCostBasis("master", 3, 5)).toBe("master");
    expect(budgetCostBasis("mind", 1, 5)).toBe("mind");
    expect(budgetCostBasis("mind", 0, 5)).toBe("master_fallback");
    expect(budgetCostBasis("mind", 0, 0)).toBe("empty");
    const row = (id: number, period: string, native: boolean, montoTotalUsd: number): BudgetCostRow => ({ id, period, native, montoTotalUsd, detalle: `Fila ${id}`, subtipoCosto: "Equipo", puesto: null, billingYear: 2026, horasUnidades: null, valorHora: null, monedaOriginalArs: null, monedaOriginalUsd: montoTotalUsd, cotizacion: null, pasadoFuturo: "Futuro" });
    const saleRow = (id: number, period: string): BudgetSaleRow => ({ id, period, clientName: "Cliente", projectName: null, projectId: null, currency: "USD", amountNative: 1000, amountUsd: 1000, fxRate: null, confirmed: false, probability: 50, weightedUsd: 500, note: null });
    const months = buildBudgetMonths({
      year: 2026, masterPeriods: ["2026-11"], closeStatuses: new Map([["2026-12", "OPEN"]]),
      costs: [row(1, "2026-11", false, 100), row(2, "2026-11", true, 999), row(3, "2026-12", false, 200), row(4, "2026-12", true, 50), row(5, "2026-10", false, 70)],
      sales: [saleRow(1, "2026-11"), saleRow(2, "2026-12")], invoiced: new Map([["2026-12", 300]]),
    });
    const [october, november, december] = months.slice(9);
    expect(november).toMatchObject({ source: "master", costBasis: "master", costTotalUsd: 100, ignoredCostRows: 1, sales: [], salesWeightedUsd: 0 });
    expect(november.editBlock.cost).toMatch(/Máster/);
    expect(december).toMatchObject({ source: "mind", costBasis: "mind", costTotalUsd: 50, ignoredCostRows: 1, salesTotalUsd: 1000, salesWeightedUsd: 500, invoicedUsd: 300, editBlock: { cost: null, sale: null } });
    expect(october).toMatchObject({ source: "mind", costBasis: "master_fallback", costTotalUsd: 70 });
  });
});

describe("la importación del Máster no borra el presupuesto de Mind", () => {
  it("reemplaza sólo las filas importadas de los meses que trae la planilla", async () => {
    mocks.deleteWhere.mockClear();
    const result = await runEstimatedCostsETL([{ monthKey: "2027-01", year: 2027, billingYear: 2027, detalle: "Ana", subtipoCosto: "Equipo", puesto: null, horasUnidades: null, ajusteProveedor: null, valorHora: null, monedaOriginalArs: null, monedaOriginalUsd: 10, cotizacion: null, montoTotalUsd: 10, pasadoFuturo: "Futuro" }]);
    expect(result.errors).toEqual([]);
    const query = new PgDialect().sqlToQuery((mocks.deleteWhere.mock.calls[0] as any[])[0]);
    expect(query.sql).toMatch(/"month_key" in \(\$1\)/);
    expect(query.sql).toMatch(/"source_run_id" IS DISTINCT FROM \$2/);
    expect(query.params).toEqual(["2027-01", BUDGET_SOURCE]);
  });
});

describe("rutas del Presupuesto", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", createBudgetRouter((req: any, res: any, next: any) => {
      const role = req.headers["x-test-role"];
      if (!role) return res.status(401).end();
      req.user = { id: 1, isAdmin: false, permissions: [role] };
      next();
    }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => { mocks.selectRows = []; mocks.db.insert.mockClear(); mocks.db.transaction.mockClear(); mocks.source.mockReset(); });

  const post = (path: string, body: unknown, role = "finance") => fetch(`${base}/api${path}`, { method: "POST", headers: { "content-type": "application/json", "x-test-role": role }, body: JSON.stringify(body) });
  const validCost = { period: "2026-12", detalle: "Ana", subtipoCosto: "Equipo", mode: "usd", amount: 1500 };

  it("sólo Finanzas puede cargar presupuesto", async () => {
    expect((await post("/finance/budget/costs", validCost, "dashboard")).status).toBe(403);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("rechaza con 409 cargar costos o ventas en un mes del Máster", async () => {
    mocks.source.mockResolvedValue("master");
    const response = await post("/finance/budget/costs", validCost);
    expect(response.status).toBe(409);
    expect((await response.json()).message).toMatch(/Diciembre 2026 se informa desde el Máster/);
    const sale = await post("/finance/budget/sales", { period: "2026-12", clientName: "Warner", currency: "USD", amount: 1000, confirmed: false, probability: 50 });
    expect(sale.status).toBe(409);
    const copy = await post("/finance/budget/costs/copy", { from: "2026-11", to: "2026-12" });
    expect(copy.status).toBe(409);
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("no deja editar filas importadas del Máster aunque el mes sea de Mind", async () => {
    mocks.source.mockResolvedValue("mind");
    mocks.selectRows = [[{ id: 7, monthKey: "2027-01", sourceRunId: null }]];
    const response = await fetch(`${base}/api/finance/budget/costs/7`, { method: "PATCH", headers: { "content-type": "application/json", "x-test-role": "finance" }, body: JSON.stringify({ ...validCost, period: "2027-01" }) });
    expect(response.status).toBe(409);
    expect((await response.json()).message).toMatch(/viene de la solapa «Costos estimados» del Máster/);
  });

  it("valida los datos antes de tocar la base", async () => {
    const response = await post("/finance/budget/costs", { ...validCost, mode: "ars", amount: 1000 });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("Indicá la cotización ARS/USD para pasar el monto a dólares.");
    expect(mocks.source).not.toHaveBeenCalled();
  });
});
