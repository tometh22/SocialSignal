import OpenAI from "openai";
import { z } from "zod";
import type { BlueprintDefinition } from "@shared/quotation-professional";
import { blueprintDefinitionSchema, estimateBlueprintWorkload } from "@shared/quotation-professional";

const briefAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  projectName: z.string().trim().max(180).default(""),
  objective: z.string().trim().max(2_000).default(""),
  decision: z.string().trim().max(2_000).default(""),
  modality: z.enum(["demo", "one_shot", "event_pack", "monthly_fee", "annual_program", "renewal"]).nullable().default(null),
  durationMonths: z.number().positive().nullable().default(null),
  markets: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  brands: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  competitors: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  sources: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  languages: z.array(z.enum(["es", "en"])).min(1).max(2).default(["es"]),
  modules: z.array(z.enum(["brand", "campaign", "influencers", "competition", "experience", "crisis", "culture", "trends", "category", "multisource"])).max(10).default([]),
  mentionVolume: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
  slaLevel: z.enum(["standard", "priority", "real_time"]).default("standard"),
  designLevel: z.enum(["standard", "branded", "executive"]).default("branded"),
  recommendationSlug: z.string().trim().max(120).nullable().default(null),
  recommendationReason: z.string().trim().max(1_000).default(""),
  confidence: z.number().min(0).max(1).default(0.5),
  missingQuestions: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});

export type BriefAnalysis = z.infer<typeof briefAnalysisSchema> & {
  source: "ai" | "heuristic";
  model: string | null;
  recommendedBlueprint: { id: number; slug: string; name: string; workloadHours: number } | null;
};

type BlueprintCandidate = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  definition: BlueprintDefinition;
};

const MODULE_TERMS: Array<[BriefAnalysis["modules"][number], string[]]> = [
  ["campaign", ["campaña", "campaign", "lanzamiento"]],
  ["influencers", ["influencer", "creador", "creator"]],
  ["competition", ["competidor", "competencia", "benchmark"]],
  ["experience", ["experiencia", "cx", "customer"]],
  ["crisis", ["crisis", "riesgo", "reputación", "reputacion"]],
  ["culture", ["cultura", "social listening", "tensión", "tension"]],
  ["trends", ["tendencia", "trend", "futuro"]],
  ["category", ["categoría", "categoria", "mercado"]],
  ["multisource", ["fuentes", "multifuente", "datos"]],
  ["brand", ["marca", "brand", "percepción", "percepcion"]],
];

