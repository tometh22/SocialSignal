import { describe, expect, it } from "vitest";
import { lastPayrollBusinessDay } from "../shared/utils/payroll-calendar";

describe("payroll cutoff calendar", () => {
  it("uses the last weekday and skips configured holidays", () => {
    expect(lastPayrollBusinessDay("2026-10", [])).toBe("2026-10-30");
    expect(lastPayrollBusinessDay("2026-10", ["2026-10-30"])).toBe("2026-10-29");
    expect(lastPayrollBusinessDay("2026-09", [])).toBe("2026-09-30");
  });
  it("handles February and invalid months", () => {
    expect(lastPayrollBusinessDay("2028-02", [])).toBe("2028-02-29");
    expect(() => lastPayrollBusinessDay("2026-13", [])).toThrow("Período inválido");
  });
});
