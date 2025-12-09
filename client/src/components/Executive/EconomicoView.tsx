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
          ? 'bg-blue-100 text-blue-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        {isPositive ? '+' : ''}{value.toFixed(0)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-500 font-medium">Cargando datos económicos...</span>
      </div>
    );
  }

  const ec = data || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      {/* NIVEL 1: MACRO KPI — EBIT Económico (único protagonista) */}
      <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
        (ec.ebitEconomicoUsd || 0) >= 0 
          ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-white' 
          : 'bg-gradient-to-br from-red-50 via-rose-50 to-white'
      }`}>
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-semibold uppercase tracking-wider ${
                  (ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  EBIT Económico
                </span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className={`h-4 w-4 ${(ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs font-medium mb-1">EBIT Económico</p>
                    <p className="text-xs text-gray-300">= Devengado − Directos − Overhead</p>
                    <p className="text-xs text-gray-400 mt-1">Rentabilidad operativa real (sin provisiones)</p>
                  </TooltipContent>
                </Tooltip>
                <VariationBadge value={ec.ebitVariation} />
              </div>
              <div className="flex items-baseline gap-4">
                <span className={`text-5xl font-bold tracking-tight ${
                  (ec.ebitEconomicoUsd || 0) >= 0 ? 'text-blue-800' : 'text-red-700'
                }`} data-testid="metric-ebit-economico">
                  {formatCurrency(ec.ebitEconomicoUsd || 0)}
                </span>
                <span className={`text-xl font-medium ${
                  (ec.margenEconomicoPct || 0) >= 30 ? 'text-blue-600' : 'text-amber-600'
                }`}>
                  {formatPct(ec.margenEconomicoPct || 0)} margen
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-3">Rentabilidad operativa real del período</p>
            </div>
            <div className={`p-4 rounded-2xl ${(ec.ebitEconomicoUsd || 0) >= 0 ? 'bg-blue-100/80' : 'bg-red-100/80'}`}>
              {(ec.ebitEconomicoUsd || 0) >= 0 ? (
                <TrendingUp className="h-9 w-9 text-blue-600" />
              ) : (
                <ArrowDownRight className="h-9 w-9 text-red-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NIVEL 2: DESGLOSE — Devengado - Directos - Overhead = Margen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Devengado */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">Devengado</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-blue-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">Base de ingreso para calcular EBIT</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-blue-800" data-testid="metric-devengado-eco">
              {formatCurrency(ec.devengadoUsd || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">ingreso base</p>
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
                  <p className="text-xs text-gray-300">Costos de equipo en proyectos</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-gray-700" data-testid="metric-directos-eco">
              {formatCurrency(ec.directosUsd || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">costo equipo</p>
          </CardContent>
        </Card>

        {/* Overhead */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Overhead</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">Costos indirectos operativos</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-2xl font-bold text-gray-700" data-testid="metric-overhead-eco">
              {formatCurrency(ec.overheadUsd || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">indirectos</p>
          </CardContent>
        </Card>

        {/* Margen Económico */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Margen</span>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs text-gray-300">= EBIT / Devengado</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${
              (ec.margenEconomicoPct || 0) >= 30 ? 'text-blue-700' : 
              (ec.margenEconomicoPct || 0) >= 15 ? 'text-amber-600' : 'text-red-600'
            }`} data-testid="metric-margen-eco">
              {formatPct(ec.margenEconomicoPct || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">rentabilidad</p>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 3: CONTEXTO */}
      <div className="flex items-center justify-center gap-6 py-3 px-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800" data-testid="metric-people-eco">{ec.personasActivas || 0}</span> personas
          </span>
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800" data-testid="metric-projects-eco">{ec.proyectosActivos || 0}</span> proyectos
          </span>
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <span className="text-xs text-gray-500 italic">Incluye overhead, sin provisiones</span>
      </div>
    </motion.div>
  );
}
