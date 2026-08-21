import OpenAI from "openai";
import { z } from "zod";
import type { BlueprintDefinition } from "@shared/quotation-professional";
import { blueprintDefinitionSchema, estimateBlueprintWorkload } from "@shared/quotation-professional";

const MODALITIES = ["demo", "one_shot", "event_pack", "monthly_fee", "annual_program", "renewal"] as const;
const MODULES = ["brand", "campaign", "influencers", "competition", "experience", "crisis", "culture", "trends", "category", "multisource"] as const;

const proposalCandidateSchema = z.object({
  id: z.string().trim().min(1).max(100),
  projectName: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(2_000),
  objective: z.string().trim().max(2_000).default(""),
  decision: z.string().trim().max(2_000).default(""),
  modality: z.enum(MODALITIES).nullable().default(null),
  durationMonths: z.number().positive().nullable().default(null),
  markets: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  brands: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  competitors: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  sources: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  languages: z.array(z.enum(["es", "en"])).min(1).max(2).default(["es"]),
  modules: z.array(z.enum(MODULES)).max(10).default([]),
  mentionVolume: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
  slaLevel: z.enum(["standard", "priority", "real_time"]).default("standard"),
  designLevel: z.enum(["standard", "branded", "executive"]).default("branded"),
  recommendationSlug: z.string().trim().max(120).nullable().default(null),
  recommendationReason: z.string().trim().max(1_000).default(""),
  confidence: z.number().min(0).max(1).default(0.5),
  missingQuestions: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});

const aiAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  proposals: z.array(proposalCandidateSchema).min(1).max(8),
});

type ParsedProposalCandidate = z.infer<typeof proposalCandidateSchema>;

export type BriefProposalCandidate = ParsedProposalCandidate & {
  recommendedBlueprint: { id: number; slug: string; name: string; workloadHours: number } | null;
};

export type BriefAnalysis = Omit<BriefProposalCandidate, "id"> & {
  source: "ai" | "heuristic";
  model: string | null;
  proposals: BriefProposalCandidate[];
  requiresProposalSelection: boolean;
};

export type BlueprintCandidate = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  definition: BlueprintDefinition;
};

const MODULE_TERMS: Array<[BriefProposalCandidate["modules"][number], string[]]> = [
  ["campaign", ["campaña", "campaign", "lanzamiento", "tiktok shop"]],
  ["influencers", ["influencer", "creador", "creator"]],
  ["competition", ["competidor", "competencia", "benchmark", "share of recommendation"]],
  ["experience", ["experiencia", "cx", "customer", "customer journey"]],
  ["crisis", ["crisis", "riesgo", "reputación", "reputacion"]],
  ["culture", ["cultura", "social listening", "tensión", "tension"]],
  ["trends", ["tendencia", "trend", "futuro", "inteligencia artificial"]],
  ["category", ["categoría", "categoria", "mercado", "snacks"]],
  ["multisource", ["fuentes", "multifuente", "datos", "chatgpt", "gemini", "claude", "perplexity"]],
  ["brand", ["marca", "brand", "percepción", "percepcion", "visibilidad"]],
];

