import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, Info, TrendingDown, 
  Wallet, PiggyBank, Building2, RefreshCw, ArrowDown, ArrowUp, Activity, Timer
} from "lucide-react";
import { motion } from "framer-motion";
import AlertsBanner from "./AlertsBanner";
import { Sparkline } from "./KpiCard";
import { ChartCard, LineChartSimple, CashFlowBarChart, GroupedBarChart, PieChartSimple } from "./ChartCard";

interface FinanzasViewProps {
  selectedPeriod: string;
}

export default function FinanzasView({ selectedPeriod }: FinanzasViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/v1/executive/finanzas", selectedPeriod],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/executive/finanzas?period=${selectedPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch finanzas data');
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

  const VariationBadge = ({ value }: { value: number | null }) => {
    if (value === null) {
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
          ? 'bg-violet-100 text-violet-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        {isPositive ? '+' : ''}{value.toFixed(0)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-violet-600" />
        <span className="ml-3 text-gray-500 font-medium">Cargando datos financieros...</span>
      </div>
    );
  }

  const fin = data || {};
  const alerts = fin.alerts || [];
  const trends = fin.trends || {};
  const breakdowns = fin.breakdowns || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      {/* ALERTAS FINANCIERAS */}
      <AlertsBanner alerts={alerts} viewName="Vista Finanzas" />

      {/* NIVEL 1: MACRO KPIs — Facturado, EBIT Contable, Cash Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Facturado */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-violet-50 via-purple-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                    Facturado
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-violet-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs font-medium mb-1">Facturado</p>
                      <p className="text-xs text-gray-300">Ingresos contables del período</p>
                    </TooltipContent>
                  </Tooltip>
                  <VariationBadge value={fin.facturadoVariation} />
                </div>
                <div className="text-3xl font-bold text-violet-800 tracking-tight" data-testid="metric-facturado">
                  {formatCurrency(fin.facturadoUsd || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">ingresos contables</p>
              </div>
              <div className="p-2.5 bg-violet-100/80 rounded-xl">
                <DollarSign className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EBIT Contable */}
        <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
          (fin.ebitContableUsd || 0) >= 0 
            ? 'bg-gradient-to-br from-violet-50 via-purple-50 to-white' 
            : 'bg-gradient-to-br from-red-50 via-rose-50 to-white'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                    (fin.ebitContableUsd || 0) >= 0 ? 'text-violet-600' : 'text-red-600'
                  }`}>
                    EBIT Contable
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className={`h-3.5 w-3.5 ${(fin.ebitContableUsd || 0) >= 0 ? 'text-violet-400' : 'text-red-400'}`} />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">
                      <p className="text-xs font-medium mb-1">EBIT Contable</p>
                      <p className="text-xs text-gray-300">= Facturado − Directos − Overhead − Provisiones</p>
                      <p className="text-xs text-gray-400 mt-1">Incluye provisiones e impuestos.</p>
                    </TooltipContent>
                  </Tooltip>
                  <VariationBadge value={fin.ebitVariation} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold tracking-tight ${
                    (fin.ebitContableUsd || 0) >= 0 ? 'text-violet-800' : 'text-red-700'
                  }`} data-testid="metric-ebit-contable">
                    {formatCurrency(fin.ebitContableUsd || 0)}
                  </span>
                  <span className="text-sm font-medium text-gray-500">
                    ({formatPct(fin.margenContablePct || 0)})
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">resultado contable</p>
              </div>
              <div className={`p-2.5 rounded-xl ${(fin.ebitContableUsd || 0) >= 0 ? 'bg-violet-100/80' : 'bg-red-100/80'}`}>
                {(fin.ebitContableUsd || 0) >= 0 ? (
                  <ArrowUpRight className="h-6 w-6 text-violet-600" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Neto */}
        <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
          (fin.cashFlowNetoUsd || 0) >= 0 
            ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-white' 
            : 'bg-gradient-to-br from-amber-50 via-orange-50 to-white'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                    (fin.cashFlowNetoUsd || 0) >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    Cash Flow Neto
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className={`h-3.5 w-3.5 ${(fin.cashFlowNetoUsd || 0) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs font-medium mb-1">Cash Flow Neto</p>
                      <p className="text-xs text-gray-300">= Cash In − Cash Out</p>
                    </TooltipContent>
                  </Tooltip>
                  <VariationBadge value={fin.cashFlowVariation} />
                </div>
                <div className={`text-3xl font-bold tracking-tight ${
                  (fin.cashFlowNetoUsd || 0) >= 0 ? 'text-emerald-800' : 'text-amber-700'
                }`} data-testid="metric-cashflow-neto">
                  {formatCurrency(fin.cashFlowNetoUsd || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">flujo de caja</p>
              </div>
              <div className={`p-2.5 rounded-xl ${(fin.cashFlowNetoUsd || 0) >= 0 ? 'bg-emerald-100/80' : 'bg-amber-100/80'}`}>
                <Activity className={`h-6 w-6 ${(fin.cashFlowNetoUsd || 0) >= 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 2: DRIVERS CONTABLES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Directos */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Directos</span>
              <Info className="h-3 w-3 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-700" data-testid="metric-directos-fin">
              {formatCurrency(fin.directosUsd || 0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">equipo</p>
          </CardContent>
        </Card>

        {/* Overhead */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Overhead</span>
              <Info className="h-3 w-3 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-700" data-testid="metric-overhead-fin">
              {formatCurrency(fin.overheadUsd || 0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">indirectos</p>
          </CardContent>
        </Card>

        {/* Provisiones */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-amber-50/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Provisiones</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-amber-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">Provisiones e impuestos</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-amber-700" data-testid="metric-provisiones">
              {formatCurrency(fin.provisionesUsd || 0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">impuestos</p>
          </CardContent>
        </Card>

        {/* Burn Rate */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-red-50/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-red-600 uppercase tracking-wide">Burn Rate</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-red-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[220px]">
                  <p className="text-xs font-medium mb-1">Burn Rate</p>
                  <p className="text-xs text-gray-300">= Directos + Overhead + Provisiones</p>
                  <p className="text-xs text-gray-400 mt-1">Gasto total mensual</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-red-700" data-testid="metric-burn-rate">
              {formatCurrency(fin.burnRateUsd || 0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">gasto total</p>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 3: CAJA Y RUNWAY (destacado tipo Stripe) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-gray-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-200 rounded-lg">
                <Wallet className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-slate-500 uppercase">Caja Total</p>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3 w-3 text-slate-400" /></TooltipTrigger>
                    <TooltipContent className="max-w-[220px]">
                      <p className="text-xs font-medium mb-1">Caja Total</p>
                      <p className="text-xs text-gray-300">Snapshot del Excel Maestro</p>
                      <p className="text-xs text-gray-400 mt-1">monthly_financial_summary.caja_total</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className={`text-2xl font-bold ${(fin.cajaTotalUsd || 0) >= 0 ? 'text-slate-800' : 'text-red-700'}`}
                   data-testid="metric-caja-total">
                  {formatCurrency(fin.cajaTotalUsd || 0)}
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <ArrowDown className="h-4 w-4 text-emerald-500" />
                <span className="text-gray-600">In:</span>
                <span className="font-medium text-emerald-700" data-testid="metric-cash-in">
                  {formatCurrency(fin.cashInUsd || 0)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowUp className="h-4 w-4 text-red-500" />
                <span className="text-gray-600">Out:</span>
                <span className="font-medium text-red-700" data-testid="metric-cash-out">
                  {formatCurrency(fin.cashOutUsd || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-md ${
          (fin.runwayMeses || 0) < 3 
            ? 'bg-gradient-to-br from-red-50 to-orange-50 ring-2 ring-red-200' 
            : 'bg-gradient-to-br from-slate-50 to-gray-100'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${(fin.runwayMeses || 0) >= 3 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <Timer className={`h-5 w-5 ${(fin.runwayMeses || 0) >= 3 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-slate-500 uppercase">Runway</p>
                  {(fin.runwayMeses || 0) < 3 && (fin.runwayMeses || 0) > 0 && (
                    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white animate-pulse">
                      CRÍTICO
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold ${(fin.runwayMeses || 0) >= 3 ? 'text-slate-800' : 'text-red-700'}`}
                   data-testid="metric-runway">
                  {(fin.runwayMeses || 0).toFixed(1)} meses
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger className="w-full">
                <p className="text-xs text-gray-500 text-left">
                  = Caja Total / Burn Rate
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <p className="text-xs text-gray-300">Runway = Caja Total / Burn Rate</p>
                <p className="text-xs text-gray-400 mt-1">Incluye todos los costos contables (directos + overhead + provisiones)</p>
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 4: ESTRUCTURA FINANCIERA */}
      <div className="p-4 bg-gray-50 rounded-xl">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Estructura Financiera</p>
        <p className="text-[10px] text-gray-400 mb-3">Basado en Excel Maestro – Resumen Ejecutivo</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Activo</span>
            </div>
            <p className="text-lg font-bold text-gray-800" data-testid="metric-activo">
              {formatCurrency(fin.activoTotalUsd || 0)}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingDown className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Pasivo</span>
            </div>
            <p className="text-lg font-bold text-gray-700" data-testid="metric-pasivo">
              {formatCurrency(fin.pasivoTotalUsd || 0)}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <PiggyBank className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Patrimonio</span>
            </div>
            <p className={`text-lg font-bold ${(fin.patrimonioUsd || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
               data-testid="metric-patrimonio">
              {formatCurrency(fin.patrimonioUsd || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* EVOLUCIÓN FINANCIERA — Gráficos de tendencia */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-violet-600" />
          Evolución Financiera
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.cashFlowNeto && (
            <ChartCard 
              title="Cash Flow Neto" 
              subtitle="Últimos 12 meses"
              tooltip="Flujo de caja mensual (verde=positivo, rojo=negativo)"
              color="violet"
            >
              <CashFlowBarChart data={trends.cashFlowNeto} />
            </ChartCard>
          )}

          {trends.cashflow && (
            <ChartCard 
              title="Cash In vs Cash Out" 
              subtitle="Ingresos y egresos"
              tooltip="Comparación de movimientos de caja"
              color="violet"
            >
              <GroupedBarChart 
                data={trends.cashflow}
                colors={{ cashIn: '#10b981', cashOut: '#ef4444' }}
                labels={{ cashIn: 'Ingresos', cashOut: 'Egresos' }}
              />
            </ChartCard>
          )}

          {trends.ebitContable && (
            <ChartCard 
              title="EBIT Contable" 
              subtitle="Resultado mensual"
              tooltip="Evolución del beneficio contable"
              color="violet"
            >
              <LineChartSimple 
                data={trends.ebitContable}
                color="#8b5cf6"
                showArea
              />
            </ChartCard>
          )}

          {breakdowns?.estructuraFinanciera && breakdowns.estructuraFinanciera.length > 0 && (
            <ChartCard 
              title="Estructura Financiera" 
              subtitle="Activo / Pasivo / Patrimonio"
              tooltip="Composición del balance"
              color="violet"
            >
              <PieChartSimple 
                data={breakdowns.estructuraFinanciera}
                colors={['#8b5cf6', '#f97316', '#10b981']}
              />
            </ChartCard>
          )}
        </div>
      </div>

      {/* Nota */}
      <div className="flex items-center justify-center gap-6 py-3 px-4 bg-gray-50 rounded-xl mt-4">
        <span className="text-xs text-gray-500 italic">Vista Finanzas: Resultado contable + flujo de caja. Incluye provisiones e impuestos.</span>
      </div>
    </motion.div>
  );
}
