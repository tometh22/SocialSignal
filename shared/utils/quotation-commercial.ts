export type PaymentMilestone = {
  label: string;
  percentage: number;
  dueDays?: number;
};

export type TaxBreakdown = {
  netAmount: number;
  taxAmount: number;
  grandTotal: number;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateTaxBreakdown(
  amount: number,
  taxRate = 0,
  pricesIncludeTax = false,
): TaxBreakdown {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const safeRate = Math.min(100, Math.max(0, Number(taxRate) || 0));
  if (safeRate === 0) return { netAmount: money(safeAmount), taxAmount: 0, grandTotal: money(safeAmount) };
  if (pricesIncludeTax) {
    const netAmount = safeAmount / (1 + safeRate / 100);
    return {
      netAmount: money(netAmount),
      taxAmount: money(safeAmount - netAmount),
      grandTotal: money(safeAmount),
    };
  }
  const taxAmount = safeAmount * safeRate / 100;
  return {
    netAmount: money(safeAmount),
    taxAmount: money(taxAmount),
    grandTotal: money(safeAmount + taxAmount),
  };
}

export function validatePaymentSchedule(schedule: PaymentMilestone[]): void {
  if (schedule.length === 0) return;
  const total = schedule.reduce((sum, milestone) => sum + milestone.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`El cronograma de pagos debe sumar 100% (actual: ${money(total)}%)`);
  }
}

export function calculateGrossMarginPercentage(revenue: number, cost: number): number {
  const safeRevenue = Number(revenue) || 0;
  if (safeRevenue <= 0) return 0;
  return money(((safeRevenue - Math.max(0, Number(cost) || 0)) / safeRevenue) * 100);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function stableQuotationSnapshot(value: unknown): string {
  return JSON.stringify(stable(value));
}
