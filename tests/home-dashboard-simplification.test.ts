import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync(
  new URL("../client/src/pages/home-dashboard.tsx", import.meta.url),
  "utf8",
);

describe("Home personal simplificada", () => {
  test("no replica la navegación global mediante launchers", () => {
    expect(home).not.toContain("interface QuickLink");
    expect(home).not.toContain("commercialLinks");
    expect(home).not.toContain("projectLinks");
    expect(home).not.toContain("operationsLinks");
    expect(home).not.toContain("renderLinkCard");
    expect(home).not.toContain("renderSection");
  });

  test("conserva el resumen personal y operativo según permisos", () => {
    expect(home).toContain('const canAccessTasks = hasPermission("projects")');
    expect(home).toContain('const canCreateQuotation = hasPermission("quotations")');
    expect(home).toContain("Alertas inteligentes");
    expect(home).toContain("Señales del portfolio");
    expect(home).toContain("Mi semana");
    expect(home).toContain("<TaskCalendarView");
  });

  test("evita cuatro columnas prematuras junto al sidebar", () => {
    expect(home).toContain("grid grid-cols-2 gap-3 xl:grid-cols-4");
    expect(home).not.toContain("lg:grid-cols-4");
  });
});
