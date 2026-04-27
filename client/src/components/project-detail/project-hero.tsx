/**
 * Project Hero — V3: Hero metric at 2x size, compact supporting KPIs,
 * no duplicate HealthBadge, white card on gray page background.
 */
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Target, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
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

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  "on-hold": "bg-amber-50 text-amber-700 border-amber-200",
};

// ─── Hero Metric (2x size, primary anchor) ───────────────────────────────────

function HeroMetric({ score, label, grade }: { score: number; label: string; grade: string }) {
  const ringColor =
    score >= 70 ? "text-emerald-500"
    : score >= 50 ? "text-amber-400"
    : score >= 30 ? "text-orange-500"
    : "text-red-500";

  const bgColor =
    score >= 70 ? "bg-emerald-50 border-emerald-200"
    : score >= 50 ? "bg-amber-50 border-amber-200"
    : score >= 30 ? "bg-orange-50 border-orange-200"
    : "bg-red-50 border-red-200";

  return (
    <div className={`rounded-xl border ${bgColor} px-4 py-3 min-w-[130px] flex flex-col items-center justify-center`}>
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            className={ringColor}
            strokeDasharray={`${score * 0.94} 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className="text-lg font-bold text-slate-900 tabular-nums">{score}</span>
      </div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1.5">{label}</p>
      <p className="text-[11px] font-semibold text-slate-600">Grado {grade}</p>
    </div>
  );
}

// ─── Supporting KPI Card ─────────────────────────────────────────────────────

function KPICard({
  label, value, sub, highlight, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "amber" | "red" | "neutral";
  trend?: { value: string; positive: boolean } | null;
}) {
  const borderColor =
    highlight === "green"  ? "border-l-emerald-500"
    : highlight === "amber" ? "border-l-amber-400"
    : highlight === "red"   ? "border-l-red-500"
    : "border-l-slate-200";

  const valColor =
    highlight === "green"  ? "text-emerald-700"
    : highlight === "amber" ? "text-amber-600"
    : highlight === "red"   ? "text-red-600"
    : "text-slate-900";

  return (
    <div className={`rounded-lg bg-slate-50 border border-slate-100 border-l-4 ${borderColor} px-4 py-3 flex-1 min-w-[140px] max-w-[240px]`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <p className={`text-lg font-bold tabular-nums leading-tight ${valColor}`}>{value}</p>
        {trend && (
          <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trend.positive ? "text-emerald-600" : "text-red-500"}`}>
            {trend.positive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
            {trend.value}
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Budget bar ──────────────────────────────────────────────────────────────

function BudgetStrip({ cost, budget, utilization }: { cost: number; budget: number; utilization: number }) {
  const barColor =
    utilization >= 90 ? "bg-gradient-to-r from-red-400 to-red-500"
    : utilization >= 75 ? "bg-gradient-to-r from-amber-400 to-amber-500"
    : "bg-gradient-to-r from-emerald-400 to-emerald-500";

  const bgTrack = utilization >= 90 ? "bg-red-100" : utilization >= 75 ? "bg-amber-100" : "bg-slate-200";

  return (
    <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-400">Presupuesto</span>
        <span className="text-[11px] text-slate-500">
          {usd(cost)} / {usd(budget)} · <span className="font-semibold">{utilization.toFixed(0)}%</span>
        </span>
      </div>
      <div className={`h-2.5 ${bgTrack} rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(100, utilization)}%` }} />
      </div>
      <div className="flex items-center justify-end mt-1">
        <span className="text-[10px] text-slate-400">Quedan {usd(budget - cost)}</span>
      </div>
    </div>
  );
}

// ─── Sticky Header (appears on scroll) ──────────────────────────────────────

function StickyHeader({
  visible, projectName, score, markup, canSeeCosts,
}: {
  visible: boolean; projectName: string; score: number; markup: number; canSeeCosts: boolean;
}) {
  const dotColor =
    score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : score >= 30 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
    }`}>
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="w-full px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/active-projects">
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <h2 className="text-sm font-bold text-slate-800 truncate max-w-[300px]">{projectName}</h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <span className="text-xs text-slate-500 font-medium">{score}/100</span>
            </div>
          </div>
          {canSeeCosts && markup > 0 && (
            <span className={`text-xs font-semibold rounded-md px-2 py-0.5 border ${
              markup >= 2.5 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : markup >= 2.0 ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {markup.toFixed(2)}x
            </span>
          )}
        </div>
      </div>
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

  const heroRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-60px 0px 0px 0px" }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  const score = computeHealthScore({
    markup,
    budgetUtilization,
    hoursDeviation: Math.max(0, hoursDeviation),
    hasBudget: budget > 0,
    hasHoursEstimate: estimatedHours > 0,
  });

  const leftBorder =
    score >= 70 ? "border-l-emerald-500"
    : score >= 50 ? "border-l-amber-400"
    : score >= 30 ? "border-l-orange-500"
    : "border-l-red-500";

  const markupTrend = prevMarkup != null && prevMarkup > 0 ? markup - prevMarkup : null;

  const periodLabel = (() => {
    if (!period) return "";
    try {
      const [y, m] = period.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
    } catch { return period; }
  })();

  const hasClient = clientName && clientName !== "—";

  return (
    <>
      <StickyHeader visible={showSticky} projectName={projectName} score={score} markup={markup} canSeeCosts={canSeeCosts} />

      <div ref={heroRef} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${leftBorder} shadow-sm overflow-hidden`}>
        <div className="px-4 pt-3 pb-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link href="/active-projects">
                  <button className="text-slate-400 hover:text-slate-700 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                </Link>
                {hasClient && <p className="text-xs font-medium text-slate-400 truncate max-w-[200px]">{clientName}</p>}
                {period && (
                  <>
                    <span className="text-slate-200 text-xs">·</span>
                    <span className="text-slate-400 text-xs capitalize">{periodLabel}</span>
                  </>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight truncate">{projectName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[11px] font-medium rounded-md px-2 py-0.5 border ${STATUS_STYLES[projectStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {STATUS_LABEL[projectStatus] ?? projectStatus}
                </span>
              </div>
            </div>
          </div>

          {/* KPI row: Hero metric + supporting cards */}
          {canSeeCosts && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-start">
              {/* Hero metric — Health Score */}
              <HeroMetric score={score} label={healthLabel(score).text} grade={healthGrade(score)} />

              {/* Divider */}
              <div className="hidden sm:block self-stretch border-r border-slate-200" />

              {/* Supporting KPIs — max 3 */}
              <div className="flex flex-wrap gap-2 flex-1">
                {markup > 0 && (
                  <KPICard
                    label="Markup"
                    value={`${markup.toFixed(2)}x`}
                    sub="meta: 2.5x"
                    highlight={markup >= 2.5 ? "green" : markup >= 2.0 ? "amber" : "red"}
                    trend={markupTrend != null && Math.abs(markupTrend) >= 0.1 ? {
                      value: `${markupTrend > 0 ? "+" : ""}${markupTrend.toFixed(1)}x`,
                      positive: markupTrend > 0,
                    } : null}
                  />
                )}
                {(totalHours > 0 || estimatedHours > 0) && (
                  <KPICard
                    label="Horas"
                    value={`${Math.round(totalHours)}h`}
                    sub={estimatedHours > 0 ? `de ${Math.round(estimatedHours)}h est.` : undefined}
                    highlight={estimatedHours > 0 && totalHours > estimatedHours * 1.2 ? "red" : estimatedHours > 0 && totalHours > estimatedHours * 1.05 ? "amber" : "neutral"}
                  />
                )}
                {budget > 0 && (
                  <KPICard
                    label="Budget"
                    value={`${budgetUtilization.toFixed(0)}%`}
                    sub={`quedan ${usd(budget - cost)}`}
                    highlight={budgetUtilization >= 90 ? "red" : budgetUtilization >= 75 ? "amber" : "green"}
                  />
                )}
              </div>
            </div>
          )}

          {!canSeeCosts && (totalHours > 0 || estimatedHours > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{Math.round(totalHours)}h</span>
              {estimatedHours > 0 && <span className="text-slate-400">de {Math.round(estimatedHours)}h estimadas</span>}
              {hoursDeviation !== 0 && estimatedHours > 0 && (
                <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${hoursDeviation > 20 ? "bg-red-50 text-red-600" : hoursDeviation > 5 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {hoursDeviation > 0 ? "+" : ""}{hoursDeviation.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        {canSeeCosts && budget > 0 && (
          <BudgetStrip cost={cost} budget={budget} utilization={budgetUtilization} />
        )}
      </div>
    </>
  );
}
