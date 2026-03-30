/**
 * Project Hero — redesigned with individual KPI cards, gradient health accent,
 * prominent budget bar, and sticky scroll header support.
 */
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Activity, DollarSign, Clock, Target, PieChart, ArrowUpRight, ArrowDownRight } from "lucide-react";
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

// ─── KPI Card (individual card style) ────────────────────────────────────────

function KPICard({
  icon, label, value, sub, highlight, trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "amber" | "red" | "neutral";
  trend?: { value: string; positive: boolean } | null;
}) {
  const borderColor =
    highlight === "green"  ? "border-emerald-200 bg-emerald-50/30"
    : highlight === "amber" ? "border-amber-200 bg-amber-50/30"
    : highlight === "red"   ? "border-red-200 bg-red-50/30"
    : "border-slate-200 bg-white";

  const valColor =
    highlight === "green"  ? "text-emerald-700"
    : highlight === "amber" ? "text-amber-600"
    : highlight === "red"   ? "text-red-600"
    : "text-slate-900";

  const iconBg =
    highlight === "green"  ? "bg-emerald-100 text-emerald-600"
    : highlight === "amber" ? "bg-amber-100 text-amber-600"
    : highlight === "red"   ? "bg-red-100 text-red-600"
    : "bg-slate-100 text-slate-500";

  return (
    <div className={`rounded-xl border ${borderColor} px-4 py-3 min-w-[120px] flex-1 transition-all hover:shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-xl font-bold tabular-nums leading-tight ${valColor}`}>{value}</p>
        {trend && (
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${trend.positive ? "text-emerald-600" : "text-red-500"}`}>
            {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

// ─── Budget bar (enhanced - more prominent) ──────────────────────────────────

function BudgetStrip({
  cost, budget, utilization,
}: {
  cost: number; budget: number; utilization: number;
}) {
  const barColor =
    utilization >= 90 ? "bg-gradient-to-r from-red-400 to-red-500"
    : utilization >= 75 ? "bg-gradient-to-r from-amber-400 to-amber-500"
    : "bg-gradient-to-r from-emerald-400 to-emerald-500";

  const textColor =
    utilization >= 90 ? "text-red-600 font-semibold"
    : utilization >= 75 ? "text-amber-600"
    : "text-slate-500";

  const bgTrack =
    utilization >= 90 ? "bg-red-100"
    : utilization >= 75 ? "bg-amber-100"
    : "bg-slate-200";

  return (
    <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">Presupuesto</span>
        <span className={`text-xs ${textColor}`}>
          {usd(cost)} / {usd(budget)} · {utilization.toFixed(0)}%
        </span>
      </div>
      <div className={`h-3 ${bgTrack} rounded-full overflow-hidden relative`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
        {/* Percentage label inside bar when enough space */}
        {utilization >= 20 && (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80 mix-blend-normal">
            {utilization.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-[11px] font-medium ${
          utilization >= 90 ? "text-red-500" : utilization >= 75 ? "text-amber-500" : "text-emerald-500"
        }`}>
          {utilization >= 90 ? "Budget casi agotado" : utilization >= 75 ? "Zona de atención" : "Budget disponible"}
        </span>
        <span className="text-[11px] text-slate-400 font-medium">Quedan {usd(budget - cost)}</span>
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

// ─── Sticky Header (appears on scroll) ──────────────────────────────────────

function StickyHeader({
  visible, projectName, score, markup, canSeeCosts,
}: {
  visible: boolean;
  projectName: string;
  score: number;
  markup: number;
  canSeeCosts: boolean;
}) {
  const dotColor =
    score >= 70 ? "bg-emerald-500"
    : score >= 50 ? "bg-amber-400"
    : score >= 30 ? "bg-orange-500"
    : "bg-red-500";

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
    }`}>
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/active-projects">
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <h2 className="text-sm font-bold text-slate-800 truncate max-w-[300px]">{projectName}</h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dotColor} ${score < 50 ? "animate-pulse" : ""}`} />
              <span className="text-xs text-slate-500 font-medium">{score}/100</span>
            </div>
          </div>
          {canSeeCosts && markup > 0 && (
            <span className={`text-xs font-semibold rounded-md px-2.5 py-1 border ${
              markup >= 2.5 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : markup >= 2.0 ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-red-50 text-red-700 border-red-200"
            }`}>
              Markup {markup.toFixed(2)}x
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

  // Gradient accent based on health score
  const gradientBg =
    score >= 70 ? "from-emerald-500/5 via-transparent to-transparent"
    : score >= 50 ? "from-amber-500/5 via-transparent to-transparent"
    : score >= 30 ? "from-orange-500/5 via-transparent to-transparent"
    : "from-red-500/5 via-transparent to-transparent";

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
    <>
      <StickyHeader
        visible={showSticky}
        projectName={projectName}
        score={score}
        markup={markup}
        canSeeCosts={canSeeCosts}
      />

      <div
        ref={heroRef}
        className={`bg-gradient-to-r ${gradientBg} bg-white rounded-2xl border border-slate-200 border-l-4 ${leftBorder} shadow-sm overflow-hidden`}
      >
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
            <div className="flex-1 min-w-0">
              {hasClient && (
                <p className="text-xs font-medium text-slate-400 mb-0.5">{clientName}</p>
              )}
              <h1 className="text-[26px] font-bold text-slate-900 leading-tight tracking-tight truncate">
                {projectName}
              </h1>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className={`text-[11px] font-medium rounded-md px-2.5 py-1 border ${STATUS_STYLES[projectStatus] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {STATUS_LABEL[projectStatus] ?? projectStatus}
                </span>
                {canSeeCosts && markup > 0 && (
                  <span className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border inline-flex items-center gap-1.5 ${
                    markup >= 2.5 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : markup >= 2.0 ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    Markup {markup.toFixed(2)}x
                    {markupTrend != null && Math.abs(markupTrend) >= 0.1 && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${markupTrend > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {markupTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {markupTrend > 0 ? "+" : ""}{markupTrend.toFixed(1)}x
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            {canSeeCosts && <HealthBadge score={score} />}
          </div>

          {/* ── KPI Cards Grid ── */}
          {canSeeCosts && (
            <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {revenue > 0 && (
                <KPICard
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  label="Revenue"
                  value={usd(revenue)}
                  highlight="green"
                />
              )}
              {cost > 0 && (
                <KPICard
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  label="Costo"
                  value={usd(cost)}
                  sub={revenue === 0 ? "sin facturación" : undefined}
                  highlight="neutral"
                />
              )}
              {markup > 0 && (
                <KPICard
                  icon={<Target className="h-3.5 w-3.5" />}
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
              {revenue > 0 && (
                <KPICard
                  icon={<PieChart className="h-3.5 w-3.5" />}
                  label="Margen"
                  value={`${margin.toFixed(1)}%`}
                  sub={profit !== 0 ? usd(profit) : undefined}
                  highlight={margin >= 25 ? "green" : margin >= 10 ? "amber" : "red"}
                />
              )}
              {(totalHours > 0 || estimatedHours > 0) && (
                <KPICard
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Horas"
                  value={`${Math.round(totalHours)}h`}
                  sub={estimatedHours > 0 ? `de ${Math.round(estimatedHours)}h est.` : undefined}
                  highlight={estimatedHours > 0 && totalHours > estimatedHours * 1.2 ? "red" : estimatedHours > 0 && totalHours > estimatedHours * 1.05 ? "amber" : "neutral"}
                />
              )}
              {budget > 0 && (
                <KPICard
                  icon={<Target className="h-3.5 w-3.5" />}
                  label="Budget"
                  value={`${budgetUtilization.toFixed(0)}%`}
                  sub={`quedan ${usd(budget - cost)}`}
                  highlight={budgetUtilization >= 90 ? "red" : budgetUtilization >= 75 ? "amber" : "green"}
                />
              )}
            </div>
          )}

          {!canSeeCosts && (totalHours > 0 || estimatedHours > 0) && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-600">
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
