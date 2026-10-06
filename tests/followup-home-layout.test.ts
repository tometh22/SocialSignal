import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Home: tarjetas personales alineadas con el resto", () => {
  it("una sola tarjeta (cumpleaños propio o vacaciones) ocupa todo el ancho; dos comparten fila", () => {
    const home = source("client/src/pages/home-dashboard.tsx");
    expect(home).toContain('className={cn("grid gap-3", birthday && absenceBalance?.configured && "lg:grid-cols-2")}');
    expect(home).toContain('data-testid="home-personal-cards"');
    expect(home).not.toContain('<div className="grid gap-3 lg:grid-cols-2">');
  });

  it("el panel de saldo de Ausencias rotula claramente lo que no descuenta cupo", () => {
    const page = source("client/src/pages/personnel-absences.tsx");
    expect(page).toContain("No descuentan cupo:");
    expect(page).not.toContain("Sin cupo (no descuentan)");
  });
});
