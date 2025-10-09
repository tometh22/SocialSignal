// quotation-normalizer.ts - Normalize quotation data to ensure currency consistency

type Currency = 'ARS' | 'USD';

interface FxRates {
  usd_ars: number;
}

/**
 * Convert USD amount to native currency
 */
function toNative(amountUSD: number, native: Currency, fx: FxRates): number {
  return native === 'USD' ? amountUSD : Math.round(amountUSD * fx.usd_ars);
}

/**
 * Normalize quotation to ensure totalAmountNative is always in the correct currency
 * 
 * This prevents currency mismatches that break budget utilization, markup, and margin calculations.
 */
export function normalizeQuotation(q: any, native: Currency, fxRate: number = 1345) {
  if (!q) return null;
  
  const fx = { usd_ars: fxRate };
  const totalAmount = Number(q?.totalAmount ?? 0);        // USD (legacy)
  
  // Use provided totalAmountNative if available, otherwise convert from USD
  const totalAmountNative =
    q?.totalAmountNative != null
      ? Number(q.totalAmountNative)
      : toNative(totalAmount, native, fx);
  
  const estimatedHours = Number(q?.estimatedHours ?? -1);
  
  // Development consistency guard
  if (process.env.NODE_ENV !== 'production') {
    const suspicious = q?.totalAmount && !q?.totalAmountNative;
    if (suspicious) {
      console.warn('[CONSISTENCY] quotation.totalAmountNative missing. Falling back via fx conversion.');
    }
  }
  
  return { 
    ...q, 
    totalAmount, 
    totalAmountNative, 
    estimatedHours 
  };
}

/**
 * Calculate financial metrics using normalized native currency values
 */
export function calculateNativeMetrics(
  revenueDisplay: number,
  costDisplay: number,
  quotationNative: number
) {
  const budgetUtilization = quotationNative > 0 ? costDisplay / quotationNative : null;
  const markup = costDisplay > 0 ? quotationNative / costDisplay : null;
  const margin = quotationNative > 0 ? (quotationNative - costDisplay) / quotationNative : null;
  
  return {
    budgetUtilization,
    markup,
    margin
  };
}
