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
  const profit    = revenue - cost;
  const burnRate  = totalHours > 0 ? cost / totalHours : 0;
  const margin    = revenue > 0 ? (profit / revenue) * 100 : null;
  const maxVal    = Math.max(revenue, cost, 1);
  const noRevenue = revenue === 0 && cost > 0;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-400" /> P&L del Proyecto
        </h3>
        {noRevenue && (
          <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 font-medium">
            Sin facturación registrada
          </span>
        )}
      </div>

      <div className="p-5 space-y-3">
        {/* Revenue row */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm text-slate-500">Revenue (venta)</span>
            <span className={`text-base font-bold tabular-nums ${revenue > 0 ? "text-emerald-700" : "text-slate-400"}`}>
              {revenue > 0 ? fmt(revenue) : "Pendiente"}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(revenue / maxVal) * 100}%` }} />
          </div>
        </div>

        {/* Cost row */}
        {cost > 0 && (
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm text-slate-500">Costos directos</span>
              <span className="text-base font-bold tabular-nums text-red-600">{fmt(cost)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-red-400" style={{ width: `${(cost / maxVal) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Result */}
        <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
          <span className="text-sm font-semibold text-slate-700">Resultado bruto</span>
          <span className={`text-xl font-bold tabular-nums ${
            revenue === 0 ? "text-slate-400"
            : profit >= 0 ? "text-emerald-700"
            : "text-red-700"
          }`}>
            {revenue === 0 ? "—" : fmt(profit)}
          </span>
        </div>

        {/* Secondary KPIs grid */}
        <div className="pt-1 grid grid-cols-2 gap-2.5">
          {[
            { label: "Markup",       value: markup > 0 ? `${markup.toFixed(2)}x` : "—" },
            { label: "Margen",       value: margin != null ? fmtPct(margin) : "—" },
            { label: "Burn rate",    value: burnRate > 0 ? `${fmt(burnRate)}/h` : "—" },
            { label: "Budget usado", value: budget > 0 ? fmtPct(budgetUtilization) : "Sin budget" },
          ].map((kpi, i) => (
            <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{kpi.label}</p>
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

  // Fallback: if vm metrics are 0 but team has data, use team aggregates
  const teamTotalCost  = enrichedTeam.reduce((s: number, m: any) => s + (m.costUSD ?? 0), 0);
  const teamTotalHours = enrichedTeam.reduce((s: number, m: any) => s + (m.hoursAsana ?? m.hours ?? 0), 0);
  const effectiveCost  = cost  > 0 ? cost  : teamTotalCost;
  const effectiveHours = totalHours > 0 ? totalHours : teamTotalHours;
  const effectiveMarkup = markup > 0 ? markup : (revenue > 0 && effectiveCost > 0 ? revenue / effectiveCost : 0);
  const effectiveMargin = effectiveMarkup > 0 ? ((revenue - effectiveCost) / revenue) * 100 : margin;
  const effectiveBudgetUtil = budget > 0 && effectiveCost > 0 ? (effectiveCost / budget) * 100 : budgetUtil;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Hero Header ───────────────────────────────────────────────── */}
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

      {/* ── AI Copilot (ops only) ──────────────────────────────────────── */}
      {canSeeCosts && (effectiveCost > 0 || budget > 0) && (
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
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
