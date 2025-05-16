import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, Settings, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ChartModal from "@/components/project/chart-modal";
import HelpDialog from "@/components/project/help-dialog";
import ProjectSummaryRedesign from "@/components/dashboard/project-summary-redesign";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Interfaces y tipos
interface CostSummary {
  estimatedCost: number;
  actualCost: number;
  variance: number;
  percentageUsed: number;
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
  quotation: {
    id: number;
    projectName: string;
    clientId: number;
    totalAmount: number;
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
  type: "personnelBar" | "billablePie" | "timeTrend" | "costTimeline" | null;
}

// Estado para el modal de ayuda
interface HelpState {
  isOpen: boolean;
  title: string;
  content: string;
}

// Estado principal del dashboard
interface DashboardState {
  timeFilter: string;
  viewMode: "compact" | "detailed";
  showSections: {
    kpi: boolean;
    deviations: boolean;
    team: boolean;
    charts: boolean;
  };
}

const ProjectSummary = () => {
  const { projectId } = useParams();
  const parsedProjectId = projectId ? parseInt(projectId) : null;
  const [, setLocation] = useLocation();

  // Estados del dashboard
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    timeFilter: "all",
    viewMode: "detailed",
    showSections: {
      kpi: true,
      deviations: true,
      team: true,
      charts: true
    }
  });

  // Estados para diálogos y modales
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

  const { data: costSummary, isLoading: isLoadingCostSummary } = useQuery<CostSummary>({
    queryKey: [`/api/projects/${parsedProjectId}/cost-summary`],
    enabled: !!parsedProjectId,
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
    isLoadingCostSummary ||
    isLoadingDeliverable;

  // Manejadores de acciones
  const handleTimeFilterChange = (filter: string) => {
    setDashboardState({
      ...dashboardState,
      timeFilter: filter
    });
  };

  const handleViewModeChange = (mode: "compact" | "detailed") => {
    setDashboardState({
      ...dashboardState,
      viewMode: mode
    });
  };

  const handleSectionToggle = (section: string) => {
    setDashboardState({
      ...dashboardState,
      showSections: {
        ...dashboardState.showSections,
        [section]: !dashboardState.showSections[section as keyof typeof dashboardState.showSections]
      }
    });
  };

  const handleExpandChart = (type: ExpandedChartState["type"], title: string) => {
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

  const handleGoBack = () => {
    setLocation("/projects");
  };

  // Filtrar entradas de tiempo según el filtro seleccionado
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries.length) return [];

    const now = new Date();
    let filterDate = new Date();

    switch (dashboardState.timeFilter) {
      case "week":
        filterDate.setDate(now.getDate() - 7);
        break;
      case "month":
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        filterDate.setMonth(now.getMonth() - 3);
        break;
      default:
        return timeEntries;
    }

    return timeEntries.filter(entry => new Date(entry.date) >= filterDate);
  }, [timeEntries, dashboardState.timeFilter]);

  // Cálculos derivados
  const totalHours = useMemo(() => {
    return filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredTimeEntries]);

  const billableHours = useMemo(() => {
    return filteredTimeEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredTimeEntries]);

  const nonBillableHours = useMemo(() => {
    return filteredTimeEntries.filter(entry => !entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredTimeEntries]);

  // Métricas del proyecto
  const projectMetrics: ProjectMetrics = useMemo(() => {
    if (!project || !timeEntries) {
      return {
        hoursPerDay: 0,
        progressPercentage: 0,
        plannedHours: 0,
        actualHours: totalHours,
        daysElapsed: 0,
        daysTotal: 0,
      };
    }

    try {
      // Asegurarse de que las fechas son objetos Date válidos
      const startDate = new Date(project.startDate);

      // Si no hay fecha de fin establecida, usar 30 días desde hoy
      const endDate = project.expectedEndDate 
        ? new Date(project.expectedEndDate) 
        : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);

      const today = new Date();

      // Validamos que las fechas sean válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error("Fechas inválidas en el proyecto", { 
          startDate: project.startDate, 
          expectedEndDate: project.expectedEndDate
        });

        return {
          hoursPerDay: 0,
          progressPercentage: 0,
          plannedHours: 0,
          actualHours: totalHours,
          daysElapsed: 0,
          daysTotal: 30,  // Valor por defecto si hay fechas inválidas
        };
      }

      // Cálculo de días totales y transcurridos
      const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const validElapsedDays = Math.max(0, elapsedDays);

      // Asegurarse de que el porcentaje no exceda el 100%
      let progressPercentage = (validElapsedDays / totalDays) * 100;
      progressPercentage = Math.min(progressPercentage, 100);

      const plannedHours = totalDays * 8;
      const hoursPerDay = validElapsedDays > 0 ? totalHours / validElapsedDays : 0;

      return {
        hoursPerDay,
        progressPercentage,
        plannedHours,
        actualHours: totalHours,
        daysElapsed: validElapsedDays,
        daysTotal: totalDays,
      };
    } catch (error) {
      console.error("Error calculando métricas del proyecto:", error);
      return {
        hoursPerDay: 0,
        progressPercentage: 0,
        plannedHours: 0,
        actualHours: totalHours,
        daysElapsed: 0,
        daysTotal: 30,  // Valor por defecto si hay error
      };
    }
  }, [project, timeEntries, totalHours]);

  // Datos para indicadores de riesgo
  const riskIndicators = useMemo(() => {
    if (!costSummary || !projectMetrics) {
      return {
        budgetRisk: 0,
        scheduleRisk: 0,
        activeAlerts: 0
      };
    }

    // Riesgo de presupuesto (basado en la tendencia actual y la varianza)
    let budgetRisk = costSummary.percentageUsed > projectMetrics.progressPercentage 
      ? Math.min(100, (costSummary.percentageUsed / projectMetrics.progressPercentage) * 70)
      : Math.min(70, (costSummary.percentageUsed / 100) * 70);

    if (costSummary.variance > 10) budgetRisk += 15;
    else if (costSummary.variance > 5) budgetRisk += 10;

    // Riesgo de cronograma (basado en el progreso vs tiempo transcurrido)
    let scheduleRisk = 0;
    if (projectMetrics.daysElapsed > 0 && projectMetrics.daysTotal > 0) {
      const idealProgress = (projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100;
      const progressDifference = idealProgress - projectMetrics.progressPercentage;

      scheduleRisk = progressDifference > 0 
        ? Math.min(100, (progressDifference / 20) * 100)
        : 0;
    }

    // Alertas activas
    let activeAlerts = 0;
    if (budgetRisk >= 75) activeAlerts++;
    if (scheduleRisk >= 75) activeAlerts++;
    if (costSummary.variance > 10) activeAlerts++;

    return {
      budgetRisk: Math.round(budgetRisk),
      scheduleRisk: Math.round(scheduleRisk),
      activeAlerts
    };
  }, [costSummary, projectMetrics]);

  // Datos para gráficos
  const timeByPersonnelData = useMemo(() => {
    if (!filteredTimeEntries.length || !personnel.length) return [];

    const timeByPerson: Record<number, number> = {};
    filteredTimeEntries.forEach(entry => {
      if (!timeByPerson[entry.personnelId]) {
        timeByPerson[entry.personnelId] = 0;
      }
      timeByPerson[entry.personnelId] += entry.hours;
    });

    return Object.keys(timeByPerson).map(personId => {
      const personInfo = personnel.find(p => p.id === parseInt(personId));
      let role = "No asignado";

      if (personInfo && personInfo.roleId) {
        const roleInfo = roles.find(r => r.id === personInfo.roleId);
        if (roleInfo) {
          role = roleInfo.name;
        }
      }

      return {
        id: parseInt(personId),
        name: personInfo ? personInfo.name : `Persona ${personId}`,
        hours: timeByPerson[parseInt(personId)],
        role
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [filteredTimeEntries, personnel, roles]);

  const billableDistributionData = useMemo(() => {
    if (!filteredTimeEntries.length) return [];

    return [
      { name: "Facturable", value: billableHours },
      { name: "No Facturable", value: nonBillableHours }
    ].filter(item => item.value > 0);
  }, [billableHours, nonBillableHours]);

  // Renderizar el componente rediseñado
  return (
    <>
      <ProjectSummaryRedesign
        project={project}
        costSummary={costSummary}
        timeEntries={filteredTimeEntries}
        personnel={personnel}
        roles={roles}
        deliverableData={deliverableData}
        dashboardState={dashboardState}
        setDashboardState={setDashboardState}
        timeByPersonnelData={timeByPersonnelData}
        billableDistributionData={billableDistributionData}
        projectMetrics={projectMetrics}
        riskIndicators={riskIndicators}
        handleTimeFilterChange={handleTimeFilterChange}
        handleViewModeChange={handleViewModeChange}
        handleSectionToggle={handleSectionToggle}
        handleExpandChart={handleExpandChart}
        handleHelpDialog={handleHelpDialog}
        handleGoBack={handleGoBack}
        isLoading={isLoading}
      />

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
    </>
  );
};

export default ProjectSummary;