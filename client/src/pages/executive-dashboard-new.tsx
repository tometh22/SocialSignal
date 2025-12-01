import { useState, useMemo, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, DollarSign, 
  AlertTriangle, RefreshCw, Users, 
  AlertCircle, Briefcase, Info, Clock,
  ArrowUpRight, ArrowDownRight, BarChart3,
  ChevronDown, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

type ViewMode = 'operational' | 'financial';

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('operational');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const queryParams = useMemo(() => {
    const [year, month] = selectedPeriod.split('-').map(Number);
    return `month=${month}&year=${year}`;
  }, [selectedPeriod]);

  const { data: dashboardMetrics, refetch: refetchMetrics, isLoading, isError } = useQuery({ 
    queryKey: ['/api/dashboard/metrics', queryParams],
    queryFn: async () => {
      console.log('Fetching dashboard metrics with params:', queryParams);
      const res = await fetch(`/api/dashboard/metrics?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
      const data = await res.json();
      console.log('Dashboard metrics received:', data);
      return data;
    },
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!initialized && dashboardMetrics?.defaultPeriod) {
      setSelectedPeriod(dashboardMetrics.defaultPeriod);
      setInitialized(true);
    }
  }, [dashboardMetrics?.defaultPeriod, initialized]);

  const financial = dashboardMetrics?.financial || {};
  const operational = dashboardMetrics?.operational || {};
  const alerts = dashboardMetrics?.alerts || [];
  const availablePeriods = dashboardMetrics?.availablePeriods || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchMetrics();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    setShowPeriodPicker(false);
  };

  const formatCurrency = (value: number, decimals = 1) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(decimals)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPct = (value: number) => `${value.toFixed(0)}%`;

  const formatPeriodLabel = (periodKey: string) => {
    const [year, month] = periodKey.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return format(date, 'MMM yyyy', { locale: es });
  };

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

  if (isError) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-red-500">
          <AlertCircle className="h-8 w-8" />
          <span>Error al cargar datos</span>
          <button 
            onClick={() => refetchMetrics()} 
            className="text-sm text-blue-600 hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-4 bg-gray-50 min-h-screen">
        
        {/* ===== HEADER COMPACTO ===== */}
        <div className="flex items-center justify-between w-full mb-4">
          {/* Izquierda: Título + Fecha */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
            <p className="text-sm text-gray-500">
              {dashboardMetrics?.resolved?.label || formatPeriodLabel(selectedPeriod)}
            </p>
          </div>
          
          {/* Derecha: Toggle + Filtro + Refresh */}
          <div className="flex items-center gap-3">
            {/* Toggle Operativo/Financiero */}
            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('operational')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'operational'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    data-testid="button-view-operational"
                  >
                    Operativo
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs max-w-[200px]">Ver rendimiento de la operación según lo producido (devengado).</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('financial')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'financial'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    data-testid="button-view-financial"
                  >
                    Financiero
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs max-w-[200px]">Ver visión contable según facturación y costos totales.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Selector de Período Compacto */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodPicker(!showPeriodPicker)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                data-testid="button-period-selector"
              >
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-700 capitalize">
                  {formatPeriodLabel(selectedPeriod)}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              
              {showPeriodPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] max-h-[280px] overflow-y-auto">
                  {availablePeriods.map((p: any) => (
                    <button
                      key={p.periodKey}
                      onClick={() => handlePeriodChange(p.periodKey)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 capitalize ${
                        p.periodKey === selectedPeriod ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'
                      }`}
                      data-testid={`period-option-${p.periodKey}`}
                    >
                      {formatPeriodLabel(p.periodKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botón Refresh (solo icono) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  data-testid="button-refresh"
                >
                  <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Actualizar datos del período</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Overlay para cerrar el picker */}
        {showPeriodPicker && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPeriodPicker(false)} 
          />
        )}

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
            transition={{ duration: 0.2 }}
            className="grid grid-cols-12 gap-4"
          >
            {/* ===== FILA 1: HERO KPIs (col-span-6 + col-span-6) ===== */}
            
            {/* Devengado */}
            <Card className="col-span-12 md:col-span-6 border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-emerald-700 uppercase tracking-wide">
                        Ingreso devengado
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-emerald-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <p className="text-xs font-medium mb-1">Ingreso devengado</p>
                          <p className="text-xs text-gray-300">Ingreso correspondiente al trabajo realizado en el período, independientemente de cuándo se facture.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Trabajo realizado en el período</p>
                    <div className="text-3xl font-semibold text-emerald-800" data-testid="metric-devengado">
                      {formatCurrency(operational.earnedUsd || 0)}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Facturado en el período: {formatCurrency(financial.billedUsd || 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EBIT Operativo */}
            <Card className={`col-span-12 md:col-span-6 border-0 shadow-lg ${
              (operational.ebitOperationalUsd || 0) >= 0 
                ? 'bg-gradient-to-br from-emerald-50 to-white' 
                : 'bg-gradient-to-br from-red-50 to-white'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium uppercase tracking-wide ${
                        (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}>
                        EBIT operativo
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className={`h-4 w-4 ${
                            (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`} />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <p className="text-xs font-medium mb-1">EBIT operativo</p>
                          <p className="text-xs text-gray-300">Devengado – Costos directos (equipo). Mide la rentabilidad de la operación antes de overhead e impuestos.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Después de costos de equipo</p>
                    <div className={`text-3xl font-semibold ${
                      (operational.ebitOperationalUsd || 0) >= 0 ? 'text-emerald-800' : 'text-red-700'
                    }`} data-testid="metric-ebit-operativo">
                      {formatCurrency(operational.ebitOperationalUsd || 0)}
                      <span className="text-lg font-normal ml-2">
                        ({formatPct(operational.ebitOperationalPct || 0)})
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">= Devengado – Costos directos</p>
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

            {/* ===== FILA 2: EFICIENCIA (col-span-4 x 3) ===== */}
            
            {/* Tarifa Efectiva */}
            <Card className="col-span-12 md:col-span-4 border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">Tarifa efectiva</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px]">
                      <p className="text-xs font-medium mb-1">Tarifa efectiva</p>
                      <p className="text-xs text-gray-300">Devengado / Horas facturables. Indica cuánto ingreso genera en promedio cada hora de trabajo facturable.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold text-gray-800" data-testid="metric-tarifa-efectiva">
                  ${(operational.effectiveRateUsd || 0).toFixed(0)}/h
                </div>
                <p className="text-xs text-gray-500 mt-1">USD por hora devengada</p>
              </CardContent>
            </Card>

            {/* Markup Operativo */}
            <Card className="col-span-12 md:col-span-4 border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">Markup operativo</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px]">
                      <p className="text-xs font-medium mb-1">Markup Operativo</p>
                      <p className="text-xs text-gray-300">Devengado / Costos directos. Mide cuántas veces recuperás el costo del equipo con lo producido.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl font-bold text-gray-800" data-testid="metric-markup">
                  {(operational.markup || 0).toFixed(2)}x
                </div>
                <p className="text-xs text-gray-500 mt-1">Múltiplo sobre costos directos</p>
              </CardContent>
            </Card>

            {/* % Horas Facturables */}
            <Card className="col-span-12 md:col-span-4 border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">% Horas facturables</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px]">
                      <p className="text-xs font-medium mb-1">% Horas Facturables</p>
                      <p className="text-xs text-gray-300">Horas facturables / Horas totales. Idealmente ≥ 70% en empresas de servicios.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${
                  (operational.billableRatio || 0) >= 0.6 ? 'text-emerald-700' : 'text-amber-600'
                }`} data-testid="metric-billable-ratio">
                  {formatPct((operational.billableRatio || 0) * 100)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Sobre el total de horas trabajadas</p>
                <Progress 
                  value={(operational.billableRatio || 0) * 100} 
                  className={`h-1.5 mt-2 ${
                    (operational.billableRatio || 0) >= 0.6 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'
                  }`} 
                />
              </CardContent>
            </Card>

            {/* ===== FILA 3: CAPACIDAD (col-span-4 x 3) ===== */}
            
            {/* Horas Trabajadas */}
            <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <Clock className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Horas trabajadas</p>
                    <p className="text-xl font-bold text-gray-800" data-testid="metric-hours-total">
                      {(operational.hoursTotal || 0).toFixed(0)}h
                    </p>
                    <p className="text-xs text-gray-400">En el período seleccionado</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personas Activas */}
            <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Personas activas</p>
                    <p className="text-xl font-bold text-gray-800" data-testid="metric-people-active">
                      {operational.activePeople || 0}
                    </p>
                    <p className="text-xs text-gray-400">Con al menos 1h registrada</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Proyectos Activos */}
            <Card className="col-span-12 md:col-span-4 border-0 shadow-md bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <Briefcase className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Proyectos activos</p>
                    <p className="text-xl font-bold text-gray-800" data-testid="metric-projects-active">
                      {operational.activeProjects || 0}
                    </p>
                    <p className="text-xs text-gray-400">Con horas o devengado &gt; 0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ===== FILA 4: COMPOSICIÓN DE COSTOS (col-span-12) ===== */}
            <Card className="col-span-12 border-0 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-red-500" />
                    Composición de costos
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs">Incluye solo costos reales del período. Directos = equipo. Indirectos = overhead (alquileres, herramientas, management, etc.).</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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
                    <p className="text-xs text-gray-400">
                      {financial.totalCostsUsd > 0 
                        ? `${((financial.directCostsUsd / financial.totalCostsUsd) * 100).toFixed(0)}% del total`
                        : '0% del total'}
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
                    <p className="text-xs text-gray-400">
                      {financial.totalCostsUsd > 0 
                        ? `${((financial.indirectCostsUsd / financial.totalCostsUsd) * 100).toFixed(0)}% del total`
                        : '0% del total'}
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
            transition={{ duration: 0.2 }}
            className="grid grid-cols-12 gap-4"
          >
            {/* ===== FILA 1: HERO KPIs (col-span-6 + col-span-6) ===== */}
            
            {/* Facturado */}
            <Card className="col-span-12 md:col-span-6 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-blue-700 uppercase tracking-wide">
                        Facturado
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-blue-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[250px]">
                          <p className="text-xs font-medium mb-1">Facturado</p>
                          <p className="text-xs text-gray-300">Ingresos facturados en el período según la pestaña Rendimiento Cliente.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Ingresos facturados en el período</p>
                    <div className="text-3xl font-semibold text-blue-800" data-testid="metric-facturado">
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
            <Card className={`col-span-12 md:col-span-6 border-0 shadow-lg ${
              (financial.ebitAccountingUsd || 0) >= 0 
                ? 'bg-gradient-to-br from-blue-50 to-white' 
                : 'bg-gradient-to-br from-red-50 to-white'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium uppercase tracking-wide ${
                        (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                      }`}>
                        EBIT contable
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className={`h-4 w-4 ${
                            (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-400' : 'text-red-400'
                          }`} />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <p className="text-xs font-medium mb-1">EBIT contable</p>
                          <p className="text-xs text-gray-300">Facturado – Costos contables. Visión contable de la rentabilidad según el informe de administración.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Resultado operativo contable</p>
                    <div className={`text-3xl font-semibold ${
                      (financial.ebitAccountingUsd || 0) >= 0 ? 'text-blue-800' : 'text-red-700'
                    }`} data-testid="metric-ebit-contable">
                      {formatCurrency(financial.ebitAccountingUsd || 0)}
                      <span className="text-lg font-normal ml-2">
                        ({formatPct(financial.ebitAccountingPct || 0)})
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">= Facturado – Costos contables</p>
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

            {/* ===== FILA 2: COSTOS (col-span-3 x 4) ===== */}
            
            {/* Costos Directos */}
            <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-red-600 uppercase font-medium">Directos</p>
                    <p className="text-xl font-bold text-red-700" data-testid="metric-direct-costs-fin">
                      {formatCurrency(financial.directCostsUsd || 0)}
                    </p>
                    <p className="text-xs text-red-400">Equipo</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overhead Operativo */}
            <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600 uppercase font-medium">Overhead</p>
                    <p className="text-xl font-bold text-orange-700" data-testid="metric-overhead">
                      {formatCurrency(financial.indirectCostsUsd || 0)}
                    </p>
                    <p className="text-xs text-orange-400">Estructura</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provisiones Contables */}
            <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-purple-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-600 uppercase font-medium">Provisiones</p>
                    <p className="text-xl font-bold text-purple-700" data-testid="metric-provisions">
                      {formatCurrency(financial.provisionsUsd || 0)}
                    </p>
                    <p className="text-xs text-purple-400">Contable</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Burn Rate Total */}
            <Card className="col-span-6 md:col-span-3 border-0 shadow-md bg-rose-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs text-rose-600 uppercase font-medium">Burn Rate</p>
                    <p className="text-xl font-bold text-rose-700" data-testid="metric-burn-rate">
                      {formatCurrency(financial.totalCostsUsd || 0)}
                    </p>
                    <p className="text-xs text-rose-400">Total contable</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ===== FILA 3: CONTEXTO (col-span-6 x 2) ===== */}
            
            {/* Personas Activas */}
            <Card className="col-span-12 md:col-span-6 border-0 shadow-md bg-gray-50">
              <CardContent className="p-4">
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
            <Card className="col-span-12 md:col-span-6 border-0 shadow-md bg-gray-50">
              <CardContent className="p-4">
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
