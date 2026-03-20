import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RefreshCw, TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpRight, ArrowDownRight, Info, Calendar, BarChart3, Wallet, PieChart, Activity } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell, Legend, Area, AreaChart, ComposedChart
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────
interface DashboardData {
  periodKey: string;
  year: number;
  monthNumber: number;
  monthLabel: string | null;
  ventasMes: number;
  costosDirectos: number;
  margenBruto: number;
  margenBrutoPct: number;
  costosIndirectos: number;
  ebitOperativo: number;
  margenOperativoPct: number;
  impuestos: number;
  beneficioNeto: number;
  margenNetoPct: number;
  markup: number;
  totalActivo: number;
  totalPasivo: number;
  balanceNeto: number;
  cajaTotal: number;
  inversiones: number;
  cuentasCobrarUsd: number;
  cuentasPagarUsd: number;
  cashflowNeto: number;
  cashflowIngresos: number;
  cashflowEgresos: number;
  ivaCompras: number;
  impuestosUsa: number;
  facturacionAdelantada: number;
  proyeccionResultado: number;
  balance60Dias: number;
  burnRate: number;
  runway: number;
  ventasVariation: number | null;
  ebitVariation: number | null;
  beneficioVariation: number | null;
  cashflowVariation: number | null;
  trends: TrendRow[];
  availablePeriods: string[];
}

interface TrendRow {
  periodKey: string;
  monthLabel: string | null;
  ventasMes: number;
  costosDirectos: number;
  costosIndirectos: number;
  ebitOperativo: number;
  beneficioNeto: number;
  markup: number;
  margenOperativoPct: number;
  margenNetoPct: number;
  cashflowNeto: number;
  cajaTotal: number;
  totalActivo: number;
  totalPasivo: number;
  balanceNeto: number;
  proyeccionResultado: number;
  balance60Dias: number;
}

// ─── Formatters ──────────────────────────────────────────────────
function fmtCurrency(value: number, decimals = 2): string {
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(decimals > 0 ? 1 : 0)}k`;
  return `${prefix}$${abs.toFixed(decimals)}`;
}

function fmtFull(value: number): string {
  const prefix = value < 0 ? "-" : "";
  return `${prefix}$${Math.abs(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(2)}%`;
}

function periodLabel(pk: string): string {
  const [y, m] = pk.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

// ─── Variation Badge ─────────────────────────────────────────────
function VarBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-xs text-gray-400">--</span>;
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────
function KpiCard({
  title, value, subtitle, variation, color = "neutral", size = "md", icon
}: {
  title: string;
  value: string;
  subtitle?: string;
  variation?: number | null;
  color?: "green" | "red" | "blue" | "violet" | "amber" | "neutral";
  size?: "xl" | "md";
  icon?: React.ReactNode;
}) {
  const colorMap = {
    green: "from-emerald-50 to-emerald-100/50 border-emerald-200",
    red: "from-red-50 to-red-100/50 border-red-200",
    blue: "from-blue-50 to-blue-100/50 border-blue-200",
    violet: "from-violet-50 to-violet-100/50 border-violet-200",
    amber: "from-amber-50 to-amber-100/50 border-amber-200",
    neutral: "from-gray-50 to-gray-100/50 border-gray-200",
  };
  const textColor = {
    green: "text-emerald-700",
    red: "text-red-600",
    blue: "text-blue-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
    neutral: "text-gray-700",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border overflow-hidden`}>
      <CardContent className={size === "xl" ? "p-6" : "p-4"}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
          {icon}
        </div>
        <div className={`font-bold ${textColor[color]} ${size === "xl" ? "text-3xl" : "text-2xl"}`}>
          {value}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
          {variation !== undefined && <VarBadge value={variation ?? null} />}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── P&L Waterfall ───────────────────────────────────────────────