function normalize(value: string) {
  return value.toLocaleLowerCase("es");
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function detectModules(text: string) {
  return MODULE_TERMS.filter(([, terms]) => includesAny(text, terms)).map(([module]) => module);
}

function detectModality(text: string): BriefProposalCandidate["modality"] {
  if (includesAny(text, ["renovación", "renovacion", "renovar el servicio", "continuidad del servicio", "seguir con el servicio"])) return "renewal";
  if (includesAny(text, ["evento", "mundial", "olímp", "olimp", "cobertura en vivo", "war room"])) return "event_pack";
  if (includesAny(text, ["programa anual", "contrato anual", "servicio anual", "12 meses de servicio"])) return "annual_program";
  if (includesAny(text, ["fee mensual", "monitoreo mensual", "reporte mensual recurrente", "entrega mensual recurrente", "todos los meses", "always on", "servicio recurrente"])) return "monthly_fee";
  if (includesAny(text, ["demo", "prueba de concepto", "piloto exploratorio"])) return "demo";
  return "one_shot";
}

function findRecommendation(
  candidates: BlueprintCandidate[],
  modality: BriefProposalCandidate["modality"],
  modules: BriefProposalCandidate["modules"],
  text: string,
) {
  const recommendation = candidates
    .map((candidate) => {
      const definition = blueprintDefinitionSchema.parse(candidate.definition);
      let score = 0;
      if (definition.modality === modality) score += 6;
      score += Math.min(4, definition.coverage.analysisModules.filter((module) => modules.includes(module)).length);
      if (text.includes("regional") && definition.modality === "annual_program") score += 2;
      if (text.includes("evento") && definition.modality === "event_pack") score += 2;
      if (includesAny(text, ["fee mensual", "always on", "servicio recurrente"]) && definition.modality === "monthly_fee") score += 2;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!recommendation || recommendation.score <= 0) return { blueprint: null, score: 0 };
  return {
    blueprint: {
      id: recommendation.candidate.id,
      slug: recommendation.candidate.slug,
      name: recommendation.candidate.name,
      workloadHours: estimateBlueprintWorkload(recommendation.candidate.definition).totalHours,
    },
    score: recommendation.score,
  };
}

function enrichProposal(proposal: ParsedProposalCandidate, candidates: BlueprintCandidate[]): BriefProposalCandidate {
  const matched = proposal.recommendationSlug
    ? candidates.find((candidate) => candidate.slug === proposal.recommendationSlug)
    : null;
  return {
    ...proposal,
    confidence: Math.max(0, Math.min(1, proposal.confidence)),
    recommendedBlueprint: matched
      ? { id: matched.id, slug: matched.slug, name: matched.name, workloadHours: estimateBlueprintWorkload(matched.definition).totalHours }
      : null,
  };
}

function buildHeuristicProposal(
  rawText: string,
  candidates: BlueprintCandidate[],
  overrides: Partial<ParsedProposalCandidate> & Pick<ParsedProposalCandidate, "id" | "projectName" | "summary">,
): BriefProposalCandidate {
  const text = normalize(rawText);
  const modules = overrides.modules || detectModules(text);
  const modality = overrides.modality || detectModality(text);
  const durationMonths = overrides.durationMonths ?? (modality === "demo" || modality === "one_shot" ? 1 : modality === "event_pack" ? 2 : modality === "annual_program" ? 12 : 3);
  const recommendation = findRecommendation(candidates, modality, modules, text);
  const missingQuestions = overrides.missingQuestions || [
    !/\b(cliente|marca|brand|pepsico)\b/i.test(rawText) ? "¿Qué cliente, marca o unidad de negocio es responsable?" : null,
    !/\b(mercad|país|pais|regional|latam|argentina|brasil|méxico|mexico)\b/i.test(rawText) ? "¿Qué mercados deben cubrirse?" : null,
    !/\b(fecha|mes|semana|trimestre|duración|duracion|evento)\b/i.test(rawText) ? "¿Cuándo debe comenzar y durante cuánto tiempo?" : null,
    modules.length === 0 ? "¿Qué preguntas de negocio debe responder el servicio?" : null,
  ].filter(Boolean) as string[];

  const parsed = proposalCandidateSchema.parse({
    objective: overrides.summary,
    decision: "",
    modality,
    durationMonths,
    markets: [],
    brands: [],
    competitors: [],
    sources: [],
    languages: includesAny(text, ["inglés", "ingles", "english"]) ? ["es", "en"] : ["es"],
    modules: modules.length ? modules : ["brand", "category"],
    mentionVolume: includesAny(text, ["masivo", "masiva", "alto volumen", "millones"]) ? "large" : "medium",
    slaLevel: includesAny(text, ["urgente", "alerta", "tiempo real", "inmediato"]) ? "priority" : "standard",
    designLevel: includesAny(text, ["director", "c-level", "board", "comité", "comite", "ejecutivo", "playbook"]) ? "executive" : "branded",
    recommendationSlug: recommendation.blueprint?.slug || null,
    recommendationReason: recommendation.blueprint
      ? `La receta “${recommendation.blueprint.name}” coincide con el alcance y aporta una referencia inicial de ${recommendation.blueprint.workloadHours} horas.`
      : "Todavía no hay suficiente información para recomendar una receta con confianza.",
    confidence: recommendation.blueprint ? Math.min(0.9, 0.52 + (modules.length * 0.04) + (recommendation.score * 0.025)) : 0.4,
    missingQuestions,
    ...overrides,
  });
  return { ...parsed, recommendedBlueprint: recommendation.blueprint };
}

function detectExplicitProposalGroups(text: string, candidates: BlueprintCandidate[]): BriefProposalCandidate[] {
  const normalized = normalize(text);
  const proposals: BriefProposalCandidate[] = [];
  const hasTikTokShop = includesAny(normalized, ["tiktok shop", "social commerce playbook", "playbook de tiktok"]);
  const hasSnacksStudy = includesAny(normalized, ["categoría de snacks", "categoria de snacks", "estudio de la categoría", "estudio de la categoria"]);
  const hasAiAudit = includesAny(normalized, ["auditoría de inteligencia artificial", "auditoria de inteligencia artificial", "share of recommendation", "visibilidad en ia", "recomendación en ia", "recomendacion en ia"]);

  if (hasTikTokShop) {
    proposals.push(buildHeuristicProposal(text, candidates, {
      id: "tiktok-shop-playbook",
      projectName: "Playbook regional de TikTok Shop",
      summary: "Playbook regional de social commerce basado en los aprendizajes de los pilotos de TikTok Shop.",
      objective: "Transformar los aprendizajes de Brasil y México en un marco operativo y estratégico replicable para LATAM.",
      decision: "Definir cómo escalar TikTok Shop por mercado, marca, contenido, creators y operación comercial.",
      modality: "one_shot",
      durationMonths: 2.5,
      markets: ["Brasil", "México", "LATAM"],
      brands: ["PepsiCo"],
      sources: ["TikTok Shop", "Social media", "E-commerce"],
      modules: ["campaign", "influencers", "competition", "experience"],
      missingQuestions: ["¿Qué mercados y marcas deberán priorizarse en la primera versión regional?"],
    }));
  }

  if (hasSnacksStudy) {
    proposals.push(buildHeuristicProposal(text, candidates, {
      id: "snacks-category-study",
      projectName: "Estudio digital de la categoría de snacks",
      summary: "Análisis independiente de la categoría de snacks en e-commerce y ecosistemas digitales.",
      objective: "Entender el desempeño, las dinámicas competitivas y las oportunidades digitales de la categoría.",
      decision: "Priorizar territorios, marcas, competidores y oportunidades de crecimiento en e-commerce.",
      modality: "one_shot",
      brands: ["PepsiCo"],
      sources: ["E-commerce", "Social media", "Search"],
      modules: ["category", "competition", "brand", "trends"],
      missingQuestions: ["¿Qué países, marcas, competidores y retailers deben integrar el estudio?"],
    }));
  }

  if (hasAiAudit) {
    proposals.push(buildHeuristicProposal(text, candidates, {
      id: "ai-visibility-audit",
      projectName: "Auditoría de visibilidad y recomendación en IA",
      summary: "Baseline de presencia, visibilidad y share of recommendation de PepsiCo en asistentes de inteligencia artificial.",
      objective: "Medir cómo los modelos de IA representan y recomiendan las marcas y categorías de PepsiCo frente a competidores.",
      decision: "Definir acciones de optimización y una medición posterior comparable.",
      modality: "one_shot",
      brands: ["PepsiCo"],
      sources: ["ChatGPT", "Gemini", "Claude", "Perplexity"],
      modules: ["brand", "competition", "multisource", "trends"],
      missingQuestions: ["¿Qué marcas, categorías, mercados e idiomas deben incluirse en el baseline?", "¿La propuesta debe incluir desde ahora una segunda medición post-optimización?"],
    }));
  }

  return proposals;
}

export function analyzeQuotationBriefHeuristically(rawBrief: string, candidates: BlueprintCandidate[]): BriefAnalysis {
  const text = rawBrief.trim();
  const explicitProposals = detectExplicitProposalGroups(text, candidates);
  const proposals = explicitProposals.length > 0
    ? explicitProposals
    : [buildHeuristicProposal(text, candidates, {
      id: "proposal-1",
      projectName: "Proyecto por definir",
      summary: text.length > 500 ? `${text.slice(0, 497).trim()}…` : text,
    })];
  const primary = proposals[0];
  return {
    ...primary,
    summary: proposals.length > 1
      ? `Se detectaron ${proposals.length} propuestas independientes. Cada una tiene un objetivo, alcance y decisión comercial propios.`
      : primary.summary,
    source: "heuristic",
    model: null,
    proposals,
    requiresProposalSelection: proposals.length > 1,
  };
}

const proposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "projectName", "summary", "objective", "decision", "modality", "durationMonths", "markets", "brands", "competitors", "sources", "languages", "modules", "mentionVolume", "slaLevel", "designLevel", "recommendationSlug", "recommendationReason", "confidence", "missingQuestions"],
  properties: {
    id: { type: "string" }, projectName: { type: "string" }, summary: { type: "string" }, objective: { type: "string" }, decision: { type: "string" },
    modality: { type: ["string", "null"], enum: [...MODALITIES, null] },
    durationMonths: { type: ["number", "null"] }, markets: { type: "array", items: { type: "string" } }, brands: { type: "array", items: { type: "string" } }, competitors: { type: "array", items: { type: "string" } }, sources: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string", enum: ["es", "en"] } }, modules: { type: "array", items: { type: "string", enum: MODULES } },
    mentionVolume: { type: "string", enum: ["small", "medium", "large", "xlarge"] }, slaLevel: { type: "string", enum: ["standard", "priority", "real_time"] }, designLevel: { type: "string", enum: ["standard", "branded", "executive"] },
    recommendationSlug: { type: ["string", "null"] }, recommendationReason: { type: "string" }, confidence: { type: "number" }, missingQuestions: { type: "array", items: { type: "string" } },
  },
} as const;

