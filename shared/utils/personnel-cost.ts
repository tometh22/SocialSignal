export type PersonnelCostInputs = {
  monthlyHours?: number | string | null;
  hourlyRateARS?: number | string | null;
  hourlyRateUSD?: number | string | null;
};

export type DerivedMonthlySalaries = {
  monthlyHoursSnapshot?: number;
  monthlySalaryARS?: number;
  monthlySalaryUSD?: number;
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
 * Hourly rates are the canonical cost inputs. Monthly compensation is a
 * projection derived from the contractual hours snapshot for that period.
 */
export function deriveMonthlySalariesFromHourlyRates(inputs: PersonnelCostInputs): DerivedMonthlySalaries {
  const monthlyHours = finiteNumber(inputs.monthlyHours);
  if (monthlyHours == null || monthlyHours <= 0) return {};

  const result: DerivedMonthlySalaries = { monthlyHoursSnapshot: monthlyHours };
  const hourlyRateARS = finiteNumber(inputs.hourlyRateARS);
  const hourlyRateUSD = finiteNumber(inputs.hourlyRateUSD);

  if (hourlyRateARS != null && hourlyRateARS >= 0) {
    result.monthlySalaryARS = roundCurrency(hourlyRateARS * monthlyHours);
  }
  if (hourlyRateUSD != null && hourlyRateUSD >= 0) {
    result.monthlySalaryUSD = roundCurrency(hourlyRateUSD * monthlyHours);
  }
  return result;
}
