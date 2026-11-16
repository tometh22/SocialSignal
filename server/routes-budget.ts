import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { factEstimatedCostMonth, financialAuditEvents, financialClosePeriods, revenueEvents } from "@shared/schema";
import {
  BUDGET_SOURCE, budgetCostInputSchema, budgetEditBlock, budgetPasadoFuturo, budgetPeriodSchema, budgetSaleInputSchema,
  buildBudgetMonths, computeBudgetCostAmounts, computeBudgetSaleAmounts, budgetCostUsesPuesto,
  type BudgetCostRow, type BudgetSaleRow,
} from "@shared/finance-budget";
import { requirePermission } from "./middleware/requirePermission";
import { getMasterSourcedPeriods, getPeriodSource } from "./services/finance-period-source";

/**
 * Finanzas → Presupuesto: costos estimados y ventas estimadas cargados en Mind.
 * Los meses que informa el Máster son de solo lectura (409): se corrigen en la planilla.
 */
type HttpError = Error & { statusCode?: number };
const httpError = (statusCode: number, message: string): HttpError => Object.assign(new Error(message), { statusCode });
const num = (value: unknown) => value == null ? null : Number(value);
const str = (value: number | null) => value == null ? null : String(value);
const currentPeriod = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(new Date());
const idSchema = z.coerce.number().int().positive();
const reasonSchema = z.object({ reason: z.string({ required_error: "Indicá un motivo de al menos 5 caracteres." }).trim().min(5, "Indicá un motivo de al menos 5 caracteres.").max(2000) });
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Datos inválidos";

async function assertBudgetEditable(period: string, kind: "cost" | "sale") {
  const [source, close] = await Promise.all([
    getPeriodSource(period),
    db.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, period)).limit(1),
  ]);
  const block = budgetEditBlock(period, source, close[0]?.status, kind);
  if (block) throw httpError(409, block);
}

const toCostRow = (row: typeof factEstimatedCostMonth.$inferSelect): BudgetCostRow => ({
  id: row.id, period: row.monthKey, native: row.sourceRunId === BUDGET_SOURCE, detalle: row.detalle, subtipoCosto: row.subtipoCosto,
  puesto: row.puesto, billingYear: row.billingYear, horasUnidades: num(row.horasUnidades), valorHora: num(row.valorHora),
  monedaOriginalArs: num(row.monedaOriginalArs), monedaOriginalUsd: num(row.monedaOriginalUsd), cotizacion: num(row.cotizacion),
  montoTotalUsd: num(row.montoTotalUsd), pasadoFuturo: row.pasadoFuturo,
});
const toSaleRow = (row: typeof revenueEvents.$inferSelect): BudgetSaleRow => {
  const amountUsd = Number(row.amountUsd) || 0;
  const probability = num(row.probability);
  return {
    id: row.id, period: row.invoicePeriod, clientName: row.clientName, projectName: row.projectName, projectId: row.projectId,
    currency: row.currency, amountNative: num(row.amountNative), amountUsd, fxRate: num(row.fxRate), confirmed: row.confirmed,
    probability, weightedUsd: Math.round(amountUsd * (row.confirmed ? 1 : (probability ?? 0) / 100) * 100) / 100, note: row.note,
  };
};

function costValues(body: unknown) {
  const parsed = budgetCostInputSchema.safeParse(body);
  if (!parsed.success) throw httpError(400, firstIssue(parsed.error));
  const input = parsed.data;
  const amounts = computeBudgetCostAmounts(input);
  const year = Number(input.period.slice(0, 4));
  return {
    period: input.period,
    values: {
      monthKey: input.period, year, billingYear: input.billingYear ?? year, detalle: input.detalle, subtipoCosto: input.subtipoCosto,
      puesto: budgetCostUsesPuesto(input.subtipoCosto) ? input.puesto : null,
      horasUnidades: str(amounts.horasUnidades), valorHora: str(amounts.valorHora), monedaOriginalArs: str(amounts.monedaOriginalArs),
      monedaOriginalUsd: str(amounts.monedaOriginalUsd), cotizacion: str(amounts.cotizacion), montoTotalUsd: String(amounts.montoTotalUsd),
      pasadoFuturo: budgetPasadoFuturo(input.period, currentPeriod()), sourceRunId: BUDGET_SOURCE, loadedAt: new Date(),
    },
  };
}

