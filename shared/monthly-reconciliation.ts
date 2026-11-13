export interface MonthlyProjectRow {
  key: string;
  clientName: string;
  projectName: string;
  projectType: string | null;
  revenueUsd: number;
  directCostUsd: number | null;
  sourceRefs: string[];
}
export interface ProjectFollowupRow {
  key: string;
  clientName: string;
  projectName: string;
  projectType: string | null;
  budgetUsd: number | null;
  cumulativeCostUsd: number | null;
  status: 'open' | 'closed' | 'unknown';
  sourceRef: string;
}
export interface MonthlyReconciliationReport {
  periodKey: string;
  source: 'master' | 'mind' | 'cierre';
  readAt: string;
  costBasis: 'actual' | 'estimated' | 'unavailable';
  rows: MonthlyProjectRow[];
  followup: ProjectFollowupRow[];
  missingFollowup: Array<{ clientName: string; projectName: string; revenueUsd: number }>;
  totals: {
    salesUsd: number;
    directCostUsd: number | null;
    operatingCostUsd: number | null;
    overheadUsd: number | null;
    ebitUsd: number | null;
    summarySalesUsd: number | null;
    summaryOperatingCostUsd: number | null;
    salesDifferenceUsd: number | null;
    costsDifferenceUsd: number | null;
    closedProjectMarkup?: number | null;
    summaryClosedProjectMarkup?: number | null;
  };
  status: 'matched' | 'difference' | 'unavailable';
  warnings: string[];
}
