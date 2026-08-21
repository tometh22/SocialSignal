// Alerta de margen para contratos activos (fee mensual / programa anual).
//
// El precio que le cobramos al cliente se fija una sola vez, en dólares, al
// cotizar. El costo real (sueldos del equipo) se sigue pagando en pesos y
// cambia mes a mes. Si el tipo de cambio se atrasa respecto a la inflación en
// pesos, el costo del equipo medido en dólares sube mientras el precio
// contratado no se mueve: el margen se erosiona sin que nada lo muestre.
//
// Esta capa es puramente de DIAGNÓSTICO: no cambia el precio de ninguna
// cotización. Compara el costo con las tarifas vigentes al cotizar contra el
// costo del mismo equipo con las tarifas vigentes hoy, y expone cuántos
// puntos de margen se perdieron.

export type MarginDriftTeamMember = {
  personnelId: number | null;
  hours: number;
  /** Tarifa/hora congelada al cotizar, en la moneda de la cotización. */
  originalRate: number;
  /**
   * Tarifa/hora vigente hoy, en la moneda de la cotización. `null` cuando no
   * se pudo resolver (persona sin tarifa histórica activa, o asignación sólo
   * por rol sin persona vinculada) — en ese caso se conserva la tarifa
   * original para esa fila y se cuenta como "no actualizada".
   */
  currentRate: number | null;
};

export type MarginDriftInput = {
  /** quotations.totalAmount — el precio ya fijado, en la moneda de la cotización. */
  lockedTotal: number;
  team: MarginDriftTeamMember[];
};

export type MarginDriftSeverity = "ok" | "watch" | "critical";

export type MarginDriftResult = {
  originalCost: number;
  currentCost: number;
  /** Cuánto creció el costo del equipo, en %. Puede ser negativo (el equipo se abarató). */
  costDeltaPercentage: number;
  originalMarginPercentage: number;
  currentMarginPercentage: number;
  /** Puntos de margen perdidos (positivo = se erosionó, negativo = mejoró). */
  marginErosionPoints: number;
  unresolvedMembers: number;
  totalMembers: number;
  severity: MarginDriftSeverity;
};

/** Puntos de margen erosionados a partir de los cuales se considera cada nivel. */
export const MARGIN_DRIFT_THRESHOLDS = {
  watch: 5,
  critical: 15,
} as const;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateMarginDrift(input: MarginDriftInput): MarginDriftResult {
  const lockedTotal = Math.max(0, Number(input.lockedTotal) || 0);

  let originalCost = 0;
  let currentCost = 0;
  let unresolvedMembers = 0;

  for (const member of input.team) {
    const hours = Math.max(0, Number(member.hours) || 0);
    const originalRate = Math.max(0, Number(member.originalRate) || 0);
    originalCost += hours * originalRate;

    if (member.currentRate == null) {
      unresolvedMembers += 1;
      currentCost += hours * originalRate;
    } else {
      currentCost += hours * Math.max(0, Number(member.currentRate) || 0);
    }
  }

  const costDeltaPercentage = originalCost > 0
    ? ((currentCost - originalCost) / originalCost) * 100
    : 0;
  const originalMarginPercentage = lockedTotal > 0
    ? ((lockedTotal - originalCost) / lockedTotal) * 100
    : 0;
  const currentMarginPercentage = lockedTotal > 0
    ? ((lockedTotal - currentCost) / lockedTotal) * 100
    : 0;
  const marginErosionPoints = originalMarginPercentage - currentMarginPercentage;

  const severity: MarginDriftSeverity = marginErosionPoints >= MARGIN_DRIFT_THRESHOLDS.critical || currentMarginPercentage <= 0
    ? "critical"
    : marginErosionPoints >= MARGIN_DRIFT_THRESHOLDS.watch
      ? "watch"
      : "ok";

  return {
    originalCost: round2(originalCost),
    currentCost: round2(currentCost),
    costDeltaPercentage: round2(costDeltaPercentage),
    originalMarginPercentage: round2(originalMarginPercentage),
    currentMarginPercentage: round2(currentMarginPercentage),
    marginErosionPoints: round2(marginErosionPoints),
    unresolvedMembers,
    totalMembers: input.team.length,
    severity,
  };
}
