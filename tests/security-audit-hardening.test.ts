import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, test } from "vitest";
import { createXlsxBuffer } from "../server/utils/xlsx-export";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("audit hardening — authorization and hierarchy", () => {
  test("task and time routes use centralized project authorization", () => {
    const routes = source("server/routes.ts");
    const calendarRoute = routes.slice(
      routes.indexOf('app.get("/api/tasks/team-calendar"'),
      routes.indexOf('// GET /api/tasks/project/:projectId'),
    );

    expect(routes).toContain("async function canAccessTaskProject");
    expect(routes).toContain("async function canManageTaskProject");
    expect(calendarRoute).toContain("await accessibleTaskProjectIds(req)");
    expect(calendarRoute).toContain("await canAccessTaskProject(req, parsedProjectId)");
    expect(routes).toContain('app.post("/api/time-entries/:id/approve", requireAuth');
    expect(routes).toContain('if (!isOperationsRequest(req)) return res.status(403)');
  });

  test("chat HTTP and WebSocket identities are session-authenticated", () => {
    const chatServer = source("server/chat.ts");
    const chatClient = source("client/src/hooks/use-chat.tsx");

    expect(chatServer).toContain('app.get("/api/conversations", requireAuth');
    expect(chatServer).toContain("resolveUserFromSessionCookie");
    expect(chatServer).toContain("req.headers.cookie");
    expect(chatServer).toContain('ws.close(1008, "Origen no permitido")');
    expect(chatServer).not.toContain("Number(query.userId)");
    expect(chatClient).toContain('new WebSocket(wsUrl, "epical-chat")');
    expect(chatClient).not.toContain("sessionStorage");
    expect(chatClient).not.toContain("/ws?userId=");
    expect(source("server/auth.ts")).not.toContain("sessionToken:");
  });

  test("the bound HTTP server is the same instance used by WebSocket routes", () => {
    const serverEntry = source("server/index.ts");

    expect(serverEntry).toContain("const server = await registerRoutes(app)");
    expect(serverEntry).toContain("server.listen(port");
    expect(serverEntry).not.toContain("app.listen(port");
  });

  test("session bearer credentials are never written to logs", () => {
    const auth = source("server/auth.ts");
    const serverEntry = source("server/index.ts");

    expect(auth).not.toMatch(/console\.(?:log|info|warn|error)[^\n]*sessionID/);
    expect(serverEntry).not.toMatch(/console\.(?:log|info|warn|error)[^\n]*req\.sessionID/);
  });

  test("labor and project cost summaries remain operations-only", () => {
    const routes = source("server/routes.ts");

    for (const route of [
      'app.get("/api/time-entries", requireAuth',
      'app.get("/api/clients/:clientId/cost-summary", requireAuth',
      'app.get("/api/projects/:id/cost-summary/period", requireAuth',
      'app.get("/api/projects/:id/cost-summary", requireAuth',
    ]) {
      const routeIndex = routes.indexOf(route);
      expect(routeIndex).toBeGreaterThan(-1);
      expect(routes.slice(routeIndex, routeIndex + 420)).toContain("isOperationsRequest(req)");
    }
  });

  test("the database enforces the self-reference and rejects recursive cycles", () => {
    const migration = source("migrations/0038_task_hierarchy_security.sql");
    const schema = source("shared/schema.ts");

    expect(schema).toContain('parentTaskId: integer("parent_task_id").references');
    expect(schema).toContain('onDelete: "cascade"');
    expect(migration).toContain("FOREIGN KEY (parent_task_id)");
    expect(migration).toContain("CREATE TRIGGER tasks_prevent_parent_cycle");
    expect(migration).toContain("WITH RECURSIVE ancestors");
    expect(migration).toContain("ON CONFLICT (project_id, personnel_id) DO NOTHING");
  });

  test("legacy mixed-currency quote repair is deterministic and non-destructive", () => {
    const migration = source("migrations/0039_quotation_header_currency_repair.sql");

    expect(migration).toContain("ROUND(team.team_cost / quotation.base_cost::numeric) AS inferred_fx");
    expect(migration).toContain("quotation.status = 'draft'");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM active_projects");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM negotiation_history");
    expect(migration).not.toContain("manual_price =");
  });

  test("project-management actions are hidden when the server would reject them", () => {
    const page = source("client/src/pages/tasks/project-tasks-page.tsx");

    expect(page).toContain("const canManageProject = isOperations || members.some");
    expect(page).toContain("{canManageProject && (");
    expect(page).toContain('PROJECT_ROLE_OPTIONS.filter(r => isOperations || r.value !== "owner")');
  });
});

describe("audit hardening — ETL and exports", () => {
  test("FX fallbacks resolve before contractual USD conversion", () => {
    const etl = source("server/etl/sot-etl.ts");
    const conversion = etl.indexOf("rateARSExcel = normalizeContractualRateToARS");
    const rcFallback = etl.indexOf("FX fallback: Usando FX");
    const globalFallback = etl.indexOf("FX fallback: Usando configuración global");

    expect(rcFallback).toBeGreaterThan(0);
    expect(globalFallback).toBeGreaterThan(rcFallback);
    expect(conversion).toBeGreaterThan(globalFallback);
  });

  test("automatic profitability rebuilds retry and surface persistent errors", () => {
    const routes = source("server/routes.ts");
    const rebuild = routes.slice(
      routes.indexOf("async function triggerLaborRebuild"),
      routes.indexOf("async function computeTaskEntryCost"),
    );

    expect(rebuild).toContain("attempt <= 2");
    expect(rebuild).toContain("result.errors.length === 0");
    expect(rebuild).toContain("throw new Error");
    expect(rebuild).not.toContain("rebuild error:', error");
  });

  test("XLSX export is a real workbook and cannot turn text into formulas", async () => {
    const buffer = await createXlsxBuffer([
      { Name: "=HYPERLINK(\"https://invalid\")", Hours: 3.5 },
    ], 'Audit "safe"');
    const zip = await JSZip.loadAsync(buffer);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const workbook = await zip.file("xl/workbook.xml")!.async("string");

    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain('=HYPERLINK("https://invalid")');
    expect(sheet).not.toContain("<f>");
    expect(workbook).toContain('name="Audit &quot;safe&quot;"');
  });
});
