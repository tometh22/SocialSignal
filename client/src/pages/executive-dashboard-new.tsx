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

type ViewMode = 'operativo' | 'economico' | 'finanzas';

import { OperativoView, EconomicoView, FinanzasView } from '@/components/Executive';
import { AlertsPanel } from '@/components/Executive/AlertsPanel';

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('operativo');
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
            {/* Toggle Operativo/Económico/Finanzas */}
            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('operativo')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'operativo'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    data-testid="button-view-operativo"
                  >
                    Operativo
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs max-w-[220px]">Productividad pura: Devengado – Directos. Sin overhead ni provisiones.</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('economico')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'economico'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    data-testid="button-view-economico"
                  >
                    Económico
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs max-w-[220px]">P&L gerencial: Devengado – Directos – Overhead. Sin provisiones.</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('finanzas')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'finanzas'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    data-testid="button-view-finanzas"
                  >
                    Finanzas
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs max-w-[220px]">Contable + Caja: Facturado – todos los costos. Incluye cashflow y balance.</p>
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

        {/* Panel de Alertas Inteligentes */}
        <AlertsPanel 
          period={dashboardMetrics?.resolved?.label || formatPeriodLabel(selectedPeriod)}
          data={{
            devengadoUsd: financial.devengadoUsd || 0,
            facturadoUsd: financial.facturadoUsd || 0,
            directosUsd: financial.directCostsUsd || 0,
            overheadUsd: financial.overheadUsd || 0,
            ebitOperativoUsd: financial.ebitOperativoUsd || 0,
            ebitContableUsd: financial.ebitContableUsd || 0,
            cashFlowNetUsd: financial.cashFlowNetUsd || 0,
            devengadoVariation: financial.devengadoVariation ?? null,
            facturadoVariation: financial.facturadoVariation ?? null,
          }}
        />

        {/* ==================== VISTAS ==================== */}
        {viewMode === 'operativo' && <OperativoView selectedPeriod={selectedPeriod} />}
        {viewMode === 'economico' && <EconomicoView selectedPeriod={selectedPeriod} />}
        {viewMode === 'finanzas' && <FinanzasView selectedPeriod={selectedPeriod} />}

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

