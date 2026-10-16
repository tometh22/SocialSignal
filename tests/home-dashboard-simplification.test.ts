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
    expect(home).toContain("lg:grid-cols-12");
    expect(home).not.toContain("xl:grid-cols-4");
  });

  test("cada bloque depende del permiso: sin acceso no hay tarjeta ni hueco", () => {
    expect(home).toContain("const showQuotations = hasPermission('quotations')");
    expect(home).toContain("const showPortfolio = hasPermission('projects')");
    expect(home).toContain('const canSeeCapacity = hasPermission("operations")');
    expect(home).toContain("enabled: canSeeCapacity");
    expect(home).toContain("{showQuotations && (");
    expect(home).toContain("{showPortfolio && (");
  });
  test("usa el resumen liviano de alertas y no descarga el endpoint legacy", () => {
    expect(home).toContain('authFetch("/api/projects/alerts-summary")');
    expect(home).not.toContain('authFetch("/api/active-projects")');
  });
});

describe("Shell de la app: el documento no scrollea", () => {
  const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

  test("bloquea el scroll del documento dentro de la capa base (donde gana !important)", () => {
    expect(css).toMatch(/html:has\(\.app-shell\),\s*body:has\(\.app-shell\)\s*\{[^}]*overflow: hidden !important/);
  });

  test("el shell recorta (clip) en vez de ocultar, así nada puede desplazarlo", () => {
    expect(app).toContain('className="app-shell flex h-[100dvh] overflow-clip bg-background"');
  });
});
