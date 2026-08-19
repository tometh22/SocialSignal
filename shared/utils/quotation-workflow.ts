export const QUOTATION_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "in-negotiation",
] as const;

export type QuotationStatus = typeof QUOTATION_STATUSES[number];

export const QUOTATION_TRANSITIONS: Record<QuotationStatus, readonly QuotationStatus[]> = {
  draft: ["pending", "approved", "rejected"],
  pending: ["approved", "rejected", "in-negotiation"],
  approved: ["in-negotiation"],
  "in-negotiation": ["approved", "rejected", "pending"],
  rejected: ["draft", "pending"],
};

export function isQuotationStatus(value: unknown): value is QuotationStatus {
  return typeof value === "string" && (QUOTATION_STATUSES as readonly string[]).includes(value);
}

export function canTransitionQuotation(from: string, to: QuotationStatus): boolean {
  if (!isQuotationStatus(from)) return false;
  return QUOTATION_TRANSITIONS[from].includes(to);
}

export function assertQuotationTransition(from: string, to: QuotationStatus): void {
  if (canTransitionQuotation(from, to)) return;
  const allowed = isQuotationStatus(from) ? QUOTATION_TRANSITIONS[from] : [];
  throw new Error(
    `No se puede cambiar de "${from}" a "${to}". Transiciones válidas: ${allowed.join(", ") || "ninguna"}`,
  );
}
