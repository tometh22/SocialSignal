export const QUOTATION_STATUSES = [
  "draft",
  "pending",
  "internally-approved",
  "sent",
  "viewed",
  "approved",
  "rejected",
  "in-negotiation",
  "expired",
  "cancelled",
  "superseded",
] as const;

export type QuotationStatus = typeof QUOTATION_STATUSES[number];

export const QUOTATION_TRANSITIONS: Record<QuotationStatus, readonly QuotationStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["internally-approved", "rejected", "cancelled"],
  "internally-approved": ["sent", "cancelled", "superseded"],
  sent: ["viewed", "in-negotiation", "approved", "rejected", "expired", "cancelled"],
  viewed: ["in-negotiation", "approved", "rejected", "expired", "cancelled"],
  "in-negotiation": ["internally-approved", "sent", "approved", "rejected", "expired", "cancelled"],
  // `approved` is reserved for acceptance by the client. A commercial change
  // after acceptance must be represented by a new revision.
  approved: ["superseded"],
  rejected: ["superseded"],
  expired: ["superseded"],
  cancelled: ["superseded"],
  superseded: [],
};

export const CLIENT_VISIBLE_QUOTATION_STATUSES: readonly QuotationStatus[] = [
  "sent",
  "viewed",
  "in-negotiation",
  "approved",
  "rejected",
  "expired",
];

export function quotationNeedsImmutableRevision(status: string): boolean {
  return isQuotationStatus(status) && [
    "internally-approved",
    ...CLIENT_VISIBLE_QUOTATION_STATUSES,
    "superseded",
  ].includes(status as QuotationStatus);
}

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
