import { Router, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { z } from "zod";
import { db } from "./db";
import {
  financialAuditEvents,
  financialCloseChecks,
  financialClosePeriods,
  financialIntakeItems,
} from "@shared/schema";
import { requirePermission } from "./middleware/requirePermission";
import { extractFinancialIntake, financialExtractionSchema, financialMissingFields } from "./services/financial-intake-extractor";
import {
  deleteFinancialIntakeFile,
  financialIntakeUpload,
  readFinancialIntakeFile,
  storeFinancialIntakeFile,
} from "./services/financial-intake-files";
import { postFinancialIntakeItem } from "./services/financial-intake-posting";
import {
  assertPeriodKey,
  closeFinancialPeriod,
  reopenFinancialPeriod,
  requestFinancialCloseReview,
  runFinancialPreClose,
} from "./services/financial-close";

const textInputSchema = z.object({ text: z.string().trim().min(3).max(80_000) });
const updateInputSchema = z.object({ extractedData: financialExtractionSchema, reviewNotes: z.string().max(2_000).nullable().optional() });
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(2_000) });
const notesSchema = z.object({ notes: z.string().max(2_000).nullable().optional() });

function routeError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Revisá los datos ingresados.", issues: error.issues });
  const typed = error as Error & { statusCode?: number; code?: string };
  if (typed.code === "23505") return res.status(409).json({ message: "La operación ya fue contabilizada." });
  console.error("Financial native route error:", typed);
  return res.status(typed.statusCode ?? 500).json({ message: typed.message || "No se pudo completar la operación." });
}

function publicItem(item: typeof financialIntakeItems.$inferSelect) {
  const { storageKey: _storageKey, ...safe } = item;
  return { ...safe, fileAvailable: Boolean(item.storageKey) };
}

async function extractAndSave(itemId: number, input: Parameters<typeof extractFinancialIntake>[0]) {
  await db.update(financialIntakeItems).set({ status: "processing", extractionError: null, updatedAt: new Date() }).where(eq(financialIntakeItems.id, itemId));
  try {
    const extraction = await extractFinancialIntake(input);
    const [updated] = await db.update(financialIntakeItems).set({
      status: "needs_review",
      documentKind: extraction.data.documentKind,
      suggestedTarget: extraction.data.suggestedTarget,
      extractedData: extraction.data,
      fieldConfidence: extraction.data.fieldConfidence,
      warnings: extraction.data.warnings,
      extractorProvider: extraction.provider,
      extractorModel: extraction.model,
      extractorVersion: extraction.version,
      updatedAt: new Date(),
    }).where(eq(financialIntakeItems.id, itemId)).returning();
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de extracción";
    await db.update(financialIntakeItems).set({ status: "failed", extractionError: message, updatedAt: new Date() }).where(eq(financialIntakeItems.id, itemId));
    throw error;
  }
}

