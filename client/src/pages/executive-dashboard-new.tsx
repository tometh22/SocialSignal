import { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, DollarSign, 
  AlertTriangle, RefreshCw, Users, 
  AlertCircle, Briefcase, Info, Clock,
  ArrowUpRight, ArrowDownRight, BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import NativeTemporalFilter, { TemporalFilterValue } from "@/components/NativeTemporalFilter";

type ViewMode = 'operational' | 'financial';

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('operational');
  
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilterValue>(() => {
    const now = new Date();
    return {
      mode: 'month',
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    };
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (temporalFilter.mode === 'month' && temporalFilter.period) {
      const [year, month] = temporalFilter.period.split('-').map(Number);
      params.set('month', String(month));
      params.set('year', String(year));
    } else if (temporalFilter.mode === 'quarter' && temporalFilter.year && temporalFilter.quarter) {
      const startMonth = (temporalFilter.quarter - 1) * 3 + 1;
      params.set('month', String(startMonth));
      params.set('year', String(temporalFilter.year));
      params.set('quarter', String(temporalFilter.quarter));
    } else if (temporalFilter.mode === 'year' && temporalFilter.year) {
      params.set('year', String(temporalFilter.year));
      params.set('month', '1');
    } else if (temporalFilter.mode === 'custom' && temporalFilter.from && temporalFilter.to) {
      const [fromYear, fromMonth] = temporalFilter.from.split('-').map(Number);
      const [toYear, toMonth] = temporalFilter.to.split('-').map(Number);
      params.set('fromMonth', String(fromMonth));
      params.set('fromYear', String(fromYear));
      params.set('toMonth', String(toMonth));
      params.set('toYear', String(toYear));
    } else {
      const now = new Date();
      params.set('month', String(now.getMonth() + 1));
      params.set('year', String(now.getFullYear()));
    }
    
    return params.toString();
  }, [temporalFilter]);

  const { data: dashboardMetrics, refetch: refetchMetrics, isLoading } = useQuery({ 
    queryKey: ['/api/dashboard/metrics', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/metrics?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const financial = dashboardMetrics?.financial || {};
  const operational = dashboardMetrics?.operational || {};
  const alerts = dashboardMetrics?.alerts || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchMetrics();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatCurrency = (value: number, decimals = 1) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(decimals)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPct = (value: number) => `${value.toFixed(0)}%`;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Cargando métricas...</span>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
            <p className="text-sm text-gray-500">
              {dashboardMetrics?.resolved?.label || format(new Date(), 'MMMM yyyy', { locale: es })}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <NativeTemporalFilter
              value={temporalFilter}
              onChange={setTemporalFilter}
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* View Mode Switch */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 w-fit">
          <button
            onClick={() => setViewMode('operational')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'operational'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid="button-view-operational"
          >
            Operativo
          </button>
          <button
            onClick={() => setViewMode('financial')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'financial'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid="button-view-financial"
          >
            Financiero
          </button>
        </div>

        {/* Alerts Bar */}
        {alerts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {alerts.slice(0, 3).map((alert: any, idx: number) => (
              <Link key={idx} href={alert.action || '#'}>
                <Badge
                  variant="outline"
                  className={`whitespace-nowrap cursor-pointer hover:opacity-80 ${
                    alert.severity === 'warning' || alert.severity === 'urgent'
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-gray-300 bg-gray-50 text-gray-700'
                  }`}
                >
                  {alert.severity === 'warning' || alert.severity === 'urgent' ? (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  {alert.msg}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* ==================== OPERATIONAL VIEW ==================== */}
        {viewMode === 'operational' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Row 1: Hero KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Devengado (Ingreso Ganado) */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-emerald-700 uppercase tracking-wide">
                          Devengado
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-emerald-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Ingreso ganado en el período (Fee = Facturado, One Shot = % avance)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-4xl font-bold text-emerald-800" data-testid="metric-devengado">
                        {formatCurrency(operational.earnedUsd || 0)}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Facturado: {formatCurrency(financial.billedUsd || 0)}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EBIT Operativo */}
              <Card className={`border-0 shadow-lg ${
                (operational.ebitOperationalUsd || 0) >= 0 
                  ? 'bg-gradient-to-br from-emerald-50 to-white' 
                  : 'bg-gradient-to-br from-red-50 to-white'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium uppercase tracking-wide ${
                          (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          EBIT Operativo
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className={`h-4 w-4 ${
                              (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`} />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Devengado - Costos Directos</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className={`text-4xl font-bold ${
                        (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-800' : 'text-red-700'
                      }`} data-testid="metric-ebit-operativo">
                        {formatCurrency(operational.ebitOperationalUsd || 0)}
                      </div>
                      <p className={`text-sm mt-2 ${
                        (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatPct(operational.ebitOperationalPct || 0)} del devengado
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${
                      (operational.ebitOperationalUsd || 0) >= 0 ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {(operational.ebitOperationalUsd || 0) >= 0 ? (
                        <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Efficiency Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tarifa Efectiva */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Tarifa Efectiva</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Devengado / Horas facturables</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold text-gray-800" data-testid="metric-tarifa-efectiva">
                    ${(operational.effectiveRateUsd || 0).toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">USD / hora facturable</p>
                </CardContent>
              </Card>

              {/* Markup */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Markup Operativo</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Devengado / Costos Directos</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold text-gray-800" data-testid="metric-markup">
                    {(operational.markup || 0).toFixed(2)}x
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Múltiplo sobre costos</p>
                </CardContent>
              </Card>

              {/* % Horas Facturables */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">% Facturables</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Horas facturables / Horas totales</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className={`text-2xl font-bold ${
                    (operational.billableRatio || 0) >= 0.6 ? 'text-emerald-700' : 'text-amber-600'
                  }`} data-testid="metric-billable-ratio">
                    {formatPct((operational.billableRatio || 0) * 100)}
                  </div>
                  <Progress 
                    value={(operational.billableRatio || 0) * 100} 
                    className={`h-1.5 mt-2 ${
                      (operational.billableRatio || 0) >= 0.6 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'
                    }`} 
                  />
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Capacity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Horas Trabajadas */}
              <Card className="border-0 shadow-md bg-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <Clock className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Horas trabajadas</p>
                      <p className="text-xl font-bold text-gray-800" data-testid="metric-hours-total">
                        {(operational.hoursTotal || 0).toFixed(0)}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Personas Activas */}
              <Card className="border-0 shadow-md bg-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Personas activas</p>
                      <p className="text-xl font-bold text-gray-800" data-testid="metric-people-active">
                        {operational.activePeople || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Proyectos Activos */}
              <Card className="border-0 shadow-md bg-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <Briefcase className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Proyectos activos</p>
                      <p className="text-xl font-bold text-gray-800" data-testid="metric-projects-active">
                        {operational.activeProjects || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 4: Cost Composition */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-red-500" />
                  Composición de Costos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Stacked Bar */}
                <div className="h-6 rounded-full overflow-hidden bg-gray-200 mb-4">
                  <div className="h-full flex">
                    <div 
                      className="bg-red-400 transition-all"
                      style={{ 
                        width: `${financial.totalCostsUsd > 0 
                          ? (financial.directCostsUsd / financial.totalCostsUsd) * 100 
                          : 50}%` 
                      }}
                    />
                    <div 
                      className="bg-orange-400 transition-all"
                      style={{ 
                        width: `${financial.totalCostsUsd > 0 
                          ? (financial.indirectCostsUsd / financial.totalCostsUsd) * 100 
                          : 50}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-red-400 rounded-full" />
                      <span className="text-gray-600">Directos (equipo)</span>
                    </div>
                    <p className="font-semibold text-gray-800" data-testid="metric-direct-costs">
                      {formatCurrency(financial.directCostsUsd || 0)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-orange-400 rounded-full" />
                      <span className="text-gray-600">Indirectos (overhead)</span>
                    </div>
                    <p className="font-semibold text-gray-800" data-testid="metric-indirect-costs">
                      {formatCurrency(financial.indirectCostsUsd || 0)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      <span className="text-gray-600">Total</span>
                    </div>
                    <p className="font-bold text-gray-900" data-testid="metric-total-costs">
                      {formatCurrency(financial.totalCostsUsd || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ==================== FINANCIAL VIEW ==================== */}
        {viewMode === 'financial' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Row 1: Hero KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Facturado */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-blue-700 uppercase tracking-wide">
                          Facturado
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-blue-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Ingresos facturados en el período</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-4xl font-bold text-blue-800" data-testid="metric-facturado">
                        {formatCurrency(financial.billedUsd || 0)}
                      </div>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <DollarSign className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EBIT Contable */}
              <Card className={`border-0 shadow-lg ${
                (financial.ebitAccountingUsd || 0) >= 0 
                  ? 'bg-gradient-to-br from-blue-50 to-white' 
                  : 'bg-gradient-to-br from-red-50 to-white'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium uppercase tracking-wide ${
                          (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                        }`}>
                          EBIT Contable
                        </span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className={`h-4 w-4 ${
                              (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-400' : 'text-red-400'
                            }`} />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Facturado - Costos Totales</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className={`text-4xl font-bold ${
                        (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-800' : 'text-red-700'
                      }`} data-testid="metric-ebit-contable">
                        {formatCurrency(financial.ebitAccountingUsd || 0)}
                      </div>
                      <p className={`text-sm mt-2 ${
                        (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {formatPct(financial.ebitAccountingPct || 0)} del facturado
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${
                      (financial.ebitAccountingUsd || 0) >= 0 ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      {(financial.ebitAccountingUsd || 0) >= 0 ? (
                        <ArrowUpRight className="h-6 w-6 text-blue-600" />
                      ) : (
                        <ArrowDownRight className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Costs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Costos Directos */}
              <Card className="border-0 shadow-md bg-red-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-red-600 uppercase font-medium">Costos Directos</p>
                      <p className="text-xl font-bold text-red-700" data-testid="metric-direct-costs-fin">
                        {formatCurrency(financial.directCostsUsd || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Overhead */}
              <Card className="border-0 shadow-md bg-orange-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 uppercase font-medium">Overhead</p>
                      <p className="text-xl font-bold text-orange-700" data-testid="metric-overhead">
                        {formatCurrency(financial.indirectCostsUsd || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Burn Rate */}
              <Card className="border-0 shadow-md bg-rose-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-xs text-rose-600 uppercase font-medium">Burn Rate</p>
                      <p className="text-xl font-bold text-rose-700" data-testid="metric-burn-rate">
                        {formatCurrency(financial.burnRateUsd || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personas Activas */}
              <Card className="border-0 shadow-md bg-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Personas activas</p>
                      <p className="text-xl font-bold text-gray-800">
                        {operational.activePeople || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Proyectos Activos */}
              <Card className="border-0 shadow-md bg-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <Briefcase className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Proyectos activos</p>
                      <p className="text-xl font-bold text-gray-800">
                        {operational.activeProjects || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Data Freshness Footer */}
        {dashboardMetrics?.dataFreshness?.lastSuccessAt && (
          <div className="text-center text-xs text-gray-400 pt-4">
            Última actualización ETL: {format(new Date(dashboardMetrics.dataFreshness.lastSuccessAt), 'dd/MM/yyyy HH:mm', { locale: es })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
