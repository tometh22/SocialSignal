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

import { calculateVacationLedger, summarizeAbsenceBalance } from "../shared/utils/absence-balance";
import { nextBirthday, parseBirthdayMonthDay, upcomingBirthdays } from "../shared/utils/birthdays";

describe("Feedback 5-10 · saldos de ausencias", () => {
  const noHolidays = new Set<string>();
  // 2026-03-02 (lun) → 2026-03-06 (vie) = 5 días hábiles
  const week = { startDate: "2026-03-02", endDate: "2026-03-06" };

  it("los días trasladados se suman al mismo pool que el cupo del año", () => {
    const ledger = calculateVacationLedger(2026, [{ year: 2026, vacationDays: 15, vacationCarryoverDays: 3 }], [week], noHolidays);
    expect(ledger[2026]).toMatchObject({ availableDays: 18, usedDays: 5, balanceDays: 13, advanceDebtDays: 0 });
  });

  it("lo que excede el disponible pasa como deuda al año siguiente", () => {
    const ledger = calculateVacationLedger(
      2027,
      [{ year: 2026, vacationDays: 3, vacationCarryoverDays: 0 }, { year: 2027, vacationDays: 15, vacationCarryoverDays: 0 }],
      [week],
      noHolidays,
    );
    expect(ledger[2026].balanceDays).toBe(-2);
    expect(ledger[2027]).toMatchObject({ advanceDebtDays: 2, availableDays: 13 });
  });

  it("resume vacaciones, Epical y los días que no descuentan cupo por separado", () => {
    const summary = summarizeAbsenceBalance({
      year: 2026,
      allowances: [{ year: 2026, vacationDays: 15, vacationCarryoverDays: 0, epicalDays: 3 }],
      takenAbsences: [
        { type: "vacation", ...week },
        { type: "epical_day", startDate: "2026-04-01", endDate: "2026-04-01" },
        { type: "sick", startDate: "2026-05-04", endDate: "2026-05-05" },
      ],
      pendingAbsences: [{ type: "vacation", startDate: "2026-06-01", endDate: "2026-06-02" }],
      holidayDates: noHolidays,
    });
    expect(summary.vacation).toMatchObject({ used: 5, balance: 10, pending: 2 });
    expect(summary.epical).toMatchObject({ quota: 3, used: 1, balance: 2 });
    expect(summary.notCounted).toEqual({ sick: 2, other: 0 });
  });

  it("sin cupo configurado no inventa saldo", () => {
    const summary = summarizeAbsenceBalance({ year: 2026, allowances: [], takenAbsences: [], holidayDates: noHolidays });
    expect(summary.configured).toBe(false);
    expect(summary.epical.balance).toBeNull();
  });

  it("el endpoint de resumen es sólo para Operaciones y el Home usa el mismo cálculo", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('app.get("/api/absence-allowances/summary"');
    expect(routes).toContain('import { calculateVacationLedger, summarizeAbsenceBalance } from "@shared/utils/absence-balance"');
    const page = source("client/src/pages/personnel-absences.tsx");
    expect(page).toContain("absence-balance-strip");
    expect(page).toContain("Si aprobás: quedan");
  });
});

describe("Feedback 5-10 · cumpleaños del equipo", () => {
  const today = new Date(2026, 9, 5); // 5/oct/2026

  it("parsea mes y día e ignora el año", () => {
    expect(parseBirthdayMonthDay("1990-10-07")).toEqual({ month: 10, day: 7 });
    expect(parseBirthdayMonthDay("")).toBeNull();
    expect(parseBirthdayMonthDay("1990-13-01")).toBeNull();
  });

  it("calcula el próximo cumpleaños, incluso pasando de año", () => {
    expect(nextBirthday({ month: 10, day: 5 }, today).daysUntil).toBe(0);
    expect(nextBirthday({ month: 10, day: 4 }, today).daysUntil).toBe(364);
    expect(nextBirthday({ month: 1, day: 1 }, today).date.getFullYear()).toBe(2027);
  });

  it("el 29/02 se celebra el 28/02 en años no bisiestos", () => {
    const next = nextBirthday({ month: 2, day: 29 }, new Date(2027, 0, 10));
    expect([next.date.getMonth(), next.date.getDate()]).toEqual([1, 28]);
  });

  it("lista sólo los del horizonte, ordenados", () => {
    const list = upcomingBirthdays([
      { name: "Zoe", month: 10, day: 20 }, { name: "Ana", month: 10, day: 6 }, { name: "Lejos", month: 2, day: 1 },
    ], today, 30);
    expect(list.map((entry) => entry.name)).toEqual(["Ana", "Zoe"]);
  });

  it("el endpoint no expone año, tarifas ni personal dado de baja", () => {
    const routes = source("server/routes.ts");
    const block = routes.slice(routes.indexOf('app.get("/api/birthdays"'), routes.indexOf('app.get("/api/personnel", requireAuth'));
    expect(block).toContain("row.activeUntil >= today");
    expect(block).toContain("{ name: row.name, ...parsed }");
    expect(block).not.toContain("hourlyRate");
  });
});

