import { createHash, randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import PptxGenJS from "pptxgenjs";
import OpenAI from "openai";
import { z } from "zod";
import {
  proposalDocumentSchema,
  type ProposalBlock,
  type ProposalDocumentContent,
  type ProposalLocale,
} from "@shared/quotation-professional";

type PublicVariant = { id: number; name: string; description?: string | null; total: number; recommended?: boolean; scope?: unknown; assumptions?: string[]; unitMetrics?: Record<string, number> };

export function buildDefaultProposalDocument(input: {
  locale: ProposalLocale;
  quotation: any;
  client: { name: string; logoUrl?: string | null } | null;
  variants: PublicVariant[];
  team: Array<{ roleName?: string | null }>;
}): ProposalDocumentContent {
  const es = input.locale === "es";
  const quote = input.quotation;
  const scope = quote.scopeSnapshot as any;
  const clientName = input.client?.name || (es ? "Cliente" : "Client");
  const deliverables = scope?.deliverables || quote.deliverables || [];
  const coverage = scope?.coverage || {};
  const termsBullets = [
    quote.projectDuration ? `${es ? "Duración" : "Duration"}: ${quote.projectDuration}` : null,
    quote.paymentTermsDays != null ? `${es ? "Pago" : "Payment"}: ${quote.paymentTermsDays} ${es ? "días" : "days"}` : null,
    quote.expiresAt ? `${es ? "Vigencia" : "Valid until"}: ${new Date(quote.expiresAt).toLocaleDateString(es ? "es-AR" : "en-US")}` : null,
  ].filter(Boolean) as string[];
  const variantTotals = input.variants.map((variant) => Number(variant.total.toFixed(2)));

  const blocks: ProposalBlock[] = [
    {
      id: randomUUID(), type: "cover", title: quote.projectName,
      body: es ? `Propuesta para ${clientName}` : `Proposal for ${clientName}`,
      bullets: [], data: { quotationNumber: quote.quotationNumber, revisionNumber: quote.revisionNumber }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "context", title: es ? "El punto de partida" : "Where we are starting",
      body: [String((quote.decisionContext as any)?.context || quote.additionalNotes || (es ? "Partimos de un desafío de negocio que requiere evidencia clara, oportuna y accionable." : "We start from a business challenge that requires clear, timely and actionable evidence.")), (quote.decisionContext as any)?.currentSituation].filter(Boolean).join("\n\n"),
      bullets: [], data: {}, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "challenge", title: es ? "La decisión que esta propuesta habilita" : "The decision this proposal enables",
      body: [String((quote.decisionContext as any)?.decision || (es ? "Transformar conversación y comportamiento digital en prioridades concretas para el negocio." : "Turn digital conversation and behavior into concrete business priorities.")), (quote.decisionContext as any)?.changes].filter(Boolean).join("\n\n"),
      bullets: [], data: {}, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "objectives", title: es ? "Qué vamos a resolver" : "What we will solve",
      body: "", bullets: (quote.decisionContext as any)?.objectives || (es
        ? ["Entender qué está ocurriendo y por qué", "Detectar riesgos y oportunidades antes", "Traducir evidencia en decisiones accionables"]
        : ["Understand what is happening and why", "Detect risks and opportunities earlier", "Turn evidence into actionable decisions"]),
      data: {}, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "architecture", title: es ? "Una arquitectura que conecta escucha y decisión" : "An architecture connecting listening and decisions",
      body: "", bullets: (coverage.analysisModules || []).map((module: string) => humanize(module)), data: { coverage }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "scope", title: es ? "Cobertura acordada" : "Agreed coverage",
      body: "", bullets: [
        coverage.markets?.length ? `${es ? "Mercados" : "Markets"}: ${coverage.markets.join(", ")}` : null,
        coverage.brands?.length ? `${es ? "Marcas" : "Brands"}: ${coverage.brands.join(", ")}` : null,
        coverage.competitors?.length ? `${es ? "Benchmark" : "Benchmarks"}: ${coverage.competitors.join(", ")}` : null,
        coverage.sources?.length ? `${es ? "Fuentes" : "Sources"}: ${coverage.sources.join(", ")}` : null,
      ].filter(Boolean) as string[], data: { coverage }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "deliverables", title: es ? "Entregables diseñados para actuar" : "Deliverables designed for action",
      body: "", bullets: deliverables.filter((item: any) => item.included !== false).map((item: any) => `${item.name} · ${cadenceLabel(item.cadence, es)}${item.quantity ? ` · ${item.quantity}` : ""}`),
      data: { deliverables }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "timeline", title: es ? "Cómo se pone en marcha" : "How we get started",
      body: "", bullets: (scope?.milestones || []).map((item: any) => `${es ? "Día" : "Day"} ${item.offsetDays}: ${item.name}`),
      data: { milestones: scope?.milestones || [] }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "team", title: es ? "Equipo responsable" : "Team responsible",
      body: es ? "Un equipo multidisciplinario con responsabilidad clara sobre análisis, operación y calidad." : "A multidisciplinary team with clear accountability for analysis, operations and quality.",
      bullets: Array.from(new Set(input.team.map((member) => member.roleName).filter(Boolean))) as string[], data: {}, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "scenarios", title: input.variants.length > 1 ? (es ? "Alternativas para decidir" : "Options for the decision") : (es ? "Inversión" : "Investment"),
      body: "", bullets: input.variants.map((variant) => `${variant.name}: ${formatMoney(variant.total, quote.quotationCurrency, input.locale)}${variant.unitMetrics?.perMonth ? ` · ${formatMoney(variant.unitMetrics.perMonth, quote.quotationCurrency, input.locale)}/${es ? "mes" : "month"}` : ""}${variant.recommended ? ` · ${es ? "Recomendada" : "Recommended"}` : ""}`),
      data: { totals: variantTotals, variants: input.variants.map(({ id, name, description, total, recommended, assumptions, unitMetrics }) => ({ id, name, description, total, recommended, assumptions, unitMetrics })) }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "terms", title: es ? "Condiciones comerciales" : "Commercial terms",
      body: quote.commercialTerms || "", bullets: termsBullets, data: { inclusions: quote.inclusions, exclusions: quote.exclusions, paymentSchedule: quote.paymentSchedule }, visible: true, internalOnly: false,
    },
    {
      id: randomUUID(), type: "closing", title: es ? "El próximo paso es alinear el kickoff" : "The next step is to align the kickoff",
      body: es ? "Al confirmar la alternativa elegida, coordinamos responsables, accesos y calendario de inicio." : "Once the selected option is confirmed, we align owners, access and the start calendar.",
      bullets: [], data: {}, visible: true, internalOnly: false,
    },
  ];

  return proposalDocumentSchema.parse({
    locale: input.locale,
    theme: { primaryColor: "#111827", accentColor: "#f97316", backgroundColor: "#ffffff", fontFamily: "Aptos", clientLogoUrl: input.client?.logoUrl || null },
    assets: input.client?.logoUrl ? [{ id: "client-logo", type: "client_logo", url: input.client.logoUrl, altText: `${clientName} logo` }] : [],
    blocks,
  });
}

const agentPatchSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  operations: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("rewrite_block"), blockId: z.string().uuid(), title: z.string().trim().min(1).max(180), body: z.string().max(8_000), bullets: z.array(z.string().trim().min(1).max(500)).max(30) }),
    z.object({ type: z.literal("reorder_blocks"), blockIds: z.array(z.string().uuid()).min(1).max(40) }),
    z.object({ type: z.literal("update_theme"), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), fontFamily: z.string().trim().min(1).max(80) }),
  ])).min(1).max(20),
});
export type AgentPatch = z.infer<typeof agentPatchSchema>;

