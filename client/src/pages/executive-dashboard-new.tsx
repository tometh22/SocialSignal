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

  // Build query params from temporal filter
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (temporalFilter.mode === 'month' && temporalFilter.period) {
      params.set('period', temporalFilter.period);
    } else if (temporalFilter.mode === 'quarter' && temporalFilter.year && temporalFilter.quarter) {
      params.set('year', String(temporalFilter.year));
      params.set('quarter', String(temporalFilter.quarter));
    } else if (temporalFilter.mode === 'year' && temporalFilter.year) {
      params.set('year', String(temporalFilter.year));
    } else if (temporalFilter.mode === 'custom' && temporalFilter.from && temporalFilter.to) {
      params.set('from', temporalFilter.from);
      params.set('to', temporalFilter.to);
    } else if (selectedMonth) {
      params.set('period', selectedMonth);
    }
    
    return params.toString();
  }, [temporalFilter, selectedMonth]);

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

  // Métricas consolidadas del mes actual (Star Schema SoT) - Modelo devengo Opción 2
  const currentMetrics = useMemo(() => {
    if (!dashboardMetrics) {
      return {
        devengadoUsd: 0,
        billedUsd: 0,
        costUsd: 0,
        directCostsUsd: 0,
        indirectCostsUsd: 0,
        marginContableUsd: 0,
        marginEconomicoUsd: 0,
        marginEconomicoPct: 0,
        markupOperativoUsd: 0,
        wipUsd: 0,
        costTimesMarkupUsd: 0,
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
      devengadoUsd: dashboardMetrics.financial?.devengadoUsd || 0,
      billedUsd: dashboardMetrics.financial?.billedUsd || 0,
      costUsd: dashboardMetrics.financial?.costUsd || 0,
      directCostsUsd: dashboardMetrics.financial?.directCostsUsd || 0,
      indirectCostsUsd: dashboardMetrics.financial?.indirectCostsUsd || 0,
      marginContableUsd: dashboardMetrics.financial?.marginContableUsd || 0,
      marginEconomicoUsd: dashboardMetrics.financial?.marginEconomicoUsd || 0,
      marginEconomicoPct: dashboardMetrics.financial?.marginEconomicoPct || 0,
      markupOperativoUsd: dashboardMetrics.financial?.markupOperativoUsd || 0,
      wipUsd: dashboardMetrics.financial?.wipUsd || 0,
      costTimesMarkupUsd: dashboardMetrics.financial?.costTimesMarkupUsd || 0,
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
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Intelligent Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Alertas Inteligentes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert, idx) => (
                <Alert key={idx} className={getAlertColor(alert.severity)}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'urgent' ? 'text-orange-600' : alert.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`}>
                      {getAlertIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <AlertDescription className="text-sm text-gray-700">
                        {alert.msg}
                      </AlertDescription>
                      {alert.action && (
                        <Link href={alert.action}>
                          <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-gray-900">
                            Ver detalles <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}
        
        {/* Quick Actions Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400 mr-2">Acciones rápidas:</span>
            <Link href="/optimized-quote">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileSignature className="h-4 w-4 mr-2" />
                Nueva Cotización
              </Button>
            </Link>
            <Link href="/time-entries">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Timer className="h-4 w-4 mr-2" />
                Registrar Tiempo
              </Button>
            </Link>
            <Link href="/deliverables">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Package className="h-4 w-4 mr-2" />
                Entregables
              </Button>
            </Link>
            <Link href="/active-projects">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10">
                <Layers className="h-4 w-4 mr-2" />
                Ver Proyectos
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-6 space-y-6">
        {/* Modern Alert Section */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-red-500/20 rounded-2xl blur-xl" />
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg">Alertas del Sistema</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.map((alert, index) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/60 backdrop-blur border border-gray-200/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        alert.type === 'critical' ? 'bg-red-100 text-red-600' :
                        alert.type === 'urgent' ? 'bg-orange-100 text-orange-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <span className="font-medium text-gray-900">{alert.message}</span>
                    </div>
                    <Link href={alert.action}>
                      <Button variant="ghost" size="sm" className="hover:bg-white/80">
                        Resolver
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

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
              {/* KPI GRID - Compacto y organizado */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Métricas Clave</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Devengado */}
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-xs text-gray-600">Devengado</span>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                      ${(currentMetrics.devengadoUsd / 1000).toFixed(1)}k
                    </div>
                  </div>
                  
                  {/* Facturado */}
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-xs text-gray-600">Facturado</span>
                    <div className="text-2xl font-bold text-amber-700 mt-1">
                      ${(currentMetrics.billedUsd / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Costos */}
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="text-xs text-gray-600">Costos</span>
                    <div className="text-2xl font-bold text-red-600 mt-1">
                      ${(currentMetrics.costUsd / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Margen Contable */}
                  <div className={`p-3 rounded-lg border ${currentMetrics.marginContableUsd >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-xs text-gray-600">Margen Contable</span>
                    <div className={`text-2xl font-bold mt-1 ${currentMetrics.marginContableUsd >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ${(currentMetrics.marginContableUsd / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Margen Económico */}
                  <div className={`p-3 rounded-lg border ${currentMetrics.marginEconomicoUsd >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-xs text-gray-600">EBIT</span>
                    <div className={`text-2xl font-bold mt-1 ${currentMetrics.marginEconomicoUsd >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                      ${(currentMetrics.marginEconomicoUsd / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* WIP */}
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-xs text-gray-600">WIP</span>
                    <div className="text-2xl font-bold text-purple-600 mt-1">
                      ${(currentMetrics.wipUsd / 1000).toFixed(1)}k
                    </div>
                  </div>
                </div>
              </div>

              {/* DETALLE FINANCIERO Y OPERATIVO */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Columna Financiera */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Detalles Financieros
                  </h4>

                  {/* Costos Desglosados */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-xs font-medium text-gray-600 block mb-3">Composición de Costos</span>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Directos</span>
                        <span className="font-medium text-gray-700">${(currentMetrics.directCostsUsd / 1000).toFixed(1)}k</span>
                      </div>
                      <Progress value={currentMetrics.costUsd > 0 ? (currentMetrics.directCostsUsd / currentMetrics.costUsd) * 100 : 0} className="h-1.5 [&>div]:bg-red-500" />
                      
                      <div className="flex justify-between items-center text-sm mt-3">
                        <span className="text-gray-600">Indirectos</span>
                        <span className="font-medium text-gray-700">${(currentMetrics.indirectCostsUsd / 1000).toFixed(1)}k</span>
                      </div>
                      <Progress value={currentMetrics.costUsd > 0 ? (currentMetrics.indirectCostsUsd / currentMetrics.costUsd) * 100 : 0} className="h-1.5 [&>div]:bg-orange-500" />
                    </div>
                  </div>

                  {/* Markup */}
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-xs text-gray-600">Markup Operativo</span>
                    <div className="text-3xl font-bold text-emerald-600 mt-2">
                      {currentMetrics.markupOperativoUsd?.toFixed(2)}x
                    </div>
                    <span className="text-xs text-gray-500 block mt-1">Devengado / Costos Directos</span>
                  </div>

                  {/* Margen % */}
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <span className="text-xs text-gray-600">% Margen Económico</span>
                    <div className="text-3xl font-bold text-indigo-600 mt-2">
                      {currentMetrics.marginEconomicoPct?.toFixed(1)}%
                    </div>
                    <span className="text-xs text-gray-500 block mt-1">Del Devengado</span>
                  </div>
                </div>

                {/* Columna Operativa */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Operativa
                  </h4>

                  {/* Horas y % */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-xs text-gray-600 block mb-2">Horas Trabajadas</span>
                    <div className="text-2xl font-bold text-blue-700">
                      {currentMetrics.totalHours.toFixed(0)}h
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Facturables</span>
                        <span className="font-medium">{currentMetrics.billableHours.toFixed(0)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">No facturables</span>
                        <span className="font-medium">{currentMetrics.nonBillableHours.toFixed(0)}h</span>
                      </div>
                    </div>
                  </div>

                  {/* % Facturación */}
                  <div className={`p-4 rounded-lg border ${currentMetrics.billablePct >= 0.6 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-xs text-gray-600">% Horas Facturables</span>
                    <div className={`text-3xl font-bold mt-2 ${currentMetrics.billablePct >= 0.6 ? 'text-green-600' : 'text-red-600'}`}>
                      {(currentMetrics.billablePct * 100).toFixed(0)}%
                    </div>
                    <span className="text-xs text-gray-500 block mt-1">Recomendado: ≥60%</span>
                  </div>

                  {/* Personas y Proyectos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs text-gray-600">Personas</span>
                      <div className="text-2xl font-bold text-blue-700 mt-2">
                        {currentMetrics.peopleActive}
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs text-gray-600">Proyectos</span>
                      <div className="text-2xl font-bold text-blue-700 mt-2">
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