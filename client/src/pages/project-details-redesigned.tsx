
import React, { useState, useEffect, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Settings,
  Plus,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimeEntry {
  id: number;
  date: string;
  hours: number;
  description: string;
  approved: boolean;
  personnelName: string;
  roleName: string;
  totalCost: number;
}

interface ProjectData {
  id: number;
  name: string;
  description: string;
  status: string;
  clientName: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  budget: number;
  spentBudget: number;
  timeEntries: TimeEntry[];
  estimatedHours: number;
}

export default function ProjectDetailsRedesigned() {
  // Try multiple route patterns to match different URL structures
  const [matchActiveProjects, paramsActiveProjects] = useRoute('/active-projects/:id');
  const [matchProjects, paramsProjects] = useRoute('/projects/:id');
  const [, setLocation] = useLocation();
  
  // Extract project ID from any matching route
  const projectId = paramsActiveProjects?.id || paramsProjects?.id;
  const projectIdNum = projectId ? parseInt(projectId) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState('all');
  const [filteredTimeEntries, setFilteredTimeEntries] = useState<TimeEntry[]>([]);

  // Query para obtener datos del proyecto
  const { 
    data: projectData, 
    isLoading, 
    error 
  } = useQuery<ProjectData>({
    queryKey: [`/api/projects/${projectIdNum}/details`],
    enabled: !!projectIdNum,
  });

  // Filtrado de entradas de tiempo por fecha
  useEffect(() => {
    if (!projectData?.timeEntries) {
      setFilteredTimeEntries([]);
      return;
    }

    console.log('🔄 Filtering time entries with filter:', dateFilter);
    
    let filtered = [...projectData.timeEntries];
    const now = new Date();

    switch (dateFilter) {
      case 'last7days':
        const last7Days = subDays(now, 7);
        filtered = filtered.filter(entry => new Date(entry.date) >= last7Days);
        break;
      
      case 'last30days':
        const last30Days = subDays(now, 30);
        filtered = filtered.filter(entry => new Date(entry.date) >= last30Days);
        break;
      
      case 'thisMonth':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filtered = filtered.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= monthStart && entryDate <= monthEnd;
        });
        break;
      
      case 'lastMonth':
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));
        filtered = filtered.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= lastMonthStart && entryDate <= lastMonthEnd;
        });
        break;
      
      case 'thisQuarter':
        const quarterStart = startOfQuarter(now);
        const quarterEnd = endOfQuarter(now);
        filtered = filtered.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= quarterStart && entryDate <= quarterEnd;
        });
        break;
      
      case 'all':
      default:
        // No filtrar, mantener todas las entradas
        break;
    }

    console.log(`📊 Filtered entries: ${filtered.length} of ${projectData.timeEntries.length}`);
    setFilteredTimeEntries(filtered);
  }, [projectData?.timeEntries, dateFilter]);

  // Cálculos basados en entradas filtradas
  const analytics = useMemo(() => {
    if (!filteredTimeEntries.length) {
      return {
        totalHours: 0,
        totalCost: 0,
        avgHoursPerDay: 0,
        teamMembers: 0,
        pendingApproval: 0
      };
    }

    const totalHours = filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalCost = filteredTimeEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
    const uniqueDays = new Set(filteredTimeEntries.map(entry => entry.date)).size;
    const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0;
    const teamMembers = new Set(filteredTimeEntries.map(entry => entry.personnelName)).size;
    const pendingApproval = filteredTimeEntries.filter(entry => !entry.approved).length;

    return {
      totalHours,
      totalCost,
      avgHoursPerDay,
      teamMembers,
      pendingApproval
    };
  }, [filteredTimeEntries]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Cargando detalles del proyecto...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!projectData || error) {
    return (
      <div className="container mx-auto py-6 px-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Proyecto no encontrado</h3>
          <p className="text-gray-600 mb-6">No se pudo cargar la información del proyecto.</p>
          <Button onClick={() => setLocation('/active-projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/active-projects')}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{projectData.name}</h1>
            <p className="text-gray-600 mt-1">{projectData.clientName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant={projectData.status === 'active' ? 'default' : 'secondary'}>
            {projectData.status}
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Todo el tiempo' },
              { value: 'last7days', label: 'Últimos 7 días' },
              { value: 'last30days', label: 'Últimos 30 días' },
              { value: 'thisMonth', label: 'Este mes' },
              { value: 'lastMonth', label: 'Mes pasado' },
              { value: 'thisQuarter', label: 'Este trimestre' }
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={dateFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total Horas</p>
                <p className="text-2xl font-bold">{analytics.totalHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Costo Total</p>
                <p className="text-2xl font-bold">${analytics.totalCost.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Promedio/Día</p>
                <p className="text-2xl font-bold">{analytics.avgHoursPerDay.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Miembros</p>
                <p className="text-2xl font-bold">{analytics.teamMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold">{analytics.pendingApproval}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="time-entries">Entradas de Tiempo</TabsTrigger>
          <TabsTrigger value="team">Equipo</TabsTrigger>
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Información del Proyecto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Descripción</p>
                  <p className="text-gray-900">{projectData.description || 'Sin descripción'}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Fecha de Inicio</p>
                    <p className="font-medium">{format(new Date(projectData.startDate), 'dd/MM/yyyy', { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha de Fin</p>
                    <p className="font-medium">{projectData.endDate ? format(new Date(projectData.endDate), 'dd/MM/yyyy', { locale: es }) : '31/12/1969'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Presupuesto Total</span>
                    <span className="font-bold">${(projectData.budget || projectData.totalBudget).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gastado</span>
                    <span className="font-bold text-red-600">${analytics.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Restante</span>
                    <span className="font-bold text-green-600">${((projectData.budget || projectData.totalBudget) - analytics.totalCost).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min((analytics.totalCost / (projectData.budget || projectData.totalBudget)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="time-entries">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Entradas de Tiempo ({filteredTimeEntries.length})</span>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Entrada
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTimeEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay entradas de tiempo para el filtro seleccionado
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTimeEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{entry.personnelName || 'Sin nombre'}</p>
                          <p className="text-sm text-gray-600">{entry.roleName || 'Sin rol'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            {format(new Date(entry.date), 'dd/MM/yyyy', { locale: es })}
                          </p>
                          <p className="text-sm">{entry.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={entry.approved ? 'default' : 'secondary'}>
                          {entry.approved ? 'Aprobado' : 'Pendiente'}
                        </Badge>
                        <span className="font-bold">{entry.hours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Miembros del Equipo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Información del equipo próximamente...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analíticas Avanzadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Gráficos y análisis avanzados próximamente...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
