import { Router } from "express";
import { z } from "zod";
import { db, pool } from "./db";
import { oneOffItems, dataQualityFindings, insertOneOffItemSchema } from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { monthRange, getCurrentMonthKey, isValidMonthKey } from "./services/dates";
import { getRevenueByBasis, REVENUE_BASIS_LABELS, REVENUE_BASIS_DESCRIPTIONS } from "./services/revenue-basis";
import { getFinancialIntelligence, getYearSnapshot, buildCoverage } from "./services/financial-intelligence";
import { runAllDetectors } from "./services/data-quality";

/**
 * API de inteligencia financiera.
 *
 * Regla de diseño: ningún endpoint devuelve una sola base de ingreso. La
 * diferencia entre facturación, devengado y cobranza es la información, no un
 * detalle de implementación que el front pueda elegir ignorar.
 */
export function createFinancialIntelligenceRouter(requireAuth: any) {
  const router = Router();

  const parseYear = (raw: unknown): number | null => {
    const year = Number(raw ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2020 || year > 2100) return null;
    return year;
  };

  // Payload completo del dashboard: tres bases, resultado, neto, puente y hallazgos.
  router.get("/", requireAuth, async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) {
      return res.status(400).json({ error: "year inválido" });
    }
    try {
      const payload = await getFinancialIntelligence(year);
      res.json({
        ...payload,
        basisLabels: REVENUE_BASIS_LABELS,
        basisDescriptions: REVENUE_BASIS_DESCRIPTIONS,
      });
    } catch (error: any) {
      console.error("[financial-intelligence] error:", error);
      res.status(500).json({ error: "No se pudo construir el resumen financiero" });
    }
  });

  // Serie mensual de las tres bases.
  router.get("/basis", requireAuth, async (req, res) => {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!isValidMonthKey(from) || !isValidMonthKey(to)) {
      return res.status(400).json({ error: "from y to deben usar el formato YYYY-MM" });
    }
    const periods = monthRange(from, to);
    if (periods.length === 0) {
      return res.status(400).json({ error: "El rango está invertido" });
    }
    if (periods.length > 60) {
      return res.status(400).json({ error: "El rango no puede superar 60 meses" });
    }

    try {
      const rows = await getRevenueByBasis(periods, {
        includePipeline: req.query.includePipeline === "true",
        weightByProbability: req.query.weightByProbability === "true",
        clientName: typeof req.query.client === "string" ? req.query.client : undefined,
      });
      res.json({ periods: rows, labels: REVENUE_BASIS_LABELS });
    } catch (error: any) {
      console.error("[financial-intelligence/basis] error:", error);
      res.status(500).json({ error: "No se pudieron calcular las bases de ingreso" });
    }
  });

  // Ingreso cargado contra costo proyectado, mes a mes.
  // Responde "cómo quedan gastos vs ventas los próximos meses".
  router.get("/coverage", requireAuth, async (req, res) => {
    const from = String(req.query.from ?? getCurrentMonthKey());
    const year = parseYear(req.query.year ?? from.slice(0, 4));
    if (!isValidMonthKey(from) || year === null) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }
    const periods = monthRange(from, `${year}-12`);
    if (periods.length === 0) {
      return res.json({ months: [], totalGapUsd: 0, avgMonthlyGapUsd: 0 });
    }

    try {
      const [basis, costResult] = await Promise.all([
        getRevenueByBasis(periods),
        // Costo total del período: directos + overhead. Excluye provisiones,
        // igual que el EBIT.
        pool.query(
          `SELECT period_key,
                  (COALESCE(direct_usd,0) + COALESCE(indirect_usd,0))::float AS total
             FROM fact_cost_month
            WHERE period_key = ANY($1::text[])`,
          [periods],
        ),
      ]);

      const costByPeriod = new Map<string, number>();
      for (const row of costResult.rows) {
        costByPeriod.set(row.period_key, Number(row.total) || 0);
      }

      res.json(buildCoverage(basis.map((b) => ({
        periodKey: b.periodKey,
        revenueUsd: b.devengado,
        costUsd: costByPeriod.get(b.periodKey) ?? 0,
      }))));
    } catch (error: any) {
      console.error("[financial-intelligence/coverage] error:", error);
      res.status(500).json({ error: "No se pudo calcular la cobertura" });
    }
  });

  // Snapshot de un ejercicio.
  router.get("/year/:year", requireAuth, async (req, res) => {
    const year = parseYear(req.params.year);
    if (year === null) return res.status(400).json({ error: "year inválido" });
    try {
      res.json(await getYearSnapshot(year));
    } catch (error: any) {
      console.error("[financial-intelligence/year] error:", error);
      res.status(500).json({ error: "No se pudo construir el snapshot" });
    }
  });

  // ─── Hallazgos de calidad de dato ──────────────────────────────────────────

  router.get("/findings", requireAuth, async (req, res) => {
    const statuses = typeof req.query.status === "string"
      ? req.query.status.split(",").filter(Boolean)
      : ["open"];
    try {
      const rows = await db
        .select()
        .from(dataQualityFindings)
        .where(inArray(dataQualityFindings.status, statuses))
        .orderBy(desc(dataQualityFindings.lastSeenAt));
      // Más severo primero: es lo que el CEO tiene que ver antes de presentar.
      const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      rows.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
      res.json(rows);
    } catch (error: any) {
      console.error("[financial-intelligence/findings] error:", error);
      res.status(500).json({ error: "No se pudieron leer los hallazgos" });
    }
  });

  const findingStatusSchema = z.object({
    status: z.enum(["open", "acknowledged", "resolved", "muted"]),
    mutedUntil: z.string().datetime().optional(),
  });

  router.patch("/findings/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id inválido" });
    }
    const parsed = findingStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      const [updated] = await db
        .update(dataQualityFindings)
        .set({
          status: parsed.data.status,
          mutedUntil: parsed.data.mutedUntil ? new Date(parsed.data.mutedUntil) : null,
          resolvedAt: parsed.data.status === "resolved" ? new Date() : null,
        })
        .where(eq(dataQualityFindings.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Hallazgo no encontrado" });
      res.json(updated);
    } catch (error: any) {
      console.error("[financial-intelligence/findings PATCH] error:", error);
      res.status(500).json({ error: "No se pudo actualizar el hallazgo" });
    }
  });

  router.post("/detectors/run", requireAuth, async (req, res) => {
    const year = parseYear(req.body?.year);
    if (year === null) return res.status(400).json({ error: "year inválido" });
    try {
      const findings = await runAllDetectors({ year, persist: true });
      res.json({ count: findings.length, findings });
    } catch (error: any) {
      console.error("[financial-intelligence/detectors] error:", error);
      res.status(500).json({ error: "No se pudieron correr los detectores" });
    }
  });

  // ─── Partidas no recurrentes ───────────────────────────────────────────────

  router.get("/one-offs", requireAuth, async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ error: "year inválido" });
    try {
      const rows = await db
        .select()
        .from(oneOffItems)
        .where(inArray(oneOffItems.periodKey, monthRange(`${year}-01`, `${year}-12`)))
        .orderBy(oneOffItems.periodKey);
      res.json(rows);
    } catch (error: any) {
      console.error("[financial-intelligence/one-offs] error:", error);
      res.status(500).json({ error: "No se pudieron leer las partidas" });
    }
  });

  router.post("/one-offs", requireAuth, async (req, res) => {
    const parsed = insertOneOffItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    if (!isValidMonthKey(parsed.data.periodKey)) {
      return res.status(400).json({ error: "periodKey debe usar el formato YYYY-MM" });
    }
    try {
      const [created] = await db.insert(oneOffItems).values({
        ...parsed.data,
        confirmedBy: (req as any).user?.id ?? null,
      }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error("[financial-intelligence/one-offs POST] error:", error);
      res.status(500).json({ error: "No se pudo registrar la partida" });
    }
  });

  router.delete("/one-offs/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id inválido" });
    }
    try {
      const [deleted] = await db.delete(oneOffItems).where(eq(oneOffItems.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "Partida no encontrada" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[financial-intelligence/one-offs DELETE] error:", error);
      res.status(500).json({ error: "No se pudo borrar la partida" });
    }
  });

  return router;
}
