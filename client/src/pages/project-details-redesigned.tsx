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

  const presets: { label: string; type: DateFilter['type'] | 'lastMonth' | 'lastQuarter' | 'lastSemester' | 'semester' | 'year'; value: () => DateFilter }[] = [
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
        const monthName = lastMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return {
          type: 'month',
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
          label: `Mes pasado (${monthName})`
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
    },
    {
      label: "Trimestre pasado",
      type: "lastQuarter",
      value: () => {
        const lastQuarter = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3, 1);
        const quarterStart = startOfQuarter(lastQuarter);
        const quarterEnd = endOfQuarter(lastQuarter);
        const quarterName = `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`;
        return {
          type: 'quarter',
          startDate: quarterStart,
          endDate: quarterEnd,
          label: `Trimestre pasado (${quarterName})`
        };
      }
    },
    {
      label: "Este semestre",
      type: "semester",
      value: () => {
        const currentSemester = Math.floor(currentDate.getMonth() / 6);
        const semesterStart = new Date(currentDate.getFullYear(), currentSemester * 6, 1);
        const semesterEnd = new Date(currentDate.getFullYear(), (currentSemester + 1) * 6 - 1, 0);
        return {
          type: 'custom',
          startDate: semesterStart,
          endDate: semesterEnd,
          label: `Este semestre (${currentSemester === 0 ? 'Enero-Junio' : 'Julio-Diciembre'})`
        };
      }
    },
    {
      label: "Semestre pasado",
      type: "lastSemester",
      value: () => {
        const currentSemester = Math.floor(currentDate.getMonth() / 6);
        const lastSemester = currentSemester === 0 ? 1 : 0;
        const year = currentSemester === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
        const semesterStart = new Date(year, lastSemester * 6, 1);
        const semesterEnd = new Date(year, (lastSemester + 1) * 6 - 1, 0);
        return {
          type: 'custom',
          startDate: semesterStart,
          endDate: semesterEnd,
          label: `Semestre pasado (${lastSemester === 0 ? 'Enero-Junio' : 'Julio-Diciembre'} ${year})`
        };
      }
    },
    {
      label: "Total año",
      type: "year",
      value: () => ({
        type: 'custom',
        startDate: new Date(currentDate.getFullYear(), 0, 1),
        endDate: new Date(currentDate.getFullYear(), 11, 31),
        label: `Año ${currentDate.getFullYear()}`
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
          value={selectedFilter.type === 'custom' ? 'custom' : 
                selectedFilter.label.includes('Trimestre pasado') ? 'lastQuarter' :
                selectedFilter.label.includes('Mes pasado') ? 'lastMonth' :
                selectedFilter.label.includes('Semestre pasado') ? 'lastSemester' :
                selectedFilter.label.includes('Este semestre') ? 'semester' :
                selectedFilter.label.includes('Año') ? 'year' :
                selectedFilter.type} 
          onValueChange={(value) => {
            if (value === 'custom') {
              setIsCustomOpen(true);
            } else {
              const preset = presets.find(p => 
                p.type === value || 
                (value === 'lastMonth' && p.type === 'lastMonth') || 
                (value === 'lastQuarter' && p.type === 'lastQuarter') ||
                (value === 'lastSemester' && p.type === 'lastSemester') ||
                (value === 'semester' && p.type === 'semester') ||
                (value === 'year' && p.type === 'year')
              );
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
              <SelectItem 
                key={`${preset.type}-${index}`} 
                value={preset.type === 'lastMonth' ? 'lastMonth' : preset.type === 'lastQuarter' ? 'lastQuarter' : preset.type}
              >
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCustomOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-auto max-w-[90vw] max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4 text-center">Seleccionar período personalizado</h3>
            <div className="flex gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fecha de inicio</Label>
                <CalendarComponent
                  mode="single"
                  selected={customStart}
                  onSelect={setCustomStart}
                  initialFocus
                  className="border rounded-lg p-2"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fecha de fin</Label>
                <CalendarComponent
                  mode="single"
                  selected={customEnd}
                  onSelect={setCustomEnd}
                  className="border rounded-lg p-2"
                />
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-6 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setIsCustomOpen(false)}
                className="px-6"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
                className="px-6"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Component for ProjectTeamSection with enhanced functionality
function ProjectTeamSection({ projectId, timeEntries, project, dateFilter, filterTimeEntriesByDateRange }: { 
  projectId: string; 
  timeEntries: any[]; 
  project: any;
  dateFilter: DateFilter;
  filterTimeEntriesByDateRange: (entries: any[]) => any[];
}) {
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

  // USAR EL FILTRO DE FECHA GLOBAL EN LUGAR DEL FILTRO LOCAL
  const filteredTimeEntries = useMemo(() => {
    return filterTimeEntriesByDateRange(timeEntries);
  }, [timeEntries, filterTimeEntriesByDateRange]);

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
      console.log('🔍 CONFIGURACION FILTRO TEMPORAL:', {
        label: dateFilter.label,
        filtroInicio: dateFilter.startDate.toLocaleDateString('es-ES'),
        filtroFin: dateFilter.endDate.toLocaleDateString('es-ES'),
        filtroMes: dateFilter.startDate.getMonth() + 1,
        filtroAño: dateFilter.startDate.getFullYear(),
        totalEntradas: entries.length,
        fechaActual: new Date().toLocaleDateString('es-ES'),
        mesActual: new Date().getMonth() + 1,
        esFiltroMesPasado: dateFilter.label.includes('pasado'),
        startDateRaw: dateFilter.startDate,
        endDateRaw: dateFilter.endDate
      });
      
      // Mostrar todas las entradas disponibles para debug
      console.log('🔍 TODAS LAS ENTRADAS EN BD:', entries.map(e => ({
        fecha: e.date,
        fechaFormato: new Date(e.date).toLocaleDateString('es-ES'),
        mes: new Date(e.date).getMonth() + 1,
        año: new Date(e.date).getFullYear(),
        horas: e.hours,
        persona: e.personnelName
      })));
      
      const filtered = entries.filter((entry: TimeEntry) => {
        // Asegurar que la fecha se parsee correctamente
        const entryDate = new Date(entry.date);
        
        // Verificar que la fecha es válida
        if (isNaN(entryDate.getTime())) {
          console.warn('Fecha inválida encontrada:', entry.date);
          return false;
        }
        
        // Debug mejorado
        if (dateFilter.label.includes('pasado')) {
          console.log('🔍 ENTRADA ANALIZADA:', {
            fechaOriginal: entry.date,
            fechaParsed: entryDate.toISOString(),
            año: entryDate.getFullYear(),
            mes: entryDate.getMonth() + 1,
            horas: entry.hours,
            persona: entry.personnelName || 'Sin nombre'
          });
        }
        
        // Usar comparación por rango de fechas para todos los casos
        const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
        const startDateOnly = new Date(dateFilter.startDate.getFullYear(), dateFilter.startDate.getMonth(), dateFilter.startDate.getDate());
        const endDateOnly = new Date(dateFilter.endDate.getFullYear(), dateFilter.endDate.getMonth(), dateFilter.endDate.getDate());
        
        const isInRange = entryDateOnly >= startDateOnly && entryDateOnly <= endDateOnly;
        
        return isInRange;
      });
      
      return filtered;
    };
  }, [dateFilter]);

  // Cálculos principales basados en objetivos de cotización aprobada
  const metrics = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return [];

    const projectData = project as any;
    const quotationData = projectData.quotation;
    

    
    // APLICAR EL FILTRO TEMPORAL
    const filteredTimeEntries = filterTimeEntriesByDateRange(timeEntries);
    
    // OBTENER OBJETIVOS DE LA COTIZACIÓN APROBADA ASOCIADA AL PROYECTO
    if (!quotationData) {
      console.warn('⚠️ No hay cotización asociada al proyecto:', projectData.id);
      return [];
    }
    
    const monthlyClientPrice = quotationData.totalAmount; // Precio mensual al cliente
    const monthlyBaseCost = quotationData.baseCost; // Costo base mensual estimado
    const monthlyMarkup = quotationData.markupAmount || 0; // Markup mensual
    
    // Obtener horas estimadas desde la cotización (calculadas desde los miembros del equipo)
    const monthlyEstimatedHours = quotationData.estimatedHours || 0;
    

    
    // IMPLEMENTAR LÓGICA DIFERENCIADA SEGÚN TIPO DE PROYECTO
    // Fuente de verdad: quotationData.projectType determina si es 'always-on' o 'one-shot'
    const isAlwaysOnProject = quotationData.projectType === 'always-on';
    
    console.log('🎯 TIPO DE PROYECTO DETECTADO:', {
      projectType: quotationData.projectType,
      isAlwaysOn: isAlwaysOnProject,
      filtroActual: dateFilter.label,
      factorMultiplicador: isAlwaysOnProject ? 'Variable según período' : 'Siempre 1 (valor total)'
    });
    
    const getTargetMultiplier = () => {
      // Para proyectos One-Shot, siempre usar el valor total (multiplicador = 1)
      if (!isAlwaysOnProject) {
        return 1;
      }
      
      // Para proyectos Always-On, calcular multiplicador según período seleccionado
      const daysDiff = Math.ceil((dateFilter.endDate.getTime() - dateFilter.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysInMonth = 30;
      
      if (dateFilter.label.includes('trimestre') || dateFilter.label.includes('3 meses')) {
        return 3; // Trimestre = 3 meses
      } else if (dateFilter.label.includes('semestre') || dateFilter.label.includes('6 meses')) {
        return 6; // Semestre = 6 meses
      } else if (dateFilter.label.includes('año') || dateFilter.label.includes('12 meses')) {
        return 12; // Año = 12 meses
      } else if (dateFilter.label.includes('mes') || daysDiff >= 25) {
        return 1; // Mes completo
      } else {
        return daysDiff / daysInMonth; // Proporción de mes
      }
    };
    
    const targetMultiplier = getTargetMultiplier();
    
    // Aplicar multiplicador solo para proyectos Always-On
    const targetClientPrice = monthlyClientPrice * targetMultiplier;
    const targetBaseCost = monthlyBaseCost * targetMultiplier;
    const targetHours = monthlyEstimatedHours * targetMultiplier;
    
    // CALCULAR DATOS REALES DEL PERÍODO FILTRADO
    const actualHours = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);
    const actualCost = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || entry.hourlyRate || 100)), 0);
    
    // CALCULAR EFICIENCIAS Y DESVIACIONES
    const costEfficiency = targetBaseCost > 0 ? ((targetBaseCost - actualCost) / targetBaseCost) * 100 : 0;
    const hourEfficiency = targetHours > 0 ? ((targetHours - actualHours) / targetHours) * 100 : 0;
    const budgetUtilization = targetBaseCost > 0 ? (actualCost / targetBaseCost) * 100 : 0;

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
        label: "Presupuesto vs Objetivo",
        value: `$${actualCost.toLocaleString()}`,
        subtitle: `Objetivo: $${targetBaseCost.toLocaleString()} | ${costEfficiency >= 0 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(costEfficiency).toFixed(1)}%`,
        icon: DollarSign,
        color: costEfficiency >= 0 ? "text-green-700" : "text-red-700",
        bgColor: costEfficiency >= 0 ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gradient-to-br from-red-50 to-red-100",
        change: costEfficiency
      },
      {
        label: `Horas vs Objetivo`,
        value: `${actualHours.toFixed(1)}h`,
        subtitle: `Objetivo: ${targetHours.toFixed(1)}h | ${hourEfficiency >= 0 ? 'Bajo objetivo' : 'Exceso'}: ${Math.abs(hourEfficiency).toFixed(1)}%`,
        icon: Clock,
        color: hourEfficiency >= 0 ? "text-green-700" : "text-orange-700",
        bgColor: hourEfficiency >= 0 ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gradient-to-br from-orange-50 to-orange-100",
        change: hourEfficiency
      },
      {
        label: "Progreso del Período",
        value: (() => {
          // Calcular progreso basado en horas completadas vs objetivo del período
          if (targetHours === 0) return "0.0%";
          const progressPercentage = Math.min(100, (actualHours / targetHours) * 100);
          return `${progressPercentage.toFixed(1)}%`;
        })(),
        subtitle: (() => {
          const progressPercentage = targetHours > 0 ? (actualHours / targetHours) * 100 : 0;
          if (progressPercentage >= 100) return "Objetivo completado";
          if (progressPercentage >= 80) return "Cerca del objetivo";
          if (progressPercentage >= 50) return "Progreso moderado";
          if (progressPercentage > 0) return "Progreso inicial";
          return "Sin progreso registrado";
        })(),
        icon: Target,
        color: (() => {
          const progressPercentage = targetHours > 0 ? (actualHours / targetHours) * 100 : 0;
          if (progressPercentage >= 100) return "text-green-700";
          if (progressPercentage >= 80) return "text-blue-700";
          if (progressPercentage >= 50) return "text-yellow-700";
          if (progressPercentage > 0) return "text-orange-700";
          return "text-gray-700";
        })(),
        bgColor: (() => {
          const progressPercentage = targetHours > 0 ? (actualHours / targetHours) * 100 : 0;
          if (progressPercentage >= 100) return "bg-gradient-to-br from-green-50 to-green-100";
          if (progressPercentage >= 80) return "bg-gradient-to-br from-blue-50 to-blue-100";
          if (progressPercentage >= 50) return "bg-gradient-to-br from-yellow-50 to-yellow-100";
          if (progressPercentage > 0) return "bg-gradient-to-br from-orange-50 to-orange-100";
          return "bg-gradient-to-br from-gray-50 to-gray-100";
        })(),
        change: targetHours > 0 ? ((actualHours / targetHours) * 100) - 100 : 0
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
  }, [project, timeEntries, dateFilter, filterTimeEntriesByDateRange]);

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

  // Cálculo de resumen de costos usando objetivos de cotización
  const costSummary = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return null;
    
    const projectData = project as any;
    const quotationData = projectData.quotation;
    const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
    
    // Obtener objetivos mensuales de la cotización asociada al proyecto
    if (!quotationData) {
      console.warn('⚠️ No hay cotización asociada al proyecto para costSummary:', projectData.id);
      return null;
    }
    
    const monthlyBaseCost = quotationData.baseCost;
    const monthlyEstimatedHours = quotationData.estimatedHours || 0;
    
    // Calcular multiplicador según el período
    const getTargetMultiplier = () => {
      if (dateFilter.label.includes('trimestre') || dateFilter.label.includes('3 meses')) {
        return 3;
      } else if (dateFilter.label.includes('semestre') || dateFilter.label.includes('6 meses')) {
        return 6;
      } else if (dateFilter.label.includes('año') || dateFilter.label.includes('12 meses')) {
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
    
    return {
      totalCost: actualCost,
      budget: targetBudget,
      budgetUtilization,
      savings: targetBudget - actualCost,
      filteredHours: actualHours,
      targetHours,
      targetMultiplier
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

          {/* Métricas principales con colores atractivos */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {metrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <Card key={index} className={`${metric.bgColor} border-0 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">{metric.label}</p>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                        {metric.subtitle && (
                          <p className="text-xs text-gray-500 mt-0.5">{metric.subtitle}</p>
                        )}
                      </div>
                      <div className={`p-2 rounded-full shadow-lg ${metric.color.replace('text-', 'bg-').replace('-700', '-500')}`}>
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    {metric.change !== undefined && (
                      <div className="mt-2 pt-2 border-t border-white/30">
                        <div className={`flex items-center text-xs ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {metric.change >= 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          <span className="font-medium">
                            {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                          </span>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <Gauge className="h-4 w-4" />
              Resumen Ejecutivo
            </TabsTrigger>
            <TabsTrigger 
              value="team" 
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <Users className="h-4 w-4" />
              Gestión del Equipo
            </TabsTrigger>
            <TabsTrigger 
              value="details" 
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              Análisis Mensual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">

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
                                if (!costSummary || !costSummary.targetHours) return "0.0%";
                                const progressPercentage = Math.min(100, (costSummary.filteredHours / costSummary.targetHours) * 100);
                                return `${progressPercentage.toFixed(1)}%`;
                              })()}
                            </span>
                          </div>
                          <Progress 
                            value={(() => {
                              if (!costSummary || !costSummary.targetHours) return 0;
                              return Math.min(100, (costSummary.filteredHours / costSummary.targetHours) * 100);
                            })()} 
                            className="h-2"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Utilización Presupuesto</span>
                            <span className="font-bold">
                              {(() => {
                                if (!costSummary) return "$0";
                                const utilization = costSummary.budgetUtilization;
                                return `${utilization.toFixed(1)}%`;
                              })()}
                            </span>
                          </div>
                          <Progress 
                            value={costSummary?.budgetUtilization || 0} 
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

            {/* Equipo del Proyecto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Equipo del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectTeamSection 
                  projectId={projectId!} 
                  timeEntries={timeEntries} 
                  project={project}
                  dateFilter={dateFilter}
                  filterTimeEntriesByDateRange={filterTimeEntriesByDateRange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            {/* Gestión completa del equipo */}
            <div className="space-y-6">
              {/* Panel principal del equipo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Equipo del Proyecto
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowQuickRegister(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Tiempo
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProjectTeamSection 
                    projectId={projectId!} 
                    timeEntries={timeEntries}
                    project={project}
                    dateFilter={dateFilter}
                    filterTimeEntriesByDateRange={filterTimeEntriesByDateRange}
                  />
                </CardContent>
              </Card>

              {/* Panel de acciones operativas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    Herramientas de Gestión
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => setShowQuickRegister(true)}
                    >
                      <Clock className="h-6 w-6 text-blue-600" />
                      <span className="text-sm font-medium">Registrar Tiempo</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => setLocation(`/time-tracking?project=${projectId}`)}
                    >
                      <History className="h-6 w-6 text-green-600" />
                      <span className="text-sm font-medium">Ver Historial</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => console.log('Configure team')}
                    >
                      <Settings className="h-6 w-6 text-purple-600" />
                      <span className="text-sm font-medium">Configurar</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => console.log('Generate reports')}
                    >
                      <FileText className="h-6 w-6 text-orange-600" />
                      <span className="text-sm font-medium">Reportes</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {/* Vista mensual detallada y análisis completo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Análisis Detallado por Período: {dateFilter.label}
                </CardTitle>
                <CardDescription>
                  Vista consolidada de tiempo, costos y rendimiento del equipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Registros</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(() => {
                        const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                        return filteredEntries ? filteredEntries.length : 0;
                      })()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Horas</p>
                    <p className="text-2xl font-bold text-green-600">{metrics[1]?.value}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Costo Real</p>
                    <p className="text-2xl font-bold text-purple-600">${costSummary?.totalCost?.toLocaleString() || '0'}</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Presupuesto</p>
                    <p className="text-2xl font-bold text-orange-600">${costSummary?.budget?.toLocaleString() || '0'}</p>
                  </div>
                </div>

                {/* Distribución detallada por persona */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Distribución por Miembro del Equipo
                  </h3>
                  {teamStats && teamStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teamStats.map((member: any) => (
                        <div key={member.id} className="p-4 border border-gray-200 rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="text-sm bg-blue-500 text-white">
                                  {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-sm text-gray-500">{member.entries} registros</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-600">{member.hours.toFixed(1)}h</p>
                              <p className="text-xs text-gray-500">
                                {new Date(member.lastActivity).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${Math.min((member.hours / Math.max(...teamStats.map((t: any) => t.hours))) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No hay datos de equipo para el período seleccionado</p>
                    </div>
                  )}
                </div>

                {/* Métricas de actividad */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Días Activos</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {(() => {
                        const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                        if (!filteredEntries) return 0;
                        
                        try {
                          const validDates = filteredEntries
                            .map((entry: TimeEntry) => {
                              const date = new Date(entry.date);
                              return !isNaN(date.getTime()) ? date.toDateString() : null;
                            })
                            .filter((dateString): dateString is string => dateString !== null);
                          
                          return new Set(validDates).size;
                        } catch (error) {
                          console.error('Error calculating active days:', error);
                          return 0;
                        }
                      })()}
                    </p>
                    <p className="text-sm text-blue-600">días con registro</p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Promedio Diario</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {(() => {
                        const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                        if (!filteredEntries || filteredEntries.length === 0) return "0";
                        
                        const totalHours = filteredEntries.reduce((sum: number, entry: TimeEntry) => sum + entry.hours, 0);
                        const validDates = filteredEntries
                          .map((entry: TimeEntry) => {
                            const date = new Date(entry.date);
                            return !isNaN(date.getTime()) ? date.toDateString() : null;
                          })
                          .filter((dateString): dateString is string => dateString !== null);
                        const uniqueDays = new Set(validDates).size;
                        return uniqueDays > 0 ? (totalHours / uniqueDays).toFixed(1) : "0";
                      })()}h
                    </p>
                    <p className="text-sm text-green-600">horas por día</p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">Último Registro</h4>
                    <p className="text-lg font-bold text-purple-600">
                      {(() => {
                        const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                        if (!filteredEntries || filteredEntries.length === 0) return "Sin registros";
                        
                        try {
                          const dates = filteredEntries
                            .map((entry: TimeEntry) => new Date(entry.date))
                            .filter(date => !isNaN(date.getTime()));
                          
                          if (dates.length === 0) return "Sin registros";
                          
                          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                          return maxDate.toLocaleDateString('es-ES');
                        } catch (error) {
                          console.error('Error calculating max date:', error);
                          return "Error en fecha";
                        }
                      })()}
                    </p>
                    <p className="text-sm text-purple-600">fecha más reciente</p>
                  </div>
                </div>

                {project?.isAlwaysOnMacro && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <div className="flex items-center gap-2 text-blue-700 mb-2">
                      <Zap className="h-5 w-5" />
                      <span className="font-semibold">Contrato Always-On</span>
                    </div>
                    <p className="text-sm text-blue-600">
                      Las métricas se calculan mensualmente para este tipo de contrato. Los datos mostrados corresponden al filtro temporal seleccionado.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
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

      {/* QuickTimeRegister */}
      {showQuickRegister && (
        <QuickTimeRegister
          projectId={projectId!}
          onClose={() => setShowQuickRegister(false)}
        />
      )}
    </div>
  );
} 
