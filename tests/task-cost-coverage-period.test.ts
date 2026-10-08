import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { resolvePeriod } from "../shared/utils/timePeriod";
import { normalizeProjectTimeFilter } from "../server/domain/project-request-period";

vi.mock("../server/db", () => ({ db: { select: vi.fn() } }));
vi.mock("../server/utils/dataSourceMode", () => ({ getHoursDataSource: vi.fn().mockResolvedValue("app") }));
import { db } from "../server/db";
import { exchangeRates, systemConfig, taskTimeEntries, timeEntries } from "../shared/schema";
import { taskCostCoverage } from "../server/domain/task-cost-coverage";

const dialect = new PgDialect();
const entry = (date: string, hours: number, pending: boolean) => ({
  projectId: 9, personnelId: 3, description: date, date: new Date(date), hours,
  rate: pending ? null : 1000, cost: pending ? null : hours * 1000,
  exchangeRateId: 7, pendingSync: false,
});
const native = [
  entry("2026-08-31T00:00:00Z", 2, false),
  entry("2026-09-05T00:00:00Z", 2, true),
  entry("2026-09-30T23:59:59Z", 1, true),
  entry("2026-10-01T00:00:00Z", 4, false),
  entry("2026-10-08T00:00:00Z", 3, true),
];
const legacy = [native[1], entry("2026-09-15T00:00:00Z", 5, false)];

beforeEach(() => {
  vi.mocked(db.select).mockImplementation((fields: any) => ({
    from: (table: any) => {
      let predicate: any;
      const rows = () => {
        if (table === exchangeRates) return [{ id: 7, year: 2026, month: 9, rate: 1000, isActive: true }];
        if (table === systemConfig) return fields.key ? [
          { key: "task_cost_sync:2026-09:9" },
          { key: "task_cost_sync:2026-10:10" },
          { key: "task_cost_sync:2026-07:11" },
        ] : [{ value: 1000 }];
        const query = dialect.sqlToQuery(predicate);
        const dates = query.params.filter((p: any) => typeof p === "string" && /^\d{4}-\d{2}-\d{2}T/.test(p)) as string[];
        const source = table === taskTimeEntries ? native : table === timeEntries ? legacy : [];
        return source.filter(row => !dates.length || (row.date >= new Date(dates[0]) && row.date < new Date(dates[1])));
      };
      const chain: any = {
        innerJoin: () => chain,
        where: (condition: any) => { predicate = condition; return chain; },
        limit: () => chain,
        then: (resolve: any, reject: any) => Promise.resolve().then(rows).then(resolve, reject),
      };
      return chain;
    },
  }) as any);
});

describe("project cost coverage follows the financial period", () => {
  it.each(["2026-09", "septiembre_2026", "september_2026"])("does not mix current-month pending hours into %s", async filter => {
    const responsePeriod = resolvePeriod(filter); // The period returned by ActiveProjectsAggregator.
    const coverage = await taskCostCoverage(responsePeriod);
    expect(coverage.get(9)).toMatchObject({ pendingHours: 3, pendingRate: 3, calculatedHours: 5, syncPending: true });
    expect(coverage.has(10)).toBe(false); // October's stale-fact marker belongs to a different period.
    expect(coverage.has(11)).toBe(false);
  });
  it("covers all three months of a legacy quarter, preserving mirror deduplication", async () => {
    const coverage = await taskCostCoverage(resolvePeriod("q3_2026"));
    expect(coverage.get(9)).toMatchObject({ pendingHours: 3, calculatedHours: 7 });
    expect(coverage.get(11)?.syncPending).toBe(true);
    expect(coverage.has(10)).toBe(false);
  });
  it("uses exact inclusive civil days for a custom range instead of whole months", async () => {
    const coverage = await taskCostCoverage({ start: "2026-09-30", end: "2026-10-01" });
    expect(coverage.get(9)).toMatchObject({ pendingHours: 1, calculatedHours: 4 });
    expect(coverage.get(10)?.syncPending).toBe(true);
    expect(coverage.has(11)).toBe(false);
  });
  it("includes the final day's late hours and excludes midnight of the following day", async () => {
    const coverage = await taskCostCoverage({ start: "2026-09-30", end: "2026-09-30" });
    expect(coverage.get(9)).toMatchObject({ pendingHours: 1, calculatedHours: 0 });
    expect(coverage.has(10)).toBe(false);
  });
  it("keeps the modern monthly period consistent", async () => {
    const coverage = await taskCostCoverage(resolvePeriod("2026-10"));
    expect(coverage.get(9)).toMatchObject({ pendingHours: 3, calculatedHours: 4 });
    expect(coverage.get(10)?.syncPending).toBe(true);
    expect(coverage.get(9)?.syncPending).toBeUndefined();
  });
  it.each([
    { start: "2026-09-31", end: "2026-10-01" },
    { start: "2026-10-02", end: "2026-10-01" },
  ])("rejects invalid ranges without querying unbounded history", async range => {
    vi.mocked(db.select).mockClear();
    await expect(taskCostCoverage(range)).rejects.toThrow("Rango de costos inválido");
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe("relative project filters share Buenos Aires boundaries", () => {
  it("uses September just before BA enters October, even when UTC is already October", () => {
    const now = new Date("2026-10-01T02:59:59Z");
    expect(normalizeProjectTimeFilter("this_month", now)).toBe("2026-09");
    expect(normalizeProjectTimeFilter("last_month", now)).toBe("2026-08");
    expect(normalizeProjectTimeFilter("this_month", new Date("2026-10-01T03:00:00Z"))).toBe("2026-10");
  });
  it("goes to the previous month without the 31st-day rollover, including January", () => {
    expect(normalizeProjectTimeFilter("last_month", new Date("2026-03-31T15:00:00Z"))).toBe("2026-02");
    expect(normalizeProjectTimeFilter("last_month", new Date("2026-01-31T15:00:00Z"))).toBe("2025-12");
  });
  it("preserves explicit legacy filters", () => {
    expect(normalizeProjectTimeFilter("q3_2026")).toBe("q3_2026");
    expect(normalizeProjectTimeFilter("septiembre_2026")).toBe("septiembre_2026");
  });
});
