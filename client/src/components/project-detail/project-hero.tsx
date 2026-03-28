/**
 * Project Hero — light-mode, integrated with app design system.
 * Health score drives a colored left-border accent (Linear-style).
 * KPIs are the visual hero: large tabular numbers on white.
 */
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Link } from "wouter";
import { computeHealthScore, healthLabel, healthGrade } from "./health-score";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(n: number) {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("es-AR")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectHeroProps {
  clientName: string;
  projectName: string;
  projectStatus: string;
  period?: string;
  revenue: number;
  cost: number;
  markup: number;
  margin: number;
  totalHours: number;
  estimatedHours: number;
  budget: number;
  budgetUtilization: number;
  hoursDeviation: number;
  canSeeCosts: boolean;
  prevMarkup?: number;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Activo", completed: "Completado", cancelled: "Cancelado", "on-hold": "Pausado",
};

// ─── KPI Column ───────────────────────────────────────────────────────────────

function KPICol({
  label, value, sub, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "amber" | "red" | "neutral";
}) {
  const valColor =
    highlight === "green"  ? "text-emerald-600"
    : highlight === "amber" ? "text-amber-600"
    : highlight === "red"   ? "text-red-600"
    : "text-slate-900";

  return (
    <div className="flex flex-col min-w-[80px] px-5 border-r border-slate-100 last:border-0 first:pl-0">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight mt-1 ${valColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

// ─── Budget bar ───────────────────────────────────────────────────────────────

function BudgetStrip({
  cost, budget, utilization,
}: {
  cost: number; budget: number; utilization: number;
}) {
  const barColor =
    utilization >= 90 ? "bg-red-500"
    : utilization >= 75 ? "bg-amber-400"
    : "bg-emerald-500";

  const textColor =
    utilization >= 90 ? "text-red-600 font-semibold"
    : utilization >= 75 ? "text-amber-600"
    : "text-slate-500";

  return (
    <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-slate-400">Presupuesto</span>
        <span className={`text-[11px] ${textColor}`}>
          {usd(cost)} / {usd(budget)} · {utilization.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[10px] ${
          utilization >= 90 ? "text-red-500" : utilization >= 75 ? "text-amber-500" : "text-slate-400"
        }`}>
          {utilization >= 90 ? "⚠ Budget casi agotado" : utilization >= 75 ? "Zona de atención" : "Budget disponible"}
        </span>
        <span className="text-[10px] text-slate-400">Quedan {usd(budget - cost)}</span>
      </div>
    </div>
  );
}

// ─── Health Badge ─────────────────────────────────────────────────────────────

function HealthBadge({ score }: { score: number }) {
  const info  = healthLabel(score);
  const grade = healthGrade(score);

  const styles =
    score >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200"
    : score >= 30 ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-red-50 text-red-700 border-red-200";

  const dot =
    score >= 70 ? "bg-emerald-500"
    : score >= 50 ? "bg-amber-400"
    : score >= 30 ? "bg-orange-500"
    : "bg-red-500";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm font-semibold ${styles}`}>
        <span className={`w-2 h-2 rounded-full ${dot} ${score < 50 ? "animate-pulse" : ""}`} />
        {info.text}
      </div>
      <p className="text-[11px] text-slate-400 flex items-center gap-1">
        <Activity className="h-3 w-3" />
        Score {score}/100 · Grado {grade}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectHero(props: ProjectHeroProps) {
  const {
    clientName, projectName, projectStatus, period,
    revenue, cost, markup, margin, totalHours, estimatedHours,
    budget, budgetUtilization, hoursDeviation, canSeeCosts, prevMarkup,
  } = props;

  const score = computeHealthScore({
    markup,
    budgetUtilization,
    hoursDeviation: Math.max(0, hoursDeviation),
    hasBudget: budget > 0,
    hasHoursEstimate: estimatedHours > 0,
  });

  // Colored left border — the health "signal" that's always visible
  const leftBorder =
    score >= 70 ? "border-l-emerald-500"
    : score >= 50 ? "border-l-amber-400"
    : score >= 30 ? "border-l-orange-500"
    : "border-l-red-500";

  const markupTrend = prevMarkup != null && prevMarkup > 0 ? markup - prevMarkup : null;
  const profit = revenue - cost;

  const periodLabel = (() => {
    if (!period) return "";
    try {
      const [y, m] = period.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
    } catch { return period; }
  })();

  const hasClient = clientName && clientName !== "—";

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${leftBorder} shadow-sm overflow-hidden`}>

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 px-6 pt-4 pb-0">
        <Link href="/active-projects">
          <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors text-xs font-medium">
            <ArrowLeft className="h-3 w-3" />
            Proyectos
          </button>
        </Link>
        {hasClient && (
          <>
            <span className="text-slate-200 text-xs">/</span>
            <span className="text-slate-400 text-xs truncate max-w-[160px]">{clientName}</span>
          </>
        )}
        {period && (
          <>
            <span className="text-slate-200 text-xs">/</span>
            <span className="text-slate-400 text-xs capitalize">{periodLabel}</span>
          </>
        )}
      </div>

      {/* ── Title row ── */}
      <div className="px-6 pt-3 pb-5">
        <div className="flex items-start justify-between gap-6">

          {/* Left: client + project name + badges */}
          <div className="flex-1 min-w-0">
            {hasClient && (
              <p className="text-xs font-medium text-slate-400 mb-0.5">{clientName}</p>
            )}
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight tracking-tight truncate">
              {projectName}
            </h1>

            {/* Status & markup badges */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[11px] font-medium rounded-md px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200">
                {STATUS_LABEL[projectStatus] ?? projectStatus}
              </span>

              {canSeeCosts && markup > 0 && (
                <span className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border inline-flex items-center gap-1.5 ${
                  markup >= 2.5
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : markup >= 2.0
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  Markup {markup.toFixed(2)}x
                  {markupTrend != null && Math.abs(markupTrend) >= 0.1 && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${markupTrend > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {markupTrend > 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {markupTrend > 0 ? "+" : ""}{markupTrend.toFixed(1)}x
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Right: Health badge (ops only) */}
          {canSeeCosts && <HealthBadge score={score} />}
        </div>

        {/* ── KPI strip (ops only) ── */}
        {canSeeCosts && (
          <div className="mt-5 pt-5 border-t border-slate-100 flex items-start flex-wrap gap-y-4">
            {revenue > 0 && (
              <KPICol
                label="Revenue"
                value={usd(revenue)}
                highlight="green"
              />
            )}
            {cost > 0 && (
              <KPICol
                label="Costo"
                value={usd(cost)}
                sub={revenue === 0 ? "sin facturación" : undefined}
              />
            )}
            {markup > 0 && (
              <KPICol
                label="Markup"
                value={`${markup.toFixed(2)}x`}
                sub="meta: 2.5x"
                highlight={markup >= 2.5 ? "green" : markup >= 2.0 ? "amber" : "red"}
              />
            )}
            {revenue > 0 && (
              <KPICol
                label="Margen"
                value={`${margin.toFixed(1)}%`}
                sub={profit !== 0 ? usd(profit) : undefined}
                highlight={margin >= 25 ? "green" : margin >= 10 ? "amber" : "red"}
              />
            )}
            {(totalHours > 0 || estimatedHours > 0) && (
              <KPICol
                label="Horas"
                value={`${Math.round(totalHours)}h`}
                sub={estimatedHours > 0 ? `de ${Math.round(estimatedHours)}h est.` : undefined}
                highlight={
                  estimatedHours > 0 && totalHours > estimatedHours * 1.2 ? "red"
                  : estimatedHours > 0 && totalHours > estimatedHours * 1.05 ? "amber"
                  : "neutral"
                }
              />
            )}
            {budget > 0 && (
              <KPICol
                label="Budget"
                value={`${budgetUtilization.toFixed(0)}%`}
                sub={`quedan ${usd(budget - cost)}`}
                highlight={budgetUtilization >= 90 ? "red" : budgetUtilization >= 75 ? "amber" : "green"}
              />
            )}
          </div>
        )}

        {/* Non-ops: show hours only */}
        {!canSeeCosts && (totalHours > 0 || estimatedHours > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{Math.round(totalHours)}h</span>
            {estimatedHours > 0 && <span className="text-slate-400">de {Math.round(estimatedHours)}h estimadas</span>}
            {hoursDeviation !== 0 && estimatedHours > 0 && (
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                hoursDeviation > 20 ? "bg-red-50 text-red-600"
                : hoursDeviation > 5 ? "bg-amber-50 text-amber-600"
                : "bg-emerald-50 text-emerald-600"
              }`}>
                {hoursDeviation > 0 ? "+" : ""}{hoursDeviation.toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Budget burndown strip ── */}
      {canSeeCosts && budget > 0 && (
        <BudgetStrip cost={cost} budget={budget} utilization={budgetUtilization} />
      )}
    </div>
  );
}
