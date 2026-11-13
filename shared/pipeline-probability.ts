import { z } from "zod";

/**
 * Modelo de probabilidad del pipeline: explicable, versionado y aprobado.
 *
 * probabilidad = base de la etapa
 *              + señales automáticas (cliente actual, renovación, decisor, fecha, sin respuesta, competencia)
 *              + criterio del equipo (señales del catálogo + ajuste libre, tope ±25)
 * acotada entre `floor` y `ceiling`. Una probabilidad propia respaldada siempre la reemplaza.
 *
 * Aprende con los cierres: las bases y los pesos sugeridos mezclan la referencia
 * (que cuenta como `priorWeight` casos) con lo observado, y solo cambian cuando
 * alguien aprueba una versión nueva.
 */
export const modelStages = [
  "Prospección",
  "Reunión / demo",
  "Propuesta",
  "Negociación",
] as const;
const points = z.number().int().min(-50).max(50);
export const teamSignalSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,40}$/),
  label: z.string().trim().min(2).max(80),
  points,
});
export const probabilityModelSchema = z.object({
  stageBase: z.object(
    Object.fromEntries(
      modelStages.map((s) => [s, z.number().int().min(0).max(100)]),
    ) as Record<(typeof modelStages)[number], z.ZodNumber>,
  ),
  automatic: z.object({
    existingClient: points,
    renewal: points,
    decisionMaker: points,
    knownCloseDate: points,
    closeDateWithinDays: z.number().int().min(1).max(365),
    stalePenalty: points,
    staleAfterDays: z.number().int().min(1).max(365),
    competition: points,
  }),
  teamSignals: z.array(teamSignalSchema).max(30),
  maxTeamAdjustment: z.number().int().min(0).max(50),
  manualRange: z.number().int().min(0).max(50),
  manualExpiryDays: z.number().int().min(1).max(180),
  floor: z.number().int().min(0).max(100),
  ceiling: z.number().int().min(0).max(100),
  priorWeight: z.number().int().min(1).max(100),
  minOutcomesForSignals: z.number().int().min(1).max(500),
});
export type ProbabilityModel = z.infer<typeof probabilityModelSchema>;

/** Versión 1: valores de referencia aprobados por Tomás el 13/11/2026. */
export const referenceModel: ProbabilityModel = {
  stageBase: {
    Prospección: 10,
    "Reunión / demo": 20,
    Propuesta: 40,
    Negociación: 70,
  },
  automatic: {
    existingClient: 15,
    renewal: 25,
    decisionMaker: 10,
    knownCloseDate: 5,
    closeDateWithinDays: 60,
    stalePenalty: -20,
    staleAfterDays: 30,
    competition: -10,
  },
  teamSignals: [
    {
      key: "prioridad",
      label: "El cliente dijo que nos va a dar prioridad",
      points: 10,
    },
    {
      key: "relacion-decisor",
      label: "Relación cercana con el decisor",
      points: 5,
    },
    {
      key: "propuesta-solida",
      label: "Propuesta sólida / diferencial claro",
      points: 5,
    },
    {
      key: "mas-caros",
      label: "Somos más caros que la competencia",
      points: -10,
    },
    {
      key: "cambio-interlocutor",
      label: "Cambió el interlocutor o hay reestructura",
      points: -10,
    },
    {
      key: "presupuesto-en-duda",
      label: "Presupuesto en duda o congelado",
      points: -15,
    },
  ],
  maxTeamAdjustment: 25,
  manualRange: 20,
  manualExpiryDays: 30,
  floor: 5,
  ceiling: 90,
  priorWeight: 10,
  minOutcomesForSignals: 30,
};

/** Datos de la ficha que usa el modelo (todos opcionales en fichas viejas). */
export type ScoringInput = {
  stage: string;
  evidenceDate?: string | null;
  closeDate?: string | null;
  renewal?: boolean;
  decisionMakerConfirmed?: boolean;
  competition?: boolean;
  teamSignals?: string[];
  manualAdjustment?: {
    points: number;
    reason: string;
    by?: string | null;
    at: string;
  } | null;
};
export type ScoreContext = { existingClient: boolean; today: string };
export type ScorePart = {
  key: string;
  label: string;
  points: number;
  kind: "base" | "auto" | "team" | "manual";
};
export type ModelScore = {
  /** Probabilidad final del modelo, en %. `null` si la etapa no tiene base. */
  probability: number | null;
  /** Solo la parte objetiva (base + automáticas), para medir el aporte humano. */
  modelOnly: number | null;
  parts: ScorePart[];
  teamTotal: number;
  manualExpired: boolean;
};

