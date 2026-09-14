import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPersonalInvoiceAllocations } from "../server/services/personal-invoice-allocations";

describe("personal invoice project allocations", () => {
  const projects = [
    { projectId: 10, projectName: "Always On", clientName: "Acme", hours: 30, computedCostARS: 300_000 },
    { projectId: 20, projectName: "Tracking", clientName: "Acme", hours: 10, computedCostARS: 100_000 },
  ];

  it("reparte por costo y conserva exactamente el total", () => {
    const rows = buildPersonalInvoiceAllocations({ projects, computedTotalUSD: 400, invoiceAmount: 400_000, invoiceCurrency: "ARS" });
    expect(rows.map((row) => row.allocationPercent)).toEqual([75, 25]);
    expect(rows.reduce((sum, row) => sum + row.allocationPercent, 0)).toBe(100);
    expect(rows.reduce((sum, row) => sum + (row.allocatedInvoiceAmount ?? 0), 0)).toBe(400_000);
    expect(rows.reduce((sum, row) => sum + row.computedCostUSD, 0)).toBe(400);
  });

  it("recalcula el 100% cuando la persona excluye un proyecto", () => {
    const rows = buildPersonalInvoiceAllocations({ projects, selectedProjectIds: [20], computedTotalUSD: 400, invoiceAmount: 1000, invoiceCurrency: "USD" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ projectId: 20, allocationPercent: 100, allocatedInvoiceAmount: 1000 });
  });

  it("usa horas cuando todavía no existe costo histórico", () => {
    const rows = buildPersonalInvoiceAllocations({ projects: projects.map((project) => ({ ...project, computedCostARS: 0 })), computedTotalUSD: 800 });
    expect(rows.map((row) => row.allocationPercent)).toEqual([75, 25]);
  });

  it("absorbe redondeos en el último proyecto", () => {
    const thirds = [1, 2, 3].map((projectId) => ({ projectId, projectName: String(projectId), clientName: null, hours: 1, computedCostARS: 1 }));
    const rows = buildPersonalInvoiceAllocations({ projects: thirds, computedTotalUSD: 100, invoiceAmount: 100, invoiceCurrency: "USD" });
    expect(rows.reduce((sum, row) => sum + row.allocationPercent, 0)).toBe(100);
    expect(rows.reduce((sum, row) => sum + (row.allocatedInvoiceAmount ?? 0), 0)).toBe(100);
  });
});

describe("personal invoice integration contracts", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  it("expone un espacio personal separado y un flujo guiado", () => {
    const sidebar = source("client/src/components/layout/sidebar-fixed.tsx");
    const page = source("client/src/pages/my-invoices.tsx");
    expect(sidebar).toContain('title: "Mi gestión"');
    expect(sidebar).toContain('href: "/my-invoices"');
    expect(page).toContain("Elegí el período");
    expect(page).toContain("Revisá el reparto");
    expect(page).toContain("Enviar a Finanzas");
  });

  it("guarda comprobantes en privado y limita su lectura", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("storeFinancialIntakeFile(req.file)");
    expect(routes).toContain('app.get("/api/me/invoices/:id/file"');
    expect(routes).toContain('Cache-Control", "private, no-store"');
    expect(routes).toContain("row.userId !== req.user!.id && !canReview");
    expect(routes).toContain("storage_key: _storageKeySnake");
    expect(routes).toContain("file_hash: _fileHashSnake");
  });

  it("no duplica el costo y conserva el vínculo por proyecto", () => {
    const migration = source("migrations/0060_employee_invoice_projects.sql");
    const page = source("client/src/pages/my-invoices.tsx");
    expect(migration).toContain("personal_invoice_project_allocations");
    expect(migration).toContain("REFERENCES active_projects");
    expect(page).toContain("No duplica costos");
  });

  it("permite pedir una corrección profesional y reabrir una factura aprobada", () => {
    const review = source("client/src/pages/monthly-closing.tsx");
    const routes = source("server/routes.ts");
    expect(review).toContain("Pedir corrección de la factura");
    expect(review).toContain("Reabrir");
    expect(review).not.toContain("window.prompt");
    expect(routes).toContain('["approved", "rejected", "pending"]');
  });
});
