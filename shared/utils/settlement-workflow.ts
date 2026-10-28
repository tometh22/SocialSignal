export type SettlementPhase = "usd" | "ars";
export type SettlementStage = { status: "draft" | "pending" | "approved" | "rejected"; amount?: number; reason?: string; actorId?: number; at?: string };
export type SettlementWorkflow = {
  version: number;
  publication?: { beforeCut: boolean; actorId: number; at: string; reason?: string };
  usd: SettlementStage;
  ars: SettlementStage;
  extrasARS: number;
  extrasReason?: string;
  receivedConfirmed?: boolean;
  events?: Array<{ action: string; actorId: number; at: string; reason?: string; amount?: number }>;
};
export function settlementWorkflow(value?: Partial<SettlementWorkflow> | null): SettlementWorkflow {
  return { ...value, version: value?.version ?? 0, usd: value?.usd ?? { status: "draft" }, ars: value?.ars ?? { status: "draft" }, extrasARS: value?.extrasARS ?? 0 };
}