const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function scoreOpportunity(
  r: ScoringInput,
  model: ProbabilityModel,
  ctx: ScoreContext,
): ModelScore {
  const base = (model.stageBase as Record<string, number>)[r.stage];
  if (base === undefined)
    return {
      probability: null,
      modelOnly: null,
      parts: [],
      teamTotal: 0,
      manualExpired: false,
    };
  const a = model.automatic;
  const parts: ScorePart[] = [
    { key: "base", label: `Etapa ${r.stage}`, points: base, kind: "base" },
  ];
  if (r.renewal)
    parts.push({
      key: "renewal",
      label: "Renovación de un servicio vigente",
      points: a.renewal,
      kind: "auto",
    });
  else if (ctx.existingClient)
    parts.push({
      key: "existing-client",
      label: "Cliente actual",
      points: a.existingClient,
      kind: "auto",
    });
  if (r.decisionMakerConfirmed)
    parts.push({
      key: "decision-maker",
      label: "Decisor y presupuesto confirmados",
      points: a.decisionMaker,
      kind: "auto",
    });
  if (r.closeDate) {
    const left = days(ctx.today, r.closeDate);
    if (left >= 0 && left <= a.closeDateWithinDays)
      parts.push({
        key: "close-date",
        label: `Decisión en ${left} días`,
        points: a.knownCloseDate,
        kind: "auto",
      });
  }
  if (!r.evidenceDate || days(r.evidenceDate, ctx.today) > a.staleAfterDays)
    parts.push({
      key: "stale",
      label: r.evidenceDate
        ? `Sin novedades hace ${days(r.evidenceDate, ctx.today)} días`
        : "Sin fecha de última evidencia",
      points: a.stalePenalty,
      kind: "auto",
    });
  if (r.competition)
    parts.push({
      key: "competition",
      label: "Licitación o compite con otros",
      points: a.competition,
      kind: "auto",
    });
  const modelOnly = clamp(
    parts.reduce((s, p) => s + p.points, 0),
    model.floor,
    model.ceiling,
  );
  // Criterio del equipo: señales del catálogo + ajuste libre vigente, con tope.
  const team: ScorePart[] = [];
  for (const key of r.teamSignals ?? []) {
    const s = model.teamSignals.find((t) => t.key === key);
    if (s)
      team.push({
        key: `team:${s.key}`,
        label: s.label,
        points: s.points,
        kind: "team",
      });
  }
  let manualExpired = false;
  const m = r.manualAdjustment;
  if (m && m.points) {
    manualExpired = days(m.at, ctx.today) > model.manualExpiryDays;
    if (!manualExpired)
      team.push({
        key: "manual",
        label: `Ajuste del equipo: ${m.reason}`,
        points: clamp(m.points, -model.manualRange, model.manualRange),
        kind: "manual",
      });
  }
  const rawTeam = team.reduce((s, p) => s + p.points, 0);
  const teamTotal = clamp(
    rawTeam,
    -model.maxTeamAdjustment,
    model.maxTeamAdjustment,
  );
  return {
    probability: clamp(
      parts.reduce((s, p) => s + p.points, 0) + teamTotal,
      model.floor,
      model.ceiling,
    ),
    modelOnly,
    parts: [...parts, ...team],
    teamTotal,
    manualExpired,
  };
}

/** Cierre registrado (ganada o perdida) con lo que se sabía al cerrar. */
export type Outcome = {
  result: "won" | "lost";
  stagesReached: string[];
  /** Claves de señales presentes al cerrar: existing-client, renewal, team:prioridad… */
  signals: string[];
  /** Probabilidad que daba el modelo al cerrar (final y solo objetiva). */
  predictedFinal: number | null;
  predictedModel: number | null;
};

/** Mezcla la referencia (cuenta como `weight` casos) con lo observado. */
export const shrink = (
  prior: number,
  observed: number,
  n: number,
  weight: number,
) => (prior * weight + observed * n) / (weight + n);

const brier = (pairs: [number, number][]) =>
  pairs.length
    ? pairs.reduce((s, [p, y]) => s + (p / 100 - y) ** 2, 0) / pairs.length
    : null;

