import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Express matchea rutas en orden de registro, no por especificidad. Si una
// ruta con parámetro (ej. "/api/quotations/:id") se registra ANTES que una
// ruta literal con la misma forma (ej. "/api/quotations/margin-drift-summary"),
// la literal queda inalcanzable: el parámetro la intercepta primero.
//
// Este bug ya pasó una vez en producción (ver PR "fix: /api/quotations/
// margin-drift-summary devolvía 400 por orden de rutas") y no lo atraparon
// ni tsc ni los tests existentes porque no hay tests de integración HTTP en
// este repo. Este test barre server/routes.ts entero buscando el mismo
// patrón, para que la próxima vez se rompa el build en vez de producción.

type RouteRegistration = { method: string; path: string; line: number };

// \s* (no /m needed, \s ya incluye saltos de línea) para no perderse las
// rutas escritas con el path en la línea siguiente a "app.post(":
//   app.post(
//     "/api/quotations/:id/send",
//     ...
const ROUTE_CALL_PATTERN = /app\.(get|post|put|patch|delete)\(\s*("[^"]*"|'[^']*')/g;

function extractRoutes(source: string): RouteRegistration[] {
  const routes: RouteRegistration[] = [];
  ROUTE_CALL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ROUTE_CALL_PATTERN.exec(source)) !== null) {
    const method = match[1];
    const path = match[2].slice(1, -1);
    const line = source.slice(0, match.index).split("\n").length;
    routes.push({ method, path, line });
  }
  return routes;
}

/** Un segmento con parámetro puede traer una restricción inline: ":id(\\d+)". */
function segmentMatchesLiteral(paramSegment: string, literalSegment: string): boolean {
  const constraintMatch = paramSegment.match(/^:[^(]+\(([^)]+)\)$/);
  if (!constraintMatch) return true; // sin restricción: cualquier literal cae en el parámetro
  const constraintPattern = new RegExp(`^(?:${constraintMatch[1]})$`);
  return constraintPattern.test(literalSegment);
}

function shadowsExisting(paramPath: string, literalPath: string): boolean {
  const paramSegments = paramPath.split("/");
  const literalSegments = literalPath.split("/");
  if (paramSegments.length !== literalSegments.length) return false;
  if (paramPath === literalPath) return false;
  for (let i = 0; i < paramSegments.length; i += 1) {
    const p = paramSegments[i];
    const l = literalSegments[i];
    if (p.startsWith(":")) {
      if (!segmentMatchesLiteral(p, l)) return false;
      continue;
    }
    if (p !== l) return false;
  }
  return true;
}

function findShadowingIssues(routes: RouteRegistration[]) {
  const issues: string[] = [];
  const byMethod = new Map<string, RouteRegistration[]>();
  for (const route of routes) {
    const list = byMethod.get(route.method) ?? [];
    list.push(route);
    byMethod.set(route.method, list);
  }
  for (const list of byMethod.values()) {
    for (let a = 0; a < list.length; a += 1) {
      if (!list[a].path.includes(":")) continue;
      for (let b = a + 1; b < list.length; b += 1) {
        if (shadowsExisting(list[a].path, list[b].path)) {
          issues.push(
            `${list[a].method.toUpperCase()} "${list[a].path}" (línea ${list[a].line}) ` +
            `intercepta a "${list[b].path}" (línea ${list[b].line}), registrada después — nunca se alcanza.`,
          );
        }
      }
    }
  }
  return issues;
}

describe("orden de rutas de Express en server/routes.ts", () => {
  it("no tiene una ruta con parámetro registrada antes de una ruta literal con la misma forma", () => {
    const source = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
    const routes = extractRoutes(source);
    // Sanity check: si esto es bajo, el regex de extracción se rompió.
    expect(routes.length).toBeGreaterThan(100);
    const issues = findShadowingIssues(routes);
    expect(issues, issues.join("\n")).toEqual([]);
  });

  it("detecta el patrón cuando existe (self-test)", () => {
    const routes = extractRoutes([
      'app.get("/api/quotations/:id", requireAuth, handler);',
      'app.get("/api/quotations/margin-drift-summary", requireAuth, handler);',
    ].join("\n"));
    expect(findShadowingIssues(routes)).toHaveLength(1);
  });

  it("no marca falso positivo cuando el parámetro trae una restricción que excluye al literal", () => {
    const routes = extractRoutes([
      'app.get("/api/tasks/:id(\\\\d+)", requireAuth, handler);',
      'app.get("/api/tasks/projects", requireAuth, handler);',
    ].join("\n"));
    expect(findShadowingIssues(routes)).toHaveLength(0);
  });
});
