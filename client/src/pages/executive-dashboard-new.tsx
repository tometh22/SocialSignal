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

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // Query principal: métricas agregadas del Star Schema SoT
  const { data: dashboardMetrics, refetch: refetchMetrics, isLoading } = useQuery({ 
    queryKey: ['/api/dashboard/metrics', selectedPeriod ? { period: selectedPeriod } : undefined],
    staleTime: 3 * 60 * 1000
  });
  
  // Inicializar período seleccionado con el defaultPeriod del API
  useEffect(() => {
    if (dashboardMetrics && !selectedPeriod && dashboardMetrics.defaultPeriod) {
      setSelectedPeriod(dashboardMetrics.defaultPeriod);
    }
  }, [dashboardMetrics, selectedPeriod]);
  
  const { data: quotations = [] } = useQuery({ 
    queryKey: ['/api/quotations'],
    staleTime: 5 * 60 * 1000
  });

  const { data: clients = [] } = useQuery({ 
    queryKey: ['/api/clients'],
    staleTime: 10 * 60 * 1000
  });

  // Métricas consolidadas del mes actual (Star Schema SoT)
  const currentMetrics = useMemo(() => {
    if (!dashboardMetrics) {
      return {
        totalHoursMonth: 0,
        peopleWorking: 0,
        activeProjects: 0,
        pendingQuotations: 0,
        avgMargin: 0,
        avgMarkup: 0,
        avgBudgetUtil: 0,
        totalRevenue: 0,
        totalCost: 0
      };
    }
    
    return {
      totalHoursMonth: dashboardMetrics.monthMetrics.totalHoursMonth,
      peopleWorking: dashboardMetrics.monthMetrics.peopleWorking,
      activeProjects: dashboardMetrics.monthMetrics.activeProjects,
      pendingQuotations: dashboardMetrics.alerts.pendingQuotationsCount,
      avgMargin: dashboardMetrics.monthMetrics.avgMargin,
      avgMarkup: dashboardMetrics.monthMetrics.avgMarkup,
      avgBudgetUtil: dashboardMetrics.monthMetrics.avgBudgetUtil,
      totalRevenue: dashboardMetrics.monthMetrics.totalRevenue,
      totalCost: dashboardMetrics.monthMetrics.totalCostUSD
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

  // Alertas inteligentes del Star Schema SoT
  const alerts = useMemo(() => {
    if (!dashboardMetrics) return [];
    
    const alertList = [];
    
    // Proyectos sin actividad reciente (del Star Schema)
    if (dashboardMetrics.alerts.inactiveProjectsCount > 0) {
      alertList.push({
        id: 'inactive-projects',
        type: 'warning',
        message: `${dashboardMetrics.alerts.inactiveProjectsCount} proyectos sin actividad en el último mes`,
        action: '/active-projects'
      });
    }
    
    // Cotizaciones pendientes
    if (dashboardMetrics.alerts.pendingQuotationsCount > 0) {
      alertList.push({
        id: 'pending-quotes',
        type: 'urgent',
        message: `${dashboardMetrics.alerts.pendingQuotationsCount} cotizaciones pendientes requieren atención`,
        action: '/quotations'
      });
    }
    
    // Alerta de presupuesto promedio alto
    if (dashboardMetrics.monthMetrics.avgBudgetUtil > 0.8) {
      alertList.push({
        id: 'budget-risk',
        type: 'critical',
        message: `Utilización de presupuesto promedio en ${(dashboardMetrics.monthMetrics.avgBudgetUtil * 100).toFixed(0)}% - revisar proyectos`,
        action: '/active-projects'
      });
    }
    
    return alertList;
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
              {/* Selector de Período */}
              {dashboardMetrics?.availablePeriods && dashboardMetrics.availablePeriods.length > 0 && (
                <Select 
                  value={selectedPeriod || dashboardMetrics.defaultPeriod || ''} 
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboardMetrics.availablePeriods
                      .filter(p => p.hasData)
                      .map(period => (
                        <SelectItem key={period.periodKey} value={period.periodKey}>
                          {format(new Date(period.year, period.month - 1), 'MMMM yyyy', { locale: es })}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              
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
          
          {/* Quick Actions Bar */}
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
                  <CardDescription className="text-sm">
                    Evolución del mes en curso • Última actualización: {format(new Date(), 'dd/MM/yyyy HH:mm')}
                  </CardDescription>
                </div>
                <Badge className="bg-blue-600 text-white">
                  {dashboardMetrics?.currentPeriod || format(new Date(), 'yyyy-MM')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Columna Financiera - VERDE */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-700">Financiera</h3>
                  </div>
                  
                  {/* Ingresos */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Ingresos</span>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold text-green-700">
                      ${(currentMetrics.totalRevenue / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Costos */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Costos directos</span>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="text-3xl font-bold text-red-600">
                      ${(currentMetrics.totalCost / 1000).toFixed(1)}k
                    </div>
                  </div>

                  {/* Margen y Markup */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs text-gray-500 block mb-1">Margen</span>
                      <div className={`text-2xl font-bold ${currentMetrics.avgMargin >= 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                        {(currentMetrics.avgMargin * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs text-gray-500 block mb-1">Markup</span>
                      <div className={`text-2xl font-bold ${currentMetrics.avgMarkup >= 2 ? 'text-green-600' : 'text-red-600'}`}>
                        {currentMetrics.avgMarkup.toFixed(1)}x
                      </div>
                    </div>
                  </div>

                  {/* Proyectos Activos */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-500 block mb-1">Proyectos activos</span>
                    <div className="text-2xl font-bold text-green-700">
                      {currentMetrics.activeProjects}
                    </div>
                  </div>
                </div>

                {/* Columna Operativa - AZUL */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-700">Operativa</h3>
                  </div>
                  
                  {/* Horas trabajadas */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Horas trabajadas</span>
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-blue-700">
                      {currentMetrics.totalHoursMonth.toFixed(0)}h
                    </div>
                  </div>

                  {/* Personas activas */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Personas activas</span>
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-blue-700">
                      {currentMetrics.peopleWorking}
                    </div>
                  </div>

                  {/* Utilización de presupuesto */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-500 block mb-1">Presupuesto utilizado</span>
                    <div className={`text-2xl font-bold mb-2 ${currentMetrics.avgBudgetUtil > 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                      {(currentMetrics.avgBudgetUtil * 100).toFixed(0)}%
                    </div>
                    <Progress 
                      value={currentMetrics.avgBudgetUtil * 100} 
                      className="h-2"
                    />
                  </div>

                  {/* Cotizaciones pendientes - AMARILLO */}
                  <div className={`p-4 rounded-lg border ${
                    currentMetrics.pendingQuotations > 5 
                      ? 'bg-yellow-50 border-yellow-300' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Cotizaciones pendientes</span>
                      <FileSignature className={`h-4 w-4 ${currentMetrics.pendingQuotations > 5 ? 'text-yellow-600' : 'text-gray-400'}`} />
                    </div>
                    <div className={`text-3xl font-bold ${
                      currentMetrics.pendingQuotations > 5 ? 'text-yellow-700' : 
                      currentMetrics.pendingQuotations > 0 ? 'text-gray-700' : 
                      'text-green-600'
                    }`}>
                      {currentMetrics.pendingQuotations}
                    </div>
                    {currentMetrics.pendingQuotations > 0 && (
                      <Link href="/quotations">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className={`mt-2 w-full ${currentMetrics.pendingQuotations > 5 ? 'text-yellow-700 hover:bg-yellow-100' : 'hover:bg-gray-100'}`}
                        >
                          Revisar →
                        </Button>
                      </Link>
                    )}
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