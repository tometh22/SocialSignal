export type PersonnelBillingCurrency = "ARS" | "USD" | "mixed";

export type HistoricalPersonnelRate = {
  year: number;
  month: number;
  hourlyRateARS?: number | string | null;
  hourlyRateUSD?: number | string | null;
  exchangeRate?: number | string | null;
};

type ResolvePersonnelRateInput = {
  billingCurrency?: string | null;
  usdBillingFraction?: number | string | null;
  quotationCurrency: string;
  quotationExchangeRate: number;
  historicalRates?: HistoricalPersonnelRate[] | null;
  referenceYear: number;
  referenceMonth: number;
  rateMode?: "current" | "annual_avg";
  averageYear?: number;
};

const positiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeBillingCurrency = (value: string | null | undefined): PersonnelBillingCurrency => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "usd") return "USD";
  if (normalized === "mixed") return "mixed";
  return "ARS";
};

const clampFraction = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, parsed));
};

const resolveRowRate = (
  row: HistoricalPersonnelRate,
  billingCurrency: PersonnelBillingCurrency,
  usdBillingFraction: number,
  quotationCurrency: "ARS" | "USD",
  quotationExchangeRate: number,
): number | null => {
  const historicalExchangeRate = positiveNumber(row.exchangeRate);
  const storedARS = positiveNumber(row.hourlyRateARS);
  const storedUSD = positiveNumber(row.hourlyRateUSD);
  const nativeARS = storedARS ?? (storedUSD && historicalExchangeRate
    ? storedUSD * historicalExchangeRate
    : null);
  const nativeUSD = storedUSD ?? (storedARS && historicalExchangeRate
    ? storedARS / historicalExchangeRate
    : null);

  const usdFraction = billingCurrency === "USD"
    ? 1
    : billingCurrency === "mixed"
      ? usdBillingFraction
      : 0;
  const arsFraction = 1 - usdFraction;

  if ((arsFraction > 0 && nativeARS == null) || (usdFraction > 0 && nativeUSD == null)) {
    return null;
  }

  if (quotationCurrency === "USD") {
    return ((nativeARS ?? 0) / quotationExchangeRate) * arsFraction
      + (nativeUSD ?? 0) * usdFraction;
  }
  return (nativeARS ?? 0) * arsFraction
    + (nativeUSD ?? 0) * quotationExchangeRate * usdFraction;
};

/**
 * Resolves an hourly cost in the quotation currency. Historical FX is used
 * only to reconstruct a missing native rate; every cross-currency component
 * uses the exchange-rate snapshot confirmed for this quotation.
 */
export function resolveQuotationPersonnelRate(input: ResolvePersonnelRateInput): number {
  const quotationExchangeRate = positiveNumber(input.quotationExchangeRate);
  if (!quotationExchangeRate) return 0;

  const quotationCurrency = input.quotationCurrency === "USD" ? "USD" : "ARS";
  const billingCurrency = normalizeBillingCurrency(input.billingCurrency);
  const usdBillingFraction = clampFraction(input.usdBillingFraction);
  const sortedRates = [...(input.historicalRates ?? [])]
    .filter((rate) => Number.isInteger(rate.year) && Number.isInteger(rate.month))
    .sort((left, right) => (right.year * 100 + right.month) - (left.year * 100 + left.month));
  const resolve = (row: HistoricalPersonnelRate) => resolveRowRate(
    row,
    billingCurrency,
    usdBillingFraction,
    quotationCurrency,
    quotationExchangeRate,
  );

  if (input.rateMode === "annual_avg") {
    const averageYear = input.averageYear ?? input.referenceYear;
    const rates = sortedRates
      .filter((rate) => rate.year === averageYear)
      .map(resolve)
      .filter((rate): rate is number => rate != null && rate > 0);
    if (rates.length === 0) return 0;
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  const referencePeriod = input.referenceYear * 100 + input.referenceMonth;
  for (const rate of sortedRates) {
    if (rate.year * 100 + rate.month > referencePeriod) continue;
    const resolved = resolve(rate);
    if (resolved != null && resolved > 0) return resolved;
  }
  return 0;
}
