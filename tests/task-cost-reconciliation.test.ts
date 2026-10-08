import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../server/db", () => ({ db: { transaction: vi.fn() } }));
vi.mock("../server/domain/personnel-rate", () => ({ resolveCanonicalPersonnelRate: vi.fn() }));
vi.mock("../server/etl/time-entries-to-fact-labor", () => ({ getCutoverDate: vi.fn(), buildFactLaborInTransaction: vi.fn() }));
import { db } from "../server/db";
import { taskTimeEntries, timeEntries, systemConfig, financialClosePeriods } from "../shared/schema";
import { resolveCanonicalPersonnelRate } from "../server/domain/personnel-rate";
import { getCutoverDate, buildFactLaborInTransaction } from "../server/etl/time-entries-to-fact-labor";
import { reconcileTaskCosts } from "../server/domain/reconcile-task-costs";

describe("Task cost reconciliation", () => {
  let tx: any, mode: number, status: string, taskRows: any[], legacyRows: any[], mutations: any[];
  beforeEach(() => {
    mode = 1; status = "OPEN"; mutations = [];
    taskRows = [
      { projectId: 9, entry: { id: 1, personnelId: 3, date: new Date("2026-10-08T03:00:00Z"), hours: 2, hourlyRateAtTime: null, totalCost: null, exchangeRateId: null } },
      { projectId: 9, entry: { id: 2, personnelId: 3, date: new Date("2026-10-08T03:00:00Z"), hours: 1, hourlyRateAtTime: 500, totalCost: 500, exchangeRateId: 7, costSyncPending: true } },
    ];
    legacyRows = [];
    tx = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      select: vi.fn(() => ({ from: (table: any) => {
        const rows = () => table === systemConfig ? [{ value: mode }] : table === financialClosePeriods ? [{ status }] : table === taskTimeEntries ? taskRows : legacyRows;
        const chain: any = { innerJoin: () => chain, where: () => chain, for: async () => rows() };
        return chain;
      } })),
      update: vi.fn(table => ({ set: (values: any) => ({ where: async () => { mutations.push({ table, values }); } }) })),
    };
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));
    vi.mocked(getCutoverDate).mockResolvedValue("2026-09");
    vi.mocked(resolveCanonicalPersonnelRate).mockResolvedValue({ hourlyRateARS: 1000, hourlyRateUSD: null, exchangeRate: null, exchangeRateId: null, sourcePeriod: "2026-09", error: null });
    vi.mocked(buildFactLaborInTransaction).mockReset().mockResolvedValue({ periodKey: "2026-10", inserted: 1, updated: 0, deleted: 0, errors: [], executionTimeMs: 1 });
  });
  it("previews snapshots and monthly costs without writes by default", async () => {
    const result = await reconcileTaskCosts("2026-10");
    expect(result.applied).toBe(false);
    expect(result.entries[0].totalCostARS).toBe(2000);
    expect(result.entries[1]).toMatchObject({ totalCostARS: 500, preserveSnapshot: true, exchangeRateId: 7 });
    expect(tx.update).not.toHaveBeenCalled();
    expect(buildFactLaborInTransaction).toHaveBeenCalledWith("2026-10", tx, undefined, expect.objectContaining({ dryRun: true, costOverrides: expect.any(Map) }));
  });
  it("resolves missing snapshots and rebuilds in the same transaction", async () => {
    const result = await reconcileTaskCosts("2026-10", true);
    expect(result.applied).toBe(true);
    expect(mutations.filter(m => "totalCost" in m.values)).toEqual([{ table: taskTimeEntries, values: { hourlyRateAtTime: 1000, totalCost: 2000, exchangeRateId: null } }]);
    expect(buildFactLaborInTransaction).toHaveBeenCalledWith("2026-10", tx);
  });
  it.each(["excel", "closed", "cutover"])("never applies a blocked %s period", async reason => {
    if (reason === "excel") mode = 0;
    if (reason === "closed") status = "CLOSED";
    if (reason === "cutover") vi.mocked(getCutoverDate).mockResolvedValue("2026-11");
    expect((await reconcileTaskCosts("2026-10", true)).applied).toBe(false);
    expect(tx.update).not.toHaveBeenCalled();
    expect(buildFactLaborInTransaction).not.toHaveBeenCalled();
  });
  it("preserves unresolved hours, resolves legacy source and exposes missing FX", async () => {
    vi.mocked(resolveCanonicalPersonnelRate).mockResolvedValueOnce({ hourlyRateARS: null, hourlyRateUSD: 20, exchangeRate: null, exchangeRateId: null, sourcePeriod: "2026-10", error: "missing_fx" });
    legacyRows = [{ ...taskRows[0].entry, id: 3, projectId: 9 }];
    const result = await reconcileTaskCosts("2026-10", true);
    expect(result.entries[0]).toMatchObject({ totalCostARS: null, pending: "missing_fx" });
    expect(mutations.filter(m => "totalCost" in m.values)).toEqual([{ table: timeEntries, values: { hourlyRateAtTime: 1000, totalCost: 2000, exchangeRateId: null } }]);
  });
  it("propagates rebuild failure so the database transaction rolls back", async () => {
    vi.mocked(buildFactLaborInTransaction).mockRejectedValue(new Error("rebuild failed"));
    await expect(reconcileTaskCosts("2026-10", true)).rejects.toThrow("rebuild failed");
    expect(mutations.some(m => "costSyncPending" in m.values)).toBe(false);
  });
});
