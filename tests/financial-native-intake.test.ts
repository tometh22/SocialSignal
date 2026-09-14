import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFinancialTextHeuristically, financialExtractionSchema, financialMissingFields } from "../server/services/financial-intake-extractor";
import { getFinancialIntakeImpact, getLinkedRecordPresentation } from "../client/src/lib/financial-intake-presentation";

describe("financial native intake", () => {
  it("interpreta un cobro escrito en lenguaje natural", () => {
    const result = extractFinancialTextHeuristically("Cobramos la factura FC-203 del cliente Acme por USD 12.500 el 10/09/2026 desde Santander, proyecto Always On");
    expect(result.data.documentKind).toBe("customer_collection");
    expect(result.data.totalAmount).toBe(12500);
    expect(result.data.currency).toBe("USD");
    expect(result.data.paymentDate).toBe("2026-09-10");
    expect(result.data.periodKey).toBe("2026-09");
  });

  it("clasifica una factura de proveedor y su tratamiento", () => {
    const result = extractFinancialTextHeuristically("Factura A-991 de proveedor Estudio Norte por ARS 1.250.000 el 03/09/2026, costo indirecto, categoría Estudio Contable");
    expect(result.data.documentKind).toBe("supplier_invoice");
    expect(result.data.costTreatment).toBe("indirect");
    expect(result.data.costSubtype).toContain("Estudio Contable");
  });

  it("recalcula campos faltantes sin confiar en la salida del modelo", () => {
    const base = extractFinancialTextHeuristically("Factura a cliente").data;
    const forged = financialExtractionSchema.parse({ ...base, missingFields: [] });
    expect(financialMissingFields(forged)).toEqual(expect.arrayContaining(["periodKey", "totalAmount", "currency", "issueDate", "documentNumber", "counterparty"]));
  });

  it("interpreta inflación mensual sin exigir una moneda", () => {
    const result = extractFinancialTextHeuristically("IPC de septiembre 2026: 2,1% según INDEC");
    expect(result.data.documentKind).toBe("inflation");
    expect(result.data.periodKey).toBe("2026-09");
    expect(result.data.totalAmount).toBe(2.1);
    expect(result.data.currency).toBeNull();
    expect(financialMissingFields(result.data)).not.toContain("currency");
  });

  it("interpreta una cotización escrita sin símbolo monetario", () => {
    const result = extractFinancialTextHeuristically("Dólar de cierre septiembre 2026: 1.475,50");
    expect(result.data.documentKind).toBe("exchange_rate");
    expect(result.data.periodKey).toBe("2026-09");
    expect(result.data.exchangeRate).toBe(1475.5);
  });
});