export function learnFromOutcomes(
  model: ProbabilityModel,
  outcomes: Outcome[],
) {
  const won = (o: Outcome) => (o.result === "won" ? 1 : 0);
  const stages = modelStages.map((stage) => {
    const reached = outcomes.filter((o) => o.stagesReached.includes(stage));
    const wins = reached.filter((o) => o.result === "won").length;
    const current = model.stageBase[stage];
    const observed = reached.length ? (wins / reached.length) * 100 : null;
    return {
      stage,
      current,
      n: reached.length,
      wins,
      observed,
      suggested:
        observed === null
          ? current
          : Math.round(
              shrink(current, observed, reached.length, model.priorWeight),
            ),
    };
  });
  const a = model.automatic;
  const signalCatalog: { key: string; label: string; current: number }[] = [
    {
      key: "existing-client",
      label: "Cliente actual",
      current: a.existingClient,
    },
    { key: "renewal", label: "Renovación", current: a.renewal },
    {
      key: "decision-maker",
      label: "Decisor y presupuesto confirmados",
      current: a.decisionMaker,
    },
    {
      key: "close-date",
      label: "Fecha de decisión cercana",
      current: a.knownCloseDate,
    },
    { key: "stale", label: "Sin respuesta", current: a.stalePenalty },
    {
      key: "competition",
      label: "Licitación o competencia",
      current: a.competition,
    },
    ...model.teamSignals.map((t) => ({
      key: `team:${t.key}`,
      label: t.label,
      current: t.points,
    })),
  ];
  const ready = outcomes.length >= model.minOutcomesForSignals;
  const signals = signalCatalog.map((s) => {
    const withS = outcomes.filter((o) => o.signals.includes(s.key));
    const without = outcomes.filter((o) => !o.signals.includes(s.key));
    const rate = (xs: Outcome[]) =>
      xs.length ? (xs.reduce((t, o) => t + won(o), 0) / xs.length) * 100 : null;
    const rWith = rate(withS),
      rWithout = rate(without);
    const effect =
      rWith !== null && rWithout !== null ? rWith - rWithout : null;
    return {
      ...s,
      n: withS.length,
      winRateWith: rWith,
      winRateWithout: rWithout,
      observedEffect: effect === null ? null : Math.round(effect),
      suggested:
        ready && effect !== null && withS.length >= 5
          ? Math.round(
              shrink(s.current, effect, withS.length, model.priorWeight),
            )
          : s.current,
    };
  });
  const scored = outcomes.filter((o) => o.predictedFinal !== null);
  const buckets = [0, 20, 40, 60, 80].map((lo) => {
    const hi = lo + 20;
    const xs = scored.filter(
      (o) =>
        o.predictedFinal! >= lo &&
        (o.predictedFinal! < hi || (hi === 100 && o.predictedFinal! <= 100)),
    );
    return {
      range: `${lo}–${hi}%`,
      n: xs.length,
      predicted: xs.length
        ? Math.round(xs.reduce((s, o) => s + o.predictedFinal!, 0) / xs.length)
        : null,
      actual: xs.length
        ? Math.round((xs.reduce((s, o) => s + won(o), 0) / xs.length) * 100)
        : null,
    };
  });
  return {
    total: outcomes.length,
    won: outcomes.filter((o) => o.result === "won").length,
    lost: outcomes.filter((o) => o.result === "lost").length,
    signalsReady: ready,
    stages,
    signals,
    calibration: {
      buckets,
      // Error cuadrático medio (0 = perfecto, 0,25 = como tirar una moneda).
      brierFinal: brier(scored.map((o) => [o.predictedFinal!, won(o)])),
      brierModel: brier(
        outcomes
          .filter((o) => o.predictedModel !== null)
          .map((o) => [o.predictedModel!, won(o)]),
      ),
    },
  };
}
export type Learning = ReturnType<typeof learnFromOutcomes>;

/** Versión sugerida a partir del aprendizaje (no se aplica sin aprobación). */
export function suggestedModel(
  model: ProbabilityModel,
  learning: Learning,
): ProbabilityModel {
  const next: ProbabilityModel = structuredClone(model);
  for (const s of learning.stages) next.stageBase[s.stage] = s.suggested;
  const byKey = new Map(learning.signals.map((s) => [s.key, s.suggested]));
  const a = next.automatic;
  a.existingClient = byKey.get("existing-client") ?? a.existingClient;
  a.renewal = byKey.get("renewal") ?? a.renewal;
  a.decisionMaker = byKey.get("decision-maker") ?? a.decisionMaker;
  a.knownCloseDate = byKey.get("close-date") ?? a.knownCloseDate;
  a.stalePenalty = byKey.get("stale") ?? a.stalePenalty;
  a.competition = byKey.get("competition") ?? a.competition;
  next.teamSignals = next.teamSignals.map((t) => ({
    ...t,
    points: byKey.get(`team:${t.key}`) ?? t.points,
  }));
  return next;
}

/** Claves de señales presentes en una puntuación, para guardar con el cierre. */
export const scoreSignals = (score: ModelScore) =>
  score.parts
    .filter((p) => p.kind === "auto" || p.kind === "team")
    .map((p) => p.key);