export function createFinancialNativeRouter(requireAuth: any) {
  const router = Router();
  const finance = [requireAuth, requirePermission("finance")];
  const receiveFiles = (req: Request, res: Response, next: NextFunction) => {
    financialIntakeUpload.array("files", 10)(req, res, (error: unknown) => {
      if (error) return res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo leer el archivo." });
      next();
    });
  };

  router.get("/intake", ...finance, async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
      const status = typeof req.query.status === "string" ? req.query.status : null;
      const documentKind = typeof req.query.documentKind === "string" ? req.query.documentKind : null;
      const conditions: any[] = [];
      if (status === "open") conditions.push(notInArray(financialIntakeItems.status, ["posted", "rejected"]));
      else if (status && status !== "all") conditions.push(eq(financialIntakeItems.status, status));
      if (documentKind && documentKind !== "all") conditions.push(eq(financialIntakeItems.documentKind, documentKind));
      const where = conditions.length ? and(...conditions) : undefined;
      const rows = await db.select().from(financialIntakeItems).where(where).orderBy(desc(financialIntakeItems.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
      const countResult = await db.execute(sql`SELECT count(*)::int AS total FROM financial_intake_items ${where ? sql`WHERE ${where}` : sql``}`);
      const total = Number(((countResult as any).rows?.[0] ?? (countResult as any)[0] ?? {}).total ?? rows.length);
      res.json({ items: rows.map(publicItem), page, pageSize, total });
    } catch (error) { routeError(res, error); }
  });

  router.get("/intake/:id", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "ID inválido." });
      const [item] = await db.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, id)).limit(1);
      if (!item) return res.status(404).json({ message: "La carga no existe." });
      res.json(publicItem(item));
    } catch (error) { routeError(res, error); }
  });

  router.get("/intake/:id/file", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [item] = await db.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, id)).limit(1);
      if (!item?.storageKey) return res.status(404).json({ message: "La carga no tiene un archivo asociado." });
      const buffer = await readFinancialIntakeFile(item.storageKey);
      const safeName = (item.originalFileName || `documento-${item.id}`).replace(/["\r\n]/g, "_");
      res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      res.send(buffer);
    } catch (error) { routeError(res, error); }
  });

  router.post("/intake/text", ...finance, async (req: Request, res: Response) => {
    try {
      const { text } = textInputSchema.parse(req.body);
      const [created] = await db.insert(financialIntakeItems).values({ inputKind: "text", originalText: text, createdBy: req.user!.id }).returning();
      const updated = await extractAndSave(created.id, { text });
      res.status(201).json(publicItem(updated));
    } catch (error) { routeError(res, error); }
  });

  router.post("/intake/files", ...finance, receiveFiles, async (req: Request, res: Response) => {
    const createdStorageKeys: string[] = [];
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (!files.length) return res.status(400).json({ message: "Adjuntá al menos un archivo o captura." });
      const context = typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 10_000) : null;
      const items = [];
      for (const file of files) {
        const hash = createHash("sha256").update(file.buffer).digest("hex");
        const [duplicate] = await db.select().from(financialIntakeItems).where(and(
          eq(financialIntakeItems.fileHash, hash),
          sql`${financialIntakeItems.status} <> 'rejected'`,
        )).orderBy(desc(financialIntakeItems.createdAt)).limit(1);
        if (duplicate) {
          items.push({ ...publicItem(duplicate), duplicate: true });
          continue;
        }
        const stored = await storeFinancialIntakeFile(file);
        createdStorageKeys.push(stored.storageKey);
        const [created] = await db.insert(financialIntakeItems).values({
          inputKind: file.mimetype.startsWith("image/") ? "image" : "file",
          originalText: context,
          ...stored,
          createdBy: req.user!.id,
        }).returning();
        // Desde acá el archivo pertenece a una fila persistida y debe
        // conservarse incluso si la extracción falla, para poder reprocesarlo.
        const persistedIndex = createdStorageKeys.indexOf(stored.storageKey);
        if (persistedIndex >= 0) createdStorageKeys.splice(persistedIndex, 1);
        const updated = await extractAndSave(created.id, { text: context, file: { buffer: file.buffer, mimeType: file.mimetype, fileName: file.originalname } });
        items.push(publicItem(updated));
      }
      res.status(201).json({ items });
    } catch (error) {
      await Promise.all(createdStorageKeys.map(deleteFinancialIntakeFile));
      routeError(res, error);
    }
  });

  router.patch("/intake/:id", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = updateInputSchema.parse(req.body);
      const extractedData = { ...input.extractedData, missingFields: financialMissingFields(input.extractedData) };
      const [existing] = await db.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "La carga no existe." });
      if (["posted", "rejected"].includes(existing.status)) return res.status(409).json({ message: "Esta carga ya no admite cambios." });
      const [updated] = await db.update(financialIntakeItems).set({
        extractedData,
        documentKind: extractedData.documentKind,
        suggestedTarget: extractedData.suggestedTarget,
        fieldConfidence: extractedData.fieldConfidence,
        warnings: extractedData.warnings,
        reviewNotes: input.reviewNotes,
        status: extractedData.missingFields.length ? "needs_review" : "approved",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(financialIntakeItems.id, id)).returning();
      await db.insert(financialAuditEvents).values({ entityType: "financial_intake_item", entityId: id, action: "reviewed", beforeData: existing.extractedData, afterData: extractedData, intakeItemId: id, actorUserId: req.user!.id });
      res.json(publicItem(updated));
    } catch (error) { routeError(res, error); }
  });

  router.post("/intake/:id/reprocess", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [item] = await db.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, id)).limit(1);
      if (!item) return res.status(404).json({ message: "La carga no existe." });
      if (item.status === "posted") return res.status(409).json({ message: "La carga ya fue contabilizada." });
      const file = item.storageKey ? await readFinancialIntakeFile(item.storageKey) : null;
      const updated = await extractAndSave(id, { text: item.originalText, file: file ? { buffer: file, mimeType: item.mimeType || "application/octet-stream", fileName: item.originalFileName || "documento" } : null });
      res.json(publicItem(updated));
    } catch (error) { routeError(res, error); }
  });

  router.post("/intake/:id/post", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await postFinancialIntakeItem(id, req.user!.id);
      res.json(result);
    } catch (error) { routeError(res, error); }
  });

  router.post("/intake/:id/reject", ...finance, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = reasonSchema.parse(req.body);
      const [existing] = await db.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "La carga no existe." });
      if (existing.status === "posted") return res.status(409).json({ message: "No se puede rechazar una carga contabilizada." });
      const [updated] = await db.update(financialIntakeItems).set({ status: "rejected", rejectionReason: reason, reviewedBy: req.user!.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(financialIntakeItems.id, id)).returning();
      await db.insert(financialAuditEvents).values({ entityType: "financial_intake_item", entityId: id, action: "rejected", intakeItemId: id, actorUserId: req.user!.id, reason });
      res.json(publicItem(updated));
    } catch (error) { routeError(res, error); }
  });

  router.get("/close", ...finance, async (_req, res) => {
    try { res.json(await db.select().from(financialClosePeriods).orderBy(desc(financialClosePeriods.periodKey))); }
    catch (error) { routeError(res, error); }
  });

  router.get("/close/:period", ...finance, async (req, res) => {
    try {
      assertPeriodKey(req.params.period);
      const [period] = await db.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, req.params.period)).limit(1);
      if (!period) return res.json({ period: null, checks: [] });
      const checks = await db.select().from(financialCloseChecks).where(eq(financialCloseChecks.closePeriodId, period.id)).orderBy(financialCloseChecks.id);
      res.json({ period, checks });
    } catch (error) { routeError(res, error); }
  });

  router.post("/close/:period/pre-close", ...finance, async (req, res) => {
    try { await runFinancialPreClose(req.params.period, req.user!.id); res.json(await closeDetail(req.params.period)); }
    catch (error) { routeError(res, error); }
  });

  router.patch("/close/:period/checks/:checkId", ...finance, async (req, res) => {
    try {
      assertPeriodKey(req.params.period);
      const checkId = Number(req.params.checkId);
      const input = z.object({ status: z.enum(["accepted", "resolved"]), resolution: z.string().trim().min(5).max(2_000) }).parse(req.body);
      const [period] = await db.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, req.params.period)).limit(1);
      if (!period || period.status === "CLOSED") return res.status(409).json({ message: "El período no admite cambios." });
      const [check] = await db.select().from(financialCloseChecks).where(and(eq(financialCloseChecks.id, checkId), eq(financialCloseChecks.closePeriodId, period.id))).limit(1);
      if (!check) return res.status(404).json({ message: "El control no existe." });
      if (check.severity === "critical") return res.status(409).json({ message: "Los controles críticos no admiten excepción: corregí el dato y ejecutá nuevamente el pre-cierre." });
      const [updated] = await db.update(financialCloseChecks).set({ ...input, resolvedBy: req.user!.id, resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(financialCloseChecks.id, checkId), eq(financialCloseChecks.closePeriodId, period.id))).returning();
      await db.insert(financialAuditEvents).values({ periodKey: req.params.period, entityType: "financial_close_check", entityId: checkId, action: input.status, actorUserId: req.user!.id, reason: input.resolution });
      res.json(updated);
    } catch (error) { routeError(res, error); }
  });

  router.post("/close/:period/request-review", ...finance, async (req, res) => {
    try { const input = notesSchema.parse(req.body); await requestFinancialCloseReview(req.params.period, req.user!.id, input.notes); res.json(await closeDetail(req.params.period)); }
    catch (error) { routeError(res, error); }
  });

  router.post("/close/:period/close", requireAuth, requirePermission("admin"), async (req, res) => {
    try { await closeFinancialPeriod(req.params.period, req.user!.id); res.json(await closeDetail(req.params.period)); }
    catch (error) { routeError(res, error); }
  });

  router.post("/close/:period/reopen", requireAuth, requirePermission("admin"), async (req, res) => {
    try { const { reason } = reasonSchema.parse(req.body); await reopenFinancialPeriod(req.params.period, req.user!.id, reason); res.json(await closeDetail(req.params.period)); }
    catch (error) { routeError(res, error); }
  });

  async function closeDetail(periodKey: string) {
    const [period] = await db.select().from(financialClosePeriods).where(eq(financialClosePeriods.periodKey, periodKey)).limit(1);
    const checks = period ? await db.select().from(financialCloseChecks).where(eq(financialCloseChecks.closePeriodId, period.id)).orderBy(financialCloseChecks.id) : [];
    return { period: period ?? null, checks };
  }

  return router;
}
