import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, Info, Users, Briefcase, RefreshCw
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
      className="space-y-6"
    >
      {/* TIER 1: HERO KPI - EBIT Económico (protagonista único) */}
      <div className="grid grid-cols-12 gap-4">
        <Card className={`col-span-12 border-0 shadow-lg ${
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
                <p className="text-xs text-gray-600 mb-3">Rentabilidad operativa real</p>
                <div className={`text-4xl font-bold ${
                  (ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-800' : 'text-red-700'
                }`} data-testid="metric-ebit-economico">
                  {formatCurrency(ec.ebitEconomicoUsd || 0)}
                  <span className="text-xl font-normal ml-2 opacity-80">
                    ({formatPct(ec.margenEconomicoPct || 0)})
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${(ec.ebitEconomicoUsd || 0) >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                {(ec.ebitEconomicoUsd || 0) >= 0 ? (
                  <ArrowUpRight className="h-7 w-7 text-blue-600" />
                ) : (
                  <ArrowDownRight className="h-7 w-7 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 2: DESGLOSE INGRESO Y COSTOS */}
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-600 uppercase">Devengado</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-blue-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[220px]">
                  <p className="text-xs text-gray-300">Ingreso base para calcular EBIT</p>
                  <p className="text-xs text-gray-400">Fuente: monthly_financial_summary</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-blue-800" data-testid="metric-devengado-eco">
              {formatCurrency(ec.devengadoUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Directos</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[220px]">
                  <p className="text-xs font-medium mb-1">Costos Directos</p>
                  <p className="text-xs text-gray-300">Costos de equipo asignados a proyectos</p>
                  <p className="text-xs text-gray-400">Fuente: fact_cost_month.direct_usd</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-xl font-bold text-gray-800" data-testid="metric-directos-eco">
              {formatCurrency(ec.directosUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Overhead</span>
              <Info className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800" data-testid="metric-overhead-eco">
              {formatCurrency(ec.overheadUsd || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Margen</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">= EBIT Económico / Devengado</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-xl font-bold ${
              (ec.margenEconomicoPct || 0) >= 20 ? 'text-blue-700' : 'text-red-600'
            }`} data-testid="metric-margen-eco">
              {formatPct(ec.margenEconomicoPct || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 3: MÉTRICAS CONTEXTUALES */}
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-6 border-0 shadow-sm bg-gray-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Personas activas</p>
                <p className="text-lg font-bold text-gray-700" data-testid="metric-people-eco">
                  {ec.personasActivas || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-6 border-0 shadow-sm bg-gray-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Proyectos activos</p>
                <p className="text-lg font-bold text-gray-700" data-testid="metric-projects-eco">
                  {ec.proyectosActivos || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nota de contexto */}
      <div className="text-center text-xs text-gray-400 pt-2">
        Vista Económica: Resultado operativo real. Incluye overhead, NO incluye provisiones ni cash.
      </div>
    </motion.div>
  );
}
