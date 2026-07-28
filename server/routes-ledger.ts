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
} from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { storage } from "./storage";

export function createLedgerRouter(requireAuth: any) {
  const router = Router();
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
    const usd = parseFloat(row.montoUSD ?? "");
    if (Number.isFinite(usd)) return String(usd);
    const ars = parseFloat(row.montoARS ?? "");
    const fx = parseFloat(row.cotizacion ?? "");
    return Number.isFinite(ars) && Number.isFinite(fx) && fx > 0
      ? String(ars / fx)
      : null;
  };

  // ==================== ACTIVO ====================

  router.get("/activo", requireAuth, async (req, res) => {
    try {
      const pagination = parseLedgerQuery(req.query);
      if ("error" in pagination) return res.status(400).json({ message: pagination.error });
      const { period, estado, cliente } = req.query as Record<string, string>;
      const { page, pageSize } = pagination;
      const conditions: any[] = [eq(activoEntries.periodKey, pagination.period)];
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

  router.get("/activo/summary", requireAuth, async (req, res) => {
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
      }).from(activoEntries).where(eq(activoEntries.periodKey, parsed.period));
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

  router.post("/activo", requireAuth, async (req, res) => {
    try {
      const parsed = insertActivoEntrySchema.safeParse({ ...req.body, overrideManual: true });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const values = {
        ...parsed.data,
        montoTotalUSD: normalizedUSDForWrite(parsed.data),
      };
      const [created] = await db.insert(activoEntries).values(values).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/activo/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertActivoEntrySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [existing] = await db.select().from(activoEntries).where(eq(activoEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
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

  router.get("/pasivo", requireAuth, async (req, res) => {
    try {
      const pagination = parseLedgerQuery(req.query);
      if ("error" in pagination) return res.status(400).json({ message: pagination.error });
      const { period, subtipo, estado } = req.query as Record<string, string>;
      const { page, pageSize } = pagination;
      const conditions: any[] = [eq(pasivoEntries.periodKey, pagination.period)];
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

  router.get("/pasivo/summary", requireAuth, async (req, res) => {
    try {
      const parsed = parseLedgerQuery(req.query);
      if ("error" in parsed) return res.status(400).json({ message: parsed.error });
      const periodCondition = eq(pasivoEntries.periodKey, parsed.period);
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

  router.post("/pasivo", requireAuth, async (req, res) => {
    try {
      const parsed = insertPasivoEntrySchema.safeParse({ ...req.body, overrideManual: true });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const values = {
        ...parsed.data,
        montoTotalUSD: normalizedUSDForWrite(parsed.data),
      };
      const [created] = await db.insert(pasivoEntries).values(values).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/pasivo/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertPasivoEntrySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [existing] = await db.select().from(pasivoEntries).where(eq(pasivoEntries.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Not found" });
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

  router.get("/provisions", requireAuth, async (req, res) => {
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

  router.post("/provisions", requireAuth, async (req, res) => {
    try {
      const parsed = insertProvisionEntrySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [created] = await db.insert(provisionEntries).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/provisions/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertProvisionEntrySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [updated] = await db.update(provisionEntries)
        .set(parsed.data)
        .where(eq(provisionEntries.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CASHFLOW ====================

  router.get("/cashflow", requireAuth, async (req, res) => {
    try {
      const { period, banco, tipo } = req.query as Record<string, string>;
      const conditions: any[] = [];
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

  router.post("/cashflow", requireAuth, async (req, res) => {
    try {
      const parsed = insertCashflowTransactionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [created] = await db.insert(cashflowTransactions).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.patch("/cashflow/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = insertCashflowTransactionSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const [updated] = await db.update(cashflowTransactions)
        .set(parsed.data)
        .where(eq(cashflowTransactions.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/cashflow/balance", requireAuth, async (req, res) => {
    try {
      const { date } = req.query as Record<string, string>;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "date param required as YYYY-MM-DD" });
      }
      const cutoff = new Date(date + "T23:59:59Z");
      const rows = await db.select()
        .from(cashflowTransactions)
        .where(sql`${cashflowTransactions.fecha} <= ${cutoff}`)
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

  router.get("/cashflow/summary", requireAuth, async (req, res) => {
    try {
      const { year } = req.query as Record<string, string>;
      const conditions: any[] = [];
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

  // ==================== P&L POR CLIENTE ====================

  router.get("/clients/:id/pnl", requireAuth, async (req, res) => {
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

  router.get("/admin/alias-coverage", requireAuth, async (req, res) => {
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

  return router;
}