function saleValues(body: unknown) {
  const parsed = budgetSaleInputSchema.safeParse(body);
  if (!parsed.success) throw httpError(400, firstIssue(parsed.error));
  const input = parsed.data;
  const amounts = computeBudgetSaleAmounts(input);
  return {
    period: input.period,
    values: {
      clientName: input.clientName, projectName: input.projectName, projectId: input.projectId ?? null,
      amountUsd: amounts.amountUsd.toFixed(2), amountNative: amounts.amountNative.toFixed(2), currency: amounts.currency,
      fxRate: str(amounts.fxRate), invoicePeriod: input.period, deliveryStart: null, deliveryEnd: null, deliveryCurve: "invoice",
      confirmed: amounts.confirmed, probability: String(amounts.probability), status: amounts.status,
      // is_estimate deja la venta fuera de los ingresos reales (recurrentes, contribución por proyecto, conciliación).
      sourceTab: BUDGET_SOURCE, isEstimate: true, note: input.note, updatedAt: new Date(),
    },
  };
}

export function createBudgetRouter(requireAuth: any) {
  const router = Router();
  const read = [requireAuth, requirePermission("dashboard", "finance")];
  const finance = [requireAuth, requirePermission("finance")];
  const fail = (res: any, error: any) => {
    const status = error?.statusCode ?? 500;
    if (status >= 500) console.error("[presupuesto]", error);
    res.status(status).json({ message: status >= 500 ? "No se pudo guardar el presupuesto. Probá de nuevo en unos minutos." : error.message });
  };

  router.get("/finance/budget", ...read, async (req, res) => {
    try {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 2020 || year > 2100) return res.status(400).json({ message: "year inválido" });
      const like = `${year}-%`;
      const [masterPeriods, closes, costs, sales, invoiced] = await Promise.all([
        getMasterSourcedPeriods(),
        db.select({ period: financialClosePeriods.periodKey, status: financialClosePeriods.status }).from(financialClosePeriods).where(sql`${financialClosePeriods.periodKey} LIKE ${like}`),
        db.select().from(factEstimatedCostMonth).where(sql`${factEstimatedCostMonth.monthKey} LIKE ${like}`).orderBy(factEstimatedCostMonth.monthKey, factEstimatedCostMonth.id),
        db.select().from(revenueEvents).where(and(eq(revenueEvents.sourceTab, BUDGET_SOURCE), sql`${revenueEvents.invoicePeriod} LIKE ${like}`, sql`${revenueEvents.status} <> 'cancelled'`)).orderBy(revenueEvents.invoicePeriod, revenueEvents.id),
        db.execute(sql`SELECT invoice_period, sum(amount_usd)::float total FROM revenue_events
          WHERE source_tab='mind_intake' AND status <> 'cancelled' AND invoice_period LIKE ${like} GROUP BY invoice_period`),
      ]);
      const subtipos = await db.execute(sql`SELECT DISTINCT subtipo_costo FROM fact_estimated_cost_month WHERE COALESCE(subtipo_costo,'') <> '' ORDER BY 1 LIMIT 200`);
      const months = buildBudgetMonths({
        year, masterPeriods, closeStatuses: new Map(closes.map(row => [row.period, row.status])),
        costs: costs.map(toCostRow), sales: sales.map(toSaleRow),
        invoiced: new Map((invoiced.rows as any[]).map(row => [String(row.invoice_period), Number(row.total) || 0])),
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ year, months, subtipos: (subtipos.rows as any[]).map(row => String(row.subtipo_costo)) });
    } catch (error) { fail(res, error); }
  });

  // ==================== COSTOS ESTIMADOS ====================

  router.post("/finance/budget/costs/copy", ...finance, async (req, res) => {
    try {
      const parsed = z.object({ from: budgetPeriodSchema, to: budgetPeriodSchema }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: firstIssue(parsed.error) });
      const { from, to } = parsed.data;
      if (from === to) return res.status(400).json({ message: "Elegí un mes distinto para copiar." });
      await assertBudgetEditable(to, "cost");
      const created = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`budget:costs:${to}`}))`);
        const [existing] = await tx.select({ id: factEstimatedCostMonth.id }).from(factEstimatedCostMonth)
          .where(and(eq(factEstimatedCostMonth.monthKey, to), eq(factEstimatedCostMonth.sourceRunId, BUDGET_SOURCE))).limit(1);
        if (existing) throw httpError(409, "Este mes ya tiene costos estimados cargados en Mind. Borralos antes de copiar otro mes.");
        // Se copian las filas que cuentan en el mes de origen, con la misma regla que la Proyección.
        const sourceRows = (await tx.select().from(factEstimatedCostMonth).where(eq(factEstimatedCostMonth.monthKey, from)).orderBy(factEstimatedCostMonth.id)).map(toCostRow);
        const [month] = buildBudgetMonths({ year: Number(from.slice(0, 4)), masterPeriods: await getMasterSourcedPeriods(), closeStatuses: new Map(), costs: sourceRows, sales: [], invoiced: new Map() })
          .filter(candidate => candidate.period === from);
        if (!month.costs.length) throw httpError(409, "El mes de origen no tiene costos estimados para copiar.");
        const year = Number(to.slice(0, 4));
        const pasadoFuturo = budgetPasadoFuturo(to, currentPeriod());
        const rows = await tx.insert(factEstimatedCostMonth).values(month.costs.map(row => ({
          monthKey: to, year, billingYear: year, detalle: row.detalle, subtipoCosto: row.subtipoCosto, puesto: row.puesto,
          horasUnidades: str(row.horasUnidades), valorHora: str(row.valorHora), monedaOriginalArs: str(row.monedaOriginalArs),
          monedaOriginalUsd: str(row.monedaOriginalUsd), cotizacion: str(row.cotizacion), montoTotalUsd: str(row.montoTotalUsd),
          pasadoFuturo, sourceRunId: BUDGET_SOURCE,
        }))).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: to, entityType: "budget_cost", action: "copied", afterData: { from, to, ids: rows.map(row => row.id), count: rows.length }, actorUserId: req.user!.id });
        return rows;
      });
      res.status(201).json({ count: created.length });
    } catch (error) { fail(res, error); }
  });

  router.post("/finance/budget/costs", ...finance, async (req, res) => {
    try {
      const { period, values } = costValues(req.body);
      await assertBudgetEditable(period, "cost");
      const created = await db.transaction(async tx => {
        const [row] = await tx.insert(factEstimatedCostMonth).values(values).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: period, entityType: "budget_cost", entityId: row.id, action: "created", afterData: row, actorUserId: req.user!.id });
        return row;
      });
      res.status(201).json(toCostRow(created));
    } catch (error) { fail(res, error); }
  });

  const loadNativeCost = async (rawId: unknown) => {
    const id = idSchema.safeParse(rawId);
    if (!id.success) throw httpError(400, "id inválido");
    const [row] = await db.select().from(factEstimatedCostMonth).where(eq(factEstimatedCostMonth.id, id.data)).limit(1);
    if (!row) throw httpError(404, "No se encontró el costo estimado.");
    if (row.sourceRunId !== BUDGET_SOURCE) throw httpError(409, "Esta fila viene de la solapa «Costos estimados» del Máster. Corregila en la planilla.");
    await assertBudgetEditable(row.monthKey, "cost");
    return row;
  };

  router.patch("/finance/budget/costs/:id", ...finance, async (req, res) => {
    try {
      const before = await loadNativeCost(req.params.id);
      const { period, values } = costValues(req.body);
      if (period !== before.monthKey) await assertBudgetEditable(period, "cost");
      const updated = await db.transaction(async tx => {
        const [row] = await tx.update(factEstimatedCostMonth).set(values).where(eq(factEstimatedCostMonth.id, before.id)).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: period, entityType: "budget_cost", entityId: row.id, action: "updated", beforeData: before, afterData: row, actorUserId: req.user!.id });
        return row;
      });
      res.json(toCostRow(updated));
    } catch (error) { fail(res, error); }
  });

  router.delete("/finance/budget/costs/:id", ...finance, async (req, res) => {
    try {
      const reason = reasonSchema.safeParse(req.body ?? {});
      if (!reason.success) return res.status(400).json({ message: firstIssue(reason.error) });
      const before = await loadNativeCost(req.params.id);
      await db.transaction(async tx => {
        await tx.delete(factEstimatedCostMonth).where(eq(factEstimatedCostMonth.id, before.id));
        await tx.insert(financialAuditEvents).values({ periodKey: before.monthKey, entityType: "budget_cost", entityId: before.id, action: "deleted", beforeData: before, reason: reason.data.reason, actorUserId: req.user!.id });
      });
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });

  // ==================== VENTAS ESTIMADAS ====================

  router.post("/finance/budget/sales", ...finance, async (req, res) => {
    try {
      const { period, values } = saleValues(req.body);
      await assertBudgetEditable(period, "sale");
      const created = await db.transaction(async tx => {
        const [row] = await tx.insert(revenueEvents).values(values).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: period, entityType: "budget_sale", entityId: row.id, action: "created", afterData: row, actorUserId: req.user!.id });
        return row;
      });
      res.status(201).json(toSaleRow(created));
    } catch (error) { fail(res, error); }
  });

  const loadNativeSale = async (rawId: unknown) => {
    const id = idSchema.safeParse(rawId);
    if (!id.success) throw httpError(400, "id inválido");
    const [row] = await db.select().from(revenueEvents).where(eq(revenueEvents.id, id.data)).limit(1);
    if (!row || row.status === "cancelled") throw httpError(404, "No se encontró la venta estimada.");
    if (row.sourceTab !== BUDGET_SOURCE) throw httpError(409, "Esta venta no se cargó en el Presupuesto. Corregila donde se registró.");
    await assertBudgetEditable(row.invoicePeriod, "sale");
    return row;
  };

  router.patch("/finance/budget/sales/:id", ...finance, async (req, res) => {
    try {
      const before = await loadNativeSale(req.params.id);
      const { period, values } = saleValues(req.body);
      if (period !== before.invoicePeriod) await assertBudgetEditable(period, "sale");
      const updated = await db.transaction(async tx => {
        const [row] = await tx.update(revenueEvents).set(values).where(eq(revenueEvents.id, before.id)).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: period, entityType: "budget_sale", entityId: row.id, action: "updated", beforeData: before, afterData: row, actorUserId: req.user!.id });
        return row;
      });
      res.json(toSaleRow(updated));
    } catch (error) { fail(res, error); }
  });

  router.delete("/finance/budget/sales/:id", ...finance, async (req, res) => {
    try {
      const reason = reasonSchema.safeParse(req.body ?? {});
      if (!reason.success) return res.status(400).json({ message: firstIssue(reason.error) });
      const before = await loadNativeSale(req.params.id);
      await db.transaction(async tx => {
        await tx.delete(revenueEvents).where(eq(revenueEvents.id, before.id));
        await tx.insert(financialAuditEvents).values({ periodKey: before.invoicePeriod, entityType: "budget_sale", entityId: before.id, action: "deleted", beforeData: before, reason: reason.data.reason, actorUserId: req.user!.id });
      });
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });

  return router;
}
