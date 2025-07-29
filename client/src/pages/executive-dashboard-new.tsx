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
  Timer, Eye, Settings, Zap, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Bienvenido a Epical Digital
              </h1>
              <p className="text-sm text-gray-500">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: es })}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Alertas Críticas */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map(alert => (
              <Alert key={alert.id} className={`${getAlertColor(alert.type)} border-l-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getAlertIcon(alert.type)}
                    <AlertDescription className="text-sm font-medium">
                      {alert.message}
                    </AlertDescription>
                  </div>
                  <Link href={alert.action}>
                    <Button variant="ghost" size="sm">
                      Ver detalles
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Métricas del Día */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Horas Registradas Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayMetrics.hoursToday.toFixed(1)}h</div>
              <p className="text-xs text-gray-500 mt-1">
                {todayMetrics.peopleWorking} personas activas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Proyectos Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayMetrics.activeProjectsCount}</div>
              <p className="text-xs text-gray-500 mt-1">
                En desarrollo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Entregables del Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayMetrics.deliverablesThisMonth}</div>
              <p className="text-xs text-gray-500 mt-1">
                Completados en {format(new Date(), 'MMMM', { locale: es })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Cotizaciones Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {quotations.filter(q => q.status === 'pending').length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Por aprobar
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Acciones Rápidas */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
              <CardDescription>Accede a las tareas más frecuentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/optimized-quote">
                <Button variant="outline" className="w-full justify-start">
                  <FileSignature className="h-4 w-4 mr-2" />
                  Nueva Cotización
                </Button>
              </Link>
              <Link href="/time-entries">
                <Button variant="outline" className="w-full justify-start">
                  <Timer className="h-4 w-4 mr-2" />
                  Registrar Tiempo
                </Button>
              </Link>
              <Link href="/deliverables">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Gestionar Entregables
                </Button>
              </Link>
              <Link href="/analytics-consolidated">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Analytics
                </Button>
              </Link>
              <Separator className="my-2" />
              <Link href="/active-projects">
                <Button variant="ghost" className="w-full justify-start text-sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Todos los Proyectos
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tendencia Semanal */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Actividad de la Semana</CardTitle>
              <CardDescription>Horas registradas en los últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrend}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="hours" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorHours)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actividad Reciente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividad Reciente</CardTitle>
            <CardDescription>Últimos movimientos en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map(activity => {
                    const Icon = activity.icon;
                    return (
                      <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                        <div className={`p-2 rounded-lg bg-gray-50 ${activity.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-gray-600">{activity.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(activity.time, "dd/MM 'a las' HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay actividad reciente</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Footer con enlaces rápidos */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-1" />
                Configuración
              </Button>
            </Link>
            <Link href="/help">
              <Button variant="ghost" size="sm">
                <Zap className="h-4 w-4 mr-1" />
                Ayuda
              </Button>
            </Link>
          </div>
          <p className="text-xs">
            Sistema de gestión integral • Epical Digital
          </p>
        </div>
      </div>
    </div>
  );
}