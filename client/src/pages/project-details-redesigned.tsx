import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, getAuthHeader } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { watchSummaryDropped } from "@/utils/consistencyWatchdog";
import { toProjectVM, formatCurrency, useWhichCost } from "@/selectors/projectVM";
import { formatCurrencyFull } from "@/lib/utils";
import { getUtilizationStatus, getOverworkedMembers, getUnderutilizedMembers } from "@/utils/performance";
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
  Crown,
  Lightbulb,
  Info,
  Star,
  Flame,
  Database,
  Rocket,
  Heart,
  Brain,
  XCircle,
  Cog,
  Award,
  Calculator,
  Trophy
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
import { RoleAnalysis } from "@/components/advanced-analytics/role-analysis";
import WeeklyTimeRegister from "@/components/weekly-time-register";
import { EconomicRankings } from "@/components/EconomicRankings";
import TimeTracking from "@/components/TimeTracking";
import { IncomeDashboardTable } from "@/components/IncomeDashboardTable";
import { CostDashboard } from "@/components/CostDashboard";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { es } from "date-fns/locale";
import ProjectSummaryFixed from '@/components/dashboard/project-summary-fixed';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCompleteProjectData } from '@/hooks/useCompleteProjectData';
import { OneShotBanner } from '@/components/one-shot-banner';
import { ProjectLifetimeMetrics } from '@/components/project-lifetime-metrics';
import { DeltaBadge } from '@/components/ui/delta-badge';
import ProjectTaskList from '@/components/tasks/ProjectTaskList';
import { CheckSquare } from 'lucide-react';

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
        return { 
          startDate: new Date(2020, 0, 1), 
          endDate: new Date(2030, 11, 31), 
          label: "Todos los períodos" 
        };
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
        return { 
          startDate: new Date(2020, 0, 1), 
          endDate: new Date(2030, 11, 31), 
          label: "Todos los períodos" 
        };
    }
  };

  const handleFilterSelect = (filterValue: string) => {
    const dateRange = getDateRangeFromFilter(filterValue);
    onFilterChange({
      type: 'custom',
      startDate: dateRange.startDate || new Date(2020, 0, 1),
      endDate: dateRange.endDate || new Date(2030, 11, 31),
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

// Component for ViewToggle (3 vistas: Original, Operativa, USD)
function ViewToggle({ 
  selectedView, 
  onViewChange, 
  className 
}: { 
  selectedView: 'original' | 'operativa' | 'usd';
  onViewChange: (view: 'original' | 'operativa' | 'usd') => void;
  className?: string;
}) {
  const viewOptions = [
    { value: 'operativa', label: 'Vista Operativa', description: 'Moneda nativa por cliente' },
    { value: 'usd', label: 'USD Consolidada', description: 'Todo en USD' },
    { value: 'original', label: 'Vista Original', description: 'Datos sin procesar' }
  ];

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Vista:</Label>
        <Select value={selectedView} onValueChange={onViewChange}>
          <SelectTrigger className="w-48">
            <SelectValue>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {viewOptions.find(v => v.value === selectedView)?.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {viewOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Component for ProjectTeamSection with enhanced functionality - REFACTORED to use projectVM
function ProjectTeamSection({ 
  projectId, 
  projectVM, 
  quotationTeam = []
}: { 
  projectId: string; 
  projectVM: ReturnType<typeof toProjectVM> | null;
  quotationTeam?: any[];
}) {
  const { toast } = useToast();

  // FUNCIÓN PARA CALCULAR MULTIPLICADOR TEMPORAL (mantener para escalado de cotización)
  const getQuotationMultiplier = (hours: number): number => {
    // Si las horas de cotización son muy bajas, probablemente son mensuales
    // Si son normales (>40h), probablemente son totales del proyecto
    return hours > 0 && hours < 20 ? 1 : 1;
  };

  // ✅ USAR PROJECTVM COMO SINGLE SOURCE OF TRUTH
  const teamBreakdownArray = projectVM?.teamBreakdown || [];
  
  // Enriquecer con datos de cotización si están disponibles
  const completeTeam = teamBreakdownArray.map((member: any) => {
    const quotationMember = quotationTeam.find((q: any) => q.personnelId === member.personnelId);
    
    // 🎯 3-HOURS ARCHITECTURE: Extract correct hour values from SoT
    const hoursAsana = member.hoursAsana || 0;  // Real tracked hours
    const hoursBilling = member.hoursBilling || 0;  // Billable hours
    const targetHours = member.targetHours || quotationMember?.hours || 0;  // Budget hours
    const costValue = member.costUSD || member.costARS || member.cost || 0;
    
    return {
      personnelId: member.personnelId,
      name: member.name || member.roleName || 'Sin Nombre',
      roleName: member.roleName || 'Sin Rol',
      hours: hoursBilling,  // Use billing hours for legacy compatibility
      cost: costValue,
      rate: member.rate || (costValue && hoursBilling ? costValue / hoursBilling : 0),
      // Datos de cotización (si existen)
      quotedHours: quotationMember?.hours || 0,
      quotedRate: quotationMember?.rate || 0,
      // Para compatibilidad con el template
      actualHours: hoursAsana,  // ✅ FIX: Use hoursAsana from SoT
      actualName: member.name || 'Sin Nombre',
      actualRoleName: member.roleName || 'Sin Rol',
      actualRate: member.rate || (costValue && hoursBilling ? costValue / hoursBilling : 0),
      actualCost: costValue,
      estimatedHours: targetHours,
      targetHours: targetHours,
      // 🎯 3-HOURS: Include all hour types for detailed analysis
      hoursAsana: hoursAsana,
      hoursBilling: hoursBilling,
      isQuoted: !!quotationMember,
      isUnquoted: !quotationMember && hoursAsana > 0
    };
  });
  
  const teamLoading = !projectVM;

  const copyTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/copy-quotation-team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
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



  const getProgressPercentage = (workedHours: number, estimatedHours: number, targetHours?: number) => {
    // Usar horas objetivo del Excel MAESTRO si están disponibles, si no, usar estimadas de la cotización
    const referenceHours = (targetHours && targetHours > 0) ? targetHours : estimatedHours;
    if (referenceHours === 0) return 0;
    return Math.round((workedHours / referenceHours) * 100);
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
      <div className="text-center py-8 text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm mb-3">No hay equipo asignado a este proyecto</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => copyTeamMutation.mutate()}
          disabled={copyTeamMutation.isPending}
          className="border-gray-200 hover:bg-gray-50"
        >
          {copyTeamMutation.isPending ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
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
          // 🎯 3-HOURS ARCHITECTURE: Use normalized fields from backend
          const workedHours = member.hoursAsana || member.actualHours || 0;  // Prefer hoursAsana (normalized)
          const targetHours = member.targetHours || member.estimatedHours || 0;
          const progressPercent = getProgressPercentage(workedHours, targetHours, member.targetHours);
          // Usar horas objetivo para calcular presupuesto restante y estado de exceso
          const referenceHours = (member.targetHours && member.targetHours > 0) ? member.targetHours : targetHours;
          const remainingHours = Math.max(0, referenceHours - workedHours);
          
          // 🎯 Use unified performance helper for consistent ±5% thresholds
          const perfStatus = getUtilizationStatus(workedHours, referenceHours);
          const isOverBudget = perfStatus.status === 'alto'; // ≥105% utilization
          
          // Definir colores y estilos basados en el estado del miembro - SIMPLIFICADO A VERDE/ROJO/GRIS
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
            } else if (isOverBudget || progressPercent >= 100) {
              // Rojo: Exceso crítico o completado
              return {
                bgGradient: "bg-gradient-to-r from-red-50 to-red-100",
                borderColor: "border-red-300",
                textColor: "text-red-700",
                avatarBg: "bg-gradient-to-br from-red-500 to-red-600",
                nameColor: "text-red-900",
                roleColor: "text-red-600"
              };
            } else if (progressPercent > 0) {
              // Verde: En progreso normal
              return {
                bgGradient: "bg-gradient-to-r from-green-50 to-green-100",
                borderColor: "border-green-300",
                textColor: "text-green-700",
                avatarBg: "bg-gradient-to-br from-green-500 to-green-600",
                nameColor: "text-green-900",
                roleColor: "text-green-700"
              };
            } else {
              // Gris: Sin progreso
              return {
                bgGradient: "bg-gradient-to-r from-gray-50 to-gray-100",
                borderColor: "border-gray-300",
                textColor: "text-gray-600",
                avatarBg: "bg-gradient-to-br from-gray-400 to-gray-500",
                nameColor: "text-gray-700",
                roleColor: "text-gray-500"
              };
            }
          };

          const cardStyle = getCardStyle();

          return (
            <div key={member.personnelId || member.id} className={`flex items-center justify-between p-3 border-l-4 ${cardStyle.borderColor} bg-white/60 backdrop-blur-sm rounded-lg hover:bg-white/80 transition-all duration-200 border border-gray-100 ${member.isUnquoted ? 'border-gray-400 bg-gray-50/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 ${cardStyle.avatarBg} rounded-full flex items-center justify-center shadow-sm`}>
                    <span className="text-white text-xs font-bold">
                      {(member.actualName || 'MB').split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase()}
                    </span>
                  </div>
                  {/* Badge de progreso - simplificado a verde/rojo/gris */}
                  <div className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border border-white ${
                    progressPercent >= 100 ? 'bg-red-600 text-white' : 
                    progressPercent > 0 ? 'bg-green-600 text-white' :
                    'bg-gray-400 text-white'
                  }`}>
                    {progressPercent}
                  </div>
                </div>
                <div className="flex-1">
                  <div className={`font-medium text-sm ${cardStyle.nameColor} flex items-center gap-2`}>
                    {member.actualName || 'Miembro del Equipo'}
                    {member.isUnquoted && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-gray-400 text-gray-700 bg-gray-50">
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
                <div className="text-center min-w-[80px]">
                  <div className={`text-sm font-bold ${cardStyle.textColor}`}>
                    {workedHours.toFixed(1)}h
                  </div>
                  <div className="text-xs text-gray-500">
                    {/* Mostrar horas objetivo si están disponibles, sino estimadas de cotización */}
                    {member.targetHours > 0 ? (
                      <>
                        de {member.targetHours}h objetivo {member.timeMultiplier > 1 ? `(x${member.timeMultiplier})` : ''}
                        {targetHours > 0 && (
                          <span className="text-gray-400 ml-1">
                            | {targetHours}h cotización
                          </span>
                        )}
                      </>
                    ) : targetHours > 0 ? (
                      <>de {targetHours.toFixed(0)}h estimadas {member.timeMultiplier > 1 ? `(x${member.timeMultiplier})` : ''}</>
                    ) : (
                      <span className="text-gray-500">Sin horas asignadas</span>
                    )}
                  </div>
                </div>

                {/* Barra de progreso más sutil */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-24 bg-gray-100 rounded-full h-2 cursor-pointer relative overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isOverBudget || progressPercent >= 100 ? 'bg-red-500' :
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
                      {member.targetHours > 0 ? (
                        <>
                          <div className="text-gray-700 font-medium">
                            Objetivo estimado: {member.targetHours}h
                          </div>
                          {targetHours > 0 && (
                            <div className="text-gray-500">
                              Estimadas (cotización): {targetHours}h
                            </div>
                          )}
                          <div>Progreso vs objetivo: {progressPercent}%</div>
                          <div className="text-gray-700">
                            Eficiencia: {((member.targetHours / Math.max(workedHours, 0.1)) * 100).toFixed(0)}%
                          </div>
                        </>
                      ) : targetHours > 0 ? (
                        <>
                          <div>Estimadas (cotización): {targetHours}h</div>
                          <div>Progreso: {progressPercent}%</div>
                        </>
                      ) : (
                        <div className="text-gray-500">
                          ⚠️ Sin horas de referencia asignadas
                        </div>
                      )}
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
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-700 border-gray-200">
                    Parcial
                  </Badge>
                )}

                {/* Costo más discreto */}
                <div className="text-right min-w-[70px]">
                  <div className={`text-sm font-semibold ${cardStyle.nameColor}`}>
                    {formatCurrency(member.actualCost || (workedHours * (member.actualRate || 0)), projectVM?.currencyNative || 'USD')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(member.actualCost && workedHours > 0 ? (member.actualCost / workedHours) : member.actualRate || 0, projectVM?.currencyNative || 'USD')}/h
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

// 📊 Simple Sparkline Component
function Sparkline({ data, color = "white", className = "" }: { data: number[], color?: string, className?: string }) {
  // Handle edge cases
  if (!data || data.length === 0) return null;
  
  const width = 80;
  const height = 24;
  
  // Single data point - render as a horizontal line
  if (data.length === 1) {
    const y = height / 2;
    return (
      <svg width={width} height={height} className={className}>
        <line
          x1="0"
          y1={y}
          x2={width}
          y2={y}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    );
  }
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

// 🎨 Get threshold color for KPIs - SIMPLIFICADO A VERDE/ROJO
function getThresholdColor(value: number, metric: 'margin' | 'markup' | 'roi'): string {
  if (metric === 'margin') {
    if (value >= 30) return 'text-green-400';
    return 'text-red-400';
  }
  if (metric === 'markup') {
    if (value >= 2.0) return 'text-green-400';
    return 'text-red-400';
  }
  if (metric === 'roi') {
    if (value >= 50) return 'text-green-400';
    return 'text-red-400';
  }
  return 'text-white';
}

const ProjectDetailsPage = () => {
  // Obtener projectId de la URL de manera más robusta
  const [location, setLocation] = useLocation();
  const projectId = location.split('/')[2]; // /active-projects/{id}
  
  // Debug: Verificar que el projectId se obtenga correctamente
  console.log('🔍 Location debug:', { location, projectId, urlParts: location.split('/') });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Verificar si hay parámetros en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const periodFromUrl = urlParams.get('period'); // 🎯 NEW: Support period=YYYY-MM from URL
  
  const [activeTab, setActiveTab] = useState(tabFromUrl || "dashboard");
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<'original' | 'operativa' | 'usd'>('operativa');

  // Estado del filtro temporal - configurado por defecto para mostrar agosto 2025 donde están los datos reales
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    // Configurar por defecto para mostrar agosto 2025 donde están los datos de Huggies
    const augustDate = new Date(2025, 7, 1); // Agosto 2025 (mes 7 porque es 0-indexed)
    return {
      type: 'month',
      startDate: startOfMonth(augustDate) as Date,
      endDate: endOfMonth(augustDate) as Date,
      label: `Agosto 2025`
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
    
    // Meses específicos - mapear tanto español como inglés
    if (label.includes('enero') || label.includes('january')) return 'january_2025';
    if (label.includes('febrero') || label.includes('february')) return 'february_2025';
    if (label.includes('marzo') || label.includes('march')) return 'march_2025';
    if (label.includes('abril') || label.includes('april')) return 'april_2025';
    if (label.includes('mayo') || label.includes('may')) return 'may_2025';
    if (label.includes('junio') || label.includes('june')) return 'june_2025';
    if (label.includes('julio') || label.includes('july')) return 'july_2025';
    if (label.includes('agosto') || label.includes('august')) return 'august_2025';
    if (label.includes('septiembre') || label.includes('september')) return 'september_2025';
    if (label.includes('octubre') || label.includes('october')) return 'october_2025';
    if (label.includes('noviembre') || label.includes('november')) return 'november_2025';
    if (label.includes('diciembre') || label.includes('december')) return 'december_2025';
    
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
      
      // Para rangos de múltiples meses, usar formato YYYY-MM-DD_to_YYYY-MM-DD
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const customRange = `${formatDate(filter.startDate)}_to_${formatDate(filter.endDate)}`;
      console.log(`📅 Generated custom range filter: ${customRange}`);
      return customRange;
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
  
  // 🎯 Calculate period (YYYY-MM) from dateFilter for SoT integration
  const periodFromFilter = dateFilter.startDate && dateFilter.endDate 
    ? (() => {
        const start = dateFilter.startDate;
        const end = dateFilter.endDate;
        const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        
        // Si el rango es exactamente un mes, usar ese mes
        if (monthDiff === 0 || (monthDiff === 1 && end.getDate() === 1 && start.getDate() === 1)) {
          const year = start.getFullYear();
          const month = String(start.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
        }
        return undefined;
      })()
    : undefined;
  
  // 🎯 PRIORITY FIX: Use periodFromFilter (calculated from dateFilter) first, fallback to URL
  // This ensures the visual date filter always takes precedence over stale URL params
  // 🎯 ONE-SHOT FIX: When filter is "all", force period to be 'all' for lifetime aggregation
  const finalPeriod = timeFilterForHook === 'all' 
    ? 'all' 
    : (periodFromFilter || periodFromUrl || undefined);
  
  const { data: unifiedData, isLoading: dataLoading, error: dataError } = useCompleteProjectData(
    projectId ? parseInt(projectId, 10) : NaN, 
    timeFilterForHook,
    finalPeriod, // 🎯 Use URL period or calculated period from filter
    selectedView // 🎯 NEW: Pass selected view (original|operativa|usd)
  );
  
  // 📊 Horas internas de tareas con costo estimado
  const { data: taskHoursCostData } = useQuery<{ projects: { projectId: number; totalHours: number; totalCostUSD: number; byPerson: { personnelId: number; name: string; hours: number; costUSD: number; rateLabel: string; contractType: string }[] }[] }>({
    queryKey: ["/api/tasks/hours-cost", projectId, finalPeriod],
    queryFn: () => {
      const pid = parseInt(projectId || "", 10);
      if (!pid || pid >= 1_000_000) return Promise.resolve({ projects: [] });
      const periodParam = finalPeriod && finalPeriod !== "all" ? `&period=${finalPeriod}` : "";
      return authFetch(`/api/tasks/hours-cost?projectId=${pid}${periodParam}`).then(r => r.json());
    },
    staleTime: 120_000,
    enabled: !!projectId && parseInt(projectId, 10) < 1_000_000,
  });

  const taskHoursCost = taskHoursCostData?.projects?.find(p => p.projectId === parseInt(projectId || "", 10));

  // 🔧 FORCE REFETCH: Invalidate cache when period or view changes to get fresh previousPeriod data
  useEffect(() => {
    if (projectId && finalPeriod) {
      console.log('🔧 INVALIDATING CACHE for period:', finalPeriod, 'view:', selectedView);
      queryClient.invalidateQueries({
        queryKey: ['projects', parseInt(projectId), 'complete-data', finalPeriod, selectedView || 'operativa']
      });
    }
  }, [projectId, finalPeriod, selectedView, queryClient]);

  // 📊 Tipos para queries analytics (evitar errores LSP con tipo vacío {})
  interface MonthlyTrendsData {
    rows?: Array<{
      period: string;
      markup?: number;
      margin_pct?: number;
      hours_asana?: number;
      cost_usd?: number;
      [key: string]: any;
    }>;
  }

  interface OperationalMetricsData {
    kpis?: any;
    workload?: any;
    bottlenecks?: any;
    riskBreakdown?: {
      total?: number;
      wipScore?: number;
      overloadScore?: number;
      dependencyScore?: number;
      [key: string]: any;
    };
    recommendations?: any[];
  }

  // 📊 Datos de tendencias mensuales para sparklines y gráficos
  const { data: monthlyTrends } = useQuery<MonthlyTrendsData>({
    queryKey: [`/api/projects/${projectId}/monthly-trends`, selectedView],
    enabled: !!projectId,
  });

  // 🔧 Operational Metrics (WIP, Lead Time, Throughput, Workload, Risk)
  const { data: operationalMetrics, isLoading: operationalLoading } = useQuery<OperationalMetricsData>({
    queryKey: [`/api/projects/${projectId}/operational-metrics?timeFilter=${timeFilterForHook}`, timeFilterForHook],
    enabled: !!projectId,
  });

  // Cliente del proyecto
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(unifiedData as any)?.project?.clientId}`],
    enabled: !!(unifiedData as any)?.project?.clientId,
  });

  // Eficiencia del equipo desde deviation analysis (para header)
  const { data: deviationAnalysisData } = useQuery({
    queryKey: [`/api/projects/${projectId}/deviation-analysis`, timeFilterForHook, 'ECON'],
    queryFn: async () => {
      const queryParams = timeFilterForHook 
        ? `?timeFilter=${timeFilterForHook}&basis=ECON`
        : '?basis=ECON';
      const response = await authFetch(`/api/projects/${projectId}/deviation-analysis${queryParams}`);
      return response.json();
    },
    enabled: !!projectId,
  });

  const efficiencyFromDeviationAPI = deviationAnalysisData?.summary?.efficiencyPct;

  // Datos derivados para compatibilidad con componentes existentes
  const project = (unifiedData as any)?.project;
  const isLoading = dataLoading;
  
  // ✅ Use quotation data directly from backend (already normalized)
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
    if (!quotationData) return { isValid: false, reason: 'No quotation data' };
    
    const multiplier = getQuotationMultiplier();
    const baseHours = quotationData.estimatedHours || 0;
    const baseBudget = quotationData.totalAmountNative || 0;
    
    // Validaciones
    const isValid = 
      multiplier >= 1 && multiplier <= 12 && // Multiplicador en rango válido
      baseBudget >= 0 && // Presupuesto base válido
      Number.isInteger(multiplier); // Multiplicador es entero
    
    return {
      isValid,
      multiplier,
      baseHours,
      baseBudget,
      scaledHours: baseHours * multiplier,
      scaledBudget: baseBudget * multiplier,
      filter: timeFilterForHook,
      reason: !isValid ? 'Invalid multiplier or base values' : 'Valid'
    };
  }, [quotationData, getQuotationMultiplier, timeFilterForHook]);

  // VALIDACIÓN SILENCIOSA DEL ESCALAMIENTO TEMPORAL
  const validation = validateScalingLogic();
  
  // Solo mostrar errores críticos en consola
  if (!validation.isValid) {
    console.warn('⚠️ Problema con escalamiento temporal:', validation.reason);
  }
  if (unifiedData) {
    console.log('🚀 CURRENT DATA SET:');
    console.log('  - Estimated hours:', quotationData?.estimatedHours || -1);
    console.log('  - Quotation budget (native):', quotationData?.totalAmountNative || -1);
    console.log('  - Total worked hours:', (unifiedData as any).actuals?.totalWorkedHours || -1);
    console.log('  - Total worked cost:', (unifiedData as any).actuals?.totalWorkedCost || -1);
    console.log('  - Markup:', (unifiedData as any).metrics?.markup || -1);
    console.log('  - Efficiency:', (unifiedData as any).metrics?.efficiency || -1);
    console.log('  - Total entries:', (unifiedData as any).actuals?.totalEntries || -1);
    console.log('🚀 Data should change when filter changes above');
  }

  // 🎯 SELECTOR ÚNICO: ViewModel consolidado (no reconvertir)
  const projectVM = useMemo(() => {
    if (!unifiedData) return null;
    
    const vm = toProjectVM({
      summary: unifiedData.summary as any,
      actuals: unifiedData.actuals,
      quotation: unifiedData.quotation,
      metrics: unifiedData.metrics
    });

    console.log('🎯 PROJECT VM:', {
      costDisplay: vm.costDisplay,
      currencyNative: vm.currencyNative,
      revenueDisplay: vm.revenueDisplay,
      markup: vm.markup,
      flags: vm.flags
    });

    // 🔒 ASSERTS DE CONSISTENCIA (Punto 8 del checklist)
    const views = (unifiedData as any).views;
    if (views && views[selectedView]) {
      const v = views[selectedView];
      
      // ASSERT 1: Anti-mezcla de moneda en vista
      if (selectedView !== 'original') {
        const currencyConsistent = v.currency === vm.currencyNative;
        console.assert(currencyConsistent, 
          '🚨 [ASSERT FAILED] Moneda inconsistente en vista', { 
            view: selectedView, 
            viewCurrency: v.currency, 
            vmCurrency: vm.currencyNative,
            viewData: v 
          });
      }
      
      // ASSERT 2: Budget Utilization correctamente calculado
      if (selectedView !== 'original' && v.cotizacion && v.cotizacion > 0) {
        const expectedBU = v.cost / v.cotizacion;
        const actualBU = v.budgetUtilization ?? expectedBU;
        const buDiff = Math.abs(actualBU - expectedBU);
        console.assert(buDiff < 1e-6, 
          '🚨 [ASSERT FAILED] Budget Utilization mal calculado', { 
            view: selectedView,
            expected: expectedBU,
            actual: actualBU,
            diff: buDiff,
            cost: v.cost,
            cotizacion: v.cotizacion
          });
      }
      
      // ASSERT 3: Markup y Margin coherentes
      if (v.revenue && v.cost && v.cost > 0) {
        const expectedMarkup = v.revenue / v.cost;
        const expectedMargin = ((v.revenue - v.cost) / v.revenue) * 100;
        
        if (v.markup != null) {
          const markupDiff = Math.abs(v.markup - expectedMarkup);
          console.assert(markupDiff < 0.01, 
            '🚨 [ASSERT FAILED] Markup mal calculado', { 
              view: selectedView,
              expected: expectedMarkup,
              actual: v.markup,
              diff: markupDiff
            });
        }
        
        if (v.margin != null) {
          const marginDiff = Math.abs(v.margin - expectedMargin);
          console.assert(marginDiff < 0.1, 
            '🚨 [ASSERT FAILED] Margin mal calculado', { 
              view: selectedView,
              expected: expectedMargin,
              actual: v.margin,
              diff: marginDiff
            });
        }
      }
      
      // 🎯 ASSERTS ESPECÍFICOS PERFORMANCE (3-hours architecture)
      console.assert(Number.isFinite(vm.totalAsanaHours), 
        '🚨 [ASSERT FAILED] totalAsanaHours faltante o no finito', vm.totalAsanaHours);
      console.assert(vm.estimatedHours >= 0, 
        '🚨 [ASSERT FAILED] estimatedHours faltante o negativo', vm.estimatedHours);
      
      const tb = vm.teamBreakdown ?? [];
      console.assert(tb.every(p => p.roleName), 
        '🚨 [ASSERT FAILED] roleName faltante en teamBreakdown', tb.filter(p => !p.roleName));
      
      const sumAsana = tb.reduce((a, p) => a + (p.hoursAsana || 0), 0);
      console.assert(Math.abs(sumAsana - vm.totalAsanaHours) < 1e-6, 
        '🚨 [ASSERT FAILED] Σ hoursAsana != totalAsanaHours', { 
          sumAsana, 
          totalAsanaHours: vm.totalAsanaHours, 
          diff: Math.abs(sumAsana - vm.totalAsanaHours) 
        });
      
      const sumTarget = tb.reduce((a, p) => a + (p.targetHours || 0), 0);
      console.assert(Math.abs(sumTarget - vm.estimatedHours) < 1e-6, 
        '🚨 [ASSERT FAILED] Σ targetHours != estimatedHours', { 
          sumTarget, 
          estimatedHours: vm.estimatedHours, 
          diff: Math.abs(sumTarget - vm.estimatedHours) 
        });
      
      // LOG de trazabilidad por período
      console.log(`📊 [VIEW ${selectedView.toUpperCase()}] period=${periodFromUrl || periodFromFilter}`, {
        revenue: v.revenue,
        cost: v.cost,
        currency: v.currency,
        cotizacion: v.cotizacion,
        budgetUtilization: v.budgetUtilization,
        markup: v.markup,
        margin: v.margin
      });
    }

    // 🔒 GUARDAS ADICIONALES (Checklist punto 8)
    
    // ASSERT 4: Verificar que cotizacion y budgetUtilization son coherentes
    const cotizacion = quotationData?.totalAmountNative || null;
    if (cotizacion && cotizacion > 0 && vm.budgetUtilization != null && vm.costDisplay > 0) {
      const expectedBU = vm.costDisplay / cotizacion;
      const buDiff = Math.abs(vm.budgetUtilization - expectedBU);
      console.assert(buDiff < 1e-6, 
        '🚨 [GUARDA FAILED] BU inconsistente', { 
          costDisplay: vm.costDisplay,
          costDisplayType: typeof vm.costDisplay,
          cotizacion,
          cotizacionType: typeof cotizacion,
          expectedBU,
          actualBU: vm.budgetUtilization,
          diff: buDiff
        });
    }
    
    // ASSERT 5: Currency nativa debe estar presente
    console.assert(vm.currencyNative, 
      '🚨 [GUARDA FAILED] currency faltante', { vm });
    
    // ASSERT 6: TeamBreakdown debe tener roleName en cada miembro
    console.assert((vm.teamBreakdown ?? []).every(p => !!p.roleName), 
      '🚨 [GUARDA FAILED] roleName faltante en teamBreakdown', { 
        teamBreakdown: vm.teamBreakdown 
      });
    
    // ASSERT 7: Horas sospechosamente altas para un mes
    console.assert((vm.totalHours || 0) <= 400, 
      '🚨 [GUARDA FAILED] Horas sospechosamente altas para un mes', { 
        totalHours: vm.totalHours,
        period: periodFromUrl || periodFromFilter
      });

    return vm;
  }, [
    unifiedData?.summary?.costDisplay,
    unifiedData?.summary?.currencyNative,
    unifiedData?.summary?.revenueDisplay,
    unifiedData?.summary?.markup,
    unifiedData?.actuals?.totalWorkedCost,
    unifiedData?.actuals?.totalWorkedHours,
    quotationData?.totalAmountNative,
    quotationData?.estimatedHours,
    unifiedData?.metrics?.budgetUtilization,
    unifiedData?.metrics?.efficiency,
    selectedView,
    periodFromUrl,
    periodFromFilter
  ]);

  // 📊 Procesar datos de tendencias mensuales para sparklines
  const trendData = useMemo(() => {
    if (!monthlyTrends?.rows || monthlyTrends.rows.length === 0) {
      return { markup: [], margin: [], burnRate: [], roi: [] };
    }
    
    // Ordenar por período y tomar últimos 6 meses
    const sorted = [...monthlyTrends.rows]
      .sort((a: any, b: any) => a.period.localeCompare(b.period))
      .slice(-6);
    
    return {
      markup: sorted.map((row: any) => row.markup || 0),
      margin: sorted.map((row: any) => (row.margin_pct || 0)),
      burnRate: sorted.map((row: any) => 
        row.hours_asana > 0 ? row.cost_usd / row.hours_asana : 0
      ),
      roi: sorted.map((row: any) => 
        row.markup ? (row.markup - 1) * 100 : 0
      )
    };
  }, [monthlyTrends]);

  // MÉTRICAS SIMPLIFICADAS - TODAS DESDE SINGLE SOURCE OF TRUTH
  const metrics = useMemo(() => {
    if (!unifiedData) return [];

    const { quotation, actuals, metrics: unifiedMetrics } = unifiedData;

    // Verificar que quotation existe
    if (!quotation || !quotation.baseCost) {
      console.warn('⚠️ Quotation data missing, returning default metrics');
      return [
        {
          label: "Sin presupuesto",
          value: "$0",
          subtitle: "No hay datos de cotización",
          icon: AlertTriangle,
          color: "text-gray-600",
          bgColor: "bg-gradient-to-br from-gray-50 to-gray-100",
          change: 0
        }
      ];
    }

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
        value: (() => {
          if (!projectVM) return '$0';
          // 🎯 USAR PROJECT VM: No reconvertir
          return formatCurrency(projectVM.costDisplay, projectVM.currencyNative);
        })(),
        subtitle: `Objetivo: $${(unifiedData?.quotation?.baseCost || 0).toLocaleString()} | ${budgetUtilization <= 100 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(budgetUtilization - 100).toFixed(1)}%`,
        icon: DollarSign,
        color: budgetStyle.color,
        bgColor: budgetStyle.bgColor,
        change: budgetUtilization - 100
      },
      {
        label: `Horas vs Objetivo`,
        value: `${actuals.totalWorkedHours.toFixed(1)}h`,
        subtitle: `Objetivo: ${(unifiedData?.quotation?.estimatedHours || 0).toFixed(1)}h | ${efficiency <= 100 ? 'Bajo objetivo' : 'Exceso'}: ${Math.abs(efficiency - 100).toFixed(1)}%`,
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
          // 🎯 USAR PROJECT VM: Calcular budgetUtil con moneda nativa
          if (!projectVM) return "Sin datos";
          const quotationTotal = quotationData?.totalAmountNative || 1;
          const actualBudgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
          
          console.log('🚨 ESTADO DEBUG:', { 
            budgetUtilization, 
            efficiency, 
            costDisplay: projectVM.costDisplay,
            quotationTotal,
            calculatedBudget: actualBudgetUtil,
            currency: projectVM.currencyNative
          });
          
          let resultado;
          if (actualBudgetUtil <= 85) resultado = "Excelente";
          else if (actualBudgetUtil <= 100) resultado = "Bueno";
          else if (actualBudgetUtil <= 110) resultado = "Regular";
          else resultado = "Crítico";
          
          console.log('🚨 CARD ESTADO RESULT:', { actualBudgetUtil, resultado });
          return resultado;
        })(),
        subtitle: (() => {
          if (!projectVM) return "Sin datos";
          const quotationTotal = quotationData?.totalAmountNative || 1;
          const actualBudgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
          if (actualBudgetUtil <= 85) return "🏆 Salud financiera excelente";
          if (actualBudgetUtil <= 100) return "✅ Salud financiera buena";
          if (actualBudgetUtil <= 110) return "🟡 Requiere atención";
          return "🔴 Estado crítico";
        })(),
        icon: (() => {
          if (!projectVM) return AlertTriangle;
          const quotationTotal = quotationData?.totalAmountNative || 1;
          const actualBudgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
          if (actualBudgetUtil <= 85) return Crown;
          if (actualBudgetUtil <= 100) return CheckCircle2;
          if (actualBudgetUtil <= 110) return AlertTriangle;
          return TrendingDown;
        })(),
        color: (() => {
          if (!projectVM) return "text-gray-700";
          const quotationTotal = quotationData?.totalAmountNative || 1;
          const actualBudgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
          if (actualBudgetUtil <= 85) return "text-emerald-700";
          if (actualBudgetUtil <= 100) return "text-green-700";
          if (actualBudgetUtil <= 110) return "text-yellow-700";
          return "text-red-700";
        })(),
        bgColor: (() => {
          if (!projectVM) return "bg-gray-50";
          const quotationTotal = quotationData?.totalAmountNative || 1;
          const actualBudgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
          if (actualBudgetUtil <= 85) return "bg-emerald-50";
          if (actualBudgetUtil <= 100) return "bg-green-50";
          if (actualBudgetUtil <= 110) return "bg-yellow-50";
          return "bg-red-50";
        })(),
      }
    ];
  }, [unifiedData, project, projectVM]);

  // 🛡️ WATCHDOG: Detectar cuando summary desaparece (solo DEV)
  useEffect(() => {
    if (import.meta.env.MODE !== 'production' && unifiedData) {
      const prevData = (window as any).__prevUnifiedData;
      if (prevData) {
        watchSummaryDropped(prevData, unifiedData, 'unifiedData update');
      }
      (window as any).__prevUnifiedData = unifiedData;
    }
  }, [unifiedData]);

  // CRITICAL FIX: Use filtered team data from actuals instead of quotation team
  // This ensures temporal filtering is respected across ALL tabs
  const teamStats = useMemo(() => {
    if (!unifiedData?.actuals?.teamBreakdown) return [];
    
    // teamBreakdown comes as an array from backend, not an object
    const teamBreakdownArray = Array.isArray(unifiedData.actuals.teamBreakdown) 
      ? unifiedData.actuals.teamBreakdown 
      : [];
    
    console.log('🔍 DEBUG teamStats processing:', {
      teamBreakdownArray: teamBreakdownArray.slice(0, 3),
      isArray: Array.isArray(unifiedData.actuals.teamBreakdown),
      length: teamBreakdownArray.length
    });
    
    // Convert team breakdown from backend into format expected by UI (includes targetHours)
    return teamBreakdownArray.map((data: any) => ({
      id: data.personnelId || 0,
      personnelId: data.personnelId || 0,
      name: data.name,
      hours: data.hours || 0,
      cost: data.cost || 0,
      entries: data.entries || 0,
      lastActivity: data.lastActivity || null,
      targetHours: data.targetHours || 0, // NUEVO: Horas objetivo del Excel MAESTRO
      isFromExcel: data.isFromExcel || false
    }));
  }, [unifiedData?.actuals?.teamBreakdown]);

  // 🛡️ GUARD: Detectar reconversiones incorrectas (solo DEV)
  useEffect(() => {
    if (import.meta.env.MODE === 'production' || !unifiedData || !projectVM) return;
    
    const s = unifiedData.summary?.costDisplay;
    const a = unifiedData.actuals?.totalWorkedCost;
    const shown = projectVM.costDisplay;
    
    if (s && a && shown) {
      const ratio = s / a;
      // Solo advertir si se está MOSTRANDO el valor USD en lugar del nativo
      if (ratio > 300 && ratio < 5000 && Math.abs(shown - a) < 0.01) {
        console.error('🚨 [CONSISTENCY] Detalle usando USD en UI. Esperado summary.costDisplay en moneda nativa.', {
          summaryCostDisplay: s,
          actualsUSD: a,
          shownValue: shown,
          ratio,
          currency: unifiedData.summary?.currencyNative
        });
      }
    }
  }, [unifiedData?.summary?.costDisplay, unifiedData?.actuals?.totalWorkedCost, unifiedData?.summary?.currencyNative, projectVM?.costDisplay]);

  // 🔍 RASTREO: Detectar de dónde viene el valor mostrado (solo DEV)
  useEffect(() => {
    if (import.meta.env.MODE === 'production' || !projectVM || !unifiedData) return;
    
    const valueShown = projectVM.costDisplay;
    const s = unifiedData.summary?.costDisplay;
    const a = unifiedData.actuals?.totalWorkedCost;
    const cur = projectVM.currencyNative;
    
    if (s != null && Math.abs(valueShown - s) < 0.01) {
      console.log(`✅ [COST OK][PresupuestoCard] summary.costDisplay (${cur}) =`, valueShown);
    } else if (a != null && Math.abs(valueShown - a) < 0.01) {
      console.warn(`⚠️ [COST MISMATCH][PresupuestoCard] mostrando actuals.totalWorkedCost (USD) =`, valueShown, 
        `| Expected summary.costDisplay =`, s);
    } else {
      console.log(`🔍 [COST][PresupuestoCard] valor derivado =`, valueShown, { cur, s, a });
    }
  }, [projectVM?.costDisplay, unifiedData?.summary?.costDisplay, unifiedData?.actuals?.totalWorkedCost, projectVM?.currencyNative]);

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
    const isAuthError = dataError && (String(dataError).includes("401") || String(dataError).includes("autenticad") || String(dataError).includes("Unauthorized"));
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className={`h-12 w-12 mx-auto mb-4 ${isAuthError ? "text-amber-500" : "text-red-500"}`} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isAuthError ? "Sesión expirada" : "Proyecto no encontrado"}
          </h2>
          <p className="text-gray-600 mb-4">
            {isAuthError
              ? "Tu sesión expiró. Cerrá sesión y volvé a entrar para continuar."
              : "El proyecto solicitado no existe o no tienes permisos para verlo."}
          </p>
          <div className="flex gap-3 justify-center">
            {isAuthError && (
              <Button variant="default" onClick={() => setLocation("/auth")}>
                Ir a iniciar sesión
              </Button>
            )}
            <Button variant={isAuthError ? "outline" : "default"} onClick={() => setLocation("/active-projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Proyectos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Verificar si el proyecto está fuera del rango para proyectos one-shot
  if ((unifiedData as any)?.isOutOfRange) {
    const activityRange = (unifiedData as any)?.activityRange;
    const timeFilter = (unifiedData as any)?.timeFilter;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <CalendarDays className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin Datos en este Período</h2>
          </div>
          
          <div className="space-y-4 text-gray-600">
            <p className="leading-relaxed">
              Este proyecto <strong>one-shot</strong> solo tiene actividad registrada entre <br />
              <span className="font-semibold text-blue-600">{activityRange?.startPeriod}</span> y{' '}
              <span className="font-semibold text-blue-600">{activityRange?.endPeriod}</span>
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-700">
                <strong>Filtro actual:</strong> {timeFilter} <br />
                No hay datos registrados para este período.
              </p>
            </div>
            
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-gray-700">Opciones:</p>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="default" 
                  onClick={() => {
                    // Cambiar filtro a "Todos los períodos"
                    setDateFilter({
                      type: 'custom',
                      startDate: new Date(2020, 0, 1),
                      endDate: new Date(2030, 11, 31),
                      label: 'Todos los períodos'
                    });
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Ver Todos los Períodos
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setLocation("/active-projects")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Proyectos
                </Button>
              </div>
            </div>
          </div>
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

              {/* Filtros: Vista y Período */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-3">
                  <ViewToggle 
                    selectedView={selectedView}
                    onViewChange={setSelectedView}
                    className="flex-shrink-0"
                  />
                  <TimeRangeFilter 
                    selectedFilter={dateFilter}
                    onFilterChange={setDateFilter}
                    className="flex-shrink-0"
                  />
                </div>
                
                {/* 🔥 QUARTER INFO BADGE */}
                {(() => {
                  const filterValue = getTimeFilterForHook(dateFilter);
                  const quarterMap: Record<string, { quarter: string, months: string }> = {
                    'current_quarter': (() => {
                      const now = new Date();
                      const currentMonth = now.getMonth() + 1; // 1-12
                      const quarterNum = Math.floor((currentMonth - 1) / 3) + 1; // 1-4
                      const monthNames = [
                        ['Enero', 'Febrero', 'Marzo'],
                        ['Abril', 'Mayo', 'Junio'],
                        ['Julio', 'Agosto', 'Septiembre'],
                        ['Octubre', 'Noviembre', 'Diciembre']
                      ];
                      return { 
                        quarter: `Q${quarterNum} ${now.getFullYear()}`, 
                        months: monthNames[quarterNum - 1].join(', ') 
                      };
                    })(),
                    'last_quarter': (() => {
                      const now = new Date();
                      const currentMonth = now.getMonth() + 1; // 1-12
                      const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;
                      const lastQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
                      const year = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
                      const monthNames = [
                        ['Enero', 'Febrero', 'Marzo'],
                        ['Abril', 'Mayo', 'Junio'],
                        ['Julio', 'Agosto', 'Septiembre'],
                        ['Octubre', 'Noviembre', 'Diciembre']
                      ];
                      return { 
                        quarter: `Q${lastQuarter} ${year}`, 
                        months: monthNames[lastQuarter - 1].join(', ') 
                      };
                    })(),
                    'q1': { quarter: 'Q1', months: 'Enero, Febrero, Marzo' },
                    'q2': { quarter: 'Q2', months: 'Abril, Mayo, Junio' },
                    'q3': { quarter: 'Q3', months: 'Julio, Agosto, Septiembre' },
                    'q4': { quarter: 'Q4', months: 'Octubre, Noviembre, Diciembre' }
                  };
                  
                  const quarterInfo = quarterMap[filterValue];
                  if (quarterInfo) {
                    return (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-md">
                        <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-900">
                          {quarterInfo.quarter}
                        </span>
                        <span className="text-xs text-blue-700">
                          ({quarterInfo.months})
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
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
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs py-1">
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
                    <div className="w-5 h-5 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
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
          <TabsList className="grid grid-cols-10 w-full max-w-7xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
            >
              <Gauge className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="team-analysis" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Equipo
            </TabsTrigger>
            <TabsTrigger 
              value="rankings" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm"
            >
              <Trophy className="h-3.5 w-3.5" />
              Rankings
            </TabsTrigger>
            <TabsTrigger 
              value="trends" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Tendencias
            </TabsTrigger>
            <TabsTrigger 
              value="time-management" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
            >
              <Timer className="h-3.5 w-3.5" />
              Tiempo
            </TabsTrigger>
            <TabsTrigger 
              value="income-details" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Ingresos
            </TabsTrigger>
            <TabsTrigger 
              value="cost-details" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-sm"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Costos
            </TabsTrigger>
            <TabsTrigger 
              value="financial-analysis" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <Heart className="h-3.5 w-3.5" />
              Rentabilidad
            </TabsTrigger>
            <TabsTrigger 
              value="operational-analysis" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700 data-[state=active]:shadow-sm"
            >
              <Zap className="h-3.5 w-3.5" />
              Eficiencia
            </TabsTrigger>
            <TabsTrigger 
              value="tasks" 
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-2 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Tareas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            
            {/* ONE-SHOT BANNER */}
            {unifiedData?.project?.isOneShot && finalPeriod && (
              <OneShotBanner
                projectName={project?.quotation?.projectName || 'Proyecto'}
                hasRevenueInPeriod={unifiedData.project.hasRevenueInPeriod || false}
                periodLabel={(() => {
                  const [year, month] = finalPeriod.split('-');
                  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                  return `${monthNames[parseInt(month) - 1]} ${year}`;
                })()}
                periodWithRevenue={unifiedData.project.periodWithRevenue || null}
              />
            )}

            {/* EMPTY STATE - No data available */}
            {(!projectVM || (projectVM.costDisplay === 0 && projectVM.teamBreakdown?.length === 0)) ? (
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700">
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CalendarDays className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-3">
                    No hay datos disponibles
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                    No se encontraron registros de costos o horas para el período seleccionado.
                  </p>
                  <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">💡 Sugerencia</p>
                    <p>Prueba seleccionar un período diferente o verifica que se hayan cargado los datos del proyecto.</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* EXECUTIVE DASHBOARD HEADER - REDISEÑADO UX/UI */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white shadow-lg">
              {console.log('🔍 DELTA DEBUG:', {
                hasPreviousPeriod: !!unifiedData?.previousPeriod,
                hasData: unifiedData?.previousPeriod?.hasData,
                previousPeriod: unifiedData?.previousPeriod,
                currentMarkup: projectVM?.markup,
                currentCost: projectVM?.costDisplay,
                currentHours: projectVM?.totalHours
              })}
              
              {/* Header with subtitle */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Gauge className="h-7 w-7" />
                  </div>
                  Performance General
                </h2>
                <p className="text-slate-300 text-sm ml-15">
                  Indicadores clave del proyecto en el período seleccionado
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* SECCIÓN FINANCIERA */}
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    <h3 className="text-xl font-semibold">Financiera</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Ingresos - Destacado */}
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 text-slate-300 text-sm mb-1">
                            Ingresos Generados
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3.5 w-3.5 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">Total de ingresos facturados al cliente en el período seleccionado</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-baseline gap-3">
                            <div className="text-3xl font-bold text-green-400">
                              {projectVM ? formatCurrency(projectVM.revenueDisplay, projectVM.currencyNative) : '$0'}
                            </div>
                            {unifiedData?.previousPeriod?.hasData && (() => {
                              const current = projectVM?.revenueDisplay || 0;
                              const previous = unifiedData.previousPeriod.metrics?.revenueUSD || 0;
                              if (previous > 0) {
                                const change = ((current - previous) / previous) * 100;
                                const isPositive = change >= 0;
                                return (
                                  <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {Math.abs(change).toFixed(0)}%
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grid de métricas financieras */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Costos */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Costos del Período
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Suma de todos los costos de equipo y recursos en el período</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-bold text-red-400">
                            {projectVM ? formatCurrency(projectVM.costDisplay, projectVM.currencyNative) : '$0'}
                          </div>
                          {unifiedData?.previousPeriod?.hasData && (() => {
                            const current = projectVM?.costDisplay || 0;
                            const previous = unifiedData.previousPeriod.metrics?.teamCostUSD || 0;
                            if (previous > 0) {
                              const change = ((current - previous) / previous) * 100;
                              const isPositive = change <= 0; // Lower cost is better
                              return (
                                <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                  {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {Math.abs(change).toFixed(0)}%
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">vs período anterior</div>
                      </div>

                      {/* Margen */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Margen de Ganancia
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Porcentaje de ganancia sobre los ingresos: (Ingresos - Costos) / Ingresos</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className={`text-2xl font-bold ${
                            (projectVM?.margin || 0) * 100 >= 50 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {((projectVM?.margin || 0) * 100).toFixed(1)}%
                          </div>
                          {unifiedData?.previousPeriod?.hasData && (() => {
                            const current = projectVM?.margin || 0;
                            const previous = unifiedData.previousPeriod.metrics?.margin || 0;
                            if (previous > 0) {
                              const changePoints = ((current - previous) * 100);
                              const isPositive = changePoints >= 0;
                              return (
                                <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {Math.abs(changePoints).toFixed(1)}pp
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">vs período anterior</div>
                      </div>

                      {/* Markup */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Factor de Ganancia (Markup)
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Cuántas veces multiplicás tu costo para obtener el precio de venta. Markup = Ingresos / Costos</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className={`text-2xl font-bold ${(() => {
                          const markup = projectVM?.markup || 0;
                          return markup >= 2 ? "text-green-400" : "text-red-400";
                        })()}`}>
                          {(() => {
                            const markup = projectVM?.markup || 0;
                            return markup > 0 ? `${markup.toFixed(1)}x` : "N/A";
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          ROI: {(() => {
                            const markup = projectVM?.markup || 0;
                            const roi = markup > 0 ? ((markup - 1) * 100).toFixed(0) : '0';
                            return markup > 0 ? `+${roi}%` : "N/A";
                          })()}
                        </div>
                      </div>

                      {/* Presupuesto Restante */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Presupuesto Restante
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Porcentaje del presupuesto total que aún no se ha consumido</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className={`text-2xl font-bold ${(() => {
                          const budgetUtil = (projectVM?.budgetUtilization || 0) * 100;
                          return budgetUtil > 80 ? "text-red-400" : "text-green-400";
                        })()}`}>
                          {(() => {
                            const budgetUtil = (projectVM?.budgetUtilization || 0) * 100;
                            return budgetUtil <= 80 ? "Saludable" : "Crítico";
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {Math.max(0, 100 - ((projectVM?.budgetUtilization || 0) * 100)).toFixed(0)}% disponible
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN OPERATIVA */}
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Users className="h-5 w-5 text-blue-400" />
                    <h3 className="text-xl font-semibold">Operativa</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Horas trabajadas - Destacado */}
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-slate-300 text-sm mb-1">
                            Horas Trabajadas en el Período
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3.5 w-3.5 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">Total de horas registradas por el equipo en Asana durante el período seleccionado</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-baseline gap-3">
                            <div className="text-3xl font-bold text-blue-400">
                              {(projectVM?.totalHours || 0).toFixed(1)}h
                            </div>
                            {unifiedData?.previousPeriod?.hasData && (() => {
                              const current = projectVM?.totalHours || 0;
                              const previous = unifiedData.previousPeriod.metrics?.totalHours || 0;
                              if (previous > 0) {
                                const change = ((current - previous) / previous) * 100;
                                const isPositive = change >= 0;
                                return (
                                  <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {Math.abs(change).toFixed(0)}%
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="text-sm text-slate-400 mt-1">
                            Promedio: {Math.round((projectVM?.totalHours || 0) / 4)}h por semana
                          </div>
                        </div>
                      </div>
                      <Progress 
                        value={Math.min(100, ((projectVM?.totalHours || 0) / (projectVM?.estimatedHours || 1)) * 100)} 
                        className="h-2" 
                      />
                      <div className="text-xs text-slate-400 mt-2">
                        {(projectVM?.estimatedHours || 0) > 0 && (
                          <>{Math.max(0, (projectVM?.estimatedHours || 0) - (projectVM?.totalHours || 0)).toFixed(1)}h estimadas restantes</>
                        )}
                      </div>
                    </div>

                    {/* Grid operativo */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Equipo Activo */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Equipo Activo
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Cantidad de personas que trabajaron en el proyecto durante este período</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">
                          {(projectVM?.teamBreakdown || []).length}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">miembros</div>
                      </div>

                      {/* Carga Promedio */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Carga Promedio por Persona
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Promedio de horas trabajadas por cada miembro del equipo</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="text-2xl font-bold text-gray-400">
                          {(() => {
                            const team = projectVM?.teamBreakdown || [];
                            const avg = team.length > 0 
                              ? (projectVM?.totalHours || 0) / team.length 
                              : 0;
                            return avg.toFixed(1);
                          })()}h
                        </div>
                        <div className="text-xs text-slate-400 mt-1">por persona</div>
                      </div>

                      {/* Eficiencia */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Eficiencia del Proyecto
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Relación entre horas estimadas y horas reales trabajadas. Mayor eficiencia = mejor</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className={`text-2xl font-bold ${(() => {
                          if (!projectVM?.estimatedHours || projectVM.estimatedHours === 0) return 'text-gray-400';
                          const eff = (projectVM.estimatedHours / Math.max(projectVM.totalHours, 0.1)) * 100;
                          return eff >= 90 ? 'text-green-400' : 'text-red-400';
                        })()}`}>
                          {(() => {
                            if (!projectVM?.estimatedHours || projectVM.estimatedHours === 0) return 'N/A';
                            const eff = (projectVM.estimatedHours / Math.max(projectVM.totalHours, 0.1)) * 100;
                            return `${eff.toFixed(0)}%`;
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {(() => {
                            if (!projectVM?.estimatedHours || projectVM.estimatedHours === 0) return 'Sin estimación';
                            const eff = (projectVM.estimatedHours / Math.max(projectVM.totalHours, 0.1)) * 100;
                            return eff >= 100 ? 'Por debajo de estimado' : 'Por encima de estimado';
                          })()}
                        </div>
                      </div>

                      {/* Presupuesto Usado */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                          Presupuesto Utilizado
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Porcentaje del presupuesto total que ya se ha consumido</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className={`text-2xl font-bold ${(() => {
                          const budgetUtil = (projectVM?.budgetUtilization || 0) * 100;
                          return budgetUtil > 80 ? "text-red-400" : "text-green-400";
                        })()}`}>
                          {((projectVM?.budgetUtilization || 0) * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-400 mt-1">del presupuesto</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CROSS-TAB INSIGHTS - World Class Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Team Performance Summary - REDISEÑADO CON BARRAS */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Rendimiento del Equipo
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {(projectVM?.teamBreakdown || []).length} miembros
                    </Badge>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-6">
                    {/* Top Performer Hero Card */}
                    {(() => {
                      const team = projectVM?.teamBreakdown || [];
                      const topPerformer = team.reduce((max: any, member: any) => 
                        (member.hoursAsana || 0) > (max.hoursAsana || 0) ? member : max, team[0] || {});
                      
                      if (!topPerformer?.name) return null;
                      
                      const utilization = topPerformer.targetHours > 0 
                        ? ((topPerformer.hoursAsana || 0) / topPerformer.targetHours) * 100 
                        : 0;
                      
                      return (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-5">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-14 w-14 border-2 border-green-400">
                              <AvatarFallback className="bg-green-500 text-white text-lg font-bold">
                                {topPerformer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Trophy className="h-4 w-4 text-yellow-600" />
                                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Top Performer del Período</span>
                              </div>
                              <h4 className="text-lg font-bold text-gray-900 mb-1">{topPerformer.name}</h4>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  {topPerformer.roleName || 'Sin rol'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {(topPerformer.hoursAsana || 0).toFixed(1)}h trabajadas
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  {formatCurrency(topPerformer.costUSD || 0, 'USD')}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>Utilización: {utilization.toFixed(0)}%</span>
                                  <span>{topPerformer.targetHours || 0}h estimadas</span>
                                </div>
                                <Progress 
                                  value={Math.min(100, utilization)} 
                                  className="h-2"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Team Members - Barras Horizontales */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">Carga de Trabajo por Miembro</h4>
                        <span className="text-xs text-gray-500">
                          Promedio: {(() => {
                            const team = projectVM?.teamBreakdown || [];
                            const avg = team.length > 0 ? (projectVM?.totalHours || 0) / team.length : 0;
                            return avg.toFixed(1);
                          })()}h/persona
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {(projectVM?.teamBreakdown || [])
                          .sort((a: any, b: any) => (b.hoursAsana || 0) - (a.hoursAsana || 0))
                          .slice(0, 8)
                          .map((member: any, index) => {
                            const hours = member.hoursAsana || 0;
                            const target = member.targetHours || 0;
                            
                            // 🎯 Use unified performance helper
                            const perfStatus = getUtilizationStatus(hours, target);
                            
                            return (
                              <div key={index} className="group">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
                                      {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-medium text-gray-900 truncate">
                                          {member.name}
                                        </span>
                                        <span className="text-xs text-gray-500 truncate">
                                          {member.roleName}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-sm font-bold text-gray-900">
                                          {hours.toFixed(1)}h
                                        </span>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${perfStatus.borderColorClass} ${perfStatus.colorClass} ${perfStatus.bgColorClass}`}
                                        >
                                          {perfStatus.emoji} {perfStatus.label}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="relative">
                                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all ${perfStatus.progressBarClass}`}
                                          style={{ width: `${Math.min(100, perfStatus.utilization)}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                                        <span>{perfStatus.utilization.toFixed(0)}% utilización</span>
                                        {target > 0 && <span>Meta: {target}h</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      
                      {(projectVM?.teamBreakdown || []).length > 8 && (
                        <div className="text-center pt-2">
                          <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                            Ver todos los {(projectVM?.teamBreakdown || []).length} miembros
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recomendaciones Automáticas - REDISEÑADO CON PRIORIZACIÓN */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-600" />
                      Recomendaciones Inteligentes
                    </h3>
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Rocket className="h-3 w-3" />
                      IA Analytics
                    </Badge>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-3">
                    {(() => {
                      const budgetUsed = (projectVM?.budgetUtilization || 0) * 100;
                      const markup = projectVM?.markup || 0;
                      const recommendations: any[] = [];

                      const team = projectVM?.teamBreakdown || [];
                      const totalBudget = quotationData?.totalAmountNative || 1;
                      const actualCost = projectVM?.costDisplay || 0;
                      const remainingBudget = totalBudget - actualCost;
                      
                      // CRÍTICO - Prioridad 1
                      if (budgetUsed > 85) {
                        const overspend = actualCost - totalBudget;
                        recommendations.push({
                          priority: 1,
                          type: 'critical',
                          icon: AlertTriangle,
                          emoji: '🚨',
                          title: 'Presupuesto Excedido',
                          value: formatCurrency(Math.abs(overspend), projectVM?.currencyNative || 'USD'),
                          description: `Ya gastaste ${formatCurrency(actualCost, projectVM?.currencyNative || 'USD')} de ${formatCurrency(totalBudget, projectVM?.currencyNative || 'USD')} presupuestados.`,
                          action: 'Renegociar con cliente',
                          color: 'red',
                          borderColor: 'border-red-500',
                          bgColor: 'bg-red-50',
                          textColor: 'text-red-700',
                          badgeColor: 'bg-red-600'
                        });
                      }
                      
                      // ADVERTENCIA - Prioridad 2: Team overutilization (≥105%)
                      const overworkedMembers = getOverworkedMembers(team);
                      if (overworkedMembers.length > 0) {
                        const names = overworkedMembers.map(m => m.name).join(', ');
                        const avgUtilization = overworkedMembers.reduce((sum, m) => sum + m.utilization, 0) / overworkedMembers.length;
                        recommendations.push({
                          priority: 2,
                          type: 'warning',
                          icon: AlertCircle,
                          emoji: '⚠️',
                          title: 'Equipo Sobrecargado',
                          value: `${avgUtilization.toFixed(0)}% prom.`,
                          description: `${names} ${overworkedMembers.length > 1 ? 'superaron' : 'superó'} su capacidad estimada (≥105% utilización). Riesgo de burnout.`,
                          action: 'Redistribuir carga',
                          color: 'red',
                          borderColor: 'border-red-500',
                          bgColor: 'bg-red-50',
                          textColor: 'text-red-700',
                          badgeColor: 'bg-red-600'
                        });
                      } else if (budgetUsed > 75 && budgetUsed <= 85) {
                        recommendations.push({
                          priority: 2,
                          type: 'warning',
                          icon: AlertCircle,
                          emoji: '⚠️',
                          title: 'Presupuesto Ajustado',
                          value: formatCurrency(remainingBudget, projectVM?.currencyNative || 'USD'),
                          description: `Con ${budgetUsed.toFixed(0)}% usado, quedan aprox. ${Math.ceil(remainingBudget / 100)}h de trabajo.`,
                          action: 'Priorizar críticos',
                          color: 'red',
                          borderColor: 'border-red-500',
                          bgColor: 'bg-red-50',
                          textColor: 'text-red-700',
                          badgeColor: 'bg-red-600'
                        });
                      }
                      
                      // OPORTUNIDAD - Prioridad 3
                      if (markup < 1.5 && markup > 0) {
                        const targetMarkup = actualCost * 1.8;
                        recommendations.push({
                          priority: 3,
                          type: 'opportunity',
                          icon: Lightbulb,
                          emoji: '💡',
                          title: 'Markup Bajo',
                          value: `${markup.toFixed(1)}x actual`,
                          description: `Para proyectos similares, cotiza mín. ${formatCurrency(targetMarkup, projectVM?.currencyNative || 'USD')} (markup 1.8x).`,
                          action: 'Ver estrategia',
                          color: 'gray',
                          borderColor: 'border-gray-400',
                          bgColor: 'bg-gray-50',
                          textColor: 'text-gray-700',
                          badgeColor: 'bg-gray-600'
                        });
                      } else if (budgetUsed < 30) {
                        const monthsElapsed = Math.ceil((Date.now() - new Date(unifiedData?.project?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30));
                        recommendations.push({
                          priority: 3,
                          type: 'opportunity',
                          icon: Lightbulb,
                          emoji: '📈',
                          title: 'Capacidad Disponible',
                          value: `${budgetUsed.toFixed(0)}% usado`,
                          description: `En ${monthsElapsed} mes(es), puedes acelerar aprox. ${Math.floor(remainingBudget / 150)} días más de trabajo.`,
                          action: 'Ampliar scope',
                          color: 'gray',
                          borderColor: 'border-gray-400',
                          bgColor: 'bg-gray-50',
                          textColor: 'text-gray-700',
                          badgeColor: 'bg-gray-600'
                        });
                      }
                      
                      // ÉXITO - Prioridad 4
                      if (markup >= 2.5) {
                        const profit = (actualCost * markup) - actualCost;
                        recommendations.push({
                          priority: 4,
                          type: 'success',
                          icon: CheckCircle2,
                          emoji: '🎯',
                          title: 'Excelente Rentabilidad',
                          value: `${markup.toFixed(1)}x markup`,
                          description: `Ganancia de ${formatCurrency(profit, projectVM?.currencyNative || 'USD')} (${((markup-1)*100).toFixed(0)}% ROI).`,
                          action: 'Aplicar a otros',
                          color: 'green',
                          borderColor: 'border-green-500',
                          bgColor: 'bg-green-50',
                          textColor: 'text-green-700',
                          badgeColor: 'bg-green-600'
                        });
                      }
                      
                      const topPerformer = team.reduce((max: any, member: any) => 
                        (member.hoursAsana || 0) > (max.hoursAsana || 0) ? member : max, team[0] || {});
                      if (topPerformer.name && (topPerformer.hoursAsana || 0) > 40 && recommendations.length < 3) {
                        recommendations.push({
                          priority: 4,
                          type: 'success',
                          icon: Star,
                          emoji: '⭐',
                          title: 'Top Performer Identificado',
                          value: `${(topPerformer.hoursAsana || 0).toFixed(0)}h`,
                          description: `${topPerformer.name} lidera el proyecto. Considerar rol de mentor o lead.`,
                          action: 'Ver perfil',
                          color: 'green',
                          borderColor: 'border-green-500',
                          bgColor: 'bg-green-50',
                          textColor: 'text-green-700',
                          badgeColor: 'bg-green-600'
                        });
                      }

                      // Si pocas recomendaciones, agregar general
                      if (recommendations.length < 2) {
                        const daysActive = Math.ceil((Date.now() - new Date(unifiedData?.project?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
                        recommendations.push({
                          priority: 5,
                          type: 'info',
                          icon: Info,
                          emoji: '📋',
                          title: 'Revisión Programada',
                          value: `${daysActive} días activo`,
                          description: `Progreso ${budgetUsed.toFixed(0)}%. Programa check-in semanal y revisa deliverables.`,
                          action: 'Ver calendario',
                          color: 'gray',
                          borderColor: 'border-gray-400',
                          bgColor: 'bg-gray-50',
                          textColor: 'text-gray-700',
                          badgeColor: 'bg-gray-600'
                        });
                      }

                      // Ordenar por prioridad y mostrar top 3
                      return recommendations
                        .sort((a, b) => a.priority - b.priority)
                        .slice(0, 3)
                        .map((rec, index) => {
                          const Icon = rec.icon;
                          return (
                            <div 
                              key={index} 
                              className={`${rec.bgColor} rounded-lg p-4 border-l-4 ${rec.borderColor} relative group hover:shadow-md transition-shadow`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={`p-2 rounded-lg ${rec.badgeColor} bg-opacity-10 flex-shrink-0`}>
                                    <Icon className={`h-4 w-4 ${rec.textColor}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h4 className={`font-bold text-sm ${rec.textColor}`}>
                                        {rec.emoji} {rec.title}
                                      </h4>
                                      <Badge className={`${rec.badgeColor} text-white text-xs flex-shrink-0`}>
                                        {rec.value}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-700 leading-relaxed mb-3">
                                      {rec.description}
                                    </p>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className={`h-7 text-xs ${rec.textColor} hover:${rec.bgColor} px-3`}
                                      data-testid={`button-recomendacion-${index}`}
                                    >
                                      {rec.action}
                                      <ChevronDown className="h-3 w-3 ml-1 -rotate-90" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                  
                  {/* Mostrar todas las recomendaciones link */}
                  <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                    <Button variant="link" size="sm" className="text-xs text-gray-600">
                      Ver todas las recomendaciones
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ADVANCED ANALYTICS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Performance Metrics (from Performance tab) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Performance
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Eficiencia</span>
                    <span className={`text-sm font-bold ${(() => {
                      if (!projectVM || !projectVM.estimatedHours || projectVM.estimatedHours === 0) return 'text-gray-600';
                      const eff = (projectVM.estimatedHours / Math.max(projectVM.totalAsanaHours || projectVM.totalHours, 0.1)) * 100;
                      return eff > 80 ? 'text-red-600' : eff > 60 ? 'text-yellow-600' : 'text-green-600';
                    })()}`}>
                      {(() => {
                        if (!projectVM || !projectVM.estimatedHours || projectVM.estimatedHours === 0) return 'N/A';
                        const eff = (projectVM.estimatedHours / Math.max(projectVM.totalAsanaHours || projectVM.totalHours, 0.1)) * 100;
                        return `${eff.toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-yellow-500 h-2 rounded-full" 
                      style={{ width: `${(() => {
                        if (!projectVM || !projectVM.estimatedHours || projectVM.estimatedHours === 0) return 0;
                        return Math.min(100, (projectVM.estimatedHours / Math.max(projectVM.totalAsanaHours || projectVM.totalHours, 0.1)) * 100);
                      })()}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.max(0, (projectVM?.estimatedHours || 0) - (projectVM?.totalAsanaHours || projectVM?.totalHours || 0))}h restantes
                  </div>
                </div>
              </div>

              {/* Budget Status */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    Presupuesto
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {projectVM ? formatCurrency(projectVM.costDisplay, projectVM.currencyNative) : '$0'}
                    </div>
                    <div className="text-xs text-gray-500">de {projectVM ? formatCurrency(quotationData?.totalAmountNative || 0, projectVM.currencyNative) : '$0'}</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(100, projectVM && quotationData?.totalAmountNative ? ((projectVM.costDisplay / quotationData.totalAmountNative) * 100) : 0)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Timeline del Proyecto */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    Timeline del Proyecto
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    {(() => {
                      const projectStart = new Date(unifiedData?.project?.startDate || Date.now());
                      const monthsActive = Math.ceil((Date.now() - projectStart.getTime()) / (1000 * 60 * 60 * 24 * 30));
                      const budgetUsed = ((projectVM?.budgetUtilization || 0) * 100);
                      
                      return [
                        {
                          date: projectStart.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
                          event: 'Proyecto iniciado',
                          status: 'completed'
                        },
                        {
                          date: 'Ago 25',
                          event: `${budgetUsed.toFixed(0)}% presupuesto usado`,
                          status: budgetUsed > 80 ? 'warning' : 'active'
                        },
                        {
                          date: 'Sep 25',
                          event: `${Math.max(0, 100 - budgetUsed).toFixed(0)}% restante estimado`,
                          status: 'pending'
                        }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center gap-3 text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            item.status === 'completed' ? 'bg-green-500' :
                            item.status === 'warning' ? 'bg-red-500' :
                            item.status === 'active' ? 'bg-blue-500' : 'bg-gray-300'
                          }`}></div>
                          <span className="text-gray-500 w-12">{item.date}</span>
                          <span className="font-medium text-gray-900">{item.event}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Puntuación de Calidad */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      Puntuación de Calidad
                    </h4>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-6 right-0 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 w-64 z-10">
                        <div className="font-semibold mb-2">¿Cómo se calcula?</div>
                        <div className="space-y-1">
                          <div>• 40% - Eficiencia presupuestaria</div>
                          <div>• 35% - Rentabilidad (markup)</div>
                          <div>• 25% - Distribución del equipo</div>
                        </div>
                        <div className="mt-2 text-xs text-gray-300">
                          Fórmula: ((100-eficiencia)*0.4 + (markup-1)*35 + factorEquipo*25)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {(() => {
                    // 🎯 Calculate health score once (using unified performance helper)
                    const budgetUsed = (projectVM?.budgetUtilization || 0) * 100;
                    const markup = projectVM?.markup || 0;
                    const team = projectVM?.teamBreakdown || [];
                    
                    // Use unified performance helper for overworked members (≥105% utilization)
                    const overworkedMembers = getOverworkedMembers(team).length;
                    const teamFactor = Math.max(0, 100 - (overworkedMembers * 20));
                    
                    // Health score formula
                    const budgetScore = (100 - budgetUsed) * 0.4;
                    const profitabilityScore = Math.min(100, (markup - 1) * 35);
                    const teamScore = teamFactor * 0.25;
                    const totalScore = budgetScore + profitabilityScore + teamScore;
                    const finalScore = Math.max(0, Math.min(100, totalScore));
                    
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-900">
                            {finalScore.toFixed(0)}
                          </div>
                          <div className="text-xs text-gray-500">de 100 puntos</div>
                        </div>
                        <div className="flex justify-center">
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(star => (
                              <Star 
                                key={star} 
                                className={`h-4 w-4 ${
                                  star <= Math.ceil(finalScore / 20) 
                                    ? 'text-yellow-400 fill-current' 
                                    : 'text-gray-300'
                                }`} 
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-center text-gray-500">
                          {finalScore >= 80 ? 'Excelente calidad del proyecto' :
                           finalScore >= 60 ? 'Buena calidad del proyecto' :
                           finalScore >= 40 ? 'Calidad aceptable' :
                           'Necesita mejoras'}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: Métricas Adicionales (si las necesitamos después) */}
            <TooltipProvider>
              <div className="hidden grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
              
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
                if (!projectVM) return 'border-l-orange-600 bg-gradient-to-br from-orange-50 via-orange-25 to-white';
                const quotationTotal = quotationData?.totalAmountNative || 1;
                const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                if (percentage <= 90) return 'border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white';
                if (percentage <= 100) return 'border-l-gray-600 bg-gradient-to-br from-gray-50 via-gray-25 to-white';
                if (percentage <= 110) return 'border-l-yellow-600 bg-gradient-to-br from-yellow-50 via-yellow-25 to-white';
                if (percentage <= 120) return 'border-l-orange-600 bg-gradient-to-br from-orange-50 via-orange-25 to-white';
                return 'border-l-red-600 bg-gradient-to-br from-red-50 via-red-25 to-white';
              })()} shadow-sm hover:shadow-md transition-shadow`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`p-2 rounded-lg cursor-help ${(() => {
                            if (!projectVM) return 'bg-orange-100';
                            const quotationTotal = quotationData?.totalAmountNative || 1;
                            const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                            if (percentage <= 90) return 'bg-green-100';
                            if (percentage <= 100) return 'bg-gray-100';
                            if (percentage <= 110) return 'bg-yellow-100';
                            if (percentage <= 120) return 'bg-orange-100';
                            return 'bg-red-100';
                          })()}`}>
                            <DollarSign className={`h-4 w-4 ${(() => {
                          if (!projectVM) return 'text-orange-600';
                          const quotationTotal = quotationData?.totalAmountNative || 1;
                          const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                          if (percentage <= 90) return 'text-green-600';
                          if (percentage <= 100) return 'text-gray-600';
                          if (percentage <= 110) return 'text-yellow-600';
                          if (percentage <= 120) return 'text-orange-600';
                          return 'text-red-600';
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
                        if (!projectVM) return 'text-orange-700';
                        const quotationTotal = quotationData?.totalAmountNative || 1;
                        const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                        if (percentage <= 90) return 'text-green-700';
                        if (percentage <= 100) return 'text-gray-700';
                        if (percentage <= 110) return 'text-yellow-700';
                        if (percentage <= 120) return 'text-orange-700';
                        return 'text-red-700';
                      })()}`}>Costo Real</span>
                    </div>
                    <Badge variant={(() => {
                      if (!projectVM) return 'outline';
                      const quotationTotal = quotationData?.totalAmountNative || 1;
                      const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                      if (percentage <= 90) return 'default';
                      if (percentage <= 100) return 'secondary';
                      if (percentage <= 110) return 'outline';
                      if (percentage <= 120) return 'destructive';
                      return 'destructive';
                    })()} className={`text-xs px-2 py-0.5 ${(() => {
                      if (!projectVM) return '';
                      const quotationTotal = quotationData?.totalAmountNative || 1;
                      const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                      if (percentage <= 90) return 'bg-green-100 text-green-800 border-green-300';
                      if (percentage <= 100) return 'bg-gray-100 text-gray-800 border-gray-300';
                      if (percentage <= 110) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                      if (percentage <= 120) return 'bg-orange-100 text-orange-800 border-orange-300';
                      return 'bg-red-100 text-red-800 border-red-300';
                    })()}`}>
                      {(() => {
                        if (!projectVM) return '0%';
                        const quotationTotal = quotationData?.totalAmountNative || 1;
                        const percentage = (projectVM.costDisplay / quotationTotal) * 100;
                        return `${percentage.toFixed(0)}%`;
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-gray-900">
                      {projectVM ? formatCurrency(projectVM.costDisplay, projectVM.currencyNative) : '$0'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>de {projectVM ? formatCurrency(unifiedData?.quotation?.totalAmount || unifiedData?.quotation?.baseCost || 0, projectVM.currencyNative) : '$0'} estimado</span>
                    </div>
                    <Progress 
                      value={(() => {
                        if (!projectVM) return 0;
                        const quotationTotal = quotationData?.totalAmountNative || 1;
                        return (projectVM.costDisplay / quotationTotal) * 100;
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
                if (!projectVM) return 'border-l-purple-600 bg-gradient-to-br from-purple-50 via-purple-25 to-white';
                const quotationTotal = quotationData?.totalAmountNative || 1;
                const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                if (budgetUtil <= 85) return 'border-l-emerald-600 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white';
                if (budgetUtil <= 100) return 'border-l-green-600 bg-gradient-to-br from-green-50 via-green-25 to-white';
                if (budgetUtil <= 110) return 'border-l-yellow-600 bg-gradient-to-br from-yellow-50 via-yellow-25 to-white';
                return 'border-l-red-600 bg-gradient-to-br from-red-50 via-red-25 to-white';
              })()}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`p-2 rounded-lg cursor-help ${(() => {
                            if (!projectVM) return 'bg-purple-100';
                            const quotationTotal = quotationData?.totalAmountNative || 1;
                            const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                            if (budgetUtil <= 85) return 'bg-emerald-100';
                            if (budgetUtil <= 100) return 'bg-green-100';
                            if (budgetUtil <= 110) return 'bg-yellow-100';
                            return 'bg-red-100';
                          })()}`}>
                            {(() => {
                          if (!projectVM) return <Gauge className="h-4 w-4 text-purple-600" />;
                          const quotationTotal = quotationData?.totalAmountNative || 1;
                          const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                          if (budgetUtil <= 85) return <Crown className="h-4 w-4 text-emerald-600" />;
                          if (budgetUtil <= 100) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
                          if (budgetUtil <= 110) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
                          return <TrendingDown className="h-4 w-4 text-red-600" />;
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
                        if (!projectVM) return 'text-purple-700';
                        const quotationTotal = quotationData?.totalAmountNative || 1;
                        const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                        if (budgetUtil <= 85) return 'text-emerald-700';
                        if (budgetUtil <= 100) return 'text-green-700';
                        if (budgetUtil <= 110) return 'text-yellow-700';
                        return 'text-red-700';
                      })()}`}>Estado</span>
                    </div>
                    <Badge className={`text-xs px-2 py-0.5 ${(() => {
                      if (!projectVM) return 'bg-purple-100 text-purple-800 border-purple-300';
                      const quotationTotal = quotationData?.totalAmountNative || 1;
                      const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                      if (budgetUtil <= 85) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
                      if (budgetUtil <= 100) return 'bg-green-100 text-green-800 border-green-300';
                      if (budgetUtil <= 110) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                      return 'bg-red-100 text-red-800 border-red-300';
                    })()}`}>
                      {(() => {
                        if (!projectVM) return 'Sin datos';
                        const quotationTotal = quotationData?.totalAmountNative || 1;
                        const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                        console.log('🚨 CARD MORADA DEBUG:', { 
                          actualCost: projectVM.costDisplay,
                          baseCost: quotationTotal,
                          budgetUtil 
                        });
                        if (budgetUtil <= 85) return 'Excelente';
                        if (budgetUtil <= 100) return 'Bueno';
                        if (budgetUtil <= 110) return 'Regular';
                        return 'Crítico';
                      })()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">
                      {(() => {
                        if (!projectVM) return '0%';
                        const quotationTotal = quotationData?.totalAmountNative || 1;
                        const budgetUtil = (projectVM.costDisplay / quotationTotal) * 100;
                        return `${budgetUtil.toFixed(0)}%`;
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

            {/* Integración exitosa: costos directos ya integrados al sistema principal */}



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
                    recentTimeEntries.slice(0, 12).map((entry: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-semibold">
                            {entry.personnelName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
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

            {/* PROJECT LIFETIME METRICS - For one-shot projects */}
            {unifiedData?.project?.isOneShot && (
              <ProjectLifetimeMetrics
                projectId={projectId}
                currentPeriod={finalPeriod || ''}
              />
            )}
              </>
            )}

          </TabsContent>

          <TabsContent value="team-analysis" className="space-y-6">
            {/* Análisis operativo del equipo */}
            {(() => {
              console.log('✅ TAB EQUIPO CARGADO - project-details-redesigned.tsx');
              console.log('📊 projectVM.teamBreakdown:', projectVM?.teamBreakdown);
              return null;
            })()}

            {/* Horas internas del módulo de tareas */}
            {parseInt(projectId || "", 10) < 1_000_000 && (
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <Clock className="h-5 w-5 text-indigo-500" />
                    Equipo — horas internas
                    {finalPeriod && finalPeriod !== "all" && (
                      <span className="ml-2 text-xs font-normal text-slate-400">({finalPeriod})</span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Horas registradas en el módulo de tareas, valorizadas al costo hora histórico de cada persona
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!taskHoursCost || taskHoursCost.totalHours === 0 ? (
                    <p className="text-sm text-slate-400 py-2">Sin horas registradas en este período</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Total horas</p>
                          <p className="text-2xl font-bold text-slate-800">{taskHoursCost.totalHours.toFixed(1)}h</p>
                        </div>
                        {taskHoursCost.totalCostUSD > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Costo estimado</p>
                            <p className="text-2xl font-bold text-indigo-700">
                              ~USD {taskHoursCost.totalCostUSD.toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        )}
                      </div>
                      {taskHoursCost.byPerson.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                                <th className="px-4 py-2 font-medium">Persona</th>
                                <th className="px-4 py-2 font-medium text-right">Horas</th>
                                <th className="px-4 py-2 font-medium">Tipo</th>
                                <th className="px-4 py-2 font-medium">Tarifa</th>
                                <th className="px-4 py-2 font-medium text-right">Costo USD</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {taskHoursCost.byPerson.map((person) => (
                                <tr key={person.personnelId} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-2.5 font-medium text-slate-700">{person.name}</td>
                                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{person.hours.toFixed(1)}</td>
                                  <td className="px-4 py-2.5 text-slate-500">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      person.contractType === "full-time"
                                        ? "bg-blue-50 text-blue-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}>
                                      {person.contractType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 text-xs">{person.rateLabel}</td>
                                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                                    {person.costUSD > 0 ? `~USD ${person.costUSD.toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {/* Miembros Activos */}
                    <div className="text-center p-4 bg-white rounded-xl border border-blue-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {projectVM?.teamBreakdown?.length || 0}
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
                        {(projectVM?.totalAsanaHours || projectVM?.totalHours || 0).toFixed(1)}h
                      </div>
                      <div className="text-sm font-medium text-gray-600">Horas Trabajadas</div>
                      <div className="text-xs text-gray-500 mt-1">rastreadas en Asana</div>
                    </div>

                    {/* Horas Objetivo */}
                    <div className="text-center p-4 bg-white rounded-xl border border-amber-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-3">
                        <Target className="h-6 w-6 text-amber-600" />
                      </div>
                      <div className="text-3xl font-bold text-amber-600 mb-1">
                        {(projectVM?.estimatedHours || 0).toFixed(1)}h
                      </div>
                      <div className="text-sm font-medium text-gray-600">Horas Objetivo</div>
                      <div className="text-xs text-gray-500 mt-1">según presupuesto</div>
                    </div>

                    {/* Eficiencia del Equipo vs Objetivo - usa totalAsanaHours */}
                    <div className="text-center p-4 bg-white rounded-xl border border-purple-100 shadow-sm">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                        <BarChart3 className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="text-3xl font-bold text-purple-600 mb-1" data-testid="text-efficiency-header">
                        {(() => {
                          const workedHours = projectVM?.totalAsanaHours || projectVM?.totalHours || 0;
                          const targetHours = projectVM?.estimatedHours || 0;
                          if (targetHours === 0) return 'N/A';
                          const efficiency = (workedHours / targetHours) * 100;
                          return `${efficiency.toFixed(1)}%`;
                        })()}
                      </div>
                      <div className="text-sm font-medium text-gray-600">Eficiencia</div>
                      <div className="text-xs text-gray-500 mt-1">horas Asana vs objetivo</div>
                    </div>

                    {/* Costo Real del Equipo */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-center p-4 bg-white rounded-xl border border-red-100 shadow-sm cursor-help">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-3">
                              <DollarSign className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="text-3xl font-bold text-red-600 mb-1">
                              {projectVM ? formatCurrency(projectVM.costDisplay, projectVM.currencyNative).replace('$ ', 'US$ ') : 'US$ 0'}
                            </div>
                            <div className="text-sm font-medium text-gray-600">Costo Real del Equipo</div>
                            <div className="text-xs text-gray-500 mt-1">equivalente en dólares</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">Tipo de cambio aplicado:</p>
                          <p className="text-sm">
                            {(() => {
                              const fxRate = projectVM?.cotizacion || (projectVM?.teamBreakdown?.[0] as any)?.fx;
                              return fxRate 
                                ? `1 USD = ${Number(fxRate).toFixed(2)} ARS`
                                : 'No disponible';
                            })()}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Costo Real del Equipo en ARS - Solo para proyectos USD */}
                    {projectVM?.currencyNative === 'USD' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center p-4 bg-white rounded-xl border border-orange-100 shadow-sm cursor-help">
                              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-3">
                                <DollarSign className="h-6 w-6 text-orange-600" />
                              </div>
                              <div className="text-3xl font-bold text-orange-600 mb-1 break-words">
                                {(() => {
                                  const totalARS = projectVM?.teamBreakdown?.reduce((sum, member) => {
                                    return sum + (member.costARS || 0);
                                  }, 0) || 0;
                                  
                                  const absValue = Math.abs(totalARS);
                                  const isNegative = totalARS < 0;
                                  const prefix = isNegative ? '-' : '';
                                  
                                  if (absValue >= 1000000) {
                                    const millions = absValue / 1000000;
                                    return `${prefix}ARS ${millions.toFixed(2)}M`;
                                  }
                                  
                                  if (absValue >= 1000) {
                                    const thousands = absValue / 1000;
                                    return `${prefix}ARS ${thousands.toFixed(2)}K`;
                                  }
                                  
                                  return `${prefix}ARS ${absValue.toFixed(2)}`;
                                })()}
                              </div>
                              <div className="text-sm font-medium text-gray-600">Costo Real del Equipo</div>
                              <div className="text-xs text-gray-500 mt-1">equivalente en pesos</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">Valor completo:</p>
                            <p className="text-sm">
                              {(() => {
                                const totalARS = projectVM?.teamBreakdown?.reduce((sum, member) => {
                                  return sum + (member.costARS || 0);
                                }, 0) || 0;
                                
                                const absValue = Math.abs(totalARS);
                                const isNegative = totalARS < 0;
                                const prefix = isNegative ? '-' : '';
                                
                                return `${prefix}ARS ${absValue.toLocaleString('es-AR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}`;
                              })()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
                      startDate: dateFilter.startDate?.toISOString() || new Date(2020, 0, 1).toISOString(),
                      endDate: dateFilter.endDate?.toISOString() || new Date(2030, 11, 31).toISOString()
                    }}
                    teamBreakdown={projectVM?.teamBreakdown}
                    totalHours={projectVM?.totalHours}
                    estimatedHours={projectVM?.estimatedHours}
                  />
                </CardContent>
              </Card>

              {/* 🎯 ROLE ANALYSIS - Aggregated metrics by role type */}
              <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Briefcase className="h-6 w-6 text-purple-600" />
                    </div>
                    Análisis por Rol
                  </CardTitle>
                  <CardDescription className="text-base">
                    Métricas agregadas y distribución de recursos por tipo de rol
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {projectVM?.teamBreakdown && projectVM.teamBreakdown.length > 0 ? (
                    <RoleAnalysis 
                      teamBreakdown={projectVM.teamBreakdown}
                      currency={projectVM.currencyNative}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No hay datos del equipo disponibles para el período seleccionado</p>
                    </div>
                  )}
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
                          if (projectVM) {
                            reportData.push({
                              seccion: "Resumen Financiero",
                              nombre: "Markup",
                              valor: projectVM.markup ? `${projectVM.markup.toFixed(2)}x` : '0.00x',
                              fecha: dateFilter.label
                            });
                            reportData.push({
                              seccion: "Resumen Financiero", 
                              nombre: "Costo Total",
                              valor: formatCurrency(projectVM.costDisplay, projectVM.currencyNative),
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

          <TabsContent value="rankings" className="space-y-6">
            {/* RANKINGS ECONÓMICOS - VISTA COMPLETA */}
            <div className="grid grid-cols-1 gap-6">
              <EconomicRankings 
                projectId={Number(projectId)}
                timeFilter={timeFilterForHook}
                loading={!unifiedData}
              />
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            {/* GRÁFICOS DE TENDENCIAS */}
            <div className="grid grid-cols-1 gap-6">
              <TrendCharts 
                projectId={Number(projectId)}
                dateFilter={{
                  startDate: dateFilter.startDate?.toISOString() || new Date(2020, 0, 1).toISOString(),
                  endDate: dateFilter.endDate?.toISOString() || new Date(2030, 11, 31).toISOString()
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="time-management" className="space-y-6">
            <TimeTracking 
              projectId={Number(projectId)} 
              timeFilter={timeFilterForHook}
            />
          </TabsContent>


          <TabsContent value="income-details" className="space-y-6">
            <IncomeDashboardTable 
              projectId={unifiedData?.project?.id} 
              timeFilter={timeFilterForHook}
            />
          </TabsContent>

          <TabsContent value="cost-details" className="space-y-6">
            <CostDashboard 
              projectId={unifiedData?.project?.id} 
              timeFilter={timeFilterForHook}
            />
          </TabsContent>

          {/* GESTIÓN TEMPORAL - TIME ENTRIES POR PROYECTO */}
          <TabsContent value="time-entries" className="space-y-6">
            <div className="text-center py-20">
              <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Análisis de Tiempo</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Los datos de tiempo se obtienen automáticamente del <strong>Excel MAESTRO</strong> "Costos directos e indirectos".
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Revisa la pestaña <strong>Equipo</strong> para ver las horas trabajadas por cada miembro.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="financial-analysis" className="space-y-10">
            {/* BLOQUE 1: OVERVIEW FINANCIERO - Header compacto con jerarquía clara */}
            <div>
              {/* Línea contextual */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">
                  Vista: <span className="font-semibold text-gray-900">{selectedView}</span> • 
                  Periodo: <span className="font-semibold text-gray-900">{dateFilter.label}</span> • 
                  Moneda: <span className="font-semibold text-gray-900">{projectVM?.currencyNative || 'USD'}</span>
                </div>
                <button
                  onClick={() => {
                    const roi = projectVM?.markup ? ((projectVM.markup - 1) * 100).toFixed(1) : '0';
                    const burnRate = (projectVM?.totalAsanaHours && projectVM.totalAsanaHours > 0) ? (projectVM.costDisplay / projectVM.totalAsanaHours).toFixed(2) : '0';
                    const csv = `Métrica,Valor\nIngresos,${projectVM?.revenueDisplay || 0}\nCostos,${projectVM?.costDisplay || 0}\nMargen,${((projectVM?.margin || 0) * 100).toFixed(1)}%\nMarkup,${(projectVM?.markup || 0).toFixed(2)}x\nBurn Rate,${burnRate}\nROI,${roi}%`;
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `financiero-${project?.name || 'proyecto'}-${dateFilter.label}.csv`;
                    a.click();
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
                  data-testid="button-export-financiero"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
              </div>

              {/* Header principal con título */}
              <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-xl p-6 text-white shadow-lg mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="h-7 w-7" />
                  <h2 className="text-2xl font-bold">Overview Financiero</h2>
                </div>
                <p className="text-violet-100 text-sm">Indicadores clave de rentabilidad y desempeño</p>
              </div>

              {/* 4 KPIs principales con jerarquía visual */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* ROI del Proyecto */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white rounded-xl border-2 border-violet-100 p-5 cursor-help hover:border-violet-300 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1">
                            <p className="text-gray-600 text-sm font-medium">ROI</p>
                            <Info className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                          <Target className="h-5 w-5 text-violet-500" />
                        </div>
                        <p className={`text-3xl font-bold mb-1 ${getThresholdColor(projectVM?.markup ? (projectVM.markup - 1) * 100 : 0, 'roi')}`}>
                          {(() => {
                            if (!projectVM || !projectVM.markup) return '0%';
                            const roi = (projectVM.markup - 1) * 100;
                            return `${roi.toFixed(0)}%`;
                          })()}
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          {(() => {
                            if (!projectVM || !projectVM.markup) return 'N/A';
                            const roi = (projectVM.markup - 1) * 100;
                            return roi > 50 ? '🟢 Excelente' : roi > 25 ? '🟡 Bueno' : roi > 0 ? '🟠 Aceptable' : '🔴 Bajo';
                          })()}
                        </p>
                        {trendData.roi.length > 0 && (
                          <Sparkline data={trendData.roi} color="#8b5cf6" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold mb-1">ROI = (Markup - 1) × 100</p>
                      <p className="text-xs text-gray-500">Retorno sobre inversión en costos. ROI {'>'}50% es excelente.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Margen Operativo */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white rounded-xl border-2 border-violet-100 p-5 cursor-help hover:border-violet-300 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1">
                            <p className="text-gray-600 text-sm font-medium">Margen</p>
                            <Info className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                        <p className={`text-3xl font-bold mb-1 ${getThresholdColor((projectVM?.margin || 0) * 100, 'margin')}`}>
                          {projectVM?.margin != null ? `${(projectVM.margin * 100).toFixed(1)}%` : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          {(() => {
                            if (!projectVM) return '$0 beneficio';
                            const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                            return `${formatCurrency(profit, projectVM.currencyNative)}`;
                          })()}
                        </p>
                        {trendData.margin.length > 0 && (
                          <Sparkline data={trendData.margin} color="#10b981" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold mb-1">Margen = (Ingresos - Costos) / Ingresos</p>
                      <p className="text-xs text-gray-500">% de ingresos que queda como beneficio. {'>'}30% es excelente.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Burn Rate */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white rounded-xl border-2 border-violet-100 p-5 cursor-help hover:border-violet-300 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1">
                            <p className="text-gray-600 text-sm font-medium">Burn Rate</p>
                            <Info className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                          <Flame className="h-5 w-5 text-orange-500" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mb-1">
                          {(() => {
                            if (!projectVM) return '$0';
                            const burnPerHour = projectVM.totalAsanaHours > 0 
                              ? projectVM.costDisplay / projectVM.totalAsanaHours 
                              : 0;
                            return `${formatCurrency(burnPerHour, projectVM.currencyNative)}`;
                          })()}
                        </p>
                        <p className="text-xs text-gray-500 mb-3">por hora trabajada</p>
                        {trendData.burnRate.length > 0 && (
                          <Sparkline data={trendData.burnRate} color="#f97316" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold mb-1">Burn Rate = Costos / Horas</p>
                      <p className="text-xs text-gray-500">Costo promedio por hora. Útil para estimar futuros proyectos.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Estado Global */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white rounded-xl border-2 border-violet-100 p-5 cursor-help hover:border-violet-300 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1">
                            <p className="text-gray-600 text-sm font-medium">Estado</p>
                            <Info className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                          <Activity className="h-5 w-5 text-blue-500" />
                        </div>
                        <p className={`text-3xl font-bold mb-1 ${
                          projectVM && projectVM.revenueDisplay > projectVM.costDisplay 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {projectVM && projectVM.revenueDisplay > projectVM.costDisplay ? 'Rentable' : 'En Riesgo'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {projectVM && projectVM.revenueDisplay > projectVM.costDisplay 
                            ? '🟢 Proyecto saludable' 
                            : '🔴 Requiere atención'}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold mb-1">Estado = Ingresos vs Costos</p>
                      <p className="text-xs text-gray-500">Rentable si ingresos {'>'} costos. En Riesgo requiere acción inmediata.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* BLOQUE 2: FLUJO DE RESULTADOS - Waterfall con insight interpretativo */}
            {projectVM && (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900">Flujo de Resultados</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="font-semibold mb-1">Waterfall: Ingresos → Costos → Beneficio</p>
                            <p className="text-xs text-gray-500">Visualización del flujo de dinero del proyecto. Los ingresos se reducen por los costos, dejando el beneficio final.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-gray-600">La historia de tu rentabilidad</p>
                  </div>
                </div>

                {/* Waterfall Chart */}
                <div className="flex items-end justify-around h-64 relative mb-6">
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-300"></div>
                  
                  {/* Ingresos */}
                  <div className="flex flex-col items-center relative" style={{ width: '28%' }}>
                    <div 
                      className="bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg w-full transition-all duration-500 shadow-lg"
                      style={{ 
                        height: `${Math.min((projectVM.revenueDisplay / Math.max(projectVM.revenueDisplay, projectVM.costDisplay, 1)) * 200, 200)}px`,
                      }}
                    >
                      <div className="absolute top-2 left-0 right-0 text-center">
                        <p className="text-xs font-bold text-white">100%</p>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <p className="text-xs font-medium text-gray-600 mb-1">Ingresos</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency(projectVM.revenueDisplay, projectVM.currencyNative)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center mb-12">
                    <ChevronDown className="h-6 w-6 text-gray-400 rotate-[-90deg]" />
                  </div>

                  {/* Costos */}
                  <div className="flex flex-col items-center relative" style={{ width: '28%' }}>
                    <div className="relative w-full flex flex-col items-center">
                      <div className="text-center mb-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">Costos Directos</p>
                        <p className="text-lg font-bold text-red-700">
                          -{formatCurrency(projectVM.costDisplay, projectVM.currencyNative)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {((projectVM.costDisplay / projectVM.revenueDisplay) * 100).toFixed(0)}% de ingresos
                        </p>
                      </div>
                      <div 
                        className="bg-gradient-to-t from-red-500 to-red-400 rounded-t-lg w-full transition-all duration-500 shadow-lg border-2 border-red-600"
                        style={{ 
                          height: `${Math.min((projectVM.costDisplay / Math.max(projectVM.revenueDisplay, projectVM.costDisplay, 1)) * 200, 200)}px`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center mb-12">
                    <ChevronDown className="h-6 w-6 text-gray-400 rotate-[-90deg]" />
                  </div>

                  {/* Resultado */}
                  <div className="flex flex-col items-center relative" style={{ width: '28%' }}>
                    {(() => {
                      const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                      const isPositive = profit >= 0;
                      return (
                        <>
                          <div 
                            className={`rounded-t-lg w-full transition-all duration-500 shadow-lg ${
                              isPositive 
                                ? 'bg-gradient-to-t from-blue-500 to-blue-400' 
                                : 'bg-gradient-to-t from-orange-500 to-orange-400'
                            }`}
                            style={{ 
                              height: `${Math.min((Math.abs(profit) / Math.max(projectVM.revenueDisplay, projectVM.costDisplay, 1)) * 200, 200)}px`,
                            }}
                          >
                            <div className="absolute top-2 left-0 right-0 text-center">
                              <p className="text-xs font-bold text-white">
                                {((profit / projectVM.revenueDisplay) * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 text-center">
                            <p className="text-xs font-medium text-gray-600 mb-1">Resultado Neto</p>
                            <p className={`text-lg font-bold ${isPositive ? 'text-blue-700' : 'text-orange-700'}`}>
                              {formatCurrency(profit, projectVM.currencyNative)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {isPositive ? '✅ Ganancia' : '⚠️ Pérdida'}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Insight interpretativo */}
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-violet-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 mb-1">💡 Interpretación</p>
                      <p className="text-sm text-gray-700">
                        {(() => {
                          const margin = (projectVM.margin || 0) * 100;
                          const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                          
                          if (margin >= 30) {
                            return `Excelente performance: el ${margin.toFixed(1)}% de margen operativo indica alta eficiencia. Los costos representan solo el ${((projectVM.costDisplay / projectVM.revenueDisplay) * 100).toFixed(0)}% de los ingresos.`;
                          } else if (margin >= 15) {
                            return `Buen margen operativo del ${margin.toFixed(1)}%. El proyecto es rentable, pero hay oportunidad de optimizar costos para mejorar el resultado.`;
                          } else if (margin > 0) {
                            return `El ${margin.toFixed(1)}% de margen es bajo. Los costos (${((projectVM.costDisplay / projectVM.revenueDisplay) * 100).toFixed(0)}% de ingresos) están consumiendo gran parte de la facturación. Considerar ajuste de precios o reducción de costos.`;
                          } else {
                            return `⚠️ El proyecto está en pérdida. Los costos superan los ingresos. Se requiere acción inmediata: incrementar facturación, reducir costos o renegociar alcance.`;
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tendencia Mensual (si hay datos) */}
                {monthlyTrends?.rows && monthlyTrends.rows.length > 1 && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4 text-indigo-600" />
                      <h4 className="font-medium text-gray-900">Evolución Temporal</h4>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsLineChart data={monthlyTrends.rows.sort((a: any, b: any) => a.period.localeCompare(b.period))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="period" 
                          stroke="#6b7280"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value + '-01');
                            return date.toLocaleDateString('es', { month: 'short', year: '2-digit' });
                          }}
                        />
                        <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6b7280" tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          labelFormatter={(value) => {
                            const date = new Date(value + '-01');
                            return date.toLocaleDateString('es', { month: 'long', year: 'numeric' });
                          }}
                          formatter={(value: any, name: string) => {
                            if (name === 'Margen %') return `${Number(value).toFixed(1)}%`;
                            return `$${Number(value).toLocaleString()}`;
                          }}
                        />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="revenue_usd" 
                          name="Ingresos" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={{ fill: '#10b981', r: 3 }}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="cost_usd" 
                          name="Costos" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          dot={{ fill: '#ef4444', r: 3 }}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="margin_pct" 
                          name="Margen %" 
                          stroke="#6366f1" 
                          strokeWidth={2}
                          dot={{ fill: '#6366f1', r: 3 }}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* BLOQUE 3: UNIT ECONOMICS - Métricas por hora con gauges visuales */}
            {projectVM && projectVM.totalAsanaHours > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Calculator className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Unit Economics</h3>
                    <p className="text-sm text-gray-600">Análisis de rentabilidad por hora</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Precio por Hora */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 cursor-help hover:border-green-300 hover:shadow-md transition-all">
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <p className="text-xs font-semibold text-green-900">Precio/Hora</p>
                          </div>
                          <p className="text-2xl font-bold text-green-700 mb-2">
                            {formatCurrency(
                              projectVM.totalAsanaHours > 0 ? projectVM.revenueDisplay / projectVM.totalAsanaHours : 0,
                              projectVM.currencyNative
                            )}
                          </p>
                          <div className="h-2 bg-green-200 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-green-500" style={{ width: '100%' }}></div>
                          </div>
                          <p className="text-xs text-green-600">Ingresos por hora</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-1">Precio/Hora = Ingresos ÷ Horas Trabajadas</p>
                        <p className="text-xs text-gray-500">Promedio de ingresos generados por cada hora. Debe ser mayor al costo/hora para ser rentable.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Costo por Hora */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-200 cursor-help hover:border-red-300 hover:shadow-md transition-all">
                          <div className="flex items-center gap-2 mb-3">
                            <Flame className="h-4 w-4 text-red-600" />
                            <p className="text-xs font-semibold text-red-900">Costo/Hora</p>
                          </div>
                          <p className="text-2xl font-bold text-red-700 mb-2">
                            {formatCurrency(
                              projectVM.totalAsanaHours > 0 ? projectVM.costDisplay / projectVM.totalAsanaHours : 0,
                              projectVM.currencyNative
                            )}
                          </p>
                          <div className="h-2 bg-red-200 rounded-full overflow-hidden mb-2">
                            <div 
                              className="h-full bg-red-500" 
                              style={{ 
                                width: `${Math.min((projectVM.costDisplay / projectVM.revenueDisplay) * 100, 100)}%` 
                              }}
                            ></div>
                          </div>
                          <p className="text-xs text-red-600">
                            {((projectVM.costDisplay / projectVM.revenueDisplay) * 100).toFixed(0)}% de ingresos
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-1">Costo/Hora = Costos ÷ Horas Trabajadas</p>
                        <p className="text-xs text-gray-500">Promedio de costo por cada hora trabajada. Debe ser menor al precio/hora para generar margen.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* EBIT por Hora */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`rounded-xl p-4 border-2 cursor-help hover:shadow-md transition-all ${
                          (projectVM.revenueDisplay - projectVM.costDisplay) > 0 
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 hover:border-blue-400' 
                            : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-300 hover:border-orange-400'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="h-4 w-4 text-blue-600" />
                            <p className="text-xs font-semibold text-blue-900">EBIT/Hora</p>
                          </div>
                          <p className={`text-2xl font-bold mb-2 ${
                            (projectVM.revenueDisplay - projectVM.costDisplay) > 0 ? 'text-blue-700' : 'text-orange-700'
                          }`}>
                            {formatCurrency(
                              projectVM.totalAsanaHours > 0 
                                ? (projectVM.revenueDisplay - projectVM.costDisplay) / projectVM.totalAsanaHours 
                                : 0,
                              projectVM.currencyNative
                            )}
                          </p>
                          <div className={`h-2 rounded-full overflow-hidden mb-2 ${
                            (projectVM.revenueDisplay - projectVM.costDisplay) > 0 ? 'bg-blue-200' : 'bg-orange-200'
                          }`}>
                            <div 
                              className={`h-full ${
                                (projectVM.revenueDisplay - projectVM.costDisplay) > 0 ? 'bg-blue-500' : 'bg-orange-500'
                              }`}
                              style={{ 
                                width: `${Math.min(Math.abs((projectVM.margin || 0) * 100), 100)}%` 
                              }}
                            ></div>
                          </div>
                          <p className={`text-xs ${
                            (projectVM.revenueDisplay - projectVM.costDisplay) > 0 ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                            {(projectVM.revenueDisplay - projectVM.costDisplay) > 0 ? '✅ Beneficio' : '⚠️ Pérdida'}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-1">EBIT/Hora = Beneficio ÷ Horas</p>
                        <p className="text-xs text-gray-500">Ganancia neta por hora trabajada (Precio/h - Costo/h). Debe ser positivo para rentabilidad.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Realization Rate */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 cursor-help hover:border-purple-300 hover:shadow-md transition-all">
                          <div className="flex items-center gap-2 mb-3">
                            <Percent className="h-4 w-4 text-purple-600" />
                            <p className="text-xs font-semibold text-purple-900">Realization</p>
                          </div>
                          {(() => {
                            const estimatedHours = projectVM.estimatedHours || 0;
                            const realizationRate = estimatedHours > 0 
                              ? (projectVM.totalAsanaHours / estimatedHours) * 100 
                              : 0;
                            const isGood = realizationRate >= 80 && realizationRate <= 100;
                            
                            return (
                              <>
                                <p className={`text-2xl font-bold mb-2 ${
                                  isGood ? 'text-green-700' : realizationRate > 100 ? 'text-orange-700' : 'text-gray-700'
                                }`}>
                                  {realizationRate.toFixed(0)}%
                                </p>
                                <div className="h-2 bg-purple-200 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className={`h-full ${
                                      isGood ? 'bg-green-500' : realizationRate > 100 ? 'bg-orange-500' : 'bg-purple-500'
                                    }`}
                                    style={{ width: `${Math.min(realizationRate, 100)}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-purple-600">
                                  {projectVM.totalAsanaHours.toFixed(0)}h / {estimatedHours}h
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-1">Realization = Horas Reales ÷ Horas Estimadas</p>
                        <p className="text-xs text-gray-500">Compara ejecución vs planificación. 80-100% es óptimo. {'>'} 100% indica sobrecostos, {'<'} 80% subutilización.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Utilización (nuevo) */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-200 cursor-help hover:border-cyan-300 hover:shadow-md transition-all">
                          <div className="flex items-center gap-2 mb-3">
                            <Activity className="h-4 w-4 text-cyan-600" />
                            <p className="text-xs font-semibold text-cyan-900">Utilización</p>
                          </div>
                          {(() => {
                            const totalTeamMembers = projectVM.teamBreakdown?.length || 0;
                            const avgHoursPerMonth = 160;
                            const totalAvailableHours = totalTeamMembers * avgHoursPerMonth;
                            const utilizationRate = totalAvailableHours > 0 
                              ? (projectVM.totalAsanaHours / totalAvailableHours) * 100 
                              : 0;
                            const isGood = utilizationRate >= 60 && utilizationRate <= 85;
                            
                            return (
                              <>
                                <p className={`text-2xl font-bold mb-2 ${
                                  isGood ? 'text-green-700' : utilizationRate > 85 ? 'text-orange-700' : 'text-gray-700'
                                }`}>
                                  {utilizationRate.toFixed(0)}%
                                </p>
                                <div className="h-2 bg-cyan-200 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className={`h-full ${
                                      isGood ? 'bg-green-500' : utilizationRate > 85 ? 'bg-orange-500' : 'bg-cyan-500'
                                    }`}
                                    style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-cyan-600">
                                  {totalTeamMembers} personas
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-1">Utilización = Horas Trabajadas ÷ Capacidad Total</p>
                        <p className="text-xs text-gray-500">% del tiempo disponible usado en el proyecto. 60-85% es saludable, {'>'} 85% riesgo de burnout.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Interpretation Guide */}
                <div className="mt-6 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <strong>Guía de interpretación:</strong> Precio/h debe superar Costo/h para ser rentable. 
                      EBIT/h positivo confirma beneficio por hora trabajada. 
                      Realization 80-100% es óptimo (menos indica subutilización, más indica sobrecostos). 
                      Utilización 60-85% es saludable (más indica riesgo de burnout).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* BLOQUE 6: SALUD FINANCIERA - Puntuación y estado global integrado */}
            {projectVM && (() => {
              const profit = projectVM.revenueDisplay - projectVM.costDisplay;
              const margin = (projectVM.margin || 0) * 100;
              const realizationRate = projectVM.estimatedHours > 0 
                ? (projectVM.totalAsanaHours / projectVM.estimatedHours) * 100 
                : 0;
              
              // Calculate Health Score (0-100)
              let healthScore = 0;
              let scoreFactors = [];
              
              // Factor 1: Profitability (40 points)
              if (profit > 0) {
                if (margin >= 30) {
                  healthScore += 40;
                  scoreFactors.push({ name: 'Rentabilidad', score: 40, status: 'excellent' });
                } else if (margin >= 15) {
                  healthScore += 30;
                  scoreFactors.push({ name: 'Rentabilidad', score: 30, status: 'good' });
                } else {
                  healthScore += 20;
                  scoreFactors.push({ name: 'Rentabilidad', score: 20, status: 'fair' });
                }
              } else {
                scoreFactors.push({ name: 'Rentabilidad', score: 0, status: 'poor' });
              }
              
              // Factor 2: Budget Control (30 points)
              const budgetUtil = projectVM.budgetUtilization || 0;
              if (budgetUtil <= 0.9) {
                healthScore += 30;
                scoreFactors.push({ name: 'Control de Costos', score: 30, status: 'excellent' });
              } else if (budgetUtil <= 1.0) {
                healthScore += 25;
                scoreFactors.push({ name: 'Control de Costos', score: 25, status: 'good' });
              } else if (budgetUtil <= 1.1) {
                healthScore += 15;
                scoreFactors.push({ name: 'Control de Costos', score: 15, status: 'warning' });
              } else {
                healthScore += 0;
                scoreFactors.push({ name: 'Control de Costos', score: 0, status: 'poor' });
              }
              
              // Factor 3: Hour Efficiency (30 points)
              if (realizationRate >= 80 && realizationRate <= 100) {
                healthScore += 30;
                scoreFactors.push({ name: 'Eficiencia Horaria', score: 30, status: 'excellent' });
              } else if (realizationRate < 80) {
                healthScore += 20;
                scoreFactors.push({ name: 'Eficiencia Horaria', score: 20, status: 'fair' });
              } else if (realizationRate <= 110) {
                healthScore += 20;
                scoreFactors.push({ name: 'Eficiencia Horaria', score: 20, status: 'warning' });
              } else {
                healthScore += 10;
                scoreFactors.push({ name: 'Eficiencia Horaria', score: 10, status: 'poor' });
              }
              
              // Determine overall status
              let overallStatus = 'Crítico';
              let statusColor = 'red';
              let statusBadge = '🔴';
              
              if (healthScore >= 80) {
                overallStatus = 'Excelente';
                statusColor = 'green';
                statusBadge = '🟢';
              } else if (healthScore >= 60) {
                overallStatus = 'Bueno';
                statusColor = 'blue';
                statusBadge = '🟡';
              } else if (healthScore >= 40) {
                overallStatus = 'Aceptable';
                statusColor = 'yellow';
                statusBadge = '🟠';
              }
              
              return (
                <div className="bg-white rounded-xl border shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 rounded-lg ${
                      statusColor === 'green' ? 'bg-green-100' :
                      statusColor === 'blue' ? 'bg-blue-100' :
                      statusColor === 'yellow' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <Heart className={`h-5 w-5 ${
                        statusColor === 'green' ? 'text-green-600' :
                        statusColor === 'blue' ? 'text-blue-600' :
                        statusColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">Salud Financiera</h3>
                      <p className="text-sm text-gray-600">Evaluación integral del proyecto</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-4xl font-bold ${
                        statusColor === 'green' ? 'text-green-600' :
                        statusColor === 'blue' ? 'text-blue-600' :
                        statusColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {healthScore}
                      </div>
                      <div className="text-sm text-gray-500">/ 100 puntos</div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`rounded-lg p-4 mb-6 border-2 ${
                    statusColor === 'green' ? 'bg-green-50 border-green-300' :
                    statusColor === 'blue' ? 'bg-blue-50 border-blue-300' :
                    statusColor === 'yellow' ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Estado Global</p>
                        <p className={`text-2xl font-bold ${
                          statusColor === 'green' ? 'text-green-700' :
                          statusColor === 'blue' ? 'text-blue-700' :
                          statusColor === 'yellow' ? 'text-yellow-700' : 'text-red-700'
                        }`}>
                          {statusBadge} {overallStatus}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">Break-even</p>
                        <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {profit >= 0 ? '✅ Alcanzado' : '⚠️ No alcanzado'}
                        </p>
                        <p className="text-xs text-gray-600">
                          Margen: {margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Desglose de Puntuación</p>
                    {scoreFactors.map((factor, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-700">{factor.name}</span>
                            <span className={`text-sm font-semibold ${
                              factor.status === 'excellent' ? 'text-green-600' :
                              factor.status === 'good' ? 'text-blue-600' :
                              factor.status === 'fair' ? 'text-yellow-600' :
                              factor.status === 'warning' ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {factor.score} pts
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                factor.status === 'excellent' ? 'bg-green-500' :
                                factor.status === 'good' ? 'bg-blue-500' :
                                factor.status === 'fair' ? 'bg-yellow-500' :
                                factor.status === 'warning' ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${(factor.score / (index === 0 ? 40 : 30)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Actions / Recommendations */}
                  {healthScore < 80 && (
                    <div className="mt-6 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-1">Recomendaciones para mejorar</p>
                          <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                            {margin < 15 && <li>Incrementar márgenes reduciendo costos o aumentando precios</li>}
                            {budgetUtil > 1.0 && <li>Controlar scope creep y optimizar uso de recursos</li>}
                            {realizationRate > 110 && <li>Revisar estimaciones iniciales y procesos de planificación</li>}
                            {realizationRate < 80 && <li>Mejorar utilización del equipo y asignación de tareas</li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </TabsContent>


          <TabsContent value="operational-analysis" className="space-y-6">
            {/* HEADER PRINCIPAL */}
            <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Eficiencia Operativa & Riesgo</h2>
                  <p className="text-cyan-100">Flujo de trabajo, carga y cuellos de botella en tiempo real</p>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <Zap className="h-8 w-8" />
                </div>
              </div>
            </div>

            {/* MÉTRICAS OPERACIONALES PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* WIP Total */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">WIP Total</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {operationalMetrics?.kpis?.wipTotal?.toFixed(0) || '0'}h
                      </p>
                      <p className="text-xs text-blue-600 mt-1">Horas en progreso</p>
                    </div>
                    <Timer className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Lead Time */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">Lead Time</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {operationalMetrics?.kpis?.leadTime || '0'}h
                      </p>
                      <p className="text-xs text-purple-600 mt-1">Dispersión temporal</p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Throughput */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Throughput</p>
                      <p className="text-2xl font-bold text-green-900">
                        {operationalMetrics?.kpis?.throughput?.toFixed(1) || '0'}h/sem
                      </p>
                      <p className="text-xs text-green-600 mt-1">Velocidad de entrega</p>
                    </div>
                    <Zap className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Riesgo Operativo */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Riesgo Operativo</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {operationalMetrics?.kpis?.operationalRisk || '0'}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">Score 0-100</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* WORKLOAD & CARGA POR ROL */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Workload & Carga por Rol
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>Horas trabajadas vs capacidad disponible. Objetivo: 60-85% utilización.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {operationalLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {operationalMetrics?.workload && operationalMetrics.workload.length > 0 ? (
                      operationalMetrics.workload.map((member: any, index: number) => {
                        const utilizationRate = member.utilizationRate;
                        const isOverloaded = utilizationRate > 100;
                        const isHigh = utilizationRate > 85;
                        const isGood = utilizationRate >= 60 && utilizationRate <= 85;
                        const barColor = isOverloaded ? 'bg-red-500' : isHigh ? 'bg-orange-500' : isGood ? 'bg-green-500' : 'bg-gray-400';
                        
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${barColor}`}></div>
                                <span className="text-sm font-medium text-gray-900">{member.name}</span>
                                <span className="text-xs text-gray-500">({member.roleName || 'N/A'})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-600">{member.hours.toFixed(0)}h / {member.monthlyCapacity.toFixed(0)}h</span>
                                <span className={`text-sm font-bold ${
                                  isOverloaded ? 'text-red-600' : isHigh ? 'text-orange-600' : isGood ? 'text-green-600' : 'text-gray-600'
                                }`}>
                                  {utilizationRate.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${barColor} transition-all duration-300`}
                                style={{ width: `${Math.min(utilizationRate, 120)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-sm">No hay datos de equipo</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CUELLOS DE BOTELLA (TOP 3) */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Cuellos de Botella (Top 3)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>Personas con mayor carga relativa. Rojo = sobrecarga, requiere balanceo inmediato.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {operationalLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {operationalMetrics?.bottlenecks && operationalMetrics.bottlenecks.length > 0 ? (
                      operationalMetrics.bottlenecks.map((member: any, index: number) => {
                        const utilizationRate = member.utilizationRate;
                        const isOverloaded = utilizationRate > 100;
                        const isHigh = utilizationRate > 85;
                        const cardColor = isOverloaded ? 'border-red-300 bg-red-50' : 
                                         isHigh ? 'border-orange-300 bg-orange-50' : 
                                         'border-green-300 bg-green-50';
                        const textColor = isOverloaded ? 'text-red-700' : 
                                         isHigh ? 'text-orange-700' : 
                                         'text-green-700';
                        const badgeColor = isOverloaded ? 'bg-red-500' : 
                                          isHigh ? 'bg-orange-500' : 
                                          'bg-green-500';
                        
                        return (
                          <div key={index} className={`p-4 rounded-lg border-2 ${cardColor}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full ${badgeColor} text-white flex items-center justify-center text-xs font-bold`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm">{member.name}</h4>
                                  <p className="text-xs text-gray-600">{member.roleName || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Carga</span>
                                <span className={`text-lg font-bold ${textColor}`}>
                                  {utilizationRate.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${badgeColor}`}
                                  style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-600 mt-2">
                                {member.hours.toFixed(0)}h / {member.monthlyCapacity.toFixed(0)}h trabajadas
                              </p>
                            </div>
                            {isOverloaded && (
                              <div className="mt-3 pt-3 border-t border-red-200">
                                <p className="text-xs text-red-700 font-medium">⚠️ Requiere redistribución</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-sm col-span-3">No hay cuellos de botella identificados</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RIESGO OPERATIVO & ACCIONES RECOMENDADAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Riesgo Operativo (Score 0-100) */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Gauge className="h-5 w-5 text-purple-600" />
                    Riesgo Operativo
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="font-semibold mb-1">Score = WIP/Cap + Sobrecarga + Dependencias</p>
                          <p className="text-xs">{'<'}30 = Bajo, 30-60 = Medio, {'>'}60 = Alto</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {operationalLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    (() => {
                      const riskScore = operationalMetrics?.riskBreakdown?.total || 0;
                      const wipScore = operationalMetrics?.riskBreakdown?.wipScore || 0;
                      const overloadScore = operationalMetrics?.riskBreakdown?.overloadScore || 0;
                      const dependencyScore = operationalMetrics?.riskBreakdown?.dependencyScore || 0;
                      
                      const riskLevel = riskScore < 30 ? 'Bajo' : riskScore < 60 ? 'Medio' : 'Alto';
                      const riskColor = riskLevel === 'Bajo' ? 'text-green-600' : riskLevel === 'Medio' ? 'text-yellow-600' : 'text-red-600';
                      const riskBgColor = riskLevel === 'Bajo' ? 'bg-green-500' : riskLevel === 'Medio' ? 'bg-yellow-500' : 'bg-red-500';
                      
                      return (
                        <>
                          {/* Score Visual */}
                          <div className="text-center mb-6">
                            <div className={`text-5xl font-bold ${riskColor} mb-2`}>
                              {riskScore}
                            </div>
                            <p className="text-sm text-gray-600">Score de Riesgo (0-100)</p>
                            <p className={`text-lg font-semibold ${riskColor} mt-1`}>{riskLevel}</p>
                          </div>

                          {/* Progress Bar */}
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-6">
                            <div 
                              className={`h-full ${riskBgColor} transition-all duration-500`}
                              style={{ width: `${riskScore}%` }}
                            ></div>
                          </div>

                          {/* Drivers */}
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-700">Principales Drivers:</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">WIP/Capacidad</span>
                                <span className="font-semibold">{wipScore} pts</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Sobrecarga</span>
                                <span className="font-semibold">{overloadScore} pts</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Dependencias</span>
                                <span className="font-semibold">{dependencyScore} pts</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  )}
                </CardContent>
              </Card>

              {/* Acciones Recomendadas */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                    Acciones Recomendadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {operationalLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {operationalMetrics?.recommendations && operationalMetrics.recommendations.length > 0 ? (
                        operationalMetrics.recommendations.map((action: any, index: number) => {
                          const colorMap: Record<string, string> = {
                            'high': 'bg-red-50 border-red-200',
                            'medium': 'bg-orange-50 border-orange-200',
                            'low': 'bg-green-50 border-green-200'
                          };
                          const color = colorMap[action.priority] || 'bg-blue-50 border-blue-200';
                          
                          return (
                            <div key={index} className={`p-4 rounded-lg border-2 ${color}`}>
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">{action.icon}</div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 text-sm mb-1">{action.title}</h4>
                                  <p className="text-xs text-gray-700">{action.description}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 rounded-lg border-2 bg-green-50 border-green-200">
                          <div className="flex items-start gap-3">
                            <div className="text-2xl">✅</div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 text-sm mb-1">Mantener Ritmo</h4>
                              <p className="text-xs text-gray-700">La carga operativa está balanceada. Continuar monitoreando.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </TabsContent>

          {/* TAREAS TAB */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="bg-card rounded-xl border p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">Gestión de Tareas</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Tareas organizadas por sección para este proyecto</p>
              </div>
              <ProjectTaskList projectId={parseInt(params.id)} />
            </div>
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
