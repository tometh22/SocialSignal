import { calculateGrossMarginPercentage, calculateTaxBreakdown } from './quotation-commercial';

export function quotedOperationalCost(quotation: {
  baseCost?: number | null; complexityAdjustment?: number | null;
  toolsCost?: number | null; platformCost?: number | null; additionalDeliverableCost?: number | null;
}): number {
  return ['baseCost', 'complexityAdjustment', 'toolsCost', 'platformCost', 'additionalDeliverableCost']
    .reduce((sum, key) => sum + (Number(quotation[key as keyof typeof quotation]) || 0), 0);
}

type CostParts = Parameters<typeof quotedOperationalCost>[0];
type PricedQuotation = CostParts & { totalAmount?: number | null; taxRate?: number | null; pricesIncludeTax?: boolean | null };

/**
 * Costo operativo y precio NETO de IVA de lo que el cliente realmente aceptó. Con una variante aceptada,
 * `quotation.totalAmount` ya es el total de esa variante, así que el costo tiene que ser el de la variante
 * (su costo base y ajuste de complejidad) más los costos a nivel cotización (herramientas, plataforma,
 * entregables). Mezclar el total de la variante con el costo de la cotización base daba márgenes arbitrarios.
 */
export function acceptedScopeCostAndNet(
  quotation: PricedQuotation,
  acceptedVariant?: { baseCost?: number | null; complexityAdjustment?: number | null } | null,
) {
  const cost = quotedOperationalCost({
    ...quotation,
    ...(acceptedVariant ? { baseCost: acceptedVariant.baseCost, complexityAdjustment: acceptedVariant.complexityAdjustment } : {}),
  });
  const net = calculateTaxBreakdown(Number(quotation.totalAmount) || 0, quotation.taxRate ?? 0, Boolean(quotation.pricesIncludeTax)).netAmount;
  return { cost, net };
}

/**
 * Costo y markup tal como los muestra la lista de cotizaciones. Se derivan de los
 * montos (total / costo operativo cotizado), igual que el resumen del detalle, y no
 * de la columna `marginFactor`, que conserva su default 2.0 en cotizaciones legacy
 * cuyo total es igual al costo.
 */
export function quotationListPricing(quotation: Parameters<typeof quotedOperationalCost>[0] & {
  totalAmount?: number | null; taxRate?: number | null; pricesIncludeTax?: boolean | null; acceptedVariantId?: number | null;
}) {
  const cost = quotedOperationalCost(quotation);
  // El markup se mide sobre el precio NETO (sin IVA), como la rentabilidad del detalle.
  const total = calculateTaxBreakdown(Number(quotation.totalAmount) || 0, quotation.taxRate ?? 0, Boolean(quotation.pricesIncludeTax)).netAmount;
  // Con una variante aceptada, totalAmount es el de la variante pero los costos son los de la
  // cotización base: dividirlos daría un factor arbitrario, así que no se muestra markup.
  if (quotation.acceptedVariantId != null || cost <= 0 || total <= 0) return { cost, total, factor: null as number | null, hasMarkup: false };
  const factor = total / cost;
  return { cost, total, factor, hasMarkup: Math.abs(factor - 1) >= 0.005 };
}

/** An empty ledger is missing evidence, not a realized 100% gross margin. */
export function quotationProfitability(input: {
  entries: Array<{ hours: number | null; totalCost: number | null }>;
  quotedHours: number; quotedCost: number; revenue: number;
  currency: string | null; exchangeRate: number;
}) {
  const realHours = input.entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const realCostARS = input.entries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
  const hasActualCosts = input.entries.length > 0 && input.entries.every(entry => entry.totalCost != null && Number.isFinite(entry.totalCost));
  const hasValidExchangeRate = Number.isFinite(input.exchangeRate) && input.exchangeRate > 0;
  const realCost = !hasActualCosts || (input.currency === 'USD' && !hasValidExchangeRate) ? null
    : input.currency === 'USD' ? realCostARS / input.exchangeRate : realCostARS;
  const plannedGrossMargin = calculateGrossMarginPercentage(input.revenue, input.quotedCost);
  const actualGrossMargin = realCost != null && input.revenue > 0
    ? calculateGrossMarginPercentage(input.revenue, realCost) : null;
  return {
    realHours, realCost, quotedHours: input.quotedHours, quotedCost: input.quotedCost,
    revenue: input.revenue, plannedGrossMargin, actualGrossMargin,
    marginDelta: actualGrossMargin == null ? null : Math.round((actualGrossMargin - plannedGrossMargin) * 10) / 10,
    hasActualCosts, currency: input.currency,
  };
}
