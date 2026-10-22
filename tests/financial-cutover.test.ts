import { describe, it, expect } from "vitest";
import { excelImportBlocker } from "../server/services/financial-source-policy";
import { financialCostPlanInput } from "../shared/financial-cost-plan";

describe("financial source boundary",()=>{
  it("blocks unbounded imports and periods at or after cutover",()=>{
    expect(excelImportBlocker("2026-08")).toContain("Mind");
    expect(excelImportBlocker("2026-08","2026-08")).toContain("Mind");
    expect(excelImportBlocker("2026-08","2027-01")).toContain("Mind");
    expect(excelImportBlocker("2026-08","2026-07")).toBeNull();
  });
  it("closed historical months are protected even without cutover",()=>{
    expect(excelImportBlocker(null,"2025-01","CLOSED")).toContain("cerrado");
    expect(excelImportBlocker("2026-08","2026-07","IN_REVIEW")).toContain("revisión");
    expect(excelImportBlocker(null,"2026-13")).toContain("YYYY-MM");
    expect(excelImportBlocker(null)).toBeNull();
  });
});
describe("native budget validation",()=>{
  const valid={concept:"Equipo",category:"Operaciones",costType:"direct",currency:"ARS",monthlyAmount:100000,startPeriod:"2026-10",endPeriod:"2026-12"};
  it("accepts explicit monthly budgets",()=>expect(financialCostPlanInput.parse(valid).active).toBe(true));
  it.each([{monthlyAmount:0},{monthlyAmount:-1},{monthlyAmount:Infinity},{currency:"EUR"},{endPeriod:"2026-09"},{endPeriod:"2031-10"},{startPeriod:"2026-00"}])("rejects invalid amounts, currencies and windows: %j",change=>{
    expect(financialCostPlanInput.safeParse({...valid,...change}).success).toBe(false);
  });
});
