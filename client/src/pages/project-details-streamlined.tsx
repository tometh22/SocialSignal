import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Settings,
  BarChart3,
  Plus,
  Activity,
  Briefcase,
  Mail,
  Phone,
  Percent,
  CalendarClock,
  Gauge,
  Trash2,
  Loader2,
  Filter,
  CalendarDays,
  ChevronDown,
  History,
  FileText,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import WeeklyTimeRegister from "@/components/weekly-time-register";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";

interface TimeEntry {
  id: number;
  personnelId: number;
  personnelName: string;
  date: string;
  hours: number;
  totalCost: number;
  hourlyRate: number;
  hourlyRateAtTime: number;
  description?: string;
  entryType: string;
}

interface DateFilter {
  type: string;
  startDate: Date;
  endDate: Date;
  label: string;
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
  hours: number;
  entries: number;
  lastActivity: string;
  currentRate: number;
}

export default function ProjectDetailsStreamlined() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeRegisterOpen, setTimeRegisterOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  
  // Estado del filtro temporal - configurado por defecto para mostrar el mes actual
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const now = new Date();
    return {
      type: 'month',
      startDate: startOfMonth(now),
      endDate: endOfMonth(now),
      label: "Este mes"
    };
  });

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Función para filtrar entradas por rango de fecha
  const filterTimeEntriesByDateRange = (entries: TimeEntry[]) => {
    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= dateFilter.startDate && entryDate <= dateFilter.endDate;
    });
  };

  // Cálculo de resumen de costos usando objetivos de cotización
  const costSummary = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return null;
    
    const projectData = project as any;
    const quotationData = projectData.quotation;
    const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
    
    if (!quotationData) {
      console.warn('⚠️ No hay cotización asociada al proyecto para costSummary:', projectData.id);
      return null;
    }
    
    const monthlyBaseCost = quotationData.baseCost;
    const monthlyEstimatedHours = quotationData.estimatedHours || 0;
    
    // Calcular multiplicador según el período
    const getTargetMultiplier = () => {
      const label = dateFilter?.label || 'Este mes';
      if (label.includes('trimestre') || label.includes('3 meses')) {
        return 3;
      } else if (label.includes('semestre') || label.includes('6 meses')) {
        return 6;
      } else if (label.includes('año') || label.includes('12 meses')) {
        return 12;
      } else {
        return 1; // Por defecto, un mes
      }
    };
    
    const targetMultiplier = getTargetMultiplier();
    const targetBudget = monthlyBaseCost * targetMultiplier;
    const targetHours = monthlyEstimatedHours * targetMultiplier;
    
    // Calcular datos reales
    const actualCost = filteredEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || entry.hourlyRate || 100)), 0);
    
    const actualHours = filteredEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);
    
    const budgetUtilization = targetBudget > 0 ? (actualCost / targetBudget) * 100 : 0;
    
    // Calcular markup usando precio de cotización vs costo real
    const monthlyClientPrice = quotationData.totalAmount || 0;
    const targetClientPrice = monthlyClientPrice * targetMultiplier;
    const markup = actualCost > 0 ? targetClientPrice / actualCost : 0;
    
    return {
      totalCost: actualCost,
      budget: targetBudget,
      budgetUtilization,
      savings: targetBudget - actualCost,
      filteredHours: actualHours,
      targetHours,
      targetMultiplier,
      markup: markup,
      targetClientPrice: targetClientPrice
    };
  }, [project, timeEntries, filterTimeEntriesByDateRange, dateFilter]);

  // Estadísticas del equipo con filtro temporal
  const teamStats = useMemo(() => {
    if (!baseTeam || !Array.isArray(timeEntries)) return [];
    
    const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
    const memberStats = new Map();
    
    baseTeam.forEach((member: any) => {
      memberStats.set(member.personnelId, {
        id: member.personnelId,
        name: member.personnelName,
        role: member.role,
        hours: 0,
        entries: 0,
        lastActivity: '2024-01-01',
        currentRate: member.hourlyRate || 100
      });
    });

    filteredEntries.forEach((entry: TimeEntry) => {
      if (!memberStats.has(entry.personnelId)) {
        memberStats.set(entry.personnelId, {
          id: entry.personnelId,
          name: entry.personnelName,
          role: 'Colaborador',
          hours: 0,
          entries: 0,
          lastActivity: '2024-01-01',
          currentRate: entry.hourlyRate || 100
        });
      }
      
      const stats = memberStats.get(entry.personnelId);
      stats.hours += entry.hours;
      stats.entries += 1;
      
      if (new Date(entry.date) > new Date(stats.lastActivity)) {
        stats.lastActivity = entry.date;
      }
    });

    return Array.from(memberStats.values())
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [timeEntries, baseTeam, filterTimeEntriesByDateRange, dateFilter]);

  // Entradas recientes del equipo
  const recentTimeEntries = useMemo(() => {
    if (!Array.isArray(timeEntries)) return [];
    
    const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
    
    return filteredEntries
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [timeEntries, filterTimeEntriesByDateRange, dateFilter]);

  // Opciones de filtro temporal
  const getDateFilterOptions = () => {
    const now = new Date();
    return [
      {
        type: 'month',
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        label: "Este mes"
      },
      {
        type: 'last-month',
        startDate: startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)),
        endDate: endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)),
        label: "Mes pasado"
      },
      {
        type: 'quarter',
        startDate: startOfQuarter(now),
        endDate: endOfQuarter(now),
        label: "Este trimestre"
      },
      {
        type: 'last-quarter',
        startDate: startOfQuarter(new Date(now.getFullYear(), now.getMonth() - 3)),
        endDate: endOfQuarter(new Date(now.getFullYear(), now.getMonth() - 3)),
        label: "Trimestre pasado"
      },
      {
        type: 'year',
        startDate: startOfYear(now),
        endDate: endOfYear(now),
        label: "Total año"
      }
    ];
  };

  // Función para exportar datos del equipo
  const exportTeamData = () => {
    const csvData = teamStats.map(member => ({
      Nombre: member.name,
      Rol: member.role,
      Horas: member.hours,
      Entradas: member.entries,
      UltimaActividad: member.lastActivity,
      TarifaActual: member.currentRate
    }));
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      Object.keys(csvData[0]).join(",") + "\n" +
      csvData.map(row => Object.values(row).join(",")).join("\n");
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `equipo_proyecto_${project?.name || 'proyecto'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mutación para eliminar entrada de tiempo
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return apiRequest(`/api/time-entries/${entryId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "✅ Registro eliminado",
        description: "El registro se ha eliminado correctamente"
      });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo eliminar el registro",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-slate-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header minimalista */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/active-projects")}
              className="text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Proyectos
            </Button>
            <div className="h-6 w-px bg-slate-300" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {project?.name || "Proyecto"}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>{project?.clientName || "Cliente"}</span>
                <Badge variant={project?.status === 'active' ? 'default' : 'secondary'}>
                  {project?.status === 'active' ? 'Activo' : project?.status || 'Activo'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTimeRegisterOpen(true)}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Registrar Tiempo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/analytics-consolidated/${projectId}`)}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analíticas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/admin`)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurar
            </Button>
          </div>
        </div>

        {/* Filtro temporal */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Período:</span>
          </div>
          <Select
            value={dateFilter?.label || "Este mes"}
            onValueChange={(value) => {
              const option = getDateFilterOptions().find(opt => opt.label === value);
              if (option) {
                setDateFilter(option);
              }
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getDateFilterOptions().map((option) => (
                <SelectItem key={option.type} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dashboard principal */}
        <div className="space-y-6">
          {/* Análisis de Rentabilidad */}
          <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                  Análisis de Rentabilidad - {dateFilter?.label || 'Este mes'}
                </div>
                <Badge variant="outline" className="bg-white/80 border-yellow-200 text-yellow-700">
                  Métricas Financieras
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Markup Calculation */}
                <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                    <p className="text-sm font-semibold text-yellow-800">Markup Actual</p>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {typeof costSummary?.markup === 'number' ? `${costSummary.markup.toFixed(2)}x` : '0.00x'}
                  </p>
                  <p className="text-xs text-yellow-600">
                    {(() => {
                      if (!costSummary?.markup) return 'Sin datos';
                      const markup = costSummary.markup;
                      if (markup >= 2.5) return 'Excelente rentabilidad';
                      if (markup >= 1.8) return 'Buena rentabilidad';
                      if (markup >= 1.2) return 'Rentabilidad aceptable';
                      return 'Rentabilidad crítica';
                    })()}
                  </p>
                </div>

                {/* Precio vs Costo */}
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-semibold text-green-800">Precio vs Costo</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">Precio:</span>
                      <span className="font-medium">${typeof costSummary?.targetClientPrice === 'number' ? costSummary.targetClientPrice.toLocaleString() : '0'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">Costo:</span>
                      <span className="font-medium">${typeof costSummary?.totalCost === 'number' ? costSummary.totalCost.toLocaleString() : '0'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-green-200">
                      <span className="text-green-600">Margen:</span>
                      <span className="text-green-700">
                        ${(() => {
                          const price = typeof costSummary?.targetClientPrice === 'number' ? costSummary.targetClientPrice : 0;
                          const cost = typeof costSummary?.totalCost === 'number' ? costSummary.totalCost : 0;
                          return (price - cost).toLocaleString();
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Eficiencia Presupuestaria */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-800">Eficiencia Presupuestaria</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {typeof costSummary?.budgetUtilization === 'number' ? `${costSummary.budgetUtilization.toFixed(1)}%` : '0.0%'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {(() => {
                      if (!costSummary?.budgetUtilization) return 'Sin datos';
                      const utilization = costSummary.budgetUtilization;
                      if (utilization <= 80) return 'Excelente control';
                      if (utilization <= 95) return 'Buen control';
                      if (utilization <= 100) return 'En límite';
                      return 'Excede presupuesto';
                    })()}
                  </p>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Grid principal del dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Progreso y Estado */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-blue-600" />
                  Vista General del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Progreso Visual */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3">Progreso del Proyecto</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Avance General</span>
                          <span className="font-bold">
                            {(() => {
                              if (!costSummary || typeof costSummary.targetHours !== 'number' || typeof costSummary.filteredHours !== 'number') return "0.0%";
                              const progressPercentage = Math.min(100, (costSummary.filteredHours / costSummary.targetHours) * 100);
                              return `${progressPercentage.toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                        <Progress 
                          value={(() => {
                            if (!costSummary || typeof costSummary.targetHours !== 'number' || typeof costSummary.filteredHours !== 'number') return 0;
                            return Math.min(100, (costSummary.filteredHours / costSummary.targetHours) * 100);
                          })()} 
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Utilización Presupuesto</span>
                          <span className="font-bold">
                            {typeof costSummary?.budgetUtilization === 'number' ? `${costSummary.budgetUtilization.toFixed(1)}%` : '0.0%'}
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(100, costSummary?.budgetUtilization || 0)} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Métricas Rápidas */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3">Métricas Clave</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">Horas Trabajadas</span>
                        </div>
                        <span className="font-bold">{typeof costSummary?.filteredHours === 'number' ? costSummary.filteredHours.toFixed(1) : '0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-sm">Costo Total</span>
                        </div>
                        <span className="font-bold">${typeof costSummary?.totalCost === 'number' ? costSummary.totalCost.toLocaleString() : '0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-purple-600" />
                          <span className="text-sm">Miembros Activos</span>
                        </div>
                        <span className="font-bold">{teamStats.filter(m => m.hours > 0).length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actividad del Equipo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Equipo Activo
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportTeamData}
                    className="text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Exportar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamStats.slice(0, 5).map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(typeof member.name === 'string' && member.name.length > 0) ? member.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name || 'Usuario Desconocido'}</p>
                          <p className="text-xs text-slate-600">{member.role || 'Sin rol'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{(member.hours || 0).toFixed(1)}h</p>
                        <p className="text-xs text-slate-600">{member.entries || 0} registros</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actividad Reciente */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-purple-600" />
                    Actividad Reciente - {dateFilter?.label || 'Este mes'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setLocation(`/active-projects/${projectId}/time-entries`)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Ver Historial
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setTimeRegisterOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Registrar
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentTimeEntries.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                      <p>No hay registros de tiempo para el período seleccionado</p>
                    </div>
                  ) : (
                    recentTimeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {entry.personnelName ? entry.personnelName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{entry.personnelName || 'Usuario Desconocido'}</p>
                            <p className="text-xs text-slate-600">
                              {(() => {
                                try {
                                  return entry.date ? format(new Date(entry.date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha';
                                } catch (error) {
                                  return 'Fecha inválida';
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold">{(entry.hours || 0)}h</p>
                            <p className="text-xs text-slate-600">${typeof entry.totalCost === 'number' ? entry.totalCost.toLocaleString() : '0'}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEntryToDelete(entry.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modales */}
      <Dialog open={timeRegisterOpen} onOpenChange={setTimeRegisterOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Registrar Tiempo del Equipo</DialogTitle>
            <DialogDescription>
              Configura el período y registra las horas trabajadas por cada miembro del equipo.
            </DialogDescription>
          </DialogHeader>
          <WeeklyTimeRegister 
            projectId={parseInt(projectId!)} 
            onClose={() => setTimeRegisterOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este registro de tiempo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => entryToDelete && deleteTimeEntryMutation.mutate(entryToDelete)}
              disabled={deleteTimeEntryMutation.isPending}
            >
              {deleteTimeEntryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}