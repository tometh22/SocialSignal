import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveMonthlySalariesFromHourlyRates } from "../shared/utils/personnel-cost";
import { calculateQuotationPricing, parseLocalizedDecimal } from "../shared/utils/quotation-pricing";
import { businessDaysByYear, enumerateBusinessDays, transitionAbsence } from "../shared/utils/absence";
import { currentBuenosAiresWeek, isCompletedInCurrentBuenosAiresWeek } from "../shared/utils/buenos-aires-week";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Feedback Mind V2-9 shared domains", () => {
  it("derives ARS and USD salaries independently and never invents freelance hours", () => {
    expect(deriveMonthlySalariesFromHourlyRates({ monthlyHours: 160, hourlyRateARS: 10_000, hourlyRateUSD: 20 }))
      .toEqual({ monthlyHoursSnapshot: 160, monthlySalaryARS: 1_600_000, monthlySalaryUSD: 3_200 });
    expect(deriveMonthlySalariesFromHourlyRates({ monthlyHours: null, hourlyRateARS: 10_000 })).toEqual({});
    expect(deriveMonthlySalariesFromHourlyRates({ monthlyHours: 0, hourlyRateUSD: 20 })).toEqual({});
  });

  it("runs the canonical quotation order and converts foreign costs once", () => {
    const result = calculateQuotationPricing({
      quotationCurrency: "USD",
      exchangeRate: 1_000,
      team: [
        { cost: 100, currency: "ARS" },
        { hours: 2, rate: 5, currency: "USD" },
      ],
      complexityFactor: 0.1,
      marginFactor: 2,
      toolsCostUSD: 5,
      platformCostARS: 100,
      deviationPercentage: 10,
      discountPercentage: 5,
      inflationFactor: 1.1,
    });
    expect(result.canonicalARS).toEqual({
      baseCost: 10_100,
      complexityAdjustment: 1_010,
      markupAmount: 11_110,
      toolsCost: 5_000,
      additionalDeliverableCost: 0,
      platformCost: 100,
      deviationAmount: 2_732,
      discountAmount: 1_502.6,
      total: 31_404.34,
    });
    expect(result.display.total).toBe(31.4);
  });

  it("keeps manual price currency explicit and parses local decimals", () => {
    const result = calculateQuotationPricing({
      quotationCurrency: "ARS",
      exchangeRate: 1_250,
      team: [{ cost: 50_000, currency: "ARS" }],
      toolsCostUSD: 10,
      priceMode: "manual",
      manualPrice: 100,
      manualPriceCurrency: "USD",
    });
    expect(result.canonicalARS.total).toBe(125_000);
    expect(parseLocalizedDecimal("1.250,50")).toBe(1250.5);
    expect(parseLocalizedDecimal("1250.50")).toBe(1250.5);
    expect(() => calculateQuotationPricing({ quotationCurrency: "ARS", exchangeRate: 0, team: [] })).toThrow();
  });

  it("counts business days across years and excludes configured holidays", () => {
    const holidays = new Set(["2027-01-01"]);
    expect(enumerateBusinessDays("2026-12-31", "2027-01-05", holidays))
      .toEqual(["2026-12-31", "2027-01-04", "2027-01-05"]);
    expect(businessDaysByYear("2026-12-31", "2027-01-05", holidays)).toEqual({ 2026: 1, 2027: 2 });
  });

  it("enforces absence transitions", () => {
    expect(transitionAbsence("pending", "approve")).toBe("approved");
    expect(transitionAbsence("approved", "request_cancellation")).toBe("cancellation_requested");
    expect(transitionAbsence("cancellation_requested", "reject_cancellation")).toBe("approved");
    expect(() => transitionAbsence("approved", "cancel_pending")).toThrow("Transición inválida");
  });

  it("uses Monday-Sunday boundaries in Buenos Aires", () => {
    const now = new Date("2026-08-12T15:00:00Z");
    expect(currentBuenosAiresWeek(now)).toEqual({ from: "2026-08-10", to: "2026-08-16" });
    expect(isCompletedInCurrentBuenosAiresWeek("2026-08-10T02:59:59Z", now)).toBe(false);
    expect(isCompletedInCurrentBuenosAiresWeek("2026-08-10T03:00:00Z", now)).toBe(true);
    expect(isCompletedInCurrentBuenosAiresWeek("2026-08-17T02:59:59Z", now)).toBe(true);
    expect(isCompletedInCurrentBuenosAiresWeek("2026-08-17T03:00:00Z", now)).toBe(false);
  });
});

