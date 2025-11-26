
import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { 
  TrendingUp, TrendingDown, Clock, DollarSign, 
  Target, AlertTriangle, CheckCircle, Plus, ArrowRight, 
  BarChart3, PieChart, Activity, RefreshCw, Download, 
  Settings, Eye, Calendar, Users, Building2, Zap,
  Info, ChevronRight, HelpCircle, Bell, Shield,
  Gauge, Timer, AlertCircle, ExternalLink, Briefcase,
  Star, Award, FileText, TrendingUpIcon, Percent,
  FileSignature, PlayCircle, MessageSquare, Rocket,
  Package, ListChecks, UserCheck, AlertOctagon
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Queries para datos reales
  const { data: clients = [], isLoading: clientsLoading } = useQuery({ 
    queryKey: ['/api/clients'],
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
  
  const { data: activeProjects = [], isLoading: projectsLoading } = useQuery({ 
    queryKey: ['/api/active-projects'],
    staleTime: 3 * 60 * 1000 // 3 minutos
  });
  
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({ 
    queryKey: ['/api/quotations'],
    staleTime: 5 * 60 * 1000
  });
  
  const { data: personnel = [], isLoading: personnelLoading } = useQuery({ 
    queryKey: ['/api/personnel'],
    staleTime: 10 * 60 * 1000 // 10 minutos
  });
  
  const { data: allTimeEntries = [], isLoading: timeEntriesLoading } = useQuery({ 
    queryKey: ['/api/time-entries'],
    staleTime: 2 * 60 * 1000 // 2 minutos
  });
  
  const { data: allDeliverables = [], isLoading: deliverablesLoading } = useQuery({ 
    queryKey: ['/api/deliverables'],
    staleTime: 5 * 60 * 1000
  });

  // Estados de carga
  const isLoading = clientsLoading || projectsLoading || quotationsLoading || 
                   personnelLoading || timeEntriesLoading || deliverablesLoading;

  // Calcular alertas inteligentes críticas con datos reales
  const intelligentAlerts = useMemo(() => {
    if (isLoading) return [];
    
    const alerts = [];
    const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
    const timeEntriesArray = Array.isArray(allTimeEntries) ? allTimeEntries : [];
    const clientsArray = Array.isArray(clients) ? clients : [];
    const quotationsArray = Array.isArray(quotations) ? quotations : [];

    // Solo generar alertas si hay datos reales
    if (projectsArray.length === 0 && timeEntriesArray.length === 0 && clientsArray.length === 0) {
      return [];
    }

    // Alerta 1: Proyectos en riesgo presupuestario (solo si hay proyectos activos)
    if (projectsArray.length > 0) {
      const budgetRiskProjects = projectsArray.filter(project => {
        if (!project.quotation?.totalAmount) return false;
        
        const projectEntries = timeEntriesArray.filter(entry => entry.projectId === project.id);
        if (projectEntries.length === 0) return false; // Sin entradas de tiempo, no hay riesgo calculable
        
        const actualCost = projectEntries.reduce((sum, entry) => {
          const rate = entry.hourlyRateAtTime || 50;
          return sum + ((entry.hours || 0) * rate);
        }, 0);
        
        const budget = project.quotation.totalAmount;
        const budgetUsagePercentage = budget > 0 ? (actualCost / budget) * 100 : 0;
        
        return budgetUsagePercentage > 80;
      });

      if (budgetRiskProjects.length > 0) {
        alerts.push({
          id: 'budget-risk',
          type: 'critical',
          title: 'Riesgo Presupuestario Crítico',
          message: `${budgetRiskProjects.length} proyecto(s) han superado el 80% del presupuesto`,
          action: 'Revisar costos',
          projects: budgetRiskProjects.map(p => p.quotation?.projectName || 'Proyecto sin nombre'),
          priority: 'high',
          impact: 'financial'
        });
      }
    }

    // Alerta 2: Clientes con alto riesgo de churn (solo si hay clientes y proyectos)
    if (clientsArray.length > 0 && projectsArray.length > 0) {
      const highRiskClients = clientsArray.filter(client => {
        const clientProjects = projectsArray.filter(p => p.quotation?.clientId === client.id);
        
        if (clientProjects.length === 0) return false; // Solo alertar si tenía proyectos pero ahora no tiene actividad
        
        const lastActivity = clientProjects.reduce((latest, project) => {
          const projectEntries = timeEntriesArray
            .filter(entry => entry.projectId === project.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          if (projectEntries.length > 0) {
            const lastEntryDate = new Date(projectEntries[0].date);
            return lastEntryDate > latest ? lastEntryDate : latest;
          }
          return latest;
        }, new Date(0));
        
        const daysSinceLastActivity = (new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastActivity > 15 && lastActivity.getTime() > 0; // Solo si hubo actividad previa
      });

      if (highRiskClients.length > 0) {
        alerts.push({
          id: 'churn-risk',
          type: 'warning',
          title: 'Riesgo de Churn de Clientes',
          message: `${highRiskClients.length} cliente(s) sin actividad reciente`,
          action: 'Contactar clientes',
          clients: highRiskClients.map(c => c.name),
          priority: 'medium',
          impact: 'retention'
        });
      }
    }

    // Alerta 3: Deadlines en peligro (solo si hay proyectos con fechas)
    if (projectsArray.length > 0) {
      const upcomingDeadlines = projectsArray.filter(project => {
        if (!project.expectedEndDate) return false;
        
        const endDate = new Date(project.expectedEndDate);
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
          projects: upcomingDeadlines.map(p => p.quotation?.projectName || 'Proyecto sin nombre'),
          priority: 'high',
          impact: 'delivery'
        });
      }
    }

    // Alerta 4: Proyectos con baja actividad (solo si hay proyectos activos y entradas de tiempo)
    if (projectsArray.length > 0 && timeEntriesArray.length > 0) {
      const lowActivityProjects = projectsArray.filter(project => {
        if (project.status !== 'active') return false;
        
        const projectEntries = timeEntriesArray.filter(entry => entry.projectId === project.id);
        if (projectEntries.length === 0) return false; // Sin historial, no se puede evaluar
        
        // Calcular actividad en los últimos 7 días
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentEntries = projectEntries.filter(entry => 
          new Date(entry.date) >= sevenDaysAgo
        );
        
        const recentHours = recentEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        
        // Solo alertar si tenía actividad previa pero ahora es baja
        const totalHours = projectEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        return totalHours > 0 && recentHours < 5;
      });

      if (lowActivityProjects.length > 0) {
        alerts.push({
          id: 'low-activity',
          type: 'warning',
          title: 'Baja Actividad en Proyectos',
          message: `${lowActivityProjects.length} proyecto(s) con menos de 5 horas en la última semana`,
          action: 'Revisar asignación',
          projects: lowActivityProjects.map(p => p.quotation?.projectName || 'Proyecto sin nombre'),
          priority: 'medium',
          impact: 'productivity'
        });
      }
    }

    return alerts;
  }, [activeProjects, allTimeEntries, clients, quotations, isLoading]);

  // Calcular KPIs de salud empresarial con datos reales
  const businessHealthKPIs = useMemo(() => {
    if (isLoading) {
      return {
        totalRevenue: 0,
        teamUtilization: 0,
        pipelineValue: 0,
        profitMargin: 0,
        avgClientSatisfaction: 0,
        operationalEfficiency: 0,
        activeProjects: 0,
        pendingQuotations: 0,
        totalClients: 0,
        teamSize: 0
      };
    }

    const timeEntriesArray = Array.isArray(allTimeEntries) ? allTimeEntries : [];
    const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
    const quotationsArray = Array.isArray(quotations) ? quotations : [];
    const personnelArray = Array.isArray(personnel) ? personnel : [];
    const clientsArray = Array.isArray(clients) ? clients : [];

    // Si no hay datos, retornar valores en cero
    if (timeEntriesArray.length === 0 && projectsArray.length === 0 && 
        quotationsArray.length === 0 && personnelArray.length === 0 && 
        clientsArray.length === 0) {
      return {
        totalRevenue: 0,
        teamUtilization: 0,
        pipelineValue: 0,
        profitMargin: 0,
        avgClientSatisfaction: 0,
        operationalEfficiency: 0,
        activeProjects: 0,
        pendingQuotations: 0,
        totalClients: 0,
        teamSize: 0
      };
    }

    // Parsear el mes seleccionado
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
    const filterDate = new Date(selectedYear, selectedMonthNum - 1, 1);
    
    // Filtrar entries por el mes seleccionado
    const monthFilteredEntries = timeEntriesArray.filter(entry => {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === filterDate.getMonth() && 
             entryDate.getFullYear() === filterDate.getFullYear();
    });

    // Revenue del mes: calculado a partir de las horas facturables del mes
    // Usamos una tarifa de facturación estimada (2x costo) para estimar el revenue
    const monthRevenue = monthFilteredEntries.reduce((sum, entry) => {
      const costRate = entry.hourlyRateAtTime || 50;
      const billingRate = costRate * 2; // Tarifa de facturación estimada (markup 2x)
      return sum + ((entry.hours || 0) * billingRate);
    }, 0);

    // Revenue total de cotizaciones aprobadas (global, para referencia)
    const totalRevenue = quotationsArray.length > 0 
      ? quotationsArray
          .filter(q => q.status === 'approved')
          .reduce((sum, q) => sum + (q.totalAmount || 0), 0)
      : 0;

    // Utilización del equipo
    let teamUtilization = 0;
    if (personnelArray.length > 0 && monthFilteredEntries.length > 0) {
      const daysInMonth = new Date(selectedYear, selectedMonthNum, 0).getDate();
      const workingDaysInMonth = Math.floor(daysInMonth * (5/7)); // Aproximación días laborables
      const totalAvailableHours = personnelArray.length * 8 * workingDaysInMonth;
      
      const totalLoggedHours = monthFilteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      teamUtilization = totalAvailableHours > 0 ? (totalLoggedHours / totalAvailableHours) * 100 : 0;
    }

    // Pipeline de ventas
    const pendingQuotations = quotationsArray.length > 0 
      ? quotationsArray.filter(q => q.status === 'pending')
      : [];
    const pipelineValue = pendingQuotations.length > 0
      ? pendingQuotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0)
      : 0;

    // Costos del mes
    const monthCosts = monthFilteredEntries.reduce((sum, entry) => {
      const rate = entry.hourlyRateAtTime || 50;
      return sum + ((entry.hours || 0) * rate);
    }, 0);

    // Rentabilidad del mes (usando datos consistentes del mismo mes)
    let profitMargin = 0;
    if (monthRevenue > 0) {
      profitMargin = ((monthRevenue - monthCosts) / monthRevenue) * 100;
    }

    // Satisfacción del cliente (global - no se puede filtrar por mes sin fecha)
    let avgClientSatisfaction = 0;
    const deliverablesArray = Array.isArray(allDeliverables) ? allDeliverables : [];
    if (deliverablesArray.length > 0) {
      const deliverableScores = deliverablesArray
        .filter(d => d.client_feedback !== null && d.client_feedback !== undefined)
        .map(d => d.client_feedback);
      
      avgClientSatisfaction = deliverableScores.length > 0 
        ? deliverableScores.reduce((sum, score) => sum + score, 0) / deliverableScores.length
        : 0;
    }

    // Eficiencia operacional del mes (revenue del mes / horas del mes)
    let operationalEfficiency = 0;
    const totalLoggedHours = monthFilteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    if (totalLoggedHours > 0) {
      operationalEfficiency = monthRevenue / totalLoggedHours;
    }

    return {
      totalRevenue: monthRevenue, // Ahora muestra el revenue del mes seleccionado
      teamUtilization: Math.min(Math.max(teamUtilization, 0), 100), // Entre 0 y 100%
      pipelineValue,
      profitMargin: Math.max(profitMargin, 0), // No menor a 0
      avgClientSatisfaction,
      operationalEfficiency,
      activeProjects: projectsArray.filter(p => p.status === 'active').length,
      pendingQuotations: pendingQuotations.length,
      totalClients: clientsArray.length,
      teamSize: personnelArray.length
    };
  }, [allTimeEntries, activeProjects, quotations, personnel, clients, allDeliverables, isLoading, selectedMonth]);

  // Datos para gráficos con datos reales - filtrando por el mes seleccionado
  const chartData = useMemo(() => {
    if (isLoading) return [];

    const timeEntriesArray = Array.isArray(allTimeEntries) ? allTimeEntries : [];
    
    // Si no hay datos de tiempo, retornar array vacío para mostrar "No hay datos"
    if (timeEntriesArray.length === 0) {
      return [];
    }

    // Parsear el mes seleccionado
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
    const daysInSelectedMonth = new Date(selectedYear, selectedMonthNum, 0).getDate();
    
    // Generar los días del mes seleccionado (mostramos cada semana para no saturar)
    const weeklyData: { date: string; hours: number; revenue: number; efficiency: number }[] = [];
    
    for (let week = 0; week < Math.ceil(daysInSelectedMonth / 7); week++) {
      const weekStart = week * 7 + 1;
      const weekEnd = Math.min((week + 1) * 7, daysInSelectedMonth);
      
      let weekHours = 0;
      let weekRevenue = 0;
      
      for (let day = weekStart; day <= weekEnd; day++) {
        const dateStr = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEntries = timeEntriesArray.filter(entry => 
          entry.date && entry.date.startsWith(dateStr)
        );

        weekHours += dayEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        weekRevenue += dayEntries.reduce((sum, entry) => {
          const rate = entry.hourlyRateAtTime || 50;
          return sum + ((entry.hours || 0) * rate);
        }, 0);
      }
      
      weeklyData.push({
        date: `Sem ${week + 1}`,
        hours: weekHours,
        revenue: weekRevenue,
        efficiency: weekHours > 0 ? weekRevenue / weekHours : 0
      });
    }

    return weeklyData;
  }, [allTimeEntries, isLoading, selectedMonth]);

  // Datos para gráfico de distribución de proyectos con datos reales
  const projectDistribution = useMemo(() => {
    if (isLoading) return [];

    const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
    
    // Si no hay proyectos, retornar array vacío para mostrar "No hay datos"
    if (projectsArray.length === 0) {
      return [];
    }
    
    const statusCounts = projectsArray.reduce((acc, project) => {
      const status = project.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Solo retornar datos si realmente hay proyectos con status
    if (Object.keys(statusCounts).length === 0) {
      return [];
    }

    const statusColors: Record<string, string> = {
      'active': '#10b981',
      'pending': '#f59e0b',
      'completed': '#3b82f6',
      'paused': '#6b7280',
      'cancelled': '#ef4444',
      'unknown': '#8b5cf6'
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status === 'active' ? 'Activos' : 
            status === 'pending' ? 'Pendientes' : 
            status === 'completed' ? 'Completados' : 
            status === 'paused' ? 'Pausados' : 
            status === 'cancelled' ? 'Cancelados' : 'Desconocido',
      value: count as number,
      color: statusColors[status] || statusColors['unknown']
    }));
  }, [activeProjects, isLoading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Invalidar todas las queries para refrescar datos
    await Promise.all([
      fetch('/api/clients').then(() => {}),
      fetch('/api/active-projects').then(() => {}),
      fetch('/api/quotations').then(() => {}),
      fetch('/api/personnel').then(() => {}),
      fetch('/api/time-entries').then(() => {}),
      fetch('/api/deliverables').then(() => {})
    ]);
    
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getAlertColor = (type: string) => {
    switch(type) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'urgent': return 'border-l-orange-500 bg-orange-50';
      case 'warning': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getAlertIcon = (type: string) => {
    switch(type) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'urgent': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simplified Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Dashboard Ejecutivo
              </h1>
              <p className="text-sm text-gray-500">
                {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Filtrar por mes:</span>
              <select 
                value={selectedMonth} 
                onChange={(e) => {
                  console.log('Mes seleccionado:', e.target.value);
                  setSelectedMonth(e.target.value);
                }}
                className="w-[200px] h-10 px-3 py-2 text-sm font-medium bg-white border-2 border-blue-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-blue-400 transition-colors"
                data-testid="select-month-filter"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const label = format(date, "MMMM yyyy", { locale: es });
                  return (
                    <option key={value} value={value} data-testid={`month-option-${value}`}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  );
                })}
              </select>
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
        {/* Loading State */}
        {isLoading && (
          <div className="mb-6">
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin mr-3" />
                <span>Cargando datos del sistema...</span>
              </div>
            </Card>
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
            {/* Indicador del mes seleccionado */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Resumen Ejecutivo del Mes</h2>
                <p className="text-sm text-gray-500">Evolución del mes en curso</p>
              </div>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                {format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), "MMMM yyyy", { locale: es }).charAt(0).toUpperCase() + format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), "MMMM yyyy", { locale: es }).slice(1)}
              </Badge>
            </div>

            {/* KPIs principales con datos reales */}
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

            {/* Alertas del Sistema */}
            {intelligentAlerts.length > 0 ? (
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Alertas Inteligentes Críticas</h2>
                  <Badge variant="destructive" className="ml-2">
                    {intelligentAlerts.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            ) : !isLoading && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Sistema Operando Correctamente</h2>
                  <Badge variant="secondary" className="ml-2">
                    Sin Alertas
                  </Badge>
                </div>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-3" />
                    <p className="text-green-700 font-medium mb-1">No se detectaron alertas críticas</p>
                    <p className="text-green-600 text-sm">
                      {(Array.isArray(activeProjects) && activeProjects.length === 0) ? 
                        "No hay proyectos activos que monitorear" : 
                        "Todos los proyectos están operando dentro de los parámetros normales"
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Gráficos de tendencias con datos reales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Tendencias del Mes ({format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), "MMMM yyyy", { locale: es })})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {chartData.length > 0 ? (
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
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">No hay datos disponibles</p>
                      </div>
                    )}
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
                    {projectDistribution.length > 0 ? (
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
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">No hay datos de proyectos</p>
                      </div>
                    )}
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
                          <Star key={i} className={`h-4 w-4 ${businessHealthKPIs.avgClientSatisfaction > 0 && i < Math.floor(businessHealthKPIs.avgClientSatisfaction) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <Badge variant="secondary">
                        {businessHealthKPIs.avgClientSatisfaction > 0 ? businessHealthKPIs.avgClientSatisfaction.toFixed(1) : '0.0'}/5
                      </Badge>
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
                    <Progress value={Math.max(0, businessHealthKPIs.profitMargin)} className="h-2" />
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
                    {chartData.length > 0 ? (
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
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">No hay datos de productividad</p>
                      </div>
                    )}
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
                          ${businessHealthKPIs.totalClients > 0 && businessHealthKPIs.totalRevenue > 0 
                            ? (businessHealthKPIs.totalRevenue / businessHealthKPIs.totalClients).toFixed(0) 
                            : '0'}
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
                          {businessHealthKPIs.totalClients > 0 && businessHealthKPIs.activeProjects > 0
                            ? (businessHealthKPIs.activeProjects / businessHealthKPIs.totalClients).toFixed(1) 
                            : '0.0'}
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
                          {Array.isArray(quotations) && quotations.length > 0 && businessHealthKPIs.activeProjects > 0 
                            ? ((businessHealthKPIs.activeProjects / quotations.length) * 100).toFixed(1) 
                            : '0.0'}%
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
                      <h4 className="font-medium">Alertas de Actividad</h4>
                      <Badge variant="outline">Activo</Badge>
                    </div>
                    <p className="text-sm text-gray-600">Se activan cuando la actividad es menor a 5h/semana</p>
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
                    {intelligentAlerts.length > 0 ? (
                      intelligentAlerts.slice(0, 3).map((alert, index) => (
                        <div key={alert.id} className={`flex items-start gap-3 p-3 ${getAlertColor(alert.type).replace('border-l-4 ', '')} rounded-lg`}>
                          {getAlertIcon(alert.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.title}</p>
                            <p className="text-xs text-gray-600">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-1">Hace {index + 1} hora{index > 0 ? 's' : ''}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                        <p className="text-gray-600">No hay alertas activas</p>
                        <p className="text-sm text-gray-500">El sistema está funcionando correctamente</p>
                      </div>
                    )}
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