export async function proposeAgentPatch(document: ProposalDocumentContent, instruction: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("OpenAI no está configurado"), { statusCode: 503 });
  const model = process.env.OPENAI_PROPOSAL_MODEL || "gpt-5.4-mini-2026-03-17";
  const client = new OpenAI({ apiKey });
  const editorialTypes = new Set(["cover", "context", "challenge", "objectives", "architecture", "closing"]);
  const allowedDocument = {
    locale: document.locale,
    theme: document.theme,
    blocks: document.blocks.map(({ id, type, title, body, bullets, visible }) => editorialTypes.has(type)
      ? { id, type, title, body, bullets, visible, editable: true }
      : { id, type, title, visible, editable: false }),
  };
  const response = await client.responses.create({
    model,
    store: false,
    input: [
      { role: "developer", content: "Sos un editor senior de propuestas B2B de inteligencia. Sólo podés editar narrativa, orden y tema visual. No agregues precios, cifras, alcance, SLA, nombres de clientes, casos, resultados ni promesas que no existan. No modifiques IDs. El cierre debe resolver la apertura y proponer un próximo paso concreto. Devolvé únicamente operaciones válidas." },
      { role: "user", content: `Pedido editorial:\n${instruction}\n\nDocumento sanitizado:\n${JSON.stringify(allowedDocument)}` },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "proposal_editor_patch",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "operations"],
          properties: {
            summary: { type: "string" },
            operations: {
              type: "array",
              items: {
                oneOf: [
                  { type: "object", additionalProperties: false, required: ["type", "blockId", "title", "body", "bullets"], properties: { type: { const: "rewrite_block" }, blockId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, bullets: { type: "array", items: { type: "string" } } } },
                  { type: "object", additionalProperties: false, required: ["type", "blockIds"], properties: { type: { const: "reorder_blocks" }, blockIds: { type: "array", items: { type: "string" } } } },
                  { type: "object", additionalProperties: false, required: ["type", "primaryColor", "accentColor", "backgroundColor", "fontFamily"], properties: { type: { const: "update_theme" }, primaryColor: { type: "string" }, accentColor: { type: "string" }, backgroundColor: { type: "string" }, fontFamily: { type: "string" } } },
                ],
              },
            },
          },
        },
      },
    },
  });
  const patch = agentPatchSchema.parse(JSON.parse(response.output_text));
  return {
    model,
    patch,
    usage: { inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null },
    promptHash: createHash("sha256").update(instruction).digest("hex"),
  };
}

