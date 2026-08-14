import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  insertHolidaySchema,
  insertPersonnelHistoricalCostSchema,
  insertQuotationSchema,
  insertQuotationTeamMemberSchema,
  insertTaskWeeklyEstimateSchema,
} from "../shared/schema";
import { parseMoneyUnified } from "../server/utils/money";
import {
  currentCivilWeekRange,
  formatCivilDate,
  parseCivilDate,
} from "../server/utils/civil-date";
import { isProjectCreatedRecently } from "../shared/utils/projectActivity";
import { resolvePeriod } from "../shared/utils/timePeriod";
import {
  aggregateWeeklyEstimatesByTask,
  weeklyEstimateOverlapsRange,
} from "../shared/utils/taskEstimates";
import { ApiError, getApiErrorMessage, parseApiError } from "../client/src/lib/api-error";
import {
  describeSheetsSyncError,
  mergePersonnelMetadata,
  parsePersonnelMetadataGrid,
  parseValorHoraSection,
} from "../server/services/personnelSheetsSync";
import { deriveMonthlySalariesFromHourlyRates } from "../shared/utils/personnel-cost";

test("quotation contract accepts numeric exchangeRateAtQuote and normalizes it for numeric columns", () => {
  const parsed = insertQuotationSchema.parse({
    clientId: 1,
    projectName: "Prueba",
    analysisType: "standard",
    projectType: "on-demand",
    mentionsVolume: "medium",
    countriesCovered: "1",
    clientEngagement: "medium",
    baseCost: 100,
    complexityAdjustment: 0,
    markupAmount: 100,
    totalAmount: 200,
    exchangeRateAtQuote: 1325.5,
  });

  expect(parsed.exchangeRateAtQuote).toBe("1325.5");
});

test("canonical personnel history accepts numeric form values for PostgreSQL numeric columns", () => {
  const parsed = insertPersonnelHistoricalCostSchema.parse({
    personnelId: 1,
    year: 2026,
    month: 7,
    hourlyRateARS: 25_000,
    monthlySalaryARS: 4_000_000,
    hourlyRateUSD: 20,
  });

  expect(parsed.hourlyRateARS).toBe("25000");
  expect(parsed.monthlySalaryARS).toBe("4000000");
  expect(parsed.hourlyRateUSD).toBe("20");
});

test("holidays use civil YYYY-MM-DD values without timezone conversion", () => {
  const parsed = insertHolidaySchema.parse({
    date: "2026-08-17",
    name: "San Martín",
    year: 2026,
    isNational: true,
  });

  expect(parsed.date).toBe("2026-08-17");
  expect(insertHolidaySchema.safeParse({
    date: "2026-08-17T00:00:00.000Z",
    name: "Inválido",
    year: 2026,
  }).success).toBe(false);
});

test("ledger money parser supports Argentine and US formatted amounts", () => {
  expect(parseMoneyUnified("1.234,56")).toBe(1234.56);
  expect(parseMoneyUnified("1,234.56")).toBe(1234.56);
  expect(parseMoneyUnified("$ 2.000.000")).toBe(2_000_000);
});

test("January periods remain in January when parsed as civil dates", () => {
  const january = parseCivilDate("2026-01-01");
  expect(january.getFullYear()).toBe(2026);
  expect(january.getMonth()).toBe(0);
  expect(formatCivilDate(january)).toBe("2026-01-01");
  expect(resolvePeriod("2026-01")).toEqual({
    start: "2026-01-01",
    end: "2026-01-31",
    label: "January 2026",
    monthKeys: ["2026-01"],
  });
});

test("weekly task totals use the Buenos Aires civil week", () => {
  const fridayInBuenosAires = new Date("2026-07-24T23:30:00-03:00");
  expect(currentCivilWeekRange(fridayInBuenosAires)).toEqual({
    dateFrom: "2026-07-20",
    dateTo: "2026-07-26",
  });
});

test("quotation team members reject invalid identifiers and negative effort", () => {
  expect(insertQuotationTeamMemberSchema.safeParse({
    quotationId: 1,
    personnelId: 0,
    roleId: 2,
    hours: 10,
    rate: 100,
    cost: 1000,
  }).success).toBe(false);
  expect(insertQuotationTeamMemberSchema.safeParse({
    quotationId: 1,
    personnelId: 2,
    roleId: 2,
    hours: -1,
    rate: 100,
    cost: 0,
  }).success).toBe(false);
});

