export function normalizeContractualRateToARS(
  sourceRate: number,
  billingCurrency: string | null | undefined,
  exchangeRate: number,
  canonicalRateARS?: number | null,
): number {
  if (canonicalRateARS != null && Number.isFinite(canonicalRateARS) && canonicalRateARS > 0) {
    return canonicalRateARS;
  }
  if (String(billingCurrency || 'ARS').toUpperCase() !== 'USD') return sourceRate;
  return sourceRate > 0 && exchangeRate > 0 ? sourceRate * exchangeRate : 0;
}