export function applyAgentPatch(document: ProposalDocumentContent, patch: AgentPatch): ProposalDocumentContent {
  const next = structuredClone(document);
  const existingIds = new Set(next.blocks.map((block) => block.id));
  const editorialTypes = new Set(["cover", "context", "challenge", "objectives", "architecture", "closing"]);
  for (const operation of patch.operations) {
    if (operation.type === "rewrite_block") {
      const block = next.blocks.find((item) => item.id === operation.blockId);
      if (!block) throw new Error("El agente intentó editar un bloque inexistente");
      if (!editorialTypes.has(block.type)) throw new Error("El agente intentó editar un bloque comercial protegido");
      block.title = operation.title;
      block.body = operation.body;
      block.bullets = operation.bullets;
    } else if (operation.type === "reorder_blocks") {
      if (operation.blockIds.length !== next.blocks.length || operation.blockIds.some((id) => !existingIds.has(id)) || new Set(operation.blockIds).size !== next.blocks.length) {
        throw new Error("El agente propuso un orden de bloques inválido");
      }
      next.blocks = operation.blockIds.map((id) => next.blocks.find((block) => block.id === id)!);
    } else {
      next.theme = { ...next.theme, ...operation };
      delete (next.theme as any).type;
    }
  }
  return proposalDocumentSchema.parse(next);
}

