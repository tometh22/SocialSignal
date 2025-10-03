"use client";

import React, {useMemo, useState, useEffect} from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search, BriefcaseBusiness, DollarSign, TrendingUp, Clock, AlertTriangle, Filter } from "lucide-react";
import { motion } from "framer-motion";

// ---------- Types (tolerant to unknown backend fields) ----------
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

// helpers to navigate months and pretty labels
function addMonths(period: string, delta: number): string {
  const [y,m] = period.split("-").map(Number);
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth() + delta);
  return monthKeyOf(d);
}

function periodToLabel(period: string): string {
  try {
    const [y,m] = period.split("-").map(Number);
    const d = new Date(y, m-1, 1);
    return d.toLocaleDateString('es', { month: "short", year: "numeric" });
  } catch { return period; }
});
  } catch { return period; }
}

const API_BASE = ""; // same origin; change if you proxy to a gateway

async function fetchProjects(period: string, fresh: boolean): Promise<ProjectsApi> {
  const url = new URL(`/api/projects`, window.location.origin + API_BASE);
  url.searchParams.set("period", period);
  if (fresh) url.searchParams.set("source", "fresh"); // backend bypass cache

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
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

  return (
    <motion.div layout initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} className=\"rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300\">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{p.clientName}</div>
          <div className="text-lg font-semibold text-slate-900">{p.projectName}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone=\"green\">{p.status === "Inactive" ? "Inactivo" : "Activo"}</Badge>
            {p.tags?.map((t, i) => (
              <Badge key={i} tone="slate">{t}</Badge>
            ))}
            {hasAnomaly && (
              <Badge tone=\"orange\"><AlertTriangle className=\"h-3.5 w-3.5\"/> Anomalía</Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className=\"text-sm text-slate-500\">Facturación</div>
          <div className="text-xl font-semibold">{formatKM(revenueDisplay, nativeCurrency)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label=\"Costo\" value={formatKM(costDisplay, nativeCurrency)} />
        <Stat label=\"Ganancia\" value={formatKM(profitDisplay, nativeCurrency)} />
        <Stat label="Markup" value={Number.isFinite(markup) ? `${markup.toFixed(1)}x` : "—"} />
        <Stat label=\"Margen\" value={Number.isFinite(margin) ? `${(margin*100).toFixed(1)}%` : "—"} />
      </div>

      {hasAnomaly && (
        <div className="mt-3 text-xs text-orange-700">
          Señales: {p.anomaly?.join(", ")}
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
  period:string; setPeriod:(v:string)=>void; onRefresh:()=>void;
  search:string; setSearch:(v:string)=>void; activeOnly:boolean; setActiveOnly:(v:boolean)=>void;
}){
  const [showNativePicker, setShowNativePicker] = useState(false);
  const nativePickerRef = React.useRef<HTMLInputElement|null>(null);

  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      if (e.key === "ArrowLeft") setPeriod(p=>addMonths(p,-1));
      if (e.key === "ArrowRight") setPeriod(p=>addMonths(p,1));
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [setPeriod]);

  return (
    <div className=\"sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/70 border-b border-slate-100 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between\">
      {/* Period navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={()=> setPeriod(addMonths(period,-1))}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          aria-label="Previous month"
        >‹</button>
        <button
          onClick={()=> setShowNativePicker(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Pick month"
        >{periodToLabel(period)}</button>
        <button
          onClick={()=> setPeriod(addMonths(period,1))}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          aria-label="Next month"
        >›</button>

        {/* Presets */}
        <div className="ml-2 hidden sm:flex items-center gap-2">
          <button onClick={()=> setPeriod(monthKeyOf(new Date()))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50">Este mes</button>
          <button onClick={()=> setPeriod(lastMonthKey())}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50">Mes anterior</button>
          <button onClick={()=> setShowNativePicker(true)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50">Personalizado…</button>
        </div>

        {/* hidden native month input */}
        {showNativePicker && (
          <input
            ref={nativePickerRef}
            type="month"
            value={period}
            onChange={(e)=>{ setPeriod(e.target.value); setShowNativePicker(false);} }
            onBlur={()=> setShowNativePicker(false)}
            className="absolute opacity-0 pointer-events-none"
            autoFocus
          />
        )}

        <button onClick={onRefresh} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
          <RefreshCcw className=\"h-4 w-4\"/> Actualizar
        </button>
      </div>

      {/* Search & Active only */}
      <div className="flex items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400"/>
          <input
            placeholder=\"Buscar proyectos o clientes…\"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={()=>setActiveOnly(v=>!v)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeOnly?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-slate-200 bg-white text-slate-700"}`}
        >
          <Filter className="h-4 w-4"/> {activeOnly?"Solo activos":"Todos"}
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
      <KPICard title="Facturación del período (USD)" value={formatUSD(data?.summary?.periodRevenueUSD)} icon={<DollarSign className="h-5 w-5"/>}/>
      <KPICard title="Ganancia del período (USD)" value={formatUSD(data?.summary?.periodProfitUSD)} icon={<TrendingUp className="h-5 w-5"/>}/>
      <KPICard title="Horas del período" value={`${data?.summary?.periodHours ?? 0}h`} icon={<Clock className="h-5 w-5"/>}/>
      <KPICard title="Proyectos activos" value={`${active}/${total}`} icon={<BriefcaseBusiness className="h-5 w-5"/>}/>
      <KPICard title="Tipo de cambio (ref.)" value={data?.fx ? `${data.fx}` : "—"} icon={<DollarSign className="h-5 w-5"/>}/>
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
        No hay proyectos para este período.
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {items.map((p, idx)=> <ProjectCard key={`${p.projectKey ?? p.clientName+"|"+p.projectName}-${idx}`} p={p} />)}
    </div>
  );
}

function ActiveProjectsInner(){
  const initialPeriod = useMemo(()=>{
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

  useEffect(()=>{
    if (typeof window !== 'undefined') window.localStorage.setItem('ap.period', period);
  }, [period]);

  const { data, isLoading, isError, error, refetch, isFetching } = useActiveProjects(period, freshToggle);

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
    <div className=\"mx-auto max-w-6xl p-5 sm:p-8 bg-gradient-to-b from-slate-50 to-white\">
      <div className="mb-6">
        <h1 className=\"text-2xl font-semibold text-slate-900\">Proyectos Activos</h1>
        <p className="text-sm text-slate-500">Período: <span className=\"font-medium\">{periodToLabel(data?.period ?? period)}</span> • Tablero unificado con datos de Excel/DB SoT</p>
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
            Error al cargar datos: {(error as Error)?.message}
          </div>
        ) : (
          <SummaryBar data={data} />
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(4)].map((_,i)=> <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100"/>) }
          </div>
        ) : (
          <ProjectsList items={filtered} />
        )}
      </div>

      <div className="mt-6 text-xs text-slate-400">
        <div>Período API: <span className="font-mono">{data?.period ?? period}</span> • Actualizado: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}</div>
      </div>
    </div>
  );
}

export default function ActiveProjectsPage(){
  const [client] = useState(()=> new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ActiveProjectsInner />
    </QueryClientProvider>
  );
}
