import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("Feedback Mind V2-10 contracts", () => {
  it("persists and migrates the independent project workflow stage", () => {
    const schema = source("shared/schema.ts");
    const migration = source("migrations/0042_feedback_mind_v2_10.sql");
    const routes = source("server/routes.ts");
    expect(schema).toContain('workflowStage: text("workflow_stage")');
    expect(schema).toContain('"listo_para_empezar"');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS workflow_stage");
    expect(migration).toContain("status = 'on-hold' THEN 'bloqueado'");
    expect(routes).toContain('/api/tasks/projects/:id/workflow-stage');
  });

  it("exposes role/sublevel averages without replacing manual defaults", () => {
    const routes = source("server/routes.ts");
    const rolesUi = source("client/src/components/admin/inline-edit-role.tsx");
    expect(routes).toContain("rateAverages");
    expect(routes).toContain("classification_averages AS");
    expect(rolesUi).toContain("averageRateARS");
    expect(rolesUi).toContain("fallback");
  });

  it("supports post-closing invoice submission and operations approval", () => {
    const schema = source("shared/schema.ts");
    const routes = source("server/routes.ts");
    const personalUi = source("client/src/pages/my-invoices.tsx");
    expect(schema).toContain('suggestedInvoiceUSD: doublePrecision("suggested_invoice_usd")');
    expect(schema).toContain('approvalStatus: varchar("approval_status"');
    expect(routes).toContain('/api/me/invoices/:id/review');
    expect(routes).toContain('/api/operations/invoices/review/:id');
    expect(routes).toContain("grandTotalUSD) * 0.9");
    expect(personalUi).toContain("Enviar a aprobación de Operaciones");
  });

  it("keeps third-party attribution and project refresh contracts", () => {
    const quickHours = source("client/src/components/tasks/QuickTaskHours.tsx");
    const detail = source("client/src/components/tasks/TaskDetailPanel.tsx");
    expect(quickHours).toContain("personnelId: Number(personnelId)");
    expect(detail).toContain('["projects", task.projectId, "complete-data"]');
  });

  it("uses decimal hours and avoids premature renegotiation recommendations", () => {
    const formatters = source("client/src/lib/formatters.ts");
    const copilot = source("client/src/components/project-detail/ai-copilot.tsx");
    expect(formatters).toContain("toFixed(2)} h");
    expect(copilot).toContain("marginDataMature");
    expect(copilot).toContain("Markup preliminar");
  });

  it("guards the test-data reset endpoint", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('/api/admin/test-data-reset');
    expect(routes).toContain('NODE_ENV === "production"');
    expect(routes).toContain('confirm !== "RESET_TEST_DATA"');
  });
});
