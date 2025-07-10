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
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Settings,
  FileText,
  BarChart3,
  Timer,
  Plus,
  Edit,
  Eye,
  Activity,
  Zap,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Building,
  Percent,
  CalendarClock,
  Gauge,
  Trash2,
  Loader2,
  Filter,
  CalendarDays,
  ChevronDown
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
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { es } from "date-fns/locale";

interface ProjectMetric {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: string;
  bgColor: string;
  change?: number;
}

interface TimeEntry {
  id: number;
  personnelId: number;
  personnelName: string;
  date: string;
  hours: number;
  description?: string;
  roleName?: string;
  hourlyRate?: number;
}

interface DateFilter {
  type: 'week' | 'month' | 'quarter' | 'custom';
  startDate: Date;
  endDate: Date;
  label: string;
}

// Componente de filtro temporal
function TimeRangeFilter({ 
  selectedFilter, 
  onFilterChange, 
  className 
}: { 
  selectedFilter: DateFilter; 
  onFilterChange: (filter: DateFilter) => void;
  className?: string;
}) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>(selectedFilter.startDate);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(selectedFilter.endDate);

  const currentDate = new Date();

  const presets: { label: string; type: DateFilter['type'] | 'lastMonth'; value: () => DateFilter }[] = [
    {
      label: "Esta semana",
      type: "week",
      value: () => ({
        type: 'week',
        startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
        endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
        label: "Esta semana"
      })
    },
    {
      label: "Este mes",
      type: "month", 
      value: () => ({
        type: 'month',
        startDate: startOfMonth(currentDate),
        endDate: endOfMonth(currentDate),
        label: "Este mes"
      })
    },
    {
      label: "Mes pasado",
      type: "lastMonth",
      value: () => {
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        return {
          type: 'month',
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
          label: "Mes pasado"
        };
      }
    },
    {
      label: "Este trimestre",
      type: "quarter",
      value: () => ({
        type: 'quarter',
        startDate: startOfQuarter(currentDate),
        endDate: endOfQuarter(currentDate),
        label: "Este trimestre"
      })
    }
  ];

  const handlePresetSelect = (preset: typeof presets[0]) => {
    const filter = preset.value();
    onFilterChange(filter);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onFilterChange({
        type: 'custom',
        startDate: customStart,
        endDate: customEnd,
        label: `${format(customStart, 'dd/MM/yyyy', { locale: es })} - ${format(customEnd, 'dd/MM/yyyy', { locale: es })}`
      });
      setIsCustomOpen(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Período:</Label>
        <Select 
          value={selectedFilter.type === 'custom' ? 'custom' : selectedFilter.type} 
          onValueChange={(value) => {
            if (value === 'custom') {
              setIsCustomOpen(true);
            } else {
              const preset = presets.find(p => p.type === value || (value === 'lastMonth' && p.type === 'lastMonth'));
              if (preset) handlePresetSelect(preset);
            }
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Seleccionar período">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {selectedFilter.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset, index) => (
              <SelectItem key={`${preset.type}-${index}`} value={preset.type === 'lastMonth' ? 'lastMonth' : preset.type}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <div style={{ display: 'none' }} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <CalendarComponent
                mode="single"
                selected={customStart}
                onSelect={setCustomStart}
                initialFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de fin</Label>
              <CalendarComponent
                mode="single"
                selected={customEnd}
                onSelect={setCustomEnd}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCustomOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCustomApply} disabled={!customStart || !customEnd}>
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Component for ProjectTeamSection with enhanced functionality
function ProjectTeamSection({ projectId, timeEntries, project }: { projectId: string; timeEntries: any[]; project: any }) {
  const { toast } = useToast();
  
  const { data: baseTeam = [], isLoading: teamLoading, refetch } = useQuery({
    queryKey: ["/api/projects", projectId, "base-team"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/base-team`);
      if (!response.ok) {
        throw new Error('Failed to fetch team');
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  const copyTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/copy-quotation-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to copy team');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Equipo copiado desde la cotización correctamente",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive",
      });
    },
  });

  // Para contratos Always On, filtrar solo horas del mes actual
  const filteredTimeEntries = useMemo(() => {
    const projectData = project as any;
    const isAlwaysOnContract = projectData?.quotation?.projectType === 'fee-mensual';
    
    if (!isAlwaysOnContract) return timeEntries;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    return timeEntries.filter((entry: any) => {
      const entryDate = new Date(entry.date);
      return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
    });
  }, [timeEntries, project]);

  // Calcular tiempo registrado por miembro
  const getTimeWorkedByMember = (personnelId: number) => {
    return filteredTimeEntries
      .filter((entry: any) => entry.personnelId === personnelId)
      .reduce((total: number, entry: any) => total + (entry.hours || 0), 0);
  };

  const getProgressPercentage = (workedHours: number, estimatedHours: number) => {
    if (estimatedHours === 0) return 0;
    return Math.round((workedHours / estimatedHours) * 100);
  };

  if (teamLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!baseTeam || baseTeam.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No hay equipo asignado a este proyecto</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => copyTeamMutation.mutate()}
          disabled={copyTeamMutation.isPending}
        >
          {copyTeamMutation.isPending ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              Copiando...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Copiar Equipo de Cotización
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {baseTeam.map((member: any) => {
        const workedHours = getTimeWorkedByMember(member.personnelId);
        const progressPercent = getProgressPercentage(workedHours, member.estimatedHours || 0);
        
        return (
          <div key={member.id} className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                    {member.personnel?.name?.split(' ').map((n: string) => n[0]).join('') || 'MB'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{member.personnel?.name || 'Miembro del Equipo'}</p>
                  <p className="text-xs text-muted-foreground">{member.role?.name || 'Rol no especificado'}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {member.estimatedHours || 0}h est.
                  </Badge>
                  <span className="text-sm font-medium">${member.hourlyRate || 0}/h</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {member.isActive ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>
            
            {/* Barra de progreso y tiempo registrado */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Registrado: {workedHours}h de {member.estimatedHours || 0}h
                </span>
                <span className="font-medium text-blue-600">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progressPercent >= 100 ? 'bg-green-500' : 
                    progressPercent >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
              {workedHours > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Costo real: ${(workedHours * (member.hourlyRate || 0)).toFixed(0)}</span>
                  <span>
                    {progressPercent > 100 ? 
                      `+${(workedHours - (member.estimatedHours || 0)).toFixed(1)}h extra` : 
                      `${((member.estimatedHours || 0) - workedHours).toFixed(1)}h restantes`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      <div className="pt-3 border-t space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas Estimadas:</span>
              <span className="font-medium">
                {baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0)}h
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Costo Estimado:</span>
              <span className="font-medium">
                ${baseTeam.reduce((sum: number, member: any) => 
                  sum + ((member.estimatedHours || 0) * (member.hourlyRate || 0)), 0
                ).toFixed(0)}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas Trabajadas:</span>
              <span className="font-medium text-blue-600">
                {baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0).toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Costo Real:</span>
              <span className="font-medium text-blue-600">
                ${baseTeam.reduce((sum: number, member: any) => {
                  const workedHours = getTimeWorkedByMember(member.personnelId);
                  return sum + (workedHours * (member.hourlyRate || 0));
                }, 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Progreso general del proyecto */}
        <div className="pt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progreso General:</span>
            <span className="font-medium">
              {(() => {
                const totalEstimated = baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0);
                const totalWorked = baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0);
                const percentage = totalEstimated > 0 ? Math.round((totalWorked / totalEstimated) * 100) : 0;
                return `${percentage}%`;
              })()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                (() => {
                  const totalEstimated = baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0);
                  const totalWorked = baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0);
                  const percentage = totalEstimated > 0 ? Math.round((totalWorked / totalEstimated) * 100) : 0;
                  return percentage >= 100 ? 'bg-green-500' : 
                         percentage >= 75 ? 'bg-yellow-500' : 'bg-blue-500';
                })()
              }`}
              style={{ 
                width: `${Math.min((() => {
                  const totalEstimated = baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0);
                  const totalWorked = baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0);
                  return totalEstimated > 0 ? Math.round((totalWorked / totalEstimated) * 100) : 0;
                })(), 100)}%` 
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailsRedesigned() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  
  // Estado del filtro temporal - por defecto este mes
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => ({
    type: 'month',
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    label: "Este mes"
  }));

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  // Debug: Log client data to verify logoUrl is present
  console.log('Client data:', client);

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Función para filtrar entradas por rango de fechas
  const filterTimeEntriesByDateRange = useMemo(() => {
    return (entries: TimeEntry[]) => {
      console.log('🔍 Filtro temporal activo:', {
        label: dateFilter.label,
        startDate: dateFilter.startDate.toISOString(),
        endDate: dateFilter.endDate.toISOString(),
        totalEntries: entries.length
      });
      
      const filtered = entries.filter((entry: TimeEntry) => {
        const entryDate = new Date(entry.date);
        const isInRange = entryDate >= dateFilter.startDate && entryDate <= dateFilter.endDate;
        return isInRange;
      });
      
      console.log('🔍 Entradas filtradas:', {
        filteredCount: filtered.length,
        originalCount: entries.length
      });
      
      return filtered;
    };
  }, [dateFilter]);

  // Cálculos principales basados en datos reales
  const metrics = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return [];

    const projectData = project as any;
    const isAlwaysOnContract = projectData.quotation?.projectType === 'fee-mensual';
    
    // Aplicar filtro de fecha a todas las entradas
    const filteredTimeEntries = filterTimeEntriesByDateRange(timeEntries);
    
    // Cálculo real del presupuesto según el período
    let budget = 0;
    let estimatedHours = 0;
    let periodLabel = dateFilter.label;
    
    if (isAlwaysOnContract) {
      // Para contratos Always On, calcular presupuesto proporcionalmente
      const monthlyBudget = projectData.quotation?.baseCost || projectData.quotation?.totalAmount || 0;
      const daysDiff = Math.ceil((dateFilter.endDate.getTime() - dateFilter.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysInMonth = 30;
      budget = (monthlyBudget * daysDiff) / daysInMonth;
      estimatedHours = budget / 100; // Estimación basada en costo promedio por hora
    } else {
      // Para proyectos únicos, usar presupuesto total o calcular proporcionalmente
      const totalBudget = projectData.quotation?.totalAmount || projectData.deliverableBudget || 0;
      const projectStart = new Date(projectData.startDate || new Date());
      const projectEnd = new Date(projectData.expectedEndDate || new Date());
      const totalProjectDays = Math.max(1, Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)));
      const filterDays = Math.ceil((dateFilter.endDate.getTime() - dateFilter.startDate.getTime()) / (1000 * 60 * 60 * 24));
      budget = (totalBudget * filterDays) / totalProjectDays;
      estimatedHours = budget / 100;
    }
    
    // Cálculos reales basados en entradas filtradas
    const totalHours = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);
    const totalCost = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRate || 100)), 0);
    
    const progressPercentage = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;
    const costOverrun = budget > 0 ? ((totalCost - budget) / budget) * 100 : 0;
    const uniquePersonnel = new Set(filteredTimeEntries.map((entry: TimeEntry) => entry.personnelId)).size;
    const avgHoursPerDay = filteredTimeEntries.length > 0 ? 
      totalHours / Math.max(1, Math.ceil((dateFilter.endDate.getTime() - dateFilter.startDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    const costEfficiency = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active': return { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
        case 'paused': return { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
        case 'completed': return { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
        default: return { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
      }
    };

    const statusConfig = getStatusColor(projectData.status);

    return [
      {
        label: isAlwaysOnContract ? "Presupuesto Mensual" : "Presupuesto Total",
        value: `$${budget.toLocaleString()}`,
        subtitle: isAlwaysOnContract ? 
          `${periodLabel} - ${costEfficiency > 0 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(costEfficiency).toFixed(1)}%` :
          `${costEfficiency > 0 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(costEfficiency).toFixed(1)}%`,
        icon: DollarSign,
        color: "text-green-700",
        bgColor: "bg-gradient-to-br from-green-50 to-green-100",
        change: costEfficiency
      },
      {
        label: isAlwaysOnContract ? `Horas ${periodLabel}` : "Horas Registradas",
        value: `${totalHours.toFixed(1)}h`,
        subtitle: totalHours === 0 && isAlwaysOnContract ? 
          "Sin registros este mes" : 
          `de ${estimatedHours.toFixed(0)}h estimadas`,
        icon: Clock,
        color: "text-blue-700",
        bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
        change: progressPercentage > 100 ? -(progressPercentage - 100) : progressPercentage - 100
      },
      {
        label: "Progreso",
        value: (() => {
          // Calcular progreso real basado en fechas del proyecto
          if (!projectData.startDate) return "0.0%";
          
          const startDate = new Date(projectData.startDate);
          const endDate = projectData.expectedEndDate ? new Date(projectData.expectedEndDate) : null;
          const today = new Date();
          
          if (!endDate) return `${progressPercentage.toFixed(1)}%`;
          
          const totalDuration = endDate.getTime() - startDate.getTime();
          const elapsedDuration = today.getTime() - startDate.getTime();
          
          if (totalDuration <= 0) return "0.0%";
          
          const timeProgress = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
          return `${timeProgress.toFixed(1)}%`;
        })(),
        subtitle: (() => {
          if (!projectData.startDate || !projectData.expectedEndDate) return "Sin cronograma definido";
          
          const endDate = new Date(projectData.expectedEndDate);
          const today = new Date();
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysLeft < 0) return `${Math.abs(daysLeft)} días de retraso`;
          if (daysLeft === 0) return "Vence hoy";
          return `${daysLeft} días restantes`;
        })(),
        icon: Target,
        color: (() => {
          if (!projectData.expectedEndDate) return "text-gray-700";
          const endDate = new Date(projectData.expectedEndDate);
          const today = new Date();
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft < 0 ? "text-red-700" : daysLeft <= 7 ? "text-yellow-700" : "text-purple-700";
        })(),
        bgColor: (() => {
          if (!projectData.expectedEndDate) return "bg-gradient-to-br from-gray-50 to-gray-100";
          const endDate = new Date(projectData.expectedEndDate);
          const today = new Date();
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft < 0 ? "bg-gradient-to-br from-red-50 to-red-100" : 
                 daysLeft <= 7 ? "bg-gradient-to-br from-yellow-50 to-yellow-100" : 
                 "bg-gradient-to-br from-purple-50 to-purple-100";
        })(),
        change: progressPercentage - 50
      },
      {
        label: "Estado",
        value: projectData.status === 'active' ? 'Activo' : 
               projectData.status === 'paused' ? 'Pausado' : 
               projectData.status === 'completed' ? 'Completado' : 'Desconocido',
        subtitle: projectData.completionStatus || "Sin actualizar",
        icon: projectData.status === 'active' ? Play : projectData.status === 'paused' ? Pause : CheckCircle2,
        color: statusConfig.color,
        bgColor: statusConfig.bg,
      }
    ];
  }, [project, timeEntries]);

  const recentTimeEntries = useMemo(() => {
    if (!Array.isArray(timeEntries)) return [];
    
    // Aplicar filtro temporal para mostrar solo entradas del período seleccionado
    const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
    
    return filteredEntries
      .sort((a: TimeEntry, b: TimeEntry) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [timeEntries, filterTimeEntriesByDateRange]);

  const teamStats = useMemo(() => {
    if (!Array.isArray(timeEntries) || !Array.isArray(baseTeam)) return [];
    
    // Aplicar filtro temporal para calcular estadísticas del período seleccionado
    const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
    
    const memberStats = new Map();
    
    filteredEntries.forEach((entry: TimeEntry) => {
      if (!memberStats.has(entry.personnelId)) {
        memberStats.set(entry.personnelId, {
          id: entry.personnelId,
          name: entry.personnelName,
          hours: 0,
          entries: 0,
          lastActivity: entry.date
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
  }, [timeEntries, baseTeam, filterTimeEntriesByDateRange]);

  // Cálculo de resumen de costos usando filtro temporal
  const costSummary = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return null;

    const projectData = project as any;
    const isAlwaysOnContract = projectData.quotation?.projectType === 'fee-mensual';
    
    // Aplicar filtro temporal a todas las entradas
    const filteredTimeEntries = filterTimeEntriesByDateRange(timeEntries);
    let totalBudget = 0;
    
    if (isAlwaysOnContract) {
      // Para contratos Always On, calcular presupuesto proporcionalmente
      const monthlyBudget = projectData.quotation?.baseCost || projectData.quotation?.totalAmount || 0;
      const daysDiff = Math.ceil((dateFilter.endDate.getTime() - dateFilter.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysInMonth = 30;
      totalBudget = (monthlyBudget * daysDiff) / daysInMonth;
    } else {
      // Para proyectos únicos, calcular presupuesto proporcionalmente
      const totalProjectBudget = projectData.quotation?.totalAmount || projectData.deliverableBudget || 0;
      const projectStart = new Date(projectData.startDate || new Date());
      const projectEnd = new Date(projectData.expectedEndDate || new Date());
      const totalProjectDays = Math.max(1, Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)));
      const filterDays = Math.ceil((dateFilter.endDate.getTime() - dateFilter.startDate.getTime()) / (1000 * 60 * 60 * 24));
      totalBudget = (totalProjectBudget * filterDays) / totalProjectDays;
    }
    
    const totalCost = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRate || 100)), 0);
    
    const budgetUtilization = totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0;
    const profitMargin = totalBudget > 0 ? ((totalBudget - totalCost) / totalBudget) * 100 : 0;
    
    return {
      totalBudget,
      totalCost,
      budgetUtilization,
      profitMargin,
      period: dateFilter.label
    };
  }, [project, timeEntries, filterTimeEntriesByDateRange, dateFilter]);

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

  const handleDeleteTimeEntry = (entryId: number) => {
    setEntryToDelete(entryId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete);
    }
  };

  if (isLoading) {
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

  const projectData = project as any;
  const clientData = client as any;
  const projectName = projectData?.quotation?.projectName || projectData?.name || "Proyecto sin nombre";
  const clientName = clientData?.name || "Cliente desconocido";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header compacto */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          {/* Título del proyecto */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {projectName}
              </h1>
              
              {/* Filtro temporal */}
              <TimeRangeFilter 
                selectedFilter={dateFilter}
                onFilterChange={setDateFilter}
                className="flex-shrink-0"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {/* Botón Proyectos alineado con los otros botones */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/active-projects")}
                className="hover:bg-gray-100 h-8"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Proyectos
              </Button>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setShowQuickRegister(!showQuickRegister);
                    // Cerrar tabs automáticamente cuando se abre el registro
                    if (!showQuickRegister) {
                      setActiveTab("overview");
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 h-8"
                >
                  <Timer className="h-3 w-3 mr-1" />
                  Registrar Tiempo
                </Button>
                
                <Button variant="outline" size="sm" onClick={() => setLocation(`/project-analytics/${projectId}`)} className="h-8">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Analíticas
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => setLocation(`/project-settings/${projectId}`)}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Configurar
                </Button>
              </div>
              
              {/* Badges de estado e información del cliente */}
              <div className="flex items-center gap-3">
                <Badge 
                  variant="outline" 
                  className={`${metrics[3]?.color} ${metrics[3]?.bgColor} border-current text-xs py-1`}
                >
                  {metrics[3]?.value}
                </Badge>
                {projectData.isAlwaysOnMacro && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-1">
                    Always-On
                  </Badge>
                )}
                
                {/* Logo e información del cliente compacta */}
                <div className="flex items-center gap-2 text-gray-600 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-200">
                  {clientData?.logoUrl ? (
                    <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
                      <img 
                        src={clientData.logoUrl} 
                        alt={`${clientName} logo`} 
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {clientName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium text-sm leading-tight">{clientName}</span>
                    {clientData?.contactEmail && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-2 w-2 text-gray-400" />
                        <span className="text-xs text-gray-500">{clientData.contactEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas principales compactas */}
          <div className="grid grid-cols-4 gap-3">
            {metrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <Card key={index} className={`${metric.bgColor} border-0 hover:shadow-md transition-all duration-200`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">{metric.label}</p>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                        {metric.subtitle && (
                          <p className="text-xs text-gray-500 mt-0.5">{metric.subtitle}</p>
                        )}
                      </div>
                      <div className={`p-2 rounded-full shadow-md ${metric.color.replace('text-', 'bg-').replace('-700', '-500')}`}>
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    {metric.change !== undefined && (
                      <div className="mt-1">
                        <div className={`flex items-center text-xs ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <TrendingUp className="h-2 w-2 mr-1" />
                          {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Registro rápido de tiempo */}
      {showQuickRegister && (
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <WeeklyTimeRegister
            projectId={Number(projectId)}
            onSuccess={() => {
              setShowQuickRegister(false);
              queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
              toast({
                title: "Tiempo registrado exitosamente",
                description: "Las horas han sido registradas en el proyecto",
              });
            }}
            onCancel={() => setShowQuickRegister(false)}
          />
        </div>
      )}

      {/* Contenido principal con tabs */}
      <div className="px-6 py-4">
        {/* Filtro temporal */}
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <TimeRangeFilter
            selectedFilter={dateFilter}
            onFilterChange={setDateFilter}
            className="flex items-center gap-4"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <Gauge className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="operations" 
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <Activity className="h-4 w-4" />
              Operaciones
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Análisis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* KPIs Ejecutivos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {metrics.map((metric, index) => {
                const IconComponent = metric.icon;
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">{metric.label}</p>
                          <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                          {metric.subtitle && (
                            <p className="text-xs text-gray-500 mt-1">{metric.subtitle}</p>
                          )}
                        </div>
                        <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                          <IconComponent className={`h-5 w-5 ${metric.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

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
                            <span className="font-bold">{metrics[2]?.value}</span>
                          </div>
                          <Progress 
                            value={parseFloat(metrics[2]?.value.replace('%', '') || '0')} 
                            className="h-2"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Utilización Presupuesto</span>
                            <span className="font-bold">{metrics[0]?.value}</span>
                          </div>
                          <Progress 
                            value={parseFloat(metrics[0]?.value.replace('%', '') || '0')} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Información Clave */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Información Clave</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cliente</span>
                          <span className="font-medium">{clientName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Estado</span>
                          <Badge variant={projectData.status === 'active' ? 'default' : 'secondary'}>
                            {metrics[3]?.value}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tipo</span>
                          <span className="font-medium">{projectData.deliverableType || "No especificado"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha límite</span>
                          <span className="font-medium">
                            {projectData.expectedEndDate ? 
                              new Date(projectData.expectedEndDate).toLocaleDateString('es-ES') : 
                              "No definida"
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alertas y Estado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Centro de Alertas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Alertas dinámicas */}
                    {costSummary?.budgetUtilization && costSummary.budgetUtilization > 100 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-red-700 mb-1">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium text-sm">Presupuesto Excedido</span>
                        </div>
                        <p className="text-xs text-red-600">
                          El proyecto ha superado el presupuesto asignado en {(costSummary.budgetUtilization - 100).toFixed(1)}%
                        </p>
                      </div>
                    )}

                    {project?.expectedEndDate && new Date(project.expectedEndDate) < new Date() && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-red-700 mb-1">
                          <CalendarClock className="h-4 w-4" />
                          <span className="font-medium text-sm">Proyecto Retrasado</span>
                        </div>
                        <p className="text-xs text-red-600">
                          El proyecto ha superado su fecha límite estimada
                        </p>
                      </div>
                    )}

                    {costSummary?.budgetUtilization && costSummary.budgetUtilization > 80 && costSummary.budgetUtilization <= 100 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-yellow-700 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-medium text-sm">Presupuesto Crítico</span>
                        </div>
                        <p className="text-xs text-yellow-600">
                          El presupuesto está al {costSummary.budgetUtilization.toFixed(1)}% de utilización
                        </p>
                      </div>
                    )}

                    {/* Estado general */}
                    {(!costSummary?.budgetUtilization || costSummary.budgetUtilization <= 80) && 
                     (!project?.expectedEndDate || new Date(project.expectedEndDate) >= new Date()) && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-700 mb-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium text-sm">Proyecto Saludable</span>
                        </div>
                        <p className="text-xs text-green-600">
                          El proyecto está dentro de los parámetros normales
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actividad Reciente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Actividad Reciente del Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentTimeEntries.length > 0 ? (
                    recentTimeEntries.slice(0, 6).map((entry: TimeEntry) => (
                      <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-blue-500 text-white text-sm">
                            {entry.personnelName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{entry.personnelName}</p>
                          <p className="text-xs text-gray-500">{entry.roleName}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(entry.date).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-blue-600">{entry.hours}h</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay actividad registrada aún</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            {/* Vista operacional integrada */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gestión de Tiempo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      Gestión de Tiempo
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowQuickRegister(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Resumen rápido */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Horas este período</p>
                        <p className="text-xl font-bold text-blue-600">{metrics[1]?.value}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Costo acumulado</p>
                        <p className="text-xl font-bold text-green-600">
                          ${costSummary?.totalCost?.toLocaleString() || '0'}
                        </p>
                      </div>
                    </div>

                    {/* Últimos registros */}
                    <div>
                      <h4 className="font-medium text-sm mb-3">Registros Recientes</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {recentTimeEntries.length > 0 ? (
                          recentTimeEntries.slice(0, 5).map((entry: TimeEntry) => (
                            <div key={entry.id} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs bg-blue-500 text-white">
                                    {entry.personnelName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{entry.personnelName}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(entry.date).toLocaleDateString('es-ES')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">{entry.hours}h</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTimeEntry(entry.id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">No hay registros aún</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gestión de Equipo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Equipo y Asignaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Estadísticas de equipo */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Miembros activos</p>
                        <p className="text-xl font-bold text-green-600">
                          {(() => {
                            const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                            return new Set(filteredEntries.map((entry: TimeEntry) => entry.personnelName)).size;
                          })()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Promedio h/día</p>
                        <p className="text-xl font-bold text-purple-600">
                          {(() => {
                            const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                            if (filteredEntries.length === 0) return "0";
                            
                            const totalHours = filteredEntries.reduce((sum: number, entry: TimeEntry) => sum + entry.hours, 0);
                            const uniqueDays = new Set(filteredEntries.map((entry: TimeEntry) => new Date(entry.date).toDateString())).size;
                            return uniqueDays > 0 ? (totalHours / uniqueDays).toFixed(1) : "0";
                          })()}h
                        </p>
                      </div>
                    </div>

                    {/* Lista de miembros del equipo */}
                    <div>
                      <h4 className="font-medium text-sm mb-3">Rendimiento del Equipo</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {teamStats.length > 0 ? (
                          teamStats.map((member: any) => (
                            <div key={member.id} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs bg-green-500 text-white">
                                    {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{member.name}</p>
                                  <p className="text-xs text-gray-500">{member.entries} registros</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">{member.hours.toFixed(1)}h</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(member.lastActivity).toLocaleDateString('es-ES')}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">No hay actividad del equipo</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Panel de acciones operativas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600" />
                  Panel de Control Operativo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setShowQuickRegister(true)}
                  >
                    <Timer className="h-6 w-6 text-blue-600" />
                    <span className="text-sm">Registrar Tiempo</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setLocation(`/active-projects/${projectId}/time-entries`)}
                  >
                    <Eye className="h-6 w-6 text-green-600" />
                    <span className="text-sm">Ver Historial</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setLocation(`/project-settings/${projectId}`)}
                  >
                    <Settings className="h-6 w-6 text-purple-600" />
                    <span className="text-sm">Configurar</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setLocation(`/project-analytics/${projectId}`)}
                  >
                    <BarChart3 className="h-6 w-6 text-orange-600" />
                    <span className="text-sm">Reportes</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* KPIs principales del proyecto */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Presupuesto</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics[0]?.value}</div>
                  <p className="text-xs text-muted-foreground">Utilización actual</p>
                  <div className="flex justify-between text-sm mt-2">
                    <span>Presupuesto</span>
                    <span>Consumido</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>${costSummary?.totalBudget?.toLocaleString() || 0}</span>
                    <span>${costSummary?.totalCost?.toLocaleString() || 0}</span>
                  </div>
                  <div className="mt-2">
                    <Progress 
                      value={Math.min(costSummary?.budgetUtilization || 0, 100)} 
                      className="h-2" 
                    />
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {costSummary?.budgetUtilization ? 
                      (costSummary.budgetUtilization > 100 ? 
                        `-${(costSummary.budgetUtilization - 100).toFixed(1)}% Excedido` : 
                        `${(100 - costSummary.budgetUtilization).toFixed(1)}% Disponible`
                      ) : "N/A"
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cronograma</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics[2]?.value}</div>
                  <p className="text-xs text-muted-foreground">Progreso del proyecto</p>
                  <div className="flex justify-between text-sm mt-2">
                    <span>Inicio</span>
                    <span>Fin estimado</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "No definida"}</span>
                    <span>{projectData.expectedEndDate ? new Date(projectData.expectedEndDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "No definida"}</span>
                  </div>
                  <div className="mt-2">
                    <Progress 
                      value={parseFloat(metrics[2]?.value.replace('%', '') || '0')} 
                      className="h-2" 
                    />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    {parseFloat(metrics[2]?.value.replace('%', '') || '0') > 100 ? 
                      "No definido días restantes" : 
                      "En progreso"
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Horas Registradas</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics[1]?.value}</div>
                  <p className="text-xs text-muted-foreground">Total y distribución</p>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Facturable
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      No Facturable
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>0.0h</span>
                    <span>{metrics[1]?.value}</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={100} className="h-2" />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {project?.isAlwaysOnMacro ? `${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}/día` : "100.0%"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Indicadores de Riesgo</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">Monitores de alertas y desviaciones</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center">
                          <p className="font-medium">
                            {costSummary?.budgetUtilization && costSummary.budgetUtilization > 80 ? 
                              `${Math.min(costSummary.budgetUtilization - 80, 100).toFixed(0)}%` : "0%"
                            }
                          </p>
                          <p className="text-gray-500">Riesgo de presupuesto</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">
                            {(() => {
                              if (!project?.expectedEndDate) return "0%";
                              const endDate = new Date(project.expectedEndDate);
                              const today = new Date();
                              const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              if (daysLeft < 0) return "100%";
                              if (daysLeft <= 7) return "75%";
                              if (daysLeft <= 30) return "25%";
                              return "0%";
                            })()}
                          </p>
                          <p className="text-gray-500">Riesgo de cronograma</p>
                        </div>
                      </div>
                      <div className={`border rounded p-2 mt-3 ${
                        (costSummary?.budgetUtilization && costSummary.budgetUtilization > 100) ||
                        (project?.expectedEndDate && new Date(project.expectedEndDate) < new Date()) ?
                        "bg-red-50 border-red-200" :
                        (costSummary?.budgetUtilization && costSummary.budgetUtilization > 80) ||
                        (project?.expectedEndDate && Math.ceil((new Date(project.expectedEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7) ?
                        "bg-yellow-50 border-yellow-200" :
                        "bg-green-50 border-green-200"
                      }`}>
                        <div className={`flex items-center gap-1 ${
                          (costSummary?.budgetUtilization && costSummary.budgetUtilization > 100) ||
                          (project?.expectedEndDate && new Date(project.expectedEndDate) < new Date()) ?
                          "text-red-700" :
                          (costSummary?.budgetUtilization && costSummary.budgetUtilization > 80) ||
                          (project?.expectedEndDate && Math.ceil((new Date(project.expectedEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7) ?
                          "text-yellow-700" :
                          "text-green-700"
                        }`}>
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {(() => {
                              let alerts = 0;
                              if (costSummary?.budgetUtilization && costSummary.budgetUtilization > 100) alerts++;
                              if (project?.expectedEndDate && new Date(project.expectedEndDate) < new Date()) alerts++;
                              return `${alerts} alertas activas`;
                            })()}
                          </span>
                        </div>
                        <p className={`text-xs mt-1 ${
                          (costSummary?.budgetUtilization && costSummary.budgetUtilization > 100) ||
                          (project?.expectedEndDate && new Date(project.expectedEndDate) < new Date()) ?
                          "text-red-600" :
                          (costSummary?.budgetUtilization && costSummary.budgetUtilization > 80) ||
                          (project?.expectedEndDate && Math.ceil((new Date(project.expectedEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7) ?
                          "text-yellow-600" :
                          "text-green-600"
                        }`}>
                          {(() => {
                            if (costSummary?.budgetUtilization && costSummary.budgetUtilization > 100) {
                              return "Presupuesto excedido - Requiere atención inmediata";
                            }
                            if (project?.expectedEndDate && new Date(project.expectedEndDate) < new Date()) {
                              return "Proyecto con retraso - Revisar cronograma";
                            }
                            if (costSummary?.budgetUtilization && costSummary.budgetUtilization > 80) {
                              return "Presupuesto cerca del límite - Monitorear gastos";
                            }
                            if (project?.expectedEndDate && Math.ceil((new Date(project.expectedEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
                              return "Fecha límite próxima - Acelerar progreso";
                            }
                            return "No se detectan riesgos críticos en este momento";
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Análisis Consolidado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Información del período seleccionado */}
              <Card className="col-span-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                    Análisis del Período: {dateFilter.label}
                  </CardTitle>
                  <CardDescription>
                    Datos calculados para el período seleccionado • {costSummary?.period && `Análisis: ${costSummary.period}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Registros</p>
                      <p className="text-xl font-bold text-blue-600">{recentTimeEntries.length}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Total Horas</p>
                      <p className="text-xl font-bold text-green-600">{metrics[1]?.value}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">Costo Real</p>
                      <p className="text-xl font-bold text-purple-600">${costSummary?.totalCost?.toLocaleString() || '0'}</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">Presupuesto</p>
                      <p className="text-xl font-bold text-orange-600">${costSummary?.totalBudget?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Capacidad vs Demanda
                  </CardTitle>
                  <CardDescription>
                    Análisis de capacidad del equipo y demanda del proyecto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Capacidad del Equipo</p>
                        <p className="text-lg font-semibold">Miembros asignados: {baseTeam?.length || 0}</p>
                        <p className="text-sm text-gray-500">Capacidad promedio/día: {(baseTeam?.length * 8) || 0}h</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Demanda del Proyecto</p>
                        <p className="text-lg font-semibold">Horas requeridas: $29,230</p>
                        <p className="text-sm text-gray-500">Costo por hora promedio: $12</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Distribución de Horas por Persona
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {teamStats && teamStats.length > 0 ? (
                      teamStats.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-blue-500 text-white">
                                {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.entries} registros</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{member.hours.toFixed(1)}h</p>
                            <div className="w-20 bg-gray-200 rounded-full h-1 mt-1">
                              <div className="bg-blue-500 h-1 rounded-full" style={{ width: '85%' }}></div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay datos de equipo disponibles</p>
                      </div>
                    )}
                  </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        Actividad del Proyecto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Días activos</span>
                          <span className="font-semibold">
                            {timeEntries ? new Set(timeEntries.map((entry: TimeEntry) => 
                              new Date(entry.date).toDateString()
                            )).size : 0}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Promedio horas/día</span>
                          <span className="font-semibold">
                            {timeEntries && timeEntries.length > 0 ? (
                              (timeEntries.reduce((sum: number, entry: TimeEntry) => sum + entry.hours, 0) / 
                               new Set(timeEntries.map((entry: TimeEntry) => new Date(entry.date).toDateString())).size
                              ).toFixed(1)
                            ) : 0}h
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Último registro</span>
                          <span className="font-semibold">
                            {timeEntries && timeEntries.length > 0 ? 
                              new Date(Math.max(...timeEntries.map((entry: TimeEntry) => 
                                new Date(entry.date).getTime()
                              ))).toLocaleDateString('es-ES') : 
                              "Sin registros"
                            }
                          </span>
                        </div>

                        {project?.isAlwaysOnMacro && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                            <div className="flex items-center gap-2 text-blue-700">
                              <Zap className="h-4 w-4" />
                              <span className="font-medium text-sm">Contrato Always-On</span>
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                              Las métricas se calculan mensualmente para este tipo de contrato.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    Información del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tipo</p>
                    <p className="font-semibold">{projectData.deliverableType || "No especificado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha de inicio</p>
                    <p className="font-semibold">
                      {projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha estimada de fin</p>
                    <p className="font-semibold">
                      {projectData.expectedEndDate ? new Date(projectData.expectedEndDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Estado de completitud</p>
                    <p className="font-semibold">{projectData.completionStatus || "Sin actualizar"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600" />
                    Descripción y Notas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectData.notes ? (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Descripción</p>
                        <p className="text-gray-800 leading-relaxed">{projectData.notes}</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No hay descripción disponible</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          <Edit className="h-4 w-4 mr-2" />
                          Agregar descripción
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogo de confirmación para eliminar registro */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Eliminar Registro de Tiempo
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este registro de tiempo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setEntryToDelete(null);
              }}
              disabled={deleteTimeEntryMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteTimeEntryMutation.isPending}
            >
              {deleteTimeEntryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

