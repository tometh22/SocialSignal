import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, Info, Users, Briefcase, RefreshCw, DollarSign
} from "lucide-react";
import { motion } from "framer-motion";

interface EconomicoViewProps {
  selectedPeriod: string;
}

export default function EconomicoView({ selectedPeriod }: EconomicoViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/v1/executive/economico", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/v1/executive/economico?period=${selectedPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch economico data');
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
        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-500">Cargando datos económicos...</span>
      </div>
    );
  }

  const ec = data || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-12 gap-4"
    >
      {/* FILA 1: HERO KPIs - Devengado + EBIT Económico */}
      <Card className="col-span-12 md:col-span-6 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-slate-50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-blue-700 uppercase tracking-wide">
                  Devengado
                </span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-blue-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs font-medium mb-1">Devengado</p>
                    <p className="text-xs text-gray-300">= Facturado - Provisión Facturación Adelantada</p>
                    <p className="text-xs text-gray-400 mt-1">Fuente: monthly_financial_summary</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-600 mb-3">Ingreso devengado del período</p>
              <div className="text-3xl font-semibold text-blue-800" data-testid="metric-devengado-eco">
                {formatCurrency(ec.devengadoUsd || 0)}
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`col-span-12 md:col-span-6 border-0 shadow-lg ${
        (ec.ebitEconomicoUsd || 0) >= 0 
          ? 'bg-gradient-to-br from-blue-50 to-slate-50' 
          : 'bg-gradient-to-br from-red-50 to-white'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium uppercase tracking-wide ${
                  (ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                }`}>
                  EBIT Económico
                </span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className={`h-4 w-4 ${(ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-500' : 'text-red-400'}`} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs font-medium mb-1">EBIT Económico</p>
                    <p className="text-xs text-gray-300">= Devengado - Directos - Overhead</p>
                    <p className="text-xs text-gray-400 mt-1">Nota: NO incluye provisiones contables</p>
                    <p className="text-xs text-gray-400">Fuente: fact_cost_month</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-600 mb-3">Resultado operativo real</p>
              <div className={`text-3xl font-semibold ${
                (ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-800' : 'text-red-700'
              }`} data-testid="metric-ebit-economico">
                {formatCurrency(ec.ebitEconomicoUsd || 0)}
                <span className="text-lg font-normal ml-2">
                  ({formatPct(ec.margenEconomicoPct || 0)})
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">= Devengado – Directos – Overhead</p>
            </div>
            <div className={`p-3 rounded-full ${(ec.ebitEconomicoUsd || 0) >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
              {(ec.ebitEconomicoUsd || 0) >= 0 ? (
                <ArrowUpRight className="h-6 w-6 text-blue-600" />
              ) : (
                <ArrowDownRight className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FILA 2: DESGLOSE DE COSTOS */}
      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Costos Directos</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs font-medium mb-1">Costos Directos</p>
                <p className="text-xs text-gray-300">Costos de equipo asignados a proyectos</p>
                <p className="text-xs text-gray-400">Fuente: fact_cost_month.direct_usd</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-bold text-gray-800" data-testid="metric-directos-eco">
            {formatCurrency(ec.directosUsd || 0)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Equipo en proyectos</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Overhead</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs font-medium mb-1">Overhead</p>
                <p className="text-xs text-gray-300">Costos indirectos de operación</p>
                <p className="text-xs text-gray-400">Fuente: fact_cost_month.indirect_usd</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-bold text-gray-800" data-testid="metric-overhead-eco">
            {formatCurrency(ec.overheadUsd || 0)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Costos indirectos</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Margen Económico</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs font-medium mb-1">Margen Económico</p>
                <p className="text-xs text-gray-300">= EBIT Económico / Devengado</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-2xl font-bold ${
            (ec.margenEconomicoPct || 0) >= 20 ? 'text-blue-700' : 'text-amber-600'
          }`} data-testid="metric-margen-eco">
            {formatPct(ec.margenEconomicoPct || 0)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Rentabilidad operativa</p>
        </CardContent>
      </Card>

      {/* FILA 3: MÉTRICAS ADICIONALES */}
      <Card className="col-span-12 md:col-span-6 border-0 shadow-md bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Personas activas</p>
              <p className="text-xl font-bold text-gray-800" data-testid="metric-people-eco">
                {ec.personasActivas || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-6 border-0 shadow-md bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Briefcase className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Proyectos activos</p>
              <p className="text-xl font-bold text-gray-800" data-testid="metric-projects-eco">
                {ec.proyectosActivos || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
