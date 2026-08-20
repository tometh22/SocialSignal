import type { Express, RequestHandler } from "express";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { requirePermission } from "./middleware/requirePermission";
import {
  clients,
  proposalAgentRuns,
  proposalAssets,
  proposalDocuments,
  quotationRevisions,
  quotationTeamMembers,
  quotationVariants,
  quotations,
  roles,
  serviceBlueprints,
} from "@shared/schema";
import {
  blueprintDefinitionSchema,
  estimateBlueprintWorkload,
  proposalDocumentSchema,
  proposalLocaleSchema,
  runProposalQa,
} from "@shared/quotation-professional";
import { nextBlueprintVersion } from "./services/service-blueprints";
import { upload } from "./upload";
import path from "path";
import {
  applyAgentPatch,
  buildDefaultProposalDocument,
  proposeAgentPatch,
  renderProposalPdf,
  renderProposalPptx,
} from "./services/proposal-studio";

type AuthMiddleware = RequestHandler;

export function registerProposalStudioRoutes(app: Express, requireAuth: AuthMiddleware) {
  app.get("/api/service-blueprints", requireAuth, requirePermission("quotations"), async (req, res) => {
    const requestedStatus = typeof req.query.status === "string" ? req.query.status : "published";
    const status = z.enum(["draft", "published", "archived", "all"]).parse(requestedStatus);
    const rows = status === "all"
      ? await db.select().from(serviceBlueprints).orderBy(asc(serviceBlueprints.name), desc(serviceBlueprints.version))
      : await db.select().from(serviceBlueprints).where(eq(serviceBlueprints.status, status)).orderBy(asc(serviceBlueprints.name), desc(serviceBlueprints.version));
    res.json(rows.map((row) => ({ ...row, workload: estimateBlueprintWorkload(blueprintDefinitionSchema.parse(row.definition)) })));
  });

  app.post("/api/service-blueprints", requireAuth, requirePermission("quotations"), async (req, res) => {
    try {
      const input = z.object({
        slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        name: z.string().trim().min(2).max(180),
        description: z.string().trim().max(2_000).nullable().optional(),
        definition: blueprintDefinitionSchema,
        sourceLabel: z.string().trim().max(180).nullable().optional(),
      }).parse(req.body);
      const version = await nextBlueprintVersion(input.slug);
      const [created] = await db.insert(serviceBlueprints).values({
        ...input,
        version,
        status: "draft",
        createdBy: req.user?.id ?? null,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "La receta no es válida", errors: error.errors });
      res.status(500).json({ message: "No se pudo crear la receta" });
    }
  });

  app.post("/api/service-blueprints/from-quotation/:quotationId", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.quotationId);
    try {
      const input = z.object({ slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().trim().min(2).max(180), description: z.string().trim().max(2_000).nullable().optional() }).parse(req.body);
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
      if (!quotation?.scopeSnapshot) return res.status(409).json({ message: "La cotización no tiene un alcance profesional para guardar" });
      const version = await nextBlueprintVersion(input.slug);
      const [created] = await db.insert(serviceBlueprints).values({
        ...input,
        version,
        status: "draft",
        definition: blueprintDefinitionSchema.parse(quotation.scopeSnapshot),
        sourceLabel: `Cotización ${quotation.quotationNumber || quotation.id}`,
        createdBy: req.user?.id ?? null,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Los datos de la receta no son válidos", errors: error.errors });
      res.status(500).json({ message: "No se pudo guardar la receta" });
    }
  });

  app.post("/api/service-blueprints/:id/publish", requireAuth, requirePermission("operations"), async (req, res) => {
    const id = Number(req.params.id);
    const [current] = await db.select().from(serviceBlueprints).where(eq(serviceBlueprints.id, id));
    if (!current) return res.status(404).json({ message: "Receta no encontrada" });
    if (current.status !== "draft") return res.status(409).json({ message: "Sólo una receta en borrador puede publicarse" });
    const [published] = await db.update(serviceBlueprints).set({ status: "published", publishedBy: req.user?.id ?? null, publishedAt: new Date(), updatedAt: new Date() }).where(and(eq(serviceBlueprints.id, id), eq(serviceBlueprints.status, "draft"))).returning();
    res.json(published);
  });

  app.post("/api/service-blueprints/:id/archive", requireAuth, requirePermission("operations"), async (req, res) => {
    const id = Number(req.params.id);
    const [current] = await db.select().from(serviceBlueprints).where(eq(serviceBlueprints.id, id));
    if (!current) return res.status(404).json({ message: "Receta no encontrada" });
    if (current.status === "archived") return res.json(current);
    const [archived] = await db.update(serviceBlueprints).set({ status: "archived", updatedAt: new Date() })
      .where(eq(serviceBlueprints.id, id)).returning();
    res.json(archived);
  });

  app.post("/api/service-blueprints/estimate", requireAuth, requirePermission("quotations"), async (req, res) => {
    try {
      const definition = blueprintDefinitionSchema.parse(req.body.definition ?? req.body);
      res.json(estimateBlueprintWorkload(definition));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "El alcance no es válido", errors: error.errors });
      res.status(500).json({ message: "No se pudo estimar el esfuerzo" });
    }
  });

  app.get("/api/quotations/:id/proposal-documents/:locale", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    try {
      const locale = proposalLocaleSchema.parse(req.params.locale);
      let [document] = await db.select().from(proposalDocuments).where(and(eq(proposalDocuments.quotationId, quotationId), eq(proposalDocuments.locale, locale)));
      if (!document) {
        const source = await getProposalSource(quotationId, locale);
        if (!source) return res.status(404).json({ message: "Cotización no encontrada" });
        const [created] = await db.insert(proposalDocuments).values({
          quotationId,
          revisionId: source.revision?.id ?? null,
          locale,
          content: source.content,
          sourceDocumentHash: source.revision?.documentHash ?? source.quotation.documentHash,
          createdBy: req.user?.id ?? null,
          updatedBy: req.user?.id ?? null,
        }).returning();
        document = created;
      }
      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Idioma inválido" });
      res.status(500).json({ message: "No se pudo abrir el Estudio de Propuesta" });
    }
  });

  app.put("/api/quotations/:id/proposal-documents/:documentId", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    try {
      const content = proposalDocumentSchema.parse(req.body.content ?? req.body);
      const [[quotation], [currentDocument]] = await Promise.all([
        db.select({ status: quotations.status }).from(quotations).where(eq(quotations.id, quotationId)),
        db.select().from(proposalDocuments).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId))),
      ]);
      if (!quotation) return res.status(404).json({ message: "Cotización no encontrada" });
      if (!currentDocument) return res.status(404).json({ message: "Documento no encontrado" });
      if (["sent", "viewed", "approved", "rejected", "expired", "cancelled", "superseded"].includes(quotation.status)) {
        return res.status(409).json({ message: "La propuesta enviada es inmutable. Creá una nueva revisión." });
      }
      if (!protectedBlocksEqual(proposalDocumentSchema.parse(currentDocument.content), content)) {
        return res.status(409).json({ message: "El alcance, entregables, timeline, equipo, escenarios y términos se editan desde la cotización y requieren recálculo.", code: "COMMERCIAL_CHANGE_REQUIRES_QUOTATION" });
      }
      const [updated] = await db.update(proposalDocuments).set({ content, qaStatus: "pending", qaIssues: [], status: "draft", updatedAt: new Date(), updatedBy: req.user?.id ?? null }).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId))).returning();
      if (!updated) return res.status(404).json({ message: "Documento no encontrado" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "El documento no es válido", errors: error.errors });
      res.status(500).json({ message: "No se pudo guardar el documento" });
    }
  });

  app.post("/api/quotations/:id/proposal-documents/:documentId/reconcile", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    try {
      const [current] = await db.select().from(proposalDocuments).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId)));
      if (!current) return res.status(404).json({ message: "Documento no encontrado" });
      const source = await getProposalSource(quotationId, proposalLocaleSchema.parse(current.locale));
      if (!source) return res.status(404).json({ message: "Cotización no encontrada" });
      const previous = proposalDocumentSchema.parse(current.content);
      const reconciled = { ...source.content, theme: previous.theme, assets: previous.assets };
      const [updated] = await db.update(proposalDocuments).set({
        revisionId: source.revision?.id ?? null,
        sourceDocumentHash: source.revision?.documentHash ?? source.quotation.documentHash,
        content: reconciled,
        isStale: false,
        qaStatus: "pending",
        qaIssues: [],
        warningOverrideReason: null,
        status: "draft",
        updatedAt: new Date(),
        updatedBy: req.user?.id ?? null,
      }).where(eq(proposalDocuments.id, documentId)).returning();
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "No se pudo reconciliar el idioma o contenido" });
      res.status(500).json({ message: "No se pudo reconciliar la propuesta" });
    }
  });

  app.post("/api/quotations/:id/proposal-documents/:documentId/qa", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    try {
      const result = await runDocumentQa(quotationId, documentId);
      const [updated] = await db.update(proposalDocuments).set({ qaStatus: result.blockers.length ? "blocked" : result.warnings.length ? "warning" : "passed", qaIssues: result.issues, status: result.blockers.length ? "draft" : "ready", updatedAt: new Date(), updatedBy: req.user?.id ?? null }).where(eq(proposalDocuments.id, documentId)).returning();
      res.json({ document: updated, ...result });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "No se pudo ejecutar QA" });
    }
  });

  app.post("/api/quotations/:id/proposal-documents/:documentId/warnings/override", requireAuth, requirePermission("operations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    const { reason } = z.object({ reason: z.string().trim().min(5).max(2_000) }).parse(req.body);
    const result = await runDocumentQa(quotationId, documentId);
    if (result.blockers.length) return res.status(409).json({ message: "Los errores comerciales bloqueantes no pueden ignorarse", blockers: result.blockers });
    const [updated] = await db.update(proposalDocuments).set({ warningOverrideReason: reason, qaStatus: "passed", status: "ready", qaIssues: result.issues, updatedAt: new Date(), updatedBy: req.user?.id ?? null }).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId))).returning();
    res.json(updated);
  });

  app.post("/api/quotations/:id/proposal-documents/:documentId/agent/propose", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    try {
      const { instruction } = z.object({ instruction: z.string().trim().min(5).max(4_000) }).parse(req.body);
      const [document] = await db.select().from(proposalDocuments).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId)));
      if (!document) return res.status(404).json({ message: "Documento no encontrado" });
      const proposal = await proposeAgentPatch(proposalDocumentSchema.parse(document.content), instruction);
      const [run] = await db.insert(proposalAgentRuns).values({
        quotationId,
        documentId,
        model: proposal.model,
        promptHash: proposal.promptHash,
        requestedOperation: "editorial",
        proposedPatch: proposal.patch,
        inputTokens: proposal.usage.inputTokens,
        outputTokens: proposal.usage.outputTokens,
        status: "proposed",
        createdBy: req.user?.id ?? null,
      }).returning();
      res.status(201).json({ run, patch: proposal.patch });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "El pedido editorial no es válido", errors: error.errors });
      res.status(error?.statusCode || 500).json({ message: error?.message || "No se pudo consultar el agente" });
    }
  });

  app.post("/api/quotations/:id/proposal-agent-runs/:runId/decision", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const runId = Number(req.params.runId);
    try {
      const { decision } = z.object({ decision: z.enum(["accept", "reject"]) }).parse(req.body);
      const [run] = await db.select().from(proposalAgentRuns).where(and(eq(proposalAgentRuns.id, runId), eq(proposalAgentRuns.quotationId, quotationId)));
      if (!run) return res.status(404).json({ message: "Propuesta del agente no encontrada" });
      if (run.status !== "proposed") return res.status(409).json({ message: "La propuesta del agente ya fue decidida" });
      if (decision === "reject") {
        const [rejected] = await db.update(proposalAgentRuns).set({ status: "rejected", decidedAt: new Date() }).where(eq(proposalAgentRuns.id, runId)).returning();
        return res.json({ run: rejected });
      }
      const [document] = await db.select().from(proposalDocuments).where(eq(proposalDocuments.id, run.documentId));
      if (!document) return res.status(404).json({ message: "Documento no encontrado" });
      const content = applyAgentPatch(proposalDocumentSchema.parse(document.content), run.proposedPatch as any);
      const result = await db.transaction(async (tx) => {
        const [updatedDocument] = await tx.update(proposalDocuments).set({ content, qaStatus: "pending", qaIssues: [], status: "draft", updatedAt: new Date(), updatedBy: req.user?.id ?? null }).where(eq(proposalDocuments.id, document.id)).returning();
        const [accepted] = await tx.update(proposalAgentRuns).set({ status: "accepted", acceptedPatch: run.proposedPatch, decidedAt: new Date() }).where(and(eq(proposalAgentRuns.id, runId), eq(proposalAgentRuns.status, "proposed"))).returning();
        return { document: updatedDocument, run: accepted };
      });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Decisión inválida" });
      res.status(500).json({ message: error instanceof Error ? error.message : "No se pudo aplicar la propuesta" });
    }
  });

  app.post("/api/quotations/:id/proposal-assets", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    try {
      const input = z.object({ documentId: z.number().int().positive().nullable().optional(), assetType: z.enum(["client_logo", "brand_image", "chart", "attachment"]), storageUrl: z.string().trim().min(1).max(4_000), altText: z.string().trim().max(500).nullable().optional(), metadata: z.record(z.unknown()).optional() }).parse(req.body);
      const [asset] = await db.insert(proposalAssets).values({ quotationId, ...input, createdBy: req.user?.id ?? null }).returning();
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Asset inválido", errors: error.errors });
      res.status(500).json({ message: "No se pudo registrar el asset" });
    }
  });

  app.post("/api/quotations/:id/proposal-assets/upload", requireAuth, requirePermission("quotations"), (req, res) => {
    upload.single("file")(req, res, async (error: any) => {
      if (error) return res.status(400).json({ message: error.message || "No se pudo procesar la imagen" });
      if (!req.file) return res.status(400).json({ message: "No se recibió ninguna imagen" });
      try {
        const quotationId = Number(req.params.id);
        const input = z.object({ documentId: z.coerce.number().int().positive(), assetType: z.enum(["client_logo", "brand_image", "chart"]), altText: z.string().trim().max(500).optional() }).parse(req.body);
        const storageUrl = `/uploads/${path.basename(req.file.path)}`;
        const result = await db.transaction(async (tx) => {
          const [document] = await tx.select().from(proposalDocuments).where(and(eq(proposalDocuments.id, input.documentId), eq(proposalDocuments.quotationId, quotationId)));
          if (!document) throw Object.assign(new Error("Documento no encontrado"), { statusCode: 404 });
          const [asset] = await tx.insert(proposalAssets).values({ quotationId, documentId: input.documentId, assetType: input.assetType, storageUrl, altText: input.altText, metadata: { mimeType: req.file!.mimetype, size: req.file!.size }, createdBy: req.user?.id ?? null }).returning();
          const content = proposalDocumentSchema.parse(document.content);
          content.assets = [...content.assets, { id: String(asset.id), type: input.assetType, url: storageUrl, altText: input.altText || "" }];
          if (input.assetType === "client_logo") content.theme.clientLogoUrl = storageUrl;
          const [updated] = await tx.update(proposalDocuments).set({ content, qaStatus: "pending", status: "draft", updatedAt: new Date(), updatedBy: req.user?.id ?? null }).where(eq(proposalDocuments.id, document.id)).returning();
          return { asset, document: updated };
        });
        res.status(201).json(result);
      } catch (uploadError: any) {
        res.status(uploadError?.statusCode || 500).json({ message: uploadError?.message || "No se pudo guardar la imagen" });
      }
    });
  });

  app.get("/api/quotations/:id/proposal-documents/:documentId/export.:format", requireAuth, requirePermission("quotations"), async (req, res) => {
    const quotationId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    const format = req.params.format;
    if (!['pdf', 'pptx'].includes(format)) return res.status(400).json({ message: "Formato inválido" });
    try {
      const [document] = await db.select().from(proposalDocuments).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId)));
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
      if (!document || !quotation) return res.status(404).json({ message: "Documento no encontrado" });
      const qa = await runDocumentQa(quotationId, documentId);
      if (qa.blockers.length) return res.status(409).json({ message: "El documento tiene errores bloqueantes", blockers: qa.blockers });
      if (qa.warnings.length && !document.warningOverrideReason) return res.status(409).json({ message: "Resolvé o aprobá las advertencias antes de exportar", warnings: qa.warnings });
      const content = proposalDocumentSchema.parse(document.content);
      const metadata = { title: quotation.projectName, quotationNumber: quotation.quotationNumber };
      const buffer = format === "pdf" ? await renderProposalPdf(content, metadata) : await renderProposalPptx(content, metadata);
      res.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(quotation.quotationNumber || `propuesta-${quotation.id}`)}-${content.locale}.${format}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "No se pudo exportar" });
    }
  });
}

