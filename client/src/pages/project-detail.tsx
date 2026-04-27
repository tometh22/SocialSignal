/**
 * Project Detail — V4: Hero + Tabs.
 * Optimized for "5-second diagnosis" by Management/CEO and Ops/PMs.
 * Hero is always visible; tabs (Resumen / Equipo / Finanzas / Tareas)
 * keep the page focused without an infinite scroll.
 * Active tab persists in the URL via ?tab=<name>.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { AlertTriangle, BarChart3, TrendingUp, Receipt, ListTodo, Users, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

const fmtHours = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)}h`;

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabValue = "resumen" | "equipo" | "finanzas" | "tareas";
const TABS: { value: TabValue; label: string; icon: React.ReactNode }[] = [
  { value: "resumen",  label: "Resumen",  icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { value: "equipo",   label: "Equipo",   icon: <Users className="h-3.5 w-3.5" /> },
  { value: "finanzas", label: "Finanzas", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { value: "tareas",   label: "Tareas",   icon: <ListTodo className="h-3.5 w-3.5" /> },
];

function isTabValue(v: string | null): v is TabValue {
  return v === "resumen" || v === "equipo" || v === "finanzas" || v === "tareas";
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

export default function ProjectDetail() {
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

  // ── Active tab — persists in URL via ?tab=<value> so it's shareable ──
  const tabFromUrl = urlParams.get("tab");
  const [activeTab, setActiveTabState] = useState<TabValue>(
    isTabValue(tabFromUrl) ? tabFromUrl : "resumen"
  );

  const setActiveTab = (next: string) => {
    if (!isTabValue(next)) return;
    setActiveTabState(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

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

  const showAICopilot = canSeeCosts && (effectiveCost > 0 || budget > 0);

  return (
    <div className="w-full px-3 py-5 bg-slate-100 min-h-screen">
      {/* ── Hero — always visible above tabs ─────────────────────── */}
      <div className="mb-4 animate-fadeIn">
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

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={cn(
            "sticky top-0 z-30 mb-4 h-auto bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-sm",
            "inline-flex flex-wrap items-center justify-start gap-0.5"
          )}
        >
          {TABS.map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                "data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-slate-500 hover:data-[state=inactive]:text-slate-800 hover:data-[state=inactive]:bg-slate-100"
              )}
            >
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Resumen — diagnostic insights ─────────────────────── */}
        <TabsContent value="resumen" className="space-y-4 animate-fadeIn">
          {showAICopilot ? (
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
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-sm text-slate-500">
              <LayoutDashboard className="h-6 w-6 mx-auto mb-2 text-slate-300" />
              {canSeeCosts
                ? "Sin datos suficientes para generar un diagnóstico de este período."
                : "Tu rol no tiene visibilidad financiera para ver el diagnóstico."}
            </div>
          )}
        </TabsContent>

        {/* ── Equipo — TeamPerformance ──────────────────────────── */}
        <TabsContent value="equipo" className="animate-fadeIn">
          <TeamPerformance team={enrichedTeam} canSeeCosts={canSeeCosts} />
        </TabsContent>

        {/* ── Finanzas — P&L + Quotation ────────────────────────── */}
        <TabsContent value="finanzas" className="animate-fadeIn">
          {canSeeCosts ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
        </TabsContent>

        {/* ── Tareas — full task list ───────────────────────────── */}
        <TabsContent value="tareas" className="animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-1">
              <ProjectTaskList projectId={pid} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
