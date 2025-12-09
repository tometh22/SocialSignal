import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, Info, TrendingDown, 
  Wallet, PiggyBank, Building2, RefreshCw, ArrowDown, ArrowUp
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
      className="grid grid-cols-12 gap-4"
    >
      {/* FILA 1: HERO KPIs - Facturado + EBIT Contable */}
      <Card className="col-span-12 md:col-span-6 border-0 shadow-lg bg-gradient-to-br from-[#F4E8FF] to-white">
        <CardContent className="p-6">
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
                    <p className="text-xs text-gray-400 mt-1">Fuente: monthly_financial_summary (Excel Maestro)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-600 mb-3">Ingresos contables del período</p>
              <div className="text-3xl font-semibold text-purple-800" data-testid="metric-facturado">
                {formatCurrency(fin.facturadoUsd || 0)}
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`col-span-12 md:col-span-6 border-0 shadow-lg ${
        (fin.ebitContableUsd || 0) >= 0 
          ? 'bg-gradient-to-br from-[#F4E8FF] to-white' 
          : 'bg-gradient-to-br from-[#FFEAEA] to-white'
      }`}>
        <CardContent className="p-6">
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
                    <p className="text-xs text-gray-400 mt-1">Incluye provisiones contables e impuestos</p>
                    <p className="text-xs text-gray-400">Fuente: pl_adjustments</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-600 mb-3">Resultado contable</p>
              <div className={`text-3xl font-semibold ${
                (fin.ebitContableUsd || 0) >= 0 ? 'text-purple-800' : 'text-red-700'
              }`} data-testid="metric-ebit-contable">
                {formatCurrency(fin.ebitContableUsd || 0)}
                <span className="text-lg font-normal ml-2">
                  ({formatPct(fin.margenContablePct || 0)})
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">= Facturado – Directos – Overhead – Provisiones</p>
            </div>
            <div className={`p-3 rounded-full ${(fin.ebitContableUsd || 0) >= 0 ? 'bg-purple-100' : 'bg-red-100'}`}>
              {(fin.ebitContableUsd || 0) >= 0 ? (
                <ArrowUpRight className="h-6 w-6 text-purple-600" />
              ) : (
                <ArrowDownRight className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FILA 2: DESGLOSE COSTOS CONTABLES */}
      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Directos</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs text-gray-300">Costos directos de equipo</p>
                <p className="text-xs text-gray-400">Fuente: fact_cost_month</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-xl font-bold text-gray-800" data-testid="metric-directos-fin">
            {formatCurrency(fin.directosUsd || 0)}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Overhead</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs text-gray-300">Costos indirectos</p>
                <p className="text-xs text-gray-400">Fuente: fact_cost_month</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-xl font-bold text-gray-800" data-testid="metric-overhead-fin">
            {formatCurrency(fin.overheadUsd || 0)}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Provisiones</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs text-gray-300">Provisiones e impuestos</p>
                <p className="text-xs text-gray-400">Fuente: pl_adjustments</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-xl font-bold text-gray-800" data-testid="metric-provisiones">
            {formatCurrency(fin.provisionesUsd || 0)}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-amber-700">Burn Rate</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-amber-500" /></TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs text-gray-300">= Directos + Overhead + Provisiones</p>
                <p className="text-xs text-gray-400">Total gastos mensuales</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-xl font-bold text-amber-800" data-testid="metric-burn-rate">
            {formatCurrency(fin.burnRateUsd || 0)}
          </div>
        </CardContent>
      </Card>

      {/* FILA 3: CASHFLOW */}
      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-green-700">Cash In</span>
            <ArrowDown className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-xl font-bold text-green-800" data-testid="metric-cash-in">
            {formatCurrency(fin.cashInUsd || 0)}
          </div>
          <p className="text-xs text-green-600 mt-1">Ingresos de caja</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-red-700">Cash Out</span>
            <ArrowUp className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-800" data-testid="metric-cash-out">
            {formatCurrency(fin.cashOutUsd || 0)}
          </div>
          <p className="text-xs text-red-600 mt-1">Egresos de caja</p>
        </CardContent>
      </Card>

      <Card className={`col-span-12 md:col-span-4 border-0 shadow-md ${
        (fin.cashFlowNetoUsd || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${
              (fin.cashFlowNetoUsd || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'
            }`}>Cash Flow Neto</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs text-gray-300">= Cash In - Cash Out</p>
                <p className="text-xs text-gray-400">Fuente: cash_movements</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-xl font-bold ${
            (fin.cashFlowNetoUsd || 0) >= 0 ? 'text-blue-800' : 'text-orange-800'
          }`} data-testid="metric-cashflow-neto">
            {formatCurrency(fin.cashFlowNetoUsd || 0)}
          </div>
        </CardContent>
      </Card>

      {/* FILA 4: BALANCE Y RUNWAY */}
      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Caja Total</span>
          </div>
          <div className={`text-xl font-bold ${(fin.cajaTotalUsd || 0) >= 0 ? 'text-slate-800' : 'text-red-700'}`} 
               data-testid="metric-caja-total">
            {formatCurrency(fin.cajaTotalUsd || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Snapshot Excel Maestro</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Runway</span>
          </div>
          <div className="text-xl font-bold text-slate-800" data-testid="metric-runway">
            {(fin.runwayMeses || 0).toFixed(1)} meses
          </div>
          <p className="text-xs text-slate-500 mt-1">= Caja / Burn Rate</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Activo Total</span>
          </div>
          <div className="text-xl font-bold text-slate-800" data-testid="metric-activo">
            {formatCurrency(fin.activoTotalUsd || 0)}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-3 border-0 shadow-md bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Patrimonio</span>
          </div>
          <div className={`text-xl font-bold ${(fin.patrimonioUsd || 0) >= 0 ? 'text-slate-800' : 'text-red-700'}`}
               data-testid="metric-patrimonio">
            {formatCurrency(fin.patrimonioUsd || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">= Activo - Pasivo</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
