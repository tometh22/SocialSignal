import { describe, expect, it } from "vitest";
import { payableMonthlyHours } from "../shared/utils/payroll-hours";

describe("monthly payroll hours", () => {
  it("pays Victoria's contractual 120 hours even with only 92.5 logged", () => {
    expect(payableMonthlyHours({ contractType: "part-time", monthlyHours: 120 }, 92.5)).toBe(120);
  });
  it("does not change fixed payment for short or long working months", () => {
    for (const logged of [0, 114, 160, 184]) expect(payableMonthlyHours({ contractType: "full-time", monthlyHours: 160 }, logged)).toBe(160);
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
