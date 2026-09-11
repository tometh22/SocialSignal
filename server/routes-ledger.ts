import { Router } from "express";
import { db } from "./db";
import {
  activoEntries,
  pasivoEntries,
  provisionEntries,
  cashflowTransactions,
  directCosts,
  googleSheetsSales,
  clients,
  activeProjects,
  sheetPersonnelAliases,
  insertActivoEntrySchema,
  insertPasivoEntrySchema,
  insertProvisionEntrySchema,
  insertCashflowTransactionSchema,
  financialAccounts,
  insertFinancialAccountSchema,
  provisionMovements,
  financialClosePeriods,
  financialAuditEvents,
} from "@shared/schema";
import { eq, and, sql, desc, asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { storage } from "./storage";
import { parseMoneySmart } from "./utils/money";
import { requirePermission } from "./middleware/requirePermission";
import { googleSheetsWorkingService } from "./services/googleSheetsWorking";

export function createLedgerRouter(requireAuth: any) {
  const router = Router();
  const finance = [requireAuth, requirePermission("finance")];
  const ensurePeriodMutable = async (periodKey: string) => {
    const [close] = await db.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    if (close?.status === "CLOSED") throw Object.assign(new Error(`El período ${periodKey} está cerrado.`), { statusCode: 409 });
  };
  const reasonSchema = z.object({ reason: z.string().trim().min(5).max(2000) });
  const parseLedgerQuery = (query: Record<string, unknown>) => {
    const period = typeof query.period === "string" ? query.period : "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      return { error: "period debe usar el formato YYYY-MM" } as const;
    }
    const rawPage = Number(query.page ?? 1);
    const rawPageSize = Number(query.pageSize ?? 50);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isInteger(rawPageSize)
      ? Math.min(100, Math.max(1, rawPageSize))
      : 50;
    return { period, page, pageSize } as const;
  };
  const activoUSD = sql<number>`COALESCE(
    ${activoEntries.montoTotalUSD}::double precision,
    ${activoEntries.montoUSD}::double precision,
    ${activoEntries.montoARS}::double precision / NULLIF(${activoEntries.cotizacion}::double precision, 0),
    0
  )`;
  const pasivoUSD = sql<number>`COALESCE(
    ${pasivoEntries.montoTotalUSD}::double precision,
    ${pasivoEntries.montoUSD}::double precision,
    ${pasivoEntries.montoARS}::double precision / NULLIF(${pasivoEntries.cotizacion}::double precision, 0),
    0
  )`;
  const normalizedUSDForWrite = (row: {
    montoUSD?: string | null;
    montoARS?: string | null;
    cotizacion?: string | null;
  }): string | null => {
    const usd = row.montoUSD == null || String(row.montoUSD).trim() === ""
      ? null
      : parseMoneySmart(row.montoUSD);
    if (usd != null && Number.isFinite(usd)) return String(usd);
    const ars = row.montoARS == null || String(row.montoARS).trim() === ""
      ? null
      : parseMoneySmart(row.montoARS);
    const fx = row.cotizacion == null || String(row.cotizacion).trim() === ""
      ? null
      : parseMoneySmart(row.cotizacion);
    return ars != null && fx != null && Number.isFinite(ars) && Number.isFinite(fx) && fx > 0
      ? String(ars / fx)
      : null;
  };
  const normalizeLedgerMoneyInput = (body: Record<string, unknown>) => {
    const normalized = { ...body };
    for (const key of ["montoARS", "montoUSD", "cotizacion", "montoTotalUSD"]) {
      const value = normalized[key];
      if (
        value == null
        || (typeof value === "string" && value.trim() === "")
        || !/\d/.test(String(value))
      ) {
        continue;
      }
      normalized[key] = String(parseMoneySmart(value));
    }
    return normalized;
  };

  // ==================== ACTIVO ====================

  router.get("/activo", ...finance, async (req, res) => {
    try {
      const pagination = parseLedgerQuery(req.query);
      if ("error" in pagination) return res.status(400).json({ message: pagination.error });
      const { period, estado, cliente } = req.query as Record<string, string>;
      const { page, pageSize } = pagination;
      const conditions: any[] = [eq(activoEntries.periodKey, pagination.period), isNull(activoEntries.voidedAt)];
      if (estado === "cobrado") conditions.push(eq(activoEntries.cobradoAlCierre, true));
      if (estado === "pendiente") conditions.push(eq(activoEntries.cobradoAlCierre, false));
      if (estado === "vencido") conditions.push(eq(activoEntries.vencido, true));
      if (cliente) conditions.push(eq(activoEntries.clienteNombre, cliente));

      const where = and(...conditions);
      const [items, totalResult] = await Promise.all([
        db.select({
          id: activoEntries.id,
          periodKey: activoEntries.periodKey,
          concepto: activoEntries.concepto,
          clienteNombre: activoEntries.clienteNombre,
          nroFactura: activoEntries.nroFactura,
          fechaVencimiento: activoEntries.fechaVencimiento,
          vencido: activoEntries.vencido,
          cobradoAlCierre: activoEntries.cobradoAlCierre,
          overrideManual: activoEntries.overrideManual,
          montoTotalUSD: activoUSD,
        }).from(activoEntries)
          .where(where)
          .orderBy(desc(activoEntries.createdAt), desc(activoEntries.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: sql<number>`COUNT(*)::integer` })
          .from(activoEntries)
          .where(where),
      ]);
      const total = Number(totalResult[0]?.total ?? 0);
      res.json({
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/activo/summary", ...finance, async (req, res) => {
    try {
      const parsed = parseLedgerQuery(req.query);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      const [summary] = await db.select({
        total: sql<number>`COALESCE(SUM(${activoUSD}), 0)::double precision`,
        cobrado: sql<number>`COALESCE(SUM(${activoUSD}) FILTER (WHERE ${activoEntries.cobradoAlCierre} = true), 0)::double precision`,
        vencido: sql<number>`COALESCE(SUM(${activoUSD}) FILTER (
          WHERE ${activoEntries.vencido} = true AND COALESCE(${activoEntries.cobradoAlCierre}, false) = false
        ), 0)::double precision`,
        count: sql<number>`COUNT(*)::integer`,
      }).from(activoEntries).where(and(eq(activoEntries.periodKey, parsed.period), isNull(activoEntries.voidedAt)));
      const total = Number(summary?.total ?? 0);
      const cobrado = Number(summary?.cobrado ?? 0);
      res.json({
        total,
        cobrado,
        pendiente: total - cobrado,
        vencido: Number(summary?.vencido ?? 0),
        count: Number(summary?.count ?? 0),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post("/activo", ...finance, async (req, res) => {
    try {
      const parsed = insertActivoEntrySchema.safeParse({
        ...normalizeLedgerMoneyInput(req.body),
        overrideManual: true,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      await ensurePeriodMutable(parsed.data.periodKey);
      const values = {
        ...parsed.data,
        montoTotalUSD: normalizedUSDForWrite(parsed.data),
        source: "mind_manual",
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      };
      const [created] = await db.insert(activoEntries).values(values).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/activo/:id", ...finance, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertActivoEntrySchema.partial().safeParse(normalizeLedgerMoneyInput(req.body));
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [existing] = await db.select().from(activoEntries).where(eq(activoEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await ensurePeriodMutable(existing.periodKey);
      const monetaryChanged = ["montoARS", "montoUSD", "cotizacion"].some((key) => key in parsed.data);
      const monetaryValues = monetaryChanged
        ? { montoTotalUSD: normalizedUSDForWrite({ ...existing, ...parsed.data }) }
        : {};
      const changedKeys = Object.keys(parsed.data);
      const statusOnly = changedKeys.length > 0 && changedKeys.every((key) => key === "cobradoAlCierre");
      const [updated] = await db.update(activoEntries)
        .set({
          ...parsed.data,
          ...monetaryValues,
          overrideManual: existing.overrideManual || !statusOnly,
          updatedAt: new Date(),
          updatedBy: req.user!.id,
        })
        .where(eq(activoEntries.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PASIVO ====================

  router.get("/pasivo", ...finance, async (req, res) => {
    try {
      const pagination = parseLedgerQuery(req.query);
      if ("error" in pagination) return res.status(400).json({ message: pagination.error });
      const { period, subtipo, estado } = req.query as Record<string, string>;
      const { page, pageSize } = pagination;
      const conditions: any[] = [eq(pasivoEntries.periodKey, pagination.period), isNull(pasivoEntries.voidedAt)];
      if (subtipo) conditions.push(eq(pasivoEntries.subtipoCosto, subtipo));
      if (estado === "pagado") conditions.push(eq(pasivoEntries.pagadoAlCierre, true));
      if (estado === "pendiente") conditions.push(eq(pasivoEntries.pagadoAlCierre, false));
      if (estado === "vencido") conditions.push(eq(pasivoEntries.vencido, true));

      const where = and(...conditions);
      const [items, totalResult] = await Promise.all([
        db.select({
          id: pasivoEntries.id,
          periodKey: pasivoEntries.periodKey,
          detalle: pasivoEntries.detalle,
          subtipoCosto: pasivoEntries.subtipoCosto,
          fechaEmision: pasivoEntries.fechaEmision,
          fechaVencimiento: pasivoEntries.fechaVencimiento,
          vencido: pasivoEntries.vencido,
          pagadoAlCierre: pasivoEntries.pagadoAlCierre,
          overrideManual: pasivoEntries.overrideManual,
          montoTotalUSD: pasivoUSD,
        }).from(pasivoEntries)
          .where(where)
          .orderBy(desc(pasivoEntries.createdAt), desc(pasivoEntries.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: sql<number>`COUNT(*)::integer` })
          .from(pasivoEntries)
          .where(where),
      ]);
      const total = Number(totalResult[0]?.total ?? 0);
      res.json({
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/pasivo/summary", ...finance, async (req, res) => {
    try {
      const parsed = parseLedgerQuery(req.query);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      const periodCondition = and(eq(pasivoEntries.periodKey, parsed.period), isNull(pasivoEntries.voidedAt));
      const [summaryRows, subtipoRows] = await Promise.all([
        db.select({
          total: sql<number>`COALESCE(SUM(${pasivoUSD}), 0)::double precision`,
          pagado: sql<number>`COALESCE(SUM(${pasivoUSD}) FILTER (WHERE ${pasivoEntries.pagadoAlCierre} = true), 0)::double precision`,
          vencido: sql<number>`COALESCE(SUM(${pasivoUSD}) FILTER (
            WHERE ${pasivoEntries.vencido} = true AND COALESCE(${pasivoEntries.pagadoAlCierre}, false) = false
          ), 0)::double precision`,
          count: sql<number>`COUNT(*)::integer`,
        }).from(pasivoEntries).where(periodCondition),
        db.select({
          subtipo: sql<string>`COALESCE(${pasivoEntries.subtipoCosto}, 'Sin subtipo')`,
          total: sql<number>`COALESCE(SUM(${pasivoUSD}), 0)::double precision`,
        }).from(pasivoEntries)
          .where(periodCondition)
          .groupBy(pasivoEntries.subtipoCosto),
      ]);
      const summary = summaryRows[0];
      const total = Number(summary?.total ?? 0);
      const pagado = Number(summary?.pagado ?? 0);
      const bySubtipo = Object.fromEntries(
        subtipoRows.map((row) => [row.subtipo, Number(row.total)]),
      );
      res.json({
        total,
        pagado,
        pendiente: total - pagado,
        vencido: Number(summary?.vencido ?? 0),
        bySubtipo,
        count: Number(summary?.count ?? 0),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post("/pasivo", ...finance, async (req, res) => {
    try {
      const parsed = insertPasivoEntrySchema.safeParse({
        ...normalizeLedgerMoneyInput(req.body),
        overrideManual: true,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      await ensurePeriodMutable(parsed.data.periodKey);
      const values = {
        ...parsed.data,
        montoTotalUSD: normalizedUSDForWrite(parsed.data),
        source: "mind_manual",
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      };
      const [created] = await db.insert(pasivoEntries).values(values).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/pasivo/:id", ...finance, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertPasivoEntrySchema.partial().safeParse(normalizeLedgerMoneyInput(req.body));
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [existing] = await db.select().from(pasivoEntries).where(eq(pasivoEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await ensurePeriodMutable(existing.periodKey);
      const monetaryChanged = ["montoARS", "montoUSD", "cotizacion"].some((key) => key in parsed.data);
      const monetaryValues = monetaryChanged
        ? { montoTotalUSD: normalizedUSDForWrite({ ...existing, ...parsed.data }) }
        : {};
      const changedKeys = Object.keys(parsed.data);
      const statusOnly = changedKeys.length > 0 && changedKeys.every((key) => key === "pagadoAlCierre");
      const [updated] = await db.update(pasivoEntries)
        .set({
          ...parsed.data,
          ...monetaryValues,
          overrideManual: existing.overrideManual || !statusOnly,
          updatedAt: new Date(),
          updatedBy: req.user!.id,
        })
        .where(eq(pasivoEntries.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PROVISIONES ====================

  router.get("/provisions", ...finance, async (req, res) => {
    try {
      const { period } = req.query as Record<string, string>;
      const rows = period
        ? await db.select().from(provisionEntries).where(eq(provisionEntries.periodKey, period)).orderBy(desc(provisionEntries.createdAt))
        : await db.select().from(provisionEntries).orderBy(desc(provisionEntries.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post("/provisions", ...finance, async (req, res) => {
    try {
      const parsed = insertProvisionEntrySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      await ensurePeriodMutable(parsed.data.periodKey);
      const [created] = await db.insert(provisionEntries).values({ ...parsed.data, createdBy: req.user!.id }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/provisions/:id", ...finance, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertProvisionEntrySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [existing] = await db.select().from(provisionEntries).where(eq(provisionEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(provisionEntries).set({ ...parsed.data, updatedAt: new Date() }).where(eq(provisionEntries.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CASHFLOW ====================

  // Cuentas bancarias/caja que reemplazan las columnas fijas de la planilla.
  router.get("/financial-accounts", ...finance, async (_req, res) => {
    try { res.json(await db.select().from(financialAccounts).orderBy(asc(financialAccounts.name))); }
    catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  router.post("/financial-accounts", ...finance, async (req, res) => {
    try {
      const parsed = insertFinancialAccountSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [created] = await db.insert(financialAccounts).values(parsed.data).returning();
      await db.insert(financialAuditEvents).values({ entityType: "financial_account", entityId: created.id, action: "created", afterData: created, actorUserId: req.user!.id });
      res.status(201).json(created);
    } catch (error: any) { res.status(error?.code === "23505" ? 409 : 500).json({ message: error?.code === "23505" ? "Ya existe una cuenta con ese nombre y moneda." : error.message }); }
  });

  router.patch("/financial-accounts/:id", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = insertFinancialAccountSchema.partial().safeParse(req.body);
      if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ message: "Datos inválidos." });
      const [existing] = await db.select().from(financialAccounts).where(eq(financialAccounts.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Cuenta no encontrada." });
      const [updated] = await db.update(financialAccounts).set({ ...parsed.data, updatedAt: new Date() }).where(eq(financialAccounts.id, id)).returning();
      await db.insert(financialAuditEvents).values({ entityType: "financial_account", entityId: id, action: "updated", beforeData: existing, afterData: updated, actorUserId: req.user!.id });
      res.json(updated);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  router.get("/cashflow", ...finance, async (req, res) => {
    try {
      const { period, banco, tipo } = req.query as Record<string, string>;
      const conditions: any[] = [isNull(cashflowTransactions.voidedAt)];
      if (period) conditions.push(eq(cashflowTransactions.periodKey, period));
      if (banco) conditions.push(eq(cashflowTransactions.banco, banco));
      if (tipo) conditions.push(eq(cashflowTransactions.tipoMovimiento, tipo));

      const rows = conditions.length
        ? await db.select().from(cashflowTransactions).where(and(...conditions)).orderBy(asc(cashflowTransactions.fecha))
        : await db.select().from(cashflowTransactions).orderBy(asc(cashflowTransactions.fecha));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post("/cashflow", ...finance, async (req, res) => {
    try {
      const parsed = insertCashflowTransactionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      await ensurePeriodMutable(parsed.data.periodKey);
      const [created] = await db.insert(cashflowTransactions).values({ ...parsed.data, source: "mind_manual", createdBy: req.user!.id, updatedBy: req.user!.id }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/cashflow/:id", ...finance, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertCashflowTransactionSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [existing] = await db.select().from(cashflowTransactions).where(eq(cashflowTransactions.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(cashflowTransactions)
        .set({ ...parsed.data, updatedBy: req.user!.id, updatedAt: new Date() })
        .where(eq(cashflowTransactions.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post("/cashflow/:id/reconcile", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = z.object({ status: z.enum(["matched", "unmatched", "ignored"]), note: z.string().max(2000).nullable().optional() }).safeParse(req.body);
      if (!Number.isInteger(id) || !input.success) return res.status(400).json({ message: "Datos inválidos." });
      const [existing] = await db.select().from(cashflowTransactions).where(eq(cashflowTransactions.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Movimiento no encontrado." });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(cashflowTransactions).set({ reconciliationStatus: input.data.status, updatedBy: req.user!.id, updatedAt: new Date() }).where(eq(cashflowTransactions.id, id)).returning();
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "cashflow_transaction", entityId: id, action: "reconciled", beforeData: existing, afterData: { reconciliationStatus: input.data.status }, actorUserId: req.user!.id, reason: input.data.note });
      res.json(updated);
    } catch (error: any) { res.status(error.statusCode ?? 500).json({ message: error.message }); }
  });

  router.get("/cashflow/balance", ...finance, async (req, res) => {
    try {
      const { date } = req.query as Record<string, string>;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "date param required as YYYY-MM-DD" });
      }
      const cutoff = new Date(date + "T23:59:59Z");
      const rows = await db.select()
        .from(cashflowTransactions)
        .where(and(sql`${cashflowTransactions.fecha} <= ${cutoff}`, isNull(cashflowTransactions.voidedAt)))
        .orderBy(asc(cashflowTransactions.fecha));

      // Saldos acumulados por banco, calculados sumando ingresos/egresos hasta la fecha
      // (las columnas saldo* nunca se populan en la importación, así que se computa acá).
      const balances: Record<string, number> = { Santander: 0, BOA: 0, Caja: 0 };
      let totalUSD = 0;
      for (const r of rows) {
        const amt = parseFloat(r.montoUSD ?? "0") || 0;
        const signed = r.tipoMovimiento === "Egreso" ? -amt : amt;
        const banco = r.banco || "Otros";
        balances[banco] = (balances[banco] ?? 0) + signed;
        totalUSD += signed;
      }
      res.json({ date, balances, totalUSD });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/cashflow/summary", ...finance, async (req, res) => {
    try {
      const { year } = req.query as Record<string, string>;
      const conditions: any[] = [isNull(cashflowTransactions.voidedAt)];
      if (year) conditions.push(sql`extract(year from ${cashflowTransactions.fecha}) = ${parseInt(year)}`);

      const rows = conditions.length
        ? await db.select().from(cashflowTransactions).where(and(...conditions))
        : await db.select().from(cashflowTransactions);

      const byPeriod: Record<string, { ingresos: number; egresos: number; neto: number }> = {};
      for (const r of rows) {
        const p = r.periodKey;
        if (!byPeriod[p]) byPeriod[p] = { ingresos: 0, egresos: 0, neto: 0 };
        const amt = parseFloat(r.montoUSD ?? "0");
        if (r.tipoMovimiento === "Ingreso") byPeriod[p].ingresos += amt;
        else byPeriod[p].egresos += amt;
        byPeriod[p].neto = byPeriod[p].ingresos - byPeriod[p].egresos;
      }

      res.json(byPeriod);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Correcciones contables: nunca se borra una fila; se anula con motivo y auditoría.
  router.post("/activo/:id/void", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id); const { reason } = reasonSchema.parse(req.body);
      const [existing] = await db.select().from(activoEntries).where(eq(activoEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Activo no encontrado." });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(activoEntries).set({ status: "VOID", voidedAt: new Date(), voidedBy: req.user!.id, voidReason: reason, updatedBy: req.user!.id, updatedAt: new Date() }).where(and(eq(activoEntries.id, id), isNull(activoEntries.voidedAt))).returning();
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "activo_entry", entityId: id, action: "voided", beforeData: existing, afterData: updated, actorUserId: req.user!.id, reason });
      res.json(updated ?? existing);
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  router.post("/pasivo/:id/void", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id); const { reason } = reasonSchema.parse(req.body);
      const [existing] = await db.select().from(pasivoEntries).where(eq(pasivoEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Pasivo no encontrado." });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(pasivoEntries).set({ status: "VOID", voidedAt: new Date(), voidedBy: req.user!.id, voidReason: reason, updatedBy: req.user!.id, updatedAt: new Date() }).where(and(eq(pasivoEntries.id, id), isNull(pasivoEntries.voidedAt))).returning();
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "pasivo_entry", entityId: id, action: "voided", beforeData: existing, afterData: updated, actorUserId: req.user!.id, reason });
      res.json(updated ?? existing);
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  router.post("/cashflow/:id/void", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id); const { reason } = reasonSchema.parse(req.body);
      const [existing] = await db.select().from(cashflowTransactions).where(eq(cashflowTransactions.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Movimiento no encontrado." });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(cashflowTransactions).set({ voidedAt: new Date(), voidedBy: req.user!.id, voidReason: reason, updatedBy: req.user!.id, updatedAt: new Date() }).where(and(eq(cashflowTransactions.id, id), isNull(cashflowTransactions.voidedAt))).returning();
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "cashflow_transaction", entityId: id, action: "voided", beforeData: existing, afterData: updated, actorUserId: req.user!.id, reason });
      res.json(updated ?? existing);
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  router.post("/provisions/:id/approve", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(provisionEntries).where(eq(provisionEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Provisión no encontrada." });
      await ensurePeriodMutable(existing.periodKey);
      const [updated] = await db.update(provisionEntries).set({ status: "APPROVED", approvedBy: req.user!.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(provisionEntries.id, id)).returning();
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "provision_entry", entityId: id, action: "approved", beforeData: existing, afterData: updated, actorUserId: req.user!.id });
      res.json(updated);
    } catch (error: any) { res.status(error.statusCode ?? 500).json({ message: error.message }); }
  });

  router.post("/provisions/:id/release", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = z.object({ amount: z.coerce.number().positive(), periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), note: z.string().trim().min(5).max(2000) }).parse(req.body);
      const [existing] = await db.select().from(provisionEntries).where(eq(provisionEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Provisión no encontrada." });
      await ensurePeriodMutable(input.periodKey);
      const remaining = Number(existing.remainingAmount ?? existing.montoProvision ?? 0);
      if (input.amount > remaining) return res.status(400).json({ message: "La liberación supera el saldo de la provisión." });
      const next = remaining - input.amount;
      const [updated] = await db.update(provisionEntries).set({ remainingAmount: String(next), unwoundAmount: String(Number(existing.unwoundAmount ?? 0) + input.amount), status: next === 0 ? "RELEASED" : "ACTIVE", updatedAt: new Date() }).where(eq(provisionEntries.id, id)).returning();
      const [movement] = await db.insert(provisionMovements).values({ provisionId: id, periodKey: input.periodKey, movementType: "release", amount: String(-input.amount), currency: existing.currency, note: input.note, createdBy: req.user!.id }).returning();
      await db.insert(financialAuditEvents).values({ periodKey: input.periodKey, entityType: "provision_entry", entityId: id, action: "released", beforeData: existing, afterData: { provision: updated, movement }, actorUserId: req.user!.id, reason: input.note });
      res.json({ provision: updated, movement });
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  // ==================== P&L POR CLIENTE ====================

  router.get("/clients/:id/pnl", ...finance, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client id" });
      const { period } = req.query as Record<string, string>;

      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const salesRows = period
        ? await db.select().from(googleSheetsSales).where(
            and(
              sql`lower(${googleSheetsSales.clientName}) = lower(${client.name})`,
              sql`${googleSheetsSales.monthKey} = ${period}`
            )
          )
        : await db.select().from(googleSheetsSales).where(
            sql`lower(${googleSheetsSales.clientName}) = lower(${client.name})`
          );

      const revenue = salesRows.reduce((s, r) => s + parseFloat(r.amountUsd ?? "0"), 0);

      const costsRows = period
        ? await db.select().from(directCosts).where(
            and(
              sql`lower(${directCosts.cliente}) = lower(${client.name})`,
              eq(directCosts.monthKey, period)
            )
          )
        : await db.select().from(directCosts).where(
            sql`lower(${directCosts.cliente}) = lower(${client.name})`
          );

      const cost = costsRows.reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? "0"), 0);
      const markup = revenue > 0 ? ((revenue - cost) / cost) * 100 : 0;
      const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;

      const teamBreakdown = costsRows.reduce((acc: Record<string, any>, r) => {
        const key = r.persona || "Unknown";
        if (!acc[key]) acc[key] = { persona: key, subtipo: r.subtipoCosto || r.rol || null, costoUSD: 0 };
        acc[key].costoUSD += parseFloat(r.montoTotalUSD ?? "0");
        return acc;
      }, {});

      res.json({
        client: { id: clientId, name: client.name },
        period: period || "all",
        revenue,
        cost,
        markup: Math.round(markup * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        teamBreakdown: Object.values(teamBreakdown),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ADMIN: ALIAS COVERAGE ====================

  router.get("/admin/alias-coverage", requireAuth, requirePermission("admin"), async (req, res) => {
    try {
      const rawCosts = await db.select({ persona: directCosts.persona }).from(directCosts);
      const uniquePersonas = [...new Set(rawCosts.map(r => r.persona).filter(Boolean))] as string[];

      const aliases = await db.select({ sheetName: sheetPersonnelAliases.sheetName }).from(sheetPersonnelAliases);
      const aliasSet = new Set(aliases.map(a => (a.sheetName || "").toLowerCase().trim()));

      const missing = uniquePersonas.filter(p => !aliasSet.has(p.toLowerCase().trim()));
      const coverage = uniquePersonas.length > 0
        ? Math.round(((uniquePersonas.length - missing.length) / uniquePersonas.length) * 100)
        : 100;

      res.json({
        total: uniquePersonas.length,
        covered: uniquePersonas.length - missing.length,
        missing,
        coverage,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ADMIN: BACKFILL ACTIVO/PASIVO ====================
  // Carga histórica manual desde el Excel MAESTRO. El sync automático
  // (autoSyncService.syncLedger) sólo importa el mes en curso y deja de
  // tocar activo/pasivo desde app_mode_cutover_date en adelante — por
  // diseño, para no pisar la carga manual en Mind. Este endpoint es la
  // excepción explícita: un admin pide un rango puntual (incluso posterior
  // al cutover) y se trae esos meses tal cual están en la hoja "Activo"/
  // "Pasivo" del Excel MAESTRO. Reutiliza los mismos parsers que el cron
  // (importActivoEntries/importPasivoEntries), así que nunca diverge de
  // cómo se interpreta la planilla. Filas con overrideManual=true (carga
  // manual previa en Mind) nunca se pisan, sea cual sea el rango pedido.
  router.post("/ledger/backfill", requireAuth, requirePermission("admin"), async (req, res) => {
    try {
      const from = String(req.body?.from || "").trim();
      const now = new Date();
      const to = String(req.body?.to || "").trim()
        || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from)) {
        return res.status(400).json({ message: "from es obligatorio y debe tener formato YYYY-MM" });
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(to)) {
        return res.status(400).json({ message: "to debe tener formato YYYY-MM" });
      }
      if (from > to) {
        return res.status(400).json({ message: "from no puede ser posterior a to" });
      }

      const periods: string[] = [];
      let [y, m] = from.split("-").map(Number);
      const [toY, toM] = to.split("-").map(Number);
      while (y < toY || (y === toY && m <= toM)) {
        periods.push(`${y}-${String(m).padStart(2, "0")}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
      if (periods.length > 24) {
        return res.status(400).json({ message: "Rango demasiado grande (máx. 24 meses por corrida)" });
      }

      const results: Record<string, { activo: any; pasivo: any }> = {};
      for (const period of periods) {
        const [activo, pasivo] = await Promise.allSettled([
          googleSheetsWorkingService.importActivoEntries(storage, period),
          googleSheetsWorkingService.importPasivoEntries(storage, period),
        ]);
        results[period] = {
          activo: activo.status === "fulfilled" ? activo.value : { errors: [String((activo as PromiseRejectedResult).reason)] },
          pasivo: pasivo.status === "fulfilled" ? pasivo.value : { errors: [String((pasivo as PromiseRejectedResult).reason)] },
        };
      }

      res.json({ periods, results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}
