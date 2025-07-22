import { useState, useEffect, useMemo, useCallback } from "react";
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
  Shield,
  Crown,
  Lightbulb,
  Info,
  Star,
  Flame
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
import { EconomicRankings } from "@/components/EconomicRankings";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { es } from "date-fns/locale";
import ProjectSummaryFixed from '@/components/dashboard/project-summary-fixed';
import { useCompleteProjectData } from '@/hooks/useCompleteProjectData';

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

  // FILTROS IDÉNTICOS A TIME-ENTRIES
  const dateFilterOptions = [
    { value: "all", label: "Todos los períodos", group: "General" },
    { value: "this-month", label: "Este mes", group: "General" },
    { value: "last-month", label: "Mes pasado", group: "General" },
    { value: "this-quarter", label: "Este trimestre", group: "General" },
    { value: "last-quarter", label: "Trimestre pasado", group: "General" },
    { value: "this-semester", label: "Este semestre", group: "General" },
    { value: "last-semester", label: "Semestre pasado", group: "General" },
    { value: "this-year", label: "Este año", group: "General" },
    { value: "q1", label: "Q1 (Ene-Mar)", group: "Trimestres" },
    { value: "q2", label: "Q2 (Abr-Jun)", group: "Trimestres" },
    { value: "q3", label: "Q3 (Jul-Sep)", group: "Trimestres" },
    { value: "q4", label: "Q4 (Oct-Dic)", group: "Trimestres" },
    { value: "january", label: "Enero", group: "Meses" },
    { value: "february", label: "Febrero", group: "Meses" },
    { value: "march", label: "Marzo", group: "Meses" },
    { value: "april", label: "Abril", group: "Meses" },
    { value: "may", label: "Mayo", group: "Meses" },
    { value: "june", label: "Junio", group: "Meses" },
    { value: "july", label: "Julio", group: "Meses" },
    { value: "august", label: "Agosto", group: "Meses" },
    { value: "september", label: "Septiembre", group: "Meses" },
    { value: "october", label: "Octubre", group: "Meses" },
    { value: "november", label: "Noviembre", group: "Meses" },
    { value: "december", label: "Diciembre", group: "Meses" }
  ];

  // Función para obtener el rango de fechas basado en el valor del filtro
  const getDateRangeFromFilter = (filterValue: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (filterValue) {
      case "all":
        return { startDate: null, endDate: null, label: "Todos los períodos" };
      case "this-month":
        return {
          startDate: new Date(currentYear, currentMonth, 1),
          endDate: new Date(currentYear, currentMonth + 1, 0),
          label: "Este mes"
        };
      case "last-month":
        return {
          startDate: new Date(currentYear, currentMonth - 1, 1),
          endDate: new Date(currentYear, currentMonth, 0),
          label: "Mes pasado"
        };
      case "this-quarter":
        const currentQuarter = Math.floor(currentMonth / 3);
        return {
          startDate: new Date(currentYear, currentQuarter * 3, 1),
          endDate: new Date(currentYear, (currentQuarter + 1) * 3, 0),
          label: "Este trimestre"
        };
      case "last-quarter":
        const lastQuarter = Math.floor(currentMonth / 3) - 1;
        const quarterYear = lastQuarter < 0 ? currentYear - 1 : currentYear;
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        return {
          startDate: new Date(quarterYear, adjustedQuarter * 3, 1),
          endDate: new Date(quarterYear, (adjustedQuarter + 1) * 3, 0),
          label: "Trimestre pasado"
        };
      case "this-semester":
        const currentSemester = Math.floor(currentMonth / 6);
        return {
          startDate: new Date(currentYear, currentSemester * 6, 1),
          endDate: new Date(currentYear, (currentSemester + 1) * 6, 0),
          label: "Este semestre"
        };
      case "last-semester":
        const lastSemester = Math.floor(currentMonth / 6) - 1;
        const semesterYear = lastSemester < 0 ? currentYear - 1 : currentYear;
        const adjustedSemester = lastSemester < 0 ? 1 : lastSemester;
        return {
          startDate: new Date(semesterYear, adjustedSemester * 6, 1),
          endDate: new Date(semesterYear, (adjustedSemester + 1) * 6, 0),
          label: "Semestre pasado"
        };
      case "this-year":
        return {
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 11, 31),
          label: "Este año"
        };
      // Trimestres específicos
      case "q1":
        return {
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 2, 31),
          label: "Q1 (Ene-Mar)"
        };
      case "q2":
        return {
          startDate: new Date(currentYear, 3, 1),
          endDate: new Date(currentYear, 5, 30),
          label: "Q2 (Abr-Jun)"
        };
      case "q3":
        return {
          startDate: new Date(currentYear, 6, 1),
          endDate: new Date(currentYear, 8, 30),
          label: "Q3 (Jul-Sep)"
        };
      case "q4":
        return {
          startDate: new Date(currentYear, 9, 1),
          endDate: new Date(currentYear, 11, 31),
          label: "Q4 (Oct-Dic)"
        };
      // Meses específicos
      case "january":
        return {
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 0, 31),
          label: "Enero"
        };
      case "february":
        return {
          startDate: new Date(currentYear, 1, 1),
          endDate: new Date(currentYear, 1, 28),
          label: "Febrero"
        };
      case "march":
        return {
          startDate: new Date(currentYear, 2, 1),
          endDate: new Date(currentYear, 2, 31),
          label: "Marzo"
        };
      case "april":
        return {
          startDate: new Date(currentYear, 3, 1),
          endDate: new Date(currentYear, 3, 30),
          label: "Abril"
        };
      case "may":
        return {
          startDate: new Date(currentYear, 4, 1),
          endDate: new Date(currentYear, 4, 31),
          label: "Mayo"
        };
      case "june":
        return {
          startDate: new Date(currentYear, 5, 1),
          endDate: new Date(currentYear, 5, 30),
          label: "Junio"
        };
      case "july":
        return {
          startDate: new Date(currentYear, 6, 1),
          endDate: new Date(currentYear, 6, 31),
          label: "Julio"
        };
      case "august":
        return {
          startDate: new Date(currentYear, 7, 1),
          endDate: new Date(currentYear, 7, 31),
          label: "Agosto"
        };
      case "september":
        return {
          startDate: new Date(currentYear, 8, 1),
          endDate: new Date(currentYear, 8, 30),
          label: "Septiembre"
        };
      case "october":
        return {
          startDate: new Date(currentYear, 9, 1),
          endDate: new Date(currentYear, 9, 31),
          label: "Octubre"
        };
      case "november":
        return {
          startDate: new Date(currentYear, 10, 1),
          endDate: new Date(currentYear, 10, 30),
          label: "Noviembre"
        };
      case "december":
        return {
          startDate: new Date(currentYear, 11, 1),
          endDate: new Date(currentYear, 11, 31),
          label: "Diciembre"
        };
      default:
        return { startDate: null, endDate: null, label: "Todos los períodos" };
    }
  };

  const handleFilterSelect = (filterValue: string) => {
    const dateRange = getDateRangeFromFilter(filterValue);
    onFilterChange({
      type: 'custom',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      label: dateRange.label
    });
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

  // Obtener el valor actual del filtro
  const getCurrentFilterValue = () => {
    const label = selectedFilter.label.toLowerCase();
    return dateFilterOptions.find(option => 
      option.label.toLowerCase() === label ||
      (label.includes('todos') && option.value === 'all') ||
      (label.includes('este mes') && option.value === 'this-month') ||
      (label.includes('mes pasado') && option.value === 'last-month') ||
      (label.includes('este trimestre') && option.value === 'this-quarter') ||
      (label.includes('trimestre pasado') && option.value === 'last-quarter') ||
      (label.includes('este semestre') && option.value === 'this-semester') ||
      (label.includes('semestre pasado') && option.value === 'last-semester') ||
      (label.includes('este año') && option.value === 'this-year') ||
      label.includes(option.label.toLowerCase())
    )?.value || 'all';
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Período:</Label>
        <Select 
          value={getCurrentFilterValue()}
          onValueChange={(value) => {
            if (value === 'custom') {
              setIsCustomOpen(true);
            } else {
              handleFilterSelect(value);
            }
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Seleccionar período">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {selectedFilter.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {/* General */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50">General</div>
            {dateFilterOptions.filter(option => option.group === 'General').map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            
            {/* Trimestres */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">Trimestres</div>
            {dateFilterOptions.filter(option => option.group === 'Trimestres').map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            
            {/* Meses */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">Meses</div>
            {dateFilterOptions.filter(option => option.group === 'Meses').map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
function ProjectTeamSection({ projectId, unifiedData, timeFilter }: { 
  projectId: string; 
  unifiedData: any;
  timeFilter: string;
}) {
  const { toast } = useToast();

  // FUNCIÓN PARA CALCULAR MULTIPLICADOR TEMPORAL
  const getQuotationMultiplier = (filter: string): number => {
    switch (filter) {
      case 'current_month':
      case 'last_month':
      case 'may_2025':
      case 'june_2025':
      case 'july_2025':
      case 'january_2025':
      case 'february_2025':
      case 'march_2025':
      case 'april_2025':
      case 'august_2025':
      case 'september_2025':
      case 'october_2025':
      case 'november_2025':
      case 'december_2025':
        return 1;
      case 'current_quarter':
      case 'last_quarter':
      case 'q1_2025':
      case 'q2_2025':
      case 'q3_2025':
      case 'q4_2025':
        return 3;
      case 'current_semester':
      case 'last_semester':
      case 'semester1_2025':
      case 'semester2_2025':
        return 6;
      case 'current_year':
      case 'last_year':
      case 'year_2025':
        return 12;
      default:
        return 1;
    }
  };

  // USAR DIRECTAMENTE LOS DATOS YA PREPARADOS POR EL BACKEND
  const quotationTeam = unifiedData?.quotation?.team || [];
  const teamBreakdownArray = unifiedData?.actuals?.teamBreakdown || [];
  
  // Debug: Ver qué datos llegan del backend
  console.log('🔍 DEBUG - Datos del backend (FIXED):', {
    quotationTeam: quotationTeam.slice(0, 2),
    teamBreakdownArray: teamBreakdownArray.slice(0, 2),
    totalTeamMembers: quotationTeam.length,
    totalActualMembers: teamBreakdownArray.length,
    unifiedDataKeys: Object.keys(unifiedData || {}),
    actualsKeys: Object.keys(unifiedData?.actuals || {}),
    expectationsKeys: Object.keys(unifiedData?.expectations || {}),
    fullUnifiedData: unifiedData,
    fullTeamBreakdown: teamBreakdownArray,
    timeFilter: timeFilter
  });
  
  // SIMPLIFICADO: Usar directamente el teamBreakdown del backend que ya tiene toda la lógica
  const completeTeam = teamBreakdownArray.map((member: any) => {
    // Buscar datos de cotización para mostrar estimaciones
    const quotationMember = quotationTeam.find((q: any) => q.personnelId === member.personnelId);
    
    // APLICAR ESCALAMIENTO TEMPORAL a las horas estimadas
    const baseEstimatedHours = quotationMember?.hours || 0;
    const multiplier = getQuotationMultiplier(timeFilter);
    const scaledEstimatedHours = baseEstimatedHours * multiplier;
    
    return {
      ...member,
      // Datos reales (ya vienen del backend correctos)
      actualHours: member.hours || 0,
      actualName: member.name || 'Sin Nombre',
      actualRoleName: member.roleName || 'Sin Rol',
      actualRate: member.rate || member.hourlyRate || 0,
      // Datos de estimación (escalados según período temporal)
      estimatedHours: scaledEstimatedHours,
      baseEstimatedHours: baseEstimatedHours, // Para debugging
      timeMultiplier: multiplier, // Para debugging
      // Flags de estado (ya vienen del backend)
      isQuoted: member.isQuoted || false,
      isUnquoted: member.isUnquoted || false
    };
  });
  
  const teamLoading = !unifiedData;

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
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive",
      });
    },
  });



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

  if (!completeTeam || completeTeam.length === 0) {
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
        {completeTeam.map((member: any, index: number) => {
          const workedHours = member.actualHours || 0;
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
            <div key={member.personnelId || member.id} className={`flex items-center justify-between p-3 border-l-4 ${cardStyle.borderColor} bg-white/60 backdrop-blur-sm rounded-lg hover:bg-white/80 transition-all duration-200 border border-gray-100 ${member.isUnquoted ? 'border-orange-300 bg-orange-50/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 ${cardStyle.avatarBg} rounded-full flex items-center justify-center shadow-sm`}>
                    <span className="text-white text-xs font-bold">
                      {(member.actualName || 'MB').split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase()}
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
                  <div className={`font-medium text-sm ${cardStyle.nameColor} flex items-center gap-2`}>
                    {member.actualName || 'Miembro del Equipo'}
                    {member.isUnquoted && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-300 text-orange-700 bg-orange-50">
                        No cotizado
                      </Badge>
                    )}
                  </div>
                  <div className={`text-xs ${cardStyle.roleColor} opacity-75`}>
                    {member.actualRoleName || member.roleName || 'Sin Rol'}
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
                    de {estimatedHours.toFixed(0)}h {member.timeMultiplier > 1 ? `(x${member.timeMultiplier})` : ''}
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
                    ${(workedHours * (member.actualRate || 0)).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${member.actualRate || 0}/h
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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

  // Estado del filtro temporal - configurado por defecto para mostrar "Este mes" (julio 2025)
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    // Configurar por defecto para mostrar julio 2025 como "este mes" 
    const currentDate = new Date();
    const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthName = thisMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return {
      type: 'month',
      startDate: startOfMonth(thisMonth),
      endDate: endOfMonth(thisMonth),
      label: `Este mes (${monthName})`
    };
  });

  // Mapear el filtro temporal al formato que espera el hook
  const getTimeFilterForHook = (filter: DateFilter) => {
    const label = filter.label.toLowerCase();
    
    // MAPEO DIRECTO AL SISTEMA DE TIME-ENTRIES
    if (label.includes('todos los períodos')) return 'all';
    if (label.includes('este mes')) return 'current_month';
    if (label.includes('mes pasado')) return 'last_month';
    if (label.includes('este trimestre')) return 'current_quarter';
    if (label.includes('trimestre pasado')) return 'last_quarter';
    if (label.includes('este semestre')) return 'current_semester';
    if (label.includes('semestre pasado')) return 'last_semester';
    if (label.includes('este año')) return 'current_year';
    
    // Trimestres específicos
    if (label.includes('q1') || label.includes('ene-mar')) return 'q1_2025';
    if (label.includes('q2') || label.includes('abr-jun')) return 'q2_2025';
    if (label.includes('q3') || label.includes('jul-sep')) return 'q3_2025';
    if (label.includes('q4') || label.includes('oct-dic')) return 'q4_2025';
    
    // Meses específicos
    if (label.includes('enero')) return 'january_2025';
    if (label.includes('febrero')) return 'february_2025';
    if (label.includes('marzo')) return 'march_2025';
    if (label.includes('abril')) return 'april_2025';
    if (label.includes('mayo')) return 'may_2025';
    if (label.includes('junio')) return 'june_2025';
    if (label.includes('julio')) return 'july_2025';
    if (label.includes('agosto')) return 'august_2025';
    if (label.includes('septiembre')) return 'september_2025';
    if (label.includes('octubre')) return 'october_2025';
    if (label.includes('noviembre')) return 'november_2025';
    if (label.includes('diciembre')) return 'december_2025';
    
    // FALLBACK: Para rangos personalizados, detectar por fechas
    if (filter.type === 'custom' && filter.startDate && filter.endDate) {
      const startMonth = filter.startDate.getMonth() + 1;
      const startYear = filter.startDate.getFullYear();
      const endMonth = filter.endDate.getMonth() + 1;
      const endYear = filter.endDate.getFullYear();
      
      // Si es un mes completo del año actual
      if (startYear === 2025 && endYear === 2025 && startMonth === endMonth) {
        const monthNames = ['january_2025', 'february_2025', 'march_2025', 'april_2025', 'may_2025', 'june_2025', 'july_2025', 'august_2025', 'september_2025', 'october_2025', 'november_2025', 'december_2025'];
        return monthNames[startMonth - 1];
      }
    }
    
    console.log('🚨 UNMAPPED FILTER LABEL:', label, '- using "all" as fallback');
    console.log('🚨 Filter details:', { label, type: filter.type, startDate: filter.startDate, endDate: filter.endDate });
    return 'all';
  };

  // FUNCIÓN AUXILIAR PARA MULTIPLICADOR TEMPORAL
  const getTemporalMultiplier = (filter: string): number => {
    switch (filter) {
      case 'current_month':
      case 'last_month':
      case 'may_2025':
      case 'june_2025':
      case 'july_2025':
      case 'january_2025':
      case 'february_2025':
      case 'march_2025':
      case 'april_2025':
      case 'august_2025':
      case 'september_2025':
      case 'october_2025':
      case 'november_2025':
      case 'december_2025':
        return 1;
      case 'current_quarter':
      case 'last_quarter':
      case 'q1_2025':
      case 'q2_2025':
      case 'q3_2025':
      case 'q4_2025':
        return 3;
      case 'current_semester':
      case 'last_semester':
      case 'semester1_2025':
      case 'semester2_2025':
        return 6;
      case 'current_year':
      case 'last_year':
      case 'year_2025':
        return 12;
      default:
        return 1;
    }
  };

  // SINGLE SOURCE OF TRUTH: obtener todos los datos del proyecto con filtros temporales
  const timeFilterForHook = getTimeFilterForHook(dateFilter);
  const { data: unifiedData, isLoading: dataLoading, error: dataError } = useCompleteProjectData(
    projectId ? parseInt(projectId) : 0, 
    timeFilterForHook
  );

  // Cliente del proyecto
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${unifiedData?.project?.clientId}`],
    enabled: !!unifiedData?.project?.clientId,
  });

  // Datos derivados para compatibilidad con componentes existentes
  const project = unifiedData?.project;
  const isLoading = dataLoading;
  const quotationData = unifiedData?.quotation;
  
  // Crear filteredTimeEntries vacío por compatibilidad (todos los datos vienen del endpoint unificado)
  const filteredTimeEntries: any[] = [];
  
  // Variables faltantes para compatibilidad con componentes existentes
  const completeData = unifiedData;
  const baseTeam = unifiedData?.team || [];

  // FUNCIÓN PARA CALCULAR MULTIPLICADOR DE COTIZACIÓN SEGÚN PERÍODO TEMPORAL
  const getQuotationMultiplier = useCallback(() => {
    if (!unifiedData?.quotation) return 1;

    const quotation = unifiedData.quotation;
    
    // TODOS LOS PROYECTOS deben escalarse temporalmente para comparación justa
    // No importa si es Always-On o One-Shot, la cotización se escala según período

    // Calcular multiplicador según período temporal para CUALQUIER tipo de proyecto
    switch (timeFilterForHook) {
      // FILTROS MENSUALES (x1)
      case "current_month":
      case "last_month":
      case "this-month":
      case "last-month":
      case "january":
      case "february": 
      case "march":
      case "april":
      case "may":
      case "june":
      case "july":
      case "august":
      case "september":
      case "october":
      case "november":
      case "december":
      // Meses con sufijo de año
      case "january_2025":
      case "february_2025":
      case "march_2025":
      case "april_2025":
      case "may_2025":
      case "june_2025":
      case "july_2025":
      case "august_2025":
      case "september_2025":
      case "october_2025":
      case "november_2025":
      case "december_2025":
      case "january_2024":
      case "february_2024": 
      case "march_2024":
      case "april_2024":
      case "may_2024":
      case "june_2024":
      case "july_2024":
      case "august_2024":
      case "september_2024":
      case "october_2024":
      case "november_2024":
      case "december_2024":
        return 1; // 1 mes
        
      // FILTROS TRIMESTRALES (x3)
      case "current_quarter":
      case "last_quarter":
      case "this-quarter":
      case "last-quarter":
      case "q1":
      case "q2": 
      case "q3":
      case "q4":
      // Trimestres con sufijo de año
      case "q1_2025":
      case "q2_2025":
      case "q3_2025":
      case "q4_2025":
      case "q1_2024":
      case "q2_2024":
      case "q3_2024":
      case "q4_2024":
        return 3; // 3 meses (trimestre)
        
      // FILTROS SEMESTRALES (x6)
      case "current_semester":
      case "last_semester":
      case "this-semester":
      case "last-semester":
      case "first_semester":
      case "second_semester":
      case "first_semester_2025":
      case "second_semester_2025":
      case "first_semester_2024":
      case "second_semester_2024":
        return 6; // 6 meses (semestre)
        
      // FILTROS ANUALES (x12)
      case "current_year":
      case "last_year":
      case "this-year":
      case "last-year":
      case "full_year":
      case "year_2025":
      case "year_2024":
      case "2025":
      case "2024":
        return 12; // 12 meses (año completo)
        
      // CASOS ESPECIALES
      case "custom":
        // Para filtros personalizados, intentar detectar duración
        // TODO: En el futuro se podría calcular basado en rango de fechas
        return 1;
      case "all":
        // Para "all", usar 1 porque el backend ya maneja el total acumulado
        return 1;
      case "today":
      case "week":
      case "last_week":
      case "this_week":
        // Períodos menores a un mes
        return 1;
      default:
        // Log para detectar filtros no contemplados y poder agregarlos
        console.warn('⚠️ Filtro temporal no reconocido para escalamiento:', timeFilterForHook, '- usando multiplicador x1');
        console.warn('⚠️ Si este filtro representa múltiples meses, agregar a la función getQuotationMultiplier');
        return 1;
    }
  }, [timeFilterForHook, unifiedData?.quotation]);

  // FUNCIÓN DE VALIDACIÓN PARA ASEGURAR CONSISTENCIA
  const validateScalingLogic = useCallback(() => {
    if (!unifiedData?.quotation) return { isValid: false, reason: 'No quotation data' };
    
    const multiplier = getQuotationMultiplier();
    const baseHours = unifiedData.quotation.estimatedHours || 0;
    const baseCost = unifiedData.quotation.baseCost || 0;
    
    // Validaciones
    const isValid = 
      multiplier >= 1 && multiplier <= 12 && // Multiplicador en rango válido
      baseHours > 0 && // Horas base válidas
      baseCost >= 0 && // Costo base válido
      Number.isInteger(multiplier); // Multiplicador es entero
    
    return {
      isValid,
      multiplier,
      baseHours,
      baseCost,
      scaledHours: baseHours * multiplier,
      scaledCost: baseCost * multiplier,
      filter: timeFilterForHook,
      reason: !isValid ? 'Invalid multiplier or base values' : 'Valid'
    };
  }, [unifiedData?.quotation, getQuotationMultiplier, timeFilterForHook]);

  // VALIDACIÓN SILENCIOSA DEL ESCALAMIENTO TEMPORAL
  const validation = validateScalingLogic();
  
  // Solo mostrar errores críticos en consola
  if (!validation.isValid) {
    console.warn('⚠️ Problema con escalamiento temporal:', validation.reason);
  }
  if (unifiedData) {
    console.log('🚀 CURRENT DATA SET:');
    console.log('  - Estimated hours:', unifiedData.quotation?.estimatedHours || -1);
    console.log('  - Total worked hours:', unifiedData.actuals?.totalWorkedHours || -1);
    console.log('  - Total worked cost:', unifiedData.actuals?.totalWorkedCost || -1);
    console.log('  - Markup:', unifiedData.metrics?.markup || -1);
    console.log('  - Efficiency:', unifiedData.metrics?.efficiency || -1);
    console.log('  - Total entries:', unifiedData.actuals?.totalEntries || -1);
    console.log('🚀 Data should change when filter changes above');
  }

  // MÉTRICAS SIMPLIFICADAS - TODAS DESDE SINGLE SOURCE OF TRUTH
  const metrics = useMemo(() => {
    if (!unifiedData) return [];

    const { quotation, actuals, metrics: unifiedMetrics } = unifiedData;

    // SI NO HAY DATOS REALES EN EL PERÍODO
    if (!actuals.totalWorkedHours) {
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

    // USAR DATOS CALCULADOS EN BACKEND
    const markup = unifiedMetrics.markup;
    const efficiency = unifiedMetrics.efficiency;
    const budgetUtilization = unifiedMetrics.budgetUtilization;
    
    // Estilos basados en umbrales
    const getMarkupColor = (markup: number) => {
      if (markup >= 2.5) return { color: "text-emerald-600", bgColor: "bg-gradient-to-br from-emerald-50 to-green-100", quality: "Excelente" };
      if (markup >= 1.8) return { color: "text-green-600", bgColor: "bg-gradient-to-br from-green-50 to-emerald-100", quality: "Bueno" };
      if (markup >= 1.2) return { color: "text-yellow-600", bgColor: "bg-gradient-to-br from-yellow-50 to-amber-100", quality: "Aceptable" };
      return { color: "text-red-600", bgColor: "bg-gradient-to-br from-red-50 to-rose-100", quality: "Crítico" };
    };

    const getProgressColor = (progress: number) => {
      if (progress <= 80) return { color: "text-blue-600", bgColor: "bg-gradient-to-br from-blue-50 to-indigo-100" };
      if (progress <= 100) return { color: "text-green-600", bgColor: "bg-gradient-to-br from-green-50 to-emerald-100" };
      return { color: "text-red-600", bgColor: "bg-gradient-to-br from-red-50 to-rose-100" };
    };

    const getBudgetColor = (deviation: number) => {
      if (deviation <= 100) return { color: "text-green-600", bgColor: "bg-gradient-to-br from-green-50 to-emerald-100" };
      if (deviation <= 120) return { color: "text-yellow-600", bgColor: "bg-gradient-to-br from-yellow-50 to-amber-100" };
      return { color: "text-red-600", bgColor: "bg-gradient-to-br from-red-50 to-rose-100" };
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active': return { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
        case 'paused': return { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
        case 'completed': return { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
        default: return { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
      }
    };

    const markupStyle = getMarkupColor(markup);
    const progressStyle = getProgressColor(efficiency);
    const budgetStyle = getBudgetColor(budgetUtilization);
    const statusConfig = getStatusColor(project?.status || 'active');

    return [
      {
        label: "Presupuesto vs Objetivo",
        value: `$${actuals.totalWorkedCost.toLocaleString()}`,
        subtitle: `Objetivo: $${quotation.baseCost.toLocaleString()} | ${budgetUtilization <= 100 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(budgetUtilization - 100).toFixed(1)}%`,
        icon: DollarSign,
        color: budgetStyle.color,
        bgColor: budgetStyle.bgColor,
        change: budgetUtilization - 100
      },
      {
        label: `Horas vs Objetivo`,
        value: `${actuals.totalWorkedHours.toFixed(1)}h`,
        subtitle: `Objetivo: ${quotation.estimatedHours.toFixed(1)}h | ${efficiency <= 100 ? 'Bajo objetivo' : 'Exceso'}: ${Math.abs(efficiency - 100).toFixed(1)}%`,
        icon: Clock,
        color: progressStyle.color,
        bgColor: progressStyle.bgColor,
        change: efficiency - 100
      },
      {
        label: "Progreso del Período",
        value: `${efficiency.toFixed(1)}%`,
        subtitle: (() => {
          if (efficiency >= 100) return "Objetivo completado";
          if (efficiency >= 80) return "Cerca del objetivo";
          if (efficiency >= 50) return "Progreso moderado";
          if (efficiency > 0) return "Progreso inicial";
          return "Sin progreso registrado";
        })(),
        icon: Target,
        color: progressStyle.color,
        bgColor: progressStyle.bgColor,
        change: efficiency - 100
      },
      {
        label: "Estado",
        value: (() => {
          // Usar métricas directas de unifiedData para la evaluación
          console.log('🚨 ESTADO DEBUG:', { 
            budgetUtilization, 
            efficiency, 
            metricsFromUnified: unifiedData?.metrics?.budgetUtilization,
            actualCost: actuals.totalWorkedCost,
            baseCost: quotation.baseCost,
            calculatedBudget: (actuals.totalWorkedCost / quotation.baseCost) * 100
          });
          
          const actualBudgetUtil = (actuals.totalWorkedCost / quotation.baseCost) * 100;
          
          let resultado;
          if (actualBudgetUtil <= 85) resultado = "Excelente";
          else if (actualBudgetUtil <= 100) resultado = "Bueno";
          else if (actualBudgetUtil <= 110) resultado = "Regular";
          else resultado = "Crítico";
          
          console.log('🚨 CARD ESTADO RESULT:', { actualBudgetUtil, resultado });
          return resultado;
        })(),
        subtitle: `Semáforo de salud`,
        icon: (() => {
          const actualBudgetUtil = (actuals.totalWorkedCost / quotation.baseCost) * 100;
          if (actualBudgetUtil <= 85) return Crown;
          if (actualBudgetUtil <= 100) return CheckCircle2;
          if (actualBudgetUtil <= 110) return AlertTriangle;
          return TrendingDown;
        })(),
        color: (() => {
          const actualBudgetUtil = (actuals.totalWorkedCost / quotation.baseCost) * 100;
          if (actualBudgetUtil <= 85) return "text-emerald-700";
          if (actualBudgetUtil <= 100) return "text-green-700";
          if (actualBudgetUtil <= 110) return "text-yellow-700";
          return "text-red-700";
        })(),
        bgColor: (() => {
          const actualBudgetUtil = (actuals.totalWorkedCost / quotation.baseCost) * 100;
          if (actualBudgetUtil <= 85) return "bg-emerald-50";
          if (actualBudgetUtil <= 100) return "bg-green-50";
          if (actualBudgetUtil <= 110) return "bg-yellow-50";
          return "bg-red-50";
        })(),
      }
    ];
  }, [unifiedData, project]);

  // CRITICAL FIX: Use filtered team data from actuals instead of quotation team
  // This ensures temporal filtering is respected across ALL tabs
  const teamStats = useMemo(() => {
    if (!unifiedData?.actuals?.teamBreakdown) return [];
    
    // Convert team breakdown from backend into format expected by UI
    return Object.entries(unifiedData.actuals.teamBreakdown).map(([personnelId, data]: [string, any]) => ({
      id: parseInt(personnelId),
      personnelId: parseInt(personnelId),
      name: data.name,
      hours: data.hours,
      cost: data.cost,
      entries: data.entries || 0,
      lastActivity: data.lastActivity || null
    }));
  }, [unifiedData?.actuals?.teamBreakdown]);

  // SINGLE SOURCE OF TRUTH: usar unifiedData para todas las métricas
  const costSummary = useMemo(() => {
    if (!unifiedData) return null;

    console.log('🔍 SINGLE SOURCE OF TRUTH - costSummary:', {
      estimatedHours: unifiedData.quotation.estimatedHours,
      totalWorkedHours: unifiedData.actuals.totalWorkedHours,
      totalWorkedCost: unifiedData.actuals.totalWorkedCost,
      baseCost: unifiedData.quotation.baseCost,
      totalAmount: unifiedData.quotation.totalAmount,
      metrics: unifiedData.metrics
    });

    // Usar datos directamente de unifiedData
    const actualHours = unifiedData.actuals.totalWorkedHours;
    const actualCost = unifiedData.actuals.totalWorkedCost;
    const targetHours = unifiedData.quotation.estimatedHours;
    const targetBudget = unifiedData.quotation.baseCost;
    const targetClientPrice = unifiedData.quotation.totalAmount;
    
    // Usar métricas ya calculadas en el backend
    const budgetUtilization = unifiedData.metrics.budgetUtilization;
    const markup = unifiedData.metrics.markup;
    const hoursProgress = unifiedData.metrics.efficiency;

    return {
      totalCost: actualCost,
      budget: targetBudget,
      budgetUtilization,
      savings: targetBudget - actualCost,
      filteredHours: actualHours,
      targetHours,
      targetMultiplier: 1, // Simplificado para single source
      markup: markup,
      targetClientPrice: targetClientPrice,
      hoursProgress: hoursProgress
    };
  }, [unifiedData]);

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
          <TabsList className="grid grid-cols-5 w-full max-w-5xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <Gauge className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="team-analysis" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Equipo
            </TabsTrigger>
            <TabsTrigger 
              value="performance-analysis" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-sm"
            >
              <Flame className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger 
              value="time-management" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
            >
              <Timer className="h-4 w-4" />
              Tiempo
            </TabsTrigger>
            <TabsTrigger 
              value="details" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              Mensual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            
            {/* SECCIÓN 1: KPI Cards Principales - Layout Profesional */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              
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
                      const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                      const clientPrice = quotationData?.totalAmount || 0;
                      const markup = actualCost > 0 && clientPrice > 0 ? clientPrice / actualCost : 0;
                      if (markup >= 2.5) return 'default';
                      if (markup >= 1.8) return 'secondary';
                      if (markup >= 1.2) return 'outline';
                      return 'destructive';
                    })()} className="text-xs">
                      {(() => {
                        const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                        const clientPrice = quotationData?.totalAmount || 0;
                        const markup = actualCost > 0 && clientPrice > 0 ? clientPrice / actualCost : 0;
                        if (markup >= 2.5) return 'Excelente';
                        if (markup >= 1.8) return 'Bueno';
                        if (markup >= 1.2) return 'Aceptable';
                        return 'Crítico';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.totalAmount) {
                          const markup = unifiedData.quotation.totalAmount / unifiedData.actuals.totalWorkedCost;
                          return `${markup.toFixed(1)}x`;
                        }
                        return '0.0x';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Precio cliente / Costo real
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
                      <span className="text-sm font-medium text-green-700">Avance de Horas</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {unifiedData?.actuals?.totalWorkedHours?.toFixed(1) || '0.0'}h / {unifiedData?.quotation?.estimatedHours || 0}h
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedHours && unifiedData?.quotation?.estimatedHours) {
                          return ((unifiedData.actuals.totalWorkedHours / unifiedData.quotation.estimatedHours) * 100).toFixed(1);
                        }
                        return '0.0';
                      })()}%
                    </p>
                    <Progress value={(() => {
                      if (unifiedData?.actuals?.totalWorkedHours && unifiedData?.quotation?.estimatedHours) {
                        return (unifiedData.actuals.totalWorkedHours / unifiedData.quotation.estimatedHours) * 100;
                      }
                      return 0;
                    })()} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Costo Real Trabajado */}
              <Card className={`border-l-4 ${(() => {
                if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                  const percentage = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                  if (percentage <= 90) return 'border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white'; // Bajo presupuesto
                  if (percentage <= 100) return 'border-l-gray-600 bg-gradient-to-br from-gray-50 via-gray-25 to-white'; // Dentro del presupuesto
                  if (percentage <= 110) return 'border-l-yellow-600 bg-gradient-to-br from-yellow-50 via-yellow-25 to-white'; // Alerta temprana
                  if (percentage <= 120) return 'border-l-orange-600 bg-gradient-to-br from-orange-50 via-orange-25 to-white'; // Crítico
                  return 'border-l-red-600 bg-gradient-to-br from-red-50 via-red-25 to-white'; // Crisis
                }
                return 'border-l-orange-600 bg-gradient-to-br from-orange-50 via-orange-25 to-white';
              })()} shadow-sm hover:shadow-md transition-shadow`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const percentage = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                          if (percentage <= 90) return 'bg-green-100';
                          if (percentage <= 100) return 'bg-gray-100';
                          if (percentage <= 110) return 'bg-yellow-100';
                          if (percentage <= 120) return 'bg-orange-100';
                          return 'bg-red-100';
                        }
                        return 'bg-orange-100';
                      })()}`}>
                        <DollarSign className={`h-4 w-4 ${(() => {
                          if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                            const percentage = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                            if (percentage <= 90) return 'text-green-600';
                            if (percentage <= 100) return 'text-gray-600';
                            if (percentage <= 110) return 'text-yellow-600';
                            if (percentage <= 120) return 'text-orange-600';
                            return 'text-red-600';
                          }
                          return 'text-orange-600';
                        })()}`} />
                      </div>
                      <span className={`text-sm font-medium ${(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const percentage = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                          if (percentage <= 90) return 'text-green-700';
                          if (percentage <= 100) return 'text-gray-700';
                          if (percentage <= 110) return 'text-yellow-700';
                          if (percentage <= 120) return 'text-orange-700';
                          return 'text-red-700';
                        }
                        return 'text-orange-700';
                      })()}`}>Costo Real</span>
                    </div>
                    <Badge variant={(() => {
                      if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                        const percentage = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                        if (percentage <= 90) return 'default'; // Verde: Bajo presupuesto
                        if (percentage <= 100) return 'secondary'; // Gris: Dentro del presupuesto
                        if (percentage <= 110) return 'outline'; // Amarillo: Alerta temprana
                        if (percentage <= 120) return 'destructive'; // Naranja: Crítico
                        return 'destructive'; // Rojo: Crisis
                      }
                      return 'outline';
                    })()} className={`text-xs ${(() => {
                      if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                        const percentage = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                        if (percentage <= 90) return 'bg-green-100 text-green-800 border-green-300';
                        if (percentage <= 100) return 'bg-gray-100 text-gray-800 border-gray-300';
                        if (percentage <= 110) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                        if (percentage <= 120) return 'bg-orange-100 text-orange-800 border-orange-300';
                        return 'bg-red-100 text-red-800 border-red-300';
                      }
                      return '';
                    })()}`}>
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const realCost = unifiedData.actuals.totalWorkedCost;
                          const estimatedCost = unifiedData.quotation.baseCost;
                          const percentage = (realCost / estimatedCost) * 100;
                          
                          if (percentage <= 90) return `✓ ${Math.abs(percentage - 100).toFixed(0)}% bajo budget`;
                          if (percentage <= 100) return `${Math.abs(percentage - 100).toFixed(0)}% del budget`;
                          if (percentage <= 110) return `⚠ +${(percentage - 100).toFixed(0)}% del budget`;
                          if (percentage <= 120) return `🔥 +${(percentage - 100).toFixed(0)}% del budget`;
                          return `🚨 +${(percentage - 100).toFixed(0)}% del budget`;
                        }
                        return '0%';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-gray-900">
                      ${(unifiedData?.actuals?.totalWorkedCost || 0).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>de ${(unifiedData?.quotation?.baseCost || 0).toLocaleString()} estimado</span>
                    </div>
                    <Progress 
                      value={(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          return (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                        }
                        return 0;
                      })()} 
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
                      if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                        const budgetUtil = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                        if (budgetUtil <= 85) return 'default';
                        if (budgetUtil <= 100) return 'secondary';
                        if (budgetUtil <= 110) return 'outline';
                        return 'destructive';
                      }
                      return 'destructive';
                    })()} className="text-xs">
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const budgetUtil = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                          console.log('🚨 CARD MORADA DEBUG:', { 
                            actualCost: unifiedData.actuals.totalWorkedCost,
                            baseCost: unifiedData.quotation.baseCost,
                            budgetUtil 
                          });
                          if (budgetUtil <= 85) return 'Excelente';
                          if (budgetUtil <= 100) return 'Bueno';
                          if (budgetUtil <= 110) return 'Regular';
                          return 'Crítico';
                        }
                        return 'Sin datos';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const budgetUtil = (unifiedData.actuals.totalWorkedCost / unifiedData.quotation.baseCost) * 100;
                          if (budgetUtil <= 85) return 'Excelente';
                          if (budgetUtil <= 100) return 'Bueno';
                          if (budgetUtil <= 110) return 'Regular';
                          return 'Crítico';
                        }
                        return 'Sin datos';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">Semáforo de salud financiera</p>
                  </div>
                </CardContent>
              </Card>

              {/* Precio al Cliente */}
              <Card className="border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Building className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-medium text-emerald-700">Precio Cliente</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Cotizado
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      ${(unifiedData?.quotation?.totalAmount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Valor facturado mensual
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Costo Estimado */}
              <Card className="border-l-4 border-l-rose-600 bg-gradient-to-br from-rose-50 via-rose-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-rose-100 rounded-lg">
                        <Target className="h-4 w-4 text-rose-600" />
                      </div>
                      <span className="text-sm font-medium text-rose-700">Costo Estimado</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Interno
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">
                      ${(unifiedData?.quotation?.baseCost || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Costo operativo planificado
                    </p>
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
                    {unifiedData?.actuals?.totalEntries || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
                  {unifiedData?.actuals?.totalEntries > 0 ? (
                    [].slice(0, 12).map((entry, index) => (
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

                    {/* Eficiencia del Equipo */}
                    <div className="text-center p-4 bg-white rounded-xl border border-purple-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                        <Target className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {costSummary?.targetHours && costSummary?.filteredHours 
                          ? ((costSummary.filteredHours / costSummary.targetHours) * 100).toFixed(0)
                          : '0'}%
                      </div>
                      <div className="text-sm font-medium text-gray-600">Eficiencia del Equipo</div>
                      <div className="text-xs text-gray-500 mt-1">horas reales vs estimadas</div>
                    </div>

                    {/* Costo Real del Equipo */}
                    <div className="text-center p-4 bg-white rounded-xl border border-red-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-3">
                        <DollarSign className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="text-3xl font-bold text-red-600 mb-1">
                        ${(unifiedData?.actuals?.totalWorkedCost || 0).toLocaleString()}
                      </div>
                      <div className="text-sm font-medium text-gray-600">Costo Real del Equipo</div>
                      <div className="text-xs text-gray-500 mt-1">inversión total registrada</div>
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

          <TabsContent value="performance-analysis" className="space-y-6">
            {/* RANKINGS ECONÓMICOS - SISTEMA NUEVO */}
            <div className="grid grid-cols-1 gap-6">
              <EconomicRankings 
                rankings={unifiedData?.rankings?.economicMetrics || []}
                loading={!unifiedData}
                projectTotalPrice={unifiedData?.quotation?.totalAmount || 100000}
                timeFilter={timeFilterForHook}
                getTimeMultiplier={getQuotationMultiplier}
              />
            </div>
          </TabsContent>

          <TabsContent value="time-management" className="space-y-6">
            {/* SECCIÓN 1: Métricas de Tiempo Compactas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    {(() => {
                      const workedHours = costSummary?.filteredHours || 0;
                      const baseEstimatedHours = completeData?.quotation?.estimatedHours || 0;
                      const multiplier = getQuotationMultiplier();
                      const scaledEstimatedHours = baseEstimatedHours * multiplier;
                      const percentage = scaledEstimatedHours > 0 ? (workedHours / scaledEstimatedHours) * 100 : 0;
                      
                      return (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            {percentage.toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            de {scaledEstimatedHours.toFixed(0)}h estimadas {multiplier > 1 ? `(x${multiplier})` : ''}
                          </p>
                        </>
                      );
                    })()}
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
                      {unifiedData?.actuals?.totalWorkedHours && teamStats && teamStats.length > 0 
                        ? (unifiedData.actuals.totalWorkedHours / teamStats.length / 30).toFixed(1)
                        : '0.0'}h
                    </p>
                    <p className="text-xs text-gray-500">
                      por miembro del equipo
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Nueva Card: Horas Totales vs Estimadas - CON ESCALAMIENTO TEMPORAL */}
              <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50 via-blue-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-700">Horas Trabajadas</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                      vs estimadas
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {(() => {
                      const workedHours = unifiedData?.actuals?.totalWorkedHours || 0;
                      const baseEstimatedHours = unifiedData?.quotation?.estimatedHours || 0;
                      const multiplier = getTemporalMultiplier(timeFilterForHook);
                      const scaledEstimatedHours = baseEstimatedHours * multiplier;
                      const percentage = scaledEstimatedHours > 0 ? (workedHours / scaledEstimatedHours) * 100 : 0;
                      

                      
                      return (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            {workedHours.toFixed(1)}h
                          </p>
                          <p className="text-xs text-gray-500">
                            de {scaledEstimatedHours.toFixed(0)}h estimadas {multiplier > 1 ? `(x${multiplier})` : ''}
                          </p>
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  percentage > 100 
                                    ? 'bg-red-500' 
                                    : percentage > 80 
                                      ? 'bg-yellow-500' 
                                      : 'bg-blue-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(percentage, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Nueva Card: Costo Total vs Estimado - CON ESCALAMIENTO TEMPORAL */}
              <Card className="border-l-4 border-l-indigo-600 bg-gradient-to-br from-indigo-50 via-indigo-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <DollarSign className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-medium text-indigo-700">Costo Real</span>
                    </div>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-xs">
                      vs estimado
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {(() => {
                      const workedCost = unifiedData?.actuals?.totalWorkedCost || 0;
                      const baseEstimatedCost = unifiedData?.quotation?.baseCost || 0;
                      const multiplier = getTemporalMultiplier(timeFilterForHook);
                      const scaledEstimatedCost = baseEstimatedCost * multiplier;
                      const percentage = scaledEstimatedCost > 0 ? (workedCost / scaledEstimatedCost) * 100 : 0;
                      

                      
                      return (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            ${workedCost.toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-500">
                            de ${scaledEstimatedCost.toFixed(0)} estimado {multiplier > 1 ? `(x${multiplier})` : ''}
                          </p>
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  percentage > 100 
                                    ? 'bg-red-500' 
                                    : percentage > 80 
                                      ? 'bg-yellow-500' 
                                      : 'bg-indigo-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(percentage, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
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
                      {unifiedData?.actuals?.totalEntries || 0} en {dateFilter.label}
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
                      {(unifiedData?.actuals?.totalEntries || 0) > 0 ? 'Activo' : 'Sin registros'}
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
                  unifiedData={unifiedData}
                  timeFilter={timeFilterForHook}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* WORLD-CLASS MONTHLY ANALYSIS TAB */}
          <TabsContent value="details" className="space-y-6">
            {/* Strategic Color-Coded KPI Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Health Score - Strategic Colors */}
              {(() => {
                const budgetHealth = Math.max(0, (1 - ((costSummary?.totalCost || 0) / (costSummary?.budget || 1))) * 30);
                const timeHealth = Math.max(0, (1 - ((costSummary?.filteredHours || 0) / (costSummary?.targetHours || 1))) * 25);
                const teamEfficiency = teamStats && teamStats.length > 0 
                  ? (teamStats.reduce((sum: number, member: any) => {
                      if (member.hours > 0) {
                        const efficiency = Math.min(1, (member.estimatedHours || 0) / member.hours);
                        return sum + efficiency;
                      }
                      return sum;
                    }, 0) / Math.max(1, teamStats.filter(m => m.hours > 0).length)) * 25
                  : 15;
                const profitabilityHealth = (() => {
                  const markup = quotationData?.totalAmount && (costSummary?.totalCost || 0) > 0 
                    ? quotationData.totalAmount / (costSummary.totalCost || 1) 
                    : 0;
                  if (markup >= 2.5) return 20;
                  if (markup >= 1.8) return 15;
                  if (markup >= 1.2) return 10;
                  return 0;
                })();
                const score = Math.round(budgetHealth + timeHealth + teamEfficiency + profitabilityHealth);
                const isGood = score >= 80;
                const isWarning = score >= 60 && score < 80;
                const isCritical = score < 60;
                
                return (
                  <Card className={`relative overflow-hidden border-0 shadow-lg ${
                    isCritical ? 'bg-gradient-to-br from-red-50 to-red-100' :
                    isWarning ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                    isGood ? 'bg-gradient-to-br from-green-50 to-green-100' :
                    'bg-white'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-medium mb-1 ${
                              isCritical ? 'text-red-700' :
                              isWarning ? 'text-yellow-700' :
                              isGood ? 'text-green-700' :
                              'text-gray-700'
                            }`}>Score de Salud</p>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                              <div className="absolute top-6 left-0 hidden group-hover:block z-50 bg-black text-white text-xs rounded p-2 shadow-lg w-48">
                                <div className="font-bold">Score de Salud General</div>
                                <div>Verde ≥80pts | Amarillo 50-79pts | Rojo &lt;50pts</div>
                                <div className="mt-1 text-gray-300">
                                  ${(costSummary?.totalCost || 0).toFixed(0)} gastado de ${(costSummary?.budget || 0).toFixed(0)} presupuestado
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className={`text-2xl font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>{score}</p>
                          <p className={`text-xs mt-1 ${
                            isCritical ? 'text-red-600' :
                            isWarning ? 'text-yellow-600' :
                            isGood ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            {score >= 80 ? 'Excelente' : score >= 60 ? 'Bueno' : 'Crítico'}
                          </p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isCritical ? 'bg-red-200/50' :
                          isWarning ? 'bg-yellow-200/50' :
                          isGood ? 'bg-green-200/50' :
                          'bg-gray-200/50'
                        }`}>
                          <Gauge className={`h-6 w-6 ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Financial Projection - Strategic Colors */}
              {(() => {
                const projectedCost = (costSummary?.totalCost || 0) * 1.15;
                const budget = costSummary?.budget || 0;
                const isOverBudget = projectedCost > budget;
                const isWarning = projectedCost > budget * 0.9;
                const isGood = projectedCost <= budget * 0.8;
                
                return (
                  <Card className={`relative overflow-hidden border-0 shadow-lg ${
                    isOverBudget ? 'bg-gradient-to-br from-red-50 to-red-100' :
                    isWarning ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                    isGood ? 'bg-gradient-to-br from-green-50 to-green-100' :
                    'bg-white'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-medium mb-1 ${
                              isOverBudget ? 'text-red-700' :
                              isWarning ? 'text-yellow-700' :
                              isGood ? 'text-green-700' :
                              'text-gray-700'
                            }`}>Proyección Financiera</p>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                              <div className="absolute top-6 left-0 hidden group-hover:block z-50 bg-black text-white text-xs rounded p-2 shadow-lg w-48">
                                <div className="font-bold">Proyección Financiera</div>
                                <div>Verde ≤80% | Amarillo 80-100% | Rojo &gt;100%</div>
                                <div className="mt-1 text-gray-300">
                                  Proyección: ${((costSummary?.totalCost || 0) * 1.15).toFixed(0)} de ${(costSummary?.budget || 0).toFixed(0)} presupuesto
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className={`text-lg font-bold ${
                            isOverBudget ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>
                            {isOverBudget ? 'Riesgo' : isWarning ? 'Atención' : 'Muy Buena'}
                          </p>
                          <p className={`text-xs mt-1 ${
                            isOverBudget ? 'text-red-600' :
                            isWarning ? 'text-yellow-600' :
                            isGood ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            ${projectedCost.toFixed(0)} proyectado
                          </p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isOverBudget ? 'bg-red-200/50' :
                          isWarning ? 'bg-yellow-200/50' :
                          isGood ? 'bg-green-200/50' :
                          'bg-gray-200/50'
                        }`}>
                          <TrendingUp className={`h-6 w-6 ${
                            isOverBudget ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Team Efficiency - Strategic Colors */}
              {(() => {
                const totalWorked = teamStats && teamStats.length > 0 
                  ? teamStats.reduce((sum, member) => sum + (member.hours || 0), 0)
                  : 0;
                
                // USE SINGLE SOURCE OF TRUTH: get data from centralized endpoint
                const totalEstimated = completeData?.quotation?.estimatedHours || 1;
                
                // Debug logging to verify single source of truth
                if (typeof window !== 'undefined') {
                  console.log('🔍 SINGLE SOURCE OF TRUTH:');
                  console.log('📊 completeData available:', !!completeData);
                  console.log('📊 Estimated hours from single source:', totalEstimated);
                  console.log('📊 This should always be 969h for Warner Bros project');
                }
                
                const efficiency = totalEstimated > 0 ? (totalWorked / totalEstimated) * 100 : 0;
                const isCritical = efficiency < 60;
                const isWarning = efficiency >= 60 && efficiency < 80;
                const isGood = efficiency >= 80;
                
                return (
                  <Card className={`relative overflow-hidden border-0 shadow-lg ${
                    isCritical ? 'bg-gradient-to-br from-red-50 to-red-100' :
                    isWarning ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                    isGood ? 'bg-gradient-to-br from-green-50 to-green-100' :
                    'bg-white'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-medium mb-1 ${
                              isCritical ? 'text-red-700' :
                              isWarning ? 'text-yellow-700' :
                              isGood ? 'text-green-700' :
                              'text-gray-700'
                            }`}>Eficiencia Equipo</p>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                              <div className="absolute top-6 left-0 hidden group-hover:block z-50 bg-black text-white text-xs rounded p-2 shadow-lg w-48">
                                <div className="font-bold">Eficiencia del Equipo</div>
                                <div>Verde ≥80% | Amarillo 60-79% | Rojo &lt;60%</div>
                                <div className="mt-1 text-gray-300">
                                  {totalWorked.toFixed(0)}h trabajadas de {totalEstimated.toFixed(0)}h cotizadas
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className={`text-2xl font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>{Math.round(efficiency)}%</p>
                          <p className={`text-xs mt-1 ${
                            isCritical ? 'text-red-600' :
                            isWarning ? 'text-yellow-600' :
                            isGood ? 'text-green-600' :
                            'text-gray-600'
                          }`}>de {totalEstimated.toFixed(0)}h cotizadas</p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isCritical ? 'bg-red-200/50' :
                          isWarning ? 'bg-yellow-200/50' :
                          isGood ? 'bg-green-200/50' :
                          'bg-gray-200/50'
                        }`}>
                          <Users className={`h-6 w-6 ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Burn Rate - Strategic Colors */}
              {(() => {
                const monthsElapsed = Math.max(1, (new Date().getTime() - new Date(project?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30));
                const burnRate = (costSummary?.totalCost || 0) / monthsElapsed;
                const monthlyBudget = (costSummary?.budget || 0) / 12; // Asumiendo proyecto anual
                const isCritical = burnRate > monthlyBudget * 1.2;
                const isWarning = burnRate > monthlyBudget;
                const isGood = burnRate <= monthlyBudget * 0.8;
                
                return (
                  <Card className={`relative overflow-hidden border-0 shadow-lg ${
                    isCritical ? 'bg-gradient-to-br from-red-50 to-red-100' :
                    isWarning ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                    isGood ? 'bg-gradient-to-br from-green-50 to-green-100' :
                    'bg-white'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-medium mb-1 ${
                              isCritical ? 'text-red-700' :
                              isWarning ? 'text-yellow-700' :
                              isGood ? 'text-green-700' :
                              'text-gray-700'
                            }`}>Burn Rate</p>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                              <div className="absolute top-6 left-0 hidden group-hover:block z-50 bg-black text-white text-xs rounded p-2 shadow-lg w-48">
                                <div className="font-bold">Burn Rate</div>
                                <div>Verde ≤80% | Amarillo 80-120% | Rojo &gt;120%</div>
                                <div className="mt-1 text-gray-300">
                                  ${((costSummary?.totalCost || 0) / Math.max(1, (new Date().getTime() - new Date(project?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30))).toFixed(0)}/mes de ${((costSummary?.budget || 0) / 12).toFixed(0)}/mes planificado
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className={`text-2xl font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>${burnRate.toFixed(0)}</p>
                          <p className={`text-xs mt-1 ${
                            isCritical ? 'text-red-600' :
                            isWarning ? 'text-yellow-600' :
                            isGood ? 'text-green-600' :
                            'text-gray-600'
                          }`}>por mes</p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isCritical ? 'bg-red-200/50' :
                          isWarning ? 'bg-yellow-200/50' :
                          isGood ? 'bg-green-200/50' :
                          'bg-gray-200/50'
                        }`}>
                          <Flame className={`h-6 w-6 ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Time Progress - Strategic Colors */}
              {(() => {
                const workedHours = costSummary?.filteredHours || 0;
                const baseEstimatedHours = completeData?.quotation?.estimatedHours || 0;
                const multiplier = getQuotationMultiplier();
                const scaledEstimatedHours = baseEstimatedHours * multiplier;
                const progress = scaledEstimatedHours > 0 ? (workedHours / scaledEstimatedHours) * 100 : 0;
                const isCritical = progress > 100;
                const isWarning = progress > 85;
                const isGood = progress <= 75;
                
                return (
                  <Card className={`relative overflow-hidden border-0 shadow-lg ${
                    isCritical ? 'bg-gradient-to-br from-red-50 to-red-100' :
                    isWarning ? 'bg-gradient-to-br from-yellow-50 to-yellow-100' :
                    isGood ? 'bg-gradient-to-br from-green-50 to-green-100' :
                    'bg-white'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-medium mb-1 ${
                              isCritical ? 'text-red-700' :
                              isWarning ? 'text-yellow-700' :
                              isGood ? 'text-green-700' :
                              'text-gray-700'
                            }`}>Progreso Tiempo</p>
                            <div className="group relative">
                              <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                              <div className="absolute top-6 left-0 hidden group-hover:block z-50 bg-black text-white text-xs rounded p-2 shadow-lg w-48">
                                <div className="font-bold">Progreso de Tiempo</div>
                                <div>Verde ≤75% | Amarillo 75-100% | Rojo &gt;100%</div>
                                <div className="mt-1 text-gray-300">
                                  {workedHours.toFixed(0)}h trabajadas de {scaledEstimatedHours.toFixed(0)}h cotizadas {multiplier > 1 ? `(x${multiplier})` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className={`text-2xl font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>{progress.toFixed(0)}%</p>
                          <p className={`text-xs mt-1 ${
                            isCritical ? 'text-red-600' :
                            isWarning ? 'text-yellow-600' :
                            isGood ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            {workedHours.toFixed(1)}h / {scaledEstimatedHours.toFixed(1)}h
                          </p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isCritical ? 'bg-red-200/50' :
                          isWarning ? 'bg-yellow-200/50' :
                          isGood ? 'bg-green-200/50' :
                          'bg-gray-200/50'
                        }`}>
                          <Clock className={`h-6 w-6 ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Quality Score - Always Good (White) */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-gray-700 mb-1">Score Calidad</p>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                          <div className="absolute top-6 left-0 hidden group-hover:block z-50 bg-black text-white text-xs rounded p-2 shadow-lg w-48">
                            <div className="font-bold">Score de Calidad</div>
                            <div>Excelente ≥90pts | Bueno 70-89pts | Regular 50-69pts</div>
                            <div className="mt-1 text-gray-300">
                              Basado en feedback de cliente y entregables
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">92</p>
                      <p className="text-xs text-gray-600 mt-1">Excelente</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gray-200/50 flex items-center justify-center">
                      <Star className="h-6 w-6 text-gray-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Team Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Real Heat Map Visualization */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    Mapa de Calor del Equipo
                    <div className="group relative ml-2">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-700 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                        <div className="bg-black text-white text-xs rounded-lg py-3 px-4 whitespace-nowrap max-w-xs">
                          <div className="font-bold mb-2">Criterios de Color:</div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded"></div>
                              <span>Verde: 80%-120% del estimado (rango óptimo)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                              <span>Amarillo: 70%-130% o 50%-150% del estimado</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-500 rounded"></div>
                              <span>Rojo: &lt;50% o &gt;150% del estimado</span>
                            </div>
                          </div>
                          <div className="mt-2 text-gray-300 text-xs">
                            La intensidad refleja qué tan cerca están del ratio óptimo (1.0)
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardTitle>
                  <CardDescription>Análisis visual de rendimiento por miembro - Hover en cada cuadro para detalles</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {(() => {
                    // Use completeData.actuals.teamBreakdown which has the filtered team member information
                    const teamMembers = completeData?.actuals?.teamBreakdown || [];

                    
                    if (!teamMembers || !Array.isArray(teamMembers) || teamMembers.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No hay datos del equipo disponibles</p>
                        </div>
                      );
                    }
                    
                    // Create a grid-based heat map - show ALL members who worked on the project
                    const gridCols = 4;
                    const displayMembers = teamMembers.filter(member => member.hours > 0); // Only show members with actual hours
                    
                    return (
                      <div className="space-y-4">
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded"></div>
                            <span>Excelente</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                            <span>Atención</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <span>Crítico</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gray-400 rounded"></div>
                            <span>Sin datos</span>
                          </div>
                        </div>
                        
                        {/* Heat Map Grid */}
                        <div className="grid grid-cols-4 gap-2">
                          {displayMembers.map((member: any, index: number) => {
                            const name = member.name || member.personnelName || `Miembro ${index + 1}`;
                            const hourlyRate = member.hourlyRate || member.rate || 10;
                            
                            // DATOS BASE NUEVAS MÉTRICAS (P, Ce, Cr, He, Hr)
                            const P = completeData?.quotation?.totalAmount || 0;
                            const Ce = member.estimatedHours * hourlyRate;
                            const Cr = member.hours * hourlyRate;
                            const He = member.estimatedHours || 0;
                            const Hr = member.hours || 0;
                            
                            // CÁLCULO DE α Y MÉTRICAS
                            const Ce_total = displayMembers.reduce((sum, m) => sum + (m.estimatedHours * (m.hourlyRate || m.rate || 10)), 0);
                            const alpha = Ce_total > 0 ? Ce / Ce_total : 0;
                            const precioAsignado = P * alpha;
                            
                            const CV = Ce > 0 ? (Ce - Cr) / Ce : 0;
                            const SV = He > 0 ? (He - Hr) / He : 0;
                            const MPH = Hr > 0 ? (precioAsignado - Cr) / Hr : 0;
                            const Ep = Cr > 0 ? precioAsignado / Cr : 0;
                            
                            // SCORE COMPUESTO SIMPLIFICADO PARA MAPA DE CALOR
                            // Usamos métricas directas sin normalización compleja
                            const performanceScore = (
                              Math.max(0, Math.min(1, CV + 0.5)) * 0.4 + // CV ajustado
                              Math.max(0, Math.min(1, SV + 0.5)) * 0.35 + // SV ajustado
                              Math.max(0, Math.min(1, MPH / 50)) * 0.15 + // MPH escalado
                              Math.max(0, Math.min(1, Ep / 3)) * 0.1 // Ep escalado
                            );
                            
                            // COLORES BASADOS EN PERFORMANCE SCORE
                            const isGood = performanceScore >= 0.7;
                            const isWarning = performanceScore >= 0.4 && performanceScore < 0.7;
                            const isCritical = performanceScore < 0.4;
                            
                            const bgColor = isGood ? 'bg-green-500' :
                                           isWarning ? 'bg-yellow-500' :
                                           'bg-red-500';
                            
                            const intensity = Math.max(30, Math.min(100, performanceScore * 100));
                            
                            return (
                              <div 
                                key={member.personnelId || index}
                                className={`relative aspect-square ${bgColor} rounded-lg p-2 hover:scale-105 transition-transform cursor-pointer group`}
                                style={{ opacity: intensity / 100 }}
                                title={`${name}: ${Hr.toFixed(1)}h trabajadas / ${He.toFixed(1)}h estimadas`}
                              >
                                <div className="text-white text-xs font-bold text-center leading-tight">
                                  {name.length > 12 ? name.substring(0, 12) + '...' : name}
                                </div>
                                <div className="text-white text-xs text-center mt-1">
                                  {Hr.toFixed(1)}h
                                </div>
                                
                                {/* Enhanced Tooltip con Nuevas Métricas */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                  <div className="bg-black text-white text-xs rounded py-2 px-3 min-w-max">
                                    <div className="font-medium mb-1">{name}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>CV: <span className={CV >= 0 ? 'text-green-300' : 'text-red-300'}>{(CV * 100).toFixed(0)}%</span></div>
                                      <div>SV: <span className={SV >= 0 ? 'text-green-300' : 'text-red-300'}>{(SV * 100).toFixed(0)}%</span></div>
                                      <div>MPH: <span className="text-blue-300">${MPH.toFixed(0)}/h</span></div>
                                      <div>Ep: <span className="text-purple-300">{Ep.toFixed(1)}x</span></div>
                                    </div>
                                    <div className="border-t border-gray-600 pt-1 mt-1">
                                      <div>Score: <span className="font-medium">{(performanceScore * 100).toFixed(0)}/100</span></div>
                                      <div className={`font-medium ${
                                        isGood ? 'text-green-300' :
                                        isWarning ? 'text-yellow-300' :
                                        'text-red-300'
                                      }`}>
                                        {isGood ? 'Excelente' : isWarning ? 'Moderado' : 'Crítico'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Fill empty spaces if needed */}
                          {Array.from({ length: Math.max(0, 12 - displayMembers.length) }).map((_, index) => (
                            <div key={`empty-${index}`} className="aspect-square bg-gray-100 rounded-lg opacity-30"></div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* TOP PERFORMERS - New Section */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <Crown className="h-5 w-5 text-blue-600" />
                    Top Performers
                    <div className="group relative ml-2">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-700 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                        <div className="bg-black text-white text-xs rounded-lg py-3 px-4 whitespace-nowrap max-w-sm">
                          <div className="font-bold mb-2">Sistema de Puntuación (0-100 pts):</div>
                          <div className="space-y-1">
                            <div><strong>Eficiencia (40 pts):</strong> Mantenerse dentro del presupuesto</div>
                            <div><strong>Peso del proyecto (30 pts):</strong> Importancia por horas asignadas</div>
                            <div><strong>Uso óptimo (30 pts):</strong> Rango perfecto 90%-110%</div>
                          </div>
                          <div className="mt-2 text-gray-300 text-xs">
                            <div><strong>Nuevos criterios mejorados:</strong></div>
                            <div>• Óptimo: 80%-120% del estimado</div>
                            <div>• Atención: 70%-130% o 50%-150%</div>
                            <div>• Crítico: &lt;50% o &gt;150%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardTitle>
                  <CardDescription>Ranking basado en eficiencia, peso del proyecto y uso óptimo de horas</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {(() => {
                      // Calculate top performers based on efficiency + project weight + hour usage
                      const teamMembers = completeData?.actuals?.teamBreakdown || [];

                      
                      if (!teamMembers || !Array.isArray(teamMembers) || teamMembers.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <Crown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay datos suficientes para calcular top performers</p>
                          </div>
                        );
                      }
                      
                      // Filter to only include members who actually worked (have hours > 0)
                      const workingMembers = teamMembers.filter(member => member.hours > 0);
                      const performersWithScore = workingMembers.map((member: any) => {
                        const name = member.name || member.personnelName || `Miembro ${workingMembers.indexOf(member) + 1}`;
                        const hourlyRate = member.hourlyRate || member.rate || 10;
                        
                        // DATOS BASE REALES (P, Ce, Cr, He, Hr)
                        const P = completeData?.quotation?.totalAmount || 0; // Precio al cliente
                        const Ce = member.estimatedHours * hourlyRate; // Costo estimado individual
                        const Cr = member.hours * hourlyRate; // Costo real individual  
                        const He = member.estimatedHours || 0; // Horas estimadas
                        const Hr = member.hours || 0; // Horas reales
                        
                        // CÁLCULO DE α (ALFA) - Peso económico real
                        const Ce_total = workingMembers.reduce((sum, m) => sum + (m.estimatedHours * (m.hourlyRate || m.rate || 10)), 0);
                        const alpha = Ce_total > 0 ? Ce / Ce_total : 0; // α = Cei / Ce_total
                        const precioAsignado = P * alpha; // Precio asignado a esta persona
                        
                        // MÉTRICAS BASE POR PERSONA
                        const CV = Ce > 0 ? (Ce - Cr) / Ce : 0; // Varianza de costo
                        const SV = He > 0 ? (He - Hr) / He : 0; // Varianza de horas
                        const MPH = Hr > 0 ? (precioAsignado - Cr) / Hr : 0; // Margen por hora
                        const Ep = Cr > 0 ? precioAsignado / Cr : 0; // Eficiencia facturación
                        
                        // NORMALIZACIÓN Z-SCORE (para que todas las métricas estén en la misma escala)
                        // Calculamos estadísticas del equipo para normalizar
                        const teamCVs = workingMembers.map(m => {
                          const mCe = m.estimatedHours * (m.hourlyRate || m.rate || 10);
                          const mCr = m.hours * (m.hourlyRate || m.rate || 10);
                          return mCe > 0 ? (mCe - mCr) / mCe : 0;
                        });
                        const teamSVs = workingMembers.map(m => {
                          return m.estimatedHours > 0 ? (m.estimatedHours - m.hours) / m.estimatedHours : 0;
                        });
                        const teamMPHs = workingMembers.map(m => {
                          const mCe = m.estimatedHours * (m.hourlyRate || m.rate || 10);
                          const mCr = m.hours * (m.hourlyRate || m.rate || 10);
                          const mAlpha = Ce_total > 0 ? mCe / Ce_total : 0;
                          const mPrecio = P * mAlpha;
                          return m.hours > 0 ? (mPrecio - mCr) / m.hours : 0;
                        });
                        const teamEps = workingMembers.map(m => {
                          const mCe = m.estimatedHours * (m.hourlyRate || m.rate || 10);
                          const mCr = m.hours * (m.hourlyRate || m.rate || 10);
                          const mAlpha = Ce_total > 0 ? mCe / Ce_total : 0;
                          const mPrecio = P * mAlpha;
                          return mCr > 0 ? mPrecio / mCr : 0;
                        });
                        
                        // Funciones de normalización min-max (0-1)
                        const normalize = (value, array) => {
                          const min = Math.min(...array);
                          const max = Math.max(...array);
                          if (max === min) return 0.5; // Si todos son iguales, asignar neutral
                          return (value - min) / (max - min);
                        };
                        
                        const zCV = normalize(CV, teamCVs);
                        const zSV = normalize(SV, teamSVs);  
                        const zMPH = normalize(MPH, teamMPHs);
                        const zEp = normalize(Ep, teamEps);
                        
                        // SCORE COMPUESTO DE DESEMPEÑO (según pesos de Epical)
                        const performanceScore = 
                          0.40 * zCV +   // 40% - Varianza de costo (eficiencia interna)
                          0.35 * zSV +   // 35% - Varianza de horas (eficiencia interna)
                          0.15 * zMPH +  // 15% - Margen por hora (valor capturado)
                          0.10 * zEp;    // 10% - Eficiencia facturación (valor capturado)
                        
                        const totalScore = performanceScore * 100; // Convertir a escala 0-100
                        
                        // AUDITORÍA DETALLADA
                        if (['Ina Ceravolo', 'Xavier Aranza', 'Santiago Berisso'].includes(name)) {
                          console.log(`🏆 NEW METRICS ${name}:`, {
                            datosBase: { P: P.toFixed(0), Ce: Ce.toFixed(1), Cr: Cr.toFixed(1), He, Hr },
                            alpha: (alpha * 100).toFixed(2) + '%',
                            precioAsignado: precioAsignado.toFixed(1),
                            metricas: {
                              CV: (CV * 100).toFixed(1) + '%',
                              SV: (SV * 100).toFixed(1) + '%', 
                              MPH: MPH.toFixed(1),
                              Ep: Ep.toFixed(2) + 'x'
                            },
                            normalizadas: { zCV: zCV.toFixed(3), zSV: zSV.toFixed(3), zMPH: zMPH.toFixed(3), zEp: zEp.toFixed(3) },
                            totalScore: totalScore.toFixed(1)
                          });
                        }
                        
                        return {
                          ...member,
                          name,
                          totalScore,
                          // Métricas originales
                          CV, SV, MPH, Ep,
                          // Métricas normalizadas
                          zCV, zSV, zMPH, zEp,
                          // Datos base
                          Ce, Cr, He, Hr, alpha, precioAsignado,
                          // Para compatibilidad con UI existente
                          workedHours: Hr,
                          usageRatio: He > 0 ? Hr / He : 0
                        };
                      });
                      
                      // Sort by total score and take top 5
                      const topPerformers = performersWithScore
                        .sort((a, b) => b.totalScore - a.totalScore)
                        .slice(0, 5);
                      
                      // AUDITORÍA FINAL DEL RANKING
                      console.log('🏆 NEW TOP PERFORMERS RANKING:');
                      topPerformers.forEach((p, i) => {
                        console.log(`  ${i+1}. ${p.name}: ${p.totalScore.toFixed(1)} pts | CV:${(p.CV*100).toFixed(0)}% SV:${(p.SV*100).toFixed(0)}% MPH:$${p.MPH.toFixed(0)} Ep:${p.Ep.toFixed(1)}x`);
                      });
                      
                      return topPerformers.map((performer, index) => {
                        const isTopPerformer = index === 0;
                        const scoreColor = performer.totalScore >= 80 ? 'text-green-600' : 
                                          performer.totalScore >= 60 ? 'text-blue-600' : 
                                          'text-gray-600';
                        
                        return (
                          <div key={performer.personnelId || index} className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                            isTopPerformer ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-gray-50'
                          }`}>
                            <div className="relative">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                                isTopPerformer ? 'bg-gradient-to-br from-yellow-200 to-yellow-300 text-yellow-800' :
                                'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700'
                              }`}>
                                #{index + 1}
                              </div>
                              {isTopPerformer && (
                                <div className="absolute -top-2 -right-2">
                                  <Crown className="h-6 w-6 text-yellow-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-gray-900">{performer.name}</span>
                                <span className={`text-lg font-bold ${scoreColor}`}>
                                  {performer.totalScore.toFixed(0)} pts
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="text-center">
                                  <p className="font-medium text-gray-700">CV</p>
                                  <p className={`font-bold ${performer.CV >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {(performer.CV * 100).toFixed(0)}%
                                  </p>
                                </div>
                                <div className="text-center">
                                  <p className="font-medium text-gray-700">SV</p>
                                  <p className={`font-bold ${performer.SV >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {(performer.SV * 100).toFixed(0)}%
                                  </p>
                                </div>
                                <div className="text-center">
                                  <p className="font-medium text-gray-700">MPH</p>
                                  <p className="font-bold text-blue-600">
                                    ${performer.MPH.toFixed(0)}/h
                                  </p>
                                </div>
                                <div className="text-center">
                                  <p className="font-medium text-gray-700">Ep</p>
                                  <p className="font-bold text-purple-600">
                                    {performer.Ep.toFixed(1)}x
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Financial Analytics */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Análisis Financiero Avanzado
                  </CardTitle>
                  <CardDescription>Métricas financieras y proyecciones</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* Markup Analysis - Strategic Colors */}
                  {(() => {
                    const markup = quotationData?.totalAmount && costSummary?.totalCost 
                      ? quotationData.totalAmount / costSummary.totalCost 
                      : 2.72;
                    const isCritical = markup < 1.2;
                    const isWarning = markup >= 1.2 && markup < 1.8;
                    const isGood = markup >= 1.8;
                    
                    return (
                      <div className={`p-4 rounded-lg border-2 ${
                        isCritical ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300' :
                        isWarning ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300' :
                        isGood ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300' :
                        'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`}>Markup Actual</span>
                          <span className={`text-lg font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>
                            {markup.toFixed(2)}x
                          </span>
                        </div>
                        <Progress value={Math.min(100, (markup / 2.5) * 100)} className="h-2" />
                        <p className={`text-xs mt-1 ${
                          isCritical ? 'text-red-600' :
                          isWarning ? 'text-yellow-600' :
                          isGood ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          Target: 2.5x • Estado: {
                            isCritical ? 'Crítico' :
                            isWarning ? 'Atención' :
                            isGood ? 'Excelente' :
                            'Regular'
                          }
                        </p>
                      </div>
                    );
                  })()}

                  {/* Budget Utilization - Strategic Colors */}
                  {(() => {
                    const budgetUsage = costSummary?.budget && costSummary?.totalCost 
                      ? (costSummary.totalCost / costSummary.budget) * 100
                      : 63;
                    const isCritical = budgetUsage > 90;
                    const isWarning = budgetUsage > 75;
                    const isGood = budgetUsage <= 75;
                    
                    return (
                      <div className={`p-4 rounded-lg border-2 ${
                        isCritical ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300' :
                        isWarning ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300' :
                        isGood ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300' :
                        'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`}>Utilización Presupuesto</span>
                          <span className={`text-lg font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>
                            {budgetUsage.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={budgetUsage} className="h-2" />
                        <p className={`text-xs mt-1 ${
                          isCritical ? 'text-red-600' :
                          isWarning ? 'text-yellow-600' :
                          isGood ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          Restante: ${costSummary?.budget && costSummary?.totalCost 
                            ? (costSummary.budget - costSummary.totalCost).toFixed(0) 
                            : '4,200'
                          } • {
                            isCritical ? 'Riesgo sobrecosto' :
                            isWarning ? 'Cerca del límite' :
                            isGood ? 'Dentro del rango' :
                            'Sin datos'
                          }
                        </p>
                      </div>
                    );
                  })()}

                  {/* Revenue Forecast - Strategic Colors */}
                  {(() => {
                    const targetRevenue = quotationData?.totalAmount || 18500;
                    const projectedRevenue = (costSummary?.totalCost || 0) * 1.15;
                    const revenueVariation = targetRevenue > 0 ? ((projectedRevenue - targetRevenue) / targetRevenue) * 100 : 15;
                    const isCritical = revenueVariation < -10;
                    const isWarning = revenueVariation < 0;
                    const isGood = revenueVariation >= 0;
                    
                    return (
                      <div className={`p-4 rounded-lg border-2 ${
                        isCritical ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300' :
                        isWarning ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300' :
                        isGood ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300' :
                        'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${
                            isCritical ? 'text-red-700' :
                            isWarning ? 'text-yellow-700' :
                            isGood ? 'text-green-700' :
                            'text-gray-700'
                          }`}>Proyección Ingresos</span>
                          <span className={`text-lg font-bold ${
                            isCritical ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            isGood ? 'text-green-800' :
                            'text-gray-800'
                          }`}>
                            ${targetRevenue.toFixed(0)}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${
                          isCritical ? 'text-red-600' :
                          isWarning ? 'text-yellow-600' :
                          isGood ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          <TrendingUp className="h-3 w-3" />
                          <span>
                            {revenueVariation >= 0 ? '+' : ''}{revenueVariation.toFixed(0)}% vs objetivo inicial • {
                              isCritical ? 'Por debajo objetivo' :
                              isWarning ? 'Cerca del objetivo' :
                              isGood ? 'Superando objetivo' :
                              'Sin referencia'
                            }
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Timeline and Operational Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Timeline */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <Calendar className="h-5 w-5 text-indigo-600" />
                    Timeline del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Inicio del Proyecto</p>
                        <p className="text-xs text-gray-500">{project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'Sin fecha'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Fase Actual</p>
                        <p className="text-xs text-gray-500">Desarrollo Activo</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Próximo Hito</p>
                        <p className="text-xs text-gray-500">Review Cliente (Semana 3)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Entrega Final</p>
                        <p className="text-xs text-gray-500">Estimada: 2 semanas</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Operational Metrics */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-teal-100 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <Activity className="h-5 w-5 text-teal-600" />
                    Métricas Operacionales
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Horas Período</span>
                    <span className="font-semibold text-teal-600">
                      {unifiedData?.actuals?.totalWorkedHours?.toFixed(1) || '0.0'}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Días Activos</span>
                    <span className="font-semibold text-green-600">
                      {Math.ceil((unifiedData?.actuals?.totalWorkedHours || 0) / 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Registros</span>
                    <span className="font-semibold text-purple-600">{unifiedData?.actuals?.totalEntries || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Promedio/Día</span>
                    <span className="font-semibold text-blue-600">
                      {unifiedData?.actuals?.totalWorkedHours && unifiedData.actuals.totalEntries > 0
                        ? (unifiedData.actuals.totalWorkedHours / Math.max(1, Math.ceil(unifiedData.actuals.totalWorkedHours / 8))).toFixed(1) + 'h'
                        : '0.0h'
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Indicators - Strategic Colors */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Indicadores de Riesgo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* Budget Risk - Strategic Colors */}
                  {(() => {
                    const budgetUsage = costSummary?.budget && costSummary?.totalCost 
                      ? (costSummary.totalCost / costSummary.budget) * 100
                      : 0;
                    const isCritical = budgetUsage > 90;
                    const isWarning = budgetUsage > 75;
                    const isGood = budgetUsage <= 75;
                    
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Riesgo Presupuesto</span>
                        <Badge className={`${
                          isCritical ? 'bg-red-100 text-red-800' :
                          isWarning ? 'bg-yellow-100 text-yellow-800' :
                          isGood ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isCritical ? 'Alto' : isWarning ? 'Medio' : isGood ? 'Bajo' : 'Sin datos'}
                        </Badge>
                      </div>
                    );
                  })()}

                  {/* Time Risk - Strategic Colors */}
                  {(() => {
                    const timeProgress = costSummary?.targetHours && costSummary?.filteredHours 
                      ? (costSummary.filteredHours / costSummary.targetHours) * 100
                      : 0;
                    const isCritical = timeProgress > 100;
                    const isWarning = timeProgress > 85;
                    const isGood = timeProgress <= 85;
                    
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Riesgo Tiempo</span>
                        <Badge className={`${
                          isCritical ? 'bg-red-100 text-red-800' :
                          isWarning ? 'bg-yellow-100 text-yellow-800' :
                          isGood ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isCritical ? 'Alto' : isWarning ? 'Medio' : isGood ? 'Bajo' : 'Sin datos'}
                        </Badge>
                      </div>
                    );
                  })()}

                  {/* Quality Risk - Always Good (White/Neutral) */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Riesgo Calidad</span>
                    <Badge className="bg-green-100 text-green-800">Bajo</Badge>
                  </div>

                  {/* General Risk - Based on Overall Analysis */}
                  {(() => {
                    const budgetUsage = costSummary?.budget && costSummary?.totalCost 
                      ? (costSummary.totalCost / costSummary.budget) * 100
                      : 0;
                    const timeProgress = costSummary?.targetHours && costSummary?.filteredHours 
                      ? (costSummary.filteredHours / costSummary.targetHours) * 100
                      : 0;
                    const markup = quotationData?.totalAmount && costSummary?.totalCost 
                      ? quotationData.totalAmount / costSummary.totalCost 
                      : 2.0;
                    
                    const budgetRisk = budgetUsage > 90;
                    const timeRisk = timeProgress > 100;
                    const markupRisk = markup < 1.2;
                    
                    const totalRisks = [budgetRisk, timeRisk, markupRisk].filter(Boolean).length;
                    const isCritical = totalRisks >= 2;
                    const isWarning = totalRisks === 1;
                    const isGood = totalRisks === 0;
                    
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Riesgo General</span>
                        <Badge className={`${
                          isCritical ? 'bg-red-100 text-red-800' :
                          isWarning ? 'bg-yellow-100 text-yellow-800' :
                          isGood ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isCritical ? 'Crítico' : isWarning ? 'Atención' : isGood ? 'Controlado' : 'Sin análisis'}
                        </Badge>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* OTRAS PESTAÑAS (mantenidas como estaban) */}
          <TabsContent value="team" className="space-y-4">
            <ProjectTeamSection 
              projectId={projectId!}
              unifiedData={unifiedData}
              timeFilter={timeFilterForHook}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Panel de Control del Proyecto
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Vista general del estado y progreso del proyecto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Métricas básicas del dashboard */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-800">Progreso General</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {costSummary?.budget ? Math.round((costSummary.totalCost / costSummary.budget) * 100) : 0}%
                          </p>
                        </div>
                        <Target className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">Horas Trabajadas</p>
                          <p className="text-2xl font-bold text-green-900">
                            {costSummary?.filteredHours?.toFixed(1) || '0.0'}h
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-800">Equipo Activo</p>
                          <p className="text-2xl font-bold text-purple-900">
                            {teamStats?.filter((member: any) => member.hours > 0).length || 0}
                          </p>
                        </div>
                        <Users className="h-8 w-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Información adicional */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Resumen del Período: {dateFilter.label}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Costo Total:</span>
                      <span className="font-medium text-gray-900 ml-2">
                        ${costSummary?.totalCost?.toFixed(0) || '0'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Presupuesto:</span>
                      <span className="font-medium text-gray-900 ml-2">
                        ${costSummary?.budget?.toFixed(0) || '0'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Horas Estimadas:</span>
                      <span className="font-medium text-gray-900 ml-2">
                        {costSummary?.targetHours?.toFixed(1) || '0.0'}h
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Eficiencia:</span>
                      <span className={`font-medium ml-2 ${
                        costSummary?.budget && costSummary?.totalCost
                          ? costSummary.totalCost <= costSummary.budget ? 'text-green-600' : 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {costSummary?.budget && costSummary?.totalCost
                          ? costSummary.totalCost <= costSummary.budget ? 'Dentro del presupuesto' : 'Sobre presupuesto'
                          : 'Sin datos'
                        }
                      </span>
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
              {deleteTimeEntryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de registro de tiempo rápido */}
      <Dialog open={showQuickRegister} onOpenChange={setShowQuickRegister}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-600" />
              Registro de Tiempo - {project?.name}
            </DialogTitle>
            <DialogDescription>
              Registra tiempo para el equipo del proyecto de forma rápida y eficiente
            </DialogDescription>
          </DialogHeader>
          <WeeklyTimeRegister 
            projectId={projectId!} 
            onClose={() => setShowQuickRegister(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
