import React, { useMemo, useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  ArrowLeft, 
  Users, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Target, 
  Percent,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DateFilter {
  label: string;
  startDate: Date;
  endDate: Date;
}

const ProjectDetailsUnified: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    label: 'Este mes',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date()
  });

  // Filtros temporales disponibles
  const dateFilters: DateFilter[] = [
    {
      label: 'Este mes',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date()
    },
    {
      label: 'Mes pasado',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 0)
    },
    {
      label: 'Este trimestre',
      startDate: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1),
      endDate: new Date()
    },
    {
      label: 'Este año',
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date()
    }
  ];

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  // Obtener datos de la cotización
  const { data: quotation } = useQuery({
    queryKey: [`/api/quotations/${(project as any)?.quotationId}`],
    enabled: !!(project as any)?.quotationId,
  });

  const { data: quotationTeam = [] } = useQuery({
    queryKey: [`/api/quotations/${(project as any)?.quotationId}/team`],
    enabled: !!(project as any)?.quotationId,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  // Filtrar entradas de tiempo por fecha
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries) return [];
    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= dateFilter.startDate && entryDate <= dateFilter.endDate;
    });
  }, [timeEntries, dateFilter]);

  // Calcular métricas
  const metrics = useMemo(() => {
    if (!quotation || !quotationTeam.length) {
      return {
        totalWorkedHours: 0,
        totalWorkedCost: 0,
        estimatedHours: 0,
        baseCost: 0,
        totalAmount: 0,
        markup: 0,
        hoursProgress: 0,
        budgetUtilization: 0
      };
    }

    const totalWorkedHours = filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalWorkedCost = filteredTimeEntries.reduce((sum, entry) => sum + entry.cost, 0);
    const estimatedHours = quotationTeam.reduce((sum, member) => sum + member.hours, 0);
    const baseCost = quotation.baseCost || 0;
    const totalAmount = quotation.totalAmount || 0;
    
    const markup = totalWorkedCost > 0 ? totalAmount / totalWorkedCost : 0;
    const hoursProgress = estimatedHours > 0 ? (totalWorkedHours / estimatedHours) * 100 : 0;
    const budgetUtilization = baseCost > 0 ? (totalWorkedCost / baseCost) * 100 : 0;

    return {
      totalWorkedHours,
      totalWorkedCost,
      estimatedHours,
      baseCost,
      totalAmount,
      markup,
      hoursProgress,
      budgetUtilization
    };
  }, [quotation, quotationTeam, filteredTimeEntries]);

  // Cartas de métricas principales
  const kpiCards = [
    {
      label: "Markup",
      value: `${metrics.markup.toFixed(1)}x`,
      subtitle: `$${metrics.totalAmount.toLocaleString()} / $${metrics.totalWorkedCost.toLocaleString()}`,
      icon: Percent,
      color: metrics.markup >= 2.5 ? "text-green-700" : metrics.markup >= 1.8 ? "text-blue-700" : "text-red-700",
      bgColor: metrics.markup >= 2.5 ? "bg-gradient-to-br from-green-50 to-green-100" : metrics.markup >= 1.8 ? "bg-gradient-to-br from-blue-50 to-blue-100" : "bg-gradient-to-br from-red-50 to-red-100"
    },
    {
      label: "Progreso",
      value: `${metrics.hoursProgress.toFixed(1)}%`,
      subtitle: `${metrics.totalWorkedHours.toFixed(1)}h / ${metrics.estimatedHours}h`,
      icon: Target,
      color: metrics.hoursProgress >= 100 ? "text-green-700" : metrics.hoursProgress >= 75 ? "text-blue-700" : "text-orange-700",
      bgColor: metrics.hoursProgress >= 100 ? "bg-gradient-to-br from-green-50 to-green-100" : metrics.hoursProgress >= 75 ? "bg-gradient-to-br from-blue-50 to-blue-100" : "bg-gradient-to-br from-orange-50 to-orange-100"
    },
    {
      label: "Presupuesto",
      value: `${metrics.budgetUtilization.toFixed(1)}%`,
      subtitle: `$${metrics.totalWorkedCost.toLocaleString()} / $${metrics.baseCost.toLocaleString()}`,
      icon: DollarSign,
      color: metrics.budgetUtilization <= 100 ? "text-green-700" : "text-red-700",
      bgColor: metrics.budgetUtilization <= 100 ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gradient-to-br from-red-50 to-red-100"
    },
    {
      label: "Registros",
      value: filteredTimeEntries.length.toString(),
      subtitle: "Entradas de tiempo",
      icon: Clock,
      color: "text-blue-700",
      bgColor: "bg-gradient-to-br from-blue-50 to-blue-100"
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/6 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Proyecto no encontrado</h1>
            <p className="text-gray-600">No se pudo cargar la información del proyecto.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {quotation?.projectName || (project as any)?.subprojectName || 'Proyecto'}
              </h1>
              <p className="text-gray-600">{client?.name || 'Cliente'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Select value={dateFilter.label} onValueChange={(value) => {
              const filter = dateFilters.find(f => f.label === value);
              if (filter) setDateFilter(filter);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFilters.map((filter) => (
                  <SelectItem key={filter.label} value={filter.label}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateFilter.startDate.toLocaleDateString()} - {dateFilter.endDate.toLocaleDateString()}
            </Badge>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpiCards.map((card, index) => (
            <Card key={index} className={`${card.bgColor} border-l-4 ${card.color.replace('text-', 'border-')}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <card.icon className="h-4 w-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color} mb-1`}>
                  {card.value}
                </div>
                <p className="text-xs text-gray-600">
                  {card.subtitle}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Resumen Ejecutivo</TabsTrigger>
            <TabsTrigger value="team">Gestión del Equipo</TabsTrigger>
            <TabsTrigger value="analytics">Análisis Mensual</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Análisis de Rentabilidad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Markup Actual</span>
                      <span className={`font-bold ${metrics.markup >= 2.5 ? "text-green-600" : metrics.markup >= 1.8 ? "text-blue-600" : "text-red-600"}`}>
                        {metrics.markup.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Precio Cliente</span>
                      <span className="font-bold">${metrics.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Costo Real</span>
                      <span className="font-bold">${metrics.totalWorkedCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Ganancia</span>
                      <span className="font-bold text-green-600">
                        ${(metrics.totalAmount - metrics.totalWorkedCost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Progreso del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Horas Trabajadas</span>
                        <span className="text-sm font-bold">{metrics.totalWorkedHours.toFixed(1)}h / {metrics.estimatedHours}h</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${metrics.hoursProgress >= 100 ? "bg-green-500" : metrics.hoursProgress >= 75 ? "bg-blue-500" : "bg-orange-500"}`}
                          style={{ width: `${Math.min(metrics.hoursProgress, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Presupuesto Utilizado</span>
                        <span className="text-sm font-bold">${metrics.totalWorkedCost.toLocaleString()} / ${metrics.baseCost.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${metrics.budgetUtilization <= 100 ? "bg-green-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(metrics.budgetUtilization, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Equipo del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quotationTeam.map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {member.personnelName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-medium">{member.personnelName}</p>
                          <p className="text-sm text-gray-600">{member.hours}h estimadas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${member.cost?.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">${member.rate}/h</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Análisis Mensual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">Horas Trabajadas</h4>
                    <p className="text-2xl font-bold text-blue-700">{metrics.totalWorkedHours.toFixed(1)}h</p>
                    <p className="text-sm text-blue-600">En el período seleccionado</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900">Costo Acumulado</h4>
                    <p className="text-2xl font-bold text-green-700">${metrics.totalWorkedCost.toLocaleString()}</p>
                    <p className="text-sm text-green-600">Costo real del período</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900">Registros</h4>
                    <p className="text-2xl font-bold text-purple-700">{filteredTimeEntries.length}</p>
                    <p className="text-sm text-purple-600">Entradas de tiempo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDetailsUnified;