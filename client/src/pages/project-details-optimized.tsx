import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Building2, DollarSign, Clock, TrendingUp, PieChart, 
  Calendar, Timer, Users, Activity, FileText, BarChart3, 
  Target, Plus, Filter, Grid3X3, List, ChevronLeft, 
  Download, Share2
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import type { DateRange } from "react-day-picker";
import TimeEntryForm from "@/components/time-entry-form";

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    active: { className: "bg-green-100 text-green-800", label: "Activo" },
    en_progreso: { className: "bg-blue-100 text-blue-800", label: "En Progreso" },
    paused: { className: "bg-yellow-100 text-yellow-800", label: "Pausado" },
    completed: { className: "bg-gray-100 text-gray-800", label: "Completado" }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
  
  return (
    <Badge className={`${config.className} text-xs px-2 py-1`}>
      {config.label}
    </Badge>
  );
};

export default function ProjectDetailsOptimized() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/active-projects', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/active-projects/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      return response.json();
    },
    enabled: !!id
  });

  const { data: timeEntries = [], isLoading: timeEntriesLoading, refetch: refetchTimeEntries } = useQuery({
    queryKey: ['/api/time-entries/project', id],
    queryFn: async () => {
      if (!id) return [];
      const response = await fetch(`/api/time-entries/project/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch time entries');
      }
      return response.json();
    },
    enabled: !!id
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['/api/personnel']
  });

  const queryClient = useQueryClient();

  // Cálculos optimizados con filtros
  const filteredEntries = (timeEntries || []).filter((entry: any) => {
    // Aplicar filtro de fechas si está seleccionado
    if (selectedDates?.from && selectedDates?.to) {
      const entryDate = new Date(entry.date);
      const isInRange = isWithinInterval(entryDate, { start: selectedDates.from, end: selectedDates.to });
      if (!isInRange) return false;
    }
    
    // Aplicar filtros rápidos
    if (quickFilter !== 'all') {
      const entryDate = new Date(entry.date);
      const now = new Date();
      
      switch (quickFilter) {
        case 'today':
          return entryDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return entryDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return entryDate >= monthAgo;
        default:
          return true;
      }
    }
    
    return true;
  });

  const totalHours = filteredEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
  const totalCost = filteredEntries.reduce((sum: number, entry: any) => 
    sum + ((entry.hours || 0) * (entry.hourlyRate || 0)), 0);

  // Para subproyectos Always-On, usar el límite de costo específico del subproyecto
  const subprojectCostLimit = project?.subprojectCostLimit || 0;
  const remainingCostLimit = subprojectCostLimit - totalCost;
  const costUsagePercentage = subprojectCostLimit ? (totalCost / subprojectCostLimit) * 100 : 0;
  
  // Determinar si se está cerca del límite o lo ha superado
  const isNearLimit = costUsagePercentage > 80;
  const isOverLimit = totalCost > subprojectCostLimit;

  const handleTimeEntrySuccess = () => {
    refetchTimeEntries();
    setShowTimeEntryForm(false);
    queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
  };

  if (projectLoading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header ultra-compacto y funcional */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation('/active-projects')}
                className="p-1 h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900 leading-tight">
                  {project?.subprojectName || project?.name || 'Cargando...'}
                </h1>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>ID: {project?.id}</span>
                  <span>•</span>
                  <span>{format(new Date(), 'dd MMM yyyy', { locale: es })}</span>
                  <StatusBadge status={project?.status || 'active'} />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="h-8 px-2 text-gray-600 hover:text-gray-900"
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCalendar(!showCalendar)}
                className="h-8 px-2 text-gray-600 hover:text-gray-900"
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 px-2 text-gray-600 hover:text-gray-900"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                size="sm"
                onClick={() => setShowTimeEntryForm(true)}
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                Cargar Horas
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Métricas principales ultra-compactas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Presupuesto</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${project?.quotationBudget?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-green-600">
                    Presupuesto global
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Horas</p>
                  <p className="text-xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
                  <p className="text-xs text-blue-600">
                    {filteredEntries.length} entradas
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-600 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Costo</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${totalCost.toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-600">
                    ${(totalCost / (totalHours || 1)).toFixed(0)}/h promedio
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${isOverLimit ? 'border-l-red-500' : isNearLimit ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600">Presupuesto Subproyecto</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-xl font-bold text-gray-900">
                      ${subprojectCostLimit.toLocaleString()}
                    </p>
                    <span className="text-xs text-gray-500">máximo</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Gastado: ${totalCost.toLocaleString()}</span>
                      <span className={`font-medium ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-green-600'}`}>
                        {costUsagePercentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          isOverLimit ? 'bg-red-500' : 
                          isNearLimit ? 'bg-yellow-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(costUsagePercentage, 100)}%` }}
                      ></div>
                    </div>
                    <p className={`text-xs font-medium ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-green-600'}`}>
                      {isOverLimit ? 
                        `¡EXCEDIDO! Sobrepasaste $${Math.abs(remainingCostLimit).toLocaleString()}` : 
                        isNearLimit ? 
                        `ATENCIÓN: Solo quedan $${remainingCostLimit.toLocaleString()}` : 
                        `DISPONIBLE: $${remainingCostLimit.toLocaleString()}`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros rápidos con contador */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filtros rápidos:</span>
            {['all', 'today', 'week', 'month'].map((filter) => (
              <Button
                key={filter}
                variant={quickFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setQuickFilter(filter as any)}
                className="h-7 px-3 text-xs"
              >
                {filter === 'all' ? 'Todo' : 
                 filter === 'today' ? 'Hoy' :
                 filter === 'week' ? 'Semana' : 'Mes'}
              </Button>
            ))}
          </div>
          {filteredEntries.length > 0 && (
            <span className="text-xs text-gray-500">
              {filteredEntries.length} de {timeEntries?.length || 0} entradas
            </span>
          )}
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panel lateral de información */}
          <div className="lg:col-span-1 space-y-4">
            {showCalendar && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Filtrar por Fecha</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <CalendarComponent
                    mode="range"
                    selected={selectedDates}
                    onSelect={setSelectedDates}
                    numberOfMonths={1}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>
            )}

            {/* Resumen del equipo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Equipo Trabajando
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  {Array.from(new Set(filteredEntries.map((entry: any) => entry.personnelId)))
                    .map(personnelId => {
                      const entry = filteredEntries.find((e: any) => e.personnelId === personnelId);
                      const hours = filteredEntries
                        .filter((e: any) => e.personnelId === personnelId)
                        .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
                      
                      return (
                        <div key={personnelId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-700">
                                {entry?.personnelName ? entry.personnelName.split(' ').map((n: string) => n[0]).join('') : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-medium">{entry?.personnelName}</p>
                              <p className="text-xs text-gray-500">{entry?.roleName}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium">{hours.toFixed(1)}h</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Acciones rápidas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Acciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start h-8">
                    <Users className="h-3 w-3 mr-2" />
                    Gestionar Equipo
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start h-8">
                    <FileText className="h-3 w-3 mr-2" />
                    Generar Reporte
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start h-8">
                    <Share2 className="h-3 w-3 mr-2" />
                    Compartir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de entradas de tiempo */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Timer className="h-4 w-4" />
                    Registro de Tiempo
                    {filteredEntries.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {filteredEntries.length}
                      </span>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredEntries.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {filteredEntries.map((entry: any, index: number) => (
                      <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-full mt-1">
                              <span className="text-xs font-semibold text-blue-700">
                                {entry.personnelName ? entry.personnelName.split(' ').map((n: string) => n[0]).join('') : 'N/A'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {entry.personnelName || 'Personal no identificado'}
                                </h4>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs font-medium text-blue-600">{entry.roleName || 'Rol no especificado'}</span>
                              </div>
                              <p className="text-sm text-gray-700 mb-3 leading-relaxed">{entry.description}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(entry.date), 'dd MMM yyyy', { locale: es })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {entry.hours}h trabajadas
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${entry.hourlyRate}/hora
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-bold text-green-600">
                              ${(entry.hours * entry.hourlyRate).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">costo total</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Timer className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">No hay registros de tiempo</p>
                    <p className="text-sm">Comienza registrando las horas trabajadas del equipo</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => setShowTimeEntryForm(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Cargar Primera Entrada
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de formulario de tiempo */}
      {showTimeEntryForm && (
        <TimeEntryForm
          projectId={parseInt(id!)}
          onClose={() => setShowTimeEntryForm(false)}
          onSuccess={handleTimeEntrySuccess}
        />
      )}

      {/* Modal de calendario */}
      {showCalendar && (
        <Popover open={showCalendar} onOpenChange={setShowCalendar}>
          <PopoverTrigger asChild>
            <div />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={selectedDates}
              onSelect={setSelectedDates}
              numberOfMonths={2}
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}