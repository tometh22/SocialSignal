import { settlementPhases, settlementWorkflow, type SettlementWorkflow } from "./settlement-workflow";

type ProgressInput = {
  closing: unknown;
  settlement: { status: string; billingCurrencySnapshot?: string; workflow?: SettlementWorkflow; usdPercentage: number; bonusUSD: number } | null;
  invoices: Array<{ invoiceComponent: string; approvalStatus: string }>;
};
export function settlementProgress(row: ProgressInput) {
  const state = (group: "ops" | "team" | "review" | "done" | "no_close", label: string, tone: "amber" | "indigo" | "emerald" | "blue" | "rose", step: number) => ({group,label,tone,step});
  if (!row.closing) return state("no_close", "Falta preparar la base", "amber", 1);
  if (!row.settlement || row.settlement.status === "draft") return state("ops", "Condiciones para publicar", "indigo", 2);
  const flow = settlementWorkflow(row.settlement.workflow);
  if (settlementPhases(row.settlement).some(phase => flow[phase].status === "pending")) return state("ops", "Autorizar importe", "indigo", 2);
  if (row.invoices.some(i => i.approvalStatus === "rejected")) return state("team", "Corregir comprobante", "rose", 3);
  if (row.invoices.some(i => i.approvalStatus === "pending")) return state("review", "Factura para Administración", "blue", 4);
  const usesUSD = row.settlement.usdPercentage > 0 || row.settlement.bonusUSD > 0;
  const separateInvoices = row.settlement.billingCurrencySnapshot ? row.settlement.billingCurrencySnapshot.toUpperCase() !== "ARS" : usesUSD;
  for (const phase of settlementPhases(row.settlement)) {
    const stage = flow[phase];
    if (stage.status === "rejected") return state("team", `Corregir importe ${phase.toUpperCase()}`, "rose", 3);
    if (stage.status !== "approved") return state("team", phase === "usd" ? flow.requiresInvoice === false ? "Completar TC de conversión" : "Completar TC al facturar" : usesUSD ? "Confirmar cobro, TC y extras" : "Confirmar importe y extras ARS", "amber", 3);
    if (flow.requiresInvoice !== false && Number(stage.amount) > 0 && !row.invoices.some(i => i.invoiceComponent === (separateInvoices ? phase : "single") && i.approvalStatus === "approved")) return state("team", `Adjuntar factura ${phase.toUpperCase()}`, "amber", 3);
  }
  return state("done", flow.requiresInvoice === false ? "Liquidación autorizada sin factura" : "Facturación completa", "emerald", 4);
}
