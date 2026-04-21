"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import PortfolioAnalytics from "@/components/portfolio-analytics";
import { usePermissions } from "@/hooks/use-permissions";
import {
  RefreshCcw, Search, ChevronDown, ChevronRight,
  Filter, DollarSign, TrendingUp, Clock, BriefcaseBusiness, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Currency = "ARS" | "USD";

export type ProjectItem = {
  projectId?: number;
  clientName: string;
  projectName: string;
  projectKey?: string;
  status?: "Active" | "Inactive";
  tags?: string[];
  currencyNative?: Currency;
  isOneShot?: boolean;
  metrics: {
    revenueDisplay?: number;
    costDisplay?: number;
    revenueUSDNormalized?: number;
    costUSDNormalized?: number;
    markup?: number;
    margin?: number;
    totalHours?: number;
  };
  anomaly?: string[];
  projectType?: "Fee" | "Puntual";
  lifetimeRevenueUSD?: number;
  lifetimeCostUSD?: number;
  revenuePeriod?: string;
  startMonthKey?: string;
  endMonthKey?: string;
  lastActivity?: string;
  isFinished?: boolean;
  supportsRollup?: boolean;
  allowFinish?: boolean;
};

export type ProjectsApi = {
  period: string;
  updatedAt?: string;
  fx?: number;
  projects: ProjectItem[];
  summary?: {
    periodRevenueUSD?: number;
    periodProfitUSD?: number;
    periodHours?: number;
    activeProjects?: number;
    totalProjects?: number;
    [key: string]: any;
  };
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonthKey(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKeyOf(d);
}

function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return monthKeyOf(d);
}

function periodToLabel(period: string): string {
  try {
    const [y, m] = period.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
  } catch {
    return period;
  }
}

function formatKM(n?: number, prefix = "$\u00A0"): string {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  let v = abs, suffix = "";
  if (abs >= 1_000_000) { v = abs / 1_000_000; suffix = "M"; }
  else if (abs >= 1_000) { v = abs / 1_000; suffix = "K"; }
  const num = v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  return `${sign}${prefix}${num}${suffix}`;
}

function formatUSD(n?: number): string { return formatKM(n); }

// ─── Health / Semaphore ──────────────────────────────────────────────────────

type Health = "green" | "yellow" | "red" | "gray";

function getHealth(markup?: number): Health {
  if (markup == null || !isFinite(markup) || markup <= 0) return "gray";
  if (markup >= 2.5) return "green";
  if (markup >= 2.0) return "yellow";
  return "red";
}

const HEALTH_ORDER: Record<Health, number> = { red: 0, yellow: 1, green: 2, gray: 3 };

function Semaphore({ markup }: { markup?: number }) {
  const health = getHealth(markup);
  const cls: Record<Health, string> = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-red-500",
    gray: "bg-slate-300",
  };
  const label: Record<Health, string> = {
    green: `Saludable — markup ${markup?.toFixed(1)}x >= 2.5x`,
    yellow: `Atención — markup ${markup?.toFixed(1)}x (2.0–2.5x)`,
    red: `CRÍTICO — markup ${markup?.toFixed(1)}x < 2.0x`,
    gray: "Sin datos de markup",
  };
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${cls[health]} flex-shrink-0`}
      title={label[health]}
    />
  );
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

function transformBackendResponse(backendData: any): ProjectsApi {
  const periodStr =
    typeof backendData.period === "string"
      ? backendData.period
      : backendData.period?.start
      ? backendData.period.start.substring(0, 7)
      : "";
  const fx = backendData.period?.fxRate || backendData.fx;

  const projects: ProjectItem[] = (backendData.projects || []).map((p: any) => {
    const clientName = p.client?.name || p.clientName || "";
    const isUSDClient =
      clientName.toLowerCase().includes("warner") ||
      clientName.toLowerCase().includes("kimberly");
    const currencyNative: Currency = isUSDClient ? "USD" : "ARS";
    const status = p.status === "active" || p.status === "Active" ? "Active" : "Inactive";
    const tags: string[] = [];
    if (p.type === "fee" || p.type === "Fee") tags.push("Fee");
    if (p.type === "one-shot" || p.type === "One-Shot") tags.push("One-Shot");

    const revenueDisplay = p.metrics?.revenueDisplay?.amount ?? p.metrics?.revenueUSD ?? 0;
    const costDisplay = p.metrics?.costDisplay?.amount ?? p.metrics?.costUSD ?? 0;
    const revenueUSDNormalized = p.metrics?.revenueUSDNormalized ?? p.metrics?.revenueUSD ?? 0;
    const costUSDNormalized = p.metrics?.costUSDNormalized ?? p.metrics?.costUSD ?? 0;
    const markup = p.metrics?.markupRatio ?? p.metrics?.markup;
    const margin = p.metrics?.marginFrac ?? p.metrics?.margin;

    const anomaly: string[] = [];
    if (p.flags?.hasAnomaly) anomaly.push("ANOMALY");
    if (Array.isArray(p.anomaly)) anomaly.push(...p.anomaly);

    return {
      projectId: p.projectId,
      clientName,
      projectName: p.name || p.projectName || "",
      projectKey: `${clientName.toLowerCase()}|${(p.name || "").toLowerCase()}`,
      status,
      tags,
      currencyNative,
      isOneShot: p.isOneShot,
      metrics: {
        revenueDisplay,
        costDisplay,
        revenueUSDNormalized,
        costUSDNormalized,
        markup,
        margin,
        totalHours: p.metrics?.totalHours,
      },
      anomaly: anomaly.length > 0 ? anomaly : undefined,
      projectType: p.projectType,
      startMonthKey: p.startMonthKey,
      endMonthKey: p.endMonthKey,
      lastActivity: p.lastActivity,
      isFinished: p.isFinished,
      supportsRollup: p.supportsRollup,
      allowFinish: p.allowFinish,
    };
  });

  return {
    period: periodStr,
    updatedAt: backendData.updatedAt || new Date().toISOString(),
    fx,
    projects,
    summary: {
      ...(backendData.summary ?? {}),
      periodRevenueUSD: backendData.summary?.periodRevenueUSD,
      periodProfitUSD: backendData.summary?.periodProfitUSD,
      periodHours:
        backendData.summary?.periodWorkedHours ?? backendData.summary?.periodHours,
      activeProjects: backendData.summary?.activeProjects,
      totalProjects: backendData.summary?.totalProjects,
    },
  };
}

async function fetchProjects(period: string, fresh: boolean): Promise<ProjectsApi> {
  const url = new URL("/api/projects", window.location.origin);
  url.searchParams.set("period", period);
  if (fresh) url.searchParams.set("source", "fresh");
  const res = await authFetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return transformBackendResponse(await res.json());
}

function useActiveProjects(period: string, fresh: boolean) {
  return useQuery({
    queryKey: ["projects", period, fresh ? "fresh" : "cached"],
    queryFn: () => fetchProjects(period, fresh),
    staleTime: 30_000,
  });
}

// ─── Active filter (activity within last 2 months) ────────────────────────────

function isRecentlyActive(p: ProjectItem, period: string): boolean {
  if (p.isFinished) return false;
  if (p.status === "Inactive") return false;
  if ((p.metrics?.revenueDisplay || 0) > 0 || (p.metrics?.costDisplay || 0) > 0) return true;
  if (p.lastActivity) {
    const [pY, pM] = period.split("-").map(Number);
    const [lY, lM] = p.lastActivity.split("-").map(Number);
    const diff = (pY - lY) * 12 + (pM - lM);
    return diff <= 2;
  }
  return false;
}

// ─── KPI Summary Bar ──────────────────────────────────────────────────────────

function KPIBar({ data, isOperations }: { data?: ProjectsApi; isOperations: boolean }) {
  const asanaHours = data?.summary?.periodAsanaHours ?? data?.summary?.periodHours ?? 0;
  const fxValue = data?.fx
    ? `ARS ${data.fx.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    : "—";

  const kpis = [
    {
      label: "Facturación (USD)",
      value: formatUSD(data?.summary?.periodRevenueUSD),
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Ganancia (USD)",
      value: formatUSD(data?.summary?.periodProfitUSD),
      icon: <TrendingUp className="h-4 w-4" />,
      hidden: !isOperations,
    },
    {
      label: "Horas del período",
      value: `${Number(asanaHours).toFixed(0)}h`,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Proyectos activos",
      value: `${data?.summary?.activeProjects ?? 0}/${data?.summary?.totalProjects ?? 0}`,
      icon: <BriefcaseBusiness className="h-4 w-4" />,
    },
    {
      label: "FX referencia",
      value: fxValue,
      icon: <DollarSign className="h-4 w-4" />,
      hidden: !isOperations,
    },
  ].filter(k => !k.hidden);

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex-shrink-0 rounded-lg bg-slate-50 p-2 text-slate-500">
            {kpi.icon}
          </div>
          <div>
            <div className="text-[11px] text-slate-400 leading-tight">{kpi.label}</div>
            <div className="text-lg font-semibold text-slate-900 leading-tight">{kpi.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Controls Bar ─────────────────────────────────────────────────────────────

function Controls({
  period,
  setPeriod,
  onRefresh,
  isFetching,
  search,
  setSearch,
  activeOnly,
  setActiveOnly,
  statusFilter,
  setStatusFilter,
}: {
  period: string;
  setPeriod: (p: string) => void;
  onRefresh: () => void;
  isFetching: boolean;
  search: string;
  setSearch: (s: string) => void;
  activeOnly: boolean;
  setActiveOnly: (v: boolean) => void;
  statusFilter: "open" | "closed" | "all";
  setStatusFilter: (s: "open" | "closed" | "all") => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") setPeriod(addMonths(period, -1));
      if (e.key === "ArrowRight") setPeriod(addMonths(period, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [period, setPeriod]);

  return (
    <div className="sticky top-0 z-20 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3 mb-6 bg-white/90 backdrop-blur border-b border-slate-100 flex flex-wrap gap-2 items-center">
      {/* Period navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPeriod(addMonths(period, -1))}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ‹
        </button>
        <span className="min-w-[140px] text-center text-sm font-medium text-slate-700 rounded-lg border border-slate-200 bg-white px-3 py-1.5 capitalize">
          {periodToLabel(period)}
        </span>
        <button
          onClick={() => setPeriod(addMonths(period, 1))}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      <button
        onClick={() => setPeriod(monthKeyOf(new Date()))}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
      >
        Este mes
      </button>
      <button
        onClick={() => setPeriod(lastMonthKey())}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
      >
        Mes anterior
      </button>

      <div className="flex-1 min-w-0" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proyecto o cliente…"
          className="w-52 rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </div>

      {/* Open/closed filter */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
        {(["open", "closed", "all"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setStatusFilter(opt)}
            className={`px-2.5 py-1.5 transition-colors ${
              statusFilter === opt
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {opt === "open" ? "Abiertos" : opt === "closed" ? "Cerrados" : "Todos"}
          </button>
        ))}
      </div>

      {/* Active filter */}
      <button
        onClick={() => setActiveOnly(!activeOnly)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
          activeOnly
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-white text-slate-500"
        }`}
      >
        <Filter className="h-3.5 w-3.5" />
        {activeOnly ? "Solo con actividad" : "Todos"}
      </button>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={isFetching}
        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
      >
        <RefreshCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        Actualizar
      </button>
    </div>
  );
}

// ─── Table Header ─────────────────────────────────────────────────────────────

function TableHeader({ isOperations }: { isOperations: boolean }) {
  const cols = [
    { label: "Proyecto", align: "text-left", cls: "pl-4 pr-3" },
    { label: "Status", align: "text-left", cls: "px-3" },
    { label: "Revenue", align: "text-right", cls: "px-3" },
    ...(isOperations
      ? [
          { label: "Costo", align: "text-right", cls: "px-3" },
          { label: "Markup", align: "text-right", cls: "px-3" },
          { label: "Margen", align: "text-right", cls: "px-3" },
        ]
      : []),
    { label: "Horas", align: "text-right", cls: "px-3" },
    { label: "🚦", align: "text-center", cls: "px-3" },
    { label: "", align: "text-center", cls: "pr-3 pl-1 w-6" },
  ];

  return (
    <thead>
      <tr className="border-b border-slate-100 bg-slate-50/80">
        {cols.map((col, i) => (
          <th
            key={i}
            className={`py-2 ${col.cls} ${col.align} text-[11px] font-semibold text-slate-400 uppercase tracking-wide`}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Project Row ──────────────────────────────────────────────────────────────

function ProjectStatusToggle({
  projectId,
  isFinished,
}: {
  projectId: number;
  isFinished: boolean;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const path = isFinished ? "reopen" : "finish";
      const res = await authFetch(`/api/active-projects/${projectId}/${path}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const msg = isFinished
          ? "¿Reabrir este proyecto?"
          : "¿Marcar este proyecto como cerrado?";
        if (window.confirm(msg)) mutation.mutate();
      }}
      title={isFinished ? "Reabrir proyecto" : "Marcar como cerrado"}
      className="text-[10px] text-slate-400 hover:text-indigo-600 underline disabled:opacity-50"
    >
      {mutation.isPending ? "…" : isFinished ? "reabrir" : "cerrar"}
    </button>
  );
}

function ProjectRow({
  p,
  isOperations,
  period,
}: {
  p: ProjectItem;
  isOperations: boolean;
  period: string;
}) {
  const health = getHealth(p.metrics.markup);

  const borderColor: Record<Health, string> = {
    red: "border-l-red-500",
    yellow: "border-l-amber-400",
    green: "border-l-emerald-500",
    gray: "border-l-slate-200",
  };
  const markupCls: Record<Health, string> = {
    red: "text-red-600 font-bold",
    yellow: "text-amber-600 font-semibold",
    green: "text-emerald-700",
    gray: "text-slate-400",
  };

  const revenue = p.metrics.revenueUSDNormalized ?? p.metrics.revenueDisplay ?? 0;
  const cost = p.metrics.costUSDNormalized ?? p.metrics.costDisplay ?? 0;
  const href = `/active-projects/${p.projectId}?period=${period}`;

  return (
    <tr
      className={`group border-b border-slate-100 border-l-2 ${borderColor[health]} hover:bg-slate-50 transition-colors`}
    >
      {/* Name */}
      <td className="py-2.5 pl-4 pr-3">
        <Link href={href}>
          <span className="font-medium text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5 flex-wrap">
            {p.projectName}
            {p.isOneShot && (
              <span className="text-[10px] bg-indigo-50 text-indigo-600 rounded px-1.5 py-0.5 flex-shrink-0">
                PUNTUAL
              </span>
            )}
            {(p.anomaly?.length ?? 0) > 0 && (
              <span
                className="text-[10px] bg-orange-50 text-orange-600 rounded px-1.5 py-0.5 flex-shrink-0"
                title={p.anomaly?.join(", ")}
              >
                ⚠ anomalía
              </span>
            )}
          </span>
        </Link>
      </td>

      {/* Status */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5">
          {p.isFinished ? (
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-slate-200 text-slate-600 ring-1 ring-slate-300">
              Cerrado
            </span>
          ) : (
            <span
              className={`text-[11px] rounded-full px-2 py-0.5 ${
                p.status === "Active"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {p.status === "Active" ? "Activo" : "Inactivo"}
            </span>
          )}
          {isOperations && p.projectId != null && (
            <ProjectStatusToggle projectId={p.projectId} isFinished={!!p.isFinished} />
          )}
        </div>
      </td>

      {/* Revenue */}
      <td className="py-2.5 px-3 text-right tabular-nums text-sm text-slate-700 font-medium">
        {formatUSD(revenue)}
      </td>

      {/* Ops-only */}
      {isOperations && (
        <>
          <td className="py-2.5 px-3 text-right tabular-nums text-sm text-slate-500">
            {formatUSD(cost)}
          </td>
          <td className={`py-2.5 px-3 text-right tabular-nums text-sm ${markupCls[health]}`}>
            {isFinite(p.metrics.markup ?? NaN) ? `${p.metrics.markup!.toFixed(1)}x` : "—"}
          </td>
          <td className="py-2.5 px-3 text-right tabular-nums text-sm text-slate-600">
            {isFinite(p.metrics.margin ?? NaN)
              ? `${(p.metrics.margin! * 100).toFixed(0)}%`
              : "—"}
          </td>
        </>
      )}

      {/* Hours */}
      <td className="py-2.5 px-3 text-right tabular-nums text-sm text-slate-400">
        {p.metrics.totalHours ? `${p.metrics.totalHours.toFixed(0)}h` : "—"}
      </td>

      {/* Semaphore */}
      <td className="py-2.5 px-3 text-center">
        <Semaphore markup={p.metrics.markup} />
      </td>

      {/* Link */}
      <td className="py-2.5 pr-3 pl-1 text-center w-6">
        <Link href={href}>
          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors cursor-pointer" />
        </Link>
      </td>
    </tr>
  );
}

// ─── Client Group (collapsible) ───────────────────────────────────────────────

function ClientGroup({
  client,
  projects,
  isOperations,
  period,
  defaultOpen,
}: {
  client: string;
  projects: ProjectItem[];
  isOperations: boolean;
  period: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const totalRevenue = projects.reduce(
    (s, p) => s + (p.metrics.revenueUSDNormalized ?? p.metrics.revenueDisplay ?? 0),
    0
  );
  const criticalCount = projects.filter(p => getHealth(p.metrics.markup) === "red").length;
  const warningCount = projects.filter(p => getHealth(p.metrics.markup) === "yellow").length;

  const avgMarkup = (() => {
    const withMarkup = projects.filter(
      p => isFinite(p.metrics.markup ?? NaN) && (p.metrics.markup ?? 0) > 0
    );
    if (withMarkup.length === 0) return null;
    return withMarkup.reduce((s, p) => s + p.metrics.markup!, 0) / withMarkup.length;
  })();

  const avgMarkupCls =
    avgMarkup == null
      ? "text-slate-400"
      : avgMarkup >= 2.5
      ? "text-emerald-600"
      : avgMarkup >= 2.0
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-slate-400 flex-shrink-0">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        <span className="font-semibold text-slate-800 text-sm">{client}</span>
        <span className="text-xs text-slate-400">
          {projects.length} proyecto{projects.length !== 1 ? "s" : ""}
        </span>

        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-red-600 bg-red-50 rounded-full px-2 py-0.5 ring-1 ring-red-200 flex-shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
            {criticalCount} crítico{criticalCount !== 1 ? "s" : ""}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 ring-1 ring-amber-200 flex-shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
            {warningCount} en atención
          </span>
        )}

        <div className="ml-auto flex items-center gap-4">
          {isOperations && avgMarkup !== null && (
            <span className={`text-xs font-semibold ${avgMarkupCls}`}>
              avg {avgMarkup.toFixed(1)}x
            </span>
          )}
          <span className="text-sm font-semibold text-slate-700">{formatUSD(totalRevenue)}</span>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHeader isOperations={isOperations} />
            <tbody>
              {projects.map(p => (
                <ProjectRow
                  key={p.projectId ?? p.projectKey}
                  p={p}
                  isOperations={isOperations}
                  period={period}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActiveProjectsNext() {
  const { isOperations } = usePermissions();

  const initialPeriod = useMemo(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("ap.period");
      if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    }
    return lastMonthKey();
  }, []);

  const [period, setPeriod] = useState(initialPeriod);
  const [freshToggle, setFreshToggle] = useState(false);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("ap.period", period);
  }, [period]);

  const { data, isLoading, isError, error, refetch, isFetching } = useActiveProjects(
    period,
    freshToggle
  );

  useEffect(() => {
    if (!isFetching && freshToggle) setFreshToggle(false);
  }, [isFetching, freshToggle]);

  const handlePeriodChange = useCallback((p: string) => setPeriod(p), []);
  const handleRefresh = useCallback(() => {
    setFreshToggle(true);
    refetch();
  }, [refetch]);

  // Filter → health-first sort, then revenue desc
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.projects ?? [])
      .filter(p => {
        if (statusFilter === "open" && p.isFinished) return false;
        if (statusFilter === "closed" && !p.isFinished) return false;
        if (activeOnly && !isRecentlyActive(p, period)) return false;
        if (q && !`${p.clientName} ${p.projectName}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ha = HEALTH_ORDER[getHealth(a.metrics.markup)];
        const hb = HEALTH_ORDER[getHealth(b.metrics.markup)];
        if (ha !== hb) return ha - hb;
        const ra = a.metrics.revenueUSDNormalized ?? a.metrics.revenueDisplay ?? 0;
        const rb = b.metrics.revenueUSDNormalized ?? b.metrics.revenueDisplay ?? 0;
        return rb - ra;
      });
  }, [data?.projects, search, activeOnly, statusFilter, period]);

  // Group by client — clients with worst health bubble up
  const clientGroups = useMemo(() => {
    const map = new Map<string, ProjectItem[]>();
    filtered.forEach(p => {
      const arr = map.get(p.clientName) ?? [];
      arr.push(p);
      map.set(p.clientName, arr);
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const worstA = Math.min(...a.map(p => HEALTH_ORDER[getHealth(p.metrics.markup)]));
      const worstB = Math.min(...b.map(p => HEALTH_ORDER[getHealth(p.metrics.markup)]));
      return worstA - worstB;
    });
  }, [filtered]);

  const hasCritical = filtered.some(p => getHealth(p.metrics.markup) === "red");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900">Proyectos</h1>
              {hasCritical && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block animate-pulse" />
                  Proyectos críticos
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} proyecto{filtered.length !== 1 ? "s" : ""} •{" "}
              <span className="capitalize">{periodToLabel(period)}</span>
            </p>
          </div>

          {data?.summary?.dataFreshness && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 flex-shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {new Date(data.summary.dataFreshness).toLocaleDateString("es", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Controls */}
        <Controls
          period={period}
          setPeriod={handlePeriodChange}
          onRefresh={handleRefresh}
          isFetching={isFetching}
          search={search}
          setSearch={setSearch}
          activeOnly={activeOnly}
          setActiveOnly={setActiveOnly}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        {/* KPI Bar */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Error al cargar datos: {(error as Error)?.message}
          </div>
        ) : (
          <KPIBar data={data} isOperations={isOperations} />
        )}

        {/* Portfolio Analytics — ops/admin only */}
        {isOperations && !isLoading && data?.projects && data.projects.length > 0 && (
          <div className="mb-6">
            <PortfolioAnalytics projects={data.projects} period={period} />
          </div>
        )}

        {/* Semaphore legend (ops only) */}
        {isOperations && !isLoading && (
          <div className="flex items-center gap-5 text-xs text-slate-400 mb-3">
            <span className="font-medium text-slate-500">Semáforo:</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
              Saludable (markup ≥ 2.5x)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
              Atención (2.0x – 2.5x)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
              Crítico (&lt; 2.0x)
            </span>
          </div>
        )}

        {/* Projects table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Error al cargar proyectos.
          </div>
        ) : clientGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
            <BriefcaseBusiness className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-slate-500">No hay proyectos para este período.</p>
            {activeOnly && (
              <button
                onClick={() => setActiveOnly(false)}
                className="mt-2 text-indigo-600 hover:underline text-sm"
              >
                Ver todos los proyectos →
              </button>
            )}
          </div>
        ) : (
          <div>
            {clientGroups.map(([client, projects], i) => (
              <ClientGroup
                key={client}
                client={client}
                projects={projects}
                isOperations={isOperations}
                period={period}
                defaultOpen={i < 6}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {data?.updatedAt && (
          <p className="mt-6 text-center text-xs text-slate-400">
            Actualizado:{" "}
            {new Date(data.updatedAt).toLocaleString("es", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            • Período: {data.period}
          </p>
        )}
      </div>
    </div>
  );
}
