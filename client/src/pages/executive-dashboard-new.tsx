import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, Clock, DollarSign, 
  Target, AlertTriangle, CheckCircle, Plus, ArrowRight, 
  BarChart3, Activity, RefreshCw, Calendar, Users, 
  Building2, AlertCircle, ExternalLink, Briefcase,
  FileSignature, PlayCircle, MessageSquare, Package, 
  ListChecks, UserCheck, AlertOctagon, FileText,
  Timer, Eye, Settings, Zap, ChevronRight, Sparkles,
  ArrowUpRight, ArrowDownRight, Layers, Globe
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell
} from 'recharts';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import NativeTemporalFilter, { TemporalFilterValue } from "@/components/NativeTemporalFilter";

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  
  // Initialize with current month
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilterValue>(() => {
    const now = new Date();
    return {
      mode: 'month',
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    };
  });
  
  // Derive selectedMonth from temporalFilter for API compatibility
  const selectedMonth = useMemo(() => {
    if (temporalFilter.mode === 'month' && temporalFilter.period) {
      return temporalFilter.period;
    }
    if (temporalFilter.mode === 'quarter' && temporalFilter.year && temporalFilter.quarter) {
      const startMonth = (temporalFilter.quarter - 1) * 3 + 1;
      return `${temporalFilter.year}-${String(startMonth).padStart(2, '0')}`;
    }
    if (temporalFilter.mode === 'year' && temporalFilter.year) {
      return `${temporalFilter.year}-01`;
    }
    if (temporalFilter.mode === 'custom' && temporalFilter.from) {
      return temporalFilter.from;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [temporalFilter]);

  // Build query params from temporal filter - ALWAYS send month and year as numbers
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

  // Query principal: métricas agregadas del Star Schema SoT
  const { data: dashboardMetrics, refetch: refetchMetrics, isLoading, isFetching } = useQuery({ 
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
  
  const { data: quotations = [] } = useQuery({ 
    queryKey: ['/api/quotations'],
    staleTime: 5 * 60 * 1000
  });

  const { data: clients = [] } = useQuery({ 
    queryKey: ['/api/clients'],
    staleTime: 10 * 60 * 1000
  });

  // Métricas consolidadas del mes actual (Star Schema SoT) - Business definitions
  const currentMetrics = useMemo(() => {
    if (!dashboardMetrics) {
      return {
        incomeUsd: 0,
        devengadoUsd: 0,
        billedUsd: 0,
        costUsd: 0,
        directCostsUsd: 0,
        indirectCostsUsd: 0,
        burnRateUsd: 0,
        marginContableUsd: 0,
        marginContablePct: 0,
        ebitOperativoUsd: 0,
        ebitOperativoPct: 0,
        ebitContableUsd: 0,
        ebitContablePct: 0,
        margenAdminPct: 0,
        markupOperativoUsd: 0,
        adjustmentsUsd: 0,
        beneficioNetoUsd: 0,
        cashFlowOperativoUsd: 0,
        wipUsd: 0,
        fxWeighted: 0,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        billablePct: 0,
        peopleActive: 0,
        projectsActive: 0,
        projectsTotal: 0
      };
    }
    
    return {
      incomeUsd: dashboardMetrics.financial?.incomeUsd || dashboardMetrics.financial?.billedUsd || 0,
      devengadoUsd: dashboardMetrics.financial?.devengadoUsd || 0,
      billedUsd: dashboardMetrics.financial?.billedUsd || 0,
      costUsd: dashboardMetrics.financial?.costUsd || 0,
      directCostsUsd: dashboardMetrics.financial?.directCostsUsd || 0,
      indirectCostsUsd: dashboardMetrics.financial?.indirectCostsUsd || 0,
      burnRateUsd: dashboardMetrics.financial?.burnRateUsd || 0,
      marginContableUsd: dashboardMetrics.financial?.marginContableUsd || 0,
      marginContablePct: dashboardMetrics.financial?.marginContablePct || 0,
      ebitOperativoUsd: dashboardMetrics.financial?.ebitOperativoUsd || 0,
      ebitOperativoPct: dashboardMetrics.financial?.ebitOperativoPct || 0,
      ebitContableUsd: dashboardMetrics.financial?.ebitContableUsd || 0,
      ebitContablePct: dashboardMetrics.financial?.ebitContablePct || 0,
      margenAdminPct: dashboardMetrics.financial?.margenAdminPct || 0,
      markupOperativoUsd: dashboardMetrics.financial?.markupOperativoUsd || 0,
      adjustmentsUsd: dashboardMetrics.financial?.adjustmentsUsd || 0,
      beneficioNetoUsd: dashboardMetrics.financial?.beneficioNetoUsd || 0,
      cashFlowOperativoUsd: dashboardMetrics.financial?.cashFlowOperativoUsd || 0,
      wipUsd: dashboardMetrics.financial?.wipUsd || 0,
      fxWeighted: dashboardMetrics.financial?.fxWeighted || 0,
      totalHours: dashboardMetrics.operational?.hours?.total || 0,
      billableHours: dashboardMetrics.operational?.hours?.billable || 0,
      nonBillableHours: dashboardMetrics.operational?.hours?.nonBillable || 0,
      billablePct: dashboardMetrics.operational?.hours?.billablePct || 0,
      peopleActive: dashboardMetrics.operational?.peopleActive || 0,
      projectsActive: dashboardMetrics.operational?.projects?.active || 0,
      projectsTotal: dashboardMetrics.operational?.projects?.total || 0
    };
  }, [dashboardMetrics]);

  // Actividad reciente: cotizaciones de los últimos 7 días
  const recentActivity = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activities = quotations
      .filter(q => q.createdAt && new Date(q.createdAt) > sevenDaysAgo)
      .map(q => {
        const client = clients.find(c => c.id === q.clientId);
        const clientName = client?.name || 'Cliente desconocido';
        
        return {
          id: `quote-${q.id}`,
          type: 'quotation' as const,
          title: 'Nueva cotización creada',
          description: `${q.projectName} - ${clientName}`,
          time: new Date(q.createdAt),
          icon: FileSignature,
          color: 'text-blue-600',
          status: q.status
        };
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 10);
    
    return activities;
  }, [quotations, clients]);

  // Alertas inteligentes del backend (NO_BILLING_WITH_COSTS, BILLABLE_DROP, etc.)
  const alerts = useMemo(() => {
    if (!dashboardMetrics || !dashboardMetrics.alerts) return [];
    
    // Mapear alertas del backend a formato UI
    return dashboardMetrics.alerts.map((alert: any, index: number) => ({
      id: `${alert.code}-${index}`,
      type: alert.severity === 'warning' || alert.severity === 'urgent' ? alert.severity : 'info',
      message: alert.msg,
      action: alert.action || '/active-projects',
      code: alert.code
    }));
  }, [dashboardMetrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchMetrics();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getAlertIcon = (type: string) => {
    switch(type) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'urgent': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertOctagon className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch(type) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'urgent': return 'border-orange-500 bg-orange-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Modern Header with Quick Actions Integrated */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Dashboard Ejecutivo</h1>
                <p className="text-gray-300 text-sm">
                  {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/analytics-consolidated">
                <Button variant="ghost" className="text-white hover:bg-white/10" size="sm">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </Link>
              <Button 
                variant="secondary"
                onClick={handleRefresh}
                disabled={refreshing || isLoading}
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Temporal Filter - Outside dark header for better visibility */}
      <div className="max-w-7xl mx-auto px-6 -mt-6 mb-6 relative z-50">
        <div className="relative">
          <NativeTemporalFilter
            value={temporalFilter}
            onChange={setTemporalFilter}
          />
          {(isLoading || isFetching) && (
            <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Cargando datos...</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content - Compact toolbar */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/optimized-quote">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                Nueva Cotización
              </Button>
            </Link>
            <Link href="/time-entries">
              <Button size="sm" variant="outline" className="h-8">
                <Timer className="h-3.5 w-3.5 mr-1.5" />
                Tiempo
              </Button>
            </Link>
            <Link href="/deliverables">
              <Button size="sm" variant="outline" className="h-8">
                <Package className="h-3.5 w-3.5 mr-1.5" />
                Entregables
              </Button>
            </Link>
          </div>
          
          {/* Compact Alert Badge */}
          {alerts.length > 0 && (
            <Link href="/active-projects">
              <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 cursor-pointer hover:bg-amber-100 px-3 py-1">
                <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'} pendiente{alerts.length > 1 ? 's' : ''}
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Badge>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-6">

        {/* Resumen Ejecutivo - 2 Columnas (Financiera / Operativa) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Resumen Ejecutivo del Mes</CardTitle>
                  <CardDescription className="text-sm flex items-center gap-2">
                    <span>Evolución del mes en curso</span>
                    {dashboardMetrics?.dataFreshness?.lastSuccessAt && (
                      <span className="text-xs text-gray-400" title={`Último ETL: ${format(new Date(dashboardMetrics.dataFreshness.lastSuccessAt), 'dd/MM/yyyy HH:mm')}`}>
                        • ETL: {format(new Date(dashboardMetrics.dataFreshness.lastSuccessAt), 'dd/MM HH:mm')}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {dashboardMetrics?.dataFreshness?.lastSuccessAt && (
                    <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                      <span className="h-2 w-2 bg-green-500 rounded-full mr-2 inline-block"></span>
                      Datos actualizados
                    </Badge>
                  )}
                  <Badge className="bg-blue-600 text-white">
                    {dashboardMetrics?.currentPeriod || format(new Date(), 'yyyy-MM')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* BLOQUE 1: MÉTRICAS EJECUTIVAS - Snapshot inmediato de salud */}
              <div className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Facturado */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 shadow-sm">
                    <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Facturado</span>
                    <div className="text-3xl font-bold text-green-800 mt-2">
                      ${(currentMetrics.billedUsd / 1000).toFixed(1)}k
                    </div>
                  </div>
                  
                  {/* EBIT Operativo */}
                  <div className={`p-4 rounded-xl border shadow-sm ${currentMetrics.ebitOperativoUsd >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'}`}>
                    <span className={`text-xs font-medium uppercase tracking-wide ${currentMetrics.ebitOperativoUsd >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>EBIT Operativo</span>
                    <div className={`text-3xl font-bold mt-2 ${currentMetrics.ebitOperativoUsd >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      ${(currentMetrics.ebitOperativoUsd / 1000).toFixed(1)}k
                    </div>
                    <span className={`text-sm ${currentMetrics.ebitOperativoUsd >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{currentMetrics.ebitOperativoPct?.toFixed(0)}%</span>
                  </div>

                  {/* EBIT Contable */}
                  <div className={`p-4 rounded-xl border shadow-sm ${currentMetrics.ebitContableUsd >= 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'}`}>
                    <span className={`text-xs font-medium uppercase tracking-wide ${currentMetrics.ebitContableUsd >= 0 ? 'text-blue-700' : 'text-red-700'}`}>EBIT Contable</span>
                    <div className={`text-3xl font-bold mt-2 ${currentMetrics.ebitContableUsd >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                      ${(currentMetrics.ebitContableUsd / 1000).toFixed(1)}k
                    </div>
                    <span className={`text-sm ${currentMetrics.ebitContableUsd >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{currentMetrics.ebitContablePct?.toFixed(0)}%</span>
                  </div>

                  {/* Burn Rate */}
                  <div className="p-4 bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl border border-rose-200 shadow-sm">
                    <span className="text-xs font-medium text-rose-700 uppercase tracking-wide">Burn Rate</span>
                    <div className="text-3xl font-bold text-rose-800 mt-2">
                      ${(currentMetrics.burnRateUsd / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Markup */}
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 shadow-sm">
                    <span className="text-xs font-medium text-purple-700 uppercase tracking-wide">Markup</span>
                    <div className="text-3xl font-bold text-purple-800 mt-2">
                      {currentMetrics.markupOperativoUsd?.toFixed(2)}x
                    </div>
                  </div>

                  {/* % Horas Facturables */}
                  <div className={`p-4 rounded-xl border shadow-sm ${currentMetrics.billablePct >= 0.6 ? 'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200' : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'}`}>
                    <span className={`text-xs font-medium uppercase tracking-wide ${currentMetrics.billablePct >= 0.6 ? 'text-teal-700' : 'text-amber-700'}`}>% Facturables</span>
                    <div className={`text-3xl font-bold mt-2 ${currentMetrics.billablePct >= 0.6 ? 'text-teal-800' : 'text-amber-700'}`}>
                      {(currentMetrics.billablePct * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOQUE 2 Y 3: COSTOS + OPERATIVA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* BLOQUE 2: Composición de Costos */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-rose-600" />
                    Composición de Costos
                  </h4>

                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="space-y-4">
                      {/* Directos */}
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-600">Directos (equipo)</span>
                          <span className="font-semibold text-gray-800">${(currentMetrics.directCostsUsd / 1000).toFixed(1)}k</span>
                        </div>
                        <Progress value={currentMetrics.burnRateUsd > 0 ? (currentMetrics.directCostsUsd / currentMetrics.burnRateUsd) * 100 : 0} className="h-2 [&>div]:bg-red-500" />
                        <span className="text-xs text-gray-500">{currentMetrics.burnRateUsd > 0 ? ((currentMetrics.directCostsUsd / currentMetrics.burnRateUsd) * 100).toFixed(0) : 0}% del total</span>
                      </div>
                      
                      {/* Indirectos */}
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-600">Indirectos (overhead)</span>
                          <span className="font-semibold text-gray-800">${(currentMetrics.indirectCostsUsd / 1000).toFixed(1)}k</span>
                        </div>
                        <Progress value={currentMetrics.burnRateUsd > 0 ? (currentMetrics.indirectCostsUsd / currentMetrics.burnRateUsd) * 100 : 0} className="h-2 [&>div]:bg-orange-500" />
                        <span className="text-xs text-gray-500">{currentMetrics.burnRateUsd > 0 ? ((currentMetrics.indirectCostsUsd / currentMetrics.burnRateUsd) * 100).toFixed(0) : 0}% del total</span>
                      </div>
                      
                      {/* Total */}
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Total Costos</span>
                          <span className="text-xl font-bold text-gray-900">${(currentMetrics.burnRateUsd / 1000).toFixed(1)}k</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Definiciones de márgenes */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                    <div className="space-y-1">
                      <p><strong className="text-emerald-700">EBIT Operativo</strong> = Facturado - Directos</p>
                      <p><strong className="text-blue-700">EBIT Contable</strong> = Facturado - Directos - Indirectos</p>
                    </div>
                  </div>
                </div>

                {/* BLOQUE 3: Operativa */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Operativa
                  </h4>

                  {/* Horas Trabajadas */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-700">Horas Trabajadas</span>
                      <span className="text-2xl font-bold text-blue-700">{currentMetrics.totalHours.toFixed(0)}h</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-600">Facturables</span>
                          <span className="font-semibold text-gray-800">{currentMetrics.billableHours.toFixed(0)}h</span>
                        </div>
                        <Progress value={currentMetrics.totalHours > 0 ? (currentMetrics.billableHours / currentMetrics.totalHours) * 100 : 0} className="h-2 [&>div]:bg-blue-500" />
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-600">No facturables</span>
                          <span className="font-semibold text-gray-800">{currentMetrics.nonBillableHours.toFixed(0)}h</span>
                        </div>
                        <Progress value={currentMetrics.totalHours > 0 ? (currentMetrics.nonBillableHours / currentMetrics.totalHours) * 100 : 0} className="h-2 [&>div]:bg-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Personas y Proyectos */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Personas Activas</span>
                      <div className="text-3xl font-bold text-blue-700 mt-2">
                        {currentMetrics.peopleActive}
                      </div>
                    </div>
                    <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Proyectos Activos</span>
                      <div className="text-3xl font-bold text-blue-700 mt-2">
                        {currentMetrics.projectsActive}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>


        {/* Actividad Reciente - Integrada al flujo principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-gray-700" />
                  <div>
                    <CardTitle className="text-lg font-bold">Actividad Reciente</CardTitle>
                    <CardDescription className="text-xs">Últimas acciones en el sistema</CardDescription>
                  </div>
                </div>
                <Link href="/quotations">
                  <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                    Ver todo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((activity, index) => {
                    const Icon = activity.icon;
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className={`p-2 rounded-lg ${
                          activity.type === 'quotation' ? 'bg-blue-100' :
                          activity.type === 'project' ? 'bg-green-100' :
                          'bg-purple-100'
                        }`}>
                          <Icon className={`h-4 w-4 ${
                            activity.type === 'quotation' ? 'text-blue-600' :
                            activity.type === 'project' ? 'text-green-600' :
                            'text-purple-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {activity.title}
                            </p>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {format(activity.time, "dd/MM HH:mm", { locale: es })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate mt-0.5">
                            {activity.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-lg">
                    <div className="p-4 bg-white rounded-full inline-block mb-3 shadow-sm">
                      <FileSignature className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="text-gray-600 font-medium mb-1">Todavía no hay actividad este mes</p>
                    <p className="text-sm text-gray-400 mb-4">Comenzá creando tu primera cotización</p>
                    <Link href="/optimized-quote">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Cotización
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Modern Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-8 pt-6 border-t border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuración
                </Button>
              </Link>
              <Link href="/clients">
                <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                  <Building2 className="h-4 w-4 mr-2" />
                  Clientes
                </Button>
              </Link>
              <Link href="/quotations">
                <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                  <Globe className="h-4 w-4 mr-2" />
                  Cotizaciones
                </Button>
              </Link>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">Epical Digital</p>
              <p className="text-xs text-gray-500">Sistema de gestión integral</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}