describe("Feedback Mind V2-9 integration contracts", () => {
  it("keeps migrations idempotent for new absences and skipped historical costs", () => {
    const migration = source("migrations/0040_feedback_mind_v2_9_closure.sql");
    expect(migration).toContain("ON CONFLICT (historical_cost_id, migration_key) DO NOTHING");
    expect(migration).toContain("cost.monthly_hours_snapshot IS NULL\n  AND person.monthly_hours > 0");
    expect(migration).toContain("absence.requested_by IS NULL");
    expect(migration).toContain("ON CONFLICT (event_key) DO NOTHING");
  });

  it("routes every Master sync through canonical salary derivation and persistent warnings", () => {
    const routes = source("server/routes.ts");
    const dailyJob = source("server/jobs/daily-sot-sync.ts");
    const sync = source("server/services/personnel-cost-sync.ts");
    const warningMigration = source("migrations/0041_personnel_cost_sync_warnings.sql");
    expect(routes.match(/applyCanonicalPersonnelRateRows/g)?.length).toBeGreaterThanOrEqual(3);
    expect(dailyJob).toContain("applyCanonicalPersonnelRateRows");
    expect(sync).toContain("deriveMonthlySalariesFromHourlyRates");
    expect(sync).toContain("monthly_salary_mismatch");
    expect(sync).toContain("onConflictDoNothing");
    expect(warningMigration).toContain("warning_key TEXT NOT NULL UNIQUE");
  });

  it("creates and edits canonical personnel rates without rewriting older snapshots", () => {
    const routes = source("server/routes.ts");
    const admin = source("client/src/pages/admin-fixed.tsx");
    const inline = source("client/src/components/admin/inline-edit-personnel.tsx");
    const history = source("client/src/components/admin/HistoricalCostsTable.tsx");
    const create = routes.slice(routes.indexOf('app.post("/api/personnel"'), routes.indexOf('app.patch("/api/personnel/:id"'));
    const update = routes.slice(routes.indexOf('app.patch("/api/personnel/:id"'), routes.indexOf('// ==================== SYNC TARIFAS'));
    expect(create).toContain("db.transaction");
    expect(create).toContain("canonicalHourlyRateARS");
    expect(create).toContain("canonicalHourlyRateUSD");
    expect(create).toContain('adjustmentReason: "Alta de Personal"');
    expect(update).toContain("eq(personnelHistoricalCosts.month, currentMonth)");
    expect(update).toContain('adjustmentReason: "Cambio de horas contractuales"');
    expect(admin).toContain('name="hourlyRateARS"');
    expect(admin).toContain('name="hourlyRateUSD"');
    expect(admin).toContain('name="monthlyHours"');
    expect(inline).toContain('payload.hourlyRateARS = hourlyRateARS');
    expect(inline).toContain('payload.hourlyRateUSD = hourlyRateUSD');
    expect(history).toContain('field: "monthlyHoursSnapshot"');
    expect(history).toContain('billingCurrency === "MIXED"');
    expect(history).toContain("...(!existing ? { monthlyHours: currentMonthlyHours } : {})");
  });

  it("persists approved quotation, team and variants in one transaction", () => {
    const routes = source("server/routes.ts");
    const create = routes.slice(routes.indexOf('app.post("/api/quotations"'), routes.indexOf('// Ruta PUT para actualizar cotización completa'));
    expect(create).toContain("db.transaction");
    expect(create).toContain("tx.insert(quotationTeamMembers)");
    expect(create).toContain("tx.insert(quotationVariants)");
    expect(create).toContain('validatedData.status === "approved"');
    expect(routes).toContain('app.patch("/api/quotations/:id/status"');
    expect(routes).toContain("assertQuotationTransition(currentQuotation.status, status)");
    expect(routes).toContain('status === "approved"');
  });

  it("makes completion endpoint the only generic path to done", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('app.post("/api/tasks/:id(\\\\d+)/completion"');
    expect(routes).toContain('status: z.enum(["todo", "in_progress", "blocked"])');
    expect(routes).toContain('completedAt: parsed.data.completed ? now : null');
    expect(routes).toContain('existingTask.status === "done" && parsedUpdate.data.status !== undefined');
    expect(routes).toContain("Las tareas finalizadas sólo pueden reabrirse desde el checklist");
  });

  it("versions absence events and notifications per real transition", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('eventKey: `${input.action}:${absenceId}:${new Date(current.updatedAt).toISOString()}`');
    expect(routes).toContain('eventKey: `absence-cancellation-requested:${absenceId}:${new Date(updated.updatedAt).toISOString()}`');
  });

  it("keeps financial portfolio separate from the Asana-style operational surface", () => {
    const app = source("client/src/App.tsx");
    const home = source("client/src/pages/home-dashboard.tsx");
    expect(app).toContain('return isOperations ? <ActiveProjectsNext /> : <Redirect to="/tasks/projects" />');
    expect(app).toContain('path="/tasks/projects" component={ProjectsHubPage}');
    expect(app).toContain('return <Redirect to={`/tasks/projects/${params.id}`} />');
    expect(app).not.toContain('isOperations ? <Redirect to="/active-projects" /> : <ProjectsHubPage />');
    expect(home).toContain('href={`/tasks/projects/${alert.projectId}`}');
    expect(home).not.toContain('href={`/active-projects/${alert.projectId}`}');
  });

  it("keeps one management overview and the real project team", () => {
    const page = source("client/src/pages/tasks/project-tasks-page.tsx");
    const overview = source("client/src/components/tasks/ProjectOverviewPanel.tsx");
    expect(page.match(/<ProjectOverviewPanel/g)).toHaveLength(1);
    expect(page).not.toContain("Personas involucradas");
    expect(overview).not.toContain("Por sección");
    expect(overview).toContain("Equipo del proyecto");
    expect(overview).toContain("members.map");
  });

  it("includes labor-only projects and exposes their real portfolio hours", () => {
    const aggregator = source("server/domain/view-aggregator.ts");
    const routes = source("server/routes.ts");
    const portfolio = source("client/src/pages/active-projects-next.tsx");
    expect(aggregator).toContain("laborProjectsInPeriod");
    expect(aggregator).toContain("...laborProjectsInPeriod.map((project) => project.projectId)");
    expect(aggregator).toContain("project.quotationProjectName || project.activeProjectName || project.subprojectName");
    expect(aggregator).toContain("totalHours: viewData.totalWorkedHours");
    expect(routes).toContain("project.metrics.workedHours = finData.metrics.totalHours");
    expect(portfolio).toContain("p.metrics?.totalHours ?? p.metrics?.workedHours");
  });

  it("discovers role metadata outside the hourly-rate tab", () => {
    const sync = source("server/services/personnelSheetsSync.ts");
    expect(sync).toContain("parsePersonnelMetadataGrid");
    expect(sync).toContain('fields: "sheets.properties.title"');
    expect(sync).toContain("mergePersonnelMetadata(rateRows, metadataRows)");
  });

  it("formats USD with cents and keeps quotation variants visibly comparable", () => {
    const team = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    const review = source("client/src/components/optimized/financial-review-final.tsx");
    const variants = source("client/src/components/optimized/QuotationVariants.tsx");
    expect(team).toContain("minimumFractionDigits: currency === 'USD' ? 2 : 0");
    expect(review).toContain("minimumFractionDigits: currencyLabel === 'USD' ? 2 : 0");
    expect(variants).toContain("getDifferenceVsBase");
    expect(variants).toContain("Diferencia vs cotización base");
    expect(variants).toContain('variant="outline" size="sm" className="flex items-center gap-2"');
  });

  it("keeps the hours chart responsive and priority editable inline", () => {
    const tasksHome = source("client/src/pages/tasks/tasks-home.tsx");
    const taskList = source("client/src/components/tasks/ProjectTaskList.tsx");
    expect(tasksHome).toContain("margin={{ top: 8, right: 12, left: 8, bottom: 8 }}");
    expect(tasksHome).toContain("tickFormatter={(value)");
    expect(tasksHome).not.toMatch(/margin=\{\{[^}]*left:\s*-/);
    expect(taskList).toContain('(["low", "medium", "high", "urgent"] as const)');
    expect(taskList).toContain("onError: (_error, _priority, context)");
  });

  it("qualifies the correlated custom-item id in review queries", () => {
    const reviewRoutes = source("server/routes-review-rooms.ts");
    expect(reviewRoutes).toContain("const outerCustomItemId = sql.raw");
    expect(reviewRoutes).not.toContain("weeklyStatusItemId} = ${weeklyStatusItems.id}");
  });

  it("defines currency and exchange rate in the first quotation step only", () => {
    const basicInfo = source("client/src/components/optimized/basic-info.tsx");
    const wizard = source("client/src/pages/optimized-quote.tsx");
    expect(basicInfo).toContain("Moneda de cotización");
    expect(basicInfo).toContain("Tipo de cambio USD/ARS");
    expect(basicInfo).toContain('placeholder="Ej. 1.250,50"');
    expect(wizard).not.toContain("CurrencySelection");
  });
});
