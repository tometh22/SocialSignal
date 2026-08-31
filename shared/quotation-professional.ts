import { z } from "zod";

export const commercialMotionSchema = z.enum(["new_business", "renewal", "expansion", "demo"]);
export type CommercialMotion = z.infer<typeof commercialMotionSchema>;

export const proposalLocaleSchema = z.enum(["es", "en"]);
export type ProposalLocale = z.infer<typeof proposalLocaleSchema>;

export const scopeCoverageSchema = z.object({
  markets: z.array(z.string().trim().min(1)).default([]),
  brands: z.array(z.string().trim().min(1)).default([]),
  competitors: z.array(z.string().trim().min(1)).default([]),
  sources: z.array(z.string().trim().min(1)).default([]),
  languages: z.array(proposalLocaleSchema).min(1).default(["es"]),
  mentionVolume: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
  analysisModules: z.array(z.enum([
    "brand", "campaign", "influencers", "competition", "experience",
    "crisis", "culture", "trends", "category", "multisource",
  ])).default([]),
  slaLevel: z.enum(["standard", "priority", "real_time"]).default("standard"),
  designLevel: z.enum(["standard", "branded", "executive"]).default("branded"),
});
export type ScopeCoverage = z.infer<typeof scopeCoverageSchema>;

export const serviceDeliverableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  type: z.enum(["report", "executive_report", "dashboard", "alert", "workshop", "presentation", "dataset", "ad_hoc"]),
  format: z.enum(["pdf", "pptx", "dashboard", "email", "whatsapp", "meeting", "xlsx", "mixed"]),
  cadence: z.enum(["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "event", "on_demand"]),
  // Cero es una cantidad legítima: un entregable previsto por la receta que este
  // cliente no contrata (por ejemplo, sin instancia ejecutiva) queda en cero y
  // deja de aportar horas, sin tener que reescribir la receta.
  quantity: z.number().int().nonnegative().default(1),
  pageRange: z.string().trim().max(80).nullable().default(null),
  languages: z.array(proposalLocaleSchema).min(1).default(["es"]),
  modules: z.array(z.string()).default([]),
  description: z.string().trim().min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1)).default([]),
  roleHours: z.record(z.number().nonnegative()).default({}),
  dueRule: z.string().trim().max(240).nullable().default(null),
  included: z.boolean().default(true),
  optionalPrice: z.number().nonnegative().nullable().default(null),
});
export type ServiceDeliverable = z.infer<typeof serviceDeliverableSchema>;

/**
 * Un entregable forma parte del alcance vendido sólo si está incluido y tiene
 * unidades. Poner la cantidad en cero es la forma de sacar del alcance un
 * entregable que la receta trae por defecto (por ejemplo, cuando no hay
 * instancia ejecutiva) sin tener que reescribir la receta. Todo consumidor
 * —horas, tareas, conteos y la propuesta que ve el cliente— usa este predicado
 * para no mostrar como vendido algo que se cotizó en cero.
 */
export function isDeliverableSold(item: { included?: boolean; quantity?: number | null }) {
  return item.included !== false && Number(item.quantity ?? 1) > 0;
}

export const operationalMilestoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  offsetDays: z.number().int().nonnegative(),
  description: z.string().trim().default(""),
  taskNames: z.array(z.string().trim().min(1)).default([]),
});
export type OperationalMilestone = z.infer<typeof operationalMilestoneSchema>;

