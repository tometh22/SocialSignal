import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, Info, Clock, Users, Briefcase, RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";

interface OperativoViewProps {
  selectedPeriod: string;
}

export default function OperativoView({ selectedPeriod }: OperativoViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/v1/executive/operativo", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/v1/executive/operativo?period=${selectedPeriod}`);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
        <span className="ml-2 text-gray-500">Cargando datos operativos...</span>
      </div>
    );
  }

  const op = data || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-12 gap-4"
    >
      {/* FILA 1: HERO KPIs */}
      <Card className="col-span-12 md:col-span-6 border-0 shadow-lg bg-gradient-to-br from-[#C9F0E8] to-[#E9FFF4]">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-emerald-700 uppercase tracking-wide">
                  Devengado
                </span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-emerald-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs font-medium mb-1">Devengado</p>
                    <p className="text-xs text-gray-300">= Facturado - Provisión Facturación Adelantada</p>
                    <p className="text-xs text-gray-400 mt-1">Fuente: monthly_financial_summary</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-600 mb-3">Ingreso devengado del período</p>
              <div className="text-3xl font-semibold text-emerald-800" data-testid="metric-devengado">
                {formatCurrency(op.devengadoUsd || 0)}
              </div>
            </div>
            <div className="p-3 bg-emerald-200/50 rounded-full">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`col-span-12 md:col-span-6 border-0 shadow-lg ${
        (op.ebitOperativoUsd || 0) >= 0 
          ? 'bg-gradient-to-br from-[#C9F0E8] to-[#E9FFF4]' 
          : 'bg-gradient-to-br from-red-50 to-white'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium uppercase tracking-wide ${
                  (op.ebitOperativoUsd || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  EBIT Operativo
                </span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className={`h-4 w-4 ${(op.ebitOperativoUsd || 0) >= 0 ? 'text-emerald-500' : 'text-red-400'}`} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs font-medium mb-1">EBIT Operativo</p>
                    <p className="text-xs text-gray-300">= Devengado - Directos</p>
                    <p className="text-xs text-gray-400 mt-1">Nota: NO incluye overhead ni provisiones</p>
                    <p className="text-xs text-gray-400">Fuente: fact_cost_month (direct_usd)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-600 mb-3">Después de costos de equipo</p>
              <div className={`text-3xl font-semibold ${
                (op.ebitOperativoUsd || 0) >= 0 ? 'text-emerald-800' : 'text-red-700'
              }`} data-testid="metric-ebit-operativo">
                {formatCurrency(op.ebitOperativoUsd || 0)}
                <span className="text-lg font-normal ml-2">
                  ({formatPct(op.margenOperativoPct || 0)})
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">= Devengado – Directos (sin overhead ni provisiones)</p>
            </div>
            <div className={`p-3 rounded-full ${(op.ebitOperativoUsd || 0) >= 0 ? 'bg-emerald-200/50' : 'bg-red-100'}`}>
              {(op.ebitOperativoUsd || 0) >= 0 ? (
                <ArrowUpRight className="h-6 w-6 text-emerald-600" />
              ) : (
                <ArrowDownRight className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FILA 2: EFICIENCIA */}
      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Tarifa efectiva</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs font-medium mb-1">Tarifa efectiva</p>
                <p className="text-xs text-gray-300">= Devengado / Horas facturables</p>
                <p className="text-xs text-gray-400">Fuente: fact_labor_month</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-bold text-gray-800" data-testid="metric-tarifa-efectiva">
            ${(op.tarifaEfectivaUsd || 0).toFixed(0)}/h
          </div>
          <p className="text-xs text-gray-500 mt-1">USD por hora devengada</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Markup operativo</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs font-medium mb-1">Markup Operativo</p>
                <p className="text-xs text-gray-300">= Devengado / Directos</p>
                <p className="text-xs text-gray-400">Fuente: fact_cost_month (direct_usd)</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-bold text-gray-800" data-testid="metric-markup">
            {(op.markupOperativo || 0).toFixed(2)}x
          </div>
          <p className="text-xs text-gray-500 mt-1">Múltiplo sobre costos directos</p>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">% Horas facturables</span>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs font-medium mb-1">% Horas Facturables</p>
                <p className="text-xs text-gray-300">= Horas facturables / Horas totales</p>
                <p className="text-xs text-gray-400">Fuente: fact_labor_month</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-2xl font-bold ${
            (op.horasFacturablesPct || 0) >= 60 ? 'text-emerald-700' : 'text-amber-600'
          }`} data-testid="metric-billable-ratio">
            {formatPct(op.horasFacturablesPct || 0)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Sobre el total de horas</p>
          <Progress 
            value={op.horasFacturablesPct || 0} 
            className={`h-1.5 mt-2 ${
              (op.horasFacturablesPct || 0) >= 60 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'
            }`} 
          />
        </CardContent>
      </Card>

      {/* FILA 3: CAPACIDAD */}
      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Horas trabajadas</p>
              <p className="text-xl font-bold text-gray-800" data-testid="metric-hours-total">
                {(op.horasTrabajadas || 0).toFixed(0)}h
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Personas activas</p>
              <p className="text-xl font-bold text-gray-800" data-testid="metric-people-active">
                {op.personasActivas || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Briefcase className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Proyectos activos</p>
              <p className="text-xl font-bold text-gray-800" data-testid="metric-projects-active">
                {op.proyectosActivos || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
