export type QuotationVariantPreview = {
  quotationId: number; name: string; total: number; baseCost: number; markupAmount: number;
  hours: number; memberCount: number; referenceHours: number;
};

/** A summary represents one scenario, even when several are included in the proposal. */
export function selectPreviewVariant<T extends { id: number; isRecommended?: boolean }>(
  variants: T[], selectedIds: number[], explicitId: number | null,
): T | null {
  if (explicitId === 0) return null;
  return variants.find(variant => variant.id === explicitId)
    ?? variants.find(variant => selectedIds.includes(variant.id) && variant.isRecommended)
    ?? variants.find(variant => selectedIds.includes(variant.id))
    ?? null;
}
