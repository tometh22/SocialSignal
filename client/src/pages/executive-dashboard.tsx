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
  Info, ChevronRight, HelpCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, ReferenceLine 
} from 'recharts';

export default function ExecutiveDashboard() {
  const [refreshing, setRefreshing] = useState(false);

  // Queries para datos
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: activeProjects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: personnel = [] } = useQuery({ queryKey: ['/api/personnel'] });
  const { data: allTimeEntries = [] } = useQuery({ queryKey: ['/api/time-entries'] });
  const { data: allDeliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });

  // Calcular métricas globales
  const globalMetrics = useMemo(() => {
    const timeEntriesArray = Array.isArray(allTimeEntries) ? allTimeEntries : [];
    const projectsArray = Array.isArray(activeProjects) ? activeProjects : [];
    const quotationsArray = Array.isArray(quotations) ? quotations : [];
    const deliverablesArray = Array.isArray(allDeliverables) ? allDeliverables : [];

    // Horas registradas
    const totalHours = timeEntriesArray.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const billableHours = timeEntriesArray.filter(entry => entry.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const nonBillableHours = totalHours - billableHours;

    // Costos y presupuestos
    const approvedQuotations = quotationsArray.filter(q => q.status === 'approved');
    const totalBudget = approvedQuotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
    const actualCost = timeEntriesArray.reduce((sum, entry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || 50)), 0);

    // Tiempo restante (días totales vs días transcurridos)
    const activeProjectsArray = projectsArray.filter(p => p.status === 'active');
    const totalDaysRemaining = activeProjectsArray.reduce((sum, project) => {
      if (project.startDate && project.endDate) {
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        const now = new Date();
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        return sum + remainingDays;
      }
      return sum;
    }, 0);

    const totalProjectDays = activeProjectsArray.reduce((sum, project) => {
      if (project.startDate && project.endDate) {
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }
      return sum + 30; // Default 30 días si no hay fechas
    }, 0);

    // Desviaciones
    const costVariance = totalBudget > 0 ? ((actualCost - totalBudget) / totalBudget) * 100 : 0;
    const scheduleVariance = totalProjectDays > 0 ? ((totalDaysRemaining / totalProjectDays) * 100) - 100 : 0;

    // Riesgos
    const budgetRisk = Math.abs(costVariance) > 15 ? 'Alto' : Math.abs(costVariance) > 5 ? 'Medio' : 'Bajo';
    const scheduleRisk = Math.abs(scheduleVariance) > 20 ? 'Alto' : Math.abs(scheduleVariance) > 10 ? 'Medio' : 'Bajo';

    return {
      totalHours,
      billableHours,
      nonBillableHours,
      totalBudget,
      actualCost,
      totalDaysRemaining,
      totalProjectDays,
      costVariance,
      scheduleVariance,
      budgetRisk,
      scheduleRisk
    };
  }, [allTimeEntries, activeProjects, quotations]);

  // Datos para el gráfico de evolución
  const evolutionData = useMemo(() => {
    const last30Days = Array.from({length: 30}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date;
    });

    return last30Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEntries = allTimeEntries.filter(entry => 
        entry.date && entry.date.startsWith(dateStr)
      );

      const dayHours = dayEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const dayCost = dayEntries.reduce((sum, entry) => 
        sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || 50)), 0);

      return {
        date: format(date, 'dd/MM'),
        hours: dayHours,
        cost: dayCost
      };
    });
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

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Métricas principales - Cards grandes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Horas Registradas */}
          <Card className="border-l-4 border-l-blue-500 bg-blue-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Horas Registradas
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="text-4xl font-bold text-blue-900">
                  {globalMetrics.totalHours}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-blue-700">
                    <span className="font-semibold">{globalMetrics.billableHours}</span> facturables
                  </div>
                  <div className="text-blue-600">
                    <span className="font-semibold">{globalMetrics.nonBillableHours}</span> no facturables
                  </div>
                </div>
                <div className="text-xs text-blue-600">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Distribución
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Costo vs Presupuesto */}
          <Card className="border-l-4 border-l-green-500 bg-green-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-green-700 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Costo vs Presupuesto
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="text-4xl font-bold text-green-900">
                  ${globalMetrics.actualCost.toLocaleString()}
                </div>
                <div className="text-sm text-green-700">
                  de ${globalMetrics.totalBudget.toLocaleString()} presupuestados
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="text-green-600">
                    {globalMetrics.totalBudget > 0 
                      ? `${((globalMetrics.actualCost / globalMetrics.totalBudget) * 100).toFixed(1)}% del presupuesto usado`
                      : '0.0% del presupuesto usado'
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tiempo Restante */}
          <Card className="border-l-4 border-l-orange-500 bg-orange-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-orange-700 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tiempo Restante
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="text-4xl font-bold text-orange-900">
                  {globalMetrics.totalDaysRemaining}
                </div>
                <div className="text-sm text-orange-700">
                  días de {globalMetrics.totalProjectDays} totales
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="text-orange-600">
                    {globalMetrics.totalProjectDays > 0 
                      ? `${((globalMetrics.totalDaysRemaining / globalMetrics.totalProjectDays) * 100).toFixed(0)}% completado`
                      : '0% completado'
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitores de Control */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monitor de Desviaciones */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Monitor de Desviaciones
                <Button variant="ghost" size="sm">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Desviación de costo</div>
                    <div className="text-xs text-gray-600">Comparado con lo presupuestado</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 font-semibold">
                    {globalMetrics.costVariance >= 0 ? '+' : ''}{globalMetrics.costVariance.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Desviación de tiempo</div>
                    <div className="text-xs text-gray-600">Comparado con el plan inicial</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 font-semibold">
                    {globalMetrics.scheduleVariance >= 0 ? '+' : ''}{globalMetrics.scheduleVariance.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monitor de Riesgos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Monitor de Riesgos
                <Button variant="ghost" size="sm">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Riesgo de presupuesto</div>
                    <div className="text-xs text-gray-600">Probabilidad de exceder el presupuesto</div>
                  </div>
                </div>
                <Badge variant={globalMetrics.budgetRisk === 'Alto' ? 'destructive' : 
                              globalMetrics.budgetRisk === 'Medio' ? 'default' : 'secondary'}>
                  {globalMetrics.budgetRisk === 'Alto' ? 'Alto' : 
                   globalMetrics.budgetRisk === 'Medio' ? 'Medio' : 'Bajo'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Riesgo de cronograma</div>
                    <div className="text-xs text-gray-600">Probabilidad de retraso en la entrega</div>
                  </div>
                </div>
                <Badge variant={globalMetrics.scheduleRisk === 'Alto' ? 'destructive' : 
                              globalMetrics.scheduleRisk === 'Medio' ? 'default' : 'secondary'}>
                  {globalMetrics.scheduleRisk === 'Alto' ? 'Alto' : 
                   globalMetrics.scheduleRisk === 'Medio' ? 'Medio' : 'Bajo'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Evolución */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Evolución de Tiempo y Costo
                <Button variant="ghost" size="sm">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardTitle>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              Seguimiento acumulado a lo largo del proyecto
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {evolutionData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData}>
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
                      dataKey="cost" 
                      stroke="#10b981" 
                      name="Costo ($)"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                <BarChart3 className="h-16 w-16 mb-4" />
                <p className="text-sm">No hay suficientes datos para mostrar la evolución.</p>
                <p className="text-xs mt-2">Registre más horas en diferentes fechas para visualizar la tendencia.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}