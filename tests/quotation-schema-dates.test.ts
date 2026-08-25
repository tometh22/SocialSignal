import { describe, expect, it } from "vitest";
import { insertQuotationSchema } from "../shared/schema";

// Regresión: el cliente serializa las fechas a string ISO al mandar el JSON, así
// que el schema de la cotización tiene que aceptar strings en los campos de fecha
// y transformarlos a Date. `expiresAt` no estaba contemplado y rompía TODO guardado
// de una cotización con vigencia (todas la tienen por default +30 días) con
// 400 "Expected date, received string".
describe("insertQuotationSchema — fechas como string ISO", () => {
  const dates = insertQuotationSchema.pick({ expiresAt: true, projectStartDate: true });

  it("acepta expiresAt como string ISO y lo transforma a Date", () => {
    const parsed = dates.parse({ expiresAt: "2026-09-24T12:00:00.000Z" });
    expect(parsed.expiresAt).toBeInstanceOf(Date);
    expect((parsed.expiresAt as Date).toISOString()).toBe("2026-09-24T12:00:00.000Z");
  });

  it("acepta expiresAt como Date", () => {
    const d = new Date("2026-09-24T12:00:00.000Z");
    expect(dates.parse({ expiresAt: d }).expiresAt).toEqual(d);
  });

  it("acepta expiresAt ausente o null", () => {
    expect(dates.parse({}).expiresAt).toBeUndefined();
    expect(dates.parse({ expiresAt: null }).expiresAt).toBeUndefined();
  });

  it("sigue aceptando projectStartDate como string ISO (no regresó)", () => {
    const parsed = dates.parse({ projectStartDate: "2026-09-24T12:00:00.000Z" });
    expect(parsed.projectStartDate).toBeInstanceOf(Date);
  });
});
