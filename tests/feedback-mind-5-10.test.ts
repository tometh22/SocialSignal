import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeAlerts } from "../client/src/lib/smart-alerts";
import { quotationListPricing } from "../shared/utils/quotation-profitability";
import { SheetsLayoutError, describeSheetsSyncError, parseValorHoraSection } from "../server/services/personnelSheetsSync";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const project = (overrides: Record<string, unknown> = {}) => ({
  projectId: 1, projectName: "Interno", clientName: "Epical", revenue: 0, cost: 500, markup: null as number | null,
  margin: 0, budget: 0, budgetUsed: 0, totalHours: 10, estimatedHours: 0, teamSize: 1, status: "active", ...overrides,
});

describe("Feedback 5-10 · Home", () => {
  it("no genera una alerta urgente de markup 0.0x para proyectos con costo pero sin ingreso", () => {
    const result = computeAlerts([project()]);
    expect(result.insights.join(" ")).not.toContain("Acción urgente");
    expect(result.alerts.filter((alert) => alert.category === "markup")).toHaveLength(0);
  });

  it("sigue alertando cuando hay ingreso y el markup real es bajo", () => {
    const result = computeAlerts([project({ revenue: 1000, cost: 800, markup: 1.25 })]);
    expect(result.alerts.some((alert) => alert.category === "markup" && alert.type === "critical")).toBe(true);
  });

  it("el endpoint de alertas devuelve markup null cuando no hay ingreso", () => {
    expect(source("server/routes.ts")).toContain("markup: cost > 0 && revenue > 0 ? revenue / cost : null");
  });

  it("muestra los días Epical por separado de las vacaciones y alinea las tarjetas", () => {
    const home = source("client/src/pages/home-dashboard.tsx");
    expect(home).toContain("Días Epical disponibles");
    expect(home).toContain("absenceBalance.used.epical");
    expect(home).not.toContain("p-3 text-sm");
  });
});

describe("Feedback 5-10 · sincronización de valor hora", () => {
  const grid = (year: number, label: string) => [
    [String(year), "Detalle", "Ajuste", label],
    ["", "01 ene " + year, "01 ene " + year, "01 ene " + year],
    ["Ana Pérez", "", "5%", "$1.000,00"],
  ];

  it("usa un error de layout tipado cuando el año no existe en el Máster", () => {
    expect(() => parseValorHoraSection(grid(2026, "Valor Hora Ajustada"), 2027)).toThrowError(SheetsLayoutError);
  });

  it("acepta 'Valor Hora Estimada' sólo si el llamador lo habilita (años futuros)", () => {
    const rows = parseValorHoraSection(grid(2027, "Valor Hora Estimada"), 2027, { allowEstimatedFallback: true });
    expect(rows[0].monthlyRates.jan2027).toBe(1000);
    expect(parseValorHoraSection(grid(2027, "Valor  Hora  Estimada "), 2027, { allowEstimatedFallback: true })[0].monthlyRates.jan2027).toBe(1000);
  });

  it("en años cerrados un layout con 'Estimada' falla a la vista en vez de reescribir tarifas", () => {
    expect(() => parseValorHoraSection(grid(2025, "Valor Hora Estimada"), 2025)).toThrowError(SheetsLayoutError);
  });

  it("nunca pisa una columna 'Ajustada' con una 'Estimada' del mismo año", () => {
    const rows = [
      ["2027", "Detalle", "Ajuste", "Valor Hora Ajustada", "Valor Hora Estimada"],
      ["", "01 ene 2027", "01 ene 2027", "01 ene 2027", "01 ene 2027"],
      ["Ana Pérez", "", "", "$1.000,00", "$9.999,00"],
    ];
    expect(parseValorHoraSection(rows, 2027, { allowEstimatedFallback: true })[0].monthlyRates.jan2027).toBe(1000);
  });

  it("trata un año futuro aún no cargado como aviso informativo, no como error", () => {
    const future = describeSheetsSyncError(new SheetsLayoutError("SECTION_NOT_FOUND", 2027, "x"), 2026);
    expect(future.severity).toBe("info");
    const current = describeSheetsSyncError(new SheetsLayoutError("SECTION_NOT_FOUND", 2026, "x"), 2026);
    expect(current.severity).toBe("error");
    expect(describeSheetsSyncError(new Error("boom")).code).toBe("GOOGLE_SYNC_FAILED");
    // Un layout roto en un año futuro NO se disfraza de "pendiente de carga".
    expect(describeSheetsSyncError(new SheetsLayoutError("HEADERS_NOT_FOUND", 2027, "x"), 2026).severity).toBe("error");
  });

  it("lee el Máster una sola vez y registra el detalle por año", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("await fetchValorHoraForYears(rawYears)");
    expect(routes).toContain("[sheets-sync/auto-apply] ${year}: ${syncError.code}");
    const admin = source("client/src/pages/admin-fixed.tsx");
    expect(admin).toContain('value.severity !== "info"');
  });
});

