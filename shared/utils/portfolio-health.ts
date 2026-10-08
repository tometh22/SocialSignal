export type FinancialHealthProject = {
  projectCategory?: string | null;
  costCoverage?: { pendingHours?: number; syncPending?: boolean } | null;
  metrics?: { markup?: number | null; markupRatio?: number | null; revenueUSDNormalized?: number; revenueUSD?: number; revenueDisplay?: number; costUSDNormalized?: number; costUSD?: number; costDisplay?: number };
};

export function measurableProjectMarkup(project: FinancialHealthProject): number | null {
  if (project.projectCategory === "internal" || project.costCoverage?.pendingHours || project.costCoverage?.syncPending) return null;
  const m = project.metrics;
  const revenue = m?.revenueUSDNormalized ?? m?.revenueUSD ?? m?.revenueDisplay ?? 0;
  const cost = m?.costUSDNormalized ?? m?.costUSD ?? m?.costDisplay ?? 0;
  const markup = m?.markup ?? m?.markupRatio;
  return revenue > 0 && cost > 0 && typeof markup === "number" && Number.isFinite(markup) && markup >= 0 ? markup : null;
}

export function portfolioProjectHealth(project: FinancialHealthProject): "healthy" | "warning" | "critical" | "neutral" {
  const markup = measurableProjectMarkup(project);
  return markup == null ? "neutral" : markup >= 2.5 ? "healthy" : markup >= 2 ? "warning" : "critical";
}

export function hasEvaluableProjectHealth(metrics: { markup: number | null; revenue: number; cost: number; budget: number; estimatedHours: number }): boolean {
  return (metrics.markup != null && metrics.revenue > 0 && metrics.cost > 0) || metrics.budget > 0 || metrics.estimatedHours > 0;
}
