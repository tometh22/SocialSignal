// 🎯 SINGLE SOURCE OF TRUTH: Selector único para ViewModel de proyectos
// Regla de oro: summary.costDisplay y summary.revenueDisplay son FINALES (no reconvertir)

type Currency = 'ARS' | 'USD';

type ProjectState = {
  summary?: {
    costDisplay?: number;
    revenueDisplay?: number;
    currencyNative?: Currency;
    markup?: number;
    margin?: number;
    flags?: string[];
  };
  actuals?: {
    totalWorkedCost?: number;    // USD base (solo fallback)
    totalWorkedHours?: number;
  };
  quotation?: {
    baseCost?: number;
    totalAmount?: number;
    estimatedHours?: number;
  };
  metrics?: {
    budgetUtilization?: number;
    efficiency?: number;
    markup?: number;
    margin?: number;
  };
  fx?: {
    usd_ars?: number;  // Opcional para fallback
  };
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Convierte el estado del proyecto a un ViewModel consistente
 * 
 * **REGLA DE ORO**: 
 * - Si existe summary.costDisplay, es el valor FINAL en moneda nativa
 * - NUNCA reconvertir *Display en el frontend
 * - actuals.totalWorkedCost es USD base (solo para fallback)
 */
export function toProjectVM(state: ProjectState) {
  const currency = state.summary?.currencyNative ?? 'ARS';

  // 🛡️ REGLA DE ORO: summary.costDisplay es FINAL (no convertir)
  let costDisplay =
    state.summary?.costDisplay ??
    (currency === 'ARS' && state.fx?.usd_ars && state.actuals?.totalWorkedCost != null
      ? round2(state.actuals.totalWorkedCost * state.fx.usd_ars)  // fallback consciente
      : state.actuals?.totalWorkedCost ?? 0);

  let revenueDisplay = 
    state.summary?.revenueDisplay ?? 
    state.quotation?.totalAmount ?? 0;

  // Usar markup/margin del summary si está disponible, sino del metrics
  const markup = state.summary?.markup ?? state.metrics?.markup ?? 0;
  const margin = state.summary?.margin ?? state.metrics?.margin ?? 0;

  return {
    currencyNative: currency,
    costDisplay,
    revenueDisplay,
    markup,
    margin,
    budgetUtilization: state.metrics?.budgetUtilization ?? 0,
    efficiency: state.metrics?.efficiency ?? 0,
    totalHours: state.actuals?.totalWorkedHours ?? 0,
    estimatedHours: state.quotation?.estimatedHours ?? 0,
    baseCost: state.quotation?.baseCost ?? 0,
    flags: state.summary?.flags ?? []
  };
}

/**
 * Formatea un monto en la moneda correcta
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const formatted = amount.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  const symbol = currency === 'ARS' ? 'ARS' : '$';
  return `${symbol} ${formatted}`;
}

/**
 * Hook para detectar reconversiones incorrectas (solo DEV)
 */
export function useWhichCost(
  valueShown: number, 
  state: ProjectState, 
  tag: string
) {
  if (import.meta.env.MODE === 'production') return;

  const s = state.summary?.costDisplay;
  const a = state.actuals?.totalWorkedCost;
  const cur = state.summary?.currencyNative;

  if (s != null && Math.abs(valueShown - s) < 0.01) {
    console.log(`✅ [COST OK][${tag}] summary.costDisplay (${cur}) =`, valueShown);
  } else if (a != null && Math.abs(valueShown - a) < 0.01) {
    console.warn(`⚠️ [COST MISMATCH][${tag}] mostrando actuals.totalWorkedCost (USD) =`, valueShown, 
      `| Expected summary.costDisplay =`, s);
  } else {
    console.log(`🔍 [COST][${tag}] valor derivado =`, valueShown, { cur, s, a });
  }
}
