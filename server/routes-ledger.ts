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
  financialDocumentApplications,
  financialIntakeItems,
  revenueEvents,
  exchangeRates,
} from "@shared/schema";
import { eq, and, sql, desc, asc, isNull, inArray, gte } from "drizzle-orm";
import { z } from "zod";
import { storage } from "./storage";
import { parseMoneySmart } from "./utils/money";
import { requirePermission } from "./middleware/requirePermission";
import { googleSheetsWorkingService } from "./services/googleSheetsWorking";
import { getCutoverDate } from "./etl/time-entries-to-fact-labor";
import { rebuildNativeFinancialFacts } from "./services/financial-native-builders";

export function createLedgerRouter(requireAuth: any) {
  const router = Router();
  const finance = [requireAuth, requirePermission("finance")];
  const ensurePeriodMutable = async (periodKey: string) => {
    const [close] = await db.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${periodKey} está ${close?.status === "CLOSED" ? "cerrado" : "en revisión"}.`), { statusCode: 409 });
  };
  const reasonSchema = z.object({ reason: z.string().trim().min(5).max(2000) });
  const refreshNativeFacts = async (periodKey: string) => {
    try { await rebuildNativeFinancialFacts(periodKey); }
    catch (error) { console.error(`[ledger] no se pudieron refrescar los agregados de ${periodKey}:`, error); }
  };
  const revenueLinkForDocument = async (tx: any, externalId: string | null) => {
    const intakeId = Number(externalId?.match(/^intake:(\d+):(activo|pasivo)$/)?.[1]);
    if (!intakeId) return null;
    const [source] = await tx.select({ linkedRecords: financialIntakeItems.linkedRecords }).from(financialIntakeItems).where(eq(financialIntakeItems.id, intakeId)).limit(1);
    const links = Array.isArray(source?.linkedRecords) ? source.linkedRecords as Array<{ type?: string; id?: number }> : [];
    return links.find((candidate) => ["revenue_event", "revenue_event_linked"].includes(candidate.type ?? "") && Number.isInteger(candidate.id)) ?? null;
  };
  const prepareBalanceMutation = async (tx: any, effectiveDate: Date) => {
    const effectivePeriod = effectiveDate.toISOString().slice(0, 7);
    const periods = await tx.select().from(financialClosePeriods).where(gte(financialClosePeriods.periodKey, effectivePeriod)).orderBy(asc(financialClosePeriods.periodKey));
    for (const period of periods) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + period.periodKey}))`);
      const [current] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.id, period.id)).limit(1);
      if (["IN_REVIEW", "CLOSED"].includes(current?.status ?? "")) throw Object.assign(new Error(`La cuenta impacta el período ${period.periodKey}, que está ${current?.status === "CLOSED" ? "cerrado" : "en revisión"}. Reabrilo antes de cambiar el saldo inicial.`), { statusCode: 409 });
      if (current?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.id, period.id));
    }
  };
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
  const activoOutstandingUSD = sql<number>`COALESCE(
    CASE WHEN ${activoEntries.currency} = 'ARS'
      THEN ${activoEntries.outstandingAmount}::double precision / NULLIF(${activoEntries.cotizacion}::double precision, 0)
      ELSE ${activoEntries.outstandingAmount}::double precision END,
    CASE WHEN ${activoEntries.cobradoAlCierre} THEN 0 ELSE ${activoUSD} END
  )`;
  const pasivoUSD = sql<number>`COALESCE(
    ${pasivoEntries.montoTotalUSD}::double precision,
    ${pasivoEntries.montoUSD}::double precision,
    ${pasivoEntries.montoARS}::double precision / NULLIF(${pasivoEntries.cotizacion}::double precision, 0),
    0
  )`;
  const pasivoOutstandingUSD = sql<number>`COALESCE(
    CASE WHEN ${pasivoEntries.currency} = 'ARS'
      THEN ${pasivoEntries.outstandingAmount}::double precision / NULLIF(${pasivoEntries.cotizacion}::double precision, 0)
      ELSE ${pasivoEntries.outstandingAmount}::double precision END,
    CASE WHEN ${pasivoEntries.pagadoAlCierre} THEN 0 ELSE ${pasivoUSD} END
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
          outstandingUSD: activoOutstandingUSD,
          status: activoEntries.status,
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
        cobrado: sql<number>`COALESCE(SUM(${activoUSD} - ${activoOutstandingUSD}), 0)::double precision`,
        pendiente: sql<number>`COALESCE(SUM(${activoOutstandingUSD}), 0)::double precision`,
        vencido: sql<number>`COALESCE(SUM(${activoOutstandingUSD}) FILTER (
          WHERE ${activoEntries.vencido} = true
        ), 0)::double precision`,
        count: sql<number>`COUNT(*)::integer`,
      }).from(activoEntries).where(and(eq(activoEntries.periodKey, parsed.period), isNull(activoEntries.voidedAt)));
      const total = Number(summary?.total ?? 0);
      const cobrado = Number(summary?.cobrado ?? 0);
      res.json({
        total,
        cobrado,
        pendiente: Number(summary?.pendiente ?? total - cobrado),
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
      if (existing.source === "mind_intake") return res.status(409).json({ message: "Las facturas nativas se corrigen anulando la carga y registrándola nuevamente." });
      if ("cobradoAlCierre" in parsed.data || "status" in parsed.data || "outstandingAmount" in parsed.data || "fechaPago" in parsed.data) {
        return res.status(409).json({ message: "Registrá el cobro desde Carga financiera para crear también el movimiento y su conciliación." });
      }
      if (parsed.data.periodKey && parsed.data.periodKey !== existing.periodKey) await ensurePeriodMutable(parsed.data.periodKey);
      const monetaryChanged = ["montoARS", "montoUSD", "cotizacion"].some((key) => key in parsed.data);
      const monetaryValues = monetaryChanged
        ? { montoTotalUSD: normalizedUSDForWrite({ ...existing, ...parsed.data }) }
        : {};
      const [updated] = await db.update(activoEntries)
        .set({
          ...parsed.data,
          ...monetaryValues,
          overrideManual: true,
          updatedAt: new Date(),
          updatedBy: req.user!.id,
        })
        .where(eq(activoEntries.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "activo_entry", entityId: id, action: "historical_entry_edited", beforeData: existing, afterData: updated, actorUserId: req.user!.id });
      res.json(updated);
    } catch (error: any) {
      res.status(error.statusCode ?? 500).json({ message: error.message });
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
          outstandingUSD: pasivoOutstandingUSD,
          status: pasivoEntries.status,
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
        pagado: sql<number>`COALESCE(SUM(${pasivoUSD} - ${pasivoOutstandingUSD}), 0)::double precision`,
        pendiente: sql<number>`COALESCE(SUM(${pasivoOutstandingUSD}), 0)::double precision`,
        vencido: sql<number>`COALESCE(SUM(${pasivoOutstandingUSD}) FILTER (
          WHERE ${pasivoEntries.vencido} = true
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
        pendiente: Number(summary?.pendiente ?? total - pagado),
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
      await refreshNativeFacts(created.periodKey);
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
      if (existing.source === "mind_intake") return res.status(409).json({ message: "Las facturas nativas se corrigen anulando la carga y registrándola nuevamente." });
      if ("pagadoAlCierre" in parsed.data || "status" in parsed.data || "outstandingAmount" in parsed.data || "fechaPago" in parsed.data) {
        return res.status(409).json({ message: "Registrá el pago desde Carga financiera para crear también el movimiento y su conciliación." });
      }
      if (parsed.data.periodKey && parsed.data.periodKey !== existing.periodKey) await ensurePeriodMutable(parsed.data.periodKey);
      const monetaryChanged = ["montoARS", "montoUSD", "cotizacion"].some((key) => key in parsed.data);
      const monetaryValues = monetaryChanged
        ? { montoTotalUSD: normalizedUSDForWrite({ ...existing, ...parsed.data }) }
        : {};
      const [updated] = await db.update(pasivoEntries)
        .set({
          ...parsed.data,
          ...monetaryValues,
          overrideManual: true,
          updatedAt: new Date(),
          updatedBy: req.user!.id,
        })
        .where(eq(pasivoEntries.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      await db.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "pasivo_entry", entityId: id, action: "historical_entry_edited", beforeData: existing, afterData: updated, actorUserId: req.user!.id });
      await refreshNativeFacts(existing.periodKey);
      if (updated.periodKey !== existing.periodKey) await refreshNativeFacts(updated.periodKey);
      res.json(updated);
    } catch (error: any) {
      res.status(error.statusCode ?? 500).json({ message: error.message });
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
      await refreshNativeFacts(created.periodKey);
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
      await refreshNativeFacts(existing.periodKey);
      if (updated.periodKey !== existing.periodKey) await refreshNativeFacts(updated.periodKey);
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
      const cutover = await getCutoverDate();
      const rawOpeningDate = req.body?.openingBalanceDate;
      const openingBalanceDate = rawOpeningDate
        ? new Date(`${String(rawOpeningDate).slice(0, 10)}T12:00:00.000Z`)
        : cutover ? new Date(`${cutover}-01T12:00:00.000Z`) : new Date();
      const parsed = insertFinancialAccountSchema.safeParse({ ...req.body, openingBalanceDate });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const created = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('financial-accounts'))`);
        await prepareBalanceMutation(tx, openingBalanceDate);
        const [created] = await tx.insert(financialAccounts).values(parsed.data).returning();
        await tx.insert(financialAuditEvents).values({ entityType: "financial_account", entityId: created.id, action: "created", afterData: created, actorUserId: req.user!.id });
        return created;
      });
      res.status(201).json(created);
    } catch (error: any) { res.status(error?.code === "23505" ? 409 : error.statusCode ?? 500).json({ message: error?.code === "23505" ? "Ya existe una cuenta con ese nombre y moneda." : error.message }); }
  });

  router.patch("/financial-accounts/:id", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const rawOpeningDate = req.body?.openingBalanceDate;
      const parsed = insertFinancialAccountSchema.partial().safeParse({ ...req.body, ...(rawOpeningDate ? { openingBalanceDate: new Date(`${String(rawOpeningDate).slice(0, 10)}T12:00:00.000Z`) } : {}) });
      if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ message: "Datos inválidos." });
      const updated = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('financial-accounts'))`);
        const [existing] = await tx.select().from(financialAccounts).where(eq(financialAccounts.id, id)).limit(1);
        if (!existing) throw Object.assign(new Error("Cuenta no encontrada."), { statusCode: 404 });
        const effectiveDate = parsed.data.openingBalanceDate ?? existing.openingBalanceDate ?? new Date();
        await prepareBalanceMutation(tx, effectiveDate);
        const [updated] = await tx.update(financialAccounts).set({ ...parsed.data, updatedAt: new Date() }).where(eq(financialAccounts.id, id)).returning();
        await tx.insert(financialAuditEvents).values({ entityType: "financial_account", entityId: id, action: "updated", beforeData: existing, afterData: updated, actorUserId: req.user!.id });
        return updated;
      });
      res.json(updated);
    } catch (error: any) { res.status(error.statusCode ?? 500).json({ message: error.message }); }
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
      const updated = await db.transaction(async (tx) => {
        const [peek] = await tx.select({ periodKey: cashflowTransactions.periodKey }).from(cashflowTransactions).where(eq(cashflowTransactions.id, id)).limit(1);
        if (!peek) throw Object.assign(new Error("Movimiento no encontrado."), { statusCode: 404 });
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + peek.periodKey}))`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-cashflow:' + id}))`);
        const [existing] = await tx.select().from(cashflowTransactions).where(eq(cashflowTransactions.id, id)).limit(1);
        if (!existing) throw Object.assign(new Error("Movimiento no encontrado."), { statusCode: 404 });
        const [close] = await tx.select({ id: financialClosePeriods.id, status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, existing.periodKey)).limit(1);
        if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${existing.periodKey} no admite cambios.`), { statusCode: 409 });
        if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.id, close.id));
        const [updated] = await tx.update(cashflowTransactions).set({ reconciliationStatus: input.data.status, updatedBy: req.user!.id, updatedAt: new Date() }).where(eq(cashflowTransactions.id, id)).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "cashflow_transaction", entityId: id, action: "reconciled", beforeData: existing, afterData: { reconciliationStatus: input.data.status }, actorUserId: req.user!.id, reason: input.data.note });
        return updated;
      });
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
      const cutover = await getCutoverDate();
      const useNativeLedger = Boolean(cutover && date.slice(0, 7) >= cutover);
      const [rows, accounts, rates] = await Promise.all([
        db.select().from(cashflowTransactions).where(and(sql`${cashflowTransactions.fecha} <= ${cutoff}`, isNull(cashflowTransactions.voidedAt), useNativeLedger ? sql`${cashflowTransactions.source} <> 'excel'` : sql`true`)).orderBy(asc(cashflowTransactions.fecha)),
        db.select().from(financialAccounts).where(and(eq(financialAccounts.isActive, true), sql`(${financialAccounts.openingBalanceDate} IS NULL OR ${financialAccounts.openingBalanceDate} <= ${cutoff})`)),
        db.select().from(exchangeRates).where(and(eq(exchangeRates.year, cutoff.getUTCFullYear()), eq(exchangeRates.month, cutoff.getUTCMonth() + 1), eq(exchangeRates.isActive, true))).orderBy(desc(exchangeRates.updatedAt)).limit(1),
      ]);

      // Saldos acumulados por banco, calculados sumando ingresos/egresos hasta la fecha
      // (las columnas saldo* nunca se populan en la importación, así que se computa acá).
      const fx = Number(rates[0]?.rate ?? 0);
      const balances: Record<string, number> = {};
      const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
      const accountByLabel = new Map(accounts.flatMap((account) => [account.name, account.bankName].filter(Boolean).map((label) => [String(label).toLocaleLowerCase(), account] as const)));
      for (const account of accounts) {
        const opening = Number(account.openingBalance ?? 0);
        balances[account.name] = account.currency === "ARS" && fx > 0 ? opening / fx : opening;
      }
      for (const r of rows) {
        const account = r.accountId ? accounts.find((candidate) => candidate.id === r.accountId) : accountByLabel.get(String(r.banco ?? "").toLocaleLowerCase());
        if (account?.openingBalanceDate && r.fecha < account.openingBalanceDate) continue;
        const amt = parseFloat(r.montoUSD ?? "") || ((parseFloat(r.montoARS ?? "") || 0) / (parseFloat(r.cotizacion ?? "") || fx || 1));
        const signed = r.tipoMovimiento === "Egreso" ? -amt : amt;
        const banco = (r.accountId ? accountNames.get(r.accountId) : null) || r.banco || "Otros";
        balances[banco] = (balances[banco] ?? 0) + signed;
      }
      const totalUSD = Object.values(balances).reduce((sum, value) => sum + value, 0);
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
      const { existing, updated } = await db.transaction(async (tx) => {
        const [peek] = await tx.select({ periodKey: activoEntries.periodKey }).from(activoEntries).where(eq(activoEntries.id, id)).limit(1);
        if (!peek) throw Object.assign(new Error("Activo no encontrado."), { statusCode: 404 });
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + peek.periodKey}))`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-document:receivable:' + id}))`);
        const [existing] = await tx.select().from(activoEntries).where(eq(activoEntries.id, id)).limit(1);
        if (!existing) throw Object.assign(new Error("Activo no encontrado."), { statusCode: 404 });
        const [close] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, existing.periodKey)).limit(1);
        if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${existing.periodKey} no admite cambios.`), { statusCode: 409 });
        if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, existing.periodKey));
        const applications = await tx.select({ id: financialDocumentApplications.id }).from(financialDocumentApplications).where(and(eq(financialDocumentApplications.activoEntryId, id), isNull(financialDocumentApplications.voidedAt))).limit(1);
        if (applications.length) throw Object.assign(new Error("Anulá primero el cobro aplicado a esta factura."), { statusCode: 409 });
        const [updated] = await tx.update(activoEntries).set({ status: "VOID", voidedAt: new Date(), voidedBy: req.user!.id, voidReason: reason, updatedBy: req.user!.id, updatedAt: new Date() }).where(and(eq(activoEntries.id, id), isNull(activoEntries.voidedAt))).returning();
        const revenueLink = await revenueLinkForDocument(tx, existing.externalId);
        if (revenueLink?.type === "revenue_event" && revenueLink.id) await tx.update(revenueEvents).set({ status: "cancelled", updatedAt: new Date() }).where(eq(revenueEvents.id, revenueLink.id));
        await tx.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "activo_entry", entityId: id, action: "voided", beforeData: existing, afterData: updated, actorUserId: req.user!.id, reason });
        return { existing, updated };
      });
      await refreshNativeFacts(existing.periodKey);
      res.json(updated ?? existing);
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  router.post("/pasivo/:id/void", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id); const { reason } = reasonSchema.parse(req.body);
      const { existing, updated } = await db.transaction(async (tx) => {
        const [peek] = await tx.select({ periodKey: pasivoEntries.periodKey }).from(pasivoEntries).where(eq(pasivoEntries.id, id)).limit(1);
        if (!peek) throw Object.assign(new Error("Pasivo no encontrado."), { statusCode: 404 });
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + peek.periodKey}))`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-document:payable:' + id}))`);
        const [existing] = await tx.select().from(pasivoEntries).where(eq(pasivoEntries.id, id)).limit(1);
        if (!existing) throw Object.assign(new Error("Pasivo no encontrado."), { statusCode: 404 });
        const [close] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, existing.periodKey)).limit(1);
        if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${existing.periodKey} no admite cambios.`), { statusCode: 409 });
        if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, existing.periodKey));
        const applications = await tx.select({ id: financialDocumentApplications.id }).from(financialDocumentApplications).where(and(eq(financialDocumentApplications.pasivoEntryId, id), isNull(financialDocumentApplications.voidedAt))).limit(1);
        if (applications.length) throw Object.assign(new Error("Anulá primero el pago aplicado a esta factura."), { statusCode: 409 });
        const [updated] = await tx.update(pasivoEntries).set({ status: "VOID", voidedAt: new Date(), voidedBy: req.user!.id, voidReason: reason, updatedBy: req.user!.id, updatedAt: new Date() }).where(and(eq(pasivoEntries.id, id), isNull(pasivoEntries.voidedAt))).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "pasivo_entry", entityId: id, action: "voided", beforeData: existing, afterData: updated, actorUserId: req.user!.id, reason });
        return { existing, updated };
      });
      await refreshNativeFacts(existing.periodKey);
      res.json(updated ?? existing);
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  router.post("/cashflow/:id/void", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id); const { reason } = reasonSchema.parse(req.body);
      const result = await db.transaction(async (tx) => {
        const [peek] = await tx.select().from(cashflowTransactions).where(eq(cashflowTransactions.id, id)).limit(1);
        if (!peek) throw Object.assign(new Error("Movimiento no encontrado."), { statusCode: 404 });

        // Una transferencia es un único hecho económico expresado en dos patas.
        // Si se anula una, se anulan ambas para no fabricar ingresos/egresos.
        const targets = peek.transferGroupId
          ? await tx.select().from(cashflowTransactions).where(and(eq(cashflowTransactions.transferGroupId, peek.transferGroupId), isNull(cashflowTransactions.voidedAt)))
          : [peek];
        const targetIds = targets.map((row) => row.id).sort((a, b) => a - b);
        const periods = [...new Set(targets.map((row) => row.periodKey))].sort();
        for (const periodKey of periods) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + periodKey}))`);
          const [close] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
          if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${periodKey} no admite cambios.`), { statusCode: 409 });
          if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, periodKey));
        }
        for (const targetId of targetIds) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-cashflow:' + targetId}))`);

        const applications = targetIds.length
          ? await tx.select().from(financialDocumentApplications).where(and(inArray(financialDocumentApplications.cashflowTransactionId, targetIds), isNull(financialDocumentApplications.voidedAt)))
          : [];
        const receivableIds = [...new Set(applications.flatMap((application) => application.activoEntryId ? [application.activoEntryId] : []))].sort((a, b) => a - b);
        const payableIds = [...new Set(applications.flatMap((application) => application.pasivoEntryId ? [application.pasivoEntryId] : []))].sort((a, b) => a - b);
        for (const documentId of receivableIds) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-document:receivable:' + documentId}))`);
        for (const documentId of payableIds) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-document:payable:' + documentId}))`);

        const now = new Date();
        if (applications.length) {
          await tx.update(financialDocumentApplications).set({ voidedAt: now, voidedBy: req.user!.id }).where(inArray(financialDocumentApplications.id, applications.map((application) => application.id)));
        }

        for (const documentId of receivableIds) {
          const [document] = await tx.select().from(activoEntries).where(eq(activoEntries.id, documentId)).limit(1);
          if (!document || document.voidedAt) continue;
          const [applicationTotals] = await tx.select({
            applied: sql<number>`COALESCE(sum(${financialDocumentApplications.amountOriginal}), 0)::float`,
            lastAppliedAt: sql<Date | null>`max(${financialDocumentApplications.appliedAt})`,
          }).from(financialDocumentApplications).where(and(eq(financialDocumentApplications.activoEntryId, documentId), isNull(financialDocumentApplications.voidedAt)));
          const gross = Number(document.grossAmount ?? document.originalAmount ?? document.montoUSD ?? document.montoARS ?? 0);
          const applied = Number(applicationTotals?.applied ?? 0);
          const outstanding = Math.max(0, gross - applied);
          const status = outstanding <= 0.01 ? "PAID" : applied > 0 ? "PARTIAL" : "PENDING";
          const [updatedDocument] = await tx.update(activoEntries).set({ outstandingAmount: String(outstanding), status, cobradoAlCierre: status === "PAID", fechaPago: applicationTotals?.lastAppliedAt ?? null, updatedBy: req.user!.id, updatedAt: now }).where(eq(activoEntries.id, documentId)).returning();
          const revenueLink = await revenueLinkForDocument(tx, document.externalId);
          if (revenueLink?.id) await tx.update(revenueEvents).set({ collectionPeriodActual: status === "PAID" && applicationTotals?.lastAppliedAt ? new Date(applicationTotals.lastAppliedAt).toISOString().slice(0, 7) : null, updatedAt: now }).where(eq(revenueEvents.id, revenueLink.id));
          await tx.insert(financialAuditEvents).values({ periodKey: document.periodKey, entityType: "activo_entry", entityId: documentId, action: "payment_application_voided", beforeData: document, afterData: updatedDocument, actorUserId: req.user!.id, reason });
        }

        for (const documentId of payableIds) {
          const [document] = await tx.select().from(pasivoEntries).where(eq(pasivoEntries.id, documentId)).limit(1);
          if (!document || document.voidedAt) continue;
          const [applicationTotals] = await tx.select({
            applied: sql<number>`COALESCE(sum(${financialDocumentApplications.amountOriginal}), 0)::float`,
            lastAppliedAt: sql<Date | null>`max(${financialDocumentApplications.appliedAt})`,
          }).from(financialDocumentApplications).where(and(eq(financialDocumentApplications.pasivoEntryId, documentId), isNull(financialDocumentApplications.voidedAt)));
          const gross = Number(document.grossAmount ?? document.originalAmount ?? document.montoUSD ?? document.montoARS ?? 0);
          const applied = Number(applicationTotals?.applied ?? 0);
          const outstanding = Math.max(0, gross - applied);
          const status = outstanding <= 0.01 ? "PAID" : applied > 0 ? "PARTIAL" : "PENDING";
          const [updatedDocument] = await tx.update(pasivoEntries).set({ outstandingAmount: String(outstanding), status, pagadoAlCierre: status === "PAID", fechaPago: applicationTotals?.lastAppliedAt ?? null, updatedBy: req.user!.id, updatedAt: now }).where(eq(pasivoEntries.id, documentId)).returning();
          await tx.insert(financialAuditEvents).values({ periodKey: document.periodKey, entityType: "pasivo_entry", entityId: documentId, action: "payment_application_voided", beforeData: document, afterData: updatedDocument, actorUserId: req.user!.id, reason });
        }

        const updatedRows = targetIds.length
          ? await tx.update(cashflowTransactions).set({ voidedAt: now, voidedBy: req.user!.id, voidReason: reason, updatedBy: req.user!.id, updatedAt: now }).where(and(inArray(cashflowTransactions.id, targetIds), isNull(cashflowTransactions.voidedAt))).returning()
          : [];
        for (const existing of targets) {
          const updated = updatedRows.find((row) => row.id === existing.id);
          await tx.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "cashflow_transaction", entityId: existing.id, action: "voided", beforeData: existing, afterData: updated, actorUserId: req.user!.id, reason });
        }
        return { primary: updatedRows.find((row) => row.id === id) ?? peek, periods };
      });
      for (const periodKey of result.periods) await refreshNativeFacts(periodKey);
      res.json(result.primary);
    } catch (error: any) { res.status(error.statusCode ?? 400).json({ message: error.message }); }
  });

  router.post("/provisions/:id/approve", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { existing, updated } = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-provision:' + id}))`);
        const [existing] = await tx.select().from(provisionEntries).where(eq(provisionEntries.id, id)).limit(1);
        if (!existing) throw Object.assign(new Error("Provisión no encontrada."), { statusCode: 404 });
        if (existing.status !== "PROPOSED") return { existing, updated: existing };
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + existing.periodKey}))`);
        const [close] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, existing.periodKey)).limit(1);
        if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${existing.periodKey} no admite cambios.`), { statusCode: 409 });
        if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, existing.periodKey));
        const [updated] = await tx.update(provisionEntries).set({ status: "APPROVED", approvedBy: req.user!.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(provisionEntries.id, id)).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: existing.periodKey, entityType: "provision_entry", entityId: id, action: "approved", beforeData: existing, afterData: updated, actorUserId: req.user!.id });
        return { existing, updated };
      });
      await refreshNativeFacts(existing.periodKey);
      res.json(updated);
    } catch (error: any) { res.status(error.statusCode ?? 500).json({ message: error.message }); }
  });

  router.post("/provisions/:id/release", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = z.object({ amount: z.coerce.number().positive(), periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), note: z.string().trim().min(5).max(2000) }).parse(req.body);
      const { existing, updated, movement } = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-provision:' + id}))`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'financial-period:' + input.periodKey}))`);
        const [close] = await tx.select({ status: financialClosePeriods.status }).from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, input.periodKey)).limit(1);
        if (["IN_REVIEW", "CLOSED"].includes(close?.status ?? "")) throw Object.assign(new Error(`El período ${input.periodKey} no admite cambios.`), { statusCode: 409 });
        if (close?.status === "PRE_CLOSE") await tx.update(financialClosePeriods).set({ status: "OPEN", updatedAt: new Date() }).where(eq(financialClosePeriods.periodKey, input.periodKey));
        const [existing] = await tx.select().from(provisionEntries).where(eq(provisionEntries.id, id)).limit(1);
        if (!existing) throw Object.assign(new Error("Provisión no encontrada."), { statusCode: 404 });
        if (!["APPROVED", "ACTIVE"].includes(existing.status)) throw Object.assign(new Error("La provisión debe estar aprobada y activa para liberarla."), { statusCode: 409 });
        if (input.periodKey < existing.periodKey) throw Object.assign(new Error("La liberación no puede ser anterior a la provisión."), { statusCode: 400 });
        const remaining = Number(existing.remainingAmount ?? existing.montoProvision ?? 0);
        if (input.amount > remaining) throw Object.assign(new Error("La liberación supera el saldo de la provisión."), { statusCode: 400 });
        const next = remaining - input.amount;
        const [updated] = await tx.update(provisionEntries).set({ remainingAmount: String(next), unwoundAmount: String(Number(existing.unwoundAmount ?? 0) + input.amount), status: next === 0 ? "RELEASED" : "ACTIVE", updatedAt: new Date() }).where(eq(provisionEntries.id, id)).returning();
        const [movement] = await tx.insert(provisionMovements).values({ provisionId: id, periodKey: input.periodKey, movementType: "release", amount: String(-input.amount), currency: existing.currency, note: input.note, createdBy: req.user!.id }).returning();
        await tx.insert(financialAuditEvents).values({ periodKey: input.periodKey, entityType: "provision_entry", entityId: id, action: "released", beforeData: existing, afterData: { provision: updated, movement }, actorUserId: req.user!.id, reason: input.note });
        return { existing, updated, movement };
      });
      if (existing.periodKey !== input.periodKey) await refreshNativeFacts(existing.periodKey);
      await refreshNativeFacts(input.periodKey);
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

      if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return res.status(400).json({ message: "period inválido" });
      const totalsResult = await db.execute(sql`
        SELECT COALESCE(sum(f.revenue_usd),0)::float revenue, COALESCE(sum(f.cost_usd),0)::float cost
        FROM fact_rc_month f
        JOIN active_projects p ON p.id=f.project_id
        WHERE p.client_id=${clientId} ${period ? sql`AND f.period_key=${period}` : sql``}
      `);
      const totalsRows = Array.isArray(totalsResult) ? totalsResult : (totalsResult as any).rows;
      const revenue = Number(totalsRows?.[0]?.revenue ?? 0);
      const cost = Number(totalsRows?.[0]?.cost ?? 0);
      const markup = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
      const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
      const teamResult = await db.execute(sql`
        SELECT COALESCE(person.name,'Sin asignar') persona,
               COALESCE(person.current_role, person.legacy_role) subtipo,
               COALESCE(sum(l.cost_usd),0)::float costo_usd
        FROM fact_labor_month l
        JOIN active_projects p ON p.id=l.project_id
        LEFT JOIN personnel person ON person.id=l.person_id
        WHERE p.client_id=${clientId} ${period ? sql`AND l.period_key=${period}` : sql``}
        GROUP BY person.name, person.current_role, person.legacy_role
        ORDER BY 3 DESC
      `);
      const teamRows = Array.isArray(teamResult) ? teamResult : (teamResult as any).rows;

      res.json({
        client: { id: clientId, name: client.name },
        period: period || "all",
        revenue,
        cost,
        markup: Math.round(markup * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        teamBreakdown: (teamRows ?? []).map((row: any) => ({ persona: row.persona, subtipo: row.subtipo, costoUSD: Number(row.costo_usd) || 0 })),
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
  // excepción explícita: un admin pide un rango histórico anterior al
  // cutover y se trae esos meses tal cual están en la hoja "Activo"/
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
      const cutoverDate = await getCutoverDate();
      if (cutoverDate && to >= cutoverDate) {
        return res.status(400).json({ message: `El backfill sólo admite períodos anteriores al corte ${cutoverDate}. Desde ese mes la fuente es Mind.` });
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
