import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Home: tarjetas personales alineadas con el resto", () => {
  it("las tarjetas del pie se reparten solas el ancho (auto-fit): una ocupa todo, varias comparten fila", () => {
    const home = source("client/src/pages/home-dashboard.tsx");
    expect(home).toContain("[grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]");
    expect(home).toContain('data-testid="home-personal-cards"');
  });

  it("el panel de saldo de Ausencias rotula claramente lo que no descuenta cupo", () => {
    const page = source("client/src/pages/personnel-absences.tsx");
    expect(page).toContain("No descuentan cupo:");
    expect(page).not.toContain("Sin cupo (no descuentan)");
  });
});
