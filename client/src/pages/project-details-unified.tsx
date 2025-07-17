import React, { useMemo, useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Target, 
  Percent,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompleteProjectData } from '@/hooks/useCompleteProjectData';

// Tipos para el proyecto
interface Project {
  id: number;
  name: string;
  status: string;
  clientId: number;
  startDate: string;
  expectedEndDate: string;
}

interface DateFilter {
  label: string;
  startDate: Date;
  endDate: Date;
}

const ProjectDetailsUnified: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
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

  // Mapear filtro a formato del hook
  const getTimeFilterForHook = (filter: DateFilter) => {
    if (filter.label.includes('Mes pasado')) return 'last_month';
    if (filter.label.includes('Este mes')) return 'current_month';
    if (filter.label.includes('Este trimestre')) return 'current_quarter';
    if (filter.label.includes('Este año')) return 'current_year';
    return 'all';
  };

  // SINGLE SOURCE OF TRUTH: usar hook centralizado
  const { data: completeData, isLoading: completeDataLoading } = useCompleteProjectData(
    projectId ? parseInt(projectId) : 0,
    getTimeFilterForHook(dateFilter)
  );

  // Datos del proyecto (para información básica)
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  // Debug: Log data to verify it's working
  console.log('🔍 PROJECT DATA:', project);
  console.log('🔍 COMPLETE DATA:', completeData);
  console.log('🔍 PROJECT ID:', projectId);
  console.log('🔍 LOADING STATES:', { isLoading, completeDataLoading });

  // Métricas principales calculadas desde completeData
  const metrics = useMemo(() => {
    if (!completeData) {
      return [
        {
          label: "Markup",
          value: "0.0x",
          subtitle: "Cargando...",
          icon: Percent,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100"
        },
        {
          label: "Progreso",
          value: "0%",
          subtitle: "Cargando...",
          icon: Target,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100"
        },
        {
          label: "Presupuesto",
          value: "0%",
          subtitle: "Cargando...",
          icon: DollarSign,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100"
        },
        {
          label: "Registros",
          value: "0",
          subtitle: "Cargando...",
          icon: Clock,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100"
        }
      ];
    }

    const {
      quotation,
      actuals,
      metrics: calculatedMetrics
    } = completeData;

    const markup = calculatedMetrics?.markup || 0;
    const hoursProgress = quotation?.estimatedHours > 0 ? (actuals?.totalWorkedHours / quotation.estimatedHours) * 100 : 0;
    const budgetUtilization = quotation?.baseCost > 0 ? (actuals?.totalWorkedCost / quotation.baseCost) * 100 : 0;

    return [
      {
        label: "Markup",
        value: `${markup.toFixed(1)}x`,
        subtitle: `$${(quotation?.totalAmount || 0).toLocaleString()} / $${(actuals?.totalWorkedCost || 0).toLocaleString()}`,
        icon: Percent,
        color: markup >= 2.5 ? "text-green-700" : markup >= 1.8 ? "text-blue-700" : "text-red-700",
        bgColor: markup >= 2.5 ? "bg-gradient-to-br from-green-50 to-green-100" : markup >= 1.8 ? "bg-gradient-to-br from-blue-50 to-blue-100" : "bg-gradient-to-br from-red-50 to-red-100"
      },
      {
        label: "Progreso",
        value: `${hoursProgress.toFixed(1)}%`,
        subtitle: `${(actuals?.totalWorkedHours || 0).toFixed(1)}h / ${quotation?.estimatedHours || 0}h`,
        icon: Target,
        color: hoursProgress >= 100 ? "text-green-700" : hoursProgress >= 75 ? "text-blue-700" : "text-orange-700",
        bgColor: hoursProgress >= 100 ? "bg-gradient-to-br from-green-50 to-green-100" : hoursProgress >= 75 ? "bg-gradient-to-br from-blue-50 to-blue-100" : "bg-gradient-to-br from-orange-50 to-orange-100"
      },
      {
        label: "Presupuesto",
        value: `${budgetUtilization.toFixed(1)}%`,
        subtitle: `$${(actuals?.totalWorkedCost || 0).toLocaleString()} / $${(quotation?.baseCost || 0).toLocaleString()}`,
        icon: DollarSign,
        color: budgetUtilization <= 100 ? "text-green-700" : "text-red-700",
        bgColor: budgetUtilization <= 100 ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gradient-to-br from-red-50 to-red-100"
      },
      {
        label: "Registros",
        value: `${actuals?.totalEntries || 0}`,
        subtitle: `entradas de tiempo`,
        icon: Clock,
        color: "text-purple-700",
        bgColor: "bg-gradient-to-br from-purple-50 to-purple-100"
      }
    ];
  }, [completeData]);

  // Estadísticas del equipo
  const teamStats = useMemo(() => {
    if (!completeData?.quotation?.team) return [];
    
    return completeData.quotation.team.map(member => ({
      name: member.personnelName || 'Sin nombre',
      hours: member.hours || 0,
      cost: member.cost || 0,
      personnelId: member.personnelId
    }));
  }, [completeData]);

  if (isLoading || completeDataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!projectId || (!isLoading && !completeDataLoading && !project && !completeData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Proyecto no encontrado</h2>
          <p className="text-gray-600 mb-4">El proyecto solicitado no existe o no tienes permisos para verlo.</p>
          <p className="text-xs text-gray-500 mb-4">
            Debug: projectId={projectId}, project={!!project}, completeData={!!completeData}
          </p>
          <Button onClick={() => setLocation("/active-projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {(project as any)?.name || 'Proyecto'}
              </h1>
              <p className="text-gray-600">{client?.name || 'Cliente'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Select
              value={dateFilter.label}
              onValueChange={(value) => {
                const filter = dateFilters.find(f => f.label === value);
                if (filter) setDateFilter(filter);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                {dateFilters.map((filter) => (
                  <SelectItem key={filter.label} value={filter.label}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => (
            <Card key={index} className={`border-0 ${metric.bgColor}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                    <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{metric.subtitle}</p>
                  </div>
                  <metric.icon className={`h-8 w-8 ${metric.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs principales */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard">Resumen Ejecutivo</TabsTrigger>
            <TabsTrigger value="team">Gestión del Equipo</TabsTrigger>
            <TabsTrigger value="analytics">Análisis Mensual</TabsTrigger>
          </TabsList>

          {/* Resumen Ejecutivo */}
          <TabsContent value="dashboard">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Resumen Ejecutivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Métricas Clave</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Markup Actual:</span>
                        <span className="font-medium">{completeData.metrics.markup.toFixed(1)}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Eficiencia:</span>
                        <span className="font-medium">{completeData.metrics.efficiency.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Utilización Presupuesto:</span>
                        <span className="font-medium">{completeData.metrics.budgetUtilization.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Comparación vs Estimado</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Horas Trabajadas:</span>
                        <span className="font-medium">{completeData.actuals.totalWorkedHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Horas Estimadas:</span>
                        <span className="font-medium">{completeData.quotation.estimatedHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Costo Real:</span>
                        <span className="font-medium">${completeData.actuals.totalWorkedCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Costo Estimado:</span>
                        <span className="font-medium">${completeData.quotation.baseCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestión del Equipo */}
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Gestión del Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamStats.map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-sm text-gray-600">ID: {member.personnelId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{member.hours}h</p>
                        <p className="text-sm text-gray-600">${member.cost.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Análisis Mensual */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Análisis Mensual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Análisis de Desviaciones</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Desviación Horas:</span>
                        <span className={`font-medium ${completeData.metrics.hoursDeviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {completeData.metrics.hoursDeviation.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Desviación Costo:</span>
                        <span className={`font-medium ${completeData.metrics.costDeviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {completeData.metrics.costDeviation.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Periodo Actual</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Filtro:</span>
                        <span className="font-medium">{dateFilter.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Registros:</span>
                        <span className="font-medium">{completeData.actuals.totalEntries}</span>
                      </div>
                    </div>
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