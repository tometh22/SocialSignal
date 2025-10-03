"use client";

import React, {useMemo, useState, useEffect} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search, BriefcaseBusiness, DollarSign, TrendingUp, Clock, AlertTriangle, Filter, ArrowUpDown, Maximize2, Minimize2, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

// ---------- Translations ----------
const i18n = {
  es: {
    title: "Proyectos Activos",
    subtitle: "Tablero unificado con datos de Excel/DB SoT",
    refresh: "Actualizar",
    searchPlaceholder: "Buscar proyectos o clientes…",
    activeOnly: "Solo activos",
    all: "Todos",
    thisMonth: "Este mes",
    lastMonth: "Mes anterior",
    custom: "Personalizado…",
    kpiRevenue: "Facturación del período (USD)",
    kpiProfit: "Ganancia del período (USD)",
    kpiHours: "Horas del período",
    kpiActive: "Proyectos activos",
    kpiFx: "Tipo de cambio (ref.)",
    labelRevenue: "Facturación",
    labelCost: "Costo",
    labelProfit: "Ganancia",
    labelMarkup: "Markup",
    labelMargin: "Margen",
    anomaly: "Anomalía",
    flags: "Señales:",
    noProjects: "No hay proyectos para este período.",
    errorLoading: "Error al cargar datos:",
    errorLoadingProjects: "Error al cargar proyectos",
    period: "Período:",
    updated: "Actualizado:",
    statusActive: "Activo",
    statusInactive: "Inactivo",
    tagOneShot: "Puntual",
    tagFee: "Fee",
    // New translations
    sortBy: "Ordenar por:",
    sortRevenue: "Facturación",
    sortProfit: "Ganancia",
    sortMargin: "Margen",
    sortMarkup: "Markup",
    density: "Densidad:",
    comfortable: "Confort",
    compact: "Compacto",
    normalizedUSD: "Normalizado USD:",
    viewMonth: "Mes",
    viewAccumulated: "Acumulado",
    viewTotal: "Total",
    markAsFinished: "Marcar como terminado",
    monthData: "Datos del mes",
    viewProject: "Ver proyecto",
    accumulatedToDate: "Acumulado a la fecha",
    projectTotal: "Total del proyecto",
  }
} as const;

const t = (k: keyof typeof i18n["es"]) => i18n.es[k];

// ---------- Types (tolerant to unknown backend fields) ----------
const API_BASE = ""; // same origin

export type Currency = "ARS" | "USD";

export type ProjectItem = {
  clientName: string;
  projectName: string;
  projectKey?: string;
  status?: "Active" | "Inactive";
  tags?: string[]; // e.g., ["Fee"|"One-Shot"]
  currencyNative?: Currency; // if not present, infer from clientName
  metrics: {
    revenueDisplay?: number; // native currency number
    costDisplay?: number;    // native currency number
    revenueUSDNormalized?: number; // USD number
    costUSDNormalized?: number;    // USD number
    markup?: number; // e.g., 2.3 = 2.3x
    margin?: number; // e.g., 0.34 = 34%
  };
  anomaly?: string[]; // optional flags from /debug or SoT
  // Optional metadata for intelligent visibility
  projectType?: "Fee" | "Puntual";
  startMonthKey?: string; // YYYY-MM
  endMonthKey?: string;   // YYYY-MM
  lastActivity?: string;  // YYYY-MM
  isFinished?: boolean;
  supportsRollup?: boolean;
  allowFinish?: boolean;
};

export type ProjectsApi = {
  period: string;                 // YYYY-MM
  updatedAt?: string;             // ISO
  fx?: number;                    // monthly FX used by SoT (if relevant)
  projects: ProjectItem[];
  summary?: {
    periodRevenueUSD?: number;
    periodProfitUSD?: number;
    periodHours?: number;
    activeProjects?: number;
    totalProjects?: number;
  };
};

// ---------- Visibility Helpers ----------

function hasActivityThisPeriod(p: ProjectItem) {
  const m = p.metrics || {};
  return !!(
    (m.revenueDisplay || 0) !== 0 || 
    (m.costDisplay || 0) !== 0 ||
    (m.revenueUSDNormalized || 0) !== 0 || 
    (m.costUSDNormalized || 0) !== 0
  );
}

