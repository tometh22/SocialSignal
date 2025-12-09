import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, Info, TrendingDown, 
  Wallet, PiggyBank, Building2, RefreshCw, ArrowDown, ArrowUp, Activity
} from "lucide-react";
import { motion } from "framer-motion";

interface FinanzasViewProps {
  selectedPeriod: string;
}

export default function FinanzasView({ selectedPeriod }: FinanzasViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/v1/executive/finanzas", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/v1/executive/finanzas?period=${selectedPeriod}`);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="h-5 w-5 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-500">Cargando datos financieros...</span>
      </div>
    );
  }

  const fin = data || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* TIER 1: HERO KPIs - Facturado, EBIT Contable, Cash Flow */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-4 border-0 shadow-lg bg-gradient-to-br from-violet-50 to-purple-50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-purple-700 uppercase tracking-wide">
                    Facturado
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-purple-500" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs font-medium mb-1">Facturado</p>
                      <p className="text-xs text-gray-300">Ingresos facturados en el período</p>
                      <p className="text-xs text-gray-400 mt-1">Fuente: monthly_financial_summary</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-gray-600 mb-2">Ingresos contables</p>
                <div className="text-3xl font-bold text-purple-800" data-testid="metric-facturado">
                  {formatCurrency(fin.facturadoUsd || 0)}
                </div>
              </div>
              <div className="p-2.5 bg-purple-100 rounded-full">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`col-span-12 md:col-span-4 border-0 shadow-lg ${
          (fin.ebitContableUsd || 0) >= 0 
            ? 'bg-gradient-to-br from-violet-50 to-purple-50' 
            : 'bg-gradient-to-br from-red-50 to-rose-50'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium uppercase tracking-wide ${
                    (fin.ebitContableUsd || 0) >= 0 ? 'text-purple-700' : 'text-red-700'
                  }`}>
                    EBIT Contable
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className={`h-4 w-4 ${(fin.ebitContableUsd || 0) >= 0 ? 'text-purple-500' : 'text-red-400'}`} />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs font-medium mb-1">EBIT Contable</p>
                      <p className="text-xs text-gray-300">= Facturado - Directos - Overhead - Provisiones</p>
                      <p className="text-xs text-gray-400 mt-1">Incluye provisiones e impuestos</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-gray-600 mb-2">Resultado contable</p>
                <div className={`text-3xl font-bold ${
                  (fin.ebitContableUsd || 0) >= 0 ? 'text-purple-800' : 'text-red-700'
                }`} data-testid="metric-ebit-contable">
                  {formatCurrency(fin.ebitContableUsd || 0)}
                  <span className="text-base font-normal ml-1 opacity-80">
                    ({formatPct(fin.margenContablePct || 0)})
                  </span>
                </div>
              </div>
              <div className={`p-2.5 rounded-full ${(fin.ebitContableUsd || 0) >= 0 ? 'bg-purple-100' : 'bg-red-100'}`}>
                {(fin.ebitContableUsd || 0) >= 0 ? (
                  <ArrowUpRight className="h-6 w-6 text-purple-600" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`col-span-12 md:col-span-4 border-0 shadow-lg ${
          (fin.cashFlowNetoUsd || 0) >= 0 
            ? 'bg-gradient-to-br from-green-50 to-emerald-50' 
            : 'bg-gradient-to-br from-orange-50 to-amber-50'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium uppercase tracking-wide ${
                    (fin.cashFlowNetoUsd || 0) >= 0 ? 'text-green-700' : 'text-orange-700'
                  }`}>
                    Cash Flow Neto
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className={`h-4 w-4 ${(fin.cashFlowNetoUsd || 0) >= 0 ? 'text-green-500' : 'text-orange-500'}`} />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs font-medium mb-1">Cash Flow Neto</p>
                      <p className="text-xs text-gray-300">= Cash In - Cash Out</p>
                      <p className="text-xs text-gray-400 mt-1">Fuente: cash_movements</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-gray-600 mb-2">Flujo de caja</p>
                <div className={`text-3xl font-bold ${
                  (fin.cashFlowNetoUsd || 0) >= 0 ? 'text-green-800' : 'text-orange-800'
                }`} data-testid="metric-cashflow-neto">
                  {formatCurrency(fin.cashFlowNetoUsd || 0)}
                </div>
              </div>
              <div className={`p-2.5 rounded-full ${(fin.cashFlowNetoUsd || 0) >= 0 ? 'bg-green-100' : 'bg-orange-100'}`}>
                <Activity className={`h-6 w-6 ${(fin.cashFlowNetoUsd || 0) >= 0 ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 2: DESGLOSE COSTOS CONTABLES */}
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Directos</span>
              <Info className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800" data-testid="metric-directos-fin">
              {formatCurrency(fin.directosUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Overhead</span>
              <Info className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800" data-testid="metric-overhead-fin">
              {formatCurrency(fin.overheadUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-700 uppercase">Provisiones</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-amber-500" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">Provisiones e impuestos</p>
                  <p className="text-xs text-gray-400">Fuente: pl_adjustments</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-amber-800" data-testid="metric-provisiones">
              {formatCurrency(fin.provisionesUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-700 uppercase">Burn Rate</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-red-500" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">= Directos + Overhead + Provisiones</p>
                  <p className="text-xs text-gray-400">Total gastos mensuales</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-red-800" data-testid="metric-burn-rate">
              {formatCurrency(fin.burnRateUsd || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 3: CASHFLOW Y BALANCE */}
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-6 md:col-span-2 border-0 shadow-sm bg-green-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDown className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-700">Cash In</span>
            </div>
            <div className="text-lg font-bold text-green-800" data-testid="metric-cash-in">
              {formatCurrency(fin.cashInUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-2 border-0 shadow-sm bg-red-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <ArrowUp className="h-3.5 w-3.5 text-red-600" />
              <span className="text-xs font-medium text-red-700">Cash Out</span>
            </div>
            <div className="text-lg font-bold text-red-800" data-testid="metric-cash-out">
              {formatCurrency(fin.cashOutUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-2 border-0 shadow-sm bg-slate-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Wallet className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Caja</span>
            </div>
            <div className={`text-lg font-bold ${(fin.cajaTotalUsd || 0) >= 0 ? 'text-slate-800' : 'text-red-700'}`} 
                 data-testid="metric-caja-total">
              {formatCurrency(fin.cajaTotalUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-2 border-0 shadow-sm bg-slate-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Runway</span>
            </div>
            <div className={`text-lg font-bold ${(fin.runwayMeses || 0) >= 3 ? 'text-slate-800' : 'text-red-700'}`} 
                 data-testid="metric-runway">
              {(fin.runwayMeses || 0).toFixed(1)}m
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-2 border-0 shadow-sm bg-slate-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Building2 className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Activo</span>
            </div>
            <div className="text-lg font-bold text-slate-800" data-testid="metric-activo">
              {formatCurrency(fin.activoTotalUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-2 border-0 shadow-sm bg-slate-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <PiggyBank className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Patrimonio</span>
            </div>
            <div className={`text-lg font-bold ${(fin.patrimonioUsd || 0) >= 0 ? 'text-slate-800' : 'text-red-700'}`}
                 data-testid="metric-patrimonio">
              {formatCurrency(fin.patrimonioUsd || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nota de contexto */}
      <div className="text-center text-xs text-gray-400 pt-2">
        Vista Finanzas: Resultado contable + flujo de caja. Incluye todas las provisiones e impuestos.
      </div>
    </motion.div>
  );
}