export async function renderProposalPdf(documentContent: ProposalDocumentContent, metadata: { title: string; quotationNumber?: string | null }) {
  return await new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 46, bufferPages: true, info: { Title: metadata.title, Author: "Epical" } });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    const visible = documentContent.blocks.filter((block) => block.visible && !block.internalOnly);
    visible.forEach((block, index) => {
      if (index > 0) pdf.addPage();
      const theme = documentContent.theme;
      const coverImage = block.type === "cover" ? resolveLocalImage(documentContent.assets.find((asset) => asset.type === "client_logo")?.url || theme.clientLogoUrl) : null;
      pdf.rect(0, 0, pdf.page.width, pdf.page.height).fill(theme.backgroundColor);
      pdf.rect(0, 0, 13, pdf.page.height).fill(theme.accentColor);
      if (coverImage) pdf.image(coverImage, pdf.page.width - 190, 52, { fit: [140, 70], align: "right", valign: "center" });
      pdf.fillColor(theme.primaryColor).font("Helvetica-Bold").fontSize(block.type === "cover" ? 34 : 26).text(block.title, 56, block.type === "cover" ? 210 : 72, { width: pdf.page.width - 112, lineGap: 3 });
      if (block.body) pdf.moveDown(block.type === "cover" ? 1.25 : 1.5).fillColor("#475569").font("Helvetica").fontSize(block.type === "cover" ? 18 : 14).text(block.body, { lineGap: 6, width: pdf.page.width - 112 });
      if (block.bullets.length) {
        pdf.moveDown(1.5);
        const bulletFontSize = block.bullets.length > 14 ? 9 : block.bullets.length > 8 ? 11 : 13;
        block.bullets.forEach((bullet) => {
          const bulletY = pdf.y;
          const textHeight = pdf.font("Helvetica").fontSize(bulletFontSize).heightOfString(bullet, { width: pdf.page.width - 150, lineGap: 3 });
          const cardHeight = Math.max(30, textHeight + 14);
          pdf.roundedRect(52, bulletY - 4, pdf.page.width - 104, cardHeight, 6).fill("#f8fafc");
          pdf.fillColor(theme.accentColor).circle(68, bulletY + cardHeight / 2 - 4, 3).fill();
          pdf.fillColor("#334155").font("Helvetica").fontSize(bulletFontSize).text(bullet, 82, bulletY + 4, { width: pdf.page.width - 158, lineGap: 3 });
          pdf.y = bulletY + cardHeight + 8;
        });
      }
      pdf.fillColor("#94a3b8").fontSize(8).text(`${metadata.quotationNumber || "Epical"} · ${index + 1}/${visible.length}`, 46, pdf.page.height - 60, { align: "right", width: pdf.page.width - 92, lineBreak: false });
    });
    pdf.end();
  });
}

