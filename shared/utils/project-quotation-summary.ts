type QuotationHeader = {
  id: number;
  projectName: string;
  baseCost: number;
  totalAmount: number;
  quotationCurrency?: string | null;
  quotationType?: string | null;
  projectType?: string | null;
};

/** Preserve the native contract amounts; actual period metrics are a separate object. */
export function projectQuotationSummary(quotation: QuotationHeader | null | undefined, estimatedHours?: number | null) {
  if (!quotation) return null;
  return {
    id: quotation.id, projectName: quotation.projectName, baseCost: quotation.baseCost,
    totalAmount: quotation.totalAmount, totalAmountNative: quotation.totalAmount,
    quotationCurrency: quotation.quotationCurrency,
    quotationType: quotation.quotationType, projectType: quotation.projectType,
    estimatedHours: estimatedHours != null && Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : null,
  };
}
