import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  // Query principal: métricas agregadas del Star Schema SoT
  const { data: dashboardMetrics, refetch: refetchMetrics } = useQuery({ 
    queryKey: ['/api/dashboard/metrics'],
    staleTime: 3 * 60 * 1000
  });
  
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
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    Dashboard Ejecutivo
                  </h1>
                  <p className="text-gray-300 text-sm">
                    Epical Digital • {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/analytics-consolidated">
                <Button 
                  variant="ghost" 
                  className="text-white hover:bg-white/10"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics Completo
                </Button>
              </Link>
              <Button 
                variant="secondary"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
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

        {/* Modern KPI Cards with Animations */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Horas del Mes</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {currentMetrics.totalHoursMonth.toFixed(0)}
                  </span>
                  <span className="text-lg text-gray-500">horas</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {currentMetrics.peopleWorking} personas activas
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <Briefcase className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Proyectos Activos</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-600">
                    {currentMetrics.activeProjects}
                  </span>
                  <span className="text-lg text-gray-500">proyectos</span>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-gray-600">
                    Margen promedio: <span className={`font-semibold ${currentMetrics.avgMargin >= 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                      {(currentMetrics.avgMargin * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Ingresos del Mes</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-600">
                    ${(currentMetrics.totalRevenue / 1000).toFixed(0)}k
                  </span>
                  <span className="text-lg text-gray-500">USD</span>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-gray-600">
                    Costos: <span className="font-semibold text-red-600">
                      ${(currentMetrics.totalCost / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 p-4">
                <div className="p-3 bg-amber-100 rounded-full">
                  <FileSignature className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Cotizaciones Pendientes</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${currentMetrics.pendingQuotations > 5 ? 'text-red-600' : 'text-gray-600'}`}>
                    {currentMetrics.pendingQuotations}
                  </span>
                  <span className="text-lg text-gray-500">pendientes</span>
                </div>
                <div className="mt-3">
                  {currentMetrics.pendingQuotations > 0 ? (
                    <Badge variant="outline" className={currentMetrics.pendingQuotations > 5 ? 'text-red-600 border-red-300' : 'text-gray-600 border-gray-300'}>
                      {currentMetrics.pendingQuotations > 5 ? 'Alta prioridad' : 'Normal'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Al día
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Modern Quick Actions Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
                    <CardDescription className="text-xs">Accede a las tareas más frecuentes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/optimized-quote">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-12 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FileSignature className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-medium">Nueva Cotización</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
                  </Button>
                </Link>
                <Link href="/time-entries">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-12 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <div className="p-2 bg-green-100 rounded-lg mr-3">
                      <Timer className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="font-medium">Registrar Tiempo</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
                  </Button>
                </Link>
                <Link href="/deliverables">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-12 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg mr-3">
                      <Package className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="font-medium">Gestionar Entregables</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
                  </Button>
                </Link>
                <Separator className="my-3" />
                <Link href="/active-projects">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-10 text-sm hover:bg-gray-100"
                  >
                    <Layers className="h-4 w-4 mr-2 opacity-60" />
                    Ver Todos los Proyectos
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Modern Chart Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="lg:col-span-2"
          >
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Resumen del Mes Actual</CardTitle>
                    <CardDescription>Métricas financieras y operativas</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {dashboardMetrics?.currentPeriod || format(new Date(), 'yyyy-MM')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Margen Promedio */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Margen Promedio</div>
                    <div className={`text-3xl font-bold ${currentMetrics.avgMargin >= 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                      {(currentMetrics.avgMargin * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Markup Promedio */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Markup Promedio</div>
                    <div className={`text-3xl font-bold ${currentMetrics.avgMarkup >= 2 ? 'text-green-600' : 'text-red-600'}`}>
                      {currentMetrics.avgMarkup.toFixed(1)}x
                    </div>
                  </div>

                  {/* Utilización de Presupuesto */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Presupuesto Utilizado</div>
                    <div className={`text-3xl font-bold ${currentMetrics.avgBudgetUtil > 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                      {(currentMetrics.avgBudgetUtil * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Horas por Persona */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg col-span-2 md:col-span-3">
                    <div className="text-sm text-gray-600 mb-2">Promedio de Horas por Persona</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {currentMetrics.peopleWorking > 0 
                        ? (currentMetrics.totalHoursMonth / currentMetrics.peopleWorking).toFixed(0)
                        : '0'
                      }h/mes
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Modern Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Actividad Reciente</CardTitle>
                    <CardDescription className="text-xs">Últimas 48 horas</CardDescription>
                  </div>
                </div>
                <Link href="/time-entries">
                  <Button variant="ghost" size="sm">
                    Ver todo
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-4 pr-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => {
                      const Icon = activity.icon;
                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start gap-3 group"
                        >
                          <div className="relative">
                            <div className={`p-2 rounded-lg bg-white shadow-sm border ${
                              activity.type === 'quotation' ? 'border-blue-200' :
                              activity.type === 'project' ? 'border-green-200' :
                              'border-purple-200'
                            }`}>
                              <Icon className={`h-4 w-4 ${activity.color}`} />
                            </div>
                            {index < recentActivity.length - 1 && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-8 bg-gray-200" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {activity.title}
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {activity.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {format(activity.time, "dd/MM 'a las' HH:mm", { locale: es })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 bg-gray-100 rounded-full inline-block mb-3">
                        <Activity className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No hay actividad reciente</p>
                      <p className="text-sm text-gray-400 mt-1">Las acciones aparecerán aquí</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
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