function heuristicAnalysis(rawBrief: string, candidates: BlueprintCandidate[]): BriefAnalysis {
  const text = rawBrief.trim();
  const normalized = text.toLocaleLowerCase("es");
  const includesAny = (terms: string[]) => terms.some((term) => normalized.includes(term));
  const modules = MODULE_TERMS.filter(([, terms]) => includesAny(terms)).map(([module]) => module);
  const modality = includesAny(["renov", "continuidad", "actualmente tenemos", "seguir con"])
    ? "renewal"
    : includesAny(["evento", "mundial", "olímp", "olimp", "cobertura en vivo", "en tiempo real"])
      ? "event_pack"
      : includesAny(["mensual", "fee", "todos los meses", "always on", "recurrente"])
        ? "monthly_fee"
        : includesAny(["anual", "programa regional", "12 meses"])
          ? "annual_program"
          : includesAny(["demo", "prueba", "piloto", "exploratorio"])
            ? "demo"
            : "one_shot";
  const durationMonths = modality === "demo" || modality === "one_shot" ? 1 : modality === "event_pack" ? 2 : modality === "annual_program" ? 12 : 3;
  const recommendation = candidates
    .map((candidate) => {
      const definition = blueprintDefinitionSchema.parse(candidate.definition);
      let score = 0;
      if (definition.modality === modality) score += 6;
      if (definition.coverage.analysisModules.some((module) => modules.includes(module))) score += 2;
      if (normalized.includes("regional") && definition.modality === "annual_program") score += 3;
      if (normalized.includes("evento") && definition.modality === "event_pack") score += 3;
      if (normalized.includes("mensual") && definition.modality === "monthly_fee") score += 3;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  const recommendedBlueprint = recommendation && recommendation.score > 0
    ? { id: recommendation.candidate.id, slug: recommendation.candidate.slug, name: recommendation.candidate.name, workloadHours: estimateBlueprintWorkload(recommendation.candidate.definition).totalHours }
    : null;
  const missingQuestions = [
    !text.match(/\b(cliente|marca|brand)\b/i) ? "¿Qué cliente, marca o unidad de negocio es responsable?" : null,
    !text.match(/\b(mercad|país|pais|regional|argentina|brasil|méxico|mexico)\b/i) ? "¿Qué mercados deben cubrirse?" : null,
    !text.match(/\b(fecha|mes|semana|trimestre|duración|duracion|evento)\b/i) ? "¿Cuándo debe comenzar y durante cuánto tiempo?" : null,
    modules.length === 0 ? "¿Qué preguntas de negocio debe responder el servicio?" : null,
  ].filter(Boolean) as string[];
  return {
    summary: text.length > 500 ? `${text.slice(0, 497).trim()}…` : text,
    projectName: "",
    objective: text,
    decision: "",
    modality,
    durationMonths,
    markets: [], brands: [], competitors: [], sources: [],
    languages: normalized.includes("inglés") || normalized.includes("ingles") || normalized.includes("english") ? ["es", "en"] : ["es"],
    modules: modules.length ? modules : ["brand", "category"],
    mentionVolume: includesAny(["masivo", "masiva", "alto volumen", "millones"]) ? "large" : "medium",
    slaLevel: includesAny(["urgente", "alerta", "tiempo real", "inmediato"]) ? "priority" : "standard",
    designLevel: includesAny(["director", "c-level", "board", "comité", "comite", "ejecutivo"]) ? "executive" : "branded",
    recommendationSlug: recommendedBlueprint?.slug || null,
    recommendationReason: recommendedBlueprint ? `La receta “${recommendedBlueprint.name}” coincide con la modalidad detectada (${modality.replace("_", " ")}) y permite empezar con una referencia de ${recommendedBlueprint.workloadHours} horas.` : "Todavía no hay suficiente información para recomendar una receta con confianza.",
    confidence: recommendedBlueprint ? Math.min(0.82, 0.45 + (modules.length * 0.05) + (recommendation!.score * 0.03)) : 0.35,
    missingQuestions,
    source: "heuristic",
    model: null,
    recommendedBlueprint,
  };
}

export async function analyzeQuotationBrief(rawBrief: string, candidates: BlueprintCandidate[]): Promise<BriefAnalysis> {
  const brief = rawBrief.trim();
  if (!brief) throw Object.assign(new Error("Ingresá un brief o una minuta para analizar"), { statusCode: 400 });
  const fallback = heuristicAnalysis(brief, candidates);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const model = process.env.OPENAI_PROPOSAL_MODEL || "gpt-5.4-mini-2026-03-17";
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      store: false,
      input: [
        { role: "developer", content: "Sos un analista comercial de Epical. Convertí una minuta o brief en datos de cotización. No inventes clientes, cifras, precios ni promesas. Elegí una receta sólo entre las candidatas recibidas. Si falta información, devolvé preguntas concretas. Devolvé únicamente el objeto del esquema." },
        { role: "user", content: `BRIEF O MINUTA:\n${brief}\n\nRECETAS DISPONIBLES (sin costos):\n${JSON.stringify(candidates.map((candidate) => ({ slug: candidate.slug, name: candidate.name, description: candidate.description, modality: candidate.definition.modality, modules: candidate.definition.coverage.analysisModules, markets: candidate.definition.coverage.markets.length, deliverables: candidate.definition.deliverables.length })))} ` },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "quotation_brief_analysis",
          strict: true,
          schema: {
            type: "object", additionalProperties: false,
            required: ["summary", "projectName", "objective", "decision", "modality", "durationMonths", "markets", "brands", "competitors", "sources", "languages", "modules", "mentionVolume", "slaLevel", "designLevel", "recommendationSlug", "recommendationReason", "confidence", "missingQuestions"],
            properties: {
              summary: { type: "string" }, projectName: { type: "string" }, objective: { type: "string" }, decision: { type: "string" },
              modality: { type: ["string", "null"], enum: ["demo", "one_shot", "event_pack", "monthly_fee", "annual_program", "renewal", null] },
              durationMonths: { type: ["number", "null"] }, markets: { type: "array", items: { type: "string" } }, brands: { type: "array", items: { type: "string" } }, competitors: { type: "array", items: { type: "string" } }, sources: { type: "array", items: { type: "string" } },
              languages: { type: "array", items: { type: "string", enum: ["es", "en"] } }, modules: { type: "array", items: { type: "string", enum: MODULE_TERMS.map(([module]) => module) } },
              mentionVolume: { type: "string", enum: ["small", "medium", "large", "xlarge"] }, slaLevel: { type: "string", enum: ["standard", "priority", "real_time"] }, designLevel: { type: "string", enum: ["standard", "branded", "executive"] },
              recommendationSlug: { type: ["string", "null"] }, recommendationReason: { type: "string" }, confidence: { type: "number" }, missingQuestions: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    });
    const parsed = briefAnalysisSchema.parse(JSON.parse(response.output_text));
    const matched = parsed.recommendationSlug ? candidates.find((candidate) => candidate.slug === parsed.recommendationSlug) : null;
    return {
      ...parsed,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      source: "ai",
      model,
      recommendedBlueprint: matched ? { id: matched.id, slug: matched.slug, name: matched.name, workloadHours: estimateBlueprintWorkload(matched.definition).totalHours } : null,
    };
  } catch (error) {
    console.warn("⚠️ Brief intelligence fallback:", error instanceof Error ? error.message : error);
    return fallback;
  }
}
