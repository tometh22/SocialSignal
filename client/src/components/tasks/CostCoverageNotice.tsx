export type CostCoverage = { syncPending?: boolean; pendingHours: number; pendingRate: number; pendingFx: number; pendingSync: number; calculatedHours: number };
export default function CostCoverageNotice({ coverage, knownCost = 0 }: { coverage?: CostCoverage | null; knownCost?: number }) {
  if (!coverage || (!coverage.pendingHours && !coverage.syncPending)) return null;
  if (!coverage.pendingHours) return <span className="block text-xs text-amber-700">Costo pendiente de conciliación</span>;
  const reasons = [coverage.pendingRate > 0 && "tarifa histórica", coverage.pendingFx > 0 && "tipo de cambio", coverage.pendingSync > 0 && "conciliación"].filter(Boolean).join(", ");
  return <span className="block text-xs text-amber-700" title={`Falta resolver: ${reasons}`}>{coverage.calculatedHours > 0 || knownCost > 0 ? "Costo parcial" : "Costo pendiente"} · {coverage.pendingHours.toFixed(2)} h ({reasons})</span>;
}
