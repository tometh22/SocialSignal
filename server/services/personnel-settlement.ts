export type PersonnelSettlementInputs = {
  totalARS: number;
  usdPercentage: number;
  bonusUSD?: number | null;
  extrasARS?: number | null;
  invoiceFx?: number | null;
  receivedFx?: number | null;
  bankCommissionUSD?: number | null;
};

export type PersonnelSettlementCalculation = {
  plannedUSDARS: number;
  baseInvoiceUSD: number | null;
  totalInvoiceUSD: number | null;
  pesifiedBaseARS: number | null;
  finalInvoiceARS: number | null;
  financialCostARS: number | null;
  financialCostUSD: number | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Reemplaza las fórmulas del Excel de cierre.
 *
 * El bono USD es un adicional: no reduce el saldo salarial en ARS. La comisión
 * bancaria se reintegra en el tramo ARS, por eso aumenta la diferencia final.
 */
export function calculatePersonnelSettlement(input: PersonnelSettlementInputs): PersonnelSettlementCalculation {
  const totalARS = Math.max(0, Number(input.totalARS) || 0);
  const usdPercentage = Math.min(100, Math.max(0, Number(input.usdPercentage) || 0));
  const bonusUSD = Math.max(0, Number(input.bonusUSD) || 0);
  const extrasARS = Math.max(0, Number(input.extrasARS) || 0);
  const bankCommissionUSD = Math.max(0, Number(input.bankCommissionUSD) || 0);
  const invoiceFx = Number(input.invoiceFx) > 0 ? Number(input.invoiceFx) : null;
  const receivedFx = Number(input.receivedFx) > 0 ? Number(input.receivedFx) : null;

  const plannedUSDARS = money(totalARS * usdPercentage / 100);
  const baseInvoiceUSD = invoiceFx ? money(plannedUSDARS / invoiceFx) : null;
  const totalInvoiceUSD = baseInvoiceUSD == null ? null : money(baseInvoiceUSD + bonusUSD);
  const pesifiedBaseARS = baseInvoiceUSD != null && receivedFx
    ? money(baseInvoiceUSD * receivedFx)
    : null;
  const finalInvoiceARS = pesifiedBaseARS == null || !receivedFx
    ? null
    : money(totalARS - pesifiedBaseARS + extrasARS + bankCommissionUSD * receivedFx);
  const financialCostARS = finalInvoiceARS == null || totalInvoiceUSD == null || !receivedFx
    ? null
    : money(totalInvoiceUSD * receivedFx + finalInvoiceARS);
  const financialCostUSD = financialCostARS == null || !receivedFx
    ? null
    : money(financialCostARS / receivedFx);

  return {
    plannedUSDARS,
    baseInvoiceUSD,
    totalInvoiceUSD,
    pesifiedBaseARS,
    finalInvoiceARS,
    financialCostARS,
    financialCostUSD,
  };
}