test("new projects remain visible in the default activity window", () => {
  expect(isProjectCreatedRecently("2026-01-15T12:00:00.000Z", "2026-01")).toBe(true);
  expect(isProjectCreatedRecently("2025-12-15T12:00:00.000Z", "2026-01")).toBe(true);
  expect(isProjectCreatedRecently("2025-09-15T12:00:00.000Z", "2026-01")).toBe(false);
});

describe("weekly planning source", () => {
  test("requires a civil week key and positive effort", () => {
    expect(insertTaskWeeklyEstimateSchema.safeParse({
      taskId: 10,
      weekStart: "2026-07-20",
      estimatedHours: 4,
    }).success).toBe(true);
    expect(insertTaskWeeklyEstimateSchema.safeParse({
      taskId: 10,
      weekStart: "2026-07-20T00:00:00.000Z",
      estimatedHours: 4,
    }).success).toBe(false);
    expect(insertTaskWeeklyEstimateSchema.safeParse({
      taskId: 10,
      weekStart: "2026-07-20",
      estimatedHours: 0,
    }).success).toBe(false);
  });

  test("aggregates multiple weeks and filters by overlapping date range", () => {
    const estimates = [
      { taskId: 10, weekStart: "2026-07-20", estimatedHours: 4 },
      { taskId: 10, weekStart: "2026-07-27", estimatedHours: 6 },
      { taskId: 11, weekStart: "2026-08-03", estimatedHours: 3 },
    ];
    const totals = aggregateWeeklyEstimatesByTask(estimates, {
      dateFrom: "2026-07-24T00:00:00.000Z",
      dateTo: "2026-07-31T23:59:59.999Z",
    });
    expect(totals.get(10)).toBe(10);
    expect(totals.has(11)).toBe(false);
    expect(weeklyEstimateOverlapsRange("2026-07-20", {
      dateFrom: "2026-07-24",
      dateTo: "2026-07-24",
    })).toBe(true);
  });
});

