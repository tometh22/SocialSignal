export type QuotationGroupStatus =
  | "preparing"
  | "in_approval"
  | "ready_to_send"
  | "sent"
  | "partial_acceptance"
  | "won"
  | "mixed"
  | "lost";

export function deriveQuotationGroupStatus(statuses: string[]): QuotationGroupStatus {
  if (statuses.length === 0 || statuses.every((status) => status === "draft")) return "preparing";
  if (statuses.every((status) => status === "approved")) return "won";
  if (statuses.every((status) => ["rejected", "expired", "cancelled"].includes(status))) return "lost";
  if (statuses.some((status) => status === "approved")
    && statuses.some((status) => ["rejected", "expired", "cancelled"].includes(status))) return "mixed";
  if (statuses.some((status) => status === "approved")) return "partial_acceptance";
  if (statuses.every((status) => ["sent", "viewed", "in-negotiation", "approved", "rejected"].includes(status))) return "sent";
  if (statuses.every((status) => status === "internally-approved")) return "ready_to_send";
  if (statuses.some((status) => status === "pending")) return "in_approval";
  return "preparing";
}

export function quotationGroupCurrencySubtotals(
  items: Array<{ currency: string | null | undefined; totalAmount: number | null | undefined }>,
) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const currency = item.currency === "USD" ? "USD" : "ARS";
    totals[currency] = (totals[currency] || 0) + Number(item.totalAmount || 0);
    return totals;
  }, {});
}

export function isQuotationConfigured(input: {
  completedStep: number;
  hasScope: boolean;
  teamSize: number;
  exchangeRate: number;
  totalAmount: number;
}) {
  return input.completedStep >= 6
    && input.hasScope
    && input.teamSize > 0
    && Number.isFinite(input.exchangeRate)
    && input.exchangeRate > 0
    && Number.isFinite(input.totalAmount)
    && input.totalAmount > 0;
}
