/**
 * Project Intelligence View — world-class project detail
 * Replaces the old tab-based layout with a single scrollable intelligence page.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { AlertTriangle, DollarSign, BarChart3, TrendingUp, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// ─── P&L Breakdown ────────────────────────────────────────────────────────────

function PLBreakdown({
  revenue, cost, budget, budgetUtilization, totalHours, markup,
}: {
  revenue: number; cost: number; budget: number; budgetUtilization: number;
  totalHours: number; markup: number;
}) {
  const profit = revenue - cost;
  const burnRate = totalHours > 0 ? cost / totalHours : 0;

  const rows = [
    { label: "Revenue (venta)",    value: revenue, color: "text-emerald-700", bar: "bg-emerald-500", positive: true },
    { label: "Costos directos",    value: -cost,   color: "text-red-600",     bar: "bg-red-400",    positive: false },
  ];
  const maxVal = Math.max(revenue, cost);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500" /> P&L del Proyecto
        </h3>
      </div>
      <div className="p-5 space-y-3">
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className={`text-base font-bold tabular-nums ${row.color}`}>{fmt(Math.abs(row.value))}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${row.bar}`}
                style={{ width: `${maxVal > 0 ? (Math.abs(row.value) / maxVal) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}

        {/* Result */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-slate-700">Resultado bruto</span>
            <span className={`text-xl font-bold tabular-nums ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {fmt(profit)}
            </span>
          </div>
        </div>

        {/* Secondary KPIs */}
        <div className="pt-2 grid grid-cols-2 gap-3">
          {[
            { label: "Markup",        value: markup > 0 ? `${markup.toFixed(2)}x` : "—" },
            { label: "Margen",        value: revenue > 0 ? fmtPct((profit / revenue) * 100) : "—" },
            { label: "Burn rate",     value: burnRate > 0 ? `${fmt(burnRate)}/h` : "—" },
            { label: "Budget usado",  value: budget > 0 ? fmtPct(budgetUtilization) : "Sin budget" },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>
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
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-500" /> Cotización
        </h3>
      </div>
      <div className="p-5 grid grid-cols-2 gap-4">
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

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="h-40 rounded-2xl bg-slate-200" />
      <div className="h-48 rounded-2xl bg-slate-100" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-slate-100" />
        <div className="h-64 rounded-2xl bg-slate-100" />
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
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Hero Header ───────────────────────────────────────────────── */}
      <ProjectHero
        clientName={clientName}
        projectName={projectName}
        projectStatus={projectStatus}
        period={periodFromUrl}
        revenue={revenue}
        cost={cost}
        markup={markup}
        margin={margin}
        totalHours={totalHours}
        estimatedHours={estimatedHours}
        budget={budget}
        budgetUtilization={budgetUtil}
        hoursDeviation={hoursDeviation}
        canSeeCosts={canSeeCosts}
        prevMarkup={unifiedData.previousPeriod?.metrics?.markup ?? undefined}
      />

      {/* ── AI Copilot (ops only, only if there's financial data) ──────── */}
      {canSeeCosts && cost > 0 && (
        <AICopilot
          revenue={revenue}
          cost={cost}
          markup={markup}
          margin={margin}
          budget={budget}
          budgetUtilization={budgetUtil}
          totalHours={totalHours}
          estimatedHours={estimatedHours}
          hoursDeviation={hoursDeviation}
          costDeviation={costDeviation}
          teamBreakdown={enrichedTeam}
          previousPeriod={unifiedData.previousPeriod}
          period={periodFromUrl}
        />
      )}

      {/* ── Main content grid ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-5">
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
              cost={cost}
              budget={budget}
              budgetUtilization={budgetUtil}
              totalHours={totalHours}
              markup={markup}
            />
            <QuotationInfo quotation={q} />
          </div>
        ) : (
          /* Non-ops: show hours summary only */
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Resumen
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                { label: "Horas totales",  value: fmtHours(totalHours) },
                { label: "Horas estimadas", value: fmtHours(estimatedHours) },
                { label: "Desvío",         value: estimatedHours > 0 ? `${hoursDeviation > 0 ? "+" : ""}${hoursDeviation.toFixed(0)}%` : "—" },
                { label: "Equipo",         value: `${enrichedTeam.length} personas` },
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

      {/* ── Tasks ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Target className="h-4 w-4 text-slate-500" /> Tareas
          </h3>
        </div>
        <div className="p-1">
          <ProjectTaskList projectId={pid} />
        </div>
      </div>

    </div>
  );
}
