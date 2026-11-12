import { describe, it, expect } from "vitest";
import { opportunitySchema } from "../shared/pipeline";
import {
  createShareLinkSchema,
  publicPipeline,
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
  }) as any;

describe("Pipeline compartido: proyección pública", () => {
  const out = publicPipeline(
    [
      row({ usd: "1000", probability: "50", probabilityReason: "Motivo", probabilitySource: "s1", next: "Llamar" }),
      row({ account: "Sin respaldo", usd: "5000", valueNote: null }),
      row({ account: "Confirmada", stage: "Confirmada", status: "Confirmada", usd: "9000" }),
      row({ account: "Validación", scope: "Validación CRM" }),
    ],
    "2026-11-12T15:00:00Z",
    "Fede",
    null,
  );
  it("no expone notas, evidencia, fuentes, contactos ni identificadores", () => {
    const json = JSON.stringify(out);
    expect(json).not.toContain(secret);
    expect(json).not.toContain("example.org");
    expect(Object.keys(out.rows[0]).sort()).toEqual(
      ["account", "closeDate", "next", "nextDate", "owner", "probability", "project", "stage", "status", "usd", "warner", "weighted"].sort(),
    );
  });
  it("muestra solo la cartera abierta e importes respaldados", () => {
    expect(out.rows.map((r) => r.account).sort()).toEqual(["Cuenta sintética", "Sin respaldo"]);
    const backed = out.rows.find((r) => r.account === "Cuenta sintética")!;
    expect(backed).toMatchObject({ usd: "1000", probability: "50", weighted: "500.00", next: "Llamar" });
    expect(out.rows.find((r) => r.account === "Sin respaldo")!.usd).toBeNull();
    expect(out.summary).toMatchObject({ open: 2, gross: "1000.00", valueCoverage: 1 });
    expect(out.summary.stages.map((s) => s.stage)).toEqual(["Propuesta"]);
  });
  it("valida tokens y vencimientos", () => {
    expect(publicShareRequestSchema.safeParse({ token: "a".repeat(64) }).success).toBe(true);
    for (const token of ["", "a".repeat(63), "Z".repeat(64), "../".repeat(22)])
      expect(publicShareRequestSchema.safeParse({ token }).success).toBe(false);
    expect(createShareLinkSchema.parse({ label: " Fede " })).toEqual({ label: "Fede", expiresInDays: 30 });
    expect(createShareLinkSchema.safeParse({ label: "Fede", expiresInDays: 365 }).success).toBe(false);
    expect(createShareLinkSchema.safeParse({ label: "" }).success).toBe(false);
  });
});