export async function analyzeQuotationBrief(rawBrief: string, candidates: BlueprintCandidate[]): Promise<BriefAnalysis> {
  const brief = rawBrief.trim();
  if (!brief) throw Object.assign(new Error("Ingresá un brief o una minuta para analizar"), { statusCode: 400 });
  const fallback = analyzeQuotationBriefHeuristically(brief, candidates);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const model = process.env.OPENAI_PROPOSAL_MODEL || "gpt-5.4-mini-2026-03-17";
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      store: false,
      input: [
        { role: "developer", content: "Sos un analista comercial de Epical. Convertí una minuta o brief en oportunidades cotizables. Separá propuestas cuando existan entregables, objetivos, presupuestos, cronogramas o aprobaciones independientes, o cuando el texto diga que son proyectos separados o que deben enviarse varias propuestas. La frecuencia de pagos o los hitos de facturación NO definen la modalidad: sólo clasificá como fee mensual si la prestación y sus entregables son recurrentes. No inventes clientes, cifras, precios ni promesas. Elegí una receta sólo entre las candidatas. Si falta información, devolvé preguntas concretas. Cada propuesta debe poder cotizarse por separado. Devolvé únicamente el objeto del esquema." },
        { role: "user", content: `BRIEF O MINUTA:\n${brief}\n\nRECETAS DISPONIBLES (sin costos):\n${JSON.stringify(candidates.map((candidate) => ({ slug: candidate.slug, name: candidate.name, description: candidate.description, modality: candidate.definition.modality, modules: candidate.definition.coverage.analysisModules, markets: candidate.definition.coverage.markets.length, deliverables: candidate.definition.deliverables.length })))}` },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "quotation_brief_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "proposals"],
            properties: {
              summary: { type: "string" },
              proposals: { type: "array", minItems: 1, maxItems: 8, items: proposalJsonSchema },
            },
          },
        },
      },
    });
    const parsed = aiAnalysisSchema.parse(JSON.parse(response.output_text));
    const proposals = parsed.proposals.map((proposal) => enrichProposal(proposal, candidates));
    const primary = proposals[0];
    return {
      ...primary,
      summary: parsed.summary,
      source: "ai",
      model,
      proposals,
      requiresProposalSelection: proposals.length > 1,
    };
  } catch (error) {
    console.warn("⚠️ Brief intelligence fallback:", error instanceof Error ? error.message : error);
    return fallback;
  }
}
