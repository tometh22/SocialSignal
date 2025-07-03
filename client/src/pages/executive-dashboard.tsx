
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
  Gauge, Timer, AlertCircle, ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar, PieChart as RechartsPieChart, Cell
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
        type: 'critical',
        title: 'Riesgo Presupuestario Crítico',
        message: `${budgetRiskProjects.length} proyecto(s) han superado el 80% del presupuesto`,
        action: 'Revisar costos',
        projects: budgetRiskProjects.map(p => p.name)
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
      return daysSinceLastActivity > 15; // Más de 15 días sin actividad
    });

    if (highValueClients.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Riesgo de Churn de Clientes',
        message: `${highValueClients.length} cliente(s) sin actividad reciente`,
        action: 'Contactar clientes',
        clients: highValueClients.map(c => c.name)
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
        type: 'urgent',
        title: 'Deadlines Próximos',
        message: `${upcomingDeadlines.length} proyecto(s) vencen en los próximos 7 días`,
        action: 'Revisar cronograma',
        projects: upcomingDeadlines.map(p => p.name)
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

    return {
      totalRevenue,
      teamUtilization,
      pipelineValue,
      profitMargin,
      activeProjects: projectsArray.filter(p => p.status === 'active').length,
      pendingQuotations: pendingQuotations.length
    };
  }, [allTimeEntries, activeProjects, quotations, personnel]);

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
        revenue: dayRevenue
      };
    });

    return dailyData;
  }, [allTimeEntries]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel Ejecutivo</h1>
              <p className="text-gray-600 text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Sistema Operativo
                <Badge variant="outline" className="ml-2">
                  Actualizar
                </Badge>
                <Badge variant="outline" className="ml-1">
                  Exportar
                </Badge>
                <span className="ml-4">Visión estratégica en tiempo real • {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}</span>
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
            </div>
            
            {intelligentAlerts.map((alert, index) => (
              <Alert key={index} className={`border-l-4 ${
                alert.type === 'critical' ? 'border-l-red-500 bg-red-50' :
                alert.type === 'urgent' ? 'border-l-orange-500 bg-orange-50' :
                'border-l-yellow-500 bg-yellow-50'
              }`}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      {alert.projects && (
                        <p className="text-xs text-gray-500 mt-1">
                          Proyectos: {alert.projects.join(', ')}
                        </p>
                      )}
                      {alert.clients && (
                        <p className="text-xs text-gray-500 mt-1">
                          Clientes: {alert.clients.join(', ')}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline">
                      {alert.action}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Pestañas principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen Ejecutivo</TabsTrigger>
            <TabsTrigger value="health">Salud Empresarial</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="alerts">Sistema de Alertas</TabsTrigger>
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
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Pipeline de Ventas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">
                    ${businessHealthKPIs.pipelineValue.toLocaleString()}
                  </div>
                  <p className="text-xs text-purple-600">
                    Oportunidades pendientes
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
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
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de tendencias */}
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
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="hours" 
                        stroke="#3b82f6" 
                        name="Horas"
                        strokeWidth={2}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#10b981" 
                        name="Revenue ($)"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pestaña: Salud Empresarial */}
          <TabsContent value="health" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-green-500" />
                    Indicadores de Salud
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Proyectos Activos</span>
                    <Badge variant="secondary">{businessHealthKPIs.activeProjects}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Clientes Activos</span>
                    <Badge variant="secondary">{clients.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Equipo Disponible</span>
                    <Badge variant="secondary">{personnel.length}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    Riesgos Identificados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {intelligentAlerts.map((alert, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.type === 'critical' ? 'text-red-500' :
                          alert.type === 'urgent' ? 'text-orange-500' : 'text-yellow-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="text-xs text-gray-600">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pestaña: Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Análisis Detallado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Funcionalidades de análisis avanzado en desarrollo...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pestaña: Sistema de Alertas */}
          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Configuración de Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Sistema de alertas inteligentes y configuraciones personalizadas...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
