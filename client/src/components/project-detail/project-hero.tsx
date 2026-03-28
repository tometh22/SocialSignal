/**
 * Project Hero — dark header con gradient dinámico por salud, KPIs inline, budget burndown
 * El color del header refleja el estado de salud del proyecto.
 */
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import HealthScore, { computeHealthScore, healthLabel } from "./health-score";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(n: number) {
  if (!Number.isFinite(n)) return "—";
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
  prevMarkup?: number; // previous period markup for trend arrow
}

const STATUS_LABEL: Record<string, string> = {
  active: "Activo", completed: "Completado", cancelled: "Cancelado", "on-hold": "Pausado",
};

// ─── Budget Bar ───────────────────────────────────────────────────────────────

function BudgetBar({ used, total, utilization }: { used: number; total: number; utilization: number }) {
  const color =
    utilization >= 90 ? "bg-red-500"
    : utilization >= 75 ? "bg-amber-400"
    : "bg-emerald-500";
  const remaining = total - used;

  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] mb-1.5 text-slate-400">
        <span>Presupuesto</span>
        <span className={utilization >= 90 ? "text-red-400 font-bold" : "text-slate-300"}>
          {usd(used)} / {usd(total)} · {utilization.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]">
        <span className={utilization >= 90 ? "text-red-400 font-semibold" : utilization >= 75 ? "text-amber-400" : "text-slate-500"}>
          {utilization >= 90 ? "⚠ Budget casi agotado" : utilization >= 75 ? "Zona de atención" : "Budget disponible"}
        </span>
        <span className="text-slate-400">Quedan {usd(remaining)}</span>
      </div>
    </div>
  );
}

// ─── KPI Pill ─────────────────────────────────────────────────────────────────

function KPIPill({
  label, value, sub, highlight,
}: {
  label: string; value: string; sub?: string;
  highlight?: "green" | "red" | "amber" | "neutral";
}) {
  const textColor =
    highlight === "green"  ? "text-emerald-300"
    : highlight === "red"  ? "text-red-300"
    : highlight === "amber" ? "text-amber-300"
    : "text-white";

  return (
    <div className="flex flex-col items-center px-5 border-r border-white/10 last:border-0">
      <p className="text-[10px] text-white/40 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight mt-0.5 ${textColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/30 leading-tight">{sub}</p>}
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

  const info = healthLabel(score);

  // Dynamic gradient based on health
  const gradientClass =
    score >= 70 ? "from-slate-950 via-slate-900 to-emerald-950"
    : score >= 50 ? "from-slate-950 via-slate-900 to-slate-900"
    : score >= 30 ? "from-slate-950 via-slate-900 to-orange-950"
    : "from-slate-950 via-slate-900 to-red-950";

  const accentLine =
    score >= 70 ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent"
    : score >= 50 ? "bg-gradient-to-r from-amber-500 via-amber-400 to-transparent"
    : score >= 30 ? "bg-gradient-to-r from-orange-500 via-orange-400 to-transparent"
    : "bg-gradient-to-r from-red-500 via-red-400 to-transparent";

  const markupHighlight: "green" | "red" | "amber" =
    markup >= 2.5 ? "green" : markup >= 2.0 ? "amber" : "red";

  const markupTrend = prevMarkup != null && prevMarkup > 0
    ? markup - prevMarkup : null;

  const periodLabel = (() => {
    if (!period) return "";
    try {
      const [y, m] = period.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
    } catch { return period; }
  })();

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-white/5">
      {/* ── Accent line at top ── */}
      <div className={`h-0.5 w-full ${accentLine}`} />

      {/* ── Dark header ── */}
      <div className={`bg-gradient-to-br ${gradientClass} px-6 pt-5 pb-5`}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/active-projects">
            <button className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Proyectos
            </button>
          </Link>
          <span className="text-white/20">·</span>
          <span className="text-white/40 text-xs">{clientName}</span>
          {period && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-white/30 text-xs capitalize">{periodLabel}</span>
            </>
          )}
        </div>

        {/* Title row */}
        <div className="flex items-start gap-6">
          {/* Health gauge */}
          {canSeeCosts && (
            <div className="flex-shrink-0 mt-1">
              <HealthScore score={score} size="md" />
            </div>
          )}

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-sm mb-0.5 truncate">{clientName}</p>
            <h1 className="text-3xl font-bold text-white leading-tight truncate tracking-tight">
              {projectName}
            </h1>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* Status */}
              <span className="text-xs font-medium rounded-full px-3 py-1 bg-white/10 text-white/70 border border-white/10">
                {STATUS_LABEL[projectStatus] ?? projectStatus}
              </span>

              {/* Markup badge */}
              {canSeeCosts && markup > 0 && (
                <span className={`text-xs font-bold rounded-full px-3 py-1 border ${
                  markup >= 2.5
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : markup >= 2.0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse"
                }`}>
                  Markup {markup.toFixed(2)}x
                  {markupTrend != null && Math.abs(markupTrend) >= 0.1 && (
                    <span className={`ml-1.5 inline-flex items-center gap-0.5 ${markupTrend > 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {markupTrend > 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(markupTrend).toFixed(1)}x
                    </span>
                  )}
                </span>
              )}

              {/* Health label */}
              <span className={`text-xs font-semibold rounded-full px-3 py-1 border ${
                score >= 70 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
                : score >= 50 ? "bg-amber-500/15 text-amber-300 border-amber-500/20"
                : score >= 30 ? "bg-orange-500/15 text-orange-300 border-orange-500/20"
                : "bg-red-500/15 text-red-300 border-red-500/20"
              }`}>
                {info.text}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="mt-6 flex items-stretch overflow-x-auto border-t border-white/10 pt-4">
          {canSeeCosts && revenue > 0 && (
            <KPIPill label="Revenue" value={usd(revenue)} highlight="green" />
          )}
          {canSeeCosts && cost > 0 && (
            <KPIPill label="Costo" value={usd(cost)} highlight="neutral" />
          )}
          {canSeeCosts && Number.isFinite(margin) && (
            <KPIPill
              label="Margen"
              value={`${margin.toFixed(1)}%`}
              sub={revenue > 0 ? usd(revenue - cost) : undefined}
              highlight={margin >= 25 ? "green" : margin >= 10 ? "amber" : "red"}
            />
          )}
          <KPIPill
            label="Horas"
            value={`${totalHours.toFixed(0)}h`}
            sub={estimatedHours > 0 ? `de ${estimatedHours.toFixed(0)}h est.` : undefined}
            highlight={
              estimatedHours > 0 && totalHours > estimatedHours * 1.2 ? "red"
              : estimatedHours > 0 && totalHours > estimatedHours * 1.05 ? "amber"
              : "neutral"
            }
          />
          {canSeeCosts && markup > 0 && (
            <KPIPill
              label="Markup"
              value={`${markup.toFixed(2)}x`}
              sub="meta: 2.5x"
              highlight={markupHighlight}
            />
          )}
          {budget > 0 && canSeeCosts && (
            <KPIPill
              label="Budget"
              value={`${budgetUtilization.toFixed(0)}%`}
              sub={`quedan ${usd(budget - cost)}`}
              highlight={budgetUtilization >= 90 ? "red" : budgetUtilization >= 75 ? "amber" : "green"}
            />
          )}
        </div>
      </div>

      {/* ── Budget burndown strip (ops only) ── */}
      {canSeeCosts && budget > 0 && (
        <div className="bg-slate-900/80 backdrop-blur px-6 py-3 border-t border-white/5">
          <BudgetBar used={cost} total={budget} utilization={budgetUtilization} />
        </div>
      )}
    </div>
  );
}
