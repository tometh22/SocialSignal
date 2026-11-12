import { describe, it, expect } from "vitest";
import { opportunitySchema } from "../shared/pipeline";
import {
  createShareLinkSchema,
  isSharedUniverse,
  publicRow,
  publicShareRequestSchema,
} from "../shared/pipeline-share";

const secret = "DATO-INTERNO-NO-PUBLICAR";
const row = (patch = {}) =>
  ({
    ...opportunitySchema.parse({
      account: "Cuenta sintética",
      project: "Proyecto sintético",
      scope: "Pipeline",
      stage: "Propuesta",
      status: "Propuesta enviada",
      evidence: `Evidencia ${secret}`,
      evidenceDate: "2026-11-01",
      notes: `Notas ${secret}`,
      contact: `Contacto ${secret}`,
      valueNote: `Fundamento ${secret}`,
      sources: [
        {
          key: "s1",
          title: `Fuente ${secret}`,
          url: `https://example.org/${secret}`,
          excerpt: secret,
        },
      ],
      ...patch,
    }),
    id: 7,
    quotationId: 99,
    leadId: 12,
  }) as any;

describe("Pipeline compartido: proyección pública", () => {
  it("no expone notas, evidencia, fuentes, contactos ni vínculos internos", () => {
    const out = publicRow({ ...row(), alerts: ["Sin próximo paso"] });
    const json = JSON.stringify(out);
    expect(json).not.toContain(secret);
    expect(json).not.toContain("example.org");
    expect(Object.keys(out).sort()).toEqual(
      [
        "account",
        "alerts",
        "closeDate",
        "evidenceDate",
        "id",
        "next",
        "nextDate",
        "owner",
        "probability",
        "project",
        "scope",
        "stage",
        "status",
        "usd",
        "warner",
        "weighted",
      ].sort(),
    );
  });
  it("muestra importes y probabilidades solo cuando están respaldados", () => {
    const backed = publicRow(
      row({
        usd: "1000",
        probability: "50",
        probabilityReason: "Motivo",
        probabilitySource: "s1",
      }),
    );
    expect(backed).toMatchObject({
      usd: "1000",
      probability: "50",
      weighted: "500.00",
    });
    const unbacked = publicRow(
      row({ usd: "5000", valueNote: null, probability: "50" }),
    );
    expect(unbacked).toMatchObject({
      usd: null,
      probability: null,
      weighted: null,
    });
  });
  it("limita el universo al pipeline comercial", () => {
    expect(isSharedUniverse(row())).toBe(true);
    for (const scope of [
      "Validación CRM",
      "Cerrada / confirmada",
      "Descartada",
    ])
      expect(isSharedUniverse(row({ scope }))).toBe(false);
  });
  it("valida tokens y vencimientos", () => {
    expect(
      publicShareRequestSchema.safeParse({ token: "a".repeat(64) }).success,
    ).toBe(true);
    for (const token of ["", "a".repeat(63), "Z".repeat(64), "../".repeat(22)])
      expect(publicShareRequestSchema.safeParse({ token }).success).toBe(false);
    expect(createShareLinkSchema.parse({ label: " Fede " })).toEqual({
      label: "Fede",
      expiresInDays: 30,
    });
    expect(
      createShareLinkSchema.safeParse({ label: "Fede", expiresInDays: 365 })
        .success,
    ).toBe(false);
    expect(createShareLinkSchema.safeParse({ label: "" }).success).toBe(false);
  });
});
