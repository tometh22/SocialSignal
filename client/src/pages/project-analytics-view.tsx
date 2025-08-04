import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import ProjectAnalytics from "@/components/dashboard/project-analytics";
import ChartModal from "@/components/project/chart-modal";
import HelpDialog from "@/components/project/help-dialog";
import { AlwaysOnBudgetAlert } from "@/components/project/always-on-budget-alert";
import { BudgetSummaryPanel } from "@/components/always-on/budget-summary-panel";
import { ProjectHealthIndicators } from "@/components/always-on/project-health-indicators";
import { BudgetAllocationTool } from "@/components/always-on/budget-allocation-tool";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Calendar, Home, LineChart, User, ExternalLink, PencilIcon, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditMacroProjectButton from "@/components/always-on/edit-macro-project-button";
import { format, subDays } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
// Interfaces para el tipado
interface CostSummary {
  estimatedCost: number;
  actualCost: number;
  variance: number;
  percentageUsed: number;
  monthlyEstimatedCost?: number;
  quotationMultiplier?: number;
}

interface ProjectMetrics {
  hoursPerDay: number;
  progressPercentage: number;
  plannedHours: number;
  actualHours: number;
  daysElapsed: number;
  daysTotal: number;
}

interface ActiveProject {
  id: number;
  quotationId: number;
  status: string;
  startDate: string;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  trackingFrequency: string;
  notes: string | null;
  isAlwaysOnMacro?: boolean;
  macroMonthlyBudget?: number;
  parentProjectId?: number;
  quotation: {
    id: number;
    projectName: string;
    clientId: number;
    totalAmount: number;
        baseCost?: number;
    estimatedHours?: number;
    projectType?: string;
    billingFrequency?: string;
    client?: {
      id: number;
      name: string;
      logoUrl?: string;
    };
  };
}

interface TimeEntry {
  id: number;
  projectId: number;
  personnelId: number;
  date: string;
  hours: number;
  description: string | null;
  approved: boolean;
  billable: boolean;
  hourlyRate?: number;
  hourlyRateAtTime?: number;
}

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface Role {
  id: number;
  name: string;
  description: string;
  hourlyRate: number;
}

// Estado para el modal de gráficos expandidos
interface ExpandedChartState {
  isOpen: boolean;
  title: string;
  type: string | null;
}

// Estado para el modal de ayuda
interface HelpState {
  isOpen: boolean;
  title: string;
  content: string;
}

/**
 * Vista analítica de proyecto con visualización de datos y métricas optimizadas
 */
