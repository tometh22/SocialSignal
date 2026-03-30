/**
 * Project Intelligence View — V3 redesign
 * Gray page background, section reordering (tasks elevated), sticky section nav,
 * three-level emphasis (LOUD/NORMAL/QUIET), muted section headers.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { AlertTriangle, BarChart3, TrendingUp, ListTodo, LayoutDashboard, Users, Receipt } from "lucide-react";
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

// ─── Sticky Section Nav ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "section-overview", label: "Overview", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { id: "section-tareas", label: "Tareas", icon: <ListTodo className="h-3.5 w-3.5" /> },
  { id: "section-finanzas", label: "Finanzas", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "section-equipo", label: "Equipo", icon: <Users className="h-3.5 w-3.5" /> },
];

function SectionNav({ activeSection }: { activeSection: string }) {
  return (
    <nav className="sticky top-0 z-40 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200/80 -mx-3 px-3">
      <div className="flex gap-1 py-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── P&L Breakdown ───────────────────────────────────────────────────────────

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
    <div>
      <div className="p-4 space-y-3">
        {/* Revenue */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
              Revenue
            </span>
            <span className={`text-base font-bold tabular-nums ${revenue > 0 ? "text-emerald-700" : "text-slate-400"}`}>
              {revenue > 0 ? fmt(revenue) : "Pendiente"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700" style={{ width: `${(revenue / maxVal) * 100}%` }} />
          </div>
        </div>

        {/* Cost */}
        {cost > 0 && (
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm text-slate-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-red-400 inline-block" />
                Costos directos
              </span>
              <span className="text-base font-bold tabular-nums text-red-600">{fmt(cost)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-300 to-red-400 transition-all duration-700" style={{ width: `${(cost / maxVal) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Profit */}
        {revenue > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium text-slate-700">Resultado bruto</span>
              <span className={`text-lg font-bold tabular-nums ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {fmt(profit)}
              </span>
            </div>
          </div>
        )}

        {revenue === 0 && cost > 0 && (
          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-sm font-medium text-slate-700">Resultado bruto</span>
            <span className="text-lg font-bold tabular-nums text-slate-300">—</span>
          </div>
        )}

        {/* No-revenue notice — clean and minimal */}
        {noRevenue && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-sm text-slate-400">Pendiente de facturación</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quotation Info (QUIET treatment) ────────────────────────────────────────

function QuotationInfo({ quotation }: { quotation: any }) {
  if (!quotation) return null;
  const fields = [
    { label: "Precio cotizado", value: fmt(quotation.totalAmount) },
    { label: "Costo base",      value: fmt(quotation.baseCost) },
    { label: "Horas estimadas", value: fmtHours(quotation.estimatedHours) },
    { label: "Tipo",            value: quotation.quotationType || "—" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-50">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5" /> Cotización
        </h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {fields.map((f, i) => (
          <div key={i}>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">{f.label}</p>
            <p className={`text-sm font-semibold mt-0.5 capitalize ${f.value === "—" ? "text-slate-300" : "text-slate-700"}`}>{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="w-full px-3 py-6 space-y-6 bg-slate-100 min-h-screen">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-pulse">
        <div className="px-4 py-4 space-y-3">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="flex gap-2">
            <div className="h-5 w-14 bg-slate-100 rounded-md" />
            <div className="h-5 w-20 bg-slate-100 rounded-md" />
          </div>
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <div className="h-20 w-32 bg-slate-50 rounded-xl border border-slate-100" />
            <div className="h-20 flex-1 bg-slate-50 rounded-xl border border-slate-100" />
            <div className="h-20 flex-1 bg-slate-50 rounded-xl border border-slate-100" />
            <div className="h-20 flex-1 bg-slate-50 rounded-xl border border-slate-100" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-indigo-50/50 border border-indigo-200/30 animate-pulse h-40" />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse h-48" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse h-56" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse h-56" />
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

  // ── Sticky nav: track active section ──
  const [activeSection, setActiveSection] = useState("section-overview");
  const sectionRefs = useRef<Record<string, IntersectionObserverEntry>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          sectionRefs.current[e.target.id] = e;
        });
        const visible = Object.values(sectionRefs.current)
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { threshold: 0.1, rootMargin: "-80px 0px -60% 0px" }
    );
    const ids = NAV_ITEMS.map(n => n.id);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLoading]);

  if (isLoading) return <LoadingSkeleton />;

  if (error || !unifiedData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 bg-slate-100">
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

  const rankingMap = new Map(
    (unifiedData.rankings?.economicMetrics ?? []).map((r: any) => [r.personnelId, r])
  );
  const enrichedTeam = (a?.teamBreakdown ?? []).map((m: any) => ({
    ...m,
    efficiencyScore: rankingMap.get(m.personnelId)?.unifiedScore ?? undefined,
    performanceColor: rankingMap.get(m.personnelId)?.performanceColor ?? undefined,
    costUSD: m.costUSD ?? m.cost ?? 0,
  }));

  const teamTotalCost  = enrichedTeam.reduce((s: number, m: any) => s + (m.costUSD ?? 0), 0);
  const teamTotalHours = enrichedTeam.reduce((s: number, m: any) => s + (m.hoursAsana ?? m.hours ?? 0), 0);
  const effectiveCost  = cost  > 0 ? cost  : teamTotalCost;
  const effectiveHours = totalHours > 0 ? totalHours : teamTotalHours;
  const effectiveMarkup = markup > 0 ? markup : (revenue > 0 && effectiveCost > 0 ? revenue / effectiveCost : 0);
  const effectiveMargin = effectiveMarkup > 0 ? ((revenue - effectiveCost) / revenue) * 100 : margin;
  const effectiveBudgetUtil = budget > 0 && effectiveCost > 0 ? (effectiveCost / budget) * 100 : budgetUtil;

  // Compute task summary stats
  const taskSummaryActive = 0; // Will be shown from ProjectTaskList data
  const taskSummaryCompleted = 0;
  const teamAvgDeviation = enrichedTeam.length > 0
    ? enrichedTeam.reduce((sum: number, m: any) => {
        const target = m.targetHours ?? m.estimatedHours ?? 0;
        const actual = m.hoursAsana ?? m.hours ?? 0;
        return sum + (target > 0 ? Math.abs(((actual - target) / target) * 100) : 0);
      }, 0) / enrichedTeam.filter((m: any) => (m.targetHours ?? m.estimatedHours ?? 0) > 0).length || 0
    : 0;

  return (
    <div className="w-full px-3 py-5 space-y-8 bg-slate-100 min-h-screen">

      {/* ── 1. Hero Header ─────────────────────────────────────────── */}
      <div id="section-overview" className="animate-fadeIn">
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

      {/* ── Sticky Section Nav ─────────────────────────────────────── */}
      <SectionNav activeSection={activeSection} />

      {/* ── 2. AI Copilot — collapsed by default (ops only) ────────── */}
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

      {/* ── 3. Tasks — Compact Summary ─────────────────────────────── */}
      <div id="section-tareas" className="animate-fadeIn" style={{ animationDelay: "200ms" }}>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Tareas</p>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-1">
            <ProjectTaskList projectId={pid} />
          </div>
        </div>
      </div>

      {/* ── 4. Finances — P&L + Quotation merged ──────────────────── */}
      <div id="section-finanzas" className="animate-fadeIn" style={{ animationDelay: "300ms" }}>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Finanzas</p>
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {canSeeCosts ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* P&L Section */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" /> P&L del Proyecto
                </h3>
                {revenue === 0 && effectiveCost > 0 && (
                  <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 font-medium">
                    Sin facturación
                  </span>
                )}
              </div>
              <PLBreakdown
                revenue={revenue}
                cost={effectiveCost}
                budget={budget}
                budgetUtilization={effectiveBudgetUtil}
                totalHours={effectiveHours}
                markup={effectiveMarkup}
              />
              {/* Quotation — merged with internal divider */}
              {q && (
                <>
                  <div className="border-t border-slate-100 px-4 py-2.5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                      <Receipt className="h-3.5 w-3.5" /> Cotización
                    </h3>
                  </div>
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "Precio cotizado", value: fmt(q.totalAmount) },
                      { label: "Costo base",      value: fmt(q.baseCost) },
                      { label: "Horas estimadas", value: fmtHours(q.estimatedHours) },
                      { label: "Tipo",            value: q.quotationType || "—" },
                    ].map((f, i) => (
                      <div key={i}>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">{f.label}</p>
                        <p className={`text-sm font-semibold mt-0.5 capitalize ${f.value === "—" ? "text-slate-300" : "text-slate-700"}`}>{f.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" /> Resumen
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
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

          {/* Team Performance */}
          <div id="section-equipo">
            <TeamPerformance
              team={enrichedTeam}
              canSeeCosts={canSeeCosts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