describe("structured API errors", () => {
  test("preserves quotation field paths and formats the affected team member", () => {
    const error = parseApiError(400, JSON.stringify({
      message: "Invalid quotation data",
      errors: [{
        path: ["teamMembers", 1, "personnelId"],
        message: "La persona seleccionada no existe",
      }],
    }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.errors).toHaveLength(1);
    expect(getApiErrorMessage(error)).toContain("Equipo · integrante 2 · persona");
    expect(getApiErrorMessage(error)).toContain("La persona seleccionada no existe");
  });
});

test("task status has one list editor while board status changes only through drag and drop", () => {
  const source = readFileSync(
    new URL("../client/src/components/tasks/ProjectTaskList.tsx", import.meta.url),
    "utf8",
  );
  const taskRow = source.slice(
    source.indexOf("function TaskRow"),
    source.indexOf("function SectionBlock"),
  );
  const boardCard = source.slice(
    source.indexOf("function BoardCard"),
    source.indexOf("function BoardColumn"),
  );

  expect(taskRow).toContain("<PopoverTrigger asChild>");
  expect(taskRow).toContain("onStatusChange?.(task.id, s)");
  expect(boardCard).toContain("useDraggable");
  expect(boardCard).not.toContain("onStatusChange");
  expect(boardCard).not.toContain(">Estado</DropdownMenuLabel>");
  expect(source).toContain("handleBoardStatusChange(taskId, toStatus)");
});

test("task hours remain loadable when historical costing is unavailable", () => {
  const routes = readFileSync(
    new URL("../server/routes.ts", import.meta.url),
    "utf8",
  );
  const endpoint = routes.slice(
    routes.indexOf('app.post("/api/tasks/:id/time"'),
    routes.indexOf('// DELETE /api/tasks/:taskId/time/:entryId'),
  );

  expect(endpoint).toContain("let costingWarning");
  expect(endpoint).toContain("res.json({ ...created, costingWarning })");
  expect(endpoint).not.toContain("return res.status(422)");
  expect(endpoint).toContain("parseCivilDate(rawDate)");
});

test("task detail does not depend on optional estimate columns", () => {
  const routes = readFileSync(
    new URL("../server/routes.ts", import.meta.url),
    "utf8",
  );
  const endpoint = routes.slice(
    routes.indexOf('// GET /api/tasks/:id — obtener tarea individual'),
    routes.indexOf('// POST /api/tasks — crear tarea'),
  );

  expect(endpoint).toContain("taskTimeEntries.description");
  expect(endpoint).toContain("weekly estimates unavailable");
  expect(endpoint).toContain("No se pudo cargar el detalle de la tarea");
});

test("quotation team payload treats an empty role sentinel as absent", () => {
  const context = readFileSync(
    new URL("../client/src/context/optimized-quote-context.tsx", import.meta.url),
    "utf8",
  );

  expect(context).toContain("Number.isInteger(roleId) && roleId > 0 ? roleId : null");
  expect(insertQuotationTeamMemberSchema.safeParse({
    quotationId: 1,
    personnelId: 2,
    roleId: null,
    hours: 10,
    rate: 100,
    cost: 1000,
  }).success).toBe(true);
});

test("Google personnel rows capture current role, sublevel and legacy freelance role", () => {
  const rows = [
    ["2026", "Rol", "SUBNIVEL", "Rol Viejo", "Valor Hora Ajustada", "Sueldo Mensual"],
    ["", "", "", "", "01 ene 2026", "01 ene 2026"],
    ["Ana", "Senior", "S2", "Analista vieja", "$10.000", "$1.600.000"],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
  ];
  const parsed = parseValorHoraSection(rows, 2026);
  expect(parsed[0]).toMatchObject({
    sheetName: "Ana",
    currentRole: "Senior",
    sublevel: "S2",
    legacyRole: "Analista vieja",
    monthlyRates: { jan2026: 10000 },
    monthlySalaries: { jan2026: 1600000 },
  });
});

test("Google personnel metadata is discovered from its independent catalogue table", () => {
  const metadata = parsePersonnelMetadataGrid([
    ["Listado actualizado"],
    ["Nombre", "Mail", "Rol viejo", "Estado", "Rol", "Subnivel"],
    ["Ana Pérez", "ana@example.com", "Analista", "ACTIVO", "Productora", "Senior"],
  ]);
  expect(metadata).toEqual([{
    sheetName: "Ana Pérez",
    email: "ana@example.com",
    legacyRole: "Analista",
    currentRole: "Productora",
    sublevel: "Senior",
  }]);
  expect(mergePersonnelMetadata([{
    sheetName: "ANA PEREZ",
    monthlyRates: { aug2026: 10_000 },
  }], metadata)).toEqual([{
    sheetName: "ANA PEREZ",
    monthlyRates: { aug2026: 10_000 },
    legacyRole: "Analista",
    currentRole: "Productora",
    sublevel: "Senior",
  }]);
});

test("salary remains informational and freelance capacity can be null", () => {
  const parsed = insertPersonnelHistoricalCostSchema.parse({
    personnelId: 1,
    year: 2026,
    month: 8,
    monthlySalaryARS: 1200000,
    hourlyRateARS: 10000,
  });
  expect(parsed.monthlySalaryARS).toBe("1200000");
  const schema = readFileSync(new URL("../shared/schema.ts", import.meta.url), "utf8");
  expect(schema).toContain('monthlyHours: doublePrecision("monthly_hours").default(160)');
  expect(schema).not.toContain('monthlyHours: doublePrecision("monthly_hours").default(160).notNull()');
});

test("changing hourly values or monthly hours derives monthly salaries", () => {
  expect(deriveMonthlySalariesFromHourlyRates({ hourlyRateARS: 10_000, monthlyHours: 160 }))
    .toEqual({ monthlySalaryARS: 1_600_000, monthlyHoursSnapshot: 160 });
  expect(deriveMonthlySalariesFromHourlyRates({ hourlyRateUSD: 20, monthlyHours: 160 }))
    .toEqual({ monthlySalaryUSD: 3_200, monthlyHoursSnapshot: 160 });
  expect(deriveMonthlySalariesFromHourlyRates({ hourlyRateARS: 13_333.33, monthlyHours: 120 }))
    .toEqual({ monthlySalaryARS: 1_599_999.6, monthlyHoursSnapshot: 120 });
  expect(deriveMonthlySalariesFromHourlyRates({ hourlyRateARS: 10_000, monthlyHours: null }))
    .toEqual({});
});

test("personnel updates keep the current historical cost aligned when hours change", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const endpoint = routes.slice(
    routes.indexOf('app.patch("/api/personnel/:id"'),
    routes.indexOf('app.get("/api/personnel/:id/dependencies"'),
  );
  expect(endpoint).toContain("deriveMonthlySalariesFromHourlyRates");
  expect(endpoint).toContain("monthlyHoursSnapshot: derived.monthlyHoursSnapshot ?? null");
  expect(endpoint).toContain("eq(personnelHistoricalCosts.month, currentMonth)");
  expect(endpoint).toContain('adjustmentReason: "Cambio de horas contractuales"');
});