function isActiveForPeriod(p: ProjectItem, period: string) {
  // Respect explicit finished flag
  if (p.isFinished === true) {
    return false;
  }

  // Respect status if it comes from backend
  if (typeof p.status === 'string') {
    return p.status !== 'Inactive';
  }

  // If ranges and type are available (optional), apply rules
  const tags = (p.tags || []).map(t => t.toLowerCase());
  const isPuntual = tags.includes('one-shot') || tags.includes('puntual') || p.projectType === 'Puntual';
  const isFee = tags.includes('fee') || p.projectType === 'Fee';
  const start = p.startMonthKey;
  const end = p.endMonthKey;

  // Puntual: only active within range or if there's activity
  if (isPuntual && (start || end)) {
    const okStart = !start || period >= start;
    const okEnd = !end || period <= end;
    return okStart && okEnd;
  }

  // Fee: active if there's activity or within grace period (1 month)
  if (isFee) {
    // Fee WITH lastActivity metadata: apply grace period logic
    if (p.lastActivity) {
      const [pYear, pMonth] = period.split('-').map(Number);
      const [lYear, lMonth] = p.lastActivity.split('-').map(Number);
      const periodDate = new Date(pYear, pMonth - 1);
      const lastActDate = new Date(lYear, lMonth - 1);
      const monthsDiff = (periodDate.getFullYear() - lastActDate.getFullYear()) * 12 + 
                        (periodDate.getMonth() - lastActDate.getMonth());
      
      // Active if period <= lastActivity + 1 month (grace period)
      return monthsDiff <= 1;
    }
    
    // Fee WITHOUT lastActivity metadata: assume active (backward compatibility)
    // Only hide if explicitly marked inactive or finished
    return true;
  }

  // Fallback universal: active if there's activity in the month
  return hasActivityThisPeriod(p);
}

// ---------- Helpers ----------
const currencySymbol = (c: Currency | undefined) => (c === "ARS" ? "ARS" : "$");

function formatKM(n?: number, currency?: Currency) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  let v = abs;
  let suffix = "";
  if (abs >= 1_000_000) { v = abs / 1_000_000; suffix = "M"; }
  else if (abs >= 1_000) { v = abs / 1_000; suffix = "K"; }
  const num = v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const sym = currencySymbol(currency);
  return `${sign}${sym} ${num}${suffix}`;
}

function formatUSD(n?: number) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  let v = abs;
  let suffix = "";
  if (abs >= 1_000_000) { v = abs / 1_000_000; suffix = "M"; }
  else if (abs >= 1_000) { v = abs / 1_000; suffix = "K"; }
  const num = v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  return `${sign}$ ${num}${suffix}`;
}

function monthKeyOf(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function lastMonthKey(): string {
  const d = new Date();
  d.setDate(1); // go to first day this month
  d.setMonth(d.getMonth() - 1);
  return monthKeyOf(d);
}

// Helpers for navigation and pretty labels
function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return monthKeyOf(d);
}

function periodToLabel(period: string): string {
  try {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("es", { month: "short", year: "numeric" });
  } catch {
    return period;
  }
}

function transformBackendResponse(backendData: any): ProjectsApi {
  // Extract period string from backend period object or construct it
  const periodStr = backendData.period?.start 
    ? backendData.period.start.substring(0, 7) // "2025-07-01" -> "2025-07"
    : "";

  // Extract FX rate if available
  const fx = backendData.period?.fxRate || backendData.fx;

  // Transform projects array
  const projects: ProjectItem[] = (backendData.projects || []).map((p: any) => {
    // Determine native currency based on client
    const clientName = p.client?.name || p.clientName || "";
    const isUSDClient = clientName.toLowerCase().includes("warner") || 
                       clientName.toLowerCase().includes("kimberly");
    const currencyNative: Currency = isUSDClient ? "USD" : "ARS";

    // Determine status
    const status = p.status === "active" || p.status === "Active" ? "Active" : "Inactive";

    // Determine tags
    const tags: string[] = [];
    if (p.type === "fee" || p.type === "Fee") tags.push("Fee");
    if (p.type === "one-shot" || p.type === "One-Shot") tags.push("One-Shot");

    // Get display values (native currency)
    const revenueDisplay = p.metrics?.revenueDisplay?.amount ?? p.metrics?.revenueUSD ?? 0;
    const costDisplay = p.metrics?.costDisplay?.amount ?? p.metrics?.costUSD ?? 0;

    // Get USD normalized values
    const revenueUSDNormalized = p.metrics?.revenueUSDNormalized ?? p.metrics?.revenueUSD ?? 0;
    const costUSDNormalized = p.metrics?.costUSDNormalized ?? p.metrics?.costUSD ?? 0;

    // Get markup and margin
    const markup = p.metrics?.markupRatio ?? p.metrics?.markup;
    const margin = p.metrics?.marginFrac ?? p.metrics?.margin;

    // Collect anomalies
    const anomaly: string[] = [];
    if (p.flags?.hasAnomaly) anomaly.push("ANOMALY");
    if (p.anomaly && Array.isArray(p.anomaly)) {
      anomaly.push(...p.anomaly);
    }

    return {
      clientName,
      projectName: p.name || p.projectName || "",
      projectKey: `${clientName.toLowerCase()}|${(p.name || "").toLowerCase()}`,
      status,
      tags,
      currencyNative,
      metrics: {
        revenueDisplay,
        costDisplay,
        revenueUSDNormalized,
        costUSDNormalized,
        markup,
        margin,
      },
      anomaly: anomaly.length > 0 ? anomaly : undefined,
    };
  });

  return {
    period: periodStr,
    updatedAt: backendData.updatedAt || new Date().toISOString(),
    fx,
    projects,
    summary: {
      periodRevenueUSD: backendData.summary?.periodRevenueUSD,
      periodProfitUSD: backendData.summary?.periodProfitUSD,
      periodHours: backendData.summary?.periodWorkedHours ?? backendData.summary?.periodHours,
      activeProjects: backendData.summary?.activeProjects,
      totalProjects: backendData.summary?.totalProjects,
    },
  };
}

