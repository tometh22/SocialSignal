// 🎯 SINGLE SOURCE OF TRUTH: Selector único para ViewModel de proyectos
// Regla de oro: Los datos de vista vienen pre-calculados del backend (NO reconvertir)
// Soporta 3 vistas: original, operativa, usd

type Currency = 'ARS' | 'USD' | 'MIXED';
type ViewType = 'original' | 'operativa' | 'usd';

// Estructura de respuesta del backend con vistas
type ProjectViewState = {
  view?: ViewType;
  currencyNative?: Currency;
  revenueDisplay?: number;
  costDisplay?: number;
  cotizacion?: number | null;
  markup?: number | null;
  margin?: number | null;
  budgetUtilization?: number | null;
  totalWorkedHours?: number;
  estimatedHours?: number;
  teamBreakdown?: any[];
  flags?: string[];
};

// Estructura legacy (backward compatibility)
type ProjectStateLegacy = {
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
    totalAmountNative?: number;
    estimatedHours?: number;
  };
  metrics?: {
    budgetUtilization?: number;
    efficiency?: number;
    markup?: number;
    margin?: number;
  };
  fx?: {
    usd_ars?: number;
  };
};

type ProjectState = ProjectViewState | ProjectStateLegacy;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Detecta si el estado es del nuevo sistema de vistas
 */
function isViewBasedState(state: any): state is ProjectViewState {
  return state && ('view' in state || ('currencyNative' in state && 'cotizacion' in state));
}

/**
 * Convierte el estado del proyecto a un ViewModel consistente
 * 
 * **SISTEMA DE 3 VISTAS** (nuevo):
 * - Datos vienen pre-calculados del backend según view seleccionada
 * - NUNCA reconvertir en el frontend
 * - revenueDisplay, costDisplay son FINALES
 * 
 * **LEGACY** (backward compatibility):
 * - Usa summary.costDisplay como FINAL
 * - Fallback a actuals.totalWorkedCost con conversión consciente
 */
export function toProjectVM(state: ProjectState, viewOverride?: ViewType) {
  // NUEVO SISTEMA: Estado basado en vistas
  if (isViewBasedState(state)) {
    return {
      view: viewOverride || state.view || 'operativa',
      currencyNative: state.currencyNative || 'USD',
      costDisplay: state.costDisplay || 0,
      revenueDisplay: state.revenueDisplay || 0,
      markup: state.markup || 0,
      margin: state.margin || 0,
      budgetUtilization: state.budgetUtilization || 0,
      cotizacion: state.cotizacion || null,
      efficiency: 0, // TODO: Calcular desde teamBreakdown
      totalHours: state.totalWorkedHours || 0,
      estimatedHours: state.estimatedHours || 0,
      baseCost: state.costDisplay || 0, // En vista unificada, baseCost = costDisplay
      teamBreakdown: state.teamBreakdown || [],
      flags: state.flags || []
    };
  }

  // LEGACY SYSTEM: Mantener backward compatibility
  const legacyState = state as ProjectStateLegacy;
  const currency = legacyState.summary?.currencyNative ?? 'ARS';

  // 🛡️ REGLA DE ORO: summary.costDisplay es FINAL (no convertir)
  let costDisplay =
    legacyState.summary?.costDisplay ??
    (currency === 'ARS' && legacyState.fx?.usd_ars && legacyState.actuals?.totalWorkedCost != null
      ? round2(legacyState.actuals.totalWorkedCost * legacyState.fx.usd_ars)
      : legacyState.actuals?.totalWorkedCost ?? 0);

  let revenueDisplay = 
    legacyState.summary?.revenueDisplay ?? 
    legacyState.quotation?.totalAmountNative ??
    legacyState.quotation?.totalAmount ?? 0;

  // Usar markup/margin del summary si está disponible, sino del metrics
  const markup = legacyState.summary?.markup ?? legacyState.metrics?.markup ?? 0;
  const margin = legacyState.summary?.margin ?? legacyState.metrics?.margin ?? 0;

  return {
    view: viewOverride || 'operativa',
    currencyNative: currency,
    costDisplay,
    revenueDisplay,
    markup,
    margin,
    budgetUtilization: legacyState.metrics?.budgetUtilization ?? 0,
    efficiency: legacyState.metrics?.efficiency ?? 0,
    totalHours: legacyState.actuals?.totalWorkedHours ?? 0,
    estimatedHours: legacyState.quotation?.estimatedHours ?? 0,
    baseCost: legacyState.quotation?.baseCost ?? 0,
    teamBreakdown: [],
    flags: legacyState.summary?.flags ?? []
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
  
  if (currency === 'MIXED') {
    return `${formatted} (monedas mixtas)`;
  }
  
  const symbol = currency === 'ARS' ? 'ARS' : '$';
  return `${symbol} ${formatted}`;
}

/**
 * Badge para indicar que los KPIs no son comparables (vista Original con monedas mixtas)
 */
export function isComparable(currency: Currency): boolean {
  return currency !== 'MIXED';
}

/**
 * Obtiene el nombre de la vista en español
 */
export function getViewName(view: ViewType): string {
  const names = {
    original: 'Original',
    operativa: 'Operativa',
    usd: 'USD Consolidada'
  };
  return names[view] || 'Operativa';
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

  if (isViewBasedState(state)) {
    // Nuevo sistema: verificar que use costDisplay
    if (state.costDisplay != null && Math.abs(valueShown - state.costDisplay) < 0.01) {
      console.log(`✅ [COST OK][${tag}] costDisplay (${state.currencyNative}) =`, valueShown);
    } else {
      console.warn(`⚠️ [COST MISMATCH][${tag}] valor mostrado =`, valueShown, 
        `| Expected costDisplay =`, state.costDisplay);
    }
    return;
  }

  // Legacy system check
  const legacyState = state as ProjectStateLegacy;
  const s = legacyState.summary?.costDisplay;
  const a = legacyState.actuals?.totalWorkedCost;
  const cur = legacyState.summary?.currencyNative;

  if (s != null && Math.abs(valueShown - s) < 0.01) {
    console.log(`✅ [COST OK][${tag}] summary.costDisplay (${cur}) =`, valueShown);
  } else if (a != null && Math.abs(valueShown - a) < 0.01) {
    console.warn(`⚠️ [COST MISMATCH][${tag}] mostrando actuals.totalWorkedCost (USD) =`, valueShown, 
      `| Expected summary.costDisplay =`, s);
  } else {
    console.log(`🔍 [COST][${tag}] valor derivado =`, valueShown, { cur, s, a });
  }
}