describe("Feedback 5-10 · cotizaciones", () => {
  it("deriva markup de los montos: total igual al costo no es 100% (2.0x)", () => {
    const pricing = quotationListPricing({ baseCost: 1000, totalAmount: 1000, complexityAdjustment: 0 });
    expect(pricing.cost).toBe(1000);
    expect(pricing.hasMarkup).toBe(false);
  });

  it("incluye todos los componentes de costo y calcula el factor real", () => {
    const pricing = quotationListPricing({ baseCost: 1000, toolsCost: 200, platformCost: 300, totalAmount: 3750 });
    expect(pricing.cost).toBe(1500);
    expect(pricing.factor).toBeCloseTo(2.5, 6);
    expect(pricing.hasMarkup).toBe(true);
  });

  it("la tarjeta de la lista usa el mismo helper y la lista vacía considera sólo las no agrupadas", () => {
    const page = source("client/src/pages/manage-quotes.tsx");
    expect(page).toContain("quotationListPricing(quote)");
    expect(page).toContain("standaloneQuotations.length > 0 ?");
    expect(page).not.toContain("Number(quote.marginFactor) || 1");
  });

  it("las cotizaciones archivadas no reaparecen en grupos ni por lead", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("and(eq(quotationGroupItems.groupId, groupId), isNull(quotations.archivedAt))");
    expect(routes).toContain("and(eq(quotations.leadId, leadId), isNull(quotations.archivedAt))");
  });
});

describe("Feedback 5-10 · horas al dueño de la tarea", () => {
  it("el popover deriva el destino del responsable sin depender de un efecto", () => {
    const quick = source("client/src/components/tasks/QuickTaskHours.tsx");
    expect(quick).toContain("const ownerId = isTeamManager && taskSummary?.assigneeId ? taskSummary.assigneeId : null;");
    expect(quick).toContain("ownerPending");
    expect(quick).toContain("Yo (no soy el responsable)");
    expect(quick).toContain("startTimer(taskId, taskSummary?.title ?? `Tarea #${taskId}`, timerPersonnelId)");
  });

  it("el detalle y las subtareas también cargan al dueño", () => {
    const panel = source("client/src/components/tasks/TaskDetailPanel.tsx");
    expect(panel).toContain("effectiveLogPersonnelId");
    expect(panel).toContain("subtaskOwnerId");
    expect(panel).not.toContain("múltiplos de 15 min");
  });

  it("el servidor deja cargar al dueño a quien gestiona tareas aunque no esté vinculado a Personal", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("if (!authenticatedPerson && !loggingForOther)");
    expect(routes).toContain("assigneeName: assignee?.name ?? null");
  });
});

describe("Feedback 5-10 · correcciones de la auditoría", () => {
  it("el markup de la lista se mide sobre el precio neto de IVA", () => {
    const net = quotationListPricing({ baseCost: 1000, totalAmount: 2420, taxRate: 21, pricesIncludeTax: true });
    expect(net.factor).toBeCloseTo(2, 6);
    expect(quotationListPricing({ baseCost: 1000, totalAmount: 2000, taxRate: 21, pricesIncludeTax: false }).factor).toBeCloseTo(2, 6);
  });

  it("con una variante aceptada no inventa un markup mezclando costos de otra propuesta", () => {
    expect(quotationListPricing({ baseCost: 1000, totalAmount: 5000, acceptedVariantId: 7 }).factor).toBeNull();
  });

  it("un proyecto con costo y sin ingreso conserva una señal informativa", () => {
    const result = computeAlerts([project()]);
    expect(result.alerts.some((alert) => alert.id === "no-revenue-1" && alert.type === "info")).toBe(true);
  });

  it("el portal público ignora propuestas archivadas tras el envío", () => {
    expect(source("server/routes.ts")).toContain("inArray(quotations.id, deliveredIds), isNull(quotations.archivedAt)");
  });

  it("el popover bloquea la carga de managers hasta conocer al dueño, también si falla la consulta", () => {
    const quick = source("client/src/components/tasks/QuickTaskHours.tsx");
    expect(quick).toContain("const ownerPending = isTeamManager && open && !taskSummary;");
    expect(quick).toContain("timerPersonnelId");
    expect(source("client/src/components/tasks/TaskDetailPanel.tsx")).toContain("dueño/a de la tarea</SelectItem>");
  });

});
