import React, { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  DollarSign, 
  Target, 
  Percent, 
  TrendingUp, 
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  TrendingDown,
  Zap,
  User,
  Hash,
  MessageSquare,
  Filter,
  Building2,
  FileText,
  CalendarDays,
  Timer,
  Archive,
  PlayCircle,
  PauseCircle
} from 'lucide-react';

interface DateFilter {
  label: string;
  startDate: Date;
  endDate: Date;
}

interface TimeEntry {
  id: number;
  projectId: number;
  personnelId: number;
  personnelName: string;
  hours: number;
  date: string;
  description: string;
  hourlyRate: number;
  cost: number;
  status: string;
  createdAt: string;
}

interface TeamMember {
  id: number;
  personnelId: number;
  personnelName: string;
  personnelEmail?: string;
  hours: number;
  rate: number;
  cost: number;
  roleId: number;
  roleName: string;
}

export default function ProjectDetailsSimple() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Filtro temporal
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

  // Obtener datos del proyecto
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  // Obtener datos del cliente
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  // Obtener cotización
  const { data: quotation } = useQuery({
    queryKey: [`/api/quotations/${(project as any)?.quotationId}`],
    enabled: !!(project as any)?.quotationId,
  });

  // Obtener entradas de tiempo
  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  // Obtener equipo de la cotización
  const { data: quotationTeam = [] } = useQuery<TeamMember[]>({
    queryKey: [`/api/quotations/${(project as any)?.quotationId}/team`],
    enabled: !!(project as any)?.quotationId,
  });

  // Filtrar entradas de tiempo por fecha
  const filteredTimeEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= dateFilter.startDate && entryDate <= dateFilter.endDate;
    });
  }, [timeEntries, dateFilter]);

  // Calcular métricas
  const metrics = useMemo(() => {
    const totalWorkedHours = filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalWorkedCost = filteredTimeEntries.reduce((sum, entry) => sum + entry.cost, 0);
    const estimatedHours = quotationTeam.reduce((sum, member) => sum + member.hours, 0);
    const estimatedCost = quotation?.baseCost || 0;
    const projectPrice = quotation?.totalAmount || 0;
    
    const markup = totalWorkedCost > 0 ? projectPrice / totalWorkedCost : 0;
    const hoursProgress = estimatedHours > 0 ? (totalWorkedHours / estimatedHours) * 100 : 0;
    const budgetUtilization = estimatedCost > 0 ? (totalWorkedCost / estimatedCost) * 100 : 0;
    
    return {
      totalWorkedHours,
      totalWorkedCost,
      estimatedHours,
      estimatedCost,
      projectPrice,
      markup,
      hoursProgress,
      budgetUtilization,
      totalEntries: filteredTimeEntries.length
    };
  }, [filteredTimeEntries, quotationTeam, quotation]);

  // Estados de carga
  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Proyecto no encontrado</h2>
          <p className="text-gray-600 mb-4">El proyecto solicitado no existe o no tienes permisos para verlo.</p>
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
                {quotation?.projectName || (project as any)?.subprojectName || 'Proyecto'}
              </h1>
              <p className="text-gray-600">{client?.name || 'Cliente'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Select value={dateFilter.label} onValueChange={(value) => {
              const filter = dateFilters.find(f => f.label === value);
              if (filter) setDateFilter(filter);
            }}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFilters.map(filter => (
                  <SelectItem key={filter.label} value={filter.label}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Badge variant={(project as any)?.status === 'active' ? 'default' : 'secondary'}>
              {(project as any)?.status === 'active' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Markup</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.markup.toFixed(1)}x</div>
              <p className="text-xs text-muted-foreground">
                ${metrics.projectPrice.toLocaleString()} / ${metrics.totalWorkedCost.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progreso</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.hoursProgress.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalWorkedHours.toFixed(1)}h / {metrics.estimatedHours}h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Presupuesto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.budgetUtilization.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                ${metrics.totalWorkedCost.toLocaleString()} / ${metrics.estimatedCost.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registros</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalEntries}</div>
              <p className="text-xs text-muted-foreground">entradas de tiempo</p>
            </CardContent>
          </Card>
        </div>

        {/* Pestañas */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Resumen Ejecutivo</TabsTrigger>
            <TabsTrigger value="team">Gestión del Equipo</TabsTrigger>
            <TabsTrigger value="analytics">Análisis Mensual</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información del Proyecto</CardTitle>
                <CardDescription>Datos principales del proyecto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Cliente</p>
                    <p className="text-lg font-semibold">{client?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Estado</p>
                    <Badge variant="outline">{(project as any)?.status || 'N/A'}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Precio Total</p>
                    <p className="text-lg font-semibold">${metrics.projectPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Costo Estimado</p>
                    <p className="text-lg font-semibold">${metrics.estimatedCost.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Equipo del Proyecto</CardTitle>
                <CardDescription>Miembros asignados y sus roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quotationTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{member.personnelName}</p>
                          <p className="text-sm text-gray-500">{member.roleName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{member.hours}h</p>
                        <p className="text-sm text-gray-500">${member.cost.toLocaleString()}</p>
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
                <CardTitle>Análisis de Rendimiento</CardTitle>
                <CardDescription>Métricas detalladas del proyecto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{metrics.markup.toFixed(1)}x</div>
                    <p className="text-sm text-gray-600">Markup Actual</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{metrics.hoursProgress.toFixed(0)}%</div>
                    <p className="text-sm text-gray-600">Progreso de Horas</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{metrics.budgetUtilization.toFixed(0)}%</div>
                    <p className="text-sm text-gray-600">Utilización Presupuesto</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}