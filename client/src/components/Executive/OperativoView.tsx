import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, Info, Clock, Users, 
  Briefcase, RefreshCw, DollarSign, Activity
} from "lucide-react";
import { motion } from "framer-motion";
import AlertsBanner from "./AlertsBanner";
import { Sparkline } from "./KpiCard";
import { ChartCard, LineChartSimple, StackedBarChart, HorizontalBarChart, PieChartSimple } from "./ChartCard";

interface OperativoViewProps {
  selectedPeriod: string;
}

export default function OperativoView({ selectedPeriod }: OperativoViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/v1/executive/operativo", selectedPeriod],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/executive/operativo?period=${selectedPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch operativo data');
      return res.json();
    },
    staleTime: 60000,
  });

  const formatCurrency = (value: number, decimals = 1) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(decimals)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPct = (value: number) => `${value.toFixed(0)}%`;

  const VariationBadge = ({ value, label }: { value: number | null | undefined; label?: string }) => {
    if (value == null) {
      return (
        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          —%
        </span>
      );
    }
    const isPositive = value >= 0;
    return (
      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
        isPositive 
          ? 'bg-emerald-100 text-emerald-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        {isPositive ? '+' : ''}{value.toFixed(0)}%{label ? ` ${label}` : ''}
      </span>
    );
  };

  const Variation3mBadge = ({ diff }: { diff: { vsPrevMonth: number | null; vs3mAvg: number | null } | undefined }) => {
    if (!diff?.vs3mAvg) return null;
    const v = diff.vs3mAvg;
    const isPositive = v >= 0;
    return (
      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ml-1 ${
        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
      }`}>
        {isPositive ? '↑' : '↓'}{Math.abs(v).toFixed(0)}% vs 3m
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="ml-3 text-gray-500 font-medium">Cargando datos operativos...</span>
      </div>
    );
  }

  const op = data || {};
  const alerts = op.alerts || [];
  const trends = op.trends || {};
  const breakdowns = op.breakdowns || {};
  const diffs = op.diffs || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      {/* ALERTAS OPERATIVAS */}
      <AlertsBanner alerts={alerts} viewName="Vista Operativa" />

      {/* NIVEL 1: MACRO KPIs — Devengado + EBIT Operativo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Devengado */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-emerald-50 via-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                    Devengado
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-emerald-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">
                      <p className="text-xs font-medium mb-1">Devengado</p>
                      <p className="text-xs text-gray-300">Suma de fact_rc_month.revenue_usd</p>
                      <p className="text-xs text-gray-400 mt-1">Ingreso productivo del período</p>
                    </TooltipContent>
                  </Tooltip>
                  <VariationBadge value={op.devengadoVariation} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-emerald-800 tracking-tight" data-testid="metric-devengado">
                    {formatCurrency(op.devengadoUsd || 0)}
                  </span>
                  <Variation3mBadge diff={diffs.devengado} />
                </div>
                <p className="text-sm text-gray-500 mt-2">Ingreso productivo del período</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="p-3 bg-emerald-100/80 rounded-2xl">
                  <DollarSign className="h-7 w-7 text-emerald-600" />
                </div>
                {trends.devengado && <Sparkline data={trends.devengado.values} color="#10b981" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EBIT Operativo */}
        <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
          (op.ebitOperativoUsd || 0) >= 0 
            ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-white' 
            : 'bg-gradient-to-br from-red-50 via-rose-50 to-white'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                    (op.ebitOperativoUsd || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    EBIT Operativo
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className={`h-3.5 w-3.5 ${(op.ebitOperativoUsd || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">
                      <p className="text-xs font-medium mb-1">EBIT Operativo</p>
                      <p className="text-xs text-gray-300">= Devengado − Directos</p>
                      <p className="text-xs text-gray-400 mt-1">Sin overhead ni provisiones</p>
                    </TooltipContent>
                  </Tooltip>
                  <VariationBadge value={op.ebitVariation} />
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className={`text-4xl font-bold tracking-tight ${
                    (op.ebitOperativoUsd || 0) >= 0 ? 'text-emerald-800' : 'text-red-700'
                  }`} data-testid="metric-ebit-operativo">
                    {formatCurrency(op.ebitOperativoUsd || 0)}
                  </span>
                  <span className={`text-lg font-medium ${
                    (op.margenOperativoPct || 0) >= 50 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {formatPct(op.margenOperativoPct || 0)} margen
                  </span>
                  <Variation3mBadge diff={diffs.ebitOperativo} />
                </div>
                <p className="text-sm text-gray-500 mt-2">Productividad neta del equipo</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`p-3 rounded-2xl ${(op.ebitOperativoUsd || 0) >= 0 ? 'bg-emerald-100/80' : 'bg-red-100/80'}`}>
                  {(op.ebitOperativoUsd || 0) >= 0 ? (
                    <TrendingUp className="h-7 w-7 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-7 w-7 text-red-600" />
                  )}
                </div>
                {trends.ebitOperativo && <Sparkline data={trends.ebitOperativo.values} color="#10b981" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 2: DRIVERS — Métricas que explican el KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Tarifa Efectiva */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Tarifa efectiva</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">= Devengado / Horas facturables</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-gray-800" data-testid="metric-tarifa-efectiva">
              ${(op.tarifaEfectivaUsd || 0).toFixed(0)}
              <span className="text-sm font-normal text-gray-500">/h</span>
            </div>
            <div className="mt-2 h-1 bg-gray-100 rounded-full">
              <div 
                className="h-1 bg-emerald-500 rounded-full" 
                style={{ width: `${Math.min((op.tarifaEfectivaUsd || 0) / 100 * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Markup */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Markup</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">= Devengado / Directos</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${
              (op.markupOperativo || 0) >= 3 ? 'text-emerald-700' : 'text-amber-600'
            }`} data-testid="metric-markup">
              {(op.markupOperativo || 0).toFixed(1)}x
            </div>
            <p className="text-xs text-gray-400 mt-1">multiplicador</p>
          </CardContent>
        </Card>

        {/* % Facturable */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">% Facturable</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">= Horas facturables / Horas totales</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${
              (op.horasFacturablesPct || 0) >= 70 ? 'text-emerald-700' : 
              (op.horasFacturablesPct || 0) >= 50 ? 'text-amber-600' : 'text-red-600'
            }`} data-testid="metric-billable-ratio">
              {formatPct(op.horasFacturablesPct || 0)}
            </div>
            <Progress 
              value={op.horasFacturablesPct || 0} 
              className={`h-1.5 mt-2 ${
                (op.horasFacturablesPct || 0) >= 70 ? '[&>div]:bg-emerald-500' : 
                (op.horasFacturablesPct || 0) >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
              }`} 
            />
          </CardContent>
        </Card>

        {/* Directos */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Directos</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">Costo del equipo asignado a proyectos</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-700" data-testid="metric-directos">
                {formatCurrency(op.directosUsd || 0)}
              </span>
              {diffs.directos?.vs3mAvg && (
                <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                  diffs.directos.vs3mAvg > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {diffs.directos.vs3mAvg > 0 ? '↑' : '↓'}{Math.abs(diffs.directos.vs3mAvg).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">costos equipo</p>
          </CardContent>
        </Card>

        {/* Horas */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Horas</span>
              <Clock className="h-3 w-3 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-700" data-testid="metric-hours-total">
              {(op.horasTrabajadas || 0).toFixed(0)}h
            </div>
            <p className="text-xs text-gray-400 mt-1">trabajadas</p>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 3: CONTEXTO — Info adicional pequeña */}
      <div className="flex items-center justify-center gap-6 py-3 px-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800" data-testid="metric-people-active">{op.personasActivas || 0}</span> personas
          </span>
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800" data-testid="metric-projects-active">{op.proyectosActivos || 0}</span> proyectos
          </span>
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500 italic">Vista Operativa: Productividad del equipo. Sin overhead ni provisiones</span>
        </div>
      </div>

      {/* EVOLUCIÓN OPERATIVA — Gráficos de tendencia */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          Evolución Operativa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.horas && (
            <ChartCard 
              title="Horas Facturables vs No Facturables" 
              subtitle="Últimos 12 meses"
              tooltip="Distribución de horas productivas vs no productivas"
              color="emerald"
            >
              <StackedBarChart 
                data={trends.horas}
                colors={{ billable: '#10b981', nonBillable: '#fbbf24' }}
                labels={{ billable: 'Facturables', nonBillable: 'No facturables' }}
                formatValue={(v) => `${v.toFixed(0)}h`}
              />
            </ChartCard>
          )}

          {trends.devengado && (
            <ChartCard 
              title="Devengado Mensual" 
              subtitle="Tendencia de ingresos productivos"
              tooltip="Evolución del ingreso devengado"
              color="emerald"
            >
              <LineChartSimple 
                data={trends.devengado}
                color="#10b981"
                showArea
              />
            </ChartCard>
          )}

          {trends.tarifaEfectiva && (
            <ChartCard 
              title="Tarifa Efectiva" 
              subtitle="$/hora facturable"
              tooltip="Precio promedio por hora facturada"
              color="emerald"
            >
              <LineChartSimple 
                data={trends.tarifaEfectiva}
                color="#059669"
                formatValue={(v) => `$${v.toFixed(0)}/h`}
              />
            </ChartCard>
          )}

          {breakdowns?.horasPorPersona && breakdowns.horasPorPersona.length > 0 && (
            <ChartCard 
              title="Horas por Persona" 
              subtitle="Distribución del equipo"
              tooltip="Top personas por horas trabajadas"
              color="emerald"
            >
              <HorizontalBarChart 
                data={breakdowns.horasPorPersona}
                color="#10b981"
                formatValue={(v) => `${v.toFixed(0)}h`}
              />
            </ChartCard>
          )}
        </div>
      </div>
    </motion.div>
  );
}
