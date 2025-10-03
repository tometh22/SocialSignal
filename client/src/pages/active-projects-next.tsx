"use client";

import React, {useMemo, useState, useEffect} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search, BriefcaseBusiness, DollarSign, TrendingUp, Clock, AlertTriangle, Filter } from "lucide-react";
import { motion } from "framer-motion";

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

// ---------- React Query Hook ----------
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
      <div className="rounded-xl border bg-slate-50 p-2">{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-xl font-semibold text-slate-900">{value}</div>
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

function ProjectCard({ p }: { p: ProjectItem }) {
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

  return (
    <motion.div layout initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{p.clientName}</div>
          <div className="text-lg font-semibold text-slate-900">{p.projectName}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="green">{statusLabel}</Badge>
            {p.tags?.map((tag, i) => (
              <Badge key={i} tone="slate">{tagLabel(tag)}</Badge>
            ))}
            {hasAnomaly && (
              <Badge tone="orange"><AlertTriangle className="h-3.5 w-3.5"/> {t("anomaly")}</Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">{t("labelRevenue")}</div>
          <div className="text-xl font-semibold">{formatKM(revenueDisplay, nativeCurrency)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("labelCost")} value={formatKM(costDisplay, nativeCurrency)} />
        <Stat label={t("labelProfit")} value={formatKM(profitDisplay, nativeCurrency)} />
        <Stat label={t("labelMarkup")} value={Number.isFinite(markup) ? `${markup.toFixed(1)}x` : "—"} />
        <Stat label={t("labelMargin")} value={Number.isFinite(margin) ? `${(margin*100).toFixed(1)}%` : "—"} />
      </div>

      {hasAnomaly && (
        <div className="mt-3 text-xs text-orange-700">
          {t("flags")} {p.anomaly?.join(", ")}
        </div>
      )}
    </motion.div>
  );
}

function Stat({label, value}:{label:string; value:string}){
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Controls({ period, setPeriod, onRefresh, search, setSearch, activeOnly, setActiveOnly }:{
  period:string; setPeriod:React.Dispatch<React.SetStateAction<string>>; onRefresh:()=>void;
  search:string; setSearch:(v:string)=>void; activeOnly:boolean; setActiveOnly:(v:boolean)=>void;
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Period navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPeriod(addMonths(period, -1))}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          aria-label="Previous month"
        >‹</button>
        <button
          onClick={() => setShowNativePicker(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Pick month"
        >{periodToLabel(period)}</button>
        <button
          onClick={() => setPeriod(addMonths(period, 1))}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          aria-label="Next month"
        >›</button>

        {/* Presets */}
        <div className="ml-2 hidden sm:flex items-center gap-2">
          <button
            onClick={() => setPeriod(monthKeyOf(new Date()))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
          >{t("thisMonth")}</button>
          <button
            onClick={() => setPeriod(lastMonthKey())}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
          >{t("lastMonth")}</button>
          <button
            onClick={() => setShowNativePicker(true)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
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

        <button onClick={onRefresh} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
          <RefreshCcw className="h-4 w-4"/> {t("refresh")}
        </button>
      </div>

      {/* Search & Active only */}
      <div className="flex items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400"/>
          <input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeOnly ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700"}`}
        >
          <Filter className="h-4 w-4"/> {activeOnly ? t("activeOnly") : t("all")}
        </button>
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

function ProjectsList({ items }:{ items: ProjectItem[] }){
  if (!items?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        {t("noProjects")}
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {items.map((p, idx)=> <ProjectCard key={`${p.projectKey ?? p.clientName+"|"+p.projectName}-${idx}`} p={p} />)}
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
    return (data?.projects ?? [])
      .filter(p => !activeOnly || p.status !== "Inactive")
      .filter(p => !q || `${p.clientName} ${p.projectName}`.toLowerCase().includes(q));
  }, [data?.projects, search, activeOnly]);

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("period")} <span className="font-medium">{periodToLabel(data?.period ?? period)}</span> • {t("subtitle")}</p>
      </div>

      <Controls
        period={period}
        setPeriod={setPeriod}
        onRefresh={() => { setFreshToggle(true); refetch(); }}
        search={search}
        setSearch={setSearch}
        activeOnly={activeOnly}
        setActiveOnly={setActiveOnly}
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[...Array(5)].map((_,i)=> (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100"/>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {t("errorLoadingProjects")}
          </div>
        ) : (
          <ProjectsList items={filtered} />
        )}
      </div>

      {data?.updatedAt && (
        <div className="mt-6 text-center text-xs text-slate-400">
          {t("updated")} {new Date(data.updatedAt).toLocaleString("es")} • {t("period")} {data.period}
        </div>
      )}
    </div>
  );
}