export const blueprintDefinitionSchema = z.object({
  commercialMotion: commercialMotionSchema,
  modality: z.enum(["demo", "one_shot", "event_pack", "monthly_fee", "annual_program", "renewal"]),
  durationMonths: z.number().positive(),
  minimumTermMonths: z.number().nonnegative().default(0),
  coverage: scopeCoverageSchema,
  deliverables: z.array(serviceDeliverableSchema).min(1),
  setupRoleHours: z.record(z.number().nonnegative()).default({}),
  milestones: z.array(operationalMilestoneSchema).default([]),
  monitoringWindow: z.string().trim().max(240).nullable().default(null),
  alertChannels: z.array(z.enum(["email", "whatsapp", "slack", "meeting"])).default([]),
  includedLicenses: z.boolean().default(true),
  intellectualProperty: z.enum(["client", "epical", "shared"]).default("client"),
  inclusions: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
  paymentTermsDays: z.number().int().nonnegative().default(30),
  proposalValidityBusinessDays: z.number().int().positive().default(15),
  priceAdjustment: z.enum(["none", "ipc_quarterly", "annual_review", "scope_only"]).default("scope_only"),
});
export type BlueprintDefinition = z.infer<typeof blueprintDefinitionSchema>;

export type WorkloadLine = {
  sourceId: string;
  sourceName: string;
  roleKey: string;
  baseHours: number;
  quantity: number;
  factor: number;
  estimatedHours: number;
};

export type EffortBenchmark = {
  serviceBlueprintId: number | null;
  projectType: string;
  sampleSize: number;
  averageActualHours: number;
  medianActualHours: number;
};

const volumeFactor: Record<ScopeCoverage["mentionVolume"], number> = {
  small: 0.9,
  medium: 1,
  large: 1.18,
  xlarge: 1.35,
};

/** Deterministic effort model. Prices remain the responsibility of quotation-pricing. */
export function estimateBlueprintWorkload(definition: BlueprintDefinition) {
  const coverage = definition.coverage;
  const coverageFactor =
    (1 + Math.max(0, coverage.markets.length - 1) * 0.12)
    * (1 + Math.max(0, coverage.brands.length - 1) * 0.1)
    * (1 + Math.max(0, coverage.competitors.length - 1) * 0.05)
    * (1 + Math.max(0, coverage.sources.length - 1) * 0.04)
    * (1 + Math.max(0, coverage.languages.length - 1) * 0.12)
    * (1 + Math.max(0, coverage.analysisModules.length - 3) * 0.05);
  const slaFactor = coverage.slaLevel === "real_time" ? 1.25 : coverage.slaLevel === "priority" ? 1.12 : 1;
  const designFactor = coverage.designLevel === "executive" ? 1.18 : coverage.designLevel === "branded" ? 1.1 : 1;
  const factor = coverageFactor * slaFactor * designFactor * volumeFactor[coverage.mentionVolume];
  const lines: WorkloadLine[] = [];

  for (const [roleKey, hours] of Object.entries(definition.setupRoleHours)) {
    lines.push({
      sourceId: "setup",
      sourceName: "Setup y calibración",
      roleKey,
      baseHours: hours,
      quantity: 1,
      factor: 1,
      estimatedHours: roundHalfHour(hours),
    });
  }

  for (const deliverable of definition.deliverables.filter(isDeliverableSold)) {
    for (const [roleKey, hours] of Object.entries(deliverable.roleHours)) {
      lines.push({
        sourceId: deliverable.id,
        sourceName: deliverable.name,
        roleKey,
        baseHours: hours,
        quantity: deliverable.quantity,
        factor,
        estimatedHours: roundHalfHour(hours * deliverable.quantity * factor),
      });
    }
  }

  const byRole = lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.roleKey] = roundHalfHour((acc[line.roleKey] || 0) + line.estimatedHours);
    return acc;
  }, {});
  return {
    factor: Number(factor.toFixed(4)),
    totalHours: roundHalfHour(Object.values(byRole).reduce((sum, hours) => sum + hours, 0)),
    byRole,
    lines,
  };
}

/**
 * Applies a conservative correction learned from completed comparable projects.
 * Two samples are required and the correction is capped so sparse history cannot
 * overwhelm the deterministic recipe.
 */