async function getProposalSource(quotationId: number, locale: "es" | "en") {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
  if (!quotation) return null;
  const [[client], variants, team, revisions] = await Promise.all([
    db.select({ name: clients.name, logoUrl: clients.logoUrl }).from(clients).where(eq(clients.id, quotation.clientId)),
    db.select().from(quotationVariants).where(eq(quotationVariants.quotationId, quotationId)).orderBy(asc(quotationVariants.variantOrder)),
    db.select({ roleName: roles.name }).from(quotationTeamMembers).leftJoin(roles, eq(roles.id, quotationTeamMembers.roleId)).where(and(eq(quotationTeamMembers.quotationId, quotationId), isNull(quotationTeamMembers.variantId))),
    db.select().from(quotationRevisions).where(eq(quotationRevisions.quotationId, quotationId)).orderBy(desc(quotationRevisions.revisionNumber)).limit(1),
  ]);
  return {
    quotation,
    revision: revisions[0] || null,
    content: buildDefaultProposalDocument({
      locale,
      quotation,
      client: client || null,
      variants: variants.map((variant) => ({ id: variant.id, name: variant.variantName, description: variant.variantDescription, total: variant.totalAmount, recommended: variant.isRecommended, scope: variant.scopeSnapshot, assumptions: variant.assumptions, unitMetrics: variant.unitMetrics })),
      team,
    }),
  };
}