test("quote projection exposes only snapshot and annual average", () => {
  const enhanced = readFileSync(new URL("../client/src/components/optimized/EnhancedTeamConfig.tsx", import.meta.url), "utf8");
  const review = readFileSync(new URL("../client/src/components/optimized/financial-review-final.tsx", import.meta.url), "utf8");
  expect(enhanced).not.toContain("Tarifa estimada proyectada");
  expect(review).not.toContain("Proyectado al mes del proyecto");
  expect(enhanced).toContain("Promedio anual estimado");
});

test("project visibility and duplicate holiday rules are enforced server-side", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const projects = routes.slice(routes.indexOf('app.get("/api/tasks/projects"'), routes.indexOf('// POST /api/tasks/projects/create'));
  expect(projects).toContain("task_project_members");
  expect(projects).toContain("collaborator_ids @>");
  expect(projects).toContain("requestedStatus");
  const holidays = routes.slice(routes.indexOf('app.post("/api/holidays"'), routes.indexOf('app.delete("/api/holidays/:id"'));
  expect(holidays).toContain("status(409)");
  expect(holidays).toContain("sameDate");
});

test("hours dashboard reads both legacy and task time sources", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const endpoint = routes.slice(
    routes.indexOf('app.get("/api/tasks/hours-summary"'),
    routes.indexOf('app.get("/api/tasks/my-hours"'),
  );
  expect(endpoint).toContain("db.select().from(taskTimeEntries)");
  expect(endpoint).toContain("db.select().from(timeEntries)");
  expect(endpoint).toContain('source: "legacy"');
});

test("quotation validation no longer exposes the generic invalid-data message", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const quotationRoutes = routes.slice(
    routes.indexOf('app.post("/api/quotations"'),
    routes.indexOf('app.patch("/api/quotations/:id/status"'),
  );
  expect(quotationRoutes).not.toContain('message: "Invalid quotation data"');
  expect(quotationRoutes).toContain("revisá el detalle de errores por campo");
});

test("task dates use a civil range in detail and list editors", () => {
  const detail = readFileSync(new URL("../client/src/components/tasks/TaskDetailPanel.tsx", import.meta.url), "utf8");
  const list = readFileSync(new URL("../client/src/components/tasks/ProjectTaskList.tsx", import.meta.url), "utf8");
  expect(detail).toContain('mode="range"');
  expect(detail).toContain('format(range.from, "yyyy-MM-dd")');
  expect(detail).not.toContain('startDate: d ? d.toISOString()');
  expect(list).toContain('selected={{ from: parseCivilTaskDate(startDate), to: parseCivilTaskDate(dueDate) }}');
});

test("project complete-data redacts financial fields for non-Operations users", () => {
  const completeData = readFileSync(new URL("../server/routes/complete-data.ts", import.meta.url), "utf8");
  expect(completeData).toContain("redactFinancialProjectData");
  expect(completeData).toContain("canSeeFinancials");
  expect(completeData).toContain("delete quotation.totalAmount");
  expect(completeData).toContain("delete safeMember.personnel.hourlyRate");
  expect(completeData).toContain("ingresos: undefined");
});

test("calendar date windows overlap task ranges and include collaborators", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const calendar = routes.slice(
    routes.indexOf('app.get("/api/tasks/team-calendar"'),
    routes.indexOf('// GET /api/tasks/project/:projectId'),
  );
  expect(calendar).toContain("isNotNull(tasks.startDate)");
  expect(calendar).toContain("isNull(tasks.dueDate)");
  expect(calendar).toContain("collaboratorIds");
  expect(calendar).toContain("jsonb_build_array");
  expect(calendar).toContain("COALESCE(${tasks.startDate}, ${tasks.dueDate})");
});

