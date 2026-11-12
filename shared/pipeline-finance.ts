/** Financial exposure is a distinct, permission-gated basis, never pipeline value. */
export interface PipelineBilling {
  period: string;
  basis: "facturacion";
  currency: "USD";
  state: "verified" | "pending";
  reason: string | null;
  totalUsd: string | null;
  warnerUsd: string | null;
  warnerSharePct: number | null;
  eventCount: number;
  warnerEventCount: number;
  excludedEstimateCount: number;
  periodClosed: boolean;
  source: "revenue_events";
  retrievedAt: string;
  mapping: Array<{ clientId: number; name: string; basis: string }>;
  events: Array<{
    id: number;
    clientId: number | null;
    clientName: string;
    amountUsd: string;
    sourceTab: string | null;
    sourceRowId: string | null;
  }>;
  historicalReference: {
    percentage: 80;
    approximate: true;
    reportedOn: "2026-10-28";
    label: string;
  };
}
