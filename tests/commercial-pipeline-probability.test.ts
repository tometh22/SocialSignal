import { describe, it, expect } from "vitest";
import {
  opportunitySchema,
  metrics,
  alerts,
  effectiveProbability,
} from "../shared/pipeline";
import {
  referenceModel,
  scoreOpportunity,
  learnFromOutcomes,
  suggestedModel,
  scoreSignals,
  probabilityModelSchema,
  POINT_LIMIT,
  type Outcome,
} from "../shared/pipeline-probability";

const today = "2026-11-13";
const ctx = (existingClient = false) => ({ existingClient, today });
const row = (patch = {}) =>
  opportunitySchema.parse({
    account: "Cuenta sintética",
    scope: "Pipeline",
    stage: "Propuesta",
    status: "Propuesta enviada",
    evidence: "Propuesta enviada",
    evidenceDate: "2026-11-10",
    usd: "10000",
    valueNote: "Cotización",
    sources: [{ key: "s1", title: "Fuente", url: "https://example.org/x" }],
    ...patch,
  });

describe("Modelo de probabilidad: puntuación", () => {
  it("la v1 sembrada es válida", () =>
    expect(probabilityModelSchema.safeParse(referenceModel).success).toBe(
      true,
    ));
  it("base de etapa + cliente actual, con desglose", () => {
    const s = scoreOpportunity(row(), referenceModel, ctx(true));
    expect(s.probability).toBe(55);
    expect(s.parts.map((p) => [p.key, p.points])).toEqual([
      ["base", 40],
      ["existing-client", 15],
    ]);
  });
  it("renovación reemplaza a cliente actual; decisor, fecha cercana y competencia suman", () => {
    const s = scoreOpportunity(
      row({
        renewal: true,
        decisionMakerConfirmed: true,
        closeDate: "2026-12-01",
        competition: true,
      }),
      referenceModel,
      ctx(true),
    );
    expect(scoreSignals(s)).toEqual([
      "renewal",
      "decision-maker",
      "close-date",
      "competition",
    ]);
    expect(s.probability).toBe(40 + 25 + 10 + 5 - 10);
  });
  it("penaliza sin respuesta hace más de 30 días o sin fecha de evidencia", () => {
    expect(
      scoreOpportunity(
        row({ evidenceDate: "2026-10-01" }),
        referenceModel,
        ctx(),
      ).probability,
    ).toBe(20);
    expect(
      scoreOpportunity(row({ evidenceDate: null }), referenceModel, ctx())
        .probability,
    ).toBe(20);
  });
  it("el criterio del equipo tiene tope ±25 y el ajuste libre vence a los 30 días", () => {
    const team = row({
      teamSignals: ["prioridad", "relacion-decisor", "propuesta-solida"],
      manualAdjustment: {
        points: 20,
        reason: "El comité ya nos eligió",
        by: "Vicky",
        at: "2026-11-10",
      },
    });
    const s = scoreOpportunity(team, referenceModel, ctx());
    expect(s.teamTotal).toBe(25);
    expect(s.probability).toBe(65);
    expect(s.modelOnly).toBe(40);
    const old = scoreOpportunity(
      {
        ...team,
        teamSignals: [],
        manualAdjustment: { ...team.manualAdjustment!, at: "2026-09-01" },
      },
      referenceModel,
      ctx(),
    );
    expect(old.manualExpired).toBe(true);
    expect(old.probability).toBe(40);
  });
  it("respeta mínimo y máximo, y no puntúa etapas fuera del embudo", () => {
    expect(
      scoreOpportunity(
        row({
          stage: "Negociación",
          renewal: true,
          decisionMakerConfirmed: true,
        }),
        referenceModel,
        ctx(),
      ).probability,
    ).toBe(90);
    expect(
      scoreOpportunity(
        row({ stage: "Prospección", evidenceDate: null, competition: true }),
        referenceModel,
        ctx(),
      ).probability,
    ).toBe(5);
    expect(
      scoreOpportunity(
        row({ stage: "Sin etapa verificada" }),
        referenceModel,
        ctx(),
      ).probability,
    ).toBeNull();
  });
});