export async function renderProposalPptx(documentContent: ProposalDocumentContent, metadata: { title: string; quotationNumber?: string | null }) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Epical";
  pptx.subject = metadata.title;
  pptx.title = metadata.title;
  pptx.company = "Epical";
  pptx.theme = {
    headFontFace: documentContent.theme.fontFamily,
    bodyFontFace: documentContent.theme.fontFamily,
  };
  const visible = documentContent.blocks.filter((block) => block.visible && !block.internalOnly);
  visible.forEach((block, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: stripHash(documentContent.theme.backgroundColor) };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: stripHash(documentContent.theme.accentColor), transparency: 100 }, fill: { color: stripHash(documentContent.theme.accentColor) } });
    if (block.type === "cover") {
      const coverImage = resolveLocalImage(documentContent.assets.find((asset) => asset.type === "client_logo")?.url || documentContent.theme.clientLogoUrl);
      if (coverImage) slide.addImage({ path: coverImage, x: 9.9, y: 0.62, w: 2.4, h: 0.9, transparency: 0 });
      slide.addText(block.title, { x: 0.8, y: 1.45, w: 11.3, h: 1.6, fontFace: documentContent.theme.fontFamily, fontSize: 50, bold: true, color: stripHash(documentContent.theme.primaryColor), margin: 0, breakLine: false, fit: "shrink" });
      if (block.body) slide.addText(block.body, { x: 0.82, y: 3.35, w: 10.8, h: 0.65, fontSize: 24, color: "64748B", margin: 0, fit: "shrink" });
    } else {
      slide.addText(block.title, { x: 0.8, y: 0.62, w: 11.5, h: 0.72, fontFace: documentContent.theme.fontFamily, fontSize: 35, bold: true, color: stripHash(documentContent.theme.primaryColor), margin: 0, fit: "shrink" });
      let cursorY = 1.65;
      if (block.body) {
        slide.addText(block.body, { x: 0.82, y: cursorY, w: 11.2, h: 1.2, fontSize: 19, color: "475569", margin: 0, valign: "top", breakLine: false, fit: "shrink" });
        cursorY += 1.45;
      }
      const maxBullets = 8;
      if (block.type === "architecture" && block.bullets.length) {
        const nodes = block.bullets.slice(0, 5);
        nodes.forEach((label, nodeIndex) => {
          const width = 10.8 / nodes.length;
          const x = 0.85 + nodeIndex * width;
          slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.45, w: width - 0.18, h: 1.35, rectRadius: 0.08, fill: { color: nodeIndex % 2 ? stripHash(documentContent.theme.primaryColor) : stripHash(documentContent.theme.accentColor), transparency: nodeIndex % 2 ? 4 : 0 }, line: { transparency: 100 } });
          slide.addText(label, { x: x + 0.12, y: 2.8, w: width - 0.42, h: 0.6, fontSize: nodes.length > 4 ? 15 : 17, bold: true, align: "center", color: "FFFFFF", margin: 0.02, fit: "shrink" });
        });
        slide.addText(documentContent.locale === "es" ? "Fuentes  →  procesamiento  →  análisis  →  decisión" : "Sources  →  processing  →  analysis  →  decision", { x: 1.2, y: 4.35, w: 10.2, h: 0.4, fontSize: 15, color: "64748B", align: "center", margin: 0 });
      } else if (block.type === "scenarios" && block.bullets.length) {
        block.bullets.slice(0, 3).forEach((label, scenarioIndex) => {
          const x = 0.8 + scenarioIndex * 4.05;
          slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.0, w: 3.65, h: 2.7, rectRadius: 0.06, fill: { color: scenarioIndex === 1 ? "FFF7ED" : "F8FAFC" }, line: { color: scenarioIndex === 1 ? stripHash(documentContent.theme.accentColor) : "CBD5E1", width: scenarioIndex === 1 ? 2 : 1 } });
          slide.addText(label, { x: x + 0.25, y: 2.55, w: 3.15, h: 1.45, fontSize: 19, bold: scenarioIndex === 1, color: stripHash(documentContent.theme.primaryColor), align: "center", valign: "middle", margin: 0.04, fit: "shrink" });
        });
      } else if (block.bullets.length) {
        const bullets = block.bullets.slice(0, maxBullets).map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 4, breakLine: true } }));
        slide.addText(bullets, { x: 0.9, y: cursorY, w: 11.1, h: Math.max(1.2, 5.8 - cursorY), fontSize: block.bullets.length > 6 ? 16 : 18, color: "334155", margin: 0.06, paraSpaceAfter: 12, breakLine: false, valign: "top", fit: "shrink" });
      }
    }
    slide.addText(`${metadata.quotationNumber || "Epical"}  ·  ${index + 1}/${visible.length}`, { x: 10.3, y: 7.08, w: 2.25, h: 0.2, fontSize: 9, color: "94A3B8", align: "right", margin: 0 });
  });
  const result = await pptx.write({ outputType: "nodebuffer", compression: true });
  return Buffer.isBuffer(result) ? result : Buffer.from(result as Uint8Array);
}

function cadenceLabel(value: string, es: boolean) {
  const labels: Record<string, [string, string]> = {
    once: ["Única", "Once"], daily: ["Diaria", "Daily"], weekly: ["Semanal", "Weekly"], biweekly: ["Quincenal", "Biweekly"], monthly: ["Mensual", "Monthly"], quarterly: ["Trimestral", "Quarterly"], event: ["Por evento", "Per event"], on_demand: ["A demanda", "On demand"],
  };
  return labels[value]?.[es ? 0 : 1] || humanize(value);
}

function resolveLocalImage(url?: string | null) {
  if (!url?.startsWith("/uploads/")) return null;
  const relative = url.replace(/^\/+/, "");
  const candidate = path.resolve(process.cwd(), "public", relative);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (!candidate.startsWith(`${publicRoot}${path.sep}`) || !existsSync(candidate) || !/\.(png|jpe?g)$/i.test(candidate)) return null;
  return candidate;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatMoney(amount: number, currency: string, locale: ProposalLocale) {
  return new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: currency === "ARS" ? 0 : 2 }).format(amount);
}

function stripHash(color: string) {
  return color.replace("#", "");
}