import { isMarginDriftDismissalActive } from "../shared/utils/quotation-margin-drift";

describe("Feedback 5-10 · descartar alerta de margen", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const watch = { marginErosionPoints: 7, severity: "watch" as const };
  const base = { snoozedUntil: null, baselineErosionPoints: 7, baselineSeverity: "watch" as const };

  it("mantiene el descarte mientras nada cambie", () => {
    expect(isMarginDriftDismissalActive(base, watch, now)).toBe(true);
    expect(isMarginDriftDismissalActive({ ...base, snoozedUntil: "2026-12-01T00:00:00Z" }, watch, now)).toBe(true);
  });

  it("se reactiva al vencer el plazo", () => {
    expect(isMarginDriftDismissalActive({ ...base, snoozedUntil: "2026-10-01T00:00:00Z" }, watch, now)).toBe(false);
  });

  it("se reactiva si la erosión empeora 5 puntos o más sobre la línea base", () => {
    expect(isMarginDriftDismissalActive(base, { marginErosionPoints: 11.9, severity: "watch" }, now)).toBe(true);
    expect(isMarginDriftDismissalActive(base, { marginErosionPoints: 12, severity: "watch" }, now)).toBe(false);
  });

  it("se reactiva si la severidad empeora (watch → critical)", () => {
    expect(isMarginDriftDismissalActive({ ...base, baselineErosionPoints: 12 }, { marginErosionPoints: 15.5, severity: "critical" }, now)).toBe(false);
  });

  it("una cuenta ya crítica por margen ≤ 0 con poca erosión NO se reactiva de inmediato", () => {
    const critical = { marginErosionPoints: 3, severity: "critical" as const };
    expect(isMarginDriftDismissalActive({ snoozedUntil: null, baselineErosionPoints: 3, baselineSeverity: "critical" }, critical, now)).toBe(true);
    expect(isMarginDriftDismissalActive({ snoozedUntil: null, baselineErosionPoints: -4, baselineSeverity: "critical" }, { marginErosionPoints: -4, severity: "critical" }, now)).toBe(true);
  });

  it("la línea base la fija el servidor (no se acepta del cliente), se audita y se persiste con migración", () => {
    const routes = source("server/routes.ts");
    const dismiss = routes.slice(routes.indexOf('app.post("/api/quotations/:id/margin-drift/dismiss"'), routes.indexOf('app.delete("/api/quotations/:id/margin-drift/dismiss"'));
    expect(dismiss).toContain(".strict().parse(req.body)");
    expect(dismiss).not.toMatch(/input\.baseline/);
    expect(dismiss).toContain("computeQuotationMarginDrift(quotation)");
    expect(dismiss).toContain("margin_alert_dismissed");
    expect(routes).toContain("isMarginDriftDismissalActive(row.dismissal, item, now)");
    expect(routes).toContain("descartes no disponibles");
    expect(source("server/index.ts")).toContain("0076 quotation alert dismissals");
    expect(source("migrations/0076_quotation_alert_dismissals.sql")).toContain("baseline_severity");
    expect(source("shared/schema.ts")).toContain('unique("quotation_alert_dismissals_quotation_alert_unique")');
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

  it("rechaza cumpleaños con día inexistente y acepta el 29/02", () => {
    expect(parseBirthdayMonthDay("1990-04-31")).toBeNull();
    expect(parseBirthdayMonthDay("1990-02-30")).toBeNull();
    expect(parseBirthdayMonthDay("1992-02-29")).toEqual({ month: 2, day: 29 });
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

  it("no copia el motivo del descarte a los metadatos del evento (commercial-history es legible por cualquier usuario)", () => {
    const routes = source("server/routes.ts");
    const dismiss = routes.slice(routes.indexOf('app.post("/api/quotations/:id/margin-drift/dismiss"'), routes.indexOf('app.delete("/api/quotations/:id/margin-drift/dismiss"'));
    expect(dismiss).toContain('metadata: { alertType: "margin_drift" }');
    expect(routes).toContain("margin_alert_reactivated");
  });

  it("el balance de Epical que decide una aprobación no se recorta a cero", () => {
    expect(source("client/src/pages/personnel-absences.tsx")).toContain("after(person.epical.quota - person.epical.used)");
  });

});