function WaterfallPnL({ data }: { data: DashboardData }) {
  const rows = [
    { label: "Ventas del mes", value: data.ventasMes, pct: 100, type: "revenue" as const },
    { label: "Costos Directos", value: -data.costosDirectos, pct: null, type: "cost" as const },
    { label: "Margen Bruto", value: data.margenBruto, pct: data.margenBrutoPct, type: "subtotal" as const },
    { label: "Costos Indirectos", value: -data.costosIndirectos, pct: null, type: "cost" as const },
    { label: "EBIT Operativo", value: data.ebitOperativo, pct: data.margenOperativoPct, type: "subtotal" as const },
    { label: "Impuestos", value: -data.impuestos, pct: null, type: "cost" as const },
    { label: "Beneficio Neto", value: data.beneficioNeto, pct: data.margenNetoPct, type: "total" as const },
  ];

  return (
    <div className="space-y-1">
      {rows.map((row, i) => {
        const isNeg = row.value < 0;
        const bgClass = row.type === "revenue" ? "bg-blue-50" :
                        row.type === "subtotal" ? "bg-gray-100 font-semibold" :
                        row.type === "total" ? (row.value >= 0 ? "bg-emerald-50 font-bold" : "bg-red-50 font-bold") :
                        "bg-white";
        const textClass = row.type === "cost" ? "text-red-600" :
                          row.type === "total" ? (row.value >= 0 ? "text-emerald-700" : "text-red-600") :
                          row.type === "subtotal" ? "text-gray-900" :
                          "text-blue-700";

        return (
          <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${bgClass}`}>
            <span className={`text-sm ${row.type === "cost" ? "pl-4 text-gray-600" : "text-gray-800"} ${row.type === "total" || row.type === "subtotal" ? "font-semibold" : ""}`}>
              {row.type === "cost" ? "−  " : row.type === "subtotal" ? "=  " : row.type === "total" ? "=  " : ""}
              {row.label}
            </span>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-mono ${textClass}`}>
                {row.type === "cost" ? fmtFull(Math.abs(row.value)) : fmtFull(row.value)}
              </span>
              {row.pct !== null && (
                <span className={`text-xs font-medium w-16 text-right ${row.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {fmtPct(row.pct)}
                </span>
              )}
              {row.pct === null && <span className="w-16" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trend Chart ─────────────────────────────────────────────────
function TrendChart({ data, dataKeys, colors, title }: {
  data: TrendRow[];
  dataKeys: { key: string; name: string }[];
  colors: string[];
  title: string;
}) {
  const chartData = data.map(d => ({
    month: d.periodKey.slice(5),
    ...d,
  }));

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtCurrency(v, 0)} />
            <RTooltip formatter={(v: number) => fmtFull(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {dataKeys.map((dk, i) => (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.name}
                stroke={colors[i]}
                fill={colors[i]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Cashflow Bar Chart ──────────────────────────────────────────
function CashflowChart({ data }: { data: TrendRow[] }) {
  const chartData = data.map(d => ({
    month: d.periodKey.slice(5),
    cashflow: d.cashflowNeto,
  }));

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Cashflow Neto (12 meses)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtCurrency(v, 0)} />
            <RTooltip formatter={(v: number) => fmtFull(v)} />
            <Bar dataKey="cashflow" name="Cashflow Neto">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.cashflow >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────
export default function UnifiedExecutiveDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["/api/v1/executive/dashboard", selectedPeriod],
    queryFn: async () => {
      const url = selectedPeriod
        ? `/api/v1/executive/dashboard?period=${selectedPeriod}`
        : "/api/v1/executive/dashboard";
      const res = await authFetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.hint || `HTTP ${res.status}`);
      }
      return res.json();
    },
    retry: 1,
  });

  // Set initial period from API response
  if (data && !selectedPeriod && data.periodKey) {
    setSelectedPeriod(data.periodKey);
  }

  // ─── Auto-sync: if period has no P&L data, trigger sync silently ───
  const [autoSyncing, setAutoSyncing] = useState(false);
  const autoSyncAttempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    const noData = data.ventasMes === 0 && data.ebitOperativo === 0;
    const period = data.periodKey;
    if (noData && period && !autoSyncAttempted.current.has(period) && !autoSyncing) {
      autoSyncAttempted.current.add(period);
      setAutoSyncing(true);
      authFetch("/api/trigger-resumen-ejecutivo-sync", { method: "POST" })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            refetch();
          }
        })
        .catch(() => {})
        .finally(() => setAutoSyncing(false));
    }
  }, [data, autoSyncing, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-red-500 font-semibold">Error cargando dashboard</div>
        <div className="text-sm text-gray-500">{(error as Error).message}</div>
        <button onClick={() => refetch()} className="text-sm text-blue-600 underline">Reintentar</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        No hay datos disponibles. Verificá que la sincronización de Google Sheets haya corrido.
      </div>
    );
  }

  const d = data;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

        {/* ─── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              P&L unificado — coincide con Looker Studio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPeriod || ""}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            >
              {d.availablePeriods.map(p => (
                <option key={p} value={p}>{periodLabel(p)}</option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ─── Incomplete month warning ─── */}
        {d.ventasMes === 0 && d.ebitOperativo === 0 && (d.totalActivo > 0 || d.cuentasCobrarUsd > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <strong>Datos parciales</strong> — Este mes aún no tiene datos de P&L (ventas, costos). Solo se muestran datos de balance.
            {(d as any)._debug && (
              <span className="block mt-1 text-xs text-amber-600">
                Periodo solicitado: {(d as any)._debug.requestedPeriod} | Efectivo: {(d as any)._debug.effectivePeriod} | Fuente: {(d as any)._debug.dataSource}
              </span>
            )}
          </div>
        )}

        {/* ─── Top KPIs (same 7 as Looker Resumen Ejecutivo) ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard
            title="EBIT Operativo"
            value={fmtFull(d.ebitOperativo)}
            subtitle={fmtPct(d.margenOperativoPct)}
            variation={d.ebitVariation}
            color={d.ebitOperativo >= 0 ? "green" : "red"}
          />
          <KpiCard
            title="Ventas del mes"
            value={fmtFull(d.ventasMes)}
            variation={d.ventasVariation}
            color="blue"
          />
          <KpiCard
            title="Cashflow"
            value={fmtFull(d.cashflowNeto)}
            variation={d.cashflowVariation}
            color={d.cashflowNeto >= 0 ? "green" : "amber"}
          />
          <KpiCard
            title="Margen Neto"
            value={fmtPct(d.margenNetoPct)}
            color={d.margenNetoPct >= 0 ? "green" : "red"}
          />
          <KpiCard
            title="Margen Operativo"
            value={fmtPct(d.margenOperativoPct)}
            color={d.margenOperativoPct >= 0 ? "green" : "red"}
          />
          <KpiCard
            title="Markup"
            value={`${d.markup.toFixed(2)}`}
            color={d.markup >= 3 ? "green" : "amber"}
          />
          <KpiCard
            title="Beneficio Neto"
            value={fmtFull(d.beneficioNeto)}
            variation={d.beneficioVariation}
            color={d.beneficioNeto >= 0 ? "green" : "red"}
          />
        </div>

        {/* ─── P&L Waterfall ──────────────────────────────── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-800">Estado de Resultados</h2>
              <span className="text-xs text-gray-400 ml-2">{periodLabel(d.periodKey)}</span>
            </div>
            <WaterfallPnL data={d} />
          </CardContent>
        </Card>

        {/* ─── Balance + Cash ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Balance */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">Balance</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">Activo Líquido</span>
                  <span className="text-sm font-mono font-semibold text-blue-700">{fmtFull(d.cajaTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">Activo M.P. Crypto</span>
                  <span className="text-sm font-mono font-semibold text-blue-700">{fmtFull(d.inversiones)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">Clientes a Cobrar</span>
                  <span className="text-sm font-mono font-semibold text-blue-700">{fmtFull(d.cuentasCobrarUsd)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-gray-100 rounded-lg font-semibold">
                  <span className="text-sm text-gray-800">Activo Total</span>
                  <span className="text-sm font-mono text-gray-800">{fmtFull(d.totalActivo)}</span>
                </div>
                <div className="border-t my-2" />
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-600">Pasivo Total</span>
                  <span className="text-sm font-mono font-semibold text-red-600">{fmtFull(d.totalPasivo)}</span>
                </div>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg font-bold ${d.balanceNeto >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <span className="text-sm text-gray-800">Balance Neto</span>
                  <span className={`text-sm font-mono ${d.balanceNeto >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtFull(d.balanceNeto)}</span>
                </div>
                {d.balance60Dias !== 0 && (
                  <div className="flex justify-between items-center py-2 px-3 bg-indigo-50 rounded-lg">
                    <span className="text-sm text-gray-600">Balance 60 días</span>
                    <span className="text-sm font-mono font-semibold text-indigo-700">{fmtFull(d.balance60Dias)}</span>
                  </div>
                )}
                {d.proyeccionResultado !== 0 && (
                  <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${d.proyeccionResultado >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                    <span className="text-sm text-gray-600">Proyección Resultado</span>
                    <span className={`text-sm font-mono font-semibold ${d.proyeccionResultado >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtFull(d.proyeccionResultado)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cash & Runway */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">Caja & Runway</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded-lg">
                  <span className="text-sm text-gray-600">Cashflow Ingresos</span>
                  <span className="text-sm font-mono font-semibold text-emerald-700">{fmtFull(d.cashflowIngresos)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-600">Cashflow Egresos</span>
                  <span className="text-sm font-mono font-semibold text-red-600">{fmtFull(d.cashflowEgresos)}</span>
                </div>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg font-semibold ${d.cashflowNeto >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                  <span className="text-sm text-gray-800">Cashflow Neto</span>
                  <span className={`text-sm font-mono ${d.cashflowNeto >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtFull(d.cashflowNeto)}</span>
                </div>
                <div className="border-t my-2" />
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">Caja Total</span>
                  <span className="text-sm font-mono font-semibold text-blue-700">{fmtFull(d.cajaTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Burn Rate mensual</span>
                  <span className="text-sm font-mono font-semibold text-gray-700">{fmtFull(d.burnRate)}</span>
                </div>
                <div className={`flex justify-between items-center py-3 px-3 rounded-lg font-bold ${d.runway >= 3 ? "bg-emerald-50" : d.runway >= 1 ? "bg-amber-50" : "bg-red-100"}`}>
                  <span className="text-sm text-gray-800">Runway</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-mono ${d.runway >= 3 ? "text-emerald-700" : d.runway >= 1 ? "text-amber-700" : "text-red-600"}`}>
                      {d.runway.toFixed(1)} meses
                    </span>
                    {d.runway < 3 && (
                      <Badge variant="destructive" className="text-xs">
                        {d.runway < 1 ? "CRITICO" : "BAJO"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Trend Charts ───────────────────────────────── */}
        {d.trends.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TrendChart
              data={d.trends}
              dataKeys={[
                { key: "ventasMes", name: "Ventas" },
                { key: "ebitOperativo", name: "EBIT" },
              ]}
              colors={["#3b82f6", "#10b981"]}
              title="Ventas & EBIT (12 meses)"
            />
            <CashflowChart data={d.trends} />
            <TrendChart
              data={d.trends}
              dataKeys={[
                { key: "totalActivo", name: "Activo" },
                { key: "totalPasivo", name: "Pasivo" },
              ]}
              colors={["#3b82f6", "#ef4444"]}
              title="Activo vs Pasivo (12 meses)"
            />
            <TrendChart
              data={d.trends}
              dataKeys={[
                { key: "balanceNeto", name: "Balance Neto" },
              ]}
              colors={["#8b5cf6"]}
              title="Balance Neto (12 meses)"
            />
          </div>
        )}

        {/* ─── Provisiones (informativo) ──────────────────── */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Provisiones & Pasivos específicos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">Impuestos USA</div>
                <div className="text-sm font-mono font-semibold">{fmtFull(d.impuestosUsa)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">IVA Compras</div>
                <div className="text-sm font-mono font-semibold">{fmtFull(d.ivaCompras)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">Facturación Adelantada</div>
                <div className="text-sm font-mono font-semibold">{fmtFull(d.facturacionAdelantada)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">Cuentas a Pagar</div>
                <div className="text-sm font-mono font-semibold">{fmtFull(d.cuentasPagarUsd)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Footer ─────────────────────────────────────── */}
        <div className="text-center text-xs text-gray-400 pb-4">
          Fuente: Google Sheets "Resumen Ejecutivo" → monthly_financial_summary
        </div>
      </div>
    </TooltipProvider>
  );
}
