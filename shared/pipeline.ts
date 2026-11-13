import { z } from "zod";
import { isValidCivilDate } from "./utils/task-civil-date";
export const stages = [
  "Prospección",
  "Reunión / demo",
  "Propuesta",
  "Negociación",
  "Confirmada",
  "Sin etapa verificada",
] as const;
export const scopes = [
  "Pipeline",
  "Validación CRM",
  "Cerrada / confirmada",
  "Descartada",
] as const;
export const statuses = [
  "Exploratoria",
  "Propuesta enviada",
  "Confirmada",
  "Por validar",
  "Descartada",
] as const;
const text = z.string().trim().max(4000).nullable().default(null);
const date = z
  .string()
  .refine(isValidCivilDate, "Fecha inválida")
  .nullable()
  .default(null);
const decimal = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/)
  .nullable()
  .default(null);
const id = z.number().int().positive().nullable().default(null);
export const sourceSchema = z.object({
  key: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  url: z
    .string()
    .url()
    .refine((v) => /^https?:\/\//.test(v)),
  date,
  excerpt: text,
  kind: z.enum(["external", "crm", "quotation"]).default("external"),
});
export const opportunitySchema = z
  .object({
    account: z.string().trim().min(1).max(255),
    project: text,
    leadId: id,
    clientId: id,
    ownerId: id,
    contactId: id,
    quotationId: id,
    quotationGroupId: id,
    contact: text,
    owner: text,
    stage: z.enum(stages).default("Sin etapa verificada"),
    status: z.enum(statuses).default("Por validar"),
    scope: z.enum(scopes).default("Validación CRM"),
    stageReason: text,
    usd: decimal,
    valueNote: text,
    originalAmount: decimal,
    currency: z.enum(["USD", "ARS", "EUR"]).nullable().default(null),
    priceBasis: text,
    durationMonths: z.number().int().positive().nullable().default(null),
    conversion: z
      .object({
        rate: z.string().regex(/^\d+(\.\d+)?$/),
        direction: z.enum(["multiply", "divide"]),
        date: z.string().refine(isValidCivilDate),
        source: z.string().min(1),
        criterion: z.string().min(1),
      })
      .nullable()
      .default(null),
    probability: decimal.refine((v) => v === null || Number(v) <= 100),
    probabilityReason: text,
    probabilitySource: text,
    closeDate: date,
    next: text,
    nextDate: date,
    evidenceDate: date,
    evidence: text,
    confidence: z.enum(["Alta", "Media", "Baja"]).default("Media"),
    sources: z.array(sourceSchema).max(40).default([]),
    warner: z.boolean().default(false),
    warnerBasis: text,
    notes: text,
    eligible: z.boolean().default(true),
    exclusionReason: text,
    legacyEstimatedUsd: decimal,
    crmUpdatedAtReference: date,
    // Señales del modelo de probabilidad (ver shared/pipeline-probability.ts).
    renewal: z.boolean().default(false),
    decisionMakerConfirmed: z.boolean().default(false),
    competition: z.boolean().default(false),
    teamSignals: z.array(z.string().max(40)).max(30).default([]),
    manualAdjustment: z
      .object({
        points: z.number().int().min(-50).max(50),
        reason: z.string().trim().min(3).max(500),
        by: z.string().max(120).nullable().default(null),
        at: z.string().refine(isValidCivilDate),
      })
      .nullable()
      .default(null),
  })
  .strict();
export type Opportunity = z.infer<typeof opportunitySchema> & {
  id?: number;
  version?: number;
  /** Probabilidad del modelo aprobado (%), calculada por el servidor; no se guarda en la ficha. */
  modelProbability?: number | null;
  importKey?: string;
  nativeStage?: string | null;
};
export function validateOpportunity(input: unknown): Opportunity {
  const r = opportunitySchema.parse(input);
  if (
    r.probability !== null &&
    (!r.probabilityReason ||
      !r.probabilitySource ||
      !r.sources.some((s) => s.key === r.probabilitySource))
  )
    throw new Error(
      "La probabilidad requiere motivo y una clave de fuente verificable",
    );
  if (r.usd !== null && (!r.valueNote || !r.sources.length))
    throw new Error("El valor USD requiere fundamento y fuente");
  if (r.usd !== null && r.currency && r.currency !== "USD" && !r.conversion)
    throw new Error("Falta equivalencia aprobada");
  if (r.warner && !r.warnerBasis)
    throw new Error("Falta fundamento del vínculo Warner");
  if (
    (r.status === "Confirmada" || r.stage === "Confirmada") &&
    r.scope !== "Cerrada / confirmada"
  )
    throw new Error("Conciliá confirmación y alcance");
  if (r.status === "Descartada" && r.scope !== "Descartada")
    throw new Error("Conciliá descarte y alcance");
  if (r.scope === "Cerrada / confirmada" && r.status !== "Confirmada")
    throw new Error("Falta estado confirmado");
  if (r.scope === "Descartada" && r.status !== "Descartada")
    throw new Error("Falta estado descartado");
  if (
    r.scope === "Pipeline" &&
    (!r.evidence || !r.sources.length || !r.evidenceDate)
  )
    throw new Error("El pipeline requiere señal comercial fechada y fuente");
  if (!r.eligible && !r.exclusionReason)
    throw new Error("Indicá por qué se excluye este alcance");
  return r;
}
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function cents(v: string) {
  const [a, b = ""] = v.split(".");
  return BigInt(a) * BigInt(100) + BigInt(b.padEnd(2, "0"));
}
function money(v: bigint) {
  return `${v / BigInt(100)}.${(v % BigInt(100)).toString().padStart(2, "0")}`;
}
export function usableValue(r: Opportunity) {
  return (
    r.usd !== null &&
    !!r.valueNote &&
    r.sources.length > 0 &&
    (!r.currency || r.currency === "USD" || !!r.conversion)
  );
}
export function usableProbability(r: Opportunity) {
  return (
    r.probability !== null &&
    Number(r.probability) <= 100 &&
    !!r.probabilityReason &&
    r.sources.some((s) => s.key === r.probabilitySource)
  );
}
/**
 * Probabilidad con la que se pondera: la propia respaldada (motivo + fuente)
 * o, si no hay, la del modelo aprobado que calculó el servidor.
 */
export function effectiveProbability(r: Opportunity): {
  value: string | null;
  basis: "own" | "model" | null;
} {
  if (usableProbability(r)) return { value: r.probability, basis: "own" };
  if (typeof r.modelProbability === "number")
    return { value: String(r.modelProbability), basis: "model" };
  return { value: null, basis: null };
}
export function alerts(r: Opportunity, day = localDay()) {
  return [
    !r.next && "Sin próximo paso",
    !usableValue(r) && "Sin valor USD",
    !effectiveProbability(r).value && "Sin probabilidad respaldada",
    (!r.evidenceDate ||
      (Date.parse(day) - Date.parse(r.evidenceDate)) / 86400000 >= 30) &&
      "Evidencia desactualizada",
    !r.closeDate && "Sin fecha objetivo",
  ].filter(Boolean) as string[];
}
/** Oportunidad vigente del pipeline abierto: la base de bruto, ponderado y cobertura. */
export function isOpenOpportunity(r: Opportunity) {
  return (
    r.scope === "Pipeline" &&
    r.eligible &&
    !["Confirmada", "Descartada"].includes(r.status) &&
    r.stage !== "Confirmada"
  );
}
export function metrics(rows: Opportunity[]) {
  const open = rows.filter(isOpenOpportunity);
  const valued = open.filter(usableValue),
    weighted = valued.filter((r) => effectiveProbability(r).value !== null);
  const sum = valued.reduce((a, r) => a + cents(r.usd!), BigInt(0));
  const weight = weighted.reduce(
    (a, r) => a + cents(r.usd!) * cents(effectiveProbability(r).value!),
    BigInt(0),
  );
  return {
    open: open.length,
    gross: valued.length ? money(sum) : null,
    weighted: weighted.length
      ? money((weight + BigInt(5000)) / BigInt(10000))
      : null,
    valueCoverage: valued.length,
    weightedCoverage: weighted.length,
  };
}
export const sortKeys = [
  "account",
  "stage",
  "usd",
  "weighted",
  "closeDate",
  "evidenceDate",
] as const;
export type SortKey = (typeof sortKeys)[number];
export const sortSchema = z
  .string()
  .regex(new RegExp(`^-?(${sortKeys.join("|")})$`));
/**
 * Ordena la cartera completa antes de paginar. Los datos pendientes van
 * siempre al final, en cualquier dirección, y los empates conservan el orden
 * original (última evidencia primero).
 */
export function sortOpportunities<T extends Opportunity>(
  rows: T[],
  sort?: string | null,
): T[] {
  if (!sort) return rows;
  const desc = sort.startsWith("-");
  const key = (desc ? sort.slice(1) : sort) as SortKey;
  const value = (r: T): string | number | null => {
    switch (key) {
      case "account":
        return r.account.toLocaleLowerCase("es");
      case "stage":
        return stages.indexOf(r.stage as (typeof stages)[number]);
      case "usd":
        return usableValue(r) ? Number(r.usd) : null;
      case "weighted": {
        const p = effectiveProbability(r).value;
        return usableValue(r) && p !== null
          ? (Number(r.usd) * Number(p)) / 100
          : null;
      }
      case "closeDate":
        return r.closeDate ?? null;
      case "evidenceDate":
        return r.evidenceDate ?? null;
      default:
        return null;
    }
  };
  return rows
    .map((r, i) => ({ r, i, v: value(r) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null)
        return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const c =
        typeof a.v === "string"
          ? a.v.localeCompare(b.v as string, "es")
          : a.v - (b.v as number);
      return (desc ? -c : c) || a.i - b.i;
    })
    .map((x) => x.r);
}
export function summarize(
  rows: Opportunity[],
  day = localDay(),
  threshold = 50,
) {
  const m = metrics(rows),
    w = metrics(rows.filter((r) => r.warner));
  const countPct = m.open ? (w.open / m.open) * 100 : null;
  const valuePct =
    m.gross !== null && Number(m.gross) > 0 && (!w.open || w.gross !== null)
      ? (Number(w.gross ?? 0) / Number(m.gross)) * 100
      : null;
  return {
    ...m,
    scopeCounts: Object.fromEntries(scopes.map(scope => [scope, rows.filter(row => row.scope === scope).length])),
    alertCounts: Object.fromEntries(["Sin próximo paso", "Sin valor USD", "Sin probabilidad respaldada", "Evidencia desactualizada", "Sin fecha objetivo"].map(label => [label, rows.filter(row => alerts(row, day).includes(label)).length])),
    alerted: rows.filter(
      (r) => r.scope === "Pipeline" && r.eligible && alerts(r, day).length,
    ).length,
    stages: stages.map((stage) => ({
      stage,
      ...metrics(rows.filter((r) => r.stage === stage)),
    })),
    warner: {
      ...w,
      countPct,
      valuePct,
      partial: m.valueCoverage < m.open,
      threshold,
      signal: valuePct !== null && valuePct >= threshold,
      outside: metrics(rows.filter((r) => !r.warner)),
    },
  };
}
export function executiveSummary(
  rows: Opportunity[],
  period: string,
  createdAt: string,
  threshold = 50,
  comparison = "Pendiente",
  decisions: string[] = [],
) {
  const s = summarize(rows, localDay(new Date(createdAt)), threshold);
  const val = (v: string | null) =>
    v === null
      ? "Pendiente"
      : `USD ${Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  return [
    `Pipeline comercial · ${period} · corte ${new Date(createdAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23" })}`,
    `Abiertas: ${s.open}. Bruto: ${val(s.gross)} (${s.valueCoverage}/${s.open}). Ponderado: ${val(s.weighted)} (${s.weightedCoverage}/${s.open})${rows.some((r) => typeof r.modelProbability === "number") ? "; usa la probabilidad propia o, si no hay, la del modelo aprobado" : ""}.`,
    ...s.stages.map(
      (v) =>
        `${v.stage}: ${v.open} · ${val(v.gross)} (${v.valueCoverage}/${v.open}) · ponderado ${val(v.weighted)} (${v.weightedCoverage}/${v.open})`,
    ),
    `Comparación anterior: ${comparison}`,
    `Alertas: ${s.alerted}`,
    `Warner: ${s.warner.open}/${s.open}; valor ${s.warner.valuePct === null ? "Pendiente" : s.warner.valuePct.toFixed(2) + "%"}; cobertura ${s.warner.partial ? "parcial" : "completa"}; umbral ${threshold}%.`,
    `Decisiones: ${decisions.join("; ") || "Pendiente"}`,
    "Próximos hitos:",
    ...rows
      .filter((r) => r.next)
      .map((r) => `${r.account}: ${r.next} · ${r.nextDate ?? "Pendiente"}`),
  ].join("\n");
}