export async function runDocumentQa(quotationId: number, documentId: number) {
  const [[document], [quotation], [client], knownClients, variants, localeDocuments] = await Promise.all([
    db.select().from(proposalDocuments).where(and(eq(proposalDocuments.id, documentId), eq(proposalDocuments.quotationId, quotationId))),
    db.select().from(quotations).where(eq(quotations.id, quotationId)),
    db.select().from(clients).innerJoin(quotations, eq(quotations.clientId, clients.id)).where(eq(quotations.id, quotationId)).then((rows) => rows.map((row) => row.clients)),
    db.select({ name: clients.name }).from(clients),
    db.select().from(quotationVariants).where(eq(quotationVariants.quotationId, quotationId)).orderBy(asc(quotationVariants.variantOrder)),
    db.select({ locale: proposalDocuments.locale, isStale: proposalDocuments.isStale }).from(proposalDocuments).where(eq(proposalDocuments.quotationId, quotationId)),
  ]);
  if (!document || !quotation || !client) throw new Error("Documento o cotización no encontrado");
  const issues = runProposalQa({
    document: proposalDocumentSchema.parse(document.content),
    expectedClientName: client.name,
    knownClientNames: knownClients.map((row) => row.name),
    expectedGrandTotals: variants.map((variant) => variant.totalAmount),
    paymentSchedule: quotation.paymentSchedule,
  });
  const scope = blueprintDefinitionSchema.safeParse(quotation.scopeSnapshot);
  if (scope.success) {
    const decisionContext = quotation.decisionContext as Record<string, unknown>;
    if (!String(decisionContext?.context || "").trim() || !String(decisionContext?.decision || "").trim()) {
      issues.push({ code: "missing-decision-context", severity: "warning", message: "Completá el contexto del cliente y la decisión que debe habilitar la propuesta." });
    }
    for (const requiredLocale of scope.data.coverage.languages) {
      if (!localeDocuments.some((candidate) => candidate.locale === requiredLocale && !candidate.isStale)) {
        issues.push({ code: "missing-locale", severity: "blocker", message: `Falta reconciliar la propuesta en idioma ${requiredLocale.toUpperCase()}.` });
      }
    }
  }
  return { issues, blockers: issues.filter((issue) => issue.severity === "blocker"), warnings: issues.filter((issue) => issue.severity === "warning") };
}

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "propuesta";
}

function protectedBlocksEqual(previous: z.infer<typeof proposalDocumentSchema>, next: z.infer<typeof proposalDocumentSchema>) {
  const protectedTypes = new Set(["scope", "deliverables", "timeline", "team", "scenarios", "terms"]);
  const select = (document: z.infer<typeof proposalDocumentSchema>) => document.blocks
    .filter((block) => protectedTypes.has(block.type))
    .map(({ id, type, title, body, bullets, data, visible, internalOnly }) => ({ id, type, title, body, bullets, data, visible, internalOnly }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify(select(previous)) === JSON.stringify(select(next));
}