export function applyHistoricalEffortBenchmark(
  workload: ReturnType<typeof estimateBlueprintWorkload>,
  benchmark?: EffortBenchmark | null,
) {
  const historicalFactor = benchmark && benchmark.sampleSize >= 2 && workload.totalHours > 0 && benchmark.medianActualHours > 0
    ? Math.min(1.5, Math.max(0.65, benchmark.medianActualHours / workload.totalHours))
    : 1;
  const byRole = Object.fromEntries(
    Object.entries(workload.byRole).map(([roleKey, hours]) => [roleKey, roundHalfHour(hours * historicalFactor)]),
  );
  const lines = workload.lines.map((line) => ({
    ...line,
    estimatedHours: roundHalfHour(line.estimatedHours * historicalFactor),
  }));

  return {
    ...workload,
    totalHours: roundHalfHour(Object.values(byRole).reduce((sum, hours) => sum + hours, 0)),
    byRole,
    lines,
    historicalFactor: Number(historicalFactor.toFixed(4)),
  };
}

function roundHalfHour(value: number) {
  return Math.round(value * 2) / 2;
}

export const proposalBlockTypeSchema = z.enum([
  "cover", "context", "challenge", "objectives", "architecture", "scope",
  "deliverables", "timeline", "team", "scenarios", "terms", "closing",
]);
export type ProposalBlockType = z.infer<typeof proposalBlockTypeSchema>;

export const proposalBlockSchema = z.object({
  id: z.string().uuid(),
  type: proposalBlockTypeSchema,
  title: z.string().trim().min(1).max(180),
  body: z.string().max(8_000).default(""),
  bullets: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  data: z.record(z.unknown()).default({}),
  visible: z.boolean().default(true),
  internalOnly: z.boolean().default(false),
});
export type ProposalBlock = z.infer<typeof proposalBlockSchema>;

export const proposalThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111827"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f97316"),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  fontFamily: z.string().trim().min(1).max(80).default("Aptos"),
  clientLogoUrl: z.string().max(2_048).nullable().default(null),
});

export const proposalDocumentSchema = z.object({
  locale: proposalLocaleSchema,
  theme: proposalThemeSchema,
  assets: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(["client_logo", "brand_image", "chart"]),
    url: z.string().min(1).max(2_048),
    altText: z.string().max(500).default(""),
  })).max(30).default([]),
  blocks: z.array(proposalBlockSchema).min(1).max(40),
});
export type ProposalDocumentContent = z.infer<typeof proposalDocumentSchema>;

export type ProposalQaIssue = {
  code: string;
  severity: "blocker" | "warning";
  blockId?: string;
  message: string;
};