async function fetchProjects(period: string, fresh: boolean): Promise<ProjectsApi> {
  const url = new URL(`/api/projects`, window.location.origin + API_BASE);
  url.searchParams.set("period", period);
  if (fresh) url.searchParams.set("source", "fresh"); // backend bypass cache

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const backendData = await res.json();
  
  return transformBackendResponse(backendData);
}

// ---------- React Query Hooks ----------
function useActiveProjects(period: string, fresh: boolean) {
  return useQuery({
    queryKey: ["projects", period, fresh ? "fresh" : "cached"],
    queryFn: () => fetchProjects(period, fresh),
    staleTime: 30_000,
  });
}

// ---------- UI Components ----------
function KPICard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-200/70 via-violet-200/70 to-fuchsia-200/70">
      <div className="rounded-2xl bg-white/90 backdrop-blur px-4 py-3 shadow-sm flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white p-2 shadow-sm">
          {icon}
        </div>
        <div>
          <div className="text-xs text-slate-500">{title}</div>
          <div className="text-xl font-semibold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "indigo" }: { children: React.ReactNode; tone?: "indigo"|"green"|"orange"|"slate" }) {
  const map:any = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
}

function ProjectCard({ p, dense, period }: { p: ProjectItem; dense?: boolean; period?: string }) {
  const queryClient = useQueryClient();

  const nativeCurrency: Currency | undefined = p.currencyNative ?? (p.clientName?.toLowerCase().includes("warner") || p.clientName?.toLowerCase().includes("kimberly") ? "USD" : "ARS");
  const revenueDisplay = p.metrics.revenueDisplay ?? 0;
  const costDisplay = p.metrics.costDisplay ?? 0;
  const profitDisplay = (p.metrics.revenueDisplay ?? 0) - (p.metrics.costDisplay ?? 0);

  const markup = p.metrics.markup ?? safeRatio(p.metrics.revenueUSDNormalized, p.metrics.costUSDNormalized);
  const margin = p.metrics.margin ?? safeMargin(p.metrics.revenueUSDNormalized, p.metrics.costUSDNormalized);

  const hasAnomaly = (p.anomaly?.length || 0) > 0;
  
  const statusLabel = p.status === "Inactive" ? t("statusInactive") : t("statusActive");
  const tagLabel = (tag: string) => {
    if (tag === "One-Shot") return t("tagOneShot");
    if (tag === "Fee") return t("tagFee");
    return tag;
  };

  const marginTone: 'good'|'warn'|'bad'|undefined =
    Number.isFinite(margin) ? (margin! < 0 ? 'bad' : margin! < 0.5 ? 'warn' : 'good') : undefined;

  const markupTone: 'good'|'warn'|'bad'|undefined =
    Number.isFinite(markup) ? (markup! < 1 ? 'bad' : markup! < 2 ? 'warn' : 'good') : undefined;

  const padding = dense ? "p-3" : "p-5";
  
  return (
    <motion.div layout initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${padding} shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600`}>
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
      
      {/* View project button - top right corner */}
      {p.projectKey && (
        <Link href={`/projects/${p.projectKey}`}>
          <button 
            className="absolute top-3 right-3 p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
            title={t("viewProject")}
            data-testid={`button-view-project-${p.projectKey}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        </Link>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{p.clientName}</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{p.projectName}</div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge tone="green">{statusLabel}</Badge>
            {p.tags?.map((tag, i) => (
              <Badge key={i} tone="slate">{tagLabel(tag)}</Badge>
            ))}
            {hasAnomaly && (
              <Badge tone="orange"><AlertTriangle className="h-3.5 w-3.5"/> {t("anomaly")}</Badge>
            )}
          </div>
        </div>
        <div className="text-right mr-12">
          <div className="text-sm text-slate-500 dark:text-slate-400">{t("labelRevenue")}</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatKM(revenueDisplay, nativeCurrency)}</div>
          {p.metrics.revenueUSDNormalized && p.metrics.revenueUSDNormalized !== revenueDisplay && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {t("normalizedUSD")} {formatUSD(p.metrics.revenueUSDNormalized)}
            </div>
          )}
        </div>
      </div>

      <div className={`${dense ? 'mt-3' : 'mt-4'} grid grid-cols-2 gap-${dense ? '3' : '4'} sm:grid-cols-4`}>
        <Stat label={t("labelCost")} value={formatKM(costDisplay, nativeCurrency)} />
        <Stat label={t("labelProfit")} value={formatKM(profitDisplay, nativeCurrency)} />
        <Stat label={t("labelMarkup")} value={Number.isFinite(markup) ? `${markup.toFixed(1)}x` : "—"} tone={markupTone} />
        <Stat label={t("labelMargin")} value={Number.isFinite(margin) ? `${(margin*100).toFixed(1)}%` : "—"} tone={marginTone} progress={Number.isFinite(margin) ? margin : undefined} />
      </div>

      {hasAnomaly && (
        <div className="mt-3 text-xs text-orange-700 dark:text-orange-400">
          {t("flags")} {p.anomaly?.join(", ")}
        </div>
      )}

      {/* Mark as finished button - only show if allowFinish is true */}
      {p.projectKey && p.allowFinish && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={async () => {
              if (!confirm(`¿Estás seguro de marcar "${p.projectName}" como terminado?`)) return;
              try {
                const res = await fetch(`/api/projects/${encodeURIComponent(p.projectKey!)}/status`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'Inactive', endMonthKey: period })
                });
                if (!res.ok) throw new Error(await res.text());
                // Invalidate cache to refresh data
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                alert('Proyecto marcado como terminado exitosamente');
              } catch (e) {
                console.error('Error marking project as finished:', e);
                alert('No se pudo cerrar el proyecto. El endpoint podría no estar disponible.');
              }
            }}
            className="text-xs rounded-lg border border-rose-200 dark:border-rose-800 px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 transition-colors"
          >
            {t("markAsFinished")}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Stat({label, value, tone, progress}:{label:string; value:string; tone?: 'default'|'good'|'warn'|'bad'; progress?: number}) {
  const color = tone==='good' ? 'text-emerald-700'
              : tone==='warn' ? 'text-amber-700'
              : tone==='bad'  ? 'text-rose-700'
              : 'text-slate-900';
  const progressColor = tone==='good' ? 'bg-emerald-500'
                      : tone==='warn' ? 'bg-amber-500'
                      : tone==='bad'  ? 'bg-rose-500'
                      : 'bg-slate-400';
  
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-center">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${color} dark:brightness-125`}>{value}</div>
      {progress !== undefined && (
        <div className="mt-1.5 h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${progressColor} transition-all`} style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

function Controls({ period, setPeriod, onRefresh, search, setSearch, activeOnly, setActiveOnly, sortBy, setSortBy, tagFilters, setTagFilters, dense, setDense }:{
  period:string; setPeriod:React.Dispatch<React.SetStateAction<string>>; onRefresh:()=>void;
  search:string; setSearch:(v:string)=>void; activeOnly:boolean; setActiveOnly:(v:boolean)=>void;
  sortBy:string; setSortBy:(v:string)=>void; tagFilters:string[]; setTagFilters:React.Dispatch<React.SetStateAction<string[]>>;
  dense:boolean; setDense:(v:boolean)=>void;
}){
  const [showNativePicker, setShowNativePicker] = useState(false);
  const nativePickerRef = React.useRef<HTMLInputElement | null>(null);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setPeriod((p: string) => addMonths(p, -1));
      if (e.key === "ArrowRight") setPeriod((p: string) => addMonths(p, 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPeriod]);

  const toggleTag = (tag: string) => {
    setTagFilters((prev: string[]) => prev.includes(tag) ? prev.filter((t: string) => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 bg-white/70 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-800 py-3">
      {/* Period navigator */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPeriod(addMonths(period, -1))}
          className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          aria-label="Previous month"
        >‹</button>
        <button
          onClick={() => setShowNativePicker(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          aria-label="Pick month"
        >{periodToLabel(period)}</button>
        <button
          onClick={() => setPeriod(addMonths(period, 1))}
          className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          aria-label="Next month"
        >›</button>

        {/* Presets */}
        <div className="ml-2 hidden sm:flex items-center gap-2">
          <button
            onClick={() => setPeriod(monthKeyOf(new Date()))}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
          >{t("thisMonth")}</button>
          <button
            onClick={() => setPeriod(lastMonthKey())}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
          >{t("lastMonth")}</button>
          <button
            onClick={() => setShowNativePicker(true)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
          >{t("custom")}</button>
        </div>

        {/* Hidden native month input */}
        {showNativePicker && (
          <input
            ref={nativePickerRef}
            type="month"
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setShowNativePicker(false); }}
            onBlur={() => setShowNativePicker(false)}
            className="absolute opacity-0 pointer-events-none"
            autoFocus
          />
        )}

        <button onClick={onRefresh} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
          <RefreshCcw className="h-4 w-4"/> {t("refresh")}
        </button>
      </div>

      {/* Search & Active only */}
      <div className="flex items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500"/>
          <input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pl-8 pr-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeOnly ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
        >
          <Filter className="h-4 w-4"/> {activeOnly ? t("activeOnly") : t("all")}
        </button>
      </div>
      </div>

      {/* Second row: Sort, Tag Filters, Density */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t("sortBy")}</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500"
          >
            <option value="revenue">{t("sortRevenue")}</option>
            <option value="profit">{t("sortProfit")}</option>
            <option value="margin">{t("sortMargin")}</option>
            <option value="markup">{t("sortMarkup")}</option>
          </select>
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleTag("Fee")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
              tagFilters.includes("Fee") 
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            {t("tagFee")}
          </button>
          <button
            onClick={() => toggleTag("One-Shot")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
              tagFilters.includes("One-Shot") 
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            {t("tagOneShot")}
          </button>
        </div>

        {/* Density */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t("density")}</span>
          <button
            onClick={() => setDense(!dense)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {dense ? <><Minimize2 className="h-3 w-3"/> {t("compact")}</> : <><Maximize2 className="h-3 w-3"/> {t("comfortable")}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryBar({ data }:{ data?: ProjectsApi }){
  const active = data?.summary?.activeProjects ?? data?.projects?.filter(p=>p.status!=="Inactive").length ?? 0;
  const total = data?.summary?.totalProjects ?? data?.projects?.length ?? 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <KPICard title={t("kpiRevenue")} value={formatUSD(data?.summary?.periodRevenueUSD)} icon={<DollarSign className="h-5 w-5"/>}/>
      <KPICard title={t("kpiProfit")} value={formatUSD(data?.summary?.periodProfitUSD)} icon={<TrendingUp className="h-5 w-5"/>}/>
      <KPICard title={t("kpiHours")} value={`${data?.summary?.periodHours ?? 0}h`} icon={<Clock className="h-5 w-5"/>}/>
      <KPICard title={t("kpiActive")} value={`${active}/${total}`} icon={<BriefcaseBusiness className="h-5 w-5"/>}/>
      <KPICard title={t("kpiFx")} value={data?.fx ? `${data.fx}` : "—"} icon={<DollarSign className="h-5 w-5"/>}/>
    </div>
  );
}

function safeRatio(rev?: number, cost?: number) {
  if (rev == null || cost == null || cost === 0) return NaN;
  return rev / cost;
}
function safeMargin(rev?: number, cost?: number) {
  if (rev == null || cost == null || rev === 0) return NaN;
  return (rev - cost) / rev;
}

function ProjectsList({ items, dense, period }:{ items: ProjectItem[]; dense?: boolean; period?: string }){
  if (!items?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500 dark:text-slate-400">
        {t("noProjects")}
      </div>
    );
  }

  // Group by client for separators
  const grouped: {client: string; projects: ProjectItem[]}[] = [];
  let currentClient = "";
  let currentGroup: ProjectItem[] = [];

  items.forEach((p) => {
    if (p.clientName !== currentClient) {
      if (currentGroup.length > 0) {
        grouped.push({client: currentClient, projects: currentGroup});
      }
      currentClient = p.clientName;
      currentGroup = [p];
    } else {
      currentGroup.push(p);
    }
  });
  if (currentGroup.length > 0) {
    grouped.push({client: currentClient, projects: currentGroup});
  }

  return (
    <div className={`grid gap-${dense ? '3' : '4'}`}>
      {grouped.map((group, gIdx) => (
        <div key={group.client}>
          {gIdx > 0 && (
            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
              <div className="text-xs font-medium text-slate-400 dark:text-slate-500">{group.client}</div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
            </div>
          )}
          {group.projects.map((p, idx) => (
            <ProjectCard key={`${p.projectKey ?? p.clientName+"|"+p.projectName}-${idx}`} p={p} dense={dense} period={period} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ActiveProjectsNext(){
  // Initialize period from localStorage
  const initialPeriod = useMemo(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('ap.period');
      if (saved) return saved;
    }
    return lastMonthKey();
  }, []);

  const [period, setPeriod] = useState<string>(initialPeriod);
  const [freshToggle, setFreshToggle] = useState<boolean>(false);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortBy, setSortBy] = useState("revenue");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [dense, setDense] = useState(false);
  const queryClient = useQueryClient();

  // Save period to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('ap.period', period);
  }, [period]);

  const { data, isLoading, isError, error, refetch, isFetching } = useActiveProjects(period, freshToggle);

  // Reset fresh flag after a fetch cycle
  useEffect(()=>{
    if (!isFetching && freshToggle) setFreshToggle(false);
  }, [isFetching, freshToggle]);

  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase();
    let result = (data?.projects ?? [])
      .filter(p => !activeOnly || isActiveForPeriod(p, period))
      .filter(p => !q || `${p.clientName} ${p.projectName}`.toLowerCase().includes(q));
    
    // Tag filtering
    if (tagFilters.length > 0) {
      result = result.filter(p => p.tags?.some(tag => tagFilters.includes(tag)));
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortBy === "revenue") {
        aVal = a.metrics.revenueUSDNormalized ?? 0;
        bVal = b.metrics.revenueUSDNormalized ?? 0;
      } else if (sortBy === "profit") {
        aVal = (a.metrics.revenueUSDNormalized ?? 0) - (a.metrics.costUSDNormalized ?? 0);
        bVal = (b.metrics.revenueUSDNormalized ?? 0) - (b.metrics.costUSDNormalized ?? 0);
      } else if (sortBy === "margin") {
        aVal = a.metrics.margin ?? 0;
        bVal = b.metrics.margin ?? 0;
      } else if (sortBy === "markup") {
        aVal = a.metrics.markup ?? 0;
        bVal = b.metrics.markup ?? 0;
      }
      return bVal - aVal; // Descending order
    });

    return result;
  }, [data?.projects, search, activeOnly, tagFilters, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("period")} <span className="font-medium">{periodToLabel(data?.period ?? period)}</span> • {t("subtitle")}</p>
      </div>

      <Controls
        period={period}
        setPeriod={setPeriod}
        onRefresh={() => { setFreshToggle(true); refetch(); }}
        search={search}
        setSearch={setSearch}
        activeOnly={activeOnly}
        setActiveOnly={setActiveOnly}
        sortBy={sortBy}
        setSortBy={setSortBy}
        tagFilters={tagFilters}
        setTagFilters={setTagFilters}
        dense={dense}
        setDense={setDense}
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[...Array(5)].map((_,i)=> (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100"/>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 p-4 text-rose-700 dark:text-rose-400">
            {t("errorLoading")} {(error as Error)?.message}
          </div>
        ) : (
          <SummaryBar data={data} />
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_,i)=> (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100"/>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 p-4 text-rose-700 dark:text-rose-400">
            {t("errorLoadingProjects")}
          </div>
        ) : (
          <ProjectsList items={filtered} dense={dense} period={period} />
        )}
      </div>

      {data?.updatedAt && (
        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          {t("updated")} {new Date(data.updatedAt).toLocaleString("es")} • {t("period")} {data.period}
        </div>
      )}
      </div>
    </div>
  );
}
