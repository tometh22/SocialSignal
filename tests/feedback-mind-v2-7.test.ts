import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { normalizeContractualRateToARS } from "../server/domain/currency-normalization";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Feedback Mind V2.7 — personal y cotizaciones", () => {
  test("la grilla de costos permite navegar años y usa el historial normalizado", () => {
    const table = source("client/src/components/admin/HistoricalCostsTable.tsx");

    expect(table).toContain("const [selectedYear, setSelectedYear] = useState(currentYear)");
    expect(table).toContain("cost.year === selectedYear");
    expect(table).toContain("currentYear + 1");
    expect(table).toContain("currentRole");
    expect(table).toContain("sublevel");
    expect(table).toContain('field: "hourlyRateARS"');
    expect(table).toContain('field: "hourlyRateUSD"');
    expect(table).toContain('field: "monthlyHoursSnapshot"');
    expect(table).toContain('billingCurrency === "MIXED"');
    expect(table).toContain("El sueldo mensual se calcula automáticamente");
    expect(table).not.toContain("cost.year === 2025");
  });

  test("rol vigente y subnivel se pueden corregir desde Personal", () => {
    const inline = source("client/src/components/admin/inline-edit-personnel.tsx");

    expect(inline).toContain('currentRole: person.currentRole ?? ""');
    expect(inline).toContain('legacyRole: person.legacyRole ?? ""');
    expect(inline).toContain('sublevel: form.sublevel.trim() || null');
    expect(inline).toContain('aria-label="Subnivel"');
  });

  test("la moneda se elige con confirmación y el flujo usa cuatro fases responsive", () => {
    const basic = source("client/src/components/optimized/basic-info.tsx");
    const team = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    const stepper = source("client/src/pages/optimized-quote.tsx");

    expect(basic).toContain("updateQuotationCurrency");
    expect(basic).toContain("Moneda de cotización");
    expect(basic).toContain("max-w-5xl");
    expect(team).toContain("md:justify-center");
    expect(basic).toContain("setPendingCurrency(currency)");
    expect(stepper).toContain("grid grid-cols-2 gap-2 lg:grid-cols-4");
    expect(stepper).toContain("QUOTATION_PHASES");
  });

  test("las carpetas de cotizaciones empiezan cerradas", () => {
    const quotes = source("client/src/pages/manage-quotes.tsx");

    expect(quotes).toContain("const [expandedQuoteClients, setExpandedQuoteClients] = useState<Set<string>>(new Set())");
    expect(quotes).toContain("expandedQuoteClients.has(clientName)");
  });
});

describe("Feedback Mind V2.7 — proyectos y tareas", () => {
  test("proyectos abre con estado activo, sin filtro de actividad y carpetas cerradas", () => {
    const activeProjects = source("client/src/pages/active-projects-next.tsx");
    const projectsHub = source("client/src/pages/tasks/projects-hub.tsx");

    expect(activeProjects).toContain("useState(false)");
    expect(activeProjects).toContain('useState<LifecycleStatus | "all">("active")');
    expect(activeProjects).toContain("defaultOpen={false}");
    expect(projectsHub).toContain("const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())");
    expect(projectsHub).toContain("expandedClients.has(clientName) &&");
    expect(projectsHub).toContain('scope=${isOperations ? "all" : "mine"}');
    expect(projectsHub).not.toContain('isOperations && view === "panel"');
  });

  test("Inicio muestra horas por proyecto, tareas sin horas, proyecto y carga directa", () => {
    const home = source("client/src/pages/tasks/tasks-home.tsx");

    expect(home).toContain("Horas del mes por proyecto");
    expect(home).toContain("Tareas sin horas");
    expect(home).toContain("projectName");
    expect(home).toContain("<QuickTaskHours");
    expect(home).toContain('mode="range"');
  });

  test("cada tarea tiene un único control de horas con resumen y edición", () => {
    const list = source("client/src/components/tasks/ProjectTaskList.tsx");
    const quickHours = source("client/src/components/tasks/QuickTaskHours.tsx");
    const detail = source("client/src/components/tasks/TaskDetailPanel.tsx");
    const routes = source("server/routes.ts");

    expect(list).toContain("<QuickTaskHours");
    expect(list).not.toContain("function QuickHoursButton");
    expect(quickHours).toContain("Últimas cargas");
    expect(quickHours).toContain("Iniciar temporizador");
    expect(detail).toContain("startEditingTime");
    expect(detail).toContain("editTimeMutation");
    expect(routes).toContain('app.patch("/api/tasks/:taskId/time/:entryId"');
  });

  test("Panel y Resumen están integrados en una sola vista Gestión", () => {
    const project = source("client/src/pages/tasks/project-tasks-page.tsx");
    const overview = source("client/src/components/tasks/ProjectOverviewPanel.tsx");

    expect(project).toContain("Gestión");
    expect(project).toContain("<ProjectOverviewPanel");
    expect(overview).toContain("Progreso general");
    expect(overview).toContain("Equipo del proyecto");
    expect(project).not.toContain('setView("summary")');
    expect(project).toContain('if (stored === "summary") return "panel"');
  });
});

