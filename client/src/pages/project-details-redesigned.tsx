import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  User,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
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
  Flame,
  Database
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
import { ProjectPriceAdjustments } from "@/components/project/ProjectPriceAdjustments";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { es } from "date-fns/locale";
import ProjectSummaryFixed from '@/components/dashboard/project-summary-fixed';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
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
        return { startDate: new Date(2025, 0, 1), endDate: new Date(2025, 11, 31), label: "Todos los períodos" };
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

const ProjectDetailsPage = () => {
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
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);

  // Estado del filtro temporal - configurado por defecto para mostrar "Este mes" (julio 2025)
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    // Configurar por defecto para mostrar julio 2025 como "este mes" 
    const currentDate = new Date();
    const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthName = thisMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return {
      type: 'month',
      startDate: startOfMonth(thisMonth) as Date,
      endDate: endOfMonth(thisMonth) as Date,
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
  console.log('🔍 FILTER DEBUG:', { 
    dateFilterLabel: dateFilter.label, 
    mappedTimeFilter: timeFilterForHook,
    dateFilterDates: {
      start: dateFilter.startDate?.toISOString(),
      end: dateFilter.endDate?.toISOString()
    }
  });
  const { data: unifiedData, isLoading: dataLoading, error: dataError } = useCompleteProjectData(
    projectId ? parseInt(projectId) : 0, 
    timeFilterForHook
  );

  // Cliente del proyecto
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(unifiedData as any)?.project?.clientId}`],
    enabled: !!(unifiedData as any)?.project?.clientId,
  });

  // Datos derivados para compatibilidad con componentes existentes
  const project = (unifiedData as any)?.project;
  const isLoading = dataLoading;
  const quotationData = (unifiedData as any)?.quotation;
  
  // Crear filteredTimeEntries vacío por compatibilidad (todos los datos vienen del endpoint unificado)
  const filteredTimeEntries: any[] = [];
  
  // Variables faltantes para compatibilidad con componentes existentes
  const completeData = unifiedData as any;
  const baseTeam = (unifiedData as any)?.team || [];
  
  // Obtener los registros de tiempo recientes desde unifiedData
  const recentTimeEntries = (unifiedData as any)?.timeEntries || [];

  // FUNCIÓN PARA CALCULAR MULTIPLICADOR DE COTIZACIÓN SEGÚN PERÍODO TEMPORAL
  const getQuotationMultiplier = useCallback(() => {
    if (!(unifiedData as any)?.quotation) return 1;

    const quotation = (unifiedData as any).quotation;
    
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
    const baseHours = (unifiedData as any).quotation.estimatedHours || 0;
    const baseCost = (unifiedData as any).quotation.baseCost || 0;
    
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
    console.log('  - Estimated hours:', (unifiedData as any).quotation?.estimatedHours || -1);
    console.log('  - Total worked hours:', (unifiedData as any).actuals?.totalWorkedHours || -1);
    console.log('  - Total worked cost:', (unifiedData as any).actuals?.totalWorkedCost || -1);
    console.log('  - Markup:', (unifiedData as any).metrics?.markup || -1);
    console.log('  - Efficiency:', (unifiedData as any).metrics?.efficiency || -1);
    console.log('  - Total entries:', (unifiedData as any).actuals?.totalEntries || -1);
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
          value: "Sin datos",
          subtitle: "Proyecto recién iniciado",
          icon: AlertCircle,
          color: "text-blue-700",
          bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
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
        subtitle: (() => {
          const actualBudgetUtil = (actuals.totalWorkedCost / quotation.baseCost) * 100;
          if (actualBudgetUtil <= 85) return "🏆 Salud financiera excelente";
          if (actualBudgetUtil <= 100) return "✅ Salud financiera buena";
          if (actualBudgetUtil <= 110) return "🟡 Requiere atención";
          return "🔴 Estado crítico";
        })(),
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
    return Object.entries((unifiedData as any).actuals.teamBreakdown).map(([personnelId, data]: [string, any]) => ({
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
      estimatedHours: (unifiedData as any).quotation.estimatedHours,
      totalWorkedHours: (unifiedData as any).actuals.totalWorkedHours,
      totalWorkedCost: (unifiedData as any).actuals.totalWorkedCost,
      baseCost: (unifiedData as any).quotation.baseCost,
      totalAmount: (unifiedData as any).quotation.totalAmount,
      metrics: (unifiedData as any).metrics
    });

    // Usar datos directamente de unifiedData
    const actualHours = (unifiedData as any).actuals.totalWorkedHours;
    const actualCost = (unifiedData as any).actuals.totalWorkedCost;
    const targetHours = (unifiedData as any).quotation.estimatedHours;
    const targetBudget = (unifiedData as any).quotation.baseCost;
    const targetClientPrice = (unifiedData as any).quotation.totalAmount;
    
    // Usar métricas ya calculadas en el backend
    const budgetUtilization = (unifiedData as any).metrics.budgetUtilization;
    const markup = (unifiedData as any).metrics.markup;
    const hoursProgress = (unifiedData as any).metrics.efficiency;

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

  const handleDeleteEntry = () => {
    if (deleteEntryId) {
      deleteTimeEntryMutation.mutate(deleteEntryId);
      setDeleteEntryId(null);
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

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  onClick={() => setLocation(`/active-projects/${projectId}/financial-management`)}
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Gestión Financiera
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
          <TabsList className="grid grid-cols-6 w-full max-w-5xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
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
              value="price-adjustments" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm"
            >
              <Settings className="h-4 w-4" />
              Ajustes de Precio
            </TabsTrigger>
            <TabsTrigger 
              value="income-details" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Ingresos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            
            {/* ANÁLISIS OPERACIONAL DEL PROYECTO */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">🔧 Análisis Operacional del Proyecto</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Ingresos del Período */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    ${(() => {
                      const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                      if (isLegacyProject) {
                        // Usar ingresos reales para análisis operacional
                        const realRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        return realRevenue.toLocaleString();
                      } else {
                        // Usar cotización para proyectos futuros
                        return (unifiedData?.quotation?.totalAmount || 0).toLocaleString();
                      }
                    })()}
                  </div>
                  <p className="text-sm text-gray-600">💰 Ingresos Operacionales</p>
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                      return isLegacyProject ? 'Ingresos reales del período' : 'Valor cotizado al cliente';
                    })()}
                  </p>
                </div>

                {/* Costos Operacionales */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 mb-2">
                    ${(unifiedData?.actuals?.totalWorkedCost || 0).toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-600">⚙️ Costos Operacionales</p>
                  <p className="text-xs text-gray-500">Costo directo del trabajo realizado</p>
                </div>

                {/* Eficiencia Operacional */}
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-2 ${(() => {
                    const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                    const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                    let revenue = 0;
                    
                    if (isLegacyProject) {
                      revenue = (unifiedData as any)?.googleSheetsSales
                        ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                        ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                    } else {
                      revenue = unifiedData?.quotation?.totalAmount || 0;
                    }
                    
                    if (actualCost === 0) {
                      return revenue > 0 ? 'text-green-600' : 'text-gray-600';
                    }
                    
                    const efficiency = revenue / actualCost;
                    if (efficiency >= 2.0) return 'text-green-600';
                    if (efficiency >= 1.5) return 'text-yellow-600';
                    return 'text-red-600';
                  })()}`}>
                    {(() => {
                      const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                      const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                      let revenue = 0;
                      
                      if (isLegacyProject) {
                        revenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                      } else {
                        revenue = unifiedData?.quotation?.totalAmount || 0;
                      }
                      
                      if (actualCost === 0) {
                        return revenue > 0 ? 'Sin costos' : '0.0x';
                      }
                      
                      const efficiency = revenue / actualCost;
                      return `${efficiency.toFixed(1)}x`;
                    })()}
                  </div>
                  <p className="text-sm text-gray-600">📊 Multiplicador Operacional</p>
                  <p className="text-xs text-gray-500">Ingresos / Costos directos</p>
                </div>
              </div>

              {/* Contexto Operacional */}
              <div className="mt-4 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <p><strong>ℹ️ Análisis Operacional:</strong></p>
                <p>• <strong>Ingresos:</strong> Revenue operacional del proyecto en el período seleccionado</p>
                <p>• <strong>Costos:</strong> Costos directos del trabajo (salarios, freelancers)</p>
                <p>• <strong>Multiplicador:</strong> Eficiencia operacional - cuánto genera cada peso invertido</p>
              </div>
            </div>

            {/* SECCIÓN 1: KPI Cards Principales - Layout Profesional */}
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
              
              {/* Markup Card - Métrica más importante */}
              <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50 via-blue-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-blue-100 rounded-lg cursor-help">
                            <Percent className="h-4 w-4 text-blue-600" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">¿Qué es el Markup?</p>
                            <p className="text-xs">El markup indica la rentabilidad del proyecto dividiendo el precio facturado al cliente entre el costo real operativo.</p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p>• <span className="text-emerald-600">≥ 2.5x: Excelente</span> - Alta rentabilidad</p>
                              <p>• <span className="text-green-600">≥ 1.8x: Bueno</span> - Rentabilidad saludable</p>
                              <p>• <span className="text-yellow-600">≥ 1.2x: Aceptable</span> - Rentabilidad mínima</p>
                              <p>• <span className="text-red-600">&lt; 1.2x: Crítico</span> - Pérdida o riesgo</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-sm font-medium text-blue-700">Markup</span>
                    </div>
                    <Badge variant={(() => {
                      const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                      const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                      
                      // Solo calcular markup con datos reales (completada + activa)
                      const realRevenue = (unifiedData as any)?.googleSheetsSales
                        ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                        ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        
                      const revenue = isLegacyProject ? realRevenue : unifiedData?.quotation?.totalAmount || 0;
                      const markup = actualCost > 0 && revenue > 0 ? revenue / actualCost : 0;
                      
                      if (markup >= 2.5) return 'default';
                      if (markup >= 1.8) return 'secondary';
                      if (markup >= 1.2) return 'outline';
                      return 'destructive';
                    })()} className="text-xs">
                      {(() => {
                        const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        
                        const realRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                          
                        const revenue = isLegacyProject ? realRevenue : unifiedData?.quotation?.totalAmount || 0;
                        const markup = actualCost > 0 && revenue > 0 ? revenue / actualCost : 0;
                        
                        if (markup >= 2.5) return 'Excelente';
                        if (markup >= 1.8) return 'Bueno';
                        if (markup >= 1.2) return 'Aceptable';
                        return 'Crítico';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      {(() => {
                        const actualCost = unifiedData?.actuals?.totalWorkedCost || 0;
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        
                        // Solo usar datos reales (completada + activa) para cálculo
                        const realRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                          
                        const revenue = isLegacyProject ? realRevenue : unifiedData?.quotation?.totalAmount || 0;
                        
                        if (actualCost > 0 && revenue > 0) {
                          const markup = revenue / actualCost;
                          return `${markup.toFixed(1)}x`;
                        }
                        // Si hay ingresos pero no costos, mostrar infinito
                        return revenue > 0 ? '∞' : '0.0x';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        return isLegacyProject ? 'Ingresos reales / Costo real' : 'Cotización / Costo real';
                      })()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Progreso de Horas */}
              <Card className="border-l-4 border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-green-100 rounded-lg cursor-help">
                            <Clock className="h-4 w-4 text-green-600" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Avance de Horas</p>
                            <p className="text-xs">Porcentaje de horas trabajadas respecto a las horas estimadas en la cotización para el período seleccionado.</p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p>• <span className="text-green-600">0-80%:</span> Progreso normal</p>
                              <p>• <span className="text-yellow-600">80-100%:</span> Acercándose al límite</p>
                              <p>• <span className="text-red-600">&gt;100%:</span> Excedido en horas</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-sm font-medium text-green-700">Avance de Horas</span>
                    </div>
                    <Badge variant="secondary" className="text-xs px-2 py-0.5">
                      {Math.round(((unifiedData?.actuals?.totalWorkedHours || 0) / (unifiedData?.quotation?.estimatedHours || 1)) * 100)}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-gray-900">
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedHours && unifiedData?.quotation?.estimatedHours) {
                          return (((unifiedData as any).actuals.totalWorkedHours / (unifiedData as any).quotation.estimatedHours) * 100).toFixed(1);
                        }
                        return '0.0';
                      })()}%
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>de {unifiedData?.quotation?.estimatedHours || 0}h estimadas</span>
                    </div>
                    <Progress value={(() => {
                      if (unifiedData?.actuals?.totalWorkedHours && unifiedData?.quotation?.estimatedHours) {
                        return ((unifiedData as any).actuals.totalWorkedHours / (unifiedData as any).quotation.estimatedHours) * 100;
                      }
                      return 0;
                    })()} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Costo Real Trabajado */}
              <Card className={`border-l-4 ${(() => {
                if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                  const percentage = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`p-2 rounded-lg cursor-help ${(() => {
                            if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                              const percentage = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
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
                            const percentage = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                            if (percentage <= 90) return 'text-green-600';
                            if (percentage <= 100) return 'text-gray-600';
                            if (percentage <= 110) return 'text-yellow-600';
                            if (percentage <= 120) return 'text-orange-600';
                            return 'text-red-600';
                          }
                          return 'text-orange-600';
                        })()}`} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Costo Real vs Estimado</p>
                            <p className="text-xs">Comparación entre el costo real operativo y el costo estimado en la cotización.</p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p>• <span className="text-green-600">≤90%:</span> Excelente control de costos</p>
                              <p>• <span className="text-gray-600">≤100%:</span> Dentro del presupuesto</p>
                              <p>• <span className="text-yellow-600">≤110%:</span> Alerta temprana (+10%)</p>
                              <p>• <span className="text-orange-600">≤120%:</span> Sobrecosto crítico (+20%)</p>
                              <p>• <span className="text-red-600">&gt;120%:</span> Crisis de costos</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className={`text-sm font-medium ${(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const percentage = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
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
                        const percentage = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                        if (percentage <= 90) return 'default'; // Verde: Bajo presupuesto
                        if (percentage <= 100) return 'secondary'; // Gris: Dentro del presupuesto
                        if (percentage <= 110) return 'outline'; // Amarillo: Alerta temprana
                        if (percentage <= 120) return 'destructive'; // Naranja: Crítico
                        return 'destructive'; // Rojo: Crisis
                      }
                      return 'outline';
                    })()} className={`text-xs px-2 py-0.5 ${(() => {
                      if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                        const percentage = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
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
                          const realCost = (unifiedData as any).actuals.totalWorkedCost;
                          const estimatedCost = (unifiedData as any).quotation.baseCost;
                          const percentage = (realCost / estimatedCost) * 100;
                          
                          if (percentage <= 90) return `${percentage.toFixed(0)}%`;
                          if (percentage <= 100) return `${percentage.toFixed(0)}%`;
                          if (percentage <= 110) return `${percentage.toFixed(0)}%`;
                          if (percentage <= 120) return `${percentage.toFixed(0)}%`;
                          return `${percentage.toFixed(0)}%`;
                        }
                        return '0%';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-gray-900">
                      ${(unifiedData?.actuals?.totalWorkedCost || 0).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>de ${(unifiedData?.quotation?.baseCost || 0).toLocaleString()} estimado</span>
                    </div>
                    <Progress 
                      value={(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          return ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                        }
                        return 0;
                      })()} 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Ingresos Reales */}
              <Card className="border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-emerald-100 rounded-lg cursor-help">
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Ingresos Reales</p>
                            <p className="text-xs">Ingresos confirmados que han sido facturados y cobrados por el proyecto en el período seleccionado.</p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p>• Los ingresos se sincronizan automáticamente cada 30 minutos</p>
                              <p>• Solo se incluyen ventas confirmadas y cobradas</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-sm font-medium text-emerald-700">Ingresos Reales</span>
                    </div>
                    <Badge variant={(() => {
                      // Solo usar datos reales (completada + activa)
                      const realRevenue = (unifiedData as any)?.googleSheetsSales
                        ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                        ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                      const actualCosts = (unifiedData as any)?.actuals?.totalWorkedCost || 0;
                      return realRevenue > actualCosts ? 'default' : realRevenue > 0 ? 'secondary' : 'outline';
                    })()} className="text-xs">
                      {(() => {
                        const realRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        const actualCosts = (unifiedData as any)?.actuals?.totalWorkedCost || 0;
                        if (realRevenue > actualCosts) return 'Ganancia';
                        if (realRevenue > 0) return 'Reales';
                        return 'Sin datos reales';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-gray-900">
                      ${(() => {
                        // Solo mostrar ingresos reales (completada + activa)
                        const realRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        return realRevenue.toLocaleString();
                      })()}
                    </p>
                    <div className="text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>Margen Real:</span>
                        <span className={`font-mono ${(() => {
                          const realRevenue = (unifiedData as any)?.googleSheetsSales
                            ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                            ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                          const actualCosts = (unifiedData as any)?.actuals?.totalWorkedCost || 0;
                          const margin = realRevenue - actualCosts;
                          return margin >= 0 ? 'text-green-600' : 'text-red-600';
                        })()}`}>
                          ${(() => {
                            const realRevenue = (unifiedData as any)?.googleSheetsSales
                              ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                              ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                            const actualCosts = (unifiedData as any)?.actuals?.totalWorkedCost || 0;
                            const margin = realRevenue - actualCosts;
                            return margin.toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estado General */}
              <Card className={`border-l-4 shadow-sm hover:shadow-md transition-shadow ${(() => {
                if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                  const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                  if (budgetUtil <= 85) return 'border-l-emerald-600 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white';
                  if (budgetUtil <= 100) return 'border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white';
                  if (budgetUtil <= 110) return 'border-l-yellow-600 bg-gradient-to-br from-yellow-50 via-yellow-25 to-white';
                  return 'border-l-red-600 bg-gradient-to-br from-red-50 via-red-25 to-white';
                }
                return 'border-l-purple-600 bg-gradient-to-br from-purple-50 via-purple-25 to-white';
              })()}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`p-2 rounded-lg cursor-help ${(() => {
                            if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                              const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                              if (budgetUtil <= 85) return 'bg-emerald-100';
                              if (budgetUtil <= 100) return 'bg-green-100';
                              if (budgetUtil <= 110) return 'bg-yellow-100';
                              return 'bg-red-100';
                            }
                            return 'bg-purple-100';
                          })()}`}>
                            {(() => {
                          if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                            const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                            if (budgetUtil <= 85) return <Crown className="h-4 w-4 text-emerald-600" />;
                            if (budgetUtil <= 100) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
                            if (budgetUtil <= 110) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
                            return <TrendingDown className="h-4 w-4 text-red-600" />;
                          }
                          return <Gauge className="h-4 w-4 text-purple-600" />;
                        })()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Estado de Salud del Proyecto</p>
                            <p className="text-xs">Evaluación integral basada en el control de costos comparando el costo real vs el estimado.</p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p>• <span className="text-emerald-600">≤85%: Excelente</span> - Eficiencia destacada 🏆</p>
                              <p>• <span className="text-green-600">≤100%: Bueno</span> - Bajo control ✅</p>
                              <p>• <span className="text-yellow-600">≤110%: Regular</span> - Requiere atención 🟡</p>
                              <p>• <span className="text-red-600">&gt;110%: Crítico</span> - Acción inmediata 🔴</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className={`text-sm font-medium ${(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                          if (budgetUtil <= 85) return 'text-emerald-700';
                          if (budgetUtil <= 100) return 'text-green-700';
                          if (budgetUtil <= 110) return 'text-yellow-700';
                          return 'text-red-700';
                        }
                        return 'text-purple-700';
                      })()}`}>Estado</span>
                    </div>
                    <Badge className={`text-xs px-2 py-0.5 ${(() => {
                      if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                        const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                        if (budgetUtil <= 85) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
                        if (budgetUtil <= 100) return 'bg-green-100 text-green-800 border-green-300';
                        if (budgetUtil <= 110) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                        return 'bg-red-100 text-red-800 border-red-300';
                      }
                      return 'bg-purple-100 text-purple-800 border-purple-300';
                    })()}`}>
                      {(() => {
                        if (unifiedData?.actuals?.totalWorkedCost && unifiedData?.quotation?.baseCost) {
                          const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                          console.log('🚨 CARD MORADA DEBUG:', { 
                            actualCost: (unifiedData as any).actuals.totalWorkedCost,
                            baseCost: (unifiedData as any).quotation.baseCost,
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
                          const budgetUtil = ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.baseCost) * 100;
                          return `${budgetUtil.toFixed(0)}%`;
                        }
                        return '0%';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">Uso del presupuesto</p>
                  </div>
                </CardContent>
              </Card>

              {/* Ingresos/Precio Cliente */}
              <Card className="border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Building className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-medium text-emerald-700">
                        {(() => {
                          const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                          return isLegacyProject ? 'Ingresos Periodo' : 'Precio Cliente';
                        })()}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {(() => {
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        return isLegacyProject ? 'Real' : 'Cotizado';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      ${(() => {
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        if (isLegacyProject) {
                          // Para legacy: mostrar solo ingresos reales del período
                          const realRevenue = (unifiedData as any)?.googleSheetsSales
                            ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                            ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                          return realRevenue.toLocaleString();
                        } else {
                          // Para futuros: usar cotización
                          return (unifiedData?.quotation?.totalAmount || 0).toLocaleString();
                        }
                      })()}
                    </p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>{(() => {
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        return isLegacyProject ? 'Solo ingresos reales del período' : 'Valor cotizado al cliente';
                      })()}</p>
                      {(() => {
                        const isLegacyProject = new Date(unifiedData?.project?.startDate || 0) < new Date('2025-09-01');
                        if (!isLegacyProject) return null;
                        
                        // Mostrar breakdown de real vs proyectado para legacy
                        const realRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'completada' || sale.status === 'activa')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        const projectedRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'proyectada')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        
                        if (projectedRevenue > 0) {
                          return (
                            <div className="text-xs">
                              <span className="text-gray-400">+ ${projectedRevenue.toLocaleString()} proyectados</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
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
                    <p className="text-lg font-bold text-gray-900">
                      ${(unifiedData?.quotation?.baseCost || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Costo operativo planificado
                    </p>
                  </div>
                </CardContent>
              </Card>
              {/* Nueva tarjeta: Ingresos Proyectados */}
              <Card className="border-l-4 border-l-purple-600 bg-gradient-to-br from-purple-50 via-purple-25 to-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-help">
                            <Info className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-700">Ingresos Proyectados</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ingresos estimados futuros basados en proyecciones de ventas</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge variant={(() => {
                      const projectedRevenue = (unifiedData as any)?.googleSheetsSales
                        ?.filter((sale: any) => sale.status === 'proyectada')
                        ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                      return projectedRevenue > 0 ? 'secondary' : 'outline';
                    })()} className="text-xs">
                      {(() => {
                        const projectedRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'proyectada')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        return projectedRevenue > 0 ? 'Estimados' : 'Sin proyecciones';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-gray-900">
                      ${(() => {
                        const projectedRevenue = (unifiedData as any)?.googleSheetsSales
                          ?.filter((sale: any) => sale.status === 'proyectada')
                          ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                        return projectedRevenue.toLocaleString();
                      })()}
                    </p>
                    <div className="text-xs text-gray-500">
                      <p>Basado en proyecciones futuras</p>
                      <div className="flex justify-between mt-1">
                        <span>Total estimado:</span>
                        <span className="font-mono text-purple-600">
                          ${(() => {
                            const totalRevenue = (unifiedData as any)?.googleSheetsSales
                              ?.reduce((sum: number, sale: any) => sum + parseFloat(sale.amountUsd || sale.amountArs || 0), 0) || 0;
                            return totalRevenue.toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            {/* SECCIÓN 2: Análisis Avanzado - Grid Profesional 2x2 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Análisis de Desviaciones */}
              <div className="space-y-4">
                <DeviationAnalysis 
                  projectId={parseInt(projectId!)} 
                  timeFilter={timeFilterForHook}
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
                  projectId={parseInt(projectId!)} 
                  timeFilter={timeFilterForHook}
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
                projectId={parseInt(projectId!)} 
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
                    {recentTimeEntries?.length || 0} registros
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
                  {recentTimeEntries && recentTimeEntries.length > 0 ? (
                    recentTimeEntries.slice(0, 12).map((entry, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-semibold">
                            {entry.personnelName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{entry.personnelName}</p>
                          <p className="text-xs text-gray-500 truncate">{entry.roleName || 'Sin rol'}</p>
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
                    projectId={parseInt(projectId!)} 
                    timeFilter={timeFilterForHook}
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
              />
            </div>

            {/* MAPA DE CALOR DEL EQUIPO - Movido desde Análisis Detallado */}
            <div className="grid grid-cols-1 gap-6">
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
                        
                        {/* Heat Map Grid - Full width version */}
                        <div className="grid grid-cols-8 gap-3">
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
                                className={`relative h-20 w-full ${bgColor} rounded-lg p-2 hover:scale-105 transition-transform cursor-pointer group`}
                                style={{ opacity: intensity / 100 }}
                                title={`${name}: ${Hr.toFixed(1)}h trabajadas / ${He.toFixed(1)}h estimadas`}
                              >
                                <div className="text-white text-sm font-semibold text-center leading-tight truncate">
                                  {name.length > 10 ? name.substring(0, 10) + '...' : name}
                                </div>
                                <div className="text-white text-sm text-center mt-1">
                                  {Hr.toFixed(0)}h
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
                      const estimatedHours = completeData?.quotation?.estimatedHours || 0; // Backend ya envía valor escalado
                      const percentage = estimatedHours > 0 ? (workedHours / estimatedHours) * 100 : 0;
                      
                      return (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            {percentage.toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            de {estimatedHours.toFixed(0)}h estimadas
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
                        ? ((unifiedData as any).actuals.totalWorkedHours / teamStats.length / 30).toFixed(1)
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
                      const estimatedHours = unifiedData?.quotation?.estimatedHours || 0; // Backend ya envía valor escalado
                      const percentage = estimatedHours > 0 ? (workedHours / estimatedHours) * 100 : 0;
                      
                      return (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            {workedHours.toFixed(1)}h
                          </p>
                          <p className="text-xs text-gray-500">
                            de {estimatedHours.toFixed(0)}h estimadas
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

          {/* ANÁLISIS FINANCIERO Y ECONÓMICO */}
          <TabsContent value="details" className="space-y-6">
            <TooltipProvider>
              {/* Header Section - Financial Overview */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-indigo-900">Análisis Financiero y Económico</h2>
                    <p className="text-indigo-700">Indicadores de rentabilidad, ROI y eficiencia económica</p>
                  </div>
                </div>
              </div>

              {/* Financial KPIs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* ROI Card */}
              <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-emerald-600 p-2 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                        ROI
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-emerald-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <div className="space-y-2 text-sm">
                            <div className="font-semibold">Margen de Ganancia</div>
                            <div>Porcentaje del precio de venta que representa ganancia neta después de cubrir todos los costos operativos.</div>
                            <div className="text-xs text-gray-600">
                              Fórmula: (Precio Cliente - Costo Real) ÷ Precio Cliente × 100<br/>
                              • Verde (&gt;40%): Margen excelente<br/>
                              • Amarillo (20-40%): Margen saludable<br/>
                              • Rojo (&lt;20%): Margen bajo o pérdidas
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-emerald-900">
                      {unifiedData?.quotation?.totalAmount && unifiedData?.actuals?.totalWorkedCost ? 
                        `${((((unifiedData as any).quotation.totalAmount - (unifiedData as any).actuals.totalWorkedCost) / (unifiedData as any).quotation.totalAmount) * 100).toFixed(1)}%` : 
                        '0.0%'
                      }
                    </h3>
                    <p className="text-xs text-emerald-700">Margen de ganancia</p>
                    <div className="w-full bg-emerald-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, 
                            unifiedData?.quotation?.totalAmount && unifiedData?.actuals?.totalWorkedCost ?
                              ((((unifiedData as any).quotation.totalAmount - (unifiedData as any).actuals.totalWorkedCost) / (unifiedData as any).quotation.totalAmount) * 100) :
                              0
                          ))}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profit Margin Card */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <Percent className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                        Margen
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-blue-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <div className="space-y-2 text-sm">
                            <div className="font-semibold">Markup (Multiplicador)</div>
                            <div>Relación entre el precio de venta y el costo operativo. Indica cuántas veces el costo se multiplica para obtener el precio.</div>
                            <div className="text-xs text-gray-600">
                              Fórmula: Precio Cliente ÷ Costo Real<br/>
                              • &gt;2.5x: Markup excelente<br/>
                              • 1.8x-2.5x: Markup muy bueno<br/>
                              • 1.2x-1.8x: Markup aceptable<br/>
                              • &lt;1.2x: Markup crítico
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-blue-900">
                      {unifiedData?.metrics?.markup ? 
                        `${unifiedData.metrics.markup.toFixed(1)}x` : 
                        '0.0x'
                      }
                    </h3>
                    <p className="text-xs text-blue-700">Markup (Precio/Costo)</p>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, 
                            unifiedData?.metrics?.markup ?
                              (unifiedData.metrics.markup / 3) * 100 : // Dividido por 3 para escalar (3x = 100%)
                              0
                          ))}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Efficiency Card */}
              <Card className="bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-purple-600 p-2 rounded-lg">
                      <Gauge className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                        Eficiencia
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-purple-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <div className="space-y-2 text-sm">
                            <div className="font-semibold">Eficiencia de Costos</div>
                            <div>Mide qué tan bien se están controlando los gastos respecto al presupuesto estimado.</div>
                            <div className="text-xs text-gray-600">
                              • &gt;95%: Excelente control de costos<br/>
                              • 85-95%: Buen control<br/>
                              • 70-85%: Control regular<br/>
                              • &lt;70%: Sobrecostos críticos
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-purple-900">
                      {unifiedData?.metrics?.budgetUtilization ? 
                        `${(100 - Math.max(0, (unifiedData as any).metrics.budgetUtilization - 100)).toFixed(1)}%` : 
                        '100.0%'
                      }
                    </h3>
                    <p className="text-xs text-purple-700">Eficiencia de costos</p>
                    <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, 
                            unifiedData?.metrics?.budgetUtilization ? 
                              (100 - Math.max(0, (unifiedData as any).metrics.budgetUtilization - 100)) : 
                              100
                          ))}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue per Hour Card */}
              <Card className="bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-amber-600 p-2 rounded-lg">
                      <Timer className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                        $/Hora
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-amber-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <div className="space-y-2 text-sm">
                            <div className="font-semibold">Ingresos por Hora</div>
                            <div>Valor promedio que genera cada hora trabajada en el proyecto, calculado dividiendo el precio total entre las horas reales trabajadas.</div>
                            <div className="text-xs text-gray-600">
                              Fórmula: Precio Total ÷ Horas Trabajadas<br/>
                              Útil para evaluar la productividad y valor del tiempo invertido en el proyecto.
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-amber-900">
                      ${unifiedData?.quotation?.totalAmount && unifiedData?.actuals?.totalWorkedHours ? 
                        ((unifiedData as any).quotation.totalAmount / (unifiedData as any).actuals.totalWorkedHours).toFixed(0) : 
                        '0'
                      }
                    </h3>
                    <p className="text-xs text-amber-700">Ingresos por hora</p>
                    <div className="w-full bg-amber-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: '75%' }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cost Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Cost Distribution by Role */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <Users className="h-5 w-5 text-blue-600" />
                    Distribución de Costos por Rol
                  </CardTitle>
                  <CardDescription>
                    Análisis de gastos según roles del equipo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            if (!unifiedData?.actuals?.teamBreakdown) return [];
                            
                            // Agrupar costos por rol
                            const roleMap = new Map();
                            (unifiedData as any).actuals.teamBreakdown.forEach((member: any) => {
                              const role = member.roleName || 'Sin rol';
                              const currentCost = roleMap.get(role) || 0;
                              roleMap.set(role, currentCost + (member.cost || 0));
                            });
                            
                            // Convertir a array y ordenar por costo
                            const roleData = Array.from(roleMap.entries())
                              .map(([role, cost]) => ({ name: role, value: cost }))
                              .sort((a, b) => b.value - a.value);
                            
                            return roleData;
                          })()}
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          labelLine={{ stroke: "#666", strokeWidth: 1 }}
                        >
                          {(() => {
                            const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'];
                            if (!unifiedData?.actuals?.teamBreakdown) return [];
                            
                            const roleMap = new Map();
                            (unifiedData as any).actuals.teamBreakdown.forEach((member: any) => {
                              const role = member.roleName || 'Sin rol';
                              const currentCost = roleMap.get(role) || 0;
                              roleMap.set(role, currentCost + (member.cost || 0));
                            });
                            
                            return Array.from(roleMap.entries()).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ));
                          })()}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => [`$${value.toFixed(0)}`, 'Costo']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Distribution by Person */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <User className="h-5 w-5 text-green-600" />
                    Distribución de Costos por Persona
                  </CardTitle>
                  <CardDescription>
                    Top 8 colaboradores con mayor costo en el período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            if (!unifiedData?.actuals?.teamBreakdown) return [];
                            
                            // Obtener los top 8 por costo
                            const sortedMembers = [...(unifiedData as any).actuals.teamBreakdown]
                              .filter((member: any) => member.cost > 0)
                              .sort((a: any, b: any) => b.cost - a.cost)
                              .slice(0, 8);
                            
                            return sortedMembers.map((member: any) => ({
                              name: member.name.split(' ')[0], // Solo primer nombre
                              value: member.cost,
                              fullName: member.name
                            }));
                          })()}
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          labelLine={{ stroke: "#666", strokeWidth: 1 }}
                        >
                          {(() => {
                            const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6'];
                            if (!unifiedData?.actuals?.teamBreakdown) return [];
                            
                            const sortedMembers = [...(unifiedData as any).actuals.teamBreakdown]
                              .filter((member: any) => member.cost > 0)
                              .sort((a: any, b: any) => b.cost - a.cost)
                              .slice(0, 8);
                            
                            return sortedMembers.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ));
                          })()}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `$${value.toFixed(0)}`, 
                            props.payload.fullName || name
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial Analysis Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Breakdown Analysis */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    Desglose de Costos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Cost vs Revenue Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Costo Real</span>
                        <span className="font-medium">${unifiedData?.actuals?.totalWorkedCost?.toFixed(0) || '0'}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-red-500 h-3 rounded-full"
                          style={{ 
                            width: `${Math.min(100, 
                              unifiedData?.quotation?.totalAmount && unifiedData?.actuals?.totalWorkedCost ?
                                ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).quotation.totalAmount) * 100 :
                                0
                            )}%` 
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Ingreso Cliente</span>
                        <span className="font-medium">${unifiedData?.quotation?.totalAmount?.toFixed(0) || '0'}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className="bg-green-500 h-3 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Ganancia Bruta</span>
                        <span className="font-medium text-green-600">
                          ${((unifiedData?.quotation?.totalAmount || 0) - (unifiedData?.actuals?.totalWorkedCost || 0)).toFixed(0)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-green-600 h-3 rounded-full"
                          style={{ 
                            width: `${Math.max(0, 
                              unifiedData?.quotation?.totalAmount ?
                                ((((unifiedData as any).quotation.totalAmount - (unifiedData?.actuals?.totalWorkedCost || 0)) / (unifiedData as any).quotation.totalAmount) * 100) :
                                0
                            )}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profitability Trends */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Indicadores de Rentabilidad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Financial Health Score */}
                    <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="text-3xl font-bold text-green-700 mb-1">
                        {(() => {
                          // Evaluar salud financiera basada en margen de ganancia empresarial
                          const totalAmount = unifiedData?.quotation?.totalAmount || 0;
                          const workedCost = unifiedData?.actuals?.totalWorkedCost || 0;
                          const margin = totalAmount > 0 ? ((totalAmount - workedCost) / totalAmount) * 100 : 0;
                          
                          if (margin >= 60) return "Excelente";
                          if (margin >= 40) return "Bueno";
                          if (margin >= 20) return "Regular";
                          return "Crítico";
                        })()}
                      </div>
                      <p className="text-sm text-green-600">Score de Salud Financiera</p>
                    </div>

                    {/* Key Financial Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-700">
                          {unifiedData?.metrics?.markup?.toFixed(2) || '0.00'}x
                        </div>
                        <p className="text-xs text-blue-600">Multiplicador</p>
                      </div>
                      
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-700">
                          {unifiedData?.metrics?.budgetUtilization?.toFixed(1) || '0.0'}%
                        </div>
                        <p className="text-xs text-purple-600">Uso Budget</p>
                      </div>
                    </div>

                    {/* Economic Indicators */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Costo por Hora Promedio</span>
                        <span className="font-medium">
                          ${unifiedData?.actuals?.totalWorkedHours ? 
                            ((unifiedData as any).actuals.totalWorkedCost / (unifiedData as any).actuals.totalWorkedHours).toFixed(0) : 
                            '0'
                          }/h
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Break-even Point</span>
                        <span className="font-medium">
                          {unifiedData?.quotation?.baseCost && unifiedData?.actuals?.totalWorkedHours ?
                            `${((unifiedData as any).quotation.baseCost / ((unifiedData as any).actuals.totalWorkedHours / (unifiedData as any).actuals.totalWorkedHours || 1)).toFixed(0)}h` :
                            '0h'
                          }
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Productividad</span>
                        <span className="font-medium text-green-600">
                          {unifiedData?.metrics?.efficiency?.toFixed(1) || '0.0'}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Economic Recommendations */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <Lightbulb className="h-5 w-5 text-indigo-600" />
                  Recomendaciones Económicas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    const recommendations = [];
                    const markup = unifiedData?.metrics?.markup || 1;
                    const budgetUtil = unifiedData?.metrics?.budgetUtilization || 100;
                    const efficiency = unifiedData?.metrics?.efficiency || 0;

                    if (markup < 1.5) {
                      recommendations.push({
                        type: 'warning',
                        title: 'Optimizar Rentabilidad',
                        message: 'El markup actual está por debajo del objetivo. Considerar ajustar tarifas o reducir costos.',
                        icon: AlertTriangle,
                        color: 'text-yellow-600'
                      });
                    }

                    if (budgetUtil > 110) {
                      recommendations.push({
                        type: 'danger',
                        title: 'Control de Costos',
                        message: 'Los costos exceden el presupuesto. Revisar asignación de recursos y eficiencia del equipo.',
                        icon: TrendingDown,
                        color: 'text-red-600'
                      });
                    }

                    if (efficiency < 80) {
                      recommendations.push({
                        type: 'info',
                        title: 'Mejorar Productividad',
                        message: 'El equipo podría optimizar tiempos. Considerar capacitación o redistribución de tareas.',
                        icon: Target,
                        color: 'text-blue-600'
                      });
                    }

                    if (recommendations.length === 0) {
                      recommendations.push({
                        type: 'success',
                        title: 'Rendimiento Óptimo',
                        message: 'El proyecto mantiene excelentes indicadores financieros y económicos.',
                        icon: CheckCircle,
                        color: 'text-green-600'
                      });
                    }

                    return recommendations.map((rec, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-start gap-3">
                          <rec.icon className={`h-5 w-5 ${rec.color} mt-0.5`} />
                          <div>
                            <h4 className="font-medium text-gray-900">{rec.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{rec.message}</p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>
          </TabsContent>

          {/* AJUSTES DE PRECIO DEL PROYECTO */}
          <TabsContent value="price-adjustments" className="space-y-6">
            <ProjectPriceAdjustments 
              projectId={Number(projectId)} 
              currentPrice={quotationData?.totalAmount} 
            />
          </TabsContent>

          {/* INGRESOS DETALLADOS */}
          <TabsContent value="income-details" className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-600 p-2 rounded-lg">
                  <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-green-900">Ingresos Reales Detallados</h2>
                  <p className="text-green-700">Registros mensuales de ventas importados desde Excel MAESTRO</p>
                </div>
              </div>
            </div>

            {/* Tabla de ingresos mensuales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Historial de Ingresos por Período
                </CardTitle>
                <CardDescription>
                  Datos sincronizados automáticamente desde Google Sheets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unifiedData?.salesData && unifiedData.salesData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left p-3 font-semibold text-gray-700">Fecha</th>
                            <th className="text-left p-3 font-semibold text-gray-700">Cliente</th>
                            <th className="text-left p-3 font-semibold text-gray-700">Servicio</th>
                            <th className="text-right p-3 font-semibold text-gray-700">Monto USD</th>
                            <th className="text-right p-3 font-semibold text-gray-700">Monto ARS</th>
                            <th className="text-left p-3 font-semibold text-gray-700">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unifiedData.salesData.map((sale: any, index: number) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-3 text-sm">
                                {sale.month && sale.year ? `${sale.month} ${sale.year}` : 'Sin fecha'}
                              </td>
                              <td className="p-3 text-sm font-medium">{sale.clientName || 'N/A'}</td>
                              <td className="p-3 text-sm">{sale.projectName || sale.salesType || 'N/A'}</td>
                              <td className="p-3 text-sm text-right font-medium">
                                {sale.amountUsd ? `$${parseFloat(sale.amountUsd).toLocaleString()}` : '-'}
                              </td>
                              <td className="p-3 text-sm text-right font-medium">
                                {sale.amountArs ? `$${parseFloat(sale.amountArs).toLocaleString()}` : '-'}
                              </td>
                              <td className="p-3 text-sm">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  {sale.status || 'Activo'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Resumen financiero */}
                    <div className="bg-gray-50 rounded-lg p-4 mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Resumen del Período</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Ingresos USD</p>
                          <p className="text-lg font-bold text-green-600">
                            ${unifiedData.salesData.reduce((sum: number, sale: any) => 
                              sum + (parseFloat(sale.amountUsd) || 0), 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Ingresos ARS</p>
                          <p className="text-lg font-bold text-green-600">
                            ${unifiedData.salesData.reduce((sum: number, sale: any) => 
                              sum + (parseFloat(sale.amountArs) || 0), 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Registros</p>
                          <p className="text-lg font-bold text-blue-600">
                            {unifiedData.salesData.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay datos de ingresos para el período seleccionado</p>
                    <p className="text-sm mt-1">Los datos se sincronizan automáticamente cada 30 minutos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteEntryId} onOpenChange={() => setDeleteEntryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar esta entrada de tiempo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntryId(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteEntry}
              disabled={deleteTimeEntryMutation.isPending}
            >
              {deleteTimeEntryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Time Registration Dialog */}
      <Dialog open={showQuickRegister} onOpenChange={setShowQuickRegister}>
        <DialogContent className="sm:max-w-md">
          <div className="p-4">
            <p>Registro rápido de tiempo</p>
            <Button onClick={() => setShowQuickRegister(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetailsPage;
