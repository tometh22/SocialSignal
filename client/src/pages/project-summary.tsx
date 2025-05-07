import React from "react";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { ChevronLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import ChartModal from "@/components/project/chart-modal";
import HelpDialog from "@/components/project/help-dialog";
import ComponentsManager from "@/components/project/components-manager";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Componentes del dashboard
import {
  Breadcrumb,
  KpiRibbon,
  DeviationSection,
  TeamSection,
  ChartsSection,
  HeaderActions
} from "@/components/dashboard";

// Tipos e interfaces
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

  const { data: timeEntries = [], isLoading: isLoadingTimeEntries } = useQuery({
    queryKey: [`/api/time-entries/project/${parsedProjectId}`],
    enabled: !!parsedProjectId,
  });

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['/api/roles'],
  });

  const { data: personnel = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ['/api/personnel'],
  });

  const { data: costSummary, isLoading: isLoadingCostSummary } = useQuery({
    queryKey: [`/api/projects/${parsedProjectId}/cost-summary`],
    enabled: !!parsedProjectId,
  });

  // Estado de carga general
  const isLoading = 
    isLoadingProject || 
    isLoadingTimeEntries || 
    isLoadingRoles || 
    isLoadingPersonnel || 
    isLoadingCostSummary;

  // Función para actualizar el nombre del proyecto
  const handleSaveProjectName = async (newName: string): Promise<void> => {
    if (!parsedProjectId || !newName) {
      alert("Error: Faltan datos para actualizar el nombre del proyecto");
      return;
    }

    try {
      // Actualizar todos los nombres en la página inmediatamente (DOM manipulation)
      document.querySelectorAll('.project-name').forEach(el => {
        (el as HTMLElement).innerText = newName;
      });
      
      // Enviar al servidor
      await fetch(`/api/projects/${parsedProjectId}/update-name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
        credentials: 'include'
      });
    } catch (error) {
      console.error("Error al actualizar el nombre:", error);
      alert("Error al guardar. Por favor, recarga la página e intenta de nuevo.");
    }
  };

  // Función para formatear fechas
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No definida";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  // Función para manejar el diálogo de ayuda
  const handleOpenHelpDialog = (helpType: string) => {
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

  // Filtrar entradas de tiempo según el filtro seleccionado
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries?.length) return [];

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

  const timeAndCostTrendData = useMemo(() => {
    if (!timeEntries.length) return [];

    // Agrupar por semana para tener una vista más clara
    const entriesByWeek: Record<string, { 
      date: string, 
      hours: number, 
      cost: number,
      totalHours: number,
      totalCost: number
    }> = {};

    let totalHoursAccumulated = 0;
    let totalCostAccumulated = 0;

    // Ordenar las entradas por fecha
    const sortedEntries = [...timeEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const weekStart = new Date(entryDate);
      weekStart.setDate(entryDate.getDate() - entryDate.getDay());
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      const personInfo = personnel.find(p => p.id === entry.personnelId);
      const roleInfo = personInfo?.roleId 
        ? roles.find(r => r.id === personInfo.roleId) 
        : null;
      const hourlyRate = roleInfo?.hourlyRate || 0;
      const entryCost = entry.hours * hourlyRate;

      totalHoursAccumulated += entry.hours;
      totalCostAccumulated += entryCost;

      if (!entriesByWeek[weekKey]) {
        entriesByWeek[weekKey] = { 
          date: format(weekStart, 'dd MMM', { locale: es }), 
          hours: 0, 
          cost: 0,
          totalHours: 0,
          totalCost: 0
        };
      }

      entriesByWeek[weekKey].hours += entry.hours;
      entriesByWeek[weekKey].cost += entryCost;
      entriesByWeek[weekKey].totalHours = totalHoursAccumulated;
      entriesByWeek[weekKey].totalCost = totalCostAccumulated;
    });

    return Object.values(entriesByWeek);
  }, [timeEntries, personnel, roles]);

  // Calcular desviación de tiempo
  const scheduleVariance = useMemo(() => {
    if (!projectMetrics.daysTotal || !projectMetrics.daysElapsed) return 0;

    const idealProgress = (projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100;
    const actualProgress = projectMetrics.progressPercentage;

    return idealProgress - actualProgress;
  }, [projectMetrics]);

  // Renderizar gráfico expandido en el modal
  const renderExpandedChart = () => {
    if (!expandedChart.isOpen || !expandedChart.type) return null;

    switch (expandedChart.type) {
      case 'personnelBar':
        return (
          <div className="h-[80vh]">
            {/* Contenido del gráfico expandido */}
          </div>
        );
      case 'billablePie':
        return (
          <div className="h-[80vh]">
            {/* Contenido del gráfico expandido */}
          </div>
        );
      case 'costTimeline':
        return (
          <div className="h-[80vh]">
            {/* Contenido del gráfico expandido */}
          </div>
        );
      default:
        return null;
    }
  };

  // Función para manejar el clic en el botón de Registrar Horas
  const handleRegisterHours = () => {
    setLocation(`/projects/${parsedProjectId}/time-entries`);
  };

  // Función para manejar la expansión de un gráfico
  const handleExpandChart = (type: string, title: string) => {
    setExpandedChart({
      isOpen: true,
      title,
      type: type as any
    });
  };

  // Función para actualizar el filtro de tiempo
  const handleTimeFilterChange = (value: string) => {
    setDashboardState({
      ...dashboardState,
      timeFilter: value
    });
  };

  // Función para actualizar el modo de visualización
  const handleViewModeChange = (value: string) => {
    setDashboardState({
      ...dashboardState,
      viewMode: value as "compact" | "detailed"
    });
  };

  // Página de carga
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </div>
        <p>Cargando datos del proyecto...</p>
      </div>
    );
  }

  // Si no hay proyecto con ese ID
  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Proyecto no encontrado</h2>
          <p className="mb-6">No se encontró ningún proyecto con el ID especificado.</p>
          <Button onClick={() => setLocation("/projects")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
      </div>
    );
  }

  // Valor calculado para días restantes
  const daysRemaining = Math.max(0, projectMetrics.daysTotal - projectMetrics.daysElapsed);

  return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
      <div className="container mx-auto px-4 py-4">
        {/* Breadcrumbs - Navegación */}
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: "Proyectos", href: "/active-projects" },
            { label: project?.quotation?.projectName || "Sin nombre" }
          ]}
        />

        {/* Header - Acciones y filtros */}
        <HeaderActions
          projectName={project?.quotation?.projectName || "Sin nombre"}
          status={project.status || ""}
          projectId={project.id}
          timeFilter={dashboardState.timeFilter}
          viewMode={dashboardState.viewMode}
          onTimeFilterChange={handleTimeFilterChange}
          onViewModeChange={handleViewModeChange}
          onRegisterHours={handleRegisterHours}
          onSettingsClick={() => handleOpenHelpDialog('default')}
          onSaveProjectName={handleSaveProjectName}
        />
      </div>

      {/* Contenedor principal */}
      <div className="container mx-auto px-4 pb-6">
        {/* KPI Ribbon - Los 3 KPIs críticos */}
        {dashboardState.showSections.kpi && (
          <KpiRibbon
            totalHours={totalHours}
            billableHours={billableHours}
            nonBillableHours={nonBillableHours}
            costData={{
              actualCost: costSummary?.actualCost || 0,
              estimatedCost: costSummary?.estimatedCost || 0,
              percentageUsed: costSummary?.percentageUsed || 0
            }}
            timeData={{
              daysRemaining,
              daysTotal: projectMetrics.daysTotal,
              progressPercentage: projectMetrics.progressPercentage
            }}
            onHelpClick={handleOpenHelpDialog}
          />
        )}

        {/* Deviation Section - Desviaciones y Riesgos */}
        {dashboardState.showSections.deviations && (
          <DeviationSection
            costVariance={costSummary?.variance || 0}
            scheduleVariance={scheduleVariance}
            riskMetrics={riskIndicators}
            onHelpClick={handleOpenHelpDialog}
            showRisks={dashboardState.viewMode === "detailed"}
          />
        )}

        {/* Team Section - Equipo asignado */}
        {dashboardState.showSections.team && dashboardState.viewMode === "detailed" && (
          <TeamSection
            teamMembers={timeByPersonnelData}
            onHelpClick={handleOpenHelpDialog}
          />
        )}

        {/* Charts Section - Gráficos */}
        {dashboardState.showSections.charts && (
          <ChartsSection
            timeByPersonnelData={timeByPersonnelData}
            billableDistributionData={billableDistributionData}
            timeAndCostData={timeAndCostTrendData}
            onChartExpand={handleExpandChart}
            onRegisterHours={handleRegisterHours}
          />
        )}
      </div>

      {/* Modal para gráficos expandidos */}
      <ChartModal
        isOpen={expandedChart.isOpen}
        onClose={() => setExpandedChart({ isOpen: false, title: "", type: null })}
        title={expandedChart.title}
      >
        {renderExpandedChart()}
      </ChartModal>

      {/* Diálogo de ayuda */}
      <HelpDialog
        isOpen={showHelp.isOpen}
        onClose={() => setShowHelp({ ...showHelp, isOpen: false })}
        title={showHelp.title}
        content={showHelp.content}
      />
      
      {/* Sección de configuración de proyecto */}
      {project && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Configuración del Proyecto</h2>
          
          <Tabs defaultValue="components" className="w-full">
            <TabsList>
              <TabsTrigger value="components" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Componentes
              </TabsTrigger>
              {/* Se pueden agregar más pestañas de configuración aquí */}
            </TabsList>
            
            <TabsContent value="components" className="mt-4">
              <div className="bg-card rounded-lg border p-4">
                <ComponentsManager 
                  projectId={parsedProjectId || 0} 
                  refreshTimeEntries={() => {
                    queryClient.invalidateQueries({
                      queryKey: [`/api/time-entries/project/${parsedProjectId}`]
                    });
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default ProjectSummary;