describe("Feedback Mind V2.7 — atribución, costos y capacidad", () => {
  test("la migración runtime cita current_role y el modo de prueba desactiva jobs externos", () => {
    const migration = source("server/migrations/feedback-mind-v2.ts");
    const closure = source("server/migrations/feedback-mind-v2-7.ts");
    const server = source("server/index.ts");

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "current_role" TEXT');
    expect(migration).toContain('SET "current_role" = NULL');
    expect(migration).not.toContain('SET "current_role" = NULL,\n    "sublevel" = NULL');
    expect(closure).toContain("hourly_rate_usd = cost.hourly_rate_ars");
    expect(closure).toContain("system_config_config_key_unique");
    expect(closure).toContain("role.name ILIKE '%semi senior%'");
    expect(closure).toContain("'hours_data_source', 1");
    expect(closure).toContain("'app_mode_cutover_date', 1, '2026-08'");
    expect(server).toContain('const backgroundSyncDisabled = process.env.DISABLE_AUTO_SYNC === "true"');
    expect(server).toContain("Sincronizaciones y jobs externos deshabilitados");
    expect(server).toContain("await backfillNativeLaborOnce()");
    expect(server).toContain("0035_native_task_labor_backfill");
  });

  test("tarifas USD respetan la moneda contractual y el snapshot de la cotización", () => {
    const rateResolver = source("server/domain/personnel-rate.ts");
    const quoteContext = source("client/src/context/optimized-quote-context.tsx");
    const quotePersonnelRate = source("shared/utils/quotation-personnel-rate.ts");
    const variants = source("client/src/components/optimized/QuotationVariants.tsx");

    expect(rateResolver).toContain('eq(systemConfig.configKey, "usd_exchange_rate")');
    expect(rateResolver).toContain("exchangeRateId: fx?.id ?? null");
    expect(quoteContext).toContain("resolveQuotationPersonnelRate");
    expect(quotePersonnelRate).toContain("quotationExchangeRate");
    expect(quotePersonnelRate).toContain('billingCurrency === "mixed"');
    expect(quoteContext).toContain("calculateQuotationPricing");
    expect(variants).toContain("calculateQuotationPricing");
    expect(variants).not.toContain("totalARS +=");
  });

  test("normaliza una tarifa contractual USD una sola vez", () => {
    expect(normalizeContractualRateToARS(5.5, "USD", 1445)).toBe(7947.5);
    expect(normalizeContractualRateToARS(5.5, "USD", 1445, 7947.5)).toBe(7947.5);
    expect(normalizeContractualRateToARS(7947.5, "ARS", 1445)).toBe(7947.5);
    expect(normalizeContractualRateToARS(5.5, "USD", 0)).toBe(0);
  });

  test("los selectores de moneda comparten recálculo y snapshot", () => {
    const context = source("client/src/context/optimized-quote-context.tsx");
    const basic = source("client/src/components/optimized/basic-info.tsx");
    const wizard = source("client/src/pages/optimized-quote.tsx");

    expect(basic).toContain('if (quotationData.teamMembers.length > 0)');
    expect(basic).toContain('updateQuotationCurrency(currency)');
    expect(basic).toContain("updateQuotationCurrency(quotationData.quotationCurrency || \"ARS\", parsedExchangeRate)");
    expect(basic).toContain("parseLocalizedDecimal");
    expect(wizard).not.toContain("CurrencySelection");
    expect(context).toContain("exchangeRateSnapshot: Number(quotation.exchangeRateAtQuote)");
    expect(context).toContain("exchangeRateAtQuote: saveExchangeRate");
  });

  test("sync, hechos y CRUD preservan moneda y eliminan hechos obsoletos", () => {
    const daily = source("server/jobs/daily-sot-sync.ts");
    const canonicalSync = source("server/services/personnel-cost-sync.ts");
    const factBuilder = source("server/etl/time-entries-to-fact-labor.ts");
    const routes = source("server/routes.ts");
    const migration = source("server/migrations/feedback-mind-v2-7-consistency.ts");

    expect(daily).toContain("applyCanonicalPersonnelRateRows");
    expect(canonicalSync).toContain('currency: "ARS" | "USD"');
    expect(canonicalSync).toContain("hourlyRateUSD = currency === \"USD\" ? rate : existing?.hourlyRateUSD");
    expect(canonicalSync).toContain("deriveMonthlySalariesFromHourlyRates");
    expect(factBuilder).toContain("staleFactIds");
    expect(factBuilder).toContain(".delete(factLaborMonth)");
    expect(routes).toContain("triggerLaborRebuildForDates([existingEntry.date, updatedEntry.date])");
    expect(routes).toContain("Solo podés modificar tus propios registros de horas");
    expect(routes).toContain("WITH RECURSIVE task_tree");
    expect(migration).toContain("contractual_usd_rate_repaired");
    expect(migration).toContain("member.rate / mixed.fx");
  });

  test("Operaciones puede atribuir horas a terceros sin permitir suplantación común", () => {
    const routes = source("server/routes.ts");
    const timeEntries = source("client/src/pages/time-entries.tsx");
    const detail = source("client/src/components/tasks/TaskDetailPanel.tsx");

    expect(routes).toContain("const requestedPersonnelId = Number(req.body?.personnelId)");
    expect(routes).toContain("Solo Operaciones puede cargar horas para otra persona");
    expect(routes).toContain("processedData.personnelId = effectivePersonnelId");
    expect(routes).toContain("personnelId: effectivePersonnelId");
    expect(timeEntries).toContain("canLogForOthers");
    expect(detail).toContain("Cargar para");
  });

  test("los costos de proyecto se reconstruyen antes de responder", () => {
    const routes = source("server/routes.ts");

    expect(routes).toContain("async function triggerLaborRebuild");
    expect(routes).toContain("await buildFactLaborFromTimeEntries(periodKey)");
    expect(routes).toContain("await triggerLaborRebuild(data.date)");
  });

  test("feriados y ausencias no descuentan dos veces la capacidad", () => {
    const routes = source("server/routes.ts");
    const capacity = routes.slice(
      routes.indexOf('app.get("/api/capacity/weekly"'),
      routes.indexOf('app.patch("/api/capacity/override"'),
    );

    expect(capacity).toContain("dayOfWeek !== 0");
    expect(capacity).toContain("const holidayDates = new Set");
    expect(capacity).toContain("const absenceDates = new Set<string>()");
    expect(capacity).toContain("!holidayDates.has(dateKey)");
    expect(capacity).toContain("const absenceDays = absenceDates.size");
  });

  test("Operaciones ve todos los proyectos activos y el estado sigue siendo el filtro canónico", () => {
    const routes = source("server/routes.ts");
    const projects = routes.slice(
      routes.indexOf('app.get("/api/tasks/projects"'),
      routes.indexOf("// POST /api/tasks/projects/create"),
    );

    expect(projects).toContain("const visibility = isOperations");
    expect(projects).toContain('String(req.query.status || "active")');
    expect(projects).toContain("ap.status =");
  });
});
