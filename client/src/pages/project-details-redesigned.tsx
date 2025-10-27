import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { watchSummaryDropped } from "@/utils/consistencyWatchdog";
import { toProjectVM, formatCurrency, useWhichCost } from "@/selectors/projectVM";
import { formatCurrencyFull } from "@/lib/utils";
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
  Award
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
import TimeTracking from "@/components/TimeTracking";
import { IncomeDashboardTable } from "@/components/IncomeDashboardTable";
import { CostDashboard } from "@/components/CostDashboard";
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
          // 🎯 3-HOURS ARCHITECTURE: Use normalized fields from backend
          const workedHours = member.hoursAsana || member.actualHours || 0;  // Prefer hoursAsana (normalized)
          const targetHours = member.targetHours || member.estimatedHours || 0;
          const progressPercent = getProgressPercentage(workedHours, targetHours, member.targetHours);
          // Usar horas objetivo para calcular presupuesto restante y estado de exceso
          const referenceHours = (member.targetHours && member.targetHours > 0) ? member.targetHours : targetHours;
          const remainingHours = Math.max(0, referenceHours - workedHours);
          
          // Umbral más realista para "excedido": 15% de tolerancia corporativa
          const toleranceThreshold = referenceHours * 0.15; // 15% de tolerancia
          const isOverBudget = workedHours > (referenceHours + toleranceThreshold);
          
          // Definir colores y estilos basados en el estado del miembro con umbrales corporativos realistas
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
              // Rojo: Exceso crítico (>15% sobre objetivo)
              return {
                bgGradient: "bg-gradient-to-r from-red-50 to-red-100",
                borderColor: "border-red-300",
                textColor: "text-red-700",
                avatarBg: "bg-gradient-to-br from-red-500 to-red-600",
                nameColor: "text-red-900",
                roleColor: "text-red-600"
              };
            } else if (progressPercent >= 110) {
              // Naranja: Advertencia (entre 100% y 115% - dentro de tolerancia pero elevado)
              return {
                bgGradient: "bg-gradient-to-r from-orange-50 to-orange-100",
                borderColor: "border-orange-300",
                textColor: "text-orange-700",
                avatarBg: "bg-gradient-to-br from-orange-500 to-orange-600",
                nameColor: "text-orange-900",
                roleColor: "text-orange-700"
              };
            } else if (progressPercent >= 85) {
              // Amarillo: Cerca del objetivo (85-100%)
              return {
                bgGradient: "bg-gradient-to-r from-yellow-50 to-yellow-100",
                borderColor: "border-yellow-300",
                textColor: "text-yellow-700",
                avatarBg: "bg-gradient-to-br from-yellow-500 to-yellow-600",
                nameColor: "text-yellow-900",
                roleColor: "text-yellow-700"
              };
            } else if (progressPercent > 0) {
              // Verde: En progreso normal
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
                      <span className="text-orange-500">Sin horas asignadas</span>
                    )}
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
                      {member.targetHours > 0 ? (
                        <>
                          <div className="text-blue-600 font-medium">
                            Objetivo estimado: {member.targetHours}h
                          </div>
                          {targetHours > 0 && (
                            <div className="text-gray-500">
                              Estimadas (cotización): {targetHours}h
                            </div>
                          )}
                          <div>Progreso vs objetivo: {progressPercent}%</div>
                          <div className="text-orange-600">
                            Eficiencia: {((member.targetHours / Math.max(workedHours, 0.1)) * 100).toFixed(0)}%
                          </div>
                        </>
                      ) : targetHours > 0 ? (
                        <>
                          <div>Estimadas (cotización): {targetHours}h</div>
                          <div>Progreso: {progressPercent}%</div>
                        </>
                      ) : (
                        <div className="text-orange-500">
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
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
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
  const finalPeriod = periodFromFilter || periodFromUrl || undefined;
  
  const { data: unifiedData, isLoading: dataLoading, error: dataError } = useCompleteProjectData(
    projectId ? parseInt(projectId) : 0, 
    timeFilterForHook,
    finalPeriod, // 🎯 Use URL period or calculated period from filter
    selectedView // 🎯 NEW: Pass selected view (original|operativa|usd)
  );

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
      const response = await fetch(`/api/projects/${projectId}/deviation-analysis${queryParams}`);
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
      console.assert(tb.every(p => p.roleName || p.role), 
        '🚨 [ASSERT FAILED] roleName faltante en teamBreakdown', tb.filter(p => !p.roleName && !p.role));
      
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
          <TabsList className="grid grid-cols-8 w-full max-w-7xl bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
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
              value="income-details" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Ingresos
            </TabsTrigger>
            <TabsTrigger 
              value="cost-details" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-sm"
            >
              <DollarSign className="h-4 w-4" />
              Costos
            </TabsTrigger>
            <TabsTrigger 
              value="financial-analysis" 
              className="flex items-center gap-2 text-sm font-medium px-2 py-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-4 w-4" />
              Financiero
            </TabsTrigger>
            <TabsTrigger 
              value="operational-analysis" 
              className="flex items-center gap-2 text-sm font-medium px-2 py-2 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700 data-[state=active]:shadow-sm"
            >
              <Cog className="h-4 w-4" />
              Operacional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            
            {/* EXECUTIVE DASHBOARD HEADER */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Project KPI Overview */}
                <div className="lg:col-span-2">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Gauge className="h-6 w-6" />
                    </div>
                    Resumen Ejecutivo
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Markup Real */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-300 mb-1">Markup del Proyecto</div>
                      <div className={`text-2xl font-bold ${(() => {
                        const markup = projectVM?.markup || 0;
                        return markup >= 3 ? "text-green-400" : markup >= 2.5 ? "text-blue-400" : markup >= 2 ? "text-yellow-400" : "text-red-400";
                      })()}`}>
                        {(() => {
                          const markup = projectVM?.markup || 0;
                          return markup > 0 ? `${markup.toFixed(1)}x` : "N/A";
                        })()}
                      </div>
                      <div className="text-xs text-slate-400">Factor de ganancia real</div>
                    </div>

                    {/* ROI Indicator */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-300 mb-1">ROI Performance</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {(() => {
                          const markup = projectVM?.markup || 0;
                          const roi = markup > 0 ? ((markup - 1) * 100).toFixed(0) : '0';
                          return markup > 0 ? `+${roi}%` : "N/A";
                        })()}
                      </div>
                      <div className="text-xs text-slate-400">vs proyección inicial</div>
                    </div>

                    {/* Team Performance */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-300 mb-1">Velocidad del Equipo</div>
                      <div className="text-2xl font-bold text-purple-400">
                        {Math.round((projectVM?.totalHours || 0) / 4)} h/sem
                      </div>
                      <div className="text-xs text-slate-400">Período actual</div>
                    </div>

                    {/* Budget Status */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-300 mb-1">Estado Presupuesto</div>
                      <div className={`text-2xl font-bold ${(() => {
                        const budgetUtil = (projectVM?.budgetUtilization || 0) * 100;
                        return budgetUtil > 85 ? "text-red-400" : budgetUtil > 60 ? "text-yellow-400" : "text-green-400";
                      })()}`}>
                        {(() => {
                          const budgetUtil = (projectVM?.budgetUtilization || 0) * 100;
                          return budgetUtil <= 60 ? "Saludable" : budgetUtil <= 85 ? "Atención" : "Crítico";
                        })()}
                      </div>
                      <div className="text-xs text-slate-400">
                        {Math.max(0, 100 - ((projectVM?.budgetUtilization || 0) * 100)).toFixed(0)}% restante
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Overview */}
                <div className="lg:col-span-2">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Rendimiento Financiero
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Revenue & Cost Breakdown */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-300">Ingresos Generados</span>
                        <span className="text-2xl font-bold text-green-400">
                          {(() => {
                            // 🎯 USAR SUMMARY: Fuente única de verdad desde view-aggregator
                            if (projectVM) {
                              return formatCurrency(projectVM.revenueDisplay, projectVM.currencyNative);
                            }
                            // Fallback legacy
                            return `$${(unifiedData?.quotation?.totalAmount || 0).toLocaleString()}`;
                          })()}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${Math.min(100, (projectVM?.budgetUtilization || 0) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {(() => {
                          // 🎯 USAR PROJECT VM: Fuente única de verdad
                          if (projectVM) {
                            const costStr = formatCurrency(projectVM.costDisplay, projectVM.currencyNative);
                            const marginPercent = projectVM.margin != null ? projectVM.margin.toFixed(1) : '0.0';
                            return `Costo: ${costStr} • Margen: ${marginPercent}%`;
                          }
                          return 'Costo: $0 • Margen: 0%';
                        })()}
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-400">
                          {(projectVM?.markup || 0).toFixed(1)}x
                        </div>
                        <div className="text-xs text-slate-400">Multiplicador</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">
                          {(projectVM?.totalHours || 0)}h
                        </div>
                        <div className="text-xs text-slate-400">Total Trabajado</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-cyan-400">
                          {((projectVM?.budgetUtilization || 0) * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-400">Presupuesto Usado</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CROSS-TAB INSIGHTS - World Class Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Team Performance Summary (from Equipo tab) */}
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
                  <div className="space-y-4">
                    {/* Top Performers */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-green-700 mb-1">Mejor Rendimiento</div>
                        <div className="font-bold text-green-900">
                          {(() => {
                            const team = projectVM?.teamBreakdown || [];
                            const topPerformer = team.reduce((max: any, member: any) => 
                              (member.hours || 0) > (max.hours || 0) ? member : max, team[0] || {});
                            return topPerformer?.name || 'N/A';
                          })()}
                        </div>
                        <div className="text-xs text-green-600">
                          {(() => {
                            const team = projectVM?.teamBreakdown || [];
                            const topPerformer = team.reduce((max: any, member: any) => 
                              (member.hours || 0) > (max.hours || 0) ? member : max, team[0] || {});
                            return `${topPerformer?.hours || 0}h trabajadas`;
                          })()}
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-blue-700 mb-1">Velocidad Equipo</div>
                        <div className="font-bold text-blue-900">
                          {Math.round((projectVM?.totalAsanaHours || projectVM?.totalHours || 0) / 4)}h
                        </div>
                        <div className="text-xs text-blue-600">promedio semanal</div>
                      </div>
                    </div>
                    
                    {/* Team Efficiency Heatmap */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Carga de trabajo por miembro</div>
                      <div className="text-xs text-gray-500 mb-2">Pasa el mouse sobre cada inicial para ver detalles</div>
                      <div className="grid grid-cols-6 gap-1">
                        {(projectVM?.teamBreakdown || []).slice(0, 6).map((member: any, index) => (
                          <div 
                            key={index}
                            className={`h-8 rounded text-xs flex items-center justify-center text-white font-medium cursor-help relative group ${
                              (member.hoursAsana || member.hours || 0) > 80 ? 'bg-red-500' : 
                              (member.hoursAsana || member.hours || 0) > 50 ? 'bg-yellow-500' : 
                              (member.hoursAsana || member.hours || 0) > 20 ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                            title={`${member.name}: ${member.hoursAsana || member.hours || 0}h trabajadas - $${(member.costUSD || member.cost || 0).toLocaleString()} - Estado: ${
                              (member.hoursAsana || member.hours || 0) > 80 ? 'Sobrecarga' : 
                              (member.hoursAsana || member.hours || 0) > 50 ? 'Intenso' : 
                              (member.hoursAsana || member.hours || 0) > 20 ? 'Normal' : 'Bajo'
                            }`}
                          >
                            {(member.name || '?').charAt(0)}
                            
                            {/* Custom Tooltip */}
                            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-max">
                              <div className="space-y-1">
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-xs">🕐 {member.hoursAsana || member.hours || 0} horas trabajadas (Asana)</p>
                                <p className="text-xs">💰 ${(member.costUSD || member.cost || 0).toLocaleString()} costo total</p>
                                <p className="text-xs">
                                  📊 Estado: {
                                    (member.hoursAsana || member.hours || 0) > 80 ? 'Sobrecarga' : 
                                    (member.hoursAsana || member.hours || 0) > 50 ? 'Intenso' : 
                                    (member.hoursAsana || member.hours || 0) > 20 ? 'Normal' : 'Bajo'
                                  }
                                </p>
                              </div>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">Verde: Normal • Amarillo: Intenso • Rojo: Sobrecarga</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recomendaciones Automáticas */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Target className="h-5 w-5 text-orange-600" />
                      Recomendaciones Automáticas
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      IA Analytics
                    </Badge>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {(() => {
                      const budgetUsed = (projectVM?.budgetUtilization || 0) * 100;
                      const markup = projectVM?.markup || 0;
                      const recommendations = [];

                      const team = projectVM?.teamBreakdown || [];
                      const totalBudget = quotationData?.totalAmountNative || 1;
                      const actualCost = projectVM?.costDisplay || 0;
                      const remainingBudget = totalBudget - actualCost;
                      
                      // Recomendación específica basada en budget utilization con datos reales
                      if (budgetUsed > 85) {
                        const overspend = actualCost - totalBudget;
                        recommendations.push({
                          type: 'warning',
                          icon: '🚨',
                          title: 'Presupuesto Excedido en ' + formatCurrency(Math.abs(overspend), projectVM?.currencyNative || 'USD'),
                          description: `Ya gastaste ${formatCurrency(actualCost, projectVM?.currencyNative || 'USD')} de ${formatCurrency(totalBudget, projectVM?.currencyNative || 'USD')}. Renegocia con el cliente o reduce scope.`,
                          color: 'text-red-700',
                          bg: 'bg-red-50'
                        });
                      } else if (budgetUsed > 75) {
                        recommendations.push({
                          type: 'warning',
                          icon: '⚠️',
                          title: 'Quedan Solo ' + formatCurrency(remainingBudget, projectVM?.currencyNative || 'USD') + ' de Presupuesto',
                          description: `Con ${budgetUsed.toFixed(0)}% usado, prioriza tareas críticas. Estima ${Math.ceil(remainingBudget / 100)} horas máximas restantes.`,
                          color: 'text-orange-700',
                          bg: 'bg-orange-50'
                        });
                      } else if (budgetUsed < 30) {
                        const monthsElapsed = Math.ceil((Date.now() - new Date(unifiedData?.project?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30));
                        recommendations.push({
                          type: 'opportunity',
                          icon: '📈',
                          title: `Solo ${budgetUsed.toFixed(0)}% Usado en ${monthsElapsed} Mes(es)`,
                          description: `Puedes acelerar ${Math.floor(remainingBudget / 150)} días adicionales de trabajo. Considera ampliar scope.`,
                          color: 'text-blue-700',
                          bg: 'bg-blue-50'
                        });
                      }

                      // Recomendación específica basada en markup con números reales
                      if (markup < 1.3) {
                        const loss = actualCost - (actualCost / markup);
                        recommendations.push({
                          type: 'financial',
                          icon: '💸',
                          title: `Markup ${markup.toFixed(1)}x = Pérdida de $${loss.toLocaleString()}`,
                          description: `Para próximos proyectos similares, cotiza mín. $${(actualCost * 1.8).toLocaleString()} (markup 1.8x).`,
                          color: 'text-red-700',
                          bg: 'bg-red-50'
                        });
                      } else if (markup > 2.5) {
                        const profit = (actualCost * markup) - actualCost;
                        recommendations.push({
                          type: 'success',
                          icon: '🎯',
                          title: `Ganancia Excepcional: $${profit.toLocaleString()}`,
                          description: `Markup ${markup.toFixed(1)}x significa ${((markup-1)*100).toFixed(0)}% ganancia. Aplica esta estrategia a clientes similares.`,
                          color: 'text-green-700',
                          bg: 'bg-green-50'
                        });
                      }

                      // Recomendaciones específicas de equipo con nombres reales
                      const topPerformer = team.reduce((max: any, member: any) => 
                        (member.hours || 0) > (max.hours || 0) ? member : max, team[0] || {});
                      const overworkedMembers = team.filter((m: any) => (m.hours || 0) > 80);
                      
                      if (overworkedMembers.length > 0) {
                        const names = overworkedMembers.map((m: any) => m.name).join(', ');
                        const totalOvertime = overworkedMembers.reduce((sum: number, m: any) => sum + Math.max(0, (m.hours || 0) - 80), 0);
                        recommendations.push({
                          type: 'team',
                          icon: '👥',
                          title: `${names} Sobrecargado(s) - ${totalOvertime}h Extra`,
                          description: `Redistribuir ${Math.ceil(totalOvertime/2)}h a otros miembros o contratar soporte temporal.`,
                          color: 'text-purple-700',
                          bg: 'bg-purple-50'
                        });
                      } else if (topPerformer.name && topPerformer.hours > 40) {
                        recommendations.push({
                          type: 'team',
                          icon: '⭐',
                          title: `${topPerformer.name} Lidera con ${topPerformer.hours}h`,
                          description: `Top performer del proyecto. Considera asignarle más responsabilidades o rol de mentor.`,
                          color: 'text-green-700',
                          bg: 'bg-green-50'
                        });
                      }

                      // Si muy pocas recomendaciones, agregar recomendación de próximos pasos
                      if (recommendations.length < 2) {
                        const daysActive = Math.ceil((Date.now() - new Date(unifiedData?.project?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
                        recommendations.push({
                          type: 'general',
                          icon: '📋',
                          title: `Proyecto Activo ${daysActive} Días - Revisar Hitos`,
                          description: `Con ${budgetUsed.toFixed(0)}% progreso, programa check-in semanal y revisa deliverables pendientes.`,
                          color: 'text-blue-700',
                          bg: 'bg-blue-50'
                        });
                      }

                      return recommendations.slice(0, 3).map((rec, index) => (
                        <div key={index} className={`${rec.bg} rounded-lg p-4 border-l-4 ${rec.color.includes('red') ? 'border-red-400' : rec.color.includes('blue') ? 'border-blue-400' : rec.color.includes('orange') ? 'border-orange-400' : rec.color.includes('purple') ? 'border-purple-400' : 'border-green-400'}`}>
                          <div className="flex items-start gap-3">
                            <span className="text-lg">{rec.icon}</span>
                            <div>
                              <h4 className={`font-semibold text-sm ${rec.color}`}>
                                {rec.title}
                              </h4>
                              <p className="text-xs text-gray-600 mt-1">
                                {rec.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
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
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-900">
                      {(() => {
                        const budgetUsed = (projectVM?.budgetUtilization || 0) * 100;
                        const markup = projectVM?.markup || 0;
                        const team = projectVM?.teamBreakdown || [];
                        
                        // Factor de distribución del equipo (penaliza sobrecarga)
                        const overworkedMembers = team.filter((m: any) => (m.hours || 0) > 80).length;
                        const teamFactor = Math.max(0, 100 - (overworkedMembers * 20));
                        
                        // Fórmula mejorada y documentada
                        const budgetScore = (100 - budgetUsed) * 0.4; // Mejor si usa menos presupuesto
                        const profitabilityScore = Math.min(100, (markup - 1) * 35); // Mejor markup = mejor score
                        const teamScore = teamFactor * 0.25; // Penaliza equipo sobrecargado
                        
                        const totalScore = budgetScore + profitabilityScore + teamScore;
                        return Math.max(0, Math.min(100, totalScore)).toFixed(0);
                      })()}
                    </div>
                    <div className="text-xs text-gray-500">de 100 puntos</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => {
                        const budgetUsed = (projectVM?.budgetUtilization || 0) * 100;
                        const markup = projectVM?.markup || 0;
                        const team = projectVM?.teamBreakdown || [];
                        const overworkedMembers = team.filter((m: any) => (m.hours || 0) > 80).length;
                        const teamFactor = Math.max(0, 100 - (overworkedMembers * 20));
                        const budgetScore = (100 - budgetUsed) * 0.4;
                        const profitabilityScore = Math.min(100, (markup - 1) * 35);
                        const teamScore = teamFactor * 0.25;
                        const totalScore = budgetScore + profitabilityScore + teamScore;
                        const finalScore = Math.max(0, Math.min(100, totalScore));
                        
                        return (
                          <Star 
                            key={star} 
                            className={`h-4 w-4 ${
                              star <= Math.ceil(finalScore / 20) 
                                ? 'text-yellow-400 fill-current' 
                                : 'text-gray-300'
                            }`} 
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-center text-gray-500">
                    {(() => {
                      const budgetUsed = (projectVM?.budgetUtilization || 0) * 100;
                      const markup = projectVM?.markup || 0;
                      const team = projectVM?.teamBreakdown || [];
                      const overworkedMembers = team.filter((m: any) => (m.hours || 0) > 80).length;
                      const teamFactor = Math.max(0, 100 - (overworkedMembers * 20));
                      const budgetScore = (100 - budgetUsed) * 0.4;
                      const profitabilityScore = Math.min(100, (markup - 1) * 35);
                      const teamScore = teamFactor * 0.25;
                      const totalScore = budgetScore + profitabilityScore + teamScore;
                      const finalScore = Math.max(0, Math.min(100, totalScore));
                      
                      if (finalScore >= 80) return 'Excelente calidad del proyecto';
                      if (finalScore >= 60) return 'Buena calidad del proyecto';
                      if (finalScore >= 40) return 'Calidad aceptable';
                      return 'Necesita mejoras';
                    })()}
                  </div>
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

          </TabsContent>

          <TabsContent value="team-analysis" className="space-y-6">
            {/* Análisis operativo del equipo */}
            {(() => {
              console.log('✅ TAB EQUIPO CARGADO - project-details-redesigned.tsx');
              console.log('📊 projectVM.teamBreakdown:', projectVM?.teamBreakdown);
              return null;
            })()}
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
                              {projectVM ? formatCurrency(projectVM.costDisplay, projectVM.currencyNative) : '$0'}
                            </div>
                            <div className="text-sm font-medium text-gray-600">Costo Real del Equipo</div>
                            <div className="text-xs text-gray-500 mt-1">inversión total registrada</div>
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
                              <div className="text-2xl font-bold text-orange-600 mb-1 break-words">
                                {(() => {
                                  const totalARS = projectVM?.teamBreakdown?.reduce((sum, member) => {
                                    return sum + (member.costARS || 0);
                                  }, 0) || 0;
                                  return formatCurrency(totalARS, 'ARS');
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
                                return formatCurrencyFull(totalARS, 'ARS');
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

              {/* 🎯 VISUAL TEAM CARDS - Using projectVM for consistent data */}
              <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    Vista de Equipo - Tarjetas Visuales
                  </CardTitle>
                  <CardDescription className="text-base">
                    Desglose detallado por miembro del equipo con progreso y costos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProjectTeamSection 
                    projectId={projectId!}
                    projectVM={projectVM}
                    quotationTeam={(unifiedData as any)?.quotation?.team || []}
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

          <TabsContent value="performance-analysis" className="space-y-6">

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

            {/* RANKINGS ECONÓMICOS - VISTA COMPLETA */}
            <div className="grid grid-cols-1 gap-6">
              <EconomicRankings 
                projectId={Number(projectId)}
                timeFilter={timeFilterForHook}
                loading={!unifiedData}
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

          <TabsContent value="financial-analysis" className="space-y-6">
            {/* STARTUP-STYLE METRICS HEADER */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Análisis Financiero del Proyecto</h2>
                  <p className="text-violet-100">Métricas clave de rentabilidad y desempeño financiero</p>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <BarChart3 className="h-8 w-8" />
                </div>
              </div>
              
              {/* FINANCIAL METRICS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Markup */}
                <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm">Markup</p>
                      <p className="text-2xl font-bold">
                        {projectVM?.markup ? `${projectVM.markup.toFixed(2)}X` : 'N/A'}
                      </p>
                      <p className="text-xs text-violet-200">
                        {(() => {
                          if (!projectVM) return '$0 sobre costo';
                          const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                          return `${formatCurrency(profit, projectVM.currencyNative)} sobre costo`;
                        })()}
                      </p>
                    </div>
                    <DollarSign className="h-6 w-6 text-violet-200" />
                  </div>
                </div>

                {/* Margen Operativo */}
                <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm">Margen Operativo</p>
                      <p className="text-2xl font-bold">
                        {projectVM?.margin != null ? `${(projectVM.margin * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-violet-200">
                        {(() => {
                          if (!projectVM) return '$0 beneficio';
                          const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                          return `${formatCurrency(profit, projectVM.currencyNative)} beneficio`;
                        })()}
                      </p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-violet-200" />
                  </div>
                </div>

                {/* Burn Rate - Simplificado y auditable */}
                <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm">Burn Rate</p>
                      <p className="text-2xl font-bold">
                        {(() => {
                          if (!projectVM) return '$0';
                          const burnPerHour = projectVM.totalAsanaHours > 0 
                            ? projectVM.costDisplay / projectVM.totalAsanaHours 
                            : 0;
                          return `${formatCurrency(burnPerHour, projectVM.currencyNative)}/h`;
                        })()}
                      </p>
                      <p className="text-xs text-violet-200">costo por hora trabajada</p>
                    </div>
                    <Flame className="h-6 w-6 text-violet-200" />
                  </div>
                </div>

                {/* ROI */}
                <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm">ROI del Proyecto</p>
                      <p className="text-2xl font-bold">
                        {(() => {
                          if (!projectVM || !projectVM.markup) return '0%';
                          const roi = (projectVM.markup - 1) * 100;
                          return roi.toFixed(0);
                        })()}%
                      </p>
                      <p className="text-xs text-violet-200">
                        {(() => {
                          if (!projectVM || !projectVM.markup) return 'N/A';
                          const roi = (projectVM.markup - 1) * 100;
                          return roi > 50 ? 'Excelente' : roi > 25 ? 'Bueno' : roi > 0 ? 'Aceptable' : 'Bajo';
                        })()} retorno
                      </p>
                    </div>
                    <Target className="h-6 w-6 text-violet-200" />
                  </div>
                </div>
              </div>
            </div>

            {/* FINANCIAL PROJECTIONS & ANALYSIS */}
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Proyecciones Financieras y Análisis</h3>
                  <p className="text-sm text-gray-500">Métricas clave de rentabilidad y cash flow</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Ingresos Facturados */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Ingresos Facturados</span>
                  </div>
                  <div className="text-2xl font-bold text-green-800">
                    {projectVM ? formatCurrency(projectVM.revenueDisplay, projectVM.currencyNative) : '$0'}
                  </div>
                  <div className="text-xs text-green-600">
                    del período seleccionado
                  </div>
                </div>

                {/* Break-even Point */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Estado Financiero</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-800">
                    {(() => {
                      if (!projectVM) return 'N/A';
                      return projectVM.revenueDisplay >= projectVM.costDisplay ? 'Rentable' : 'En Déficit';
                    })()} 
                  </div>
                  <div className="text-xs text-blue-600">
                    {(() => {
                      if (!projectVM) return 'Sin datos';
                      const diff = projectVM.revenueDisplay - projectVM.costDisplay;
                      return diff >= 0 ? `+${formatCurrency(diff, projectVM.currencyNative)}` : formatCurrency(diff, projectVM.currencyNative);
                    })()} 
                  </div>
                </div>

                {/* Cash Flow Actual */}
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Beneficio Neto</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-800">
                    {(() => {
                      if (!projectVM) return '$0';
                      const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                      return formatCurrency(profit, projectVM.currencyNative);
                    })()}
                  </div>
                  <div className="text-xs text-purple-600">
                    {(() => {
                      if (!projectVM) return 'Sin datos';
                      const profit = projectVM.revenueDisplay - projectVM.costDisplay;
                      return profit > 0 ? 'Flujo positivo' : profit < 0 ? 'Flujo negativo' : 'Equilibrado';
                    })()} 
                  </div>
                </div>

                {/* Rentabilidad del Proyecto */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">Margen (%)</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-800">
                    {(() => {
                      if (!projectVM || projectVM.margin == null) return '0%';
                      return projectVM.margin > 0 ? `+${projectVM.margin.toFixed(1)}%` : `${projectVM.margin.toFixed(1)}%`;
                    })()} 
                  </div>
                  <div className="text-xs text-yellow-600">
                    {(() => {
                      if (!projectVM || projectVM.margin == null) return 'Sin datos';
                      return projectVM.margin > 30 ? 'Muy rentable' : projectVM.margin > 15 ? 'Rentable' : projectVM.margin > 0 ? 'Mínimo' : 'Pérdida';
                    })()} 
                  </div>
                </div>
              </div>
            </div>

            {/* FINANCIAL CHARTS SECTION */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Cost vs Revenue Trend Chart */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">Comparación Financiera</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Vista comparativa de ingresos totales vs costos reales del proyecto según datos del Star Schema</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-gray-500">Análisis de rentabilidad actual</p>
                  </div>
                </div>
                
                {(() => {
                  const revenue = projectVM?.revenueDisplay || 0;
                  const costs = projectVM?.costDisplay || 0;
                  const profit = revenue - costs;
                  const maxValue = Math.max(revenue, costs) || 1000;
                  const currency = projectVM?.currencyNative || 'USD';
                  
                  return (
                    <div className="h-64">
                      <div className="flex justify-center items-end h-48 px-4 gap-8">
                        {/* Revenue Bar */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-2 cursor-help">
                                <div 
                                  className="bg-gradient-to-t from-green-600 to-green-400 rounded-t w-20 shadow-lg"
                                  style={{ height: `${(revenue / maxValue) * 180}px` }}
                                ></div>
                                <span className="text-sm font-medium text-gray-700">Ingresos</span>
                                <span className="text-xs font-semibold text-green-600">
                                  {formatCurrency(revenue, currency)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold mb-1">Ingresos Totales</p>
                                <p>{formatCurrency(revenue, currency)}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Costs Bar */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-2 cursor-help">
                                <div 
                                  className="bg-gradient-to-t from-red-600 to-red-400 rounded-t w-20 shadow-lg"
                                  style={{ height: `${(costs / maxValue) * 180}px` }}
                                ></div>
                                <span className="text-sm font-medium text-gray-700">Costos</span>
                                <span className="text-xs font-semibold text-red-600">
                                  {formatCurrency(costs, currency)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold mb-1">Costos Totales</p>
                                <p>{formatCurrency(costs, currency)}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {projectVM?.totalAsanaHours || 0}h trabajadas
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Profit Bar */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-2 cursor-help">
                                <div 
                                  className={`rounded-t w-20 shadow-lg ${profit >= 0 ? 'bg-gradient-to-t from-blue-600 to-blue-400' : 'bg-gradient-to-t from-orange-600 to-orange-400'}`}
                                  style={{ height: `${(Math.abs(profit) / maxValue) * 180}px` }}
                                ></div>
                                <span className="text-sm font-medium text-gray-700">Margen</span>
                                <span className={`text-xs font-semibold ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                  {formatCurrency(profit, currency)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold mb-1">Margen de Ganancia</p>
                                <p>{formatCurrency(profit, currency)}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {((projectVM?.margin || 0) * 100).toFixed(1)}% margen
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="mt-4 flex justify-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded"></div>
                          <span className="text-sm text-gray-600">Ingresos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded"></div>
                          <span className="text-sm text-gray-600">Costos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded"></div>
                          <span className="text-sm text-gray-600">Margen</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Cost Breakdown Analysis */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Análisis de Costos por Categoría</h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Desglose detallado de los costos del proyecto por tipo de recurso y su impacto en la rentabilidad total</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-sm text-gray-500">Distribución de costos y rentabilidad</p>
                    </div>
                  </div>
                  
                  {/* Toggle View Button */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={(e) => {
                        // Mostrar vista por rol
                        document.querySelectorAll('.breakdown-person-view').forEach(el => el.classList.add('hidden'));
                        document.querySelector('.breakdown-role-view')?.classList.remove('hidden');
                        
                        // Actualizar botones
                        document.querySelectorAll('.breakdown-toggle-btn').forEach(btn => {
                          btn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
                          btn.classList.add('text-gray-500');
                        });
                        
                        e.currentTarget.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
                        e.currentTarget.classList.remove('text-gray-500');
                      }}
                      className="breakdown-toggle-btn px-3 py-1 text-xs font-medium rounded-md transition-colors bg-white text-gray-900 shadow-sm"
                    >
                      Por Rol
                    </button>
                    <button
                      onClick={(e) => {
                        // Mostrar vista por persona
                        document.querySelectorAll('.breakdown-role-view').forEach(el => el.classList.add('hidden'));
                        document.querySelector('.breakdown-person-view')?.classList.remove('hidden');
                        
                        // Actualizar botones
                        document.querySelectorAll('.breakdown-toggle-btn').forEach(btn => {
                          btn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
                          btn.classList.add('text-gray-500');
                        });
                        
                        e.currentTarget.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
                        e.currentTarget.classList.remove('text-gray-500');
                      }}
                      className="breakdown-toggle-btn px-3 py-1 text-xs font-medium rounded-md transition-colors text-gray-500 hover:text-gray-700"
                    >
                      Por Persona
                    </button>
                  </div>
                </div>

                {/* Vista por Rol */}
                <div className="space-y-4 breakdown-role-view">
                  {(() => {
                    const totalCost = projectVM?.costDisplay || 0;
                    const totalRevenue = projectVM?.revenueDisplay || 0;
                    const teamBreakdown = projectVM?.teamBreakdown || [];
                    
                    // Vista por roles configurados en la app
                    const roleGroups: { [key: string]: { cost: number, count: number, color: string } } = {};
                    
                    teamBreakdown.forEach((member: any) => {
                      const roleName = member.role || member.roleName || 'Sin Rol Asignado';
                      if (!roleGroups[roleName]) {
                        // Mapeo de colores para los roles REALES en la base de datos
                        const colorMap: { [key: string]: string } = {
                          'Analista Senior': 'bg-blue-500',
                          'Data Senior': 'bg-green-500', 
                          'Analista Semi Senior': 'bg-blue-400',
                          'Project Manager': 'bg-orange-500',
                          'Lead Project Manager': 'bg-orange-600',
                          'Data Semi Senior': 'bg-green-400',
                          'Analista Junior': 'bg-blue-300',
                          'Data Junior': 'bg-green-300',
                          'CEO': 'bg-red-600',
                          'COO': 'bg-red-500',
                          'Operations Lead': 'bg-gray-600',
                          'Account Director': 'bg-purple-500',
                          'Tech Lead': 'bg-cyan-500',
                          'Diseñador/a': 'bg-pink-500',
                          'Freelancer Excel': 'bg-yellow-500',
                          'Sin Rol Asignado': 'bg-gray-500'
                        };
                        roleGroups[roleName] = {
                          cost: 0,
                          count: 0,
                          color: colorMap[roleName] || 'bg-indigo-500'
                        };
                      }
                      roleGroups[roleName].cost += (member.costUSD || member.cost || 0);
                      roleGroups[roleName].count += 1;
                    });
                    
                    // Convertir a array (SOLO roles de personal)
                    const categories = Object.entries(roleGroups).map(([name, data]) => ({
                      name,
                      cost: data.cost,
                      color: data.color,
                      count: data.count
                    }));
                    
                    // REMOVIDO: Margen de Beneficio no es un rol
                    
                    return categories.map((category, index) => {
                      const percentage = totalRevenue > 0 ? (category.cost / totalRevenue * 100) : 0;
                      
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded ${category.color}`}></div>
                              <div>
                                <span className="text-sm font-medium text-gray-900">{category.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({category.count} {category.count === 1 ? 'recurso' : 'recursos'})</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">{formatCurrency(category.cost, projectVM?.currencyNative || 'USD')}</div>
                              <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${category.color}`} 
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                {/* Vista por Persona */}
                <div className="space-y-4 breakdown-person-view hidden">
                  {(() => {
                    const totalCost = projectVM?.costDisplay || 0;
                    const totalRevenue = projectVM?.revenueDisplay || 0;
                    const teamBreakdown = projectVM?.teamBreakdown || [];
                    
                    // Vista por persona individual
                    const personColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-pink-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-gray-500'];
                    
                    const categories = teamBreakdown.map((member: any, index: number) => ({
                      name: member.name,
                      cost: member.costUSD || member.cost || 0,
                      color: personColors[index % personColors.length],
                      count: 1,
                      subtitle: member.role || member.roleName || 'Sin rol asignado'
                    }));
                    
                    // REMOVIDO: Margen de Beneficio no es una persona
                    
                    return categories.map((category, index) => {
                      const percentage = totalRevenue > 0 ? (category.cost / totalRevenue * 100) : 0;
                      
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded ${category.color}`}></div>
                              <div>
                                <span className="text-sm font-medium text-gray-900">{category.name}</span>
                                {category.subtitle && (
                                  <div className="text-xs text-gray-500">{category.subtitle}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">{formatCurrency(category.cost, projectVM?.currencyNative || 'USD')}</div>
                              <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${category.color}`} 
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  
                  {/* Summary */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">Total del Proyecto</span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{formatCurrency(projectVM?.revenueDisplay || 0, projectVM?.currencyNative || 'USD')}</div>
                        <div className="text-xs text-gray-500">
                          Costo: {formatCurrency(projectVM?.costDisplay || 0, projectVM?.currencyNative || 'USD')} | 
                          Beneficio: {formatCurrency((projectVM?.revenueDisplay || 0) - (projectVM?.costDisplay || 0), projectVM?.currencyNative || 'USD')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ADVANCED METRICS DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Resource Efficiency Gauge */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Gauge className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">Eficiencia de Recursos</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Mide qué tan eficientemente se están utilizando los recursos del proyecto. Cálculo: (Horas Trabajadas / Horas Estimadas) * 100. Un valor óptimo está entre 85-100%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-gray-500">Optimización de recursos</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#f3f4f6"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray={`${(() => {
                          const workedHours = projectVM?.totalHours || 0;
                          const estimatedHours = projectVM?.estimatedHours || 1;
                          return estimatedHours > 0 ? Math.min((workedHours / estimatedHours) * 100, 100) : 0;
                        })()}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">
                        {(() => {
                          const workedHours = projectVM?.totalHours || 0;
                          const estimatedHours = projectVM?.estimatedHours || 1;
                          const resourceEfficiency = estimatedHours > 0 ? Math.min((workedHours / estimatedHours) * 100, 100) : 0;
                          return resourceEfficiency.toFixed(1);
                        })()}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Eficiencia Global</p>
                </div>
              </div>

              {/* Financial Health Score */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">Salud Financiera</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Evalúa la rentabilidad del proyecto combinando margen de beneficio (70%) y eficiencia operacional (30%). Fórmula: [(Ingresos - Costos) / Ingresos] * 0.7 + [Eficiencia] * 0.3</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-gray-500">Puntuación de salud financiera</p>
                  </div>
                </div>

                {(() => {
                  const revenue = projectVM?.revenueDisplay || 0;
                  const costs = projectVM?.costDisplay || 0;
                  const profitMargin = projectVM?.margin || 0;
                  const budgetUtil = projectVM?.budgetUtilization || 0;
                  const efficiency = budgetUtil > 0 ? Math.max(0, (1 - budgetUtil) * 100) : 100;
                  // Better Financial Health calculation: weight profit margin more heavily
                  const profitScore = Math.max(0, Math.min(100, profitMargin * 100));
                  const efficiencyScore = Math.max(0, Math.min(100, efficiency));
                  const healthScore = Math.round((profitScore * 0.7) + (efficiencyScore * 0.3));
                  const healthColor = healthScore > 80 ? 'text-green-600' : healthScore > 60 ? 'text-yellow-600' : 'text-red-600';
                  const healthStatus = healthScore > 80 ? 'Excelente' : healthScore > 60 ? 'Bueno' : 'Requiere Atención';
                  
                  return (
                    <div className="text-center">
                      <div className={`text-4xl font-bold mb-2 ${healthColor}`}>
                        {healthScore}
                      </div>
                      <div className="text-sm text-gray-500 mb-3">{healthStatus}</div>
                      <div className="flex justify-center">
                        {healthScore > 80 ? 
                          <CheckCircle className="h-8 w-8 text-green-500" /> : 
                          healthScore > 60 ?
                          <AlertCircle className="h-8 w-8 text-yellow-500" /> :
                          <XCircle className="h-8 w-8 text-red-500" />}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Break-even Analysis */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Target className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">Análisis de Punto de Equilibrio</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Compara los ingresos del proyecto contra los costos totales para determinar si el proyecto ha alcanzado su punto de equilibrio financiero</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-gray-500">Punto de equilibrio</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Ingresos Actuales</span>
                    <span className="font-semibold">{formatCurrency(projectVM?.revenueDisplay || 0, projectVM?.currencyNative || 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Costos Totales</span>
                    <span className="font-semibold">{formatCurrency(projectVM?.costDisplay || 0, projectVM?.currencyNative || 'USD')}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Estado de Punto de Equilibrio</span>
                      <span className={`font-semibold ${(projectVM?.revenueDisplay || 0) > (projectVM?.costDisplay || 0) ? 'text-green-600' : 'text-red-600'}`}>
                        {(projectVM?.revenueDisplay || 0) > (projectVM?.costDisplay || 0) ? 'Alcanzado ✓' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  {(projectVM?.revenueDisplay || 0) > (projectVM?.costDisplay || 0) && (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="text-sm text-green-800">
                        <span className="font-semibold">Margen: </span>
                        {formatCurrency((projectVM?.revenueDisplay || 0) - (projectVM?.costDisplay || 0), projectVM?.currencyNative || 'USD')}
                        <span className="text-xs ml-2">({((projectVM?.margin || 0) * 100).toFixed(1)}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="operational-analysis" className="space-y-6">
            {/* HEADER PRINCIPAL */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Análisis Operacional</h2>
                  <p className="text-purple-100">Flujos de trabajo, procesos y optimización del rendimiento operativo</p>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <Cog className="h-8 w-8" />
                </div>
              </div>
            </div>

            {/* MÉTRICAS OPERACIONALES PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Flujo de Trabajo</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {unifiedData?.actuals?.teamBreakdown ? 
                          `${unifiedData.actuals.teamBreakdown.filter(m => m.hours > 0).length}→${unifiedData.actuals.teamBreakdown.length}` : 
                          '0→0'
                        }
                      </p>
                      <p className="text-xs text-blue-600 mt-1">Activos → Total equipo</p>
                    </div>
                    <Zap className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Cuellos de Botella</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {unifiedData?.actuals?.teamBreakdown ? (() => {
                          const bottlenecks = unifiedData.actuals.teamBreakdown.filter(m => m.hours > 80).length;
                          return bottlenecks;
                        })() : 0}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">Recursos sobrecargados</p>
                    </div>
                    <Activity className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">Dependencias</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {unifiedData?.actuals?.teamBreakdown ? (() => {
                          const uniqueRoles = new Set(unifiedData.actuals.teamBreakdown.filter(m => m.hours > 0).map(m => m.roleName || 'Sin Rol'));
                          return uniqueRoles.size;
                        })() : 0}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">Roles interdependientes</p>
                    </div>
                    <Brain className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Riesgo Operacional</p>
                      <p className="text-2xl font-bold text-green-900">
                        {projectVM?.budgetUtilization ? (() => {
                          const budgetUsed = (projectVM.budgetUtilization || 0) * 100;
                          const risk = budgetUsed < 50 ? 'Bajo' : budgetUsed < 80 ? 'Medio' : 'Alto';
                          return risk;
                        })() : 'N/A'}
                      </p>
                      <p className="text-xs text-green-600 mt-1">Evaluación del proceso</p>
                    </div>
                    <Heart className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ANÁLISIS DETALLADO - PRIMERA FILA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Velocidad de Proceso */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Velocidad de Proceso
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Análisis de velocidad y ritmo de trabajo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {(() => {
                      const totalHours = unifiedData?.actuals?.totalWorkedHours || 0;
                      const estimatedHours = unifiedData?.quotation?.estimatedHours || 0;
                      const timeFilter = unifiedData?.timeFilter || '';
                      
                      // Detectar si es un período histórico (pasado)
                      const now = new Date();
                      const currentMonth = now.getMonth() + 1; // 1-12
                      const currentYear = now.getFullYear();
                      
                      let isHistoricalPeriod = false;
                      
                      // Verificar diferentes formatos de filtro temporal
                      if (timeFilter.includes('august_2025') || timeFilter.includes('agosto_2025')) {
                        isHistoricalPeriod = currentMonth > 8 || currentYear > 2025;
                      } else if (timeFilter.includes('july_2025') || timeFilter.includes('julio_2025')) {
                        isHistoricalPeriod = currentMonth > 7 || currentYear > 2025;
                      } else if (timeFilter.includes('september_2025') || timeFilter.includes('septiembre_2025')) {
                        isHistoricalPeriod = currentMonth > 9 || currentYear > 2025;
                      } else if (timeFilter.includes('2024')) {
                        isHistoricalPeriod = currentYear > 2024;
                      }
                      
                      const weeksElapsed = 4;
                      const weeklyVelocity = totalHours / weeksElapsed;
                      const remainingHours = Math.max(0, estimatedHours - totalHours);
                      
                      return (
                        <>
                          <div className="text-center p-3 bg-blue-50 rounded-lg border">
                            <div className="text-xl font-bold text-blue-700">{weeklyVelocity.toFixed(1)}h</div>
                            <div className="text-xs text-blue-600">Velocidad Semanal</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg border">
                            {isHistoricalPeriod ? (
                              <>
                                <div className="text-xl font-bold text-green-700">✓</div>
                                <div className="text-xs text-green-600">Período Completado</div>
                              </>
                            ) : (
                              <>
                                <div className="text-xl font-bold text-green-700">{weeklyVelocity > 0 ? Math.ceil(remainingHours / weeklyVelocity) : 0}</div>
                                <div className="text-xs text-green-600">Semanas Restantes</div>
                              </>
                            )}
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg border">
                            <div className="text-xl font-bold text-purple-700">{estimatedHours > 0 ? ((totalHours / estimatedHours) * 100).toFixed(0) : 0}%</div>
                            <div className="text-xs text-purple-600">Progreso</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  <div className="border-t pt-3">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Equipo Activo</h5>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {unifiedData?.actuals?.teamBreakdown?.filter(m => m.hours > 0).slice(0, 3).map((member, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{member.name}</span>
                          <span className="text-blue-600">{member.hours}h</span>
                        </div>
                      )) || <p className="text-gray-500 text-sm">No hay datos</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Patrones de Colaboración */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Heart className="h-5 w-5 text-pink-600" />
                    Patrones de Colaboración
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Análisis de roles y trabajo en equipo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {unifiedData?.actuals?.teamBreakdown && (() => {
                      const activeMembers = unifiedData.actuals.teamBreakdown.filter(m => m.hours > 0);
                      
                      return activeMembers.map((member, index) => {
                        const workIntensity = member.hours / Math.max(...activeMembers.map(m => m.hours));
                        const collaborationType = member.roleName === 'Analista Senior' ? 'Ejecutor Principal' :
                                                 member.roleName === 'Operations Lead' ? 'Coordinador' :
                                                 member.roleName === 'Project Manager' ? 'Supervisor' : 'Especialista';
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                collaborationType === 'Ejecutor Principal' ? 'bg-green-500' :
                                collaborationType === 'Coordinador' ? 'bg-blue-500' :
                                collaborationType === 'Supervisor' ? 'bg-purple-500' : 'bg-orange-500'
                              }`}></div>
                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">{member.name}</h4>
                                <div className="text-xs text-gray-600">{collaborationType}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{(workIntensity * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                        );
                      });
                    })() || <p className="text-gray-500">No hay datos</p>}
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* PREDICCIÓN Y RECOMENDACIONES */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Predicción y Recomendaciones
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Proyecciones inteligentes y recomendaciones de optimización</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {(() => {
                    const workedHours = unifiedData?.actuals?.totalWorkedHours || 0;
                    const estimatedHours = unifiedData?.quotation?.estimatedHours || 0;
                    const workedCost = unifiedData?.actuals?.totalWorkedCost || 0;
                    const budgetCost = unifiedData?.quotation?.totalAmount || 0;
                    
                    const progressPercent = estimatedHours > 0 ? (workedHours / estimatedHours) * 100 : 0;
                    const currentBurnRate = workedHours > 0 ? workedCost / workedHours : 0;
                    const projectedTotalCost = currentBurnRate * estimatedHours;
                    const budgetOverrun = Math.max(0, projectedTotalCost - budgetCost);
                    const overrunProbability = budgetOverrun > 0 ? Math.min(90, (budgetOverrun / budgetCost) * 100) : 10;
                    const riskLevel = overrunProbability < 25 ? 'Bajo' : overrunProbability < 60 ? 'Medio' : 'Alto';
                    const riskColor = riskLevel === 'Bajo' ? 'text-green-600' : riskLevel === 'Medio' ? 'text-yellow-600' : 'text-red-600';

                    // Recomendación inteligente
                    const activeMembers = unifiedData?.actuals?.teamBreakdown?.filter(m => m.hours > 0) || [];
                    const overloadedMembers = activeMembers.filter(m => m.hours > 80);
                    
                    let recommendation = '';
                    let recommendationIcon = '';
                    let recommendationColor = 'bg-blue-50 border-blue-200';

                    if (progressPercent > 80) {
                      recommendation = 'Proyecto en fase final. Mantener calidad y controlar costos.';
                      recommendationIcon = '✓';
                      recommendationColor = 'bg-green-50 border-green-200';
                    } else if (budgetOverrun > budgetCost * 0.1) {
                      recommendation = 'Riesgo alto de exceso. Revisar scope inmediatamente.';
                      recommendationIcon = '⚠';
                      recommendationColor = 'bg-red-50 border-red-200';
                    } else if (overloadedMembers.length > 0) {
                      recommendation = `${overloadedMembers.length} miembro(s) sobrecargado(s). Balancear carga de trabajo.`;
                      recommendationIcon = '⚖️';
                      recommendationColor = 'bg-orange-50 border-orange-200';
                    } else {
                      recommendation = 'Proyecto en desarrollo normal. Continuar monitoreando.';
                      recommendationIcon = '→';
                      recommendationColor = 'bg-blue-50 border-blue-200';
                    }

                    return (
                      <>
                        {/* Proyección de Costos */}
                        <div className="p-4 bg-emerald-50 rounded-lg border">
                          <h4 className="font-medium text-emerald-700 mb-3">Proyección de Costos</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Actual</span>
                              <span className="font-semibold">${workedCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Proyectado</span>
                              <span className="font-semibold">${projectedTotalCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="text-gray-600">Presupuesto</span>
                              <span className="font-semibold">${budgetCost.toLocaleString()}</span>
                            </div>
                            {budgetOverrun > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Exceso</span>
                                <span className="font-semibold">+${budgetOverrun.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Análisis de Riesgo */}
                        <div className="p-4 bg-orange-50 rounded-lg border">
                          <h4 className="font-medium text-orange-700 mb-3">Análisis de Riesgo</h4>
                          <div className="text-center mb-3">
                            <div className={`text-2xl font-bold ${riskColor}`}>{riskLevel}</div>
                            <div className="text-sm text-gray-600">Riesgo de Exceso</div>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>• Burn rate: ${currentBurnRate.toFixed(0)}/h</div>
                            <div>• Progreso: {progressPercent.toFixed(1)}%</div>
                            <div>• Probabilidad: {overrunProbability.toFixed(0)}%</div>
                          </div>
                        </div>

                        {/* Recomendación Principal */}
                        <div className={`p-4 rounded-lg border-2 ${recommendationColor}`}>
                          <h4 className="font-medium text-gray-700 mb-3">Recomendación</h4>
                          <div className="flex items-start gap-3">
                            <div className="text-lg">{recommendationIcon}</div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-700">{recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
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
