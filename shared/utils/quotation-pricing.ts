export type MoneyCurrency = "ARS" | "USD";

export type PricingTeamMember = {
  hours?: number | null;
  rate?: number | null;
  cost?: number | null;
  currency?: MoneyCurrency | "mixed" | null;
  usdFraction?: number | null;
};

export type QuotationPricingInput = {
  quotationCurrency: MoneyCurrency;
  exchangeRate: number;
  team: PricingTeamMember[];
  complexityFactor?: number;
  marginFactor?: number;
  toolsCostUSD?: number;
  platformCostARS?: number;
  deviationPercentage?: number;
  discountPercentage?: number;
  inflationFactor?: number;
  priceMode?: "auto" | "manual";
  manualPrice?: number | null;
  manualPriceCurrency?: MoneyCurrency;
};

export type PricingBreakdown = {
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  toolsCost: number;
  platformCost: number;
  deviationAmount: number;
  discountAmount: number;
  total: number;
};

export type QuotationPricingResult = {
  canonicalARS: PricingBreakdown;
  display: PricingBreakdown;
  displayCurrency: MoneyCurrency;
  effectiveMarginFactor: number;
};

const finite = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function amountToARS(amount: number, currency: MoneyCurrency, exchangeRate: number): number {
  return currency === "USD" ? amount * exchangeRate : amount;
}

function memberCostARS(member: PricingTeamMember, exchangeRate: number): number {
  const native = finite(member.cost, finite(member.hours) * finite(member.rate));
  if (member.currency === "USD") return native * exchangeRate;
  if (member.currency === "mixed") {
    const usdFraction = Math.min(1, Math.max(0, finite(member.usdFraction)));
    return native * (1 - usdFraction) + native * usdFraction * exchangeRate;
  }
  return native;
}

/** Single deterministic pricing pipeline used by every quotation surface. */
export function calculateQuotationPricing(input: QuotationPricingInput): QuotationPricingResult {
  const exchangeRate = finite(input.exchangeRate);
  if (exchangeRate <= 0) throw new Error("El tipo de cambio debe ser mayor a cero");

  const baseCost = input.team.reduce((sum, member) => sum + memberCostARS(member, exchangeRate), 0);
  const complexityAdjustment = baseCost * finite(input.complexityFactor);
  const subtotalWithComplexity = baseCost + complexityAdjustment;
  const toolsCost = finite(input.toolsCostUSD) * exchangeRate;
  const platformCost = finite(input.platformCostARS);

  let markupAmount: number;
  let subtotalWithMarkup: number;
  let effectiveMarginFactor: number;
  if (input.priceMode === "manual" && finite(input.manualPrice) > 0) {
    const manualPriceARS = amountToARS(
      finite(input.manualPrice),
      input.manualPriceCurrency ?? input.quotationCurrency,
      exchangeRate,
    );
    subtotalWithMarkup = Math.max(0, manualPriceARS - toolsCost);
    markupAmount = subtotalWithMarkup - subtotalWithComplexity;
    effectiveMarginFactor = subtotalWithComplexity > 0 ? subtotalWithMarkup / subtotalWithComplexity : 1;
  } else {
    effectiveMarginFactor = Math.max(0, finite(input.marginFactor, 2));
    markupAmount = subtotalWithComplexity * (effectiveMarginFactor - 1);
    subtotalWithMarkup = subtotalWithComplexity + markupAmount;
  }

  const subtotalWithPlatform = subtotalWithMarkup + toolsCost + platformCost;
  const deviationAmount = subtotalWithPlatform * (finite(input.deviationPercentage) / 100);
  const subtotalWithDeviation = subtotalWithPlatform + deviationAmount;
  const discountAmount = subtotalWithDeviation * (finite(input.discountPercentage) / 100);
  const total = (subtotalWithDeviation - discountAmount) * Math.max(0, finite(input.inflationFactor, 1));

  const canonicalARS: PricingBreakdown = {
    baseCost: round(baseCost),
    complexityAdjustment: round(complexityAdjustment),
    markupAmount: round(markupAmount),
    toolsCost: round(toolsCost),
    platformCost: round(platformCost),
    deviationAmount: round(deviationAmount),
    discountAmount: round(discountAmount),
    total: round(total),
  };
  const divisor = input.quotationCurrency === "USD" ? exchangeRate : 1;
  const display = Object.fromEntries(
    Object.entries(canonicalARS).map(([key, value]) => [key, round(value / divisor)]),
  ) as PricingBreakdown;

  return {
    canonicalARS,
    display,
    displayCurrency: input.quotationCurrency,
    effectiveMarginFactor: round(effectiveMarginFactor),
  };
}

export function parseLocalizedDecimal(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = value.trim().replace(/[^\d,.-]/g, "");
  if (!raw) return null;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const normalized = lastComma > lastDot
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