export function runProposalQa(input: {
  document: ProposalDocumentContent;
  expectedClientName: string;
  knownClientNames?: string[];
  expectedGrandTotals?: number[];
  paymentSchedule?: Array<{ percentage: number }>;
}): ProposalQaIssue[] {
  const issues: ProposalQaIssue[] = [];
  const visible = input.document.blocks.filter((block) => block.visible);
  const placeholderPattern = /(\bTBD\b|\bTODO\b|\bLOREM\b|\{\{[^}]+\}\}|\[(completar|placeholder|cliente|fecha|monto)(:[^\]]*)?\]|\bX\s*\(\s*\d+\s*%\s*\))/i;
  let closingSeen = false;
  const titleKeys = new Set<string>();

  for (const block of visible) {
    const content = `${block.title}\n${block.body}\n${block.bullets.join("\n")}\n${JSON.stringify(block.data)}`;
    if (placeholderPattern.test(content)) {
      issues.push({ code: "placeholder", severity: "blocker", blockId: block.id, message: `Hay un placeholder pendiente en “${block.title}”.` });
    }
    if (block.internalOnly) {
      issues.push({ code: "internal-visible", severity: "blocker", blockId: block.id, message: `El bloque interno “${block.title}” está visible.` });
    }
    if (!["cover", "closing"].includes(block.type) && !block.body.trim() && block.bullets.length === 0) {
      issues.push({ code: "empty-block", severity: "warning", blockId: block.id, message: `El bloque “${block.title}” está vacío.` });
    }
    if (closingSeen) {
      issues.push({ code: "after-closing", severity: "blocker", blockId: block.id, message: `“${block.title}” aparece después del cierre.` });
    }
    if (block.type === "closing") closingSeen = true;
    const titleKey = `${block.type}:${block.title.trim().toLocaleLowerCase("es")}`;
    if (titleKeys.has(titleKey)) {
      issues.push({ code: "duplicate-block", severity: "warning", blockId: block.id, message: `El bloque “${block.title}” está duplicado.` });
    }
    titleKeys.add(titleKey);
    for (const clientName of input.knownClientNames || []) {
      if (clientName.trim().length < 3 || clientName.toLocaleLowerCase("es") === input.expectedClientName.toLocaleLowerCase("es")) continue;
      if (content.toLocaleLowerCase("es").includes(clientName.toLocaleLowerCase("es"))) {
        issues.push({ code: "client-leak", severity: "blocker", blockId: block.id, message: `Se detectó una referencia a otro cliente: ${clientName}.` });
      }
    }
  }

  const scenarioBlock = visible.find((block) => block.type === "scenarios");
  if (scenarioBlock && input.expectedGrandTotals?.length) {
    const totals = Array.isArray(scenarioBlock.data.totals) ? scenarioBlock.data.totals.map(Number) : [];
    const expected = input.expectedGrandTotals.map((amount) => Number(amount.toFixed(2)));
    if (JSON.stringify(totals.map((amount) => Number(amount.toFixed(2)))) !== JSON.stringify(expected)) {
      issues.push({ code: "commercial-mismatch", severity: "blocker", blockId: scenarioBlock.id, message: "Los precios del documento no coinciden con la cotización." });
    }
  }
  if (input.paymentSchedule?.length) {
    const sum = input.paymentSchedule.reduce((total, item) => total + Number(item.percentage || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      issues.push({ code: "payment-schedule", severity: "blocker", message: `El cronograma de pagos suma ${sum}% en lugar de 100%.` });
    }
  }
  if (!visible.some((block) => block.type === "cover")) issues.push({ code: "missing-cover", severity: "blocker", message: "Falta la portada." });
  if (!visible.some((block) => block.type === "terms")) issues.push({ code: "missing-terms", severity: "blocker", message: "Faltan las condiciones comerciales." });
  if (!visible.some((block) => block.type === "closing")) issues.push({ code: "missing-closing", severity: "warning", message: "Falta un cierre con próximo paso." });
  return issues;
}

const id = (value: string) => value;

export type ServiceBlueprintSeed = {
  slug: string;
  name: string;
  description: string;
  version: number;
  definition: BlueprintDefinition;
};

export const HISTORICAL_PROPOSAL_EVIDENCE = [
  { label: "Kimberly-Clark 2026", outcome: "won", use: "pattern" },
  { label: "Uber Intelligence Pack Mundial 2026", outcome: "won", use: "pattern" },
  { label: "Tortugas Mall Always On", outcome: "won", use: "pattern" },
  { label: "PeYa Campaña Mundial", outcome: "won", use: "pattern-and-qa" },
  { label: "Pepsico octubre 2025", outcome: "won", use: "pattern" },
  { label: "Uber fee julio/agosto 2026", outcome: "open", use: "pattern" },
  { label: "PeYa / Mercado Libre", outcome: "demo-no-conversion", use: "classification" },
  { label: "Warner", outcome: "won", use: "classification-only-until-file" },
  { label: "Banco Galicia", outcome: "evidence", use: "deliverables-and-qa" },
] as const;

