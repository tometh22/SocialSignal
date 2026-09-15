import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("team cost and invoice integration contracts", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  it("mantiene un espacio personal de facturación con evidencia privada", () => {
    const sidebar = source("client/src/components/layout/sidebar-fixed.tsx");
    const page = source("client/src/pages/my-invoices.tsx");
    const routes = source("server/routes.ts");
    expect(sidebar).toContain('title: "Mi gestión"');
    expect(sidebar).toContain('href: "/my-invoices"');
    expect(page).toContain("Operaciones calcula tu liquidación");
    expect(page).toContain("Enviar a Administración");
    expect(routes).toContain("storeFinancialIntakeFile(file)");
    expect(routes).toContain('Cache-Control", "private, no-store"');
    expect(routes).toContain("row.userId !== req.user!.id && !canReview");
  });

  it("asigna la liquidación a Operaciones y el matching a Finanzas", () => {
    const app = source("client/src/App.tsx");
    const sidebar = source("client/src/components/layout/sidebar-fixed.tsx");
    const operationsPage = source("client/src/pages/team-settlements.tsx");
    const financePage = source("client/src/pages/team-invoice-review.tsx");
    const routes = source("server/routes.ts");
    expect(app).toContain('/operations/liquidaciones-equipo');
    expect(app).toContain('/finance/facturas-equipo');
    expect(sidebar).toContain('title: "Liquidaciones equipo"');
    expect(sidebar).toContain('title: "Facturas equipo"');
    expect(operationsPage).toContain("Operaciones completa");
    expect(operationsPage).not.toContain("Administración completa");
    expect(financePage).toContain("Aprobar y crear Pasivo");
    expect(routes).toContain('requirePermission("operations"), async (req, res) =>');
    expect(routes).toContain('requirePermission("finance"), async (req, res) =>');
  });

  it("separa los dos documentos mixtos y respeta su fecha de emisión", () => {
    const migration = source("migrations/0062_personal_invoice_components.sql");
    const page = source("client/src/pages/my-invoices.tsx");
    const routes = source("server/routes.ts");
    expect(migration).toContain("invoice_component");
    expect(migration).toContain("UNIQUE (user_id, period, invoice_component)");
    expect(page).toContain("Fin de mes: factura USD");
    expect(page).toContain("Después del cobro: factura ARS");
    expect(page).toContain('component="usd"');
    expect(page).toContain('component="ars"');
    expect(routes).toContain('invoiceComponent === "usd"');
    expect(routes).toContain('invoiceComponent === "ars"');
    expect(routes).toContain("issueDate.toISOString().slice(0, 7)");
  });

  it("devenga el costo exclusivamente desde Operaciones", () => {
    const builder = source("server/services/financial-native-builders.ts");
    const breakdown = source("server/services/cost-breakdown.ts");
    expect(builder).toContain("El costo del equipo se devenga 100% desde el cierre de Operaciones");
    expect(builder).not.toContain("approved_fixed_invoice");
    expect(builder).not.toContain("invoice.actual_usd*allocation.allocation_percent/100");
    expect(breakdown).not.toContain("actual_fixed_team");
    expect(breakdown).toContain("COALESCE(cost_treatment,'direct') <> 'balance_only'");
  });

  it("registra cada factura aprobada en Pasivo sin tratarla como costo", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("syncPersonalInvoicePayable");
    expect(routes).toContain('costTreatment: "balance_only"');
    expect(routes).toContain('source: "personal_invoice"');
    expect(routes).toContain('externalId = `personal-invoice:${invoice.id}`');
    expect(routes).not.toContain("La factura no tiene proyectos asociados");
    expect(routes).not.toContain("El reparto entre proyectos suma");
  });

  it("controla documentación de Pasivo sin bloquear el devengamiento del costo", () => {
    const close = source("server/services/financial-close.ts");
    expect(close).toContain('code: "fixed_team_invoices_approved"');
    expect(close).toContain('severity: "warning"');
    expect(close).toContain("El costo del mes ya está devengado por Operaciones");
    expect(close).not.toContain("Sin ellas el costo financiero seguiría siendo estimado");
  });

  it("permite corregir y reabrir desde la revisión de Administración", () => {
    const review = source("client/src/pages/team-invoice-review.tsx");
    const routes = source("server/routes.ts");
    expect(review).toContain("Pedir corrección");
    expect(review).toContain("Reabrir");
    expect(review).not.toContain("window.prompt");
    expect(routes).toContain('["approved", "rejected", "pending"]');
  });
});
