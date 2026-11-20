import { contractualMonthlyHours } from "./payroll-hours";

export type PersonnelSettlementInputs = {
  billingCurrencySnapshot?: string;
  totalARS: number;
  directUSD?: { base: number; referenceFx: number | null };
  usdPercentage: number;
  bonusARS?: number | null;
  bonusUSD?: number | null;
  extrasARS?: number | null;
  invoiceFx?: number | null;
  receivedFx?: number | null;
  bankCommissionUSD?: number | null;
};

export type PersonnelSettlementCalculation = {
  plannedUSDARS: number;
  baseInvoiceUSD: number | null;
  totalInvoiceUSD: number | null;
  pesifiedBaseARS: number | null;
  finalInvoiceARS: number | null;
  financialCostARS: number | null;
  financialCostUSD: number | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Reemplaza las fórmulas del Excel de cierre.
 *
 * El bono USD es un adicional: no reduce el saldo salarial en ARS. La comisión
 * bancaria se reintegra en el tramo ARS, por eso aumenta la diferencia final.
 */
export function calculatePersonnelSettlement(input: PersonnelSettlementInputs): PersonnelSettlementCalculation {
  const totalARS = Math.max(0, Number(input.totalARS) || 0);
  const usdPercentage = Math.min(100, Math.max(0, Number(input.usdPercentage) || 0));
  const bonusUSD = Math.max(0, Number(input.bonusUSD) || 0);
  const bonusARS = Math.max(0, Number(input.bonusARS) || 0);
  const extrasARS = Math.max(0, Number(input.extrasARS) || 0);
  const bankCommissionUSD = Math.max(0, Number(input.bankCommissionUSD) || 0);
  const invoiceFx = Number(input.invoiceFx) > 0 ? Number(input.invoiceFx) : null;
  const receivedFx = Number(input.receivedFx) > 0 ? Number(input.receivedFx) : null;

  if (input.billingCurrencySnapshot?.toUpperCase() === "USD" && input.directUSD) {
    const { base, referenceFx } = input.directUSD;
    const arsExtras = bonusARS + extrasARS;
    const total = arsExtras > 0 && !referenceFx ? null : money(base + bonusUSD + (referenceFx ? arsExtras / referenceFx : 0));
    return {
      plannedUSDARS: 0, baseInvoiceUSD: base, totalInvoiceUSD: total, pesifiedBaseARS: null, finalInvoiceARS: 0,
      financialCostARS: total != null && referenceFx ? money(total * referenceFx) : null,
      financialCostUSD: total,
    };
  }

  const plannedUSDARS = money(totalARS * usdPercentage / 100);
  const hasUSD = plannedUSDARS > 0 || bonusUSD > 0;
  const baseInvoiceUSD = !hasUSD ? 0 : invoiceFx ? money(plannedUSDARS / invoiceFx) : null;
  const totalInvoiceUSD = baseInvoiceUSD == null ? null : money(baseInvoiceUSD + bonusUSD);
  // USD-only has one authorization/document and no later ARS exchange difference.
  // ARS additions are converted at the same employee-entered FX; the base stays separate.
  if (input.billingCurrencySnapshot?.toUpperCase() === "USD") {
    const usdTotal = baseInvoiceUSD == null || !invoiceFx ? null : money(baseInvoiceUSD + bonusUSD + (bonusARS + extrasARS) / invoiceFx);
    return { plannedUSDARS, baseInvoiceUSD, totalInvoiceUSD: usdTotal, pesifiedBaseARS: null, finalInvoiceARS: 0,
      financialCostARS: usdTotal == null || !invoiceFx ? null : money(usdTotal * invoiceFx), financialCostUSD: usdTotal };
  }
  const pesifiedBaseARS = !hasUSD ? 0 : baseInvoiceUSD != null && receivedFx
    ? money(baseInvoiceUSD * receivedFx)
    : null;
  const finalInvoiceARS = pesifiedBaseARS == null || (hasUSD && !receivedFx)
    ? null
    : money(totalARS - pesifiedBaseARS + bonusARS + extrasARS + bankCommissionUSD * (receivedFx ?? 0));
  const financialCostARS = finalInvoiceARS == null || totalInvoiceUSD == null || (hasUSD && !receivedFx)
    ? null
    : money(totalInvoiceUSD * (receivedFx ?? 0) + finalInvoiceARS);
  const financialCostUSD = financialCostARS == null || !receivedFx
    ? null
    : money(financialCostARS / receivedFx);

  return {
    plannedUSDARS,
    baseInvoiceUSD,
    totalInvoiceUSD,
    pesifiedBaseARS,
    finalInvoiceARS,
    financialCostARS,
    financialCostUSD,
  };
}


/** Prepare a USD base from the native historical rate, with optional ARS valuation for reporting. */
export function nativeUsdClosing(
  person: Parameters<typeof contractualMonthlyHours>[0],
  hours: number,
  rate: { hourlyRateUSD: number | null; monthlySalaryUSD?: number | null },
  exchangeRate: number | null,
) {
  const monthlySalary = Number(rate.monthlySalaryUSD);
  const contractualHours = contractualMonthlyHours(person);
  const hasFixedSalary = person.contractType !== "freelance" && monthlySalary > 0 && Number.isFinite(monthlySalary);
  const hourlyRateUSD = hasFixedSalary ? monthlySalary / contractualHours : rate.hourlyRateUSD;
  if (hourlyRateUSD == null || !Number.isFinite(hourlyRateUSD) || hourlyRateUSD <= 0) return null;
  const fx = exchangeRate && exchangeRate > 0 ? exchangeRate : null;
  const totalUSD = money(hasFixedSalary ? monthlySalary * (hours / contractualHours) : hours * hourlyRateUSD);
  const totalARS = fx ? money(totalUSD * fx) : null;
  return {
    hourlyRate: hourlyRateUSD, billingCurrency: "USD", usdBillingFraction: 1,
    exchangeRateAtClose: fx, totalCostUSD: totalUSD, grandTotalUSD: totalUSD,
    totalCostARS: 0, grandTotalARS: totalARS, totalCost: totalARS ?? 0,
  };
}

/** Read the amount already frozen by Cierre del equipo. */
export function closedUsdBase(closing: { billingCurrency?: string | null; totalCostUSD?: number | null; grandTotalUSD?: number | null; exchangeRateAtClose?: number | null } | null) {
  if (closing?.billingCurrency?.toUpperCase() !== "USD") return undefined;
  const base = closing.totalCostUSD ?? closing.grandTotalUSD;
  if (base == null || !Number.isFinite(base) || base < 0) return undefined;
  const fx = closing.exchangeRateAtClose;
  return { base: money(base), referenceFx: fx && fx > 0 ? fx : null };
}
