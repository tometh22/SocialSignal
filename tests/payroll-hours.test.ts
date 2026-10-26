import { describe, expect, it } from "vitest";
import { payableMonthlyHours } from "../shared/utils/payroll-hours";

describe("monthly payroll hours", () => {
  it("pays contractual part-time hours even with paid absences and fewer logged hours", () => {
    expect(payableMonthlyHours({ contractType: "part-time", monthlyHours: 120 }, 92.5)).toBe(120);
  });
  it("does not change fixed payment for short or long working months", () => {
    for (const logged of [0, 114, 160, 184]) expect(payableMonthlyHours({ contractType: "full-time", monthlyHours: 160 }, logged)).toBe(160);
  });
  it.each([
    ["full-time",160], ["part-time",120], ["full-time",144], ["part-time",80],
  ])("preserves %s contractual hours (%i) for every employee, including a fully paid month off", (contractType, monthlyHours) => {
    expect(payableMonthlyHours({contractType,monthlyHours},0)).toBe(monthlyHours);
    expect(payableMonthlyHours({contractType,monthlyHours},Number(monthlyHours)+24)).toBe(monthlyHours);
  });
  it("only deducts explicit unpaid leave with a reason", () => {
    const person = { contractType: "part-time", monthlyHours: 120 };
    expect(() => payableMonthlyHours(person, 92.5, 6)).toThrow("motivo");
    expect(payableMonthlyHours(person, 92.5, 6, "Licencia sin goce acordada")).toBe(114);
    expect(() => payableMonthlyHours(person, 92.5, 121, "Licencia")).toThrow("supera");
  });
  it("pays freelancers for actual hours without a fixed floor", () => {
    expect(payableMonthlyHours({ contractType: "freelance", monthlyHours: 160 }, 18.5)).toBe(18.5);
    expect(() => payableMonthlyHours({ contractType: "freelance" }, 18.5, 1, "Licencia")).toThrow("Freelance");
  });
});
