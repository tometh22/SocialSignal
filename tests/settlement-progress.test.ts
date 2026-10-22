import { describe, expect, it } from "vitest";
import { settlementProgress } from "../shared/utils/settlement-progress";
import { settlementWorkflow } from "../shared/utils/settlement-workflow";

const row = () => ({closing:{id:1},settlement:{status:"published",billingCurrencySnapshot:"MIXED",usdPercentage:90,bonusUSD:0,workflow:settlementWorkflow({usd:{status:"approved",amount:6}})},invoices:[] as Array<{invoiceComponent:string;approvalStatus:string}>});
describe("settlement next responsible party", () => {
  it("sends an uploaded USD invoice to Administration before asking for receipt FX", () => {
    const value=row(); value.invoices.push({invoiceComponent:"usd",approvalStatus:"pending"});
    expect(settlementProgress(value).group).toBe("review");
    value.invoices[0].approvalStatus="approved";
    expect(settlementProgress(value).label).toBe("Confirmar cobro, TC y extras");
  });
  it("asks ARS-only employees for authorization before a document", () => {
    const value=row();value.settlement.usdPercentage=0;value.settlement.billingCurrencySnapshot="ARS";
    expect(settlementProgress(value).label).toBe("Confirmar importe y extras ARS");
    value.settlement.workflow.ars={status:"pending",amount:10000};
    expect(settlementProgress(value).group).toBe("ops");
  });
  it("finishes zero ARS balances without requesting a phantom invoice", () => {
    const value=row();value.settlement.workflow.ars={status:"approved",amount:0};
    value.invoices.push({invoiceComponent:"usd",approvalStatus:"approved"});
    expect(settlementProgress(value).group).toBe("done");
  });
  it("uses amounts rather than a mixed billing label to require USD", () => {
    const value=row();value.settlement.usdPercentage=0;value.settlement.workflow.ars={status:"approved",amount:10000};
    value.invoices.push({invoiceComponent:"ars",approvalStatus:"approved"});
    expect(settlementProgress(value).group).toBe("done");
  });
});
