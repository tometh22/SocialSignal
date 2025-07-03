
import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, Clock, DollarSign, 
  Target, AlertTriangle, CheckCircle, Plus, ArrowRight, 
  BarChart3, PieChart, Activity, RefreshCw, Download, 
  Settings, Eye, Calendar, Users, Building2, Zap,
  Info, ChevronRight, HelpCircle, Bell, Shield,
  Gauge, Timer, AlertCircle, ExternalLink, Briefcase,
  Star, Award, FileText, TrendingUpIcon, Percent
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Queries para datos
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: activeProjects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: personnel = [] } = useQuery({ queryKey: ['/api/personnel'] });
  const { data: allTimeEntries = [] } = useQuery({ queryKey: ['/api/time-entries'] });
  const { data: allDeliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });

  // Calcular alertas inteligentes críticas
  const intelligentAlerts = useMemo(() => {
    const alerts = [];
    const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
    const timeEntriesArray = Array.isArray(allTimeEntries) ? allTimeEntries : [];
    const clientsArray = Array.isArray(clients) ? clients : [];

    // Alerta 1: Proyectos en riesgo presupuestario
    const budgetRiskProjects = projectsArray.filter(project => {
      const projectEntries = timeEntriesArray.filter(entry => entry.projectId === project.id);
      const actualCost = projectEntries.reduce((sum, entry) => sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || 50)), 0);
      const budget = project.budget || 0;
      return budget > 0 && (actualCost / budget) > 0.8;
    });

    if (budgetRiskProjects.length > 0) {
      alerts.push({
        id: 'budget-risk',
        type: 'critical',
        title: 'Riesgo Presupuestario Crítico',
        message: `${budgetRiskProjects.length} proyecto(s) han superado el 80% del presupuesto`,
        action: 'Revisar costos',
        projects: budgetRiskProjects.map(p => p.name),
        priority: 'high',
        impact: 'financial'
      });
    }

    // Alerta 2: Clientes con alto riesgo de churn
    const highValueClients = clientsArray.filter(client => {
      const clientProjects = projectsArray.filter(p => p.clientId === client.id);
      const lastActivity = clientProjects.reduce((latest, project) => {
        const projectEntries = timeEntriesArray.filter(entry => entry.projectId === project.id);
        if (projectEntries.length > 0) {
          const lastEntry = projectEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          return new Date(lastEntry.date) > latest ? new Date(lastEntry.date) : latest;
        }
        return latest;
      }, new Date(0));
      
      const daysSinceLastActivity = (new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastActivity > 15;
    });

    if (highValueClients.length > 0) {
      alerts.push({
        id: 'churn-risk',
        type: 'warning',
        title: 'Riesgo de Churn de Clientes',
        message: `${highValueClients.length} cliente(s) sin actividad reciente`,
        action: 'Contactar clientes',
        clients: highValueClients.map(c => c.name),
        priority: 'medium',
        impact: 'retention'
      });
    }

    // Alerta 3: Deadlines en peligro
    const upcomingDeadlines = projectsArray.filter(project => {
      if (!project.endDate) return false;
      const endDate = new Date(project.endDate);
      const now = new Date();
      const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDeadline <= 7 && daysUntilDeadline > 0;
    });

    if (upcomingDeadlines.length > 0) {
      alerts.push({
        id: 'deadline-risk',
        type: 'urgent',
        title: 'Deadlines Próximos',
        message: `${upcomingDeadlines.length} proyecto(s) vencen en los próximos 7 días`,
        action: 'Revisar cronograma',
        projects: upcomingDeadlines.map(p => p.name),
        priority: 'high',
        impact: 'delivery'
      });
    }

    // Alerta 4: Calidad en riesgo
    const qualityRiskProjects = projectsArray.filter(project => {
      const projectEntries = timeEntriesArray.filter(entry => entry.projectId === project.id);
      const avgHoursPerDay = projectEntries.length > 0 ? 
        projectEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0) / projectEntries.length : 0;
      return avgHoursPerDay < 2; // Menos de 2 horas promedio por día indica posible problema
    });

    if (qualityRiskProjects.length > 0) {
      alerts.push({
        id: 'quality-risk',
        type: 'warning',
        title: 'Riesgo de Calidad',
        message: `${qualityRiskProjects.length} proyecto(s) con baja dedicación de tiempo`,
        action: 'Revisar asignación',
        projects: qualityRiskProjects.map(p => p.name),
        priority: 'medium',
        impact: 'quality'
      });
    }

    return alerts;
  }, [activeProjects, allTimeEntries, clients]);

  // Calcular KPIs de salud empresarial
  const businessHealthKPIs = useMemo(() => {
    const timeEntriesArray = Array.isArray(allTimeEntries) ? allTimeEntries : [];
    const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
    const quotationsArray = Array.isArray(quotations) ? quotations : [];

    // Revenue total
    const totalRevenue = quotationsArray
      .filter(q => q.status === 'approved')
      .reduce((sum, q) => sum + (q.totalAmount || 0), 0);

    // Utilización del equipo
    const totalAvailableHours = personnel.length * 8 * 5 * 4; // 8h/día, 5 días/semana, 4 semanas
    const totalLoggedHours = timeEntriesArray.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const teamUtilization = totalAvailableHours > 0 ? (totalLoggedHours / totalAvailableHours) * 100 : 0;

    // Pipeline de ventas
    const pendingQuotations = quotationsArray.filter(q => q.status === 'pending');
    const pipelineValue = pendingQuotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0);

    // Rentabilidad
    const totalCosts = timeEntriesArray.reduce((sum, entry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || 50)), 0);
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;

    // Satisfacción del cliente (simulado)
    const avgClientSatisfaction = 4.2; // En escala de 1-5

    // Eficiencia operacional
    const operationalEfficiency = teamUtilization > 0 ? (totalRevenue / totalLoggedHours) : 0;

    return {
      totalRevenue,
      teamUtilization,
      pipelineValue,
      profitMargin,
      avgClientSatisfaction,
      operationalEfficiency,
      activeProjects: projectsArray.filter(p => p.status === 'active').length,
      pendingQuotations: pendingQuotations.length,
      totalClients: clients.length,
      teamSize: personnel.length
    };
  }, [allTimeEntries, activeProjects, quotations, personnel, clients]);

  // Datos para gráficos
  const chartData = useMemo(() => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    const dailyData = last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEntries = allTimeEntries.filter(entry => 
        entry.date && entry.date.startsWith(dateStr)
      );

      const dayHours = dayEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const dayRevenue = dayEntries.reduce((sum, entry) => 
        sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || 50)), 0);

      return {
        date: format(date, 'dd/MM'),
        hours: dayHours,
        revenue: dayRevenue,
        efficiency: dayHours > 0 ? dayRevenue / dayHours : 0
      };
    });

    return dailyData;
  }, [allTimeEntries]);

  // Datos para gráfico de distribución de proyectos
  const projectDistribution = useMemo(() => {
    const statusCounts = activeProjects.reduce((acc, project) => {
      const status = project.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      color: status === 'active' ? '#10b981' : status === 'pending' ? '#f59e0b' : '#ef4444'
    }));
  }, [activeProjects]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getAlertColor = (type) => {
    switch(type) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'urgent': return 'border-l-orange-500 bg-orange-50';
      case 'warning': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getAlertIcon = (type) => {
    switch(type) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'urgent': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-blue-600" />
                Panel Ejecutivo
              </h1>
              <p className="text-gray-600 text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Sistema Operativo
                <Badge variant="outline" className="ml-2">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Actualizar
                </Badge>
                <Badge variant="outline" className="ml-1">
                  <Download className="h-3 w-3 mr-1" />
                  Exportar
                </Badge>
                <span className="ml-4 text-gray-500">Visión estratégica en tiempo real • {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>

              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>

              <Link href="/optimized-quote">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Cotización
                </Button>
              </Link>

              <Link href="/active-projects">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Proyectos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Alertas Inteligentes Críticas */}
        {intelligentAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">Alertas Inteligentes Críticas</h2>
              <Badge variant="destructive" className="ml-2">
                {intelligentAlerts.length}
              </Badge>
              <div className="flex ml-4 gap-2">
                {intelligentAlerts.filter(a => a.type === 'critical').length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {intelligentAlerts.filter(a => a.type === 'critical').length} Críticas
                  </Badge>
                )}
                {intelligentAlerts.filter(a => a.type === 'urgent').length > 0 && (
                  <Badge className="bg-orange-500 text-xs">
                    {intelligentAlerts.filter(a => a.type === 'urgent').length} Urgentes
                  </Badge>
                )}
                {intelligentAlerts.filter(a => a.type === 'warning').length > 0 && (
                  <Badge className="bg-yellow-500 text-xs">
                    {intelligentAlerts.filter(a => a.type === 'warning').length} Advertencias
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {intelligentAlerts.map((alert) => (
                <Alert key={alert.id} className={`border-l-4 ${getAlertColor(alert.type)}`}>
                  {getAlertIcon(alert.type)}
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{alert.title}</p>
                        <Badge variant="outline" className="text-xs">
                          {alert.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      {alert.projects && (
                        <p className="text-xs text-gray-500">
                          Proyectos: {alert.projects.slice(0, 2).join(', ')}
                          {alert.projects.length > 2 && ` +${alert.projects.length - 2} más`}
                        </p>
                      )}
                      {alert.clients && (
                        <p className="text-xs text-gray-500">
                          Clientes: {alert.clients.slice(0, 2).join(', ')}
                          {alert.clients.length > 2 && ` +${alert.clients.length - 2} más`}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <Badge variant="secondary" className="text-xs">
                          {alert.impact}
                        </Badge>
                        <Button size="sm" variant="outline" className="text-xs">
                          {alert.action}
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Pestañas principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resumen Ejecutivo
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Salud Empresarial
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Sistema de Alertas
            </TabsTrigger>
          </TabsList>

          {/* Pestaña: Resumen Ejecutivo */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPIs principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Revenue Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">
                    ${businessHealthKPIs.totalRevenue.toLocaleString()}
                  </div>
                  <p className="text-xs text-green-600">
                    {businessHealthKPIs.pendingQuotations} cotizaciones pendientes
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">Pipeline: ${businessHealthKPIs.pipelineValue.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Utilización del Equipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">
                    {businessHealthKPIs.teamUtilization.toFixed(1)}%
                  </div>
                  <Progress value={businessHealthKPIs.teamUtilization} className="mt-2" />
                  <p className="text-xs text-blue-600 mt-1">
                    {businessHealthKPIs.teamSize} miembros del equipo
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Proyectos Activos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">
                    {businessHealthKPIs.activeProjects}
                  </div>
                  <p className="text-xs text-purple-600">
                    {businessHealthKPIs.totalClients} clientes totales
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Briefcase className="h-3 w-3 text-purple-500" />
                    <span className="text-xs text-purple-600">En desarrollo activo</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Rentabilidad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900">
                    {businessHealthKPIs.profitMargin.toFixed(1)}%
                  </div>
                  <p className="text-xs text-orange-600">
                    Margen de ganancia
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <TrendingUpIcon className="h-3 w-3 text-orange-500" />
                    <span className="text-xs text-orange-600">
                      ${businessHealthKPIs.operationalEfficiency.toFixed(0)}/h eficiencia
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos de tendencias */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Tendencias de los Últimos 7 Días
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Area 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="hours" 
                          stroke="#3b82f6" 
                          fill="#3b82f620"
                          name="Horas"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#10b981" 
                          name="Revenue ($)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Distribución de Proyectos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={projectDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({name, value}) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {projectDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pestaña: Salud Empresarial */}
          <TabsContent value="health" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-green-500" />
                    Indicadores de Salud
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Satisfacción del Cliente</span>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.floor(businessHealthKPIs.avgClientSatisfaction) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <Badge variant="secondary">{businessHealthKPIs.avgClientSatisfaction}/5</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Proyectos Activos</span>
                    <Badge variant="secondary">{businessHealthKPIs.activeProjects}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Clientes Activos</span>
                    <Badge variant="secondary">{businessHealthKPIs.totalClients}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Equipo Disponible</span>
                    <Badge variant="secondary">{businessHealthKPIs.teamSize}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    Matriz de Riesgos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">Riesgo Alto</span>
                      </div>
                      <Badge variant="destructive">
                        {intelligentAlerts.filter(a => a.type === 'critical').length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">Riesgo Medio</span>
                      </div>
                      <Badge className="bg-orange-500">
                        {intelligentAlerts.filter(a => a.type === 'urgent').length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">Riesgo Bajo</span>
                      </div>
                      <Badge className="bg-yellow-500">
                        {intelligentAlerts.filter(a => a.type === 'warning').length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Eficiencia Operacional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Utilización del Equipo</span>
                      <span>{businessHealthKPIs.teamUtilization.toFixed(1)}%</span>
                    </div>
                    <Progress value={businessHealthKPIs.teamUtilization} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Rentabilidad</span>
                      <span>{businessHealthKPIs.profitMargin.toFixed(1)}%</span>
                    </div>
                    <Progress value={businessHealthKPIs.profitMargin} className="h-2" />
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Eficiencia por Hora</span>
                      <span className="font-medium">${businessHealthKPIs.operationalEfficiency.toFixed(0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pestaña: Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Análisis de Productividad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="efficiency" fill="#8884d8" name="Eficiencia ($/h)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Métricas Clave
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Revenue por Cliente</p>
                        <p className="text-xs text-gray-600">Promedio mensual</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          ${businessHealthKPIs.totalClients > 0 ? (businessHealthKPIs.totalRevenue / businessHealthKPIs.totalClients).toFixed(0) : 0}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Proyectos por Cliente</p>
                        <p className="text-xs text-gray-600">Promedio activo</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">
                          {businessHealthKPIs.totalClients > 0 ? (businessHealthKPIs.activeProjects / businessHealthKPIs.totalClients).toFixed(1) : 0}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Tasa de Conversión</p>
                        <p className="text-xs text-gray-600">Cotizaciones → Proyectos</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-600">
                          {quotations.length > 0 ? ((businessHealthKPIs.activeProjects / quotations.length) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pestaña: Sistema de Alertas */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Configuración de Alertas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Alertas Presupuestarias</h4>
                      <Badge variant="outline">Activo</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Se activan cuando un proyecto supera el 80% del presupuesto</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Alertas de Churn</h4>
                      <Badge variant="outline">Activo</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Se activan cuando un cliente no tiene actividad por 15+ días</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Alertas de Deadline</h4>
                      <Badge variant="outline">Activo</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Se activan 7 días antes de la fecha límite</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Alertas de Calidad</h4>
                      <Badge variant="outline">Activo</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Se activan cuando la dedicación es menor a 2h/día promedio</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Historial de Alertas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Riesgo Presupuestario</p>
                        <p className="text-xs text-gray-600">Proyecto Warner Bros superó 85% del presupuesto</p>
                        <p className="text-xs text-gray-500 mt-1">Hace 2 horas</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                      <Clock className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Deadline Próximo</p>
                        <p className="text-xs text-gray-600">Entregable de Disney vence en 3 días</p>
                        <p className="text-xs text-gray-500 mt-1">Hace 1 día</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Cliente Inactivo</p>
                        <p className="text-xs text-gray-600">Netflix sin actividad por 18 días</p>
                        <p className="text-xs text-gray-500 mt-1">Hace 3 días</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
