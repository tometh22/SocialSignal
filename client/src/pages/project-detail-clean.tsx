/**
 * Project Intelligence View — redesigned with improved UX
 * Features: enhanced P&L, collapsible sections, fade-in animations, skeleton loading.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { AlertTriangle, DollarSign, BarChart3, TrendingUp, Target, ChevronDown, ListTodo, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useCompleteProjectData } from "@/hooks/useCompleteProjectData";
import { toProjectVM } from "@/selectors/projectVM";
import { usePermissions } from "@/hooks/use-permissions";
import ProjectTaskList from "@/components/tasks/ProjectTaskList";

import ProjectHero   from "@/components/project-detail/project-hero";
import AICopilot     from "@/components/project-detail/ai-copilot";
import TeamPerformance from "@/components/project-detail/team-performance";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, prefix = "$") =>
  n == null || !Number.isFinite(n) ? "—"
  : `${prefix}${Math.abs(Math.round(n)).toLocaleString("es-AR")}`;

const fmtPct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)}%`;

const fmtHours = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)}h`;

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title, icon, defaultOpen = true, children, badge,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50 hover:bg-slate-100/60 transition-colors"
      >
        {icon}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {badge && <div className="ml-1">{badge}</div>}
        <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="animate-slideDown">{children}</div>}
    </div>
  );
}

// ─── P&L Breakdown (enhanced with waterfall-style) ───────────────────────────

function PLBreakdown({
  revenue, cost, budget, budgetUtilization, totalHours, markup,
}: {
  revenue: number; cost: number; budget: number; budgetUtilization: number;
  totalHours: number; markup: number;
}) {
  const profit    = revenue - cost;
  const burnRate  = totalHours > 0 ? cost / totalHours : 0;
  const margin    = revenue > 0 ? (profit / revenue) * 100 : null;
  const maxVal    = Math.max(revenue, cost, 1);
  const noRevenue = revenue === 0 && cost > 0;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-400" /> P&L del Proyecto
        </h3>
        {noRevenue && (
          <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 font-medium">
            Sin facturación registrada
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Waterfall-style visualization */}
        <div className="space-y-3">
          {/* Revenue */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm text-slate-500 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                Revenue (venta)
              </span>
              <span className={`text-base font-bold tabular-nums ${revenue > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                {revenue > 0 ? fmt(revenue) : "Pendiente"}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700" style={{ width: `${(revenue / maxVal) * 100}%` }} />
            </div>
          </div>

          {/* Cost */}
          {cost > 0 && (
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm text-slate-500 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-400 inline-block" />
                  Costos directos
                </span>
                <span className="text-base font-bold tabular-nums text-red-600">{fmt(cost)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-red-300 to-red-400 transition-all duration-700" style={{ width: `${(cost / maxVal) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Profit result bar */}
          {revenue > 0 && (
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm text-slate-500 flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded inline-block ${profit >= 0 ? "bg-blue-500" : "bg-orange-500"}`} />
                  Resultado bruto
                </span>
                <span className={`text-base font-bold tabular-nums ${profit >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                  {fmt(profit)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${profit >= 0 ? "bg-gradient-to-r from-blue-300 to-blue-500" : "bg-gradient-to-r from-orange-300 to-orange-500"}`}
                     style={{ width: `${(Math.abs(profit) / maxVal) * 100}%` }} />
              </div>
            </div>
          )}

          {/* No revenue result */}
          {revenue === 0 && cost > 0 && (
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-semibold text-slate-700">Resultado bruto</span>
              <span className="text-xl font-bold tabular-nums text-slate-400">—</span>
            </div>
          )}
        </div>

        {/* Secondary KPIs grid */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5">
          {[
            { label: "Markup",       value: markup > 0 ? `${markup.toFixed(2)}x` : "—",
              color: markup >= 2.5 ? "border-l-emerald-500" : markup >= 2.0 ? "border-l-amber-400" : markup > 0 ? "border-l-red-500" : "border-l-slate-200" },
            { label: "Margen",       value: margin != null ? fmtPct(margin) : "—",
              color: (margin ?? 0) >= 25 ? "border-l-emerald-500" : (margin ?? 0) >= 10 ? "border-l-amber-400" : "border-l-slate-200" },
            { label: "Burn rate",    value: burnRate > 0 ? `${fmt(burnRate)}/h` : "—",
              color: "border-l-slate-200" },
            { label: "Budget usado", value: budget > 0 ? fmtPct(budgetUtilization) : "Sin budget",
              color: budgetUtilization >= 90 ? "border-l-red-500" : budgetUtilization >= 75 ? "border-l-amber-400" : "border-l-emerald-500" },
          ].map((kpi, i) => (
            <div key={i} className={`rounded-lg bg-slate-50 border border-slate-100 border-l-4 ${kpi.color} px-3 py-2.5`}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5 tabular-nums">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Actionable empty state for no-revenue */}
        {noRevenue && (
          <div className="mt-3 rounded-xl bg-amber-50/50 border border-amber-200/50 px-4 py-3 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-700">Sin revenue registrado para este proyecto</p>
              <p className="text-[11px] text-amber-600/70 mt-0.5">Registrar la facturación para calcular markup y margen.</p>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-400 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quotation Info ───────────────────────────────────────────────────────────

function QuotationInfo({ quotation }: { quotation: any }) {
  if (!quotation) return null;
  const fields = [
    { label: "Precio cotizado", value: fmt(quotation.totalAmount) },
    { label: "Costo base",      value: fmt(quotation.baseCost) },
    { label: "Horas estimadas", value: fmtHours(quotation.estimatedHours) },
    { label: "Tipo",            value: quotation.quotationType ?? "—" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-500" /> Cotización
        </h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {fields.map((f, i) => (
          <div key={i}>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">{f.label}</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5 capitalize">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Loading Skeleton (enhanced) ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Hero skeleton */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-3 w-1 bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-200 rounded" />
          </div>
          <div className="h-7 w-48 bg-slate-200 rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-slate-100 rounded-md" />
            <div className="h-6 w-24 bg-slate-100 rounded-md" />
          </div>
          <div className="pt-4 border-t border-slate-100 grid grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 px-3 py-3">
                <div className="h-3 w-12 bg-slate-100 rounded mb-2" />
                <div className="h-6 w-16 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-12 bg-slate-50 border-t border-slate-100" />
      </div>

      {/* AI Copilot skeleton */}
      <div className="rounded-2xl border border-slate-200 animate-pulse">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <div className="h-7 w-7 bg-slate-200 rounded-lg" />
          <div className="h-4 w-20 bg-slate-200 rounded" />
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailClean() {
  const [location] = useLocation();
  const projectId = location.split("/")[2];
  const pid = parseInt(projectId || "0", 10);
  const { isOperations } = usePermissions();
  const canSeeCosts = isOperations;

  const urlParams = new URLSearchParams(window.location.search);
  const periodFromUrl = urlParams.get("period") ?? undefined;

  const { data: unifiedData, isLoading, error } = useCompleteProjectData(
    pid, "current_month", periodFromUrl, "operativa"
  );

  if (isLoading) return <LoadingSkeleton />;

  if (error || !unifiedData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No se pudo cargar el proyecto</h3>
          <p className="text-sm text-slate-500">
            {(error as Error)?.message || "Verificá que el proyecto exista y tenga datos cargados."}
          </p>
          <Link href="/active-projects">
            <Button variant="outline" size="sm">← Volver a proyectos</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Extract data ──────────────────────────────────────────────────────────
  const vm = toProjectVM(unifiedData);
  const q  = unifiedData.quotation;
  const a  = unifiedData.actuals;
  const m  = unifiedData.metrics;

  const revenue          = vm.revenueDisplay ?? 0;
  const cost             = vm.costDisplay ?? 0;
  const markup           = vm.markup ?? 0;
  const margin           = vm.margin ?? 0;
  const totalHours       = vm.totalHours ?? 0;
  const estimatedHours   = vm.estimatedHours ?? q?.estimatedHours ?? 0;
  const budget           = q?.totalAmount ?? unifiedData.project?.budget ?? 0;
  const budgetUtil       = m?.budgetUtilization ?? (budget > 0 ? (cost / budget) * 100 : 0);
  const hoursDeviation   = m?.hoursDeviation ?? (estimatedHours > 0 ? ((totalHours - estimatedHours) / estimatedHours) * 100 : 0);
  const costDeviation    = m?.costDeviation ?? 0;

  const projectName  = q?.projectName ?? unifiedData.project?.name ?? "Proyecto";
  const clientName   = (unifiedData as any).client?.name ?? "—";
  const projectStatus = unifiedData.project?.status ?? "active";

  // Team — merge rankings efficiency scores into teamBreakdown
  const rankingMap = new Map(
    (unifiedData.rankings?.economicMetrics ?? []).map((r: any) => [r.personnelId, r])
  );
  const enrichedTeam = (a?.teamBreakdown ?? []).map((m: any) => ({
    ...m,
    efficiencyScore: rankingMap.get(m.personnelId)?.unifiedScore ?? undefined,
    performanceColor: rankingMap.get(m.personnelId)?.performanceColor ?? undefined,
    costUSD: m.costUSD ?? m.cost ?? 0,
  }));

  // Fallback: if vm metrics are 0 but team has data, use team aggregates
  const teamTotalCost  = enrichedTeam.reduce((s: number, m: any) => s + (m.costUSD ?? 0), 0);
  const teamTotalHours = enrichedTeam.reduce((s: number, m: any) => s + (m.hoursAsana ?? m.hours ?? 0), 0);
  const effectiveCost  = cost  > 0 ? cost  : teamTotalCost;
  const effectiveHours = totalHours > 0 ? totalHours : teamTotalHours;
  const effectiveMarkup = markup > 0 ? markup : (revenue > 0 && effectiveCost > 0 ? revenue / effectiveCost : 0);
  const effectiveMargin = effectiveMarkup > 0 ? ((revenue - effectiveCost) / revenue) * 100 : margin;
  const effectiveBudgetUtil = budget > 0 && effectiveCost > 0 ? (effectiveCost / budget) * 100 : budgetUtil;

  return (
    <div className="w-full px-3 py-4 space-y-4">

      {/* ── Hero Header ───────────────────────────────────────────────── */}
      <div className="animate-fadeIn">
        <ProjectHero
          clientName={clientName}
          projectName={projectName}
          projectStatus={projectStatus}
          period={periodFromUrl}
          revenue={revenue}
          cost={effectiveCost}
          markup={effectiveMarkup}
          margin={effectiveMargin}
          totalHours={effectiveHours}
          estimatedHours={estimatedHours}
          budget={budget}
          budgetUtilization={effectiveBudgetUtil}
          hoursDeviation={hoursDeviation}
          canSeeCosts={canSeeCosts}
          prevMarkup={unifiedData.previousPeriod?.metrics?.markup ?? undefined}
        />
      </div>

      {/* ── AI Copilot (ops only) ──────────────────────────────────────── */}
      {canSeeCosts && (effectiveCost > 0 || budget > 0) && (
        <div className="animate-fadeIn" style={{ animationDelay: "100ms" }}>
          <AICopilot
            revenue={revenue}
            cost={effectiveCost}
            markup={effectiveMarkup}
            margin={effectiveMargin}
            budget={budget}
            budgetUtilization={effectiveBudgetUtil}
            totalHours={effectiveHours}
            estimatedHours={estimatedHours}
            hoursDeviation={hoursDeviation}
            costDeviation={costDeviation}
            teamBreakdown={enrichedTeam}
            previousPeriod={unifiedData.previousPeriod}
            period={periodFromUrl}
          />
        </div>
      )}

      {/* ── Main content grid ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4 animate-fadeIn" style={{ animationDelay: "200ms" }}>
        {/* Team Performance */}
        <TeamPerformance
          team={enrichedTeam}
          canSeeCosts={canSeeCosts}
        />

        {/* P&L + Quotation (ops only) */}
        {canSeeCosts ? (
          <div className="space-y-5">
            <PLBreakdown
              revenue={revenue}
              cost={effectiveCost}
              budget={budget}
              budgetUtilization={effectiveBudgetUtil}
              totalHours={effectiveHours}
              markup={effectiveMarkup}
            />
            <QuotationInfo quotation={q} />
          </div>
        ) : (
          /* Non-ops: show hours summary only */
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Resumen
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                { label: "Horas totales",   value: fmtHours(effectiveHours) },
                { label: "Horas estimadas", value: fmtHours(estimatedHours) },
                { label: "Desvío",          value: estimatedHours > 0 ? `${hoursDeviation > 0 ? "+" : ""}${hoursDeviation.toFixed(0)}%` : "—" },
                { label: "Equipo",          value: `${enrichedTeam.length} personas` },
              ].map((kpi, i) => (
                <div key={i} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-base font-semibold text-slate-800 mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Tasks (collapsible) ────────────────────────────────────────── */}
      <div style={{ animationDelay: "300ms" }}>
        <CollapsibleSection
          title="Tareas"
          icon={<ListTodo className="h-4 w-4 text-slate-500" />}
          defaultOpen={true}
        >
          <div className="p-1">
            <ProjectTaskList projectId={pid} />
          </div>
        </CollapsibleSection>
      </div>

    </div>
  );
}
