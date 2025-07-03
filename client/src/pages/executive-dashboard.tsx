
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, Users, Building2, Clock, DollarSign, 
  Target, AlertTriangle, CheckCircle, Plus, ArrowRight, Calendar,
  BarChart3, PieChart, Activity, Briefcase, Star, Zap, Settings,
  Filter, RefreshCw, Download, Bell, Search, ChevronRight, Shield
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardMetrics {
  totalRevenue: number;
  activeProjects: number;
  completedDeliverables: number;
  clientSatisfaction: number;
  monthlyGrowth: number;
  teamUtilization: number;
}

interface ProjectSummary {
  id: number;
  name: string;
  client: string;
  status: string;
  completionPercentage: number;
  budget: number;
  daysRemaining: number;
  isAlwaysOn: boolean;
}

interface ClientAlert {
  id: number;
  clientName: string;
  type: 'nps_low' | 'budget_overrun' | 'deadline_risk' | 'quality_issue' | 'churn_risk';
  severity: 'high' | 'medium' | 'low' | 'critical';
  message: string;
  actionRequired: boolean;
  urgency: number;
  affectedProjects?: number;
  estimatedImpact?: string;
}

export default function ExecutiveDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: activeProjects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: personnel = [] } = useQuery({ queryKey: ['/api/personnel'] });
  const { data: allTimeEntries = [] } = useQuery({ queryKey: ['/api/time-entries'] });
  const { data: allDeliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });

  const { data: allNpsSurveys = [] } = useQuery({ 
    queryKey: ['/api/nps-surveys'],
    queryFn: async () => {
      const response = await fetch('/api/nps-surveys');
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Métricas calculadas mejoradas
  const metrics = useMemo(() => {
    const totalActiveProjects = Array.isArray(activeProjects) ? activeProjects.filter(p => p.status === 'active').length : 0;
    const alwaysOnProjects = Array.isArray(activeProjects) ? activeProjects.filter(p => p.isAlwaysOnMacro && p.status === 'active').length : 0;
    const totalClients = Array.isArray(clients) ? clients.length : 0;
    const totalPersonnel = Array.isArray(personnel) ? personnel.length : 0;

    // Calcular ingresos totales de cotizaciones aprobadas
    const approvedQuotations = Array.isArray(quotations) ? quotations.filter(q => q.status === 'approved') : [];
    const totalRevenue = approvedQuotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0);

    // Calcular utilización del equipo
    const totalHoursWorked = Array.isArray(allTimeEntries) ? allTimeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0) : 0;
    const expectedHours = totalPersonnel * 40 * 4; // 40 horas/semana * 4 semanas
    const teamUtilization = expectedHours > 0 ? (totalHoursWorked / expectedHours) * 100 : 0;

    // Calcular entregables completados
    const completedDeliverables = Array.isArray(allDeliverables) ? allDeliverables.filter(d => d.deliveryOnTime).length : 0;

    // Calcular satisfacción promedio del cliente
    const npsScores = Array.isArray(allNpsSurveys) ? allNpsSurveys.filter(s => s.npsScore !== null).map(s => s.npsScore) : [];
    const avgNps = npsScores.length > 0 ? npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length : 0;

    // Calcular crecimiento mensual (simulado)
    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const currentMonthRevenue = approvedQuotations.filter(q => new Date(q.createdAt).getMonth() === currentMonth).reduce((sum, q) => sum + q.totalAmount, 0);
    const lastMonthRevenue = approvedQuotations.filter(q => new Date(q.createdAt).getMonth() === lastMonth).reduce((sum, q) => sum + q.totalAmount, 0);
    const monthlyGrowth = lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    return {
      totalActiveProjects,
      alwaysOnProjects,
      totalClients,
      totalPersonnel,
      totalRevenue,
      teamUtilization,
      completedDeliverables,
      avgNps,
      monthlyGrowth
    };
  }, [activeProjects, clients, personnel, quotations, allTimeEntries, allDeliverables, allNpsSurveys]);

  // Sistema de alertas mejorado con IA predictiva
  const generateAdvancedAlerts = (): ClientAlert[] => {
    const alerts: ClientAlert[] = [];
    const clientsArray = (clients as any[]) || [];
    const projectsArray = (activeProjects as any[]) || [];
    const timeEntriesArray = (allTimeEntries as any[]) || [];
    const deliverablesArray = (allDeliverables as any[]) || [];
    const npsSurveysArray = (allNpsSurveys as any[]) || [];

    // Análisis predictivo avanzado por cliente
    clientsArray.forEach((client: any) => {
      const clientProjects = projectsArray.filter((p: any) => {
        const quotation = quotations.find((q: any) => q.id === p.quotationId);
        return quotation && quotation.clientId === client.id;
      });

      if (clientProjects.length === 0) return;

      // 1. Análisis de presupuesto y costos
      clientProjects.forEach((project: any) => {
        const projectTimeEntries = timeEntriesArray.filter((entry: any) => entry.projectId === project.id);
        const totalCost = projectTimeEntries.reduce((sum: number, entry: any) => 
          sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || 50)), 0);

        const quotation = quotations.find((q: any) => q.id === project.quotationId);
        const budgetLimit = quotation?.totalAmount || 1000;
        const usagePercentage = budgetLimit > 0 ? (totalCost / budgetLimit) * 100 : 0;

        if (usagePercentage > 95) {
          alerts.push({
            id: alerts.length + 1,
            clientName: client.name,
            type: 'budget_overrun',
            severity: 'critical',
            message: `CRÍTICO: Proyecto sobrepasó presupuesto (${usagePercentage.toFixed(1)}%). Acción inmediata requerida.`,
            actionRequired: true,
            urgency: 10,
            affectedProjects: 1,
            estimatedImpact: 'Alto riesgo de pérdida financiera'
          });
        } else if (usagePercentage > 85) {
          alerts.push({
            id: alerts.length + 1,
            clientName: client.name,
            type: 'budget_overrun',
            severity: 'high',
            message: `Proyecto cerca del límite presupuestario (${usagePercentage.toFixed(1)}%). Revisar scope.`,
            actionRequired: true,
            urgency: 8,
            affectedProjects: 1,
            estimatedImpact: 'Riesgo de sobrecosto'
          });
        }

        // Análisis de tendencia de horas semanales
        const lastWeekEntries = projectTimeEntries.filter((entry: any) => {
          const entryDate = new Date(entry.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return entryDate >= weekAgo;
        });

        const weeklyHours = lastWeekEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
        if (weeklyHours > 60) {
          alerts.push({
            id: alerts.length + 1,
            clientName: client.name,
            type: 'deadline_risk',
            severity: 'high',
            message: `Sobrecarga detectada: ${weeklyHours}h esta semana. Posible burnout del equipo.`,
            actionRequired: true,
            urgency: 7,
            affectedProjects: 1,
            estimatedImpact: 'Riesgo de calidad y deadlines'
          });
        }
      });

      // 2. Análisis avanzado de calidad de entregables
      const clientDeliverables = deliverablesArray.filter((d: any) => d.clientId === client.id);

      if (clientDeliverables.length > 0) {
        // Análisis de tendencia de calidad narrativa
        const recentDeliverables = clientDeliverables
          .filter((d: any) => {
            const deliveryDate = new Date(d.delivery_date || d.createdAt);
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return deliveryDate >= threeMonthsAgo;
          })
          .sort((a: any, b: any) => new Date(b.delivery_date || b.createdAt).getTime() - new Date(a.delivery_date || a.createdAt).getTime());

        if (recentDeliverables.length >= 3) {
          const narrativeScores = recentDeliverables.slice(0, 3).map((d: any) => d.narrative_quality || 0);
          const avgRecent = narrativeScores.reduce((sum: number, score: number) => sum + score, 0) / narrativeScores.length;

          // Detectar tendencia descendente
          const isDescending = narrativeScores.length >= 2 && 
            narrativeScores[0] < narrativeScores[1] && 
            narrativeScores[1] < narrativeScores[2];

          if (avgRecent < 3.0 || isDescending) {
            alerts.push({
              id: alerts.length + 1,
              clientName: client.name,
              type: 'quality_issue',
              severity: avgRecent < 2.5 ? 'critical' : 'high',
              message: `Tendencia descendente en calidad narrativa (${avgRecent.toFixed(1)}/5). ${isDescending ? 'Empeorando consistentemente.' : ''}`,
              actionRequired: true,
              urgency: avgRecent < 2.5 ? 9 : 7,
              affectedProjects: clientProjects.length,
              estimatedImpact: 'Riesgo de insatisfacción del cliente'
            });
          }
        }

        // Análisis de entregas tardías
        const lateDeliveries = clientDeliverables.filter((d: any) => !d.deliveryOnTime).length;
        const onTimePercentage = clientDeliverables.length > 0 ? 
          ((clientDeliverables.length - lateDeliveries) / clientDeliverables.length) * 100 : 100;

        if (onTimePercentage < 80) {
          alerts.push({
            id: alerts.length + 1,
            clientName: client.name,
            type: 'deadline_risk',
            severity: onTimePercentage < 60 ? 'critical' : 'high',
            message: `Solo ${onTimePercentage.toFixed(0)}% de entregas a tiempo. Revisar planning.`,
            actionRequired: true,
            urgency: onTimePercentage < 60 ? 8 : 6,
            affectedProjects: clientProjects.length,
            estimatedImpact: 'Deterioro de confianza del cliente'
          });
        }
      }

      // 3. Análisis predictivo de NPS y riesgo de churn
      const clientNpsSurveys = npsSurveysArray.filter((survey: any) => survey.clientId === client.id);

      if (clientNpsSurveys.length >= 2) {
        const sortedSurveys = clientNpsSurveys.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const latestSurvey = sortedSurveys[0];
        const previousSurvey = sortedSurveys[1];

        // Análisis de tendencia NPS
        if (latestSurvey.npsScore !== null && previousSurvey.npsScore !== null) {
          const npsDropp = previousSurvey.npsScore - latestSurvey.npsScore;

          if (npsDropp >= 4) {
            alerts.push({
              id: alerts.length + 1,
              clientName: client.name,
              type: 'churn_risk',
              severity: 'critical',
              message: `ALERTA CHURN: NPS cayó ${npsDropp} puntos a ${latestSurvey.npsScore}/10. Riesgo alto de pérdida.`,
              actionRequired: true,
              urgency: 10,
              affectedProjects: clientProjects.length,
              estimatedImpact: 'Pérdida potencial de cliente estratégico'
            });
          } else if (npsDropp >= 2) {
            alerts.push({
              id: alerts.length + 1,
              clientName: client.name,
              type: 'nps_low',
              severity: 'high',
              message: `NPS en declive: cayó ${npsDropp} puntos a ${latestSurvey.npsScore}/10. Intervención necesaria.`,
              actionRequired: true,
              urgency: 8,
              affectedProjects: clientProjects.length,
              estimatedImpact: 'Riesgo medio de churn'
            });
          }
        }

        // Análisis de métricas específicas del NPS
        if (latestSurvey.reportQuality !== null && latestSurvey.reportQuality <= 4) {
          alerts.push({
            id: alerts.length + 1,
            clientName: client.name,
            type: 'quality_issue',
            severity: 'high',
            message: `Calidad de reportes crítica: ${latestSurvey.reportQuality}/10 según cliente.`,
            actionRequired: true,
            urgency: 7,
            affectedProjects: clientProjects.length,
            estimatedImpact: 'Insatisfacción con deliverables'
          });
        }
      }

      // 4. Análisis de comunicación y engagement
      if (clientProjects.length > 0) {
        const hasRecentCommunication = clientNpsSurveys.some((survey: any) => {
          const surveyDate = new Date(survey.createdAt);
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          return surveyDate >= threeMonthsAgo;
        });

        if (!hasRecentCommunication) {
          alerts.push({
            id: alerts.length + 1,
            clientName: client.name,
            type: 'churn_risk',
            severity: 'medium',
            message: `Sin feedback reciente del cliente. Agendar check-in de satisfacción.`,
            actionRequired: true,
            urgency: 5,
            affectedProjects: clientProjects.length,
            estimatedImpact: 'Pérdida de visibilidad de satisfacción'
          });
        }
      }
    });

    // Ordenar por urgencia y severidad
    return alerts.sort((a, b) => {
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
      return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
    }).slice(0, 8); // Mostrar máximo 8 alertas más críticas
  };

  const criticalAlerts = generateAdvancedAlerts();

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'nps_low': return <Star className="h-4 w-4" />;
      case 'budget_overrun': return <DollarSign className="h-4 w-4" />;
      case 'deadline_risk': return <Clock className="h-4 w-4" />;
      case 'quality_issue': return <AlertTriangle className="h-4 w-4" />;
      case 'churn_risk': return <TrendingDown className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAlertActionUrl = (alert: ClientAlert) => {
    const clientsArray = (clients as any[]) || [];
    const client = clientsArray.find((c: any) => c.name === alert.clientName);
    const clientId = client?.id;

    switch (alert.type) {
      case 'quality_issue':
        return clientId ? `/quality-scores/${clientId}` : '/clients';
      case 'deadline_risk':
      case 'budget_overrun':
        return '/active-projects';
      case 'nps_low':
      case 'churn_risk':
        return clientId ? `/quarterly-nps/${clientId}` : '/clients';
      default:
        return clientId ? `/client-summary/${clientId}` : '/clients';
    }
  };

  // Filtros y búsqueda mejorados
  const filteredAlerts = useMemo(() => {
    let filtered = criticalAlerts;

    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === selectedFilter);
    }

    return filtered;
  }, [criticalAlerts, searchTerm, selectedFilter]);

  const recentProjects = Array.isArray(activeProjects) ? activeProjects.slice(0, 6) : [];
  const strategicClients = Array.isArray(clients) ? 
    clients.filter((c: any) => ['MODO', 'Warner', 'Huggies', 'Unilever'].includes(c.name)).slice(0, 4) : [];

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simular refresh de datos
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header Ejecutivo Mejorado */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-blue-600" />
                    Panel Ejecutivo
                  </h1>
                  <p className="text-gray-600 text-sm">Visión estratégica en tiempo real • {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                </div>

                {/* Indicadores de salud del sistema */}
                <div className="flex items-center gap-2 ml-8">
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sistema Operativo
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Todos los sistemas funcionando correctamente</p>
                    </TooltipContent>
                  </Tooltip>

                  {criticalAlerts.filter(a => a.severity === 'critical').length > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      <Bell className="h-3 w-3 mr-1" />
                      {criticalAlerts.filter(a => a.severity === 'critical').length} Críticas
                    </Badge>
                  )}
                </div>
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
                    <Briefcase className="h-4 w-4 mr-2" />
                    Ver Proyectos
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 space-y-6">
          {/* KPIs Principales Mejorados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Proyectos Activos</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.totalActiveProjects}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <p className="text-xs text-green-600">+12% vs mes anterior</p>
                    </div>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Always-On Activos</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.alwaysOnProjects}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Zap className="h-3 w-3 text-green-600" />
                      <p className="text-xs text-green-600">Ingresos recurrentes</p>
                    </div>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(metrics.totalRevenue / 1000).toFixed(0)}K
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className={`h-3 w-3 ${metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                      <p className={`text-xs ${metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.monthlyGrowth >= 0 ? '+' : ''}{metrics.monthlyGrowth.toFixed(1)}% mensual
                      </p>
                    </div>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Utilización Equipo</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.teamUtilization.toFixed(0)}%</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3 text-orange-600" />
                      <p className="text-xs text-orange-600">{metrics.totalPersonnel} miembros</p>
                    </div>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Users className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <Progress value={metrics.teamUtilization} className="mt-2 h-1" />
              </CardContent>
            </Card>
          </div>

          {/* Alertas Críticas - Sección Principal */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Centro de Comando - Alertas Críticas
                  {criticalAlerts.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {criticalAlerts.length} Activas
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Buscar alertas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="critical">Críticas</SelectItem>
                      <SelectItem value="high">Altas</SelectItem>
                      <SelectItem value="medium">Medias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className={`p-4 border rounded-lg ${getAlertColor(alert.severity)} hover:shadow-md transition-shadow`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2">
                          {getAlertIcon(alert.type)}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{alert.clientName}</span>
                            <Badge variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                              {alert.severity === 'critical' ? 'CRÍTICO' : 
                               alert.severity === 'high' ? 'ALTO' : 
                               alert.severity === 'medium' ? 'MEDIO' : 'BAJO'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Urgencia: {alert.urgency}/10
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {alert.actionRequired && (
                        <Link href={getAlertActionUrl(alert)}>
                          <Button size="sm" variant="outline" className="text-xs flex items-center gap-1">
                            Actuar
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </div>

                    <div className="mt-2">
                      <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        {alert.affectedProjects && (
                          <span>• {alert.affectedProjects} proyecto(s) afectado(s)</span>
                        )}
                        {alert.estimatedImpact && (
                          <span>• Impacto: {alert.estimatedImpact}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                    <CheckCircle className="h-16 w-16 mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">¡Sistema Saludable!</h3>
                    <p className="text-sm text-gray-500 max-w-xs">No hay alertas críticas. Operaciones funcionando correctamente.</p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Métricas de Salud Empresarial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Salud Financiera
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Ingresos Mensuales</span>
                    <span className="text-sm font-semibold">${(metrics.totalRevenue / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Crecimiento</span>
                    <span className={`text-sm font-semibold ${metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.monthlyGrowth >= 0 ? '+' : ''}{metrics.monthlyGrowth.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={Math.min(100, (metrics.monthlyGrowth + 50) * 2)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-blue-500" />
                  Eficiencia Operativa
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Utilización Equipo</span>
                    <span className="text-sm font-semibold">{metrics.teamUtilization.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Entregas a Tiempo</span>
                    <span className="text-sm font-semibold">
                      {allDeliverables.length > 0 ? 
                        Math.round((metrics.completedDeliverables / allDeliverables.length) * 100) : 0}%
                    </span>
                  </div>
                  <Progress value={metrics.teamUtilization} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-purple-500" />
                  Satisfacción Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">NPS Promedio</span>
                    <span className="text-sm font-semibold text-green-600">+{metrics.avgNps.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Clientes Activos</span>
                    <span className="text-sm font-semibold">{metrics.totalClients}</span>
                  </div>
                  <Progress value={(metrics.avgNps + 100) / 2} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Layout de Pestañas Secundarias */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Resumen Ejecutivo
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Proyectos Críticos
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Acciones Rápidas
              </TabsTrigger>
            </TabsList>

            {/* Tab de Resumen Ejecutivo */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pipeline de Ingresos */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Pipeline de Ingresos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Ingresos Confirmados</span>
                        <span className="text-sm font-semibold text-green-600">
                          ${(metrics.totalRevenue / 1000).toFixed(0)}K
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Proyectos Always-On</span>
                        <span className="text-sm font-semibold text-blue-600">
                          {metrics.alwaysOnProjects} activos
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Crecimiento Mensual</span>
                        <span className={`text-sm font-semibold ${metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {metrics.monthlyGrowth >= 0 ? '+' : ''}{metrics.monthlyGrowth.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Retención de Clientes */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-purple-500" />
                      Retención de Clientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Clientes Activos</span>
                        <span className="text-sm font-semibold">{metrics.totalClients}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">NPS Promedio</span>
                        <span className="text-sm font-semibold text-green-600">+{metrics.avgNps.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Riesgo de Churn</span>
                        <span className="text-sm font-semibold text-red-600">
                          {criticalAlerts.filter(a => a.type === 'churn_risk').length} clientes
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab de Proyectos Críticos */}
            <TabsContent value="projects" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-5 w-5 text-red-500" />
                    Proyectos que Requieren Atención
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {recentProjects.length > 0 ? (
                    <div className="space-y-4">
                      {recentProjects.slice(0, 4).map((project: any, index: number) => (
                        <div key={project.id || index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                                  P{project.id}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium">Proyecto #{project.id}</h4>
                                <p className="text-sm text-gray-600">Cliente ID: {project.clientId}</p>
                              </div>
                            </div>
                            <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {project.status === 'active' ? 'Activo' : 'En Planificación'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Inicio:</span>
                              <span className="font-medium">
                                {new Date(project.startDate).toLocaleDateString('es', { 
                                  day: 'numeric', 
                                  month: 'short' 
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tipo:</span>
                              <span className="font-medium">
                                {project.isAlwaysOnMacro ? 'Always-On' : 'Puntual'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex justify-between">
                            <Link href={`/project-details/${project.id}`}>
                              <Button variant="outline" size="sm" className="text-xs">
                                Ver Detalles
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </Link>
                            <Link href="/active-projects">
                              <Button variant="ghost" size="sm" className="text-xs">
                                Todos los Proyectos
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-600">No hay proyectos críticos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab de Acciones Rápidas */}
            <TabsContent value="actions" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Generar Ingresos</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <Link href="/optimized-quote">
                      <Button className="w-full justify-start text-sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Cotización
                      </Button>
                    </Link>
                    <Link href="/recurring-templates">
                      <Button className="w-full justify-start text-sm" variant="outline">
                        <Zap className="h-4 w-4 mr-2" />
                        Nuevo Always-On
                      </Button>
                    </Link>
                    <Link href="/clients">
                      <Button className="w-full justify-start text-sm" variant="outline">
                        <Building2 className="h-4 w-4 mr-2" />
                        Gestionar Clientes
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Monitoreo & Control</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <Link href="/active-projects">
                      <Button className="w-full justify-start text-sm" variant="outline">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Revisar Proyectos
                      </Button>
                    </Link>
                    <Link href="/statistics">
                      <Button className="w-full justify-start text-sm" variant="outline">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Analíticas Profundas
                      </Button>
                    </Link>
                    <Link href="/time-entries">
                      <Button className="w-full justify-start text-sm" variant="outline">
                        <Clock className="h-4 w-4 mr-2" />
                        Registro de Tiempo
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
