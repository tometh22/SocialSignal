export function calculateSettlementDifference(usdAmount: number, bankFxRate: number, closingFxRate: number): number {
  if (![usdAmount, bankFxRate, closingFxRate].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error("El tramo USD y los tipos de cambio deben ser positivos y finitos");
  }
  const difference = Math.round(usdAmount * (bankFxRate - closingFxRate) * 100) / 100;
  if (!Number.isFinite(difference)) throw new Error("La diferencia calculada excede el rango permitido");
  return difference;
}
export function canResubmitSettlement(status: string | null | undefined): boolean {
  return status == null || status === "pending" || status === "rejected";
}
