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
  ChevronDown,
  History,
  Download,
  FileSpreadsheet,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { DeviationAnalysis } from "@/components/advanced-analytics/deviation-analysis";
import { Recommendations } from "@/components/advanced-analytics/recommendations";
import { TrendCharts } from "@/components/advanced-analytics/trend-charts";
import { TeamDeviationAnalysis } from "@/components/advanced-analytics/team-deviation-analysis";
import WeeklyTimeRegister from "@/components/weekly-time-register";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { es } from "date-fns/locale";
import ProjectSummaryFixed from '@/components/dashboard/project-summary-fixed';

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
  }, [timeEntries, filterTimeEntriesByDateRange, dateFilter]);

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
      <div className="text-center py-8 text-purple-500">
        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm mb-3">No hay equipo asignado a este proyecto</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => copyTeamMutation.mutate()}
          disabled={copyTeamMutation.isPending}
          className="border-purple-200 hover:bg-purple-50"
        >
          {copyTeamMutation.isPending ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-purple-600" />
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
    <TooltipProvider>
      <div className="space-y-3">
        {baseTeam.map((member: any, index: number) => {
          const workedHours = getTimeWorkedByMember(member.personnelId);
          const estimatedHours = member.estimatedHours || 0;
          const progressPercent = getProgressPercentage(workedHours, estimatedHours);
          const remainingHours = Math.max(0, estimatedHours - workedHours);
          const isOverBudget = workedHours > estimatedHours;
          
          // Definir colores y estilos basados en el estado del miembro
          const getCardStyle = () => {
            if (workedHours === 0) {
              return {
                bgGradient: "bg-gradient-to-r from-gray-50 to-gray-100",
                borderColor: "border-gray-300",
                textColor: "text-gray-600",
                avatarBg: "bg-gradient-to-br from-gray-400 to-gray-500",
                nameColor: "text-gray-700",
                roleColor: "text-gray-500"
              };
            } else if (isOverBudget) {
              return {
                bgGradient: "bg-gradient-to-r from-red-50 to-red-100",
                borderColor: "border-red-300",
                textColor: "text-red-700",
                avatarBg: "bg-gradient-to-br from-red-500 to-red-600",
                nameColor: "text-red-900",
                roleColor: "text-red-600"
              };
            } else if (progressPercent >= 80) {
              return {
                bgGradient: "bg-gradient-to-r from-yellow-50 to-orange-100",
                borderColor: "border-yellow-300",
                textColor: "text-yellow-700",
                avatarBg: "bg-gradient-to-br from-yellow-500 to-orange-500",
                nameColor: "text-yellow-900",
                roleColor: "text-yellow-700"
              };
            } else if (progressPercent > 0) {
              return {
                bgGradient: "bg-gradient-to-r from-green-50 to-emerald-100",
                borderColor: "border-green-300",
                textColor: "text-green-700",
                avatarBg: "bg-gradient-to-br from-green-500 to-emerald-600",
                nameColor: "text-green-900",
                roleColor: "text-green-700"
              };
            } else {
              return {
                bgGradient: "bg-gradient-to-r from-blue-50 to-blue-100",
                borderColor: "border-blue-300",
                textColor: "text-blue-700",
                avatarBg: "bg-gradient-to-br from-blue-500 to-blue-600",
                nameColor: "text-blue-900",
                roleColor: "text-blue-700"
              };
            }
          };

          const cardStyle = getCardStyle();

          return (
            <div key={member.id} className={`flex items-center justify-between p-3 border-l-4 ${cardStyle.borderColor} bg-white/60 backdrop-blur-sm rounded-lg hover:bg-white/80 transition-all duration-200 border border-gray-100`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 ${cardStyle.avatarBg} rounded-full flex items-center justify-center shadow-sm`}>
                    <span className="text-white text-xs font-bold">
                      {member.personnel?.name?.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase() || 'MB'}
                    </span>
                  </div>
                  {/* Badge de progreso - más discreto pero legible */}
                  <div className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border border-white ${
                    progressPercent >= 100 ? 'bg-green-600 text-white' : 
                    progressPercent >= 80 ? 'bg-yellow-500 text-white' : 
                    progressPercent > 0 ? 'bg-blue-600 text-white' :
                    'bg-gray-400 text-white'
                  }`}>
                    {progressPercent}
                  </div>
                </div>
                <div className="flex-1">
                  <div className={`font-medium text-sm ${cardStyle.nameColor}`}>
                    {member.personnel?.name || 'Miembro del Equipo'}
                  </div>
                  <div className={`text-xs ${cardStyle.roleColor} opacity-75`}>
                    {member.role?.name || 'Operations Lead'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Información de horas más compacta */}
                <div className="text-center min-w-[60px]">
                  <div className={`text-sm font-bold ${cardStyle.textColor}`}>
                    {workedHours.toFixed(1)}h
                  </div>
                  <div className="text-xs text-gray-500">
                    de {estimatedHours}h
                  </div>
                </div>

                {/* Barra de progreso más sutil */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-24 bg-gray-100 rounded-full h-2 cursor-pointer relative overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isOverBudget ? 'bg-red-500' :
                          progressPercent >= 80 ? 'bg-yellow-500' :
                          progressPercent > 0 ? 'bg-green-500' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div>Trabajadas: {workedHours.toFixed(1)}h</div>
                      <div>Estimadas: {estimatedHours}h</div>
                      <div>Progreso: {progressPercent}%</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Status badge más limpio */}
                {workedHours === 0 ? (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-gray-300 text-gray-600 bg-gray-50">
                    Sin actividad
                  </Badge>
                ) : isOverBudget ? (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 border-red-200">
                    Excedido
                  </Badge>
                ) : progressPercent >= 100 ? (
                  <Badge className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border-green-200">
                    Completado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                    Parcial
                  </Badge>
                )}

                {/* Costo más discreto */}
                <div className="text-right min-w-[70px]">
                  <div className={`text-sm font-semibold ${cardStyle.nameColor}`}>
                    ${(workedHours * (member.hourlyRate || 0)).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${member.hourlyRate || 0}/h
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
    </TooltipProvider>
  );
}

export default function ProjectDetailsRedesigned() {
  // Obtener projectId de la URL de manera más robusta
  const [location, setLocation] = useLocation();
  const projectId = location.split('/')[2]; // /active-projects/{id}
  
  // Debug: Verificar que el projectId se obtenga correctamente
  console.log('🔍 Location debug:', { location, projectId, urlParts: location.split('/') });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Verificar si hay parámetro de tab en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabFromUrl || "dashboard");
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

  // Aplicar filtro temporal - disponible globalmente
  const filteredTimeEntries = useMemo(() => {
    if (!Array.isArray(timeEntries)) return [];
    return filterTimeEntriesByDateRange(timeEntries);
  }, [timeEntries, filterTimeEntriesByDateRange]);

  // Obtener datos de la cotización - disponible globalmente
  const quotationData = useMemo(() => {
    if (!project) return null;
    return (project as any).quotation;
  }, [project]);

  // Cálculos principales basados en objetivos de cotización aprobada
  const metrics = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return [];

    const projectData = project as any;

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

    // SI NO HAY DATOS REALES EN EL PERÍODO, MOSTRAR ESTADO VACÍO
    const hasDataInPeriod = filteredTimeEntries.length > 0;
    
    if (!hasDataInPeriod) {
      return [
        {
          label: "Markup",
          value: "0.0x",
          subtitle: "Sin datos en el período",
          icon: Percent,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100",
          change: 0
        },
        {
          label: "Progreso",
          value: "0%",
          subtitle: "Sin actividad registrada",
          icon: Target,
          color: "text-gray-600", 
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100",
          change: 0
        },
        {
          label: "Presupuesto",
          value: "$0",
          subtitle: "Sin costos registrados",
          icon: DollarSign,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100",
          change: 0
        },
        {
          label: "Estado",
          value: "Crítico",
          subtitle: "Sin actividad en el período",
          icon: AlertTriangle,
          color: "text-red-700",
          bgColor: "bg-gradient-to-br from-red-50 to-red-100",
        }
      ];
    }

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
  }, [project, timeEntries, dateFilter, filteredTimeEntries]);

  const recentTimeEntries = useMemo(() => {
    if (!Array.isArray(filteredTimeEntries)) return [];

    return filteredTimeEntries
      .sort((a: TimeEntry, b: TimeEntry) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [filteredTimeEntries]);

  const teamStats = useMemo(() => {
    if (!Array.isArray(filteredTimeEntries) || !Array.isArray(baseTeam)) return [];

    const memberStats = new Map();

    filteredTimeEntries.forEach((entry: TimeEntry) => {
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
  }, [filteredTimeEntries, baseTeam]);

  // Cálculo de resumen de costos usando objetivos de cotización
  const costSummary = useMemo(() => {
    if (!project || !Array.isArray(filteredTimeEntries)) return null;

    const projectData = project as any;
    const quotationData = projectData.quotation;

    // Obtener objetivos mensuales de la cotización asociada al proyecto
    if (!quotationData) {
      console.warn('⚠️ No hay cotización asociada al proyecto para costSummary:', projectData.id);
      return null;
    }

    // SI NO HAY DATOS EN EL PERÍODO, RETORNAR VALORES EN CERO
    const hasDataInPeriod = filteredTimeEntries.length > 0;
    
    if (!hasDataInPeriod) {
      return {
        totalCost: 0,
        budget: 0,
        budgetUtilization: 0,
        savings: 0,
        filteredHours: 0,
        targetHours: 0,
        targetMultiplier: 0,
        markup: 0,
        targetClientPrice: 0,
        hoursProgress: 0
      };
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
    const actualCost = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRateAtTime || entry.hourlyRate || 100)), 0);

    const actualHours = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);

    const budgetUtilization = targetBudget > 0 ? (actualCost / targetBudget) * 100 : 0;

    // Calcular markup usando precio de cotización vs costo real
    const monthlyClientPrice = quotationData.totalAmount || 0;
    const targetClientPrice = monthlyClientPrice * targetMultiplier;
    const markup = actualCost > 0 ? targetClientPrice / actualCost : 0;
    
    // Calcular progreso de horas
    const hoursProgress = targetHours > 0 ? Math.min(100, (actualHours / targetHours) * 100) : 0;

    return {
      totalCost: actualCost,
      budget: targetBudget,
      budgetUtilization,
      savings: targetBudget - actualCost,
      filteredHours: actualHours,
      targetHours,
      targetMultiplier,
      markup: markup,
      targetClientPrice: targetClientPrice,
      hoursProgress: hoursProgress
    };
  }, [project, filteredTimeEntries, dateFilter]);

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


        </div>
      </div>

      {/* Dialog de Registro Rápido de Tiempo */}
      <Dialog open={showQuickRegister} onOpenChange={setShowQuickRegister}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
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
        </DialogContent>
      </Dialog>

      {/* Contenido principal con tabs */}
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-4xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <Gauge className="h-4 w-4" />
              Resumen Ejecutivo
            </TabsTrigger>
            <TabsTrigger 
              value="team-analysis" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Análisis de Equipo
            </TabsTrigger>
            <TabsTrigger 
              value="time-management" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
            >
              <Timer className="h-4 w-4" />
              Registro de Tiempo
            </TabsTrigger>
            <TabsTrigger 
              value="details" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              Análisis Mensual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            
            {/* SECCIÓN 1: KPI Cards Principales - Layout Profesional */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              
              {/* Markup Card - Métrica más importante */}
              <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50 via-blue-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Percent className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-700">Markup</span>
                    </div>
                    <Badge variant={(() => {
                      const markup = costSummary?.markup || 0;
                      if (markup >= 2.5) return 'default';
                      if (markup >= 1.8) return 'secondary';
                      if (markup >= 1.2) return 'destructive';
                      return 'destructive';
                    })()} className="text-xs">
                      {(() => {
                        const markup = costSummary?.markup || 0;
                        if (markup >= 2.5) return 'Excelente';
                        if (markup >= 1.8) return 'Bueno';
                        if (markup >= 1.2) return 'Aceptable';
                        return 'Crítico';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {costSummary?.markup ? `${costSummary.markup.toFixed(1)}x` : '0.0x'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Rentabilidad del proyecto
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Progreso de Horas */}
              <Card className="border-l-4 border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Clock className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-green-700">Progreso</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {costSummary?.filteredHours || 0}h / {costSummary?.targetHours || 0}h
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {(costSummary?.hoursProgress || 0).toFixed(1)}%
                    </p>
                    <Progress value={costSummary?.hoursProgress || 0} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Uso del Presupuesto */}
              <Card className="border-l-4 border-l-orange-600 bg-gradient-to-br from-orange-50 via-orange-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <DollarSign className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="text-sm font-medium text-orange-700">Presupuesto</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        ${costSummary?.totalCost?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {(costSummary?.budgetUtilization || 0).toFixed(1)}%
                    </p>
                    <Progress 
                      value={costSummary?.budgetUtilization || 0} 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Estado General */}
              <Card className="border-l-4 border-l-purple-600 bg-gradient-to-br from-purple-50 via-purple-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Gauge className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-purple-700">Estado</span>
                    </div>
                    <Badge variant={(() => {
                      const budgetUtil = costSummary?.budgetUtilization || 0;
                      const markup = costSummary?.markup || 0;
                      if (budgetUtil > 90 || markup < 1.2) return 'destructive';
                      if (budgetUtil > 75 || markup < 1.8) return 'secondary';
                      return 'default';
                    })()} className="text-xs">
                      {(() => {
                        const budgetUtil = costSummary?.budgetUtilization || 0;
                        const markup = costSummary?.markup || 0;
                        if (budgetUtil > 90 || markup < 1.2) return 'Crítico';
                        if (budgetUtil > 75 || markup < 1.8) return 'Atención';
                        return 'Saludable';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      {(() => {
                        const budgetUtil = costSummary?.budgetUtilization || 0;
                        const markup = costSummary?.markup || 0;
                        if (budgetUtil > 90 || markup < 1.2) return 'Crítico';
                        if (budgetUtil > 75 || markup < 1.8) return 'Atención';
                        return 'Saludable';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">Evaluación integral</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SECCIÓN 2: Análisis Avanzado - Grid Profesional 2x2 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Análisis de Desviaciones */}
              <div className="space-y-4">
                <DeviationAnalysis 
                  projectId={projectId!} 
                  dateFilter={{
                    startDate: dateFilter.startDate.toISOString(),
                    endDate: dateFilter.endDate.toISOString()
                  }}
                  onNavigateToTab={setActiveTab}
                />
              </div>
              
              {/* Recomendaciones Automáticas */}
              <div className="space-y-4">
                <Recommendations 
                  projectId={projectId!} 
                  dateFilter={{
                    startDate: dateFilter.startDate.toISOString(),
                    endDate: dateFilter.endDate.toISOString()
                  }}
                />
              </div>
              
            </div>

            {/* SECCIÓN 3: Gráficos de Tendencias - Full Width */}
            <div className="w-full">
              <TrendCharts 
                projectId={projectId!} 
                dateFilter={{
                  startDate: dateFilter.startDate.toISOString(),
                  endDate: dateFilter.endDate.toISOString()
                }}
              />
            </div>

            {/* SECCIÓN 4: Actividad Reciente - Optimizada */}
            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Activity className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
                      <p className="text-sm text-gray-500">Últimos registros de tiempo del equipo</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {filteredTimeEntries.length} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
                  {filteredTimeEntries.length > 0 ? (
                    filteredTimeEntries.slice(0, 12).map((entry, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-semibold">
                            {entry.personnelName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{entry.personnelName}</p>
                          <p className="text-xs text-gray-500 truncate">{entry.roleName}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-indigo-600">{entry.hours}h</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-gray-100 rounded-full">
                          <Clock className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-600">Sin actividad reciente</p>
                          <p className="text-sm text-gray-500">No hay registros de tiempo en el período seleccionado</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="team-analysis" className="space-y-6">
            {/* Análisis operativo del equipo */}
            <div className="space-y-6">
              
              {/* Resumen de Métricas Clave */}
              <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-50 to-gray-50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                    Resumen Operativo del Equipo
                  </CardTitle>
                  <CardDescription className="text-base">
                    Métricas clave de rendimiento para el período {dateFilter.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Miembros Activos */}
                    <div className="text-center p-4 bg-white rounded-xl border border-blue-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {teamStats?.length || 0}
                      </div>
                      <div className="text-sm font-medium text-gray-600">Miembros Activos</div>
                      <div className="text-xs text-gray-500 mt-1">con actividad registrada</div>
                    </div>

                    {/* Horas Trabajadas */}
                    <div className="text-center p-4 bg-white rounded-xl border border-green-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                        <Clock className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {(costSummary?.filteredHours || 0).toFixed(1)}h
                      </div>
                      <div className="text-sm font-medium text-gray-600">Horas Trabajadas</div>
                      <div className="text-xs text-gray-500 mt-1">total del período</div>
                    </div>

                    {/* Eficiencia */}
                    <div className="text-center p-4 bg-white rounded-xl border border-purple-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                        <Target className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {costSummary?.targetHours && costSummary?.filteredHours 
                          ? ((costSummary.filteredHours / costSummary.targetHours) * 100).toFixed(0)
                          : '0'}%
                      </div>
                      <div className="text-sm font-medium text-gray-600">Progreso</div>
                      <div className="text-xs text-gray-500 mt-1">vs. objetivo planeado</div>
                    </div>

                    {/* Promedio por Miembro */}
                    <div className="text-center p-4 bg-white rounded-xl border border-orange-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-3">
                        <Activity className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="text-3xl font-bold text-orange-600 mb-1">
                        {teamStats && teamStats.length > 0 
                          ? (teamStats.reduce((acc, member) => acc + member.hours, 0) / teamStats.length).toFixed(1)
                          : '0.0'}h
                      </div>
                      <div className="text-sm font-medium text-gray-600">Promedio</div>
                      <div className="text-xs text-gray-500 mt-1">horas por persona</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Análisis de Desviaciones - Tabla Mejorada */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    Análisis de Desviaciones del Equipo
                  </CardTitle>
                  <CardDescription className="text-base">
                    Comparativa de rendimiento vs. objetivos presupuestados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TeamDeviationAnalysis 
                    projectId={projectId!} 
                    dateFilter={{
                      startDate: dateFilter.startDate.toISOString(),
                      endDate: dateFilter.endDate.toISOString()
                    }}
                  />
                </CardContent>
              </Card>

              {/* Reportes y Análisis */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Reportes y Análisis
                  </CardTitle>
                  <CardDescription>
                    Exportar datos del equipo y generar reportes operativos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-16 flex items-center justify-center gap-3 hover:bg-blue-50 hover:border-blue-300"
                      onClick={() => {
                        try {
                          // Generar datos del reporte usando la información real del equipo
                          const reportData = [];

                          // Agregar datos del proyecto
                          reportData.push({
                            seccion: "Información del Proyecto",
                            nombre: project?.name || `Proyecto ${projectId}`,
                            valor: `Cliente: ${project?.client?.name || 'N/A'}`,
                            fecha: new Date().toLocaleDateString('es-ES')
                          });

                          // Agregar estadísticas del equipo
                          if (teamStats && teamStats.length > 0) {
                            teamStats.forEach(member => {
                              reportData.push({
                                seccion: "Miembro del Equipo",
                                nombre: member.name,
                                valor: `${member.hours}h trabajadas, ${member.entries} registros`,
                                fecha: member.lastActivity || 'Sin actividad'
                              });
                            });
                          }

                          // Agregar resumen financiero
                          if (costSummary) {
                            reportData.push({
                              seccion: "Resumen Financiero",
                              nombre: "Markup",
                              valor: costSummary.markup ? `${costSummary.markup.toFixed(2)}x` : '0.00x',
                              fecha: dateFilter.label
                            });
                            reportData.push({
                              seccion: "Resumen Financiero", 
                              nombre: "Costo Total",
                              valor: `$${costSummary.totalCost?.toLocaleString() || '0'}`,
                              fecha: dateFilter.label
                            });
                          }

                          // Crear CSV
                          const csvContent = "data:text/csv;charset=utf-8," + 
                            "Sección,Nombre,Valor,Fecha\n" +
                            reportData.map(row => 
                              `"${row.seccion}","${row.nombre}","${row.valor}","${row.fecha}"`
                            ).join("\n");

                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `reporte_analisis_equipo_${projectId}_${new Date().toISOString().split('T')[0]}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);

                          toast({
                            title: "Reporte de Análisis Generado",
                            description: `Descargado reporte de análisis del equipo con ${reportData.length} elementos`,
                          });
                        } catch (error) {
                          console.error('Error generando reporte:', error);
                          toast({
                            title: "Error",
                            description: "No se pudo generar el reporte. Inténtalo de nuevo.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Reporte de Análisis</div>
                        <div className="text-xs text-gray-500">Exportar análisis completo</div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-16 flex items-center justify-center gap-3 hover:bg-green-50 hover:border-green-300"
                      onClick={() => setLocation(`/time-entries/project/${projectId}`)}
                    >
                      <History className="h-5 w-5 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Historial Completo</div>
                        <div className="text-xs text-gray-500">Ver todos los registros</div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="time-management" className="space-y-6">
            {/* SECCIÓN 1: Métricas de Tiempo Compactas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-purple-600 bg-gradient-to-br from-purple-50 via-purple-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Clock className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-purple-700">Total Registrado</span>
                    </div>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                      {(costSummary?.filteredHours || 0).toFixed(1)}h
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {((costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1) * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      de {costSummary?.targetHours || 0}h estimadas
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Users className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-green-700">Miembros Activos</span>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      {teamStats?.filter(member => member.hours > 0).length || 0}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {teamStats?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500">
                      con registro de tiempo
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-600 bg-gradient-to-br from-orange-50 via-orange-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Activity className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="text-sm font-medium text-orange-700">Promedio Diario</span>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                      {dateFilter.label}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {teamStats && teamStats.length > 0 
                        ? (teamStats.reduce((acc, member) => acc + member.hours, 0) / teamStats.length / 30).toFixed(1)
                        : '0.0'}h
                    </p>
                    <p className="text-xs text-gray-500">
                      por miembro del equipo
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SECCIÓN 2: Acciones Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <History className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-medium text-emerald-700">Historial Completo</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/time-entries/project/${projectId}`)}
                      className="border-emerald-200 hover:bg-emerald-50 h-8"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Ver Todo
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Ver, editar y administrar todos los registros de tiempo
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-600">Registros: </span>
                    <span className="text-gray-500">
                      {filteredTimeEntries.length} en {dateFilter.label}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-700">Registrar Tiempo</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowQuickRegister(true)}
                      className="border-blue-200 hover:bg-blue-50 h-8"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Nuevo
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Agregar horas trabajadas por equipo
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-blue-600">Última entrada: </span>
                    <span className="text-gray-500">
                      {filteredTimeEntries.length > 0 ? 'Hoy' : 'Sin registros'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-600 bg-gradient-to-br from-amber-50 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Download className="h-4 w-4 text-amber-600" />
                      </div>
                      <span className="text-sm font-medium text-amber-700">Exportar Datos</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const teamData = teamStats?.map(member => ({
                          Nombre: member.personnel?.name || 'Sin nombre',
                          Horas: member.hours?.toFixed(2) || '0.00',
                          Costo: `$${member.cost?.toFixed(2) || '0.00'}`,
                          Progreso: `${Math.round((member.hours / (member.estimatedHours || 1)) * 100)}%`
                        })) || [];
                        
                        const csvContent = [
                          Object.keys(teamData[0] || {}).join(','),
                          ...teamData.map(row => Object.values(row).join(','))
                        ].join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `equipo-proyecto-${projectId}-${dateFilter.label}.csv`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                      className="border-amber-200 hover:bg-amber-50 h-8"
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-1" />
                      CSV
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Descargar reporte del periodo actual
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-600">Período: </span>
                    <span className="text-gray-500">
                      {dateFilter.label}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SECCIÓN 3: Equipo del Proyecto - Vista de Registro */}
            <Card className="border-l-4 border-l-gray-400 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Users className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        Registro de Tiempo por Miembro
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-700">
                        Estado de registro de horas y progreso individual del equipo
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800 text-xs">
                      {teamStats?.filter(member => member.hours > 0).length || 0} activos
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
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

          <TabsContent value="details" className="space-y-6">
            {/* Análisis Mensual Avanzado */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Métricas Principales */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-indigo-600" />
                    Análisis Mensual Avanzado - {dateFilter.label}
                  </CardTitle>
                  <CardDescription>
                    Tendencias y patrones de desempeño del proyecto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <p className="text-sm font-medium text-blue-800">Horas Totales</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {((costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 mb-1">
                        {costSummary?.filteredHours || 0}h
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">de {costSummary?.targetHours || 0}h estimadas</span>
                        <span className={`font-medium ${(costSummary?.filteredHours || 0) > (costSummary?.targetHours || 0) ? 'text-red-600' : 'text-green-600'}`}>
                          {(costSummary?.filteredHours || 0) > (costSummary?.targetHours || 0) ? '+' : ''}
                          {((costSummary?.filteredHours || 0) - (costSummary?.targetHours || 0)).toFixed(1)}h
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <p className="text-sm font-medium text-green-800">Costo vs Presupuesto</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {((costSummary?.totalCost || 0) / (costSummary?.budget || 1) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-green-600 mb-1">
                        ${costSummary?.totalCost?.toLocaleString() || '0'}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">de ${costSummary?.budget?.toLocaleString() || '0'}</span>
                        <span className={`font-medium ${(costSummary?.totalCost || 0) > (costSummary?.budget || 0) ? 'text-red-600' : 'text-green-600'}`}>
                          {(costSummary?.totalCost || 0) > (costSummary?.budget || 0) ? '+' : ''}
                          ${((costSummary?.totalCost || 0) - (costSummary?.budget || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico de Tendencias Simulado */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      Tendencia de Horas por Semana
                    </h4>
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-end justify-between h-32 gap-2">
                        {(() => {
                          const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                          if (!filteredEntries || filteredEntries.length === 0) {
                            return Array(7).fill(0).map((_, i) => (
                              <div key={i} className="bg-gray-200 rounded-t w-full h-4"></div>
                            ));
                          }

                          // Agrupar por semana
                          const weeklyData = filteredEntries.reduce((acc: any, entry: TimeEntry) => {
                            const date = new Date(entry.date);
                            const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
                            const weekKey = weekStart.toISOString().split('T')[0];

                            if (!acc[weekKey]) acc[weekKey] = 0;
                            acc[weekKey] += entry.hours;
                            return acc;
                          }, {});

                          const weeks = Object.entries(weeklyData).slice(-7);
                          const maxHours = Math.max(...weeks.map(([, hours]) => hours as number));

                          return weeks.map(([week, hours], i) => (
                            <div key={week} className="flex flex-col items-center gap-1 w-full">
                              <div 
                                className="bg-gradient-to-t from-purple-500 to-purple-400 rounded-t w-full transition-all duration-300"
                                style={{ height: `${(hours as number / maxHours) * 100}%` }}
                              ></div>
                              <span className="text-xs text-gray-500 transform rotate-45">
                                {new Date(week).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Panel de Análisis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                    Análisis de Rendimiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Eficiencia del Equipo */}
                  <div className="p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-yellow-600" />
                      <h5 className="font-semibold text-yellow-800">Eficiencia del Equipo</h5>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Promedio por persona</span>
                        <span className="font-medium">
                          {teamStats && teamStats.length > 0 
                            ? (teamStats.reduce((sum: number, member: any) => sum + member.hours, 0) / teamStats.length).toFixed(1)
                            : 0}h
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Miembros activos</span>
                        <span className="font-medium">{teamStats?.length || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Días productivos</span>
                        <span className="font-medium">
                          {(() => {
                            const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                            if (!filteredEntries) return 0;
                            const validDates = filteredEntries
                              .map((entry: TimeEntry) => new Date(entry.date).toDateString())
                              .filter((dateString, index, array) => array.indexOf(dateString) === index);
                            return validDates.length;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alertas y Recomendaciones */}
                  <div className="space-y-2">
                    <h5 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Alertas
                    </h5>

                    {/* Alerta de presupuesto */}
                    {(costSummary?.totalCost || 0) > (costSummary?.budget || 0) * 0.8 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Presupuesto Crítico</span>
                        </div>
                        <p className="text-xs text-red-600">
                          Utilizado el {((costSummary?.totalCost || 0) / (costSummary?.budget || 1) * 100).toFixed(1)}% del presupuesto
                        </p>
                      </div>
                    )}

                    {/* Alerta de horas */}
                    {(costSummary?.filteredHours || 0) > (costSummary?.targetHours || 0) * 0.9 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">Horas Elevadas</span>
                        </div>
                        <p className="text-xs text-yellow-600">
                          Cerca del límite de horas estimadas
                        </p>
                      </div>
                    )}

                    {/* Estado saludable */}
                    {(costSummary?.totalCost || 0) <= (costSummary?.budget || 0) * 0.8 && 
                     (costSummary?.filteredHours || 0) <= (costSummary?.targetHours || 0) * 0.9 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Proyecto Saludable</span>
                        </div>
                        <p className="text-xs text-green-600">
                          Dentro de los parámetros normales
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* COMPONENTE 1: SEMÁFORO DE SALUD - MÁS CRÍTICO */}
            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-600" />
                  Semáforo de Salud del Proyecto
                </CardTitle>
                <CardDescription>
                  Estado crítico y alertas inmediatas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {/* Semáforo Principal */}
                  <div className="lg:col-span-1">
                    <div className="p-4 bg-white rounded-lg border border-red-200">
                      <h5 className="font-medium text-red-800 mb-3">Estado General</h5>
                      <div className="flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${(() => {
                          const budgetUsage = (costSummary?.budget || 0) > 0 ? (costSummary?.totalCost || 0) / (costSummary?.budget || 1) : 0;
                          const timeUsage = (costSummary?.targetHours || 0) > 0 ? (costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1) : 0;
                          if (budgetUsage > 0.9 || timeUsage > 0.9) return 'bg-red-500';
                          if (budgetUsage > 0.75 || timeUsage > 0.75) return 'bg-yellow-500';
                          return 'bg-green-500';
                        })()}`}>
                          <span className="text-2xl font-bold text-white">
                            {(() => {
                              const budgetUsage = (costSummary?.budget || 0) > 0 ? (costSummary?.totalCost || 0) / (costSummary?.budget || 1) : 0;
                              const timeUsage = (costSummary?.targetHours || 0) > 0 ? (costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1) : 0;
                              if (budgetUsage > 0.9 || timeUsage > 0.9) return '🔴';
                              if (budgetUsage > 0.75 || timeUsage > 0.75) return '🟡';
                              return '🟢';
                            })()}
                          </span>
                        </div>
                        <p className="text-xs text-center mt-2">
                          {(() => {
                            const budgetUsage = (costSummary?.budget || 0) > 0 ? (costSummary?.totalCost || 0) / (costSummary?.budget || 1) : 0;
                            const timeUsage = (costSummary?.targetHours || 0) > 0 ? (costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1) : 0;
                            if (budgetUsage > 0.9 || timeUsage > 0.9) return 'Crítico';
                            if (budgetUsage > 0.75 || timeUsage > 0.75) return 'Atención';
                            return 'Saludable';
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Alertas Críticas */}
                  <div className="lg:col-span-3">
                    <div className="p-4 bg-white rounded-lg border border-red-200">
                      <h5 className="font-medium text-red-800 mb-3">Alertas Críticas</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const alerts = [];
                          
                          if ((costSummary?.totalCost || 0) > (costSummary?.budget || 0) * 0.8) {
                            alerts.push({
                              type: 'danger',
                              title: 'Presupuesto Crítico',
                              message: `Utilizado el ${((costSummary?.totalCost || 0) / (costSummary?.budget || 1) * 100).toFixed(1)}% del presupuesto`,
                              icon: <AlertTriangle className="h-4 w-4 text-red-500" />
                            });
                          }
                          
                          if ((costSummary?.filteredHours || 0) > (costSummary?.targetHours || 0) * 0.8) {
                            alerts.push({
                              type: 'warning',
                              title: 'Tiempo Crítico',
                              message: `${((costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1) * 100).toFixed(1)}% del tiempo utilizado`,
                              icon: <Clock className="h-4 w-4 text-amber-500" />
                            });
                          }
                          
                          if (teamStats && teamStats.filter((t: any) => t.hours > 0).length < 3) {
                            alerts.push({
                              type: 'info',
                              title: 'Recursos Limitados',
                              message: `Solo ${teamStats.filter((t: any) => t.hours > 0).length} miembros activos`,
                              icon: <Users className="h-4 w-4 text-blue-500" />
                            });
                          }
                          
                          if (alerts.length === 0) {
                            alerts.push({
                              type: 'success',
                              title: 'Proyecto Estable',
                              message: 'Todos los indicadores dentro de parámetros normales',
                              icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
                            });
                          }
                          
                          return alerts.map((alert, i) => (
                            <div key={i} className={`p-3 rounded-lg border ${
                              alert.type === 'danger' ? 'bg-red-50 border-red-200' :
                              alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                              alert.type === 'info' ? 'bg-blue-50 border-blue-200' :
                              'bg-green-50 border-green-200'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                {alert.icon}
                                <span className="text-sm font-medium">{alert.title}</span>
                              </div>
                              <p className="text-xs text-gray-600">{alert.message}</p>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* COMPONENTE 2: ANÁLISIS FINANCIERO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Análisis Financiero
                  </CardTitle>
                  <CardDescription>
                    Rentabilidad y rendimiento económico
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-800">Margen de Rentabilidad</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {(() => {
                          const revenue = (costSummary?.targetClientPrice || 0);
                          const cost = (costSummary?.totalCost || 0);
                          const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
                          return `${margin.toFixed(1)}%`;
                        })()}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Precio Cliente:</span>
                        <span className="font-medium">${(costSummary?.targetClientPrice || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Costo Real:</span>
                        <span className="font-medium">${(costSummary?.totalCost || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Ganancia:</span>
                        <span className={`${((costSummary?.targetClientPrice || 0) - (costSummary?.totalCost || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${((costSummary?.targetClientPrice || 0) - (costSummary?.totalCost || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg border border-green-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {(() => {
                            const investment = (costSummary?.totalCost || 0);
                            const profit = (costSummary?.targetClientPrice || 0) - investment;
                            const roi = investment > 0 ? (profit / investment) * 100 : 0;
                            return `${roi.toFixed(1)}%`;
                          })()}
                        </div>
                        <p className="text-xs text-green-700">ROI del Proyecto</p>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-green-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {(() => {
                            const monthlyRevenue = (costSummary?.targetClientPrice || 0) / 12;
                            const paybackMonths = monthlyRevenue > 0 ? Math.ceil((costSummary?.totalCost || 0) / monthlyRevenue) : 0;
                            return `${paybackMonths}m`;
                          })()}
                        </div>
                        <p className="text-xs text-green-700">Período de Recuperación</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* COMPONENTE 3: INDICADORES DE RENDIMIENTO */}
              <Card className="bg-white border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Indicadores de Rendimiento
                  </CardTitle>
                  <CardDescription>
                    Métricas de desempeño del proyecto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-blue-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {(() => {
                            const plannedCost = (costSummary?.budget || 0);
                            const actualCost = (costSummary?.totalCost || 0);
                            const cpi = actualCost > 0 ? (plannedCost / actualCost) : 0;
                            return cpi.toFixed(2);
                          })()}
                        </div>
                        <p className="text-xs text-blue-700">IPC (Índice de Rendimiento de Costos)</p>
                        <p className="text-xs text-gray-500">
                          {(() => {
                            const plannedCost = (costSummary?.budget || 0);
                            const actualCost = (costSummary?.totalCost || 0);
                            const cpi = actualCost > 0 ? (plannedCost / actualCost) : 0;
                            return cpi > 1 ? 'Bajo presupuesto' : cpi < 1 ? 'Sobre presupuesto' : 'En presupuesto';
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-blue-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {(() => {
                            const plannedHours = (costSummary?.targetHours || 0);
                            const actualHours = (costSummary?.filteredHours || 0);
                            const spi = plannedHours > 0 ? (actualHours / plannedHours) : 0;
                            return spi.toFixed(2);
                          })()}
                        </div>
                        <p className="text-xs text-blue-700">IPC (Índice de Rendimiento de Cronograma)</p>
                        <p className="text-xs text-gray-500">
                          {(() => {
                            const plannedHours = (costSummary?.targetHours || 0);
                            const actualHours = (costSummary?.filteredHours || 0);
                            const spi = plannedHours > 0 ? (actualHours / plannedHours) : 0;
                            return spi > 1 ? 'Adelantado' : spi < 1 ? 'Atrasado' : 'En cronograma';
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-2">Velocidad del Equipo</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Horas por Día:</span>
                        <span className="font-medium">
                          {(() => {
                            const filteredEntries = filterTimeEntriesByDateRange(timeEntries);
                            const uniqueDays = new Set(filteredEntries?.map(e => e.date.split('T')[0])).size;
                            return uniqueDays > 0 ? ((costSummary?.filteredHours || 0) / uniqueDays).toFixed(1) : '0';
                          })()}h/día
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Eficiencia Promedio:</span>
                        <span className="font-medium">
                          {teamStats && teamStats.length > 0 
                            ? ((teamStats.reduce((sum: number, member: any) => sum + member.hours, 0) / teamStats.length) / 8 * 100).toFixed(0)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* COMPONENTE 4: ANÁLISIS PREDICTIVO */}
            <Card className="bg-white border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Análisis Predictivo
                </CardTitle>
                <CardDescription>
                  Proyecciones y estimaciones de finalización
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-purple-200">
                    <h5 className="font-medium text-purple-800 mb-2">Estimación de Finalización</h5>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-purple-600">
                        ${(() => {
                          const plannedCost = (costSummary?.budget || 0);
                          const actualCost = (costSummary?.totalCost || 0);
                          const cpi = actualCost > 0 ? (plannedCost / actualCost) : 1;
                          const eac = plannedCost / Math.max(cpi, 0.1);
                          return eac.toFixed(0);
                        })()}
                      </div>
                      <p className="text-xs text-purple-700">Costo Final Estimado</p>
                      <div className="text-sm">
                        <span className={`font-medium ${(() => {
                          const plannedCost = (costSummary?.budget || 0);
                          const actualCost = (costSummary?.totalCost || 0);
                          const cpi = actualCost > 0 ? (plannedCost / actualCost) : 1;
                          const eac = plannedCost / Math.max(cpi, 0.1);
                          const variance = eac - plannedCost;
                          return variance > 0 ? 'text-red-600' : 'text-green-600';
                        })()}`}>
                          {(() => {
                            const plannedCost = (costSummary?.budget || 0);
                            const actualCost = (costSummary?.totalCost || 0);
                            const cpi = actualCost > 0 ? (plannedCost / actualCost) : 1;
                            const eac = plannedCost / Math.max(cpi, 0.1);
                            const variance = eac - plannedCost;
                            return variance >= 0 ? '+' : '';
                          })()}
                          ${(() => {
                            const plannedCost = (costSummary?.budget || 0);
                            const actualCost = (costSummary?.totalCost || 0);
                            const cpi = actualCost > 0 ? (plannedCost / actualCost) : 1;
                            const eac = plannedCost / Math.max(cpi, 0.1);
                            const variance = eac - plannedCost;
                            return Math.abs(variance).toFixed(0);
                          })()} vs presupuesto
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-purple-200">
                    <h5 className="font-medium text-purple-800 mb-2">Pronóstico de Recursos</h5>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-purple-600">
                        {(() => {
                          const remainingHours = Math.max((costSummary?.targetHours || 0) - (costSummary?.filteredHours || 0), 0);
                          const workedHours = (costSummary?.filteredHours || 0);
                          const avgHoursPerDay = workedHours > 0 ? workedHours / 30 : 8; // Estimación basada en 30 días
                          const daysToComplete = avgHoursPerDay > 0 ? Math.ceil(remainingHours / avgHoursPerDay) : 0;
                          return `${daysToComplete}d`;
                        })()}
                      </div>
                      <p className="text-xs text-purple-700">Días para Completar</p>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Horas Restantes:</span>
                          <span className="font-medium">
                            {Math.max((costSummary?.targetHours || 0) - (costSummary?.filteredHours || 0), 0).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-purple-200">
                    <h5 className="font-medium text-purple-800 mb-2">Análisis de Riesgos</h5>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-purple-600">
                        {(() => {
                          const overBudget = (costSummary?.totalCost || 0) > (quotationData?.baseCost || 0);
                          const overTime = (costSummary?.filteredHours || 0) > (costSummary?.targetHours || 0);
                          const riskLevel = overBudget && overTime ? 'ALTO' : overBudget || overTime ? 'MEDIO' : 'BAJO';
                          return riskLevel;
                        })()}
                      </div>
                      <p className="text-xs text-purple-700">Nivel de Riesgo</p>
                      <div className="space-y-1">
                        {(() => {
                          const risks = [];
                          if ((costSummary?.totalCost || 0) > (quotationData?.baseCost || 0) * 0.9) {
                            risks.push('Presupuesto crítico');
                          }
                          if ((costSummary?.filteredHours || 0) > (costSummary?.targetHours || 0) * 0.9) {
                            risks.push('Tiempo crítico');
                          }
                          if (teamStats && teamStats.filter((t: any) => t.hours > 0).length < 3) {
                            risks.push('Recursos limitados');
                          }
                          return risks.length > 0 ? risks.map((risk, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              <span className="text-xs">{risk}</span>
                            </div>
                          )) : (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-xs">Sin riesgos detectados</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
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


    </div>
  );
} 

const QuickTimeRegister = ({ projectId, onClose }: { projectId: string, onClose: () => void }) => {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [hours, setHours] = useState<number>(8);
  const [description, setDescription] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Fetch personnel
    fetch('/api/personnel')
      .then(res => res.json())
      .then(data => setPersonnel(data));

    // Fetch roles
    fetch('/api/roles')
      .then(res => res.json())
      .then(data => setRoles(data));
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!selectedPersonnel || !selectedRole) {
      toast({
        title: "Error",
        description: "Por favor, selecciona un miembro del equipo y un rol.",
        variant: "destructive"
      });
      return;
    }

    const data = {
      projectId: projectId,
      personnelId: selectedPersonnel,
      roleId: selectedRole,
      date: new Date().toISOString(),
      hours: hours,
      description: description
    };

    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Registro de tiempo creado correctamente.",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
        onClose();
      } else {
        throw new Error('Failed to create time entry');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el registro de tiempo",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Registro Rápido de Tiempo</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="personnel" className="block text-sm font-medium text-gray-700">Miembro del Equipo</Label>
            <Select onValueChange={(value) => setSelectedPersonnel(parseInt(value))} defaultValue={selectedPersonnel?.toString() || ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar miembro" />
              </SelectTrigger>
              <SelectContent>
                {personnel.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol</Label>
            <Select onValueChange={(value) => setSelectedRole(parseInt(value))} defaultValue={selectedRole?.toString() || ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="hours" className="block text-sm font-medium text-gray-700">Horas</Label>
            <Input
              type="number"
              id="hours"
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value))}
              min="1"
              max="24"
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <div>
            <Label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</Label>
            <Input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              Registrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};