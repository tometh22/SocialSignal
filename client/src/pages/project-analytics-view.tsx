import React, { useState, useMemo, useEffect } from "react";
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

// Interfaces para el tipado
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
  isAlwaysOnMacro?: boolean;
  macroMonthlyBudget?: number;
  parentProjectId?: number;
  quotation: {
    id: number;
    projectName: string;
    clientId: number;
    totalAmount: number;
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
    setTimeFilter(filter);
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

  const handleGoBack = () => {
    setLocation("/active-projects");
  };

  // Filtrar entradas de tiempo según el filtro seleccionado
  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries.length) return [];

    const now = new Date();
    let filterDate = new Date();

    switch (timeFilter) {
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
  }, [timeEntries, timeFilter]);

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
                  
                  {/* Panel de gestión avanzada Always-On */}
                  <div className="mb-4 border rounded-lg p-2 bg-white">                    
                    <Tabs defaultValue="summary" className="mb-2">
                      <TabsList className="mb-2">
                        <TabsTrigger value="summary">Resumen Presupuestal</TabsTrigger>
                        <TabsTrigger value="health">Salud del Proyecto</TabsTrigger>
                        <TabsTrigger value="allocation">Asignación de Presupuesto</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="summary" className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          Vista consolidada del presupuesto y costos del proyecto macro y sus subproyectos asociados.
                        </div>
                        {project && <BudgetSummaryPanel project={project} />}
                      </TabsContent>
                      
                      <TabsContent value="health" className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          Indicadores de salud del proyecto para evaluar su estado y detectar posibles problemas.
                        </div>
                        <ProjectHealthIndicators 
                          project={project} 
                        />
                      </TabsContent>
                      
                      <TabsContent value="allocation" className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          Herramienta para distribuir el presupuesto mensual entre los diferentes subproyectos.
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
                </div>
                
                <div className="grid gap-2">
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