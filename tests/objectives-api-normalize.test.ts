import { describe, expect, it } from "vitest";
import { normalizeObjective } from "../client/src/lib/objectives-api";
import type { Objective } from "../client/src/lib/objectives-api";

const base = { id: 1, level: "company", title: "Objetivo" } as Objective;

describe("avance que llega de la API", () => {
  it("convierte el numeric de Postgres, que llega como texto, en número", () => {
    // Sin esto la pantalla trata "40.00" como "sin medir" aunque esté cargado.
    expect(normalizeObjective({ ...base, progressPercent: "40.00" as unknown as number }).progressPercent).toBe(40);
  });

  it("deja en null lo que no se cargó o no es un número", () => {
    expect(normalizeObjective({ ...base, progressPercent: null }).progressPercent).toBeNull();
    expect(normalizeObjective({ ...base, progressPercent: "" as unknown as number }).progressPercent).toBeNull();
    expect(normalizeObjective({ ...base, progressPercent: "abc" as unknown as number }).progressPercent).toBeNull();
  });
});
