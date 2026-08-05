export type PersonnelCostInputs = {
  monthlyHours?: number | string | null;
  monthlySalaryARS?: number | string | null;
  monthlySalaryUSD?: number | string | null;
};

export type DerivedHourlyRates = {
  hourlyRateARS?: number;
  hourlyRateUSD?: number;
};

function finiteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Salary and contractual monthly hours are inputs. Hourly rates are derived
 * values and are recalculated whenever either input changes. A freelancer
 * without contractual hours intentionally does not get a derived rate.
 */
export function deriveHourlyRatesFromSalary(inputs: PersonnelCostInputs): DerivedHourlyRates {
  const monthlyHours = finiteNumber(inputs.monthlyHours);
  if (monthlyHours == null || monthlyHours <= 0) return {};

  const rates: DerivedHourlyRates = {};
  const monthlySalaryARS = finiteNumber(inputs.monthlySalaryARS);
  const monthlySalaryUSD = finiteNumber(inputs.monthlySalaryUSD);

  if (monthlySalaryARS != null && monthlySalaryARS >= 0) {
    rates.hourlyRateARS = roundCurrency(monthlySalaryARS / monthlyHours);
  }
  if (monthlySalaryUSD != null && monthlySalaryUSD >= 0) {
    rates.hourlyRateUSD = roundCurrency(monthlySalaryUSD / monthlyHours);
  }

  return rates;
}