test("monthly closing persists one canonical ARS/USD snapshot", () => {
  const schema = readFileSync(new URL("../shared/schema.ts", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const closing = schema.slice(schema.indexOf("export const monthlyClosings"), schema.indexOf("// ==================== PROYECTOS ACTIVOS"));
  const endpoint = routes.slice(routes.indexOf('app.post("/api/monthly-closings"'), routes.indexOf('// ==================== ESTIMATED RATES CRUD'));
  for (const field of ["billingCurrency", "usdBillingFraction", "totalCostARS", "totalCostUSD", "grandTotalARS", "grandTotalUSD"]) {
    expect(closing).toContain(field);
    expect(endpoint).toContain(field);
  }
  expect(endpoint).toContain("totalCost: grandTotalARS");
  expect(endpoint).toContain("billingCurrency: data.billingCurrency");
  expect(endpoint).toContain("grandTotalUSD: data.grandTotalUSD");
});

test("task creation invalidates personal task surfaces", () => {
  const taskList = readFileSync(new URL("../client/src/components/tasks/ProjectTaskList.tsx", import.meta.url), "utf8");
  expect(taskList).toContain('queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] })');
  expect(taskList).toContain('queryClient.invalidateQueries({ queryKey: ["/api/tasks/team-calendar"] })');
});

test("home hours include task and legacy time entries", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const myHours = routes.slice(
    routes.indexOf('app.get("/api/tasks/my-hours"'),
    routes.indexOf('// GET /api/tasks/:id — obtener tarea individual'),
  );
  expect(myHours).toContain("FROM task_time_entries");
  expect(myHours).toContain("FROM time_entries");
  expect(myHours).toContain("UNION ALL");
});

test("creator-owned unassigned tasks stay visible in personal surfaces", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const myTasks = routes.slice(
    routes.indexOf('app.get("/api/tasks/my-tasks"'),
    routes.indexOf('// GET /api/tasks/team-calendar'),
  );
  const calendar = routes.slice(
    routes.indexOf('app.get("/api/tasks/team-calendar"'),
    routes.indexOf('// GET /api/tasks/project/:projectId'),
  );
  for (const endpoint of [myTasks, calendar]) {
    expect(endpoint).toContain("tasks.createdBy");
    expect(endpoint).toContain("isNull(tasks.assigneeId)");
    expect(endpoint).toContain("jsonb_array_length");
  }
});

test("Home uses the membership-scoped project hierarchy and exposes link problems", () => {
  const home = readFileSync(new URL("../client/src/pages/home-dashboard.tsx", import.meta.url), "utf8");
  const auth = readFileSync(new URL("../server/auth.ts", import.meta.url), "utf8");
  expect(home).toContain("/api/tasks/projects?status=active&scope=mine");
  expect(home).toContain("homeProjectView");
  expect(home).toContain("personnelLinked === false");
  expect(auth).toContain("personnelLinked: Boolean(linkedPersonnel)");
  expect(auth).toContain("trim().toLowerCase()");
});

test("Google sync auth failures are actionable and never look successful", () => {
  const invalid = describeSheetsSyncError(new Error("invalid_grant: Invalid JWT Signature"));
  expect(invalid.code).toBe("GOOGLE_AUTH_INVALID");
  expect(invalid.message).toContain("GOOGLE_PRIVATE_KEY");
  expect(invalid.action).toContain("No se aplicaron cambios");

  const generic = describeSheetsSyncError(new Error("timeout"));
  expect(generic.code).toBe("GOOGLE_SYNC_FAILED");
  expect(generic.retryable).toBe(true);
});

test("personnel screen exposes derived current salary and one historical cost table", () => {
  const inline = readFileSync(new URL("../client/src/components/admin/inline-edit-personnel.tsx", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../client/src/pages/admin-fixed.tsx", import.meta.url), "utf8");
  const table = readFileSync(new URL("../client/src/components/admin/HistoricalCostsTable.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  expect(inline).toContain("currentMonthlySalaryARS");
  expect(inline).toContain("Calculado automáticamente");
  expect(admin).toContain("#personal-cost-history");
  expect(table).toContain("El valor hora es la fuente canónica");
  expect(admin).not.toContain("PersonnelHistoricalCostsManager");
  expect(routes).toContain("currentCostId: currentRate?.id ?? null");
});