describe("financial native integration contracts", () => {
  const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

  it("protege la bandeja y el ledger con permiso financiero", () => {
    expect(read("server/routes-financial-native.ts")).toContain('requirePermission("finance")');
    expect(read("server/routes-ledger.ts")).toContain('const finance = [requireAuth, requirePermission("finance")]');
  });

  it("mantiene evidencia privada y no habilita CSV operativo", () => {
    const files = read("server/services/financial-intake-files.ts");
    expect(files).toContain("FINANCIAL_PRIVATE_STORAGE_DIR");
    expect(files).toContain("assertMagicBytes");
    expect(files).not.toContain('"text/csv"');
  });

  it("puede interpretar capturas y PDFs con el proveedor de IA disponible", () => {
    const extractor = read("server/services/financial-intake-extractor.ts");
    expect(extractor).toContain("ANTHROPIC_API_KEY");
    expect(extractor).toContain('type: "image"');
    expect(extractor).toContain('type: "document"');
    expect(extractor).toContain('provider: "anthropic"');
  });

  it("registra migraciones y alimenta tableros desde Mind", () => {
    const index = read("server/index.ts");
    expect(index).toContain("0058 financial native intake");
    expect(index).toContain("0059 financial native ledger");
    expect(read("server/routes.ts")).toContain("fetchNativeExecutiveDashboard");
    expect(read("server/services/financial-intake-posting.ts")).toContain("rebuildNativeFinancialFacts");
    expect(read("server/services/autoSyncService.ts")).toContain("Auto-sync financiero desde Excel desactivado por cutover");
    expect(read("server/services/recurring-revenue.ts")).toContain("revenue_events");
  });

  it("serializa publicación y cierre y no contabiliza transferencias propias como flujo", () => {
    expect(read("server/services/financial-intake-posting.ts")).toContain("pg_advisory_xact_lock");
    const close = read("server/services/financial-close.ts");
    expect(close).toContain("internal_transfers_balanced");
    expect(close).toContain("transfer_group_id IS NULL");
  });

  it("revierte aplicaciones al anular caja y obliga a rehacer un pre-cierre sucio", () => {
    const ledger = read("server/routes-ledger.ts");
    expect(ledger).toContain('action: "payment_application_voided"');
    expect(ledger).toContain("financialDocumentApplications.voidedAt");
    expect(ledger).toContain("peek.transferGroupId");
    const posting = read("server/services/financial-intake-posting.ts");
    expect(posting).toContain('period?.status === "PRE_CLOSE"');
    expect(posting).toContain('status: "OPEN"');
  });

  it("permite completar manualmente las líneas extraídas de un extracto", () => {
    const intake = read("client/src/pages/financial-intake.tsx");
    expect(intake).toContain("Agregar movimiento");
    expect(intake).toContain('placeholder="Banco / cuenta"');
    expect(intake).toContain('placeholder="Referencia / comprobante"');
    expect(intake).toContain("Curva REM / tipos de cambio futuros");
  });

  it("separa la carga de la gestión y los reportes en la navegación", () => {
    const sidebar = read("client/src/components/layout/sidebar-fixed.tsx");
    expect(sidebar).toContain('title: "Carga financiera"');
    expect(sidebar).toContain('title: "Gestión financiera"');
    expect(sidebar).toContain('title: "Reportes financieros"');
    expect(sidebar.indexOf('title: "Carga financiera"')).toBeLessThan(sidebar.indexOf('title: "Reportes financieros"'));
  });

  it("hace explícitos los tres pasos y permite buscar y revisar un lote antes de procesarlo", () => {
    const intake = read("client/src/pages/financial-intake.tsx");
    expect(intake).toContain('title: "Cargá"');
    expect(intake).toContain('title: "Revisá"');
    expect(intake).toContain('title: "Confirmá"');
    expect(intake).toContain("pendingFiles");
    expect(intake).toContain("Buscar archivo, cliente o proyecto");
  });

  it("explica el destino antes y después de contabilizar", () => {
    const intake = read("client/src/pages/financial-intake.tsx");
    expect(intake).toContain("Al confirmar, Mind actualizará");
    expect(intake).toContain("Resultado de la carga");
    expect(intake).toContain("único lugar para ingresar información financiera y económica");
  });
});

describe("financial intake presentation", () => {
  it("muestra el impacto doble de facturas, cobros, pagos e impuestos", () => {
    expect(getFinancialIntakeImpact("customer_invoice").destinations).toEqual(["Activo", "Ingresos"]);
    expect(getFinancialIntakeImpact("customer_collection").destinations).toEqual(["Cashflow", "Activo"]);
    expect(getFinancialIntakeImpact("supplier_payment").destinations).toEqual(["Cashflow", "Pasivo"]);
    expect(getFinancialIntakeImpact("tax_settlement").destinations).toEqual(["Pasivo", "Resultado impositivo"]);
  });

  it("informa cuántos movimientos generará un extracto", () => {
    expect(getFinancialIntakeImpact("bank_statement", 12).description).toContain("12 movimientos");
  });

  it("traduce los registros técnicos y enlaza sólo a módulos existentes", () => {
    expect(getLinkedRecordPresentation("activo_entry", "customer_invoice")).toEqual({ label: "Cuenta a cobrar", href: "/finance/activo" });
    expect(getLinkedRecordPresentation("financial_document_application", "supplier_payment").href).toBe("/finance/pasivo");
    expect(getLinkedRecordPresentation("monthly_inflation", "inflation")).toEqual({ label: "Inflación mensual", href: null });
  });
});
