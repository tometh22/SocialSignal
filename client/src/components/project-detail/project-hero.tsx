/**
 * Project Hero — dark header with inline KPIs + budget burndown strip
 */
import { ArrowLeft } from "lucide-react";
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
}

const STATUS_LABEL: Record<string, string> = {
  active: "Activo", completed: "Completado", cancelled: "Cancelado", "on-hold": "Pausado",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  completed: "bg-blue-500/20     text-blue-300     border-blue-500/30",
  cancelled: "bg-red-500/20      text-red-300      border-red-500/30",
  "on-hold": "bg-amber-500/20   text-amber-300    border-amber-500/30",
};

// ─── Budget Bar ───────────────────────────────────────────────────────────────

function BudgetBar({ used, total, utilization }: { used: number; total: number; utilization: number }) {
  const color =
    utilization >= 90 ? "bg-red-500"
    : utilization >= 75 ? "bg-amber-400"
    : "bg-emerald-500";

  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] mb-1.5 text-slate-400">
        <span>Budget consumido</span>
        <span className={utilization >= 90 ? "text-red-400 font-bold" : "text-slate-300"}>
          {usd(used)} / {usd(total)} · {utilization.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
      </div>
      {utilization >= 75 && (
        <p className={`text-[10px] mt-1 ${utilization >= 90 ? "text-red-400" : "text-amber-400"}`}>
          {utilization >= 90
            ? `⚠ Budget casi agotado — quedan ${usd(total - used)}`
            : `Quedan ${usd(total - used)} de presupuesto`}
        </p>
      )}
    </div>
  );
}

// ─── KPI Pill ─────────────────────────────────────────────────────────────────

function KPIPill({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "red" | "amber" }) {
  const textColor =
    highlight === "green" ? "text-emerald-300"
    : highlight === "red" ? "text-red-300"
    : highlight === "amber" ? "text-amber-300"
    : "text-white";

  return (
    <div className="text-center px-4 border-r border-slate-700 last:border-0">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-base font-bold tabular-nums leading-tight mt-0.5 ${textColor}`}>{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectHero(props: ProjectHeroProps) {
  const {
    clientName, projectName, projectStatus, period,
    revenue, cost, markup, margin, totalHours, estimatedHours,
    budget, budgetUtilization, hoursDeviation, canSeeCosts,
  } = props;

  const score = computeHealthScore({
    markup,
    budgetUtilization,
    hoursDeviation: Math.max(0, hoursDeviation),
    hasBudget: budget > 0,
    hasHoursEstimate: estimatedHours > 0,
  });

  const info = healthLabel(score);
  const markupHighlight: "green" | "red" | "amber" =
    markup >= 2.5 ? "green" : markup >= 2.0 ? "amber" : "red";

  const periodLabel = (() => {
    if (!period) return "";
    try {
      const [y, m] = period.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "short", year: "numeric" });
    } catch { return period; }
  })();

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-800">
      {/* ── Dark header ── */}
      <div className="bg-slate-950 px-6 pt-5 pb-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Link href="/active-projects">
            <button className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Proyectos
            </button>
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-400 text-xs">{clientName}</span>
          {period && (
            <>
              <span className="text-slate-700">/</span>
              <span className="text-slate-500 text-xs capitalize">{periodLabel}</span>
            </>
          )}
        </div>

        {/* Title row */}
        <div className="flex items-start gap-5">
          {/* Health gauge */}
          {canSeeCosts && (
            <div className="flex-shrink-0">
              <HealthScore score={score} size="md" />
            </div>
          )}

          {/* Project name + status */}
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-sm mb-0.5">{clientName}</p>
            <h1 className="text-2xl font-bold text-white leading-tight truncate">{projectName}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${STATUS_COLORS[projectStatus] ?? STATUS_COLORS.active}`}>
                {STATUS_LABEL[projectStatus] ?? projectStatus}
              </span>
              {canSeeCosts && (
                <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${
                  markup >= 2.5 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : markup >= 2.0 ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-red-500/15 text-red-300 border-red-500/30"
                }`}>
                  {markup > 0 ? `Markup ${markup.toFixed(1)}x` : "Sin markup"}
                </span>
              )}
              <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${info.color.replace("text-", "bg-").replace("600", "500/15")} ${info.color} border-current/30`}>
                {info.text}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="mt-5 flex items-center overflow-x-auto pb-1">
          {canSeeCosts && <KPIPill label="Revenue" value={usd(revenue)} highlight="green" />}
          {canSeeCosts && <KPIPill label="Costo" value={usd(cost)} />}
          {canSeeCosts && (
            <KPIPill
              label="Margen"
              value={Number.isFinite(margin) ? `${margin.toFixed(1)}%` : "—"}
              highlight={margin >= 20 ? "green" : margin >= 10 ? "amber" : "red"}
            />
          )}
          <KPIPill
            label="Horas"
            value={`${totalHours.toFixed(0)}h${estimatedHours > 0 ? ` / ${estimatedHours.toFixed(0)}h` : ""}`}
          />
          {canSeeCosts && markup > 0 && (
            <KPIPill
              label="Markup"
              value={`${markup.toFixed(2)}x`}
              highlight={markupHighlight}
            />
          )}
        </div>
      </div>

      {/* ── Budget burndown strip (ops only) ── */}
      {canSeeCosts && budget > 0 && (
        <div className="bg-slate-900 px-6 py-3">
          <BudgetBar used={cost} total={budget} utilization={budgetUtilization} />
        </div>
      )}
    </div>
  );
}