const ProjectAnalyticsView: React.FC = () => {
  const { projectId } = useParams();
  const parsedProjectId = projectId ? parseInt(projectId) : null;
  const [, setLocation] = useLocation();

  // Estados
  const [timeFilter, setTimeFilter] = useState("all"); // "week", "month", "quarter", "all"
  const [expandedChart, setExpandedChart] = useState<ExpandedChartState>({
    isOpen: false,
    title: "",
    type: null
  });
  const [showHelp, setShowHelp] = useState<HelpState>({
    isOpen: false,
    title: "",
    content: ""
  });
    const [customDateRange, setCustomDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // Toast para notificaciones y estado del dialog
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Consultas de datos
  const { data: project, isLoading: isLoadingProject } = useQuery<ActiveProject>({
    queryKey: [`/api/active-projects/${parsedProjectId}`],
    enabled: !!parsedProjectId,
  });

  const { data: timeEntries = [], isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: [`/api/time-entries/project/${parsedProjectId}`],
    enabled: !!parsedProjectId,
  });

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const { data: personnel = [], isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
  });

  // Obtener datos MODO para el proyecto
  const { data: deliverableData, isLoading: isLoadingDeliverable } = useQuery<any>({
    queryKey: [`/api/modo/deliverables/project/${parsedProjectId}`],
    enabled: !!parsedProjectId,
  });

  // Estado de carga general
  const isLoading = 
    isLoadingProject || 
    isLoadingTimeEntries || 
    isLoadingRoles || 
    isLoadingPersonnel || 
    isLoadingDeliverable;

    const quotationData = project?.quotation;

  // Función para calcular el multiplicador de objetivos según el período seleccionado
  const getQuotationMultiplier = useCallback(() => {
    if (!project?.quotation) return 1;

    // Si es un proyecto one-shot, siempre usar multiplicador 1
    const isOneShot = project.quotation.projectType === 'one_shot' || 
                     project.quotation.billingFrequency === 'one_time' ||
                     !project.quotation.billingFrequency;

    if (isOneShot) return 1;

    // Para proyectos con fee mensual, calcular multiplicador según período
    switch (timeFilter) {
      case "current_month":
      case "last_month":
        return 1; // 1 mes
      case "current_quarter":
      case "last_quarter":
        return 3; // 3 meses
      case "current_semester":
      case "last_semester":
        return 6; // 6 meses
      case "current_year":
        return 12; // 12 meses
      case "custom":
        if (!customDateRange.start || !customDateRange.end) return 1;
        // Calcular número de meses entre fechas
        const monthDiff = Math.ceil(
          (customDateRange.end.getTime() - customDateRange.start.getTime()) / 
          (1000 * 60 * 60 * 24 * 30)
        );
        return Math.max(1, monthDiff);
      case "all":
        // Para "all", calcular meses desde inicio del proyecto
        if (!project.startDate) return 1;
        const projectStart = new Date(project.startDate);
        const now = new Date();
        const totalMonths = Math.ceil(
          (now.getTime() - projectStart.getTime()) / 
          (1000 * 60 * 60 * 24 * 30)
        );
        return Math.max(1, totalMonths);
      default:
        return 1;
    }
  }, [timeFilter, customDateRange, project]);

  // Función para filtrar registros de tiempo según el filtro seleccionado
  const getFilteredTimeEntries = useCallback((entries: TimeEntry[], filter: string) => {
    if (!entries || entries.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    console.log('🔍 Filtering entries:', {
      totalEntries: entries.length,
      filter,
      currentYear,
      currentMonth,
      sampleEntry: entries[0] ? {
        id: entries[0].id,
        date: entries[0].date,
        createdAt: entries[0].createdAt,
        hours: entries[0].hours
      } : null
    });

    switch (filter) {
      case "current_month":
        const currentMonthFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const matches = entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
          return matches;
        });
        console.log('📅 Current month filtered:', currentMonthFiltered.length);
        return currentMonthFiltered;

      case "last_month":
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const lastMonthFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const entryYear = entryDate.getFullYear();
          const entryMonth = entryDate.getMonth();
          const matches = entryYear === lastMonthYear && entryMonth === lastMonth;
          
          console.log('🔍 Entry check:', {
            entryId: entry.id,
            entryDate: entryDate.toLocaleDateString('es-ES'),
            entryYear,
            entryMonth,
            targetYear: lastMonthYear,
            targetMonth: lastMonth,
            matches
          });
          
          return matches;
        });
        console.log('📅 Last month filtered:', lastMonthFiltered.length, { 
          lastMonth, 
          lastMonthYear,
          totalEntries: entries.length,
          sampleFiltered: lastMonthFiltered.slice(0, 3).map(e => ({
            id: e.id,
            date: e.date,
            hours: e.hours,
            personnelId: e.personnelId
          }))
        });
        return lastMonthFiltered;

      case "current_quarter":
        const currentQuarter = Math.floor(currentMonth / 3);
        const quarterStartMonth = currentQuarter * 3;
        const quarterEndMonth = quarterStartMonth + 2;
        const currentQuarterFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const entryMonth = entryDate.getMonth();
          const matches = entryDate.getFullYear() === currentYear && 
                 entryMonth >= quarterStartMonth && 
                 entryMonth <= quarterEndMonth;
          return matches;
        });
        console.log('📅 Current quarter filtered:', currentQuarterFiltered.length);
        return currentQuarterFiltered;

      case "last_quarter":
        const lastQuarter = currentMonth < 3 ? 3 : Math.floor(currentMonth / 3) - 1;
        const lastQuarterYear = currentMonth < 3 ? currentYear - 1 : currentYear;
        const lastQuarterStartMonth = lastQuarter * 3;
        const lastQuarterEndMonth = lastQuarterStartMonth + 2;
        const lastQuarterFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const entryMonth = entryDate.getMonth();
          const matches = entryDate.getFullYear() === lastQuarterYear && 
                 entryMonth >= lastQuarterStartMonth && 
                 entryMonth <= lastQuarterEndMonth;
          return matches;
        });
        console.log('📅 Last quarter filtered:', lastQuarterFiltered.length, { lastQuarter, lastQuarterYear });
        return lastQuarterFiltered;

      case "current_semester":
        const currentSemester = Math.floor(currentMonth / 6);
        const semesterStartMonth = currentSemester * 6;
        const semesterEndMonth = semesterStartMonth + 5;
        const currentSemesterFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const entryMonth = entryDate.getMonth();
          const matches = entryDate.getFullYear() === currentYear && 
                 entryMonth >= semesterStartMonth && 
                 entryMonth <= semesterEndMonth;
          return matches;
        });
        console.log('📅 Current semester filtered:', currentSemesterFiltered.length);
        return currentSemesterFiltered;

      case "last_semester":
        const lastSemester = currentMonth < 6 ? 1 : 0;
        const lastSemesterYear = currentMonth < 6 ? currentYear - 1 : currentYear;
        const lastSemesterStartMonth = lastSemester * 6;
        const lastSemesterEndMonth = lastSemesterStartMonth + 5;
        const lastSemesterFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const entryMonth = entryDate.getMonth();
          const matches = entryDate.getFullYear() === lastSemesterYear && 
                 entryMonth >= lastSemesterStartMonth && 
                 entryMonth <= lastSemesterEndMonth;
          return matches;
        });
        console.log('📅 Last semester filtered:', lastSemesterFiltered.length);
        return lastSemesterFiltered;

      case "current_year":
        const currentYearFiltered = entries.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          const matches = entryDate.getFullYear() === currentYear;
          return matches;
        });
        console.log('📅 Current year filtered:', currentYearFiltered.length);
        return currentYearFiltered;

      case "all":
      default:
        console.log('📅 All entries (no filter):', entries.length);
        return entries;
    }
  }, []);

  // Aplicar filtros a los datos
  const filteredTimeEntries = useMemo(() => {
    const filtered = getFilteredTimeEntries(timeEntries, timeFilter);
    console.log('📊 Final filtered entries:', {
      filter: timeFilter,
      originalCount: timeEntries.length,
      filteredCount: filtered.length,
      totalHours: filtered.reduce((sum, entry) => sum + (entry.hours || 0), 0),
      sampleEntries: filtered.slice(0, 3).map(e => ({
        id: e.id,
        date: e.date,
        hours: e.hours,
        personnelId: e.personnelId
      }))
    });
    return filtered;
  }, [timeEntries, timeFilter, getFilteredTimeEntries]);

  // Calcular resumen de costos usando datos filtrados - USANDO LÓGICA CONSISTENTE
  const costSummary = useMemo(() => {
    if (!quotationData || !personnel || !roles) return null;

    const dataToUse = timeFilter === "all" ? timeEntries : filteredTimeEntries;

    // Calcular costo real usando la misma lógica que getProjectCostSummary
    let actualCost = 0;
    let operationalCost = 0;
    
    // Agrupar por persona y mes
    const personMonthGroups = new Map<string, { person: any, entries: any[], monthYear: string }>();
    
    dataToUse.forEach(entry => {
      const person = personnel.find(p => p.id === entry.personnelId);
      if (!person || !entry.hours) return;
      
      const entryDate = new Date(entry.date || entry.createdAt);
      const monthYear = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
      const key = `${person.id}-${monthYear}`;
      
      if (!personMonthGroups.has(key)) {
        personMonthGroups.set(key, {
          person,
          entries: [],
          monthYear
        });
      }
      
      personMonthGroups.get(key)!.entries.push(entry);
    });

    // Calcular costos por persona/mes
    personMonthGroups.forEach(({ person, entries }) => {
      const totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      
      if (person.contractType === 'full-time' && person.monthlyFixedSalary) {
        // Full-time: No genera costo real, solo operacional
        operationalCost += totalHours * person.hourlyRate;
      } else {
        // Freelance/Part-time: Genera costo real
        const costForPeriod = totalHours * person.hourlyRate;
        actualCost += costForPeriod;
        operationalCost += costForPeriod;
      }
    });

    // Para proyectos Always-On, ajustar el costo planificado según el período
    let plannedCost = quotationData.finalPrice || 0;
    if (quotationData.projectType === 'always-on' && timeFilter !== "all") {
      const quotationMultiplier = getQuotationMultiplier(timeFilter);
      plannedCost = (quotationData.finalPrice || 0) * quotationMultiplier;
    }

    const percentageUsed = plannedCost > 0 ? (actualCost / plannedCost) * 100 : 0;

    console.log('💰 Cost summary calculated (CONSISTENT LOGIC):', {
      filter: timeFilter,
      actualCost: actualCost.toFixed(2),
      operationalCost: operationalCost.toFixed(2),
      plannedCost,
      percentageUsed,
      entriesUsed: dataToUse.length,
      personGroups: personMonthGroups.size,
      projectType: quotationData.projectType
    });

    return {
      actualCost,
      operationalCost,
      plannedCost,
      percentageUsed: Math.min(percentageUsed, 100)
    };
  }, [quotationData, personnel, roles, timeEntries, filteredTimeEntries, timeFilter]);

  // Calcular métricas del proyecto usando datos filtrados
  const projectMetrics = useMemo(() => {
    if (!project) return null;

    // Usar datos filtrados o todos los datos según el filtro
    const dataToUse = timeFilter === "all" ? timeEntries : filteredTimeEntries;
    const actualHours = dataToUse.reduce((sum, entry) => sum + (entry.hours || 0), 0);

    // Para proyectos Always-On, ajustar las horas planificadas según el período
    let plannedHours = project.quotation?.totalHours || 0;

    if (quotationData?.projectType === 'always-on' && timeFilter !== "all") {
      const quotationMultiplier = getQuotationMultiplier();
      plannedHours = (project.quotation?.totalHours || 0) * quotationMultiplier;
    }

    const startDate = project.startDate ? new Date(project.startDate) : new Date();
    const endDate = project.expectedEndDate ? new Date(project.expectedEndDate) : new Date();
    const currentDate = new Date();

    const totalTime = endDate.getTime() - startDate.getTime();
    const elapsedTime = currentDate.getTime() - startDate.getTime();

    const daysTotal = Math.ceil(totalTime / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil(elapsedTime / (1000 * 60 * 60 * 24)));

    const progressPercentage = plannedHours > 0 ? (actualHours / plannedHours) * 100 : 0;
    const hoursPerDay = daysElapsed > 0 ? actualHours / daysElapsed : 0;

    console.log('📊 Project metrics calculated:', {
      filter: timeFilter,
      actualHours,
      plannedHours,
      progressPercentage,
      entriesUsed: dataToUse.length,
      projectType: quotationData?.projectType
    });

    return {
      hoursPerDay,
      progressPercentage,
      plannedHours,
      actualHours,
      daysElapsed,
      daysTotal,
    };
  }, [project, timeEntries, filteredTimeEntries, timeFilter, quotationData]);

  // Calcular datos de tiempo por personal usando datos filtrados
  const timeByPersonnelData = useMemo(() => {
    if (!personnel) return [];

    const dataToUse = timeFilter === "all" ? timeEntries : filteredTimeEntries;

    const personnelHours = dataToUse.reduce((acc, entry) => {
      if (entry.personnelId && entry.hours) {
        acc[entry.personnelId] = (acc[entry.personnelId] || 0) + entry.hours;
      }
      return acc;
    }, {} as Record<number, number>);

    // Incluir a todo el personal del proyecto, incluso si no tienen horas registradas
    const result = personnel.map(person => {
      const hours = personnelHours[person.id] || 0;
      return {
        id: person.id,
        name: person.name,
        hours
      };
    }).sort((a, b) => b.hours - a.hours);

    console.log('👥 Personnel data calculated:', {
      filter: timeFilter,
      totalPersonnel: result.length,
      activePersonnel: result.filter(p => p.hours > 0).length,
      totalHours: result.reduce((sum, p) => sum + p.hours, 0),
      entriesUsed: dataToUse.length,
      personnelBreakdown: result.map(p => ({ name: p.name, hours: p.hours }))
    });

    return result;
  }, [personnel, timeEntries, filteredTimeEntries, timeFilter]);

  const billableDistributionData = useMemo(() => {
    const dataToUse = timeFilter === "all" ? timeEntries : filteredTimeEntries;

    const billableHours = dataToUse.reduce((acc, entry) => {
      if (entry.billable) {
        return acc + entry.hours;
      }
      return acc;
    }, 0);

    const nonBillableHours = dataToUse.reduce((acc, entry) => {
      if (!entry.billable) {
        return acc + entry.hours;
      }
      return acc;
    }, 0);

    const totalHours = billableHours + nonBillableHours;

    const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    const nonBillablePercentage = totalHours > 0 ? (nonBillableHours / totalHours) * 100 : 0;

    return [
      { label: "Facturable", value: billablePercentage },
      { label: "No Facturable", value: nonBillablePercentage }
    ];
  }, [timeEntries, filteredTimeEntries, timeFilter]);

  const riskIndicators = useMemo(() => {
    const costSummaryData = costSummary;
    const projectMetricsData = projectMetrics;

    if (!costSummaryData || !projectMetricsData) {
      return {
        budgetRisk: 0,
        scheduleRisk: 0,
      };
    }

    const { percentageUsed } = costSummaryData;
    const { progressPercentage, daysElapsed, daysTotal } = projectMetricsData;

    const budgetRisk = percentageUsed > 0 && progressPercentage > 0
      ? Math.max(0, Math.min(100, (percentageUsed * 0.6) + (100 - progressPercentage) * 0.4))
      : 0;

    const expectedProgress = (daysElapsed / daysTotal) * 100;
    const scheduleRisk = expectedProgress > 0
      ? Math.max(0, Math.min(100, (1 - (progressPercentage / expectedProgress)) * 100))
      : 0;

    return {
      budgetRisk,
      scheduleRisk,
    };
  }, [costSummary, projectMetrics]);

  // Handlers
  const handleTimeFilterChange = (newFilter: string) => {
    setTimeFilter(newFilter);
    // Si se selecciona custom, resetear el rango personalizado
    if (newFilter !== "custom") {
      setCustomDateRange({ start: null, end: null });
    }
  };

  // Handler para cambio de rango personalizado
  const handleCustomDateRangeChange = (start: Date | null, end: Date | null) => {
    setCustomDateRange({ start, end });
    if (start && end) {
      setTimeFilter("custom");
    }
  };

  // Función para mostrar nombres de filtros
  const getFilterDisplayName = (filter: string): string => {
    switch (filter) {
      case "current_month": return "Este mes";
      case "last_month": return "Mes pasado";
      case "current_quarter": return "Este trimestre";
      case "last_quarter": return "Trimestre pasado";
      case "current_semester": return "Este semestre";
      case "last_semester": return "Semestre pasado";
      case "current_year": return "Este año";
      case "custom": return "Personalizado";
      default: return "Todo el proyecto";
    }
  };

  const handleGoBack = () => {
    setLocation("/active-projects");
  };

  const handleExpandChart = (type: string, title: string) => {
    setExpandedChart({
      isOpen: true,
      title,
      type
    });
  };

  const handleHelpDialog = (helpType: string) => {
    let title = "";
    let content = "";

    switch(helpType) {
      case 'hoursHelp':
        title = "Información sobre Horas Registradas";
        content = "Las horas registradas indican el tiempo total dedicado al proyecto por todo el equipo. Se dividen en horas facturables (que se cobran directamente al cliente) y horas no facturables (trabajo interno). Esta métrica es crucial para entender la inversión de tiempo en el proyecto.";
        break;
      case 'costHelp':
        title = "Información sobre Costo vs Presupuesto";
        content = "Este indicador muestra los gastos acumulados en relación al presupuesto total asignado. Se calcula multiplicando las horas trabajadas por la tarifa correspondiente a cada rol. Un valor cercano al 100% indica que se está agotando el presupuesto disponible.";
        break;
      case 'timeHelp':
        title = "Información sobre Tiempo Restante";
        content = "Muestra los días que quedan hasta la fecha de finalización estimada. Esta métrica ayuda a planificar los recursos necesarios en el tiempo restante del proyecto y a evaluar si se cumplirá con los plazos establecidos.";
        break;
      case 'deviationHelp':
        title = "Información sobre Desviaciones";
        content = "Este panel muestra las desviaciones en costos y tiempo respecto a lo planificado. Una desviación positiva en costos indica que se está gastando más de lo presupuestado, mientras que una desviación positiva en tiempo indica que el proyecto podría retrasarse.";
        break;
      case 'riskHelp':
        title = "Información sobre Indicadores de Riesgo";
        content = "Estos indicadores evalúan la probabilidad de que el proyecto exceda su presupuesto o plazo. Se calculan basándose en las tendencias actuales de gasto y avance, y ayudan a anticipar problemas potenciales que requieran atención.";
        break;
      case 'teamHelp':
        title = "Información sobre Equipo Asignado";
        content = "Muestra el personal asignado al proyecto y cómo se distribuye el tiempo entre los distintos roles. Esta información es útil para gestionar la carga de trabajo del equipo y para asegurar que se cuenta con los recursos adecuados.";
        break;
      case 'budgetRiskHelp':
        title = "Información sobre Riesgo de Presupuesto";
        content = "Este indicador evalúa la probabilidad de que el proyecto exceda su presupuesto asignado. Se calcula combinando el porcentaje de presupuesto consumido y el progreso del proyecto. Un valor alto indica que es probable que se necesite más presupuesto para completar el proyecto.";
        break;
      case 'scheduleRiskHelp':
        title = "Información sobre Riesgo de Cronograma";
        content = "Este indicador evalúa la probabilidad de que el proyecto no se complete en la fecha prevista. Se calcula comparando el progreso real con el progreso esperado según el tiempo transcurrido. Un valor alto indica que es probable que el proyecto se retrase.";
        break;
      default:
        title = "Configuración del Dashboard";
        content = "Aquí puedes personalizar qué secciones del dashboard deseas visualizar y ajustar el modo de visualización según tus preferencias.";
    }

    setShowHelp({
      isOpen: true,
      title,
      content
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Cabecera y navegación */}
      <div className="p-6">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col space-y-3 md:flex-row md:justify-between md:items-center mb-6">
            <div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleGoBack} 
                className="mb-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>

              {/* Botón de editar proyecto Always-On al inicio de la página */}
              {project?.isAlwaysOnMacro || project?.id === 16 ? (
                <Button 
                  onClick={() => setIsOpen(true)}
                  className="ml-4 bg-blue-600 hover:bg-blue-700 shadow-md animate-pulse"
                  title="Editar proyecto Always-On"
                >
                  <PencilIcon className="h-5 w-5 mr-2" />
                  Editar Proyecto
                </Button>
              ) : null}

              <Breadcrumb className="mb-1">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">
                      <Home className="h-3.5 w-3.5 mr-1" />
                      <span>Inicio</span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/active-projects">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      <span>Proyectos Activos</span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink>
                      <LineChart className="h-3.5 w-3.5 mr-1" />
                      <span>Análisis de Proyecto</span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <h1 className="text-2xl font-bold tracking-tight">
                {project?.quotation?.projectName || "Cargando proyecto..."}
              </h1>

              {project?.quotation?.client && (
                <div className="flex items-center mt-2">
                  <User className="h-4 w-4 mr-1.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Cliente: {project.quotation.client.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 p-3 pt-0">
        <div className="container mx-auto max-w-7xl">
          {/* Contenido para proyectos "always on" */}
          {!isLoading && (
            <>
              {/* Si es un proyecto macro "Always On" */}
              {project?.isAlwaysOnMacro && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-2 items-center justify-between bg-blue-50 border border-blue-100 rounded-md p-2 mb-2">
                    <div className="flex items-center">
                      <Badge variant="outline" className="h-6 mr-2 border-blue-200 bg-blue-50 text-blue-700">Always-On</Badge>
                      <span className="text-sm font-medium text-blue-700">
                        Presupuesto mensual: ${project.macroMonthlyBudget?.toLocaleString()} / mes
                      </span>
                    </div>
                    <Link href={`/client-summary/${project.quotation?.clientId}`} className="text-blue-700 inline-flex items-center text-xs hover:underline">
                      Ver resumen del cliente
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </div>

                  {/* Panel de Gestión Always-On */}
                  <div className="mb-4 border border-blue-100 rounded-lg p-2 bg-white">
                    <div className="bg-blue-50 rounded-md p-2 mb-3">
                      <h3 className="text-blue-700 font-medium text-sm">Panel de Control Always-On</h3>
                      <p className="text-xs text-blue-600 mt-1">Herramientas para la gestión de proyectos macro y sus subproyectos</p>
                    </div>                   
                    <Tabs defaultValue="summary" className="mb-2">
                      <TabsList className="mb-2">
                        <TabsTrigger value="summary">Resumen Presupuestal</TabsTrigger>
                        <TabsTrigger value="health">Salud del Proyecto</TabsTrigger>
                        <TabsTrigger value="allocation">Asignación de Presupuesto</TabsTrigger>
                      </TabsList>

                      <TabsContent value="summary" className="space-y-2">
                        <div className="text-xs text-muted-foreground mb-2">
                          Vista consolidada del presupuesto mensual y distribución entre subproyectos.
                        </div>
                        {project && <BudgetSummaryPanel project={project} />}
                      </TabsContent>

                      <TabsContent value="health" className="space-y-2">
                        <div className="text-xs text-muted-foreground mb-2">
                          Indicadores de salud para monitorear el estado del proyecto macro.
                        </div>
                        <ProjectHealthIndicators 
                          project={project} 
                        />
                      </TabsContent>

                      <TabsContent value="allocation" className="space-y-2">
                        <div className="text-xs text-muted-foreground mb-2">
                          Herramienta para distribuir el presupuesto entre los subproyectos.
                        </div>
                        <BudgetAllocationTool 
                          project={project} 
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}

              {/* Si es un subproyecto */}
              {project?.parentProjectId && (
                <AlwaysOnBudgetAlert 
                  clientId={project.quotation?.clientId} 
                  clientName={project.quotation?.client?.name || 'Cliente'}
                  globalBudget={4200} 
                  parentProjectId={project.parentProjectId}
                />
              )}
            </>
          )}

          {/* Estándar Analytics */}
          <div className="mt-4">
            <div className="border-b pb-2 mb-4">
              <h3 className="text-base font-medium text-gray-700">Métricas Detalladas</h3>
            </div>

                        {/* Filtros y botones de acción */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por tiempo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el proyecto</SelectItem>
                <SelectItem value="current_month">Este mes</SelectItem>
                <SelectItem value="last_month">Mes pasado</SelectItem>
                <SelectItem value="current_quarter">Este trimestre</SelectItem>
                <SelectItem value="last_quarter">Trimestre pasado</SelectItem>
                <SelectItem value="current_semester">Este semestre</SelectItem>
                <SelectItem value="last_semester">Semestre pasado</SelectItem>
                <SelectItem value="current_year">Este año</SelectItem>
                <SelectItem value="custom">Fecha personalizada</SelectItem>
              </SelectContent>
            </Select>

                        {/* Selector de rango personalizado */}
            {timeFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customDateRange.start ? customDateRange.start.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleCustomDateRangeChange(
                    e.target.value ? new Date(e.target.value) : null,
                    customDateRange.end
                  )}
                  className="px-3 py-2 border rounded-md text-sm"
                />
                <span className="text-sm text-muted-foreground">a</span>
                <Input
                  type="date"
                  value={customDateRange.end ? customDateRange.end.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleCustomDateRangeChange(
                    customDateRange.start,
                    e.target.value ? new Date(e.target.value) : null
                  )}
                  className="px-3 py-2 border rounded-md text-sm"
                />
              </div>
            )}

            {/* Información del período seleccionado */}
            {timeFilter !== "all" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Período: {getFilterDisplayName(timeFilter)}</span>
                {quotationMultiplier > 1 && (
                  <span className="text-blue-600">
                    (Objetivo × {quotationMultiplier})
                  </span>
                )}
              </div>
            )}


</div>
            <ProjectAnalytics
              project={project}
              costSummary={costSummary}
              timeEntries={filteredTimeEntries}
              personnel={personnel}
              roles={roles}
              deliverableData={deliverableData}
              projectMetrics={projectMetrics}
              riskIndicators={riskIndicators}
              timeByPersonnelData={timeByPersonnelData}
              billableDistributionData={billableDistributionData}
              onHelpRequest={handleHelpDialog}
              onExpandChart={handleExpandChart}
              onTimeFilterChange={handleTimeFilterChange}
              isLoading={isLoading}
              timeFilter={timeFilter}
            />
          </div>
        </div>
      </div>

      {/* Modal para gráficos expandidos */}
      <ChartModal
        isOpen={expandedChart.isOpen}
        onClose={() => setExpandedChart({ isOpen: false, title: "", type: null })}
        title={expandedChart.title}
      >
        <div className="h-[60vh] flex items-center justify-center bg-muted/20 rounded-lg">
          <p className="text-muted-foreground text-center">
            Vista expandida del gráfico - {expandedChart.type}
            <br />
            <span className="text-sm">
              (Los gráficos reales se implementarían utilizando Recharts u otra biblioteca)
            </span>
          </p>
        </div>
      </ChartModal>

      {/* Diálogo de ayuda */}
      <HelpDialog
        isOpen={showHelp.isOpen}
        onClose={() => setShowHelp({ ...showHelp, isOpen: false })}
        title={showHelp.title}
        content={showHelp.content}
      />

      {/* Agregamos un diálogo para editar el proyecto */}
      {project?.isAlwaysOnMacro || project?.id === 16 ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Editar Proyecto Always-On</span>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Macro Project</Badge>
              </DialogTitle>
              <DialogDescription>
                Configure los detalles básicos del proyecto macro "Always On"
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const budget = formData.get("budget") as string;
              const status = formData.get("status") as string;

              if (!budget || !status) {
                toast({
                  title: "Error",
                  description: "Todos los campos son requeridos",
                  variant: "destructive"
                });
                return;
              }

              const budgetValue = parseFloat(budget);

              apiRequest(`/api/active-projects/${project.id}`, "PATCH", {
                macroMonthlyBudget: budgetValue,
                status
              })
              .then(() => {
                toast({
                  title: "Proyecto actualizado",
                  description: "Los cambios se han guardado correctamente"
                });
                queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${project.id}`] });
                queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
                setIsOpen(false);
              })
              .catch((error) => {
                console.error("Error al actualizar:", error);
                toast({
                  title: "Error",
                  description: "No se pudo actualizar el proyecto",
                  variant: "destructive"
                });
              });
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="budget">Presupuesto Mensual (USD)</Label>
                  <Input
                    id="budget"
                    name="budget"
                    type="number"
                    defaultValue={project?.macroMonthlyBudget?.toString() || "4200"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Presupuesto mensual que se compartirá entre todos los subproyectos
                  </p>
                </div><div className="grid gap-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select name="status" defaultValue={project?.status || "active"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="on-hold">En Pausa</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};

export default ProjectAnalyticsView;