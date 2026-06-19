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
} from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { storage } from "./storage";

export function createLedgerRouter(requireAuth: any) {
  const router = Router();

  // ==================== ACTIVO ====================

  router.get("/activo", requireAuth, async (req, res) => {
    try {
      const { period, estado, cliente } = req.query as Record<string, string>;
      const conditions: any[] = [];
      if (period) conditions.push(eq(activoEntries.periodKey, period));
      if (estado === "cobrado") conditions.push(eq(activoEntries.cobradoAlCierre, true));
      if (estado === "pendiente") conditions.push(eq(activoEntries.cobradoAlCierre, false));
      if (estado === "vencido") conditions.push(eq(activoEntries.vencido, true));
      if (cliente) conditions.push(eq(activoEntries.clienteNombre, cliente));

      const rows = conditions.length
        ? await db.select().from(activoEntries).where(and(...conditions)).orderBy(desc(activoEntries.createdAt))
        : await db.select().from(activoEntries).orderBy(desc(activoEntries.createdAt));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/activo/summary", requireAuth, async (req, res) => {
    try {
      const { period } = req.query as Record<string, string>;
      const conditions: any[] = [];
      if (period) conditions.push(eq(activoEntries.periodKey, period));

      const rows = conditions.length
        ? await db.select().from(activoEntries).where(and(...conditions))
        : await db.select().from(activoEntries);

      const total = rows.reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0"), 0);
      const cobrado = rows.filter(r => r.cobradoAlCierre).reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0"), 0);
      const vencido = rows.filter(r => r.vencido && !r.cobradoAlCierre).reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0"), 0);
      const pendiente = total - cobrado;

      res.json({ total, cobrado, pendiente, vencido, count: rows.length });
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
      const [updated] = await db.update(activoEntries)
        .set({ ...parsed.data, overrideManual: true, updatedAt: new Date() })
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
      const { period, subtipo, estado } = req.query as Record<string, string>;
      const conditions: any[] = [];
      if (period) conditions.push(eq(pasivoEntries.periodKey, period));
      if (subtipo) conditions.push(eq(pasivoEntries.subtipoCosto, subtipo));
      if (estado === "pagado") conditions.push(eq(pasivoEntries.pagadoAlCierre, true));
      if (estado === "pendiente") conditions.push(eq(pasivoEntries.pagadoAlCierre, false));
      if (estado === "vencido") conditions.push(eq(pasivoEntries.vencido, true));

      const rows = conditions.length
        ? await db.select().from(pasivoEntries).where(and(...conditions)).orderBy(desc(pasivoEntries.createdAt))
        : await db.select().from(pasivoEntries).orderBy(desc(pasivoEntries.createdAt));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/pasivo/summary", requireAuth, async (req, res) => {
    try {
      const { period } = req.query as Record<string, string>;
      const conditions: any[] = [];
      if (period) conditions.push(eq(pasivoEntries.periodKey, period));

      const rows = conditions.length
        ? await db.select().from(pasivoEntries).where(and(...conditions))
        : await db.select().from(pasivoEntries);

      const total = rows.reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0"), 0);
      const pagado = rows.filter(r => r.pagadoAlCierre).reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0"), 0);
      const vencido = rows.filter(r => r.vencido && !r.pagadoAlCierre).reduce((s, r) => s + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0"), 0);
      const pendiente = total - pagado;

      const bySubtipo: Record<string, number> = {};
      for (const r of rows) {
        const key = r.subtipoCosto || "Sin subtipo";
        bySubtipo[key] = (bySubtipo[key] || 0) + parseFloat(r.montoTotalUSD ?? r.montoUSD ?? "0");
      }

      res.json({ total, pagado, pendiente, vencido, bySubtipo, count: rows.length });
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
      const [updated] = await db.update(pasivoEntries)
        .set({ ...parsed.data, overrideManual: true, updatedAt: new Date() })
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
        .orderBy(desc(cashflowTransactions.fecha))
        .limit(1000);

      // Saldos acumulados por banco (last known balance)
      const balances: Record<string, number> = { Santander: 0, BOA: 0, Caja: 0 };
      for (const r of rows) {
        if (r.banco && r.saldoSantander) balances.Santander = parseFloat(r.saldoSantander);
        if (r.banco && r.saldoBOA) balances.BOA = parseFloat(r.saldoBOA);
        if (r.banco && r.saldoCaja) balances.Caja = parseFloat(r.saldoCaja);
      }
      const totalUSD = Object.values(balances).reduce((s, v) => s + v, 0);
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