describe("Modelo de probabilidad: ponderado", () => {
  it("usa la probabilidad propia respaldada antes que la del modelo", () => {
    const own = {
      ...row({
        probability: "25",
        probabilityReason: "Mail",
        probabilitySource: "s1",
      }),
      modelProbability: 55,
    };
    expect(effectiveProbability(own)).toEqual({ value: "25", basis: "own" });
    expect(metrics([own]).weighted).toBe("2500.00");
  });
  it("sin probabilidad propia pondera con el modelo y deja de alertar", () => {
    const m = { ...row(), modelProbability: 55 };
    expect(effectiveProbability(m)).toEqual({ value: "55", basis: "model" });
    expect(metrics([m])).toMatchObject({
      weighted: "5500.00",
      weightedCoverage: 1,
    });
    expect(alerts(m, today)).not.toContain("Sin probabilidad respaldada");
    expect(alerts(row(), today)).toContain("Sin probabilidad respaldada");
  });
});

describe("Modelo de probabilidad: aprendizaje", () => {
  const o = (
    result: "won" | "lost",
    signals: string[] = [],
    p: number | null = 40,
  ): Outcome => ({
    result,
    stagesReached: ["Propuesta"],
    signals,
    predictedFinal: p,
    predictedModel: p,
  });
  it("sin cierres no cambia nada", () => {
    const l = learnFromOutcomes(referenceModel, []);
    expect(l.total).toBe(0);
    expect(suggestedModel(referenceModel, l)).toEqual(referenceModel);
  });
  it("mezcla la referencia con lo observado: 5 de 20 propuestas → 30%", () => {
    const outcomes = [...Array(5)]
      .map(() => o("won"))
      .concat([...Array(15)].map(() => o("lost")));
    const l = learnFromOutcomes(referenceModel, outcomes);
    const propuesta = l.stages.find((s) => s.stage === "Propuesta")!;
    expect(propuesta).toMatchObject({
      n: 20,
      wins: 5,
      observed: 25,
      suggested: 30,
    });
    expect(l.stages.find((s) => s.stage === "Negociación")!.suggested).toBe(70);
  });
  it("las señales solo se recalibran con suficientes cierres", () => {
    const few = learnFromOutcomes(referenceModel, [
      o("won", ["team:prioridad"]),
      o("lost"),
    ]);
    expect(few.signalsReady).toBe(false);
    expect(few.signals.find((s) => s.key === "team:prioridad")!.suggested).toBe(
      10,
    );
    const many = [...Array(10)]
      .map(() => o("won", ["team:prioridad"]))
      .concat([...Array(20)].map(() => o("lost")));
    const l = learnFromOutcomes(referenceModel, many);
    const prio = l.signals.find((s) => s.key === "team:prioridad")!;
    expect(l.signalsReady).toBe(true);
    expect(prio).toMatchObject({ n: 10, observedEffect: 100 });
    // (10·10 + 100·10) / 20 = 55, fuera del rango permitido: se acota a +50.
    expect(prio.suggested).toBe(POINT_LIMIT);
    expect(
      probabilityModelSchema.safeParse(suggestedModel(referenceModel, l))
        .success,
    ).toBe(true);
  });
  it("la versión sugerida siempre se puede aprobar, aun con resultados extremos", () => {
    const signals = [
      "existing-client",
      "renewal",
      "decision-maker",
      "close-date",
      "stale",
      "competition",
      ...referenceModel.teamSignals.map((t) => `team:${t.key}`),
    ];
    const all = (result: "won" | "lost", withSignals: boolean) =>
      [...Array(40)].map(() => ({
        result,
        stagesReached: [
          "Prospección",
          "Reunión / demo",
          "Propuesta",
          "Negociación",
        ],
        signals: withSignals ? signals : [],
        predictedFinal: 50,
        predictedModel: 50,
      }));
    for (const outcomes of [
      [...all("won", true), ...all("lost", false)],
      [...all("lost", true), ...all("won", false)],
      all("won", true),
      all("lost", false),
    ]) {
      const next = suggestedModel(
        referenceModel,
        learnFromOutcomes(referenceModel, outcomes),
      );
      expect(probabilityModelSchema.safeParse(next).success).toBe(true);
    }
  });
  it("mide calibración y error (Brier)", () => {
    const l = learnFromOutcomes(referenceModel, [
      o("won", [], 80),
      o("lost", [], 20),
    ]);
    expect(l.calibration.brierFinal).toBeCloseTo(0.04);
    expect(
      l.calibration.buckets.find((b) => b.range === "80–100%"),
    ).toMatchObject({ n: 1, actual: 100 });
  });
});
