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

  // Queries para datos esenciales
  const { data: activeProjects = [] } = useQuery({ 
    queryKey: ['/api/active-projects'],
    staleTime: 3 * 60 * 1000
  });
  
  const { data: quotations = [] } = useQuery({ 
    queryKey: ['/api/quotations'],
    staleTime: 5 * 60 * 1000
  });
  
  const { data: timeEntries = [] } = useQuery({ 
    queryKey: ['/api/time-entries'],
    staleTime: 2 * 60 * 1000
  });

  const { data: deliverables = [] } = useQuery({ 
    queryKey: ['/api/deliverables'],
    staleTime: 5 * 60 * 1000
  });

  // Calcular métricas del día
  const todayMetrics = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Entradas de tiempo de hoy
    const todayEntries = timeEntries.filter(entry => 
      entry.date && entry.date.startsWith(todayStr)
    );
    
    const hoursToday = todayEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const peopleWorking = new Set(todayEntries.map(entry => entry.personnelId)).size;
    
    // Entregables del mes
    const thisMonth = format(today, 'yyyy-MM');
    const monthDeliverables = deliverables.filter(d => 
      d.createdAt && d.createdAt.startsWith(thisMonth)
    );
    
    return {
      hoursToday,
      peopleWorking,
      deliverablesThisMonth: monthDeliverables.length,
      activeProjectsCount: activeProjects.filter(p => p.status === 'active').length
    };
  }, [timeEntries, deliverables, activeProjects]);

  // Actividad reciente (últimas 48 horas)
  const recentActivity = useMemo(() => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const activities = [];
    
    // Nuevas cotizaciones
    quotations
      .filter(q => q.createdAt && new Date(q.createdAt) > twoDaysAgo)
      .forEach(q => {
        activities.push({
          id: `quote-${q.id}`,
          type: 'quotation',
          title: 'Nueva cotización creada',
          description: `${q.projectName} - ${q.clientName}`,
          time: new Date(q.createdAt),
          icon: FileSignature,
          color: 'text-blue-600'
        });
      });
    
    // Proyectos iniciados
    activeProjects
      .filter(p => p.createdAt && new Date(p.createdAt) > twoDaysAgo)
      .forEach(p => {
        activities.push({
          id: `project-${p.id}`,
          type: 'project',
          title: 'Proyecto iniciado',
          description: p.quotation?.projectName || 'Sin nombre',
          time: new Date(p.createdAt),
          icon: PlayCircle,
          color: 'text-green-600'
        });
      });
    
    // Entregables completados
    deliverables
      .filter(d => d.completedDate && new Date(d.completedDate) > twoDaysAgo)
      .forEach(d => {
        activities.push({
          id: `deliverable-${d.id}`,
          type: 'deliverable',
          title: 'Entregable completado',
          description: d.title,
          time: new Date(d.completedDate),
          icon: CheckCircle,
          color: 'text-emerald-600'
        });
      });
    
    // Ordenar por tiempo descendente
    return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);
  }, [quotations, activeProjects, deliverables]);

  // Alertas inteligentes
  const alerts = useMemo(() => {
    const alertList = [];
    
    // Proyectos sin actividad reciente
    const inactiveProjects = activeProjects.filter(project => {
      if (project.status !== 'active') return false;
      
      const projectEntries = timeEntries.filter(e => e.projectId === project.id);
      if (projectEntries.length === 0) return true;
      
      const lastEntry = projectEntries
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const daysSinceLastActivity = (new Date().getTime() - new Date(lastEntry.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastActivity > 7;
    });
    
    if (inactiveProjects.length > 0) {
      alertList.push({
        id: 'inactive-projects',
        type: 'warning',
        message: `${inactiveProjects.length} proyectos sin actividad en los últimos 7 días`,
        action: '/active-projects'
      });
    }
    
    // Cotizaciones pendientes antiguas
    const oldPendingQuotes = quotations.filter(q => {
      if (q.status !== 'pending') return false;
      const daysSinceCreation = (new Date().getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation > 14;
    });
    
    if (oldPendingQuotes.length > 0) {
      alertList.push({
        id: 'old-quotes',
        type: 'urgent',
        message: `${oldPendingQuotes.length} cotizaciones pendientes por más de 14 días`,
        action: '/quotations'
      });
    }
    
    // Proyectos cerca del límite de presupuesto
    const budgetRiskProjects = activeProjects.filter(project => {
      if (!project.quotation?.baseCost) return false;
      
      const projectEntries = timeEntries.filter(e => e.projectId === project.id);
      const totalCost = projectEntries.reduce((sum, entry) => {
        const rate = entry.hourlyRateAtTime || 50;
        return sum + (entry.hours * rate);
      }, 0);
      
      const budgetUsage = (totalCost / project.quotation.baseCost) * 100;
      return budgetUsage > 80;
    });
    
    if (budgetRiskProjects.length > 0) {
      alertList.push({
        id: 'budget-risk',
        type: 'critical',
        message: `${budgetRiskProjects.length} proyectos superan el 80% del presupuesto`,
        action: '/active-projects'
      });
    }
    
    return alertList;
  }, [activeProjects, timeEntries, quotations]);

  // Datos del gráfico de tendencia semanal
  const weeklyTrend = useMemo(() => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEntries = timeEntries.filter(entry => 
        entry.date && entry.date.startsWith(dateStr)
      );

      const hours = dayEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const people = new Set(dayEntries.map(e => e.personnelId)).size;

      return {
        date: format(date, 'EEE', { locale: es }),
        hours,
        people
      };
    });
  }, [timeEntries]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
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
                <p className="text-sm font-medium text-gray-600 mb-2">Horas Registradas Hoy</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {todayMetrics.hoursToday.toFixed(1)}
                  </span>
                  <span className="text-lg text-gray-500">horas</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {todayMetrics.peopleWorking} personas activas
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
                  <span className="text-3xl font-bold text-gray-900">
                    {todayMetrics.activeProjectsCount}
                  </span>
                  <span className="text-lg text-gray-500">proyectos</span>
                </div>
                <div className="mt-3">
                  <Progress value={75} className="h-1.5" />
                  <span className="text-xs text-gray-500 mt-1">75% capacidad utilizada</span>
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
                <p className="text-sm font-medium text-gray-600 mb-2">Entregables del Mes</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {todayMetrics.deliverablesThisMonth}
                  </span>
                  <span className="text-lg text-gray-500">completados</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">
                    +23% vs mes anterior
                  </span>
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
                  <span className="text-3xl font-bold text-gray-900">
                    {quotations.filter(q => q.status === 'pending').length}
                  </span>
                  <span className="text-lg text-gray-500">pendientes</span>
                </div>
                <div className="mt-3">
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Requiere atención
                  </Badge>
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
                    <CardTitle className="text-lg">Actividad de la Semana</CardTitle>
                    <CardDescription>Tendencia de horas registradas</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    Últimos 7 días
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyTrend}>
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="hours" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
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