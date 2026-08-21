import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allowedSublevelsForRole,
  normalizePersonnelArea,
  normalizePersonnelRole,
  normalizePersonnelSublevel,
} from "../shared/utils/personnel-classification";
import { isBlueprintCompatibleWithProjectType } from "../client/src/utils/quotation-ux";
import {
  applyHistoricalEffortBenchmark,
  type EffortBenchmark,
  type WorkloadLine,
} from "../shared/quotation-professional";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Feedback Mind V2-11 corrections", () => {
  it("normalizes the five role levels and their allowed sublevels", () => {
    expect(normalizePersonnelRole("Nivel 01 Junior")).toBe("1 Junior");
    expect(normalizePersonnelRole("SSr")).toBe("2 Semi Senior");
    expect(normalizePersonnelRole("Nivel 03 Senior")).toBe("3 Senior");
    expect(normalizePersonnelRole("04 Lead")).toBe("4 Lead");
    expect(normalizePersonnelRole("Head of Operations")).toBe("5 Lead de Leads");
    expect(allowedSublevelsForRole("4 Lead")).toEqual(["A", "B", "C"]);
    expect(allowedSublevelsForRole("3 Senior")).toEqual(["A", "B"]);
    expect(normalizePersonnelSublevel("Subnivel B")).toBe("B");
  });

  it("normalizes the four personnel areas", () => {
    expect(normalizePersonnelArea("Operación")).toBe("Operaciones");
    expect(normalizePersonnelArea("Data & Tech")).toBe("DataTech");
    expect(normalizePersonnelArea("Cuentas")).toBe("Cuenta");
  });

  it("filters service recipes by the modality selected in the brief", () => {
    expect(isBlueprintCompatibleWithProjectType("on-demand", "one_shot")).toBe(true);
    expect(isBlueprintCompatibleWithProjectType("on-demand", "monthly_fee")).toBe(false);
    expect(isBlueprintCompatibleWithProjectType("fee-mensual", "monthly_fee")).toBe(true);
    expect(isBlueprintCompatibleWithProjectType("fee-mensual", "one_shot")).toBe(false);
    expect(isBlueprintCompatibleWithProjectType("fee-mensual", "renewal")).toBe(false);
  });

  it("derives role averages from the latest canonical historical cost", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("WITH latest_rates AS");
    expect(routes).toContain("LEFT JOIN latest_rates latest ON latest.personnel_id = p.id");
    expect(routes).toContain("latest.hourly_rate_ars / NULLIF(latest.exchange_rate, 0)");
    expect(routes).toContain("classification_averages AS");
    expect(routes).toContain("GROUP BY 1, 2");
  });

  it("persists area and retires forecasts superseded by observed rates", () => {
    const schema = source("shared/schema.ts");
    const migration = source("migrations/0049_feedback_mind_v2_11.sql");
    const fxSync = source("server/services/fxSync.ts");
    expect(schema).toContain('area: text("area")');
    expect(migration).toContain("forecast.rate_type = 'estimated'");
    expect(fxSync).toContain('input.rateType !== "estimated"');
    expect(source("server/index.ts")).not.toContain('SET "current_role" = NULL\n      WHERE "contract_type" = \'freelance\'');
  });

  it("returns the source verification after synchronizing Blue", () => {
    expect(source("server/routes.ts")).toContain("verification: result.verification");
  });

  it("assigns a person directly to an unassigned quotation role", () => {
    const team = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    expect(team).toContain("const assignPersonnel");
    expect(team).toContain('placeholder="Asignar persona"');
    expect(team).toContain("personnelId,");
  });

  it("lets room owners archive a Status room with confirmation", () => {
    const card = source("client/src/components/review/RoomCard.tsx");
    const hub = source("client/src/pages/review/hub.tsx");
    expect(card).toContain("room.myRole === 'owner'");
    expect(card).toContain("onArchive(room)");
    expect(hub).toContain("reviewApi.archiveRoom(roomId)");
    expect(hub).toContain("¿Eliminar esta sala?");
  });

  it("retires inflation and the redundant complexity selectors from active pricing", () => {
    const app = source("client/src/App.tsx");
    const context = source("client/src/context/optimized-quote-context.tsx");
    const complexity = source("client/src/components/optimized/complexity-factors-card.tsx");
    expect(app).not.toContain('path="/admin/inflation"');
    expect(context).toContain("const inflationFactor = 1;");
    expect(context).toContain("applyInflationAdjustment: false");
    expect(complexity).not.toContain("Tipo de Análisis");
    expect(complexity).not.toContain("Compromiso del Cliente");
  });

  it("learns effort from completed comparable projects and keeps the correction bounded", () => {
    const line: WorkloadLine = { sourceId: "setup", sourceName: "Setup", roleKey: "analyst", baseHours: 100, quantity: 1, factor: 1, estimatedHours: 100 };
    const workload = { factor: 1, totalHours: 100, byRole: { analyst: 100 }, lines: [line] };
    const benchmark: EffortBenchmark = { serviceBlueprintId: 1, projectType: "on-demand", sampleSize: 3, averageActualHours: 140, medianActualHours: 130 };
    expect(applyHistoricalEffortBenchmark(workload, benchmark)).toMatchObject({ totalHours: 130, historicalFactor: 1.3 });
    expect(applyHistoricalEffortBenchmark(workload, { ...benchmark, sampleSize: 1 }).totalHours).toBe(100);
    expect(applyHistoricalEffortBenchmark(workload, { ...benchmark, medianActualHours: 1_000 }).totalHours).toBe(150);

    const routes = source("server/routes-proposal-studio.ts");
    expect(routes).toContain('/api/quotation-effort-benchmarks');
    expect(routes).toContain("percentile_cont(0.5)");
    expect(routes).toContain("FROM task_time_entries");
    expect(routes).toContain("FROM time_entries");
  });

  it("keeps project activity in the dedicated Tasks module", () => {
    const detail = source("client/src/pages/project-detail.tsx");
    expect(detail).not.toContain('import ProjectTaskList');
    expect(detail).not.toContain('value="tareas"');
    expect(detail).toContain('/tasks/projects/${pid}');
  });
});