export const SERVICE_BLUEPRINT_SEEDS: ServiceBlueprintSeed[] = [
  {
    slug: "demo-exploratoria",
    name: "Demo exploratoria",
    description: "Diagnóstico acotado para demostrar la capacidad analítica durante un proceso comercial.",
    version: 1,
    definition: blueprintDefinitionSchema.parse({
      commercialMotion: "demo", modality: "demo", durationMonths: 1.5, minimumTermMonths: 0,
      coverage: { markets: ["Argentina"], brands: ["Cliente"], competitors: ["Competidor"], sources: ["Social", "Reviews"], languages: ["es"], mentionVolume: "medium", analysisModules: ["brand", "competition", "experience"], slaLevel: "standard", designLevel: "branded" },
      setupRoleHours: { pm: 5, analyst: 8, data: 4 },
      deliverables: [{ id: id("a0000000-0000-4000-8000-000000000001"), name: "Demo ejecutiva", type: "executive_report", format: "pptx", cadence: "once", quantity: 1, description: "Hallazgos de muestra, hipótesis y oportunidades para decidir el siguiente paso.", acceptanceCriteria: ["Metodología y período visibles", "Hallazgos sustentados", "Próximo paso explícito"], roleHours: { director: 3, pm: 7, analyst: 24, data: 8, design: 10 } }],
      milestones: [{ id: id("a0000000-0000-4000-8000-000000000011"), name: "Kickoff", offsetDays: 0, taskNames: ["Confirmar brief", "Definir muestra"] }, { id: id("a0000000-0000-4000-8000-000000000012"), name: "Presentación", offsetDays: 15, taskNames: ["QA", "Presentar demo"] }],
      includedLicenses: true, intellectualProperty: "epical", inclusions: ["Muestra de datos", "Presentación ejecutiva"], exclusions: ["Monitoreo continuo", "Implementación posterior"], paymentTermsDays: 0, proposalValidityBusinessDays: 10, priceAdjustment: "none",
    }),
  },
  {
    slug: "estudio-one-shot",
    name: "Estudio estratégico one-shot",
    description: "Investigación completa con informe final y presentación ejecutiva.",
    version: 1,
    definition: blueprintDefinitionSchema.parse({
      commercialMotion: "new_business", modality: "one_shot", durationMonths: 1.5, minimumTermMonths: 0,
      coverage: { markets: ["Argentina"], brands: ["Cliente"], competitors: ["Competidor A", "Competidor B"], sources: ["Social", "Reviews"], languages: ["es"], mentionVolume: "large", analysisModules: ["brand", "competition", "experience", "trends"], slaLevel: "standard", designLevel: "branded" },
      setupRoleHours: { pm: 8, analyst: 12, data: 8, tech: 4 },
      deliverables: [
        { id: id("a0000000-0000-4000-8000-000000000101"), name: "Informe estratégico", type: "report", format: "pdf", cadence: "once", quantity: 1, pageRange: "25-40", description: "Diagnóstico, evidencia, insights y recomendaciones accionables.", acceptanceCriteria: ["Dataset y metodología definidos", "Conclusiones trazables", "Recomendaciones accionables"], roleHours: { director: 6, pm: 16, analyst: 72, data: 20, design: 28, tech: 8 } },
        { id: id("a0000000-0000-4000-8000-000000000102"), name: "Presentación ejecutiva", type: "presentation", format: "meeting", cadence: "once", quantity: 1, description: "Sesión de presentación, discusión y próximos pasos.", acceptanceCriteria: ["Agenda acordada", "Preguntas registradas"], roleHours: { director: 3, pm: 5, analyst: 8, design: 4 } },
      ],
      milestones: [{ id: id("a0000000-0000-4000-8000-000000000111"), name: "Kickoff", offsetDays: 0, taskNames: ["Validar objetivos", "Confirmar fuentes"] }, { id: id("a0000000-0000-4000-8000-000000000112"), name: "Avance", offsetDays: 21, taskNames: ["Revisión intermedia"] }, { id: id("a0000000-0000-4000-8000-000000000113"), name: "Entrega final", offsetDays: 42, taskNames: ["QA final", "Presentación"] }],
      includedLicenses: true, intellectualProperty: "client", inclusions: ["Licencias", "Fuentes editables bajo pedido", "Una ronda de revisión"], exclusions: ["Monitoreo posterior", "Trabajo de campo primario"], paymentTermsDays: 30, proposalValidityBusinessDays: 15, priceAdjustment: "none",
    }),
  },
  {
    slug: "intelligence-event-pack",
    name: "Intelligence Event Pack",
    description: "Cobertura intensiva y entregas periódicas durante un evento de alta conversación.",
    version: 1,
    definition: blueprintDefinitionSchema.parse({
      commercialMotion: "new_business", modality: "event_pack", durationMonths: 2, minimumTermMonths: 0,
      coverage: { markets: ["Argentina"], brands: ["Cliente"], competitors: ["Benchmark 1", "Benchmark 2", "Benchmark 3", "Benchmark 4"], sources: ["Social", "News"], languages: ["es"], mentionVolume: "xlarge", analysisModules: ["campaign", "competition", "culture", "trends", "crisis"], slaLevel: "priority", designLevel: "branded" },
      setupRoleHours: { pm: 10, analyst: 16, data: 10, tech: 6 },
      deliverables: [
        { id: id("a0000000-0000-4000-8000-000000000201"), name: "Informe semanal", type: "report", format: "pdf", cadence: "weekly", quantity: 8, pageRange: "8-14", description: "Pulso de conversación, desempeño de marca, benchmark y evolución acumulada.", acceptanceCriteria: ["Comparabilidad semanal", "Benchmark de cinco marcas", "Recomendaciones concretas"], roleHours: { director: 1, pm: 3, analyst: 13, data: 3, design: 4 } },
        { id: id("a0000000-0000-4000-8000-000000000202"), name: "Cierre ejecutivo", type: "executive_report", format: "pptx", cadence: "once", quantity: 1, description: "Síntesis acumulada, aprendizajes y próximos pasos.", acceptanceCriteria: ["Síntesis de las ocho semanas", "Recomendaciones priorizadas"], roleHours: { director: 4, pm: 6, analyst: 18, design: 10 } },
      ],
      milestones: [{ id: id("a0000000-0000-4000-8000-000000000211"), name: "Setup", offsetDays: 0, taskNames: ["Configurar queries", "Calibrar benchmark"] }, { id: id("a0000000-0000-4000-8000-000000000212"), name: "Primera entrega", offsetDays: 7, taskNames: ["QA informe 1"] }, { id: id("a0000000-0000-4000-8000-000000000213"), name: "Cierre", offsetDays: 56, taskNames: ["Consolidar aprendizajes", "Presentar cierre"] }],
      monitoringWindow: "Días hábiles de 8 a 18", alertChannels: ["email", "whatsapp"], includedLicenses: true, intellectualProperty: "client", inclusions: ["Cinco marcas", "Ocho informes", "Licencias"], exclusions: ["Mercados adicionales", "Marcas adicionales", "Alertas 24/7"], paymentTermsDays: 30, proposalValidityBusinessDays: 5, priceAdjustment: "none",
    }),
  },
  {
    slug: "fee-mensual-inteligencia",
    name: "Fee mensual de inteligencia",
    description: "Pulso táctico mensual, lectura estratégica trimestral y alertas continuas.",
    version: 1,
    definition: blueprintDefinitionSchema.parse({
      commercialMotion: "new_business", modality: "monthly_fee", durationMonths: 3, minimumTermMonths: 3,
      coverage: { markets: ["Argentina", "Chile"], brands: ["Marca"], competitors: ["Competidor"], sources: ["Social", "Reviews", "News"], languages: ["es"], mentionVolume: "large", analysisModules: ["brand", "competition", "experience", "crisis", "trends"], slaLevel: "priority", designLevel: "branded" },
      setupRoleHours: { pm: 12, analyst: 16, data: 10, tech: 8 },
      deliverables: [
        { id: id("a0000000-0000-4000-8000-000000000301"), name: "Pulso táctico mensual", type: "report", format: "pdf", cadence: "monthly", quantity: 3, pageRange: "15-25", description: "Desempeño, drivers, riesgos y oportunidades del mes.", acceptanceCriteria: ["KPIs comparables", "Implicancias para negocio", "Acciones sugeridas"], roleHours: { director: 1, pm: 5, analyst: 24, data: 5, design: 7 } },
        { id: id("a0000000-0000-4000-8000-000000000302"), name: "Cierre estratégico trimestral", type: "report", format: "pptx", cadence: "quarterly", quantity: 1, pageRange: "20-30", description: "Lectura acumulada, patrones y decisiones estratégicas.", acceptanceCriteria: ["Tendencias acumuladas", "Recomendaciones priorizadas"], roleHours: { director: 4, pm: 8, analyst: 28, data: 6, design: 12 } },
        { id: id("a0000000-0000-4000-8000-000000000303"), name: "Alertas", type: "alert", format: "mixed", cadence: "event", quantity: 1, description: "Detección y seguimiento evolutivo de incidentes relevantes.", acceptanceCriteria: ["Canal y ventana definidos", "Evolución registrada"], roleHours: { pm: 5, analyst: 18, tech: 2 } },
      ],
      milestones: [{ id: id("a0000000-0000-4000-8000-000000000311"), name: "Kickoff", offsetDays: 0, taskNames: ["Confirmar stakeholders"] }, { id: id("a0000000-0000-4000-8000-000000000312"), name: "Alertas activas", offsetDays: 7, taskNames: ["Calibrar alertas"] }, { id: id("a0000000-0000-4000-8000-000000000313"), name: "Primer informe", offsetDays: 20, taskNames: ["QA mensual"] }],
      monitoringWindow: "Días hábiles de 8 a 18", alertChannels: ["email", "whatsapp"], includedLicenses: true, intellectualProperty: "client", inclusions: ["Licencias", "Alertas en horario acordado", "Reunión mensual"], exclusions: ["Informes especiales fuera del fee", "Cobertura 24/7"], paymentTermsDays: 60, proposalValidityBusinessDays: 15, priceAdjustment: "scope_only",
    }),
  },
  {
    slug: "programa-regional-anual",
    name: "Programa regional anual",
    description: "Always-on multimarcas y multimercado con inteligencia local y consolidación regional.",
    version: 1,
    definition: blueprintDefinitionSchema.parse({
      commercialMotion: "new_business", modality: "annual_program", durationMonths: 12, minimumTermMonths: 12,
      coverage: { markets: ["Argentina", "Chile", "México", "Colombia"], brands: ["Marca A", "Marca B", "Marca C"], competitors: ["Competidor A", "Competidor B"], sources: ["Social", "Reviews", "News"], languages: ["es"], mentionVolume: "xlarge", analysisModules: ["brand", "campaign", "influencers", "competition", "crisis", "culture", "trends"], slaLevel: "priority", designLevel: "executive" },
      setupRoleHours: { director: 8, pm: 24, analyst: 30, data: 20, tech: 12, design: 8 },
      deliverables: [
        { id: id("a0000000-0000-4000-8000-000000000401"), name: "Informe local", type: "report", format: "pdf", cadence: "monthly", quantity: 48, pageRange: "12-20", description: "Lectura por mercado con KPIs, drivers y acciones.", acceptanceCriteria: ["Consistencia regional", "Contexto local", "Acciones por mercado"], roleHours: { pm: 1, analyst: 7, data: 1.5, design: 2 } },
        { id: id("a0000000-0000-4000-8000-000000000402"), name: "Consolidado regional", type: "executive_report", format: "pptx", cadence: "quarterly", quantity: 4, pageRange: "20-30", description: "Comparación regional, aprendizajes y prioridades.", acceptanceCriteria: ["Comparación normalizada", "Decisiones regionales"], roleHours: { director: 3, pm: 7, analyst: 24, data: 6, design: 10 } },
        { id: id("a0000000-0000-4000-8000-000000000403"), name: "Workshop estratégico", type: "workshop", format: "meeting", cadence: "quarterly", quantity: 4, description: "Sesión de trabajo con stakeholders regionales.", acceptanceCriteria: ["Agenda y asistentes confirmados", "Decisiones documentadas"], roleHours: { director: 3, pm: 4, analyst: 5, design: 2 } },
      ],
      milestones: [{ id: id("a0000000-0000-4000-8000-000000000411"), name: "Setup regional", offsetDays: 0, taskNames: ["Alinear taxonomías", "Configurar mercados"] }, { id: id("a0000000-0000-4000-8000-000000000412"), name: "Revisión Q1", offsetDays: 90, taskNames: ["Evaluar alcance", "Ajustar roadmap"] }],
      monitoringWindow: "Días hábiles por mercado", alertChannels: ["email", "whatsapp"], includedLicenses: true, intellectualProperty: "client", inclusions: ["Licencias", "Consolidación regional", "Workshops trimestrales"], exclusions: ["Países no contratados", "Investigación primaria"], paymentTermsDays: 90, proposalValidityBusinessDays: 15, priceAdjustment: "annual_review",
    }),
  },
  {
    slug: "renovacion-expansion",
    name: "Renovación y expansión",
    description: "Continuidad de un servicio existente con escenarios de eficiencia y ampliación.",
    version: 1,
    definition: blueprintDefinitionSchema.parse({
      commercialMotion: "renewal", modality: "renewal", durationMonths: 12, minimumTermMonths: 12,
      coverage: { markets: ["Mercado actual"], brands: ["Marca actual"], competitors: ["Competidores ilimitados"], sources: ["Social", "Reviews"], languages: ["es"], mentionVolume: "large", analysisModules: ["brand", "competition", "campaign", "crisis", "trends"], slaLevel: "priority", designLevel: "branded" },
      setupRoleHours: { director: 3, pm: 6, analyst: 6, data: 6, tech: 6 },
      deliverables: [
        { id: id("a0000000-0000-4000-8000-000000000501"), name: "Informe mensual", type: "report", format: "pdf", cadence: "monthly", quantity: 12, description: "Continuidad del pulso mensual con automatización y comparabilidad histórica.", acceptanceCriteria: ["Continuidad de KPIs", "Trazabilidad histórica"], roleHours: { director: 0.5, pm: 4, analyst: 18, data: 3, design: 5 } },
        { id: id("a0000000-0000-4000-8000-000000000502"), name: "Dashboard acumulado", type: "dashboard", format: "dashboard", cadence: "monthly", quantity: 12, description: "Acceso al histórico y navegación de indicadores acumulados.", acceptanceCriteria: ["Actualización mensual", "Acceso validado"], roleHours: { data: 2, tech: 2, analyst: 1 } },
      ],
      milestones: [{ id: id("a0000000-0000-4000-8000-000000000511"), name: "Renovación", offsetDays: 0, taskNames: ["Confirmar baseline", "Acordar mejoras"] }, { id: id("a0000000-0000-4000-8000-000000000512"), name: "Revisión de valor", offsetDays: 90, taskNames: ["Comparar eficiencia", "Revisar expansión"] }],
      monitoringWindow: "Días hábiles", alertChannels: ["email", "whatsapp"], includedLicenses: true, intellectualProperty: "client", inclusions: ["Continuidad histórica", "Automatización", "Dashboard"], exclusions: ["Nuevas marcas o mercados no seleccionados"], paymentTermsDays: 120, proposalValidityBusinessDays: 15, priceAdjustment: "annual_review",
    }),
  },
];

export function cloneBlueprintDefinition(definition: BlueprintDefinition): BlueprintDefinition {
  return blueprintDefinitionSchema.parse(structuredClone(definition));
}
