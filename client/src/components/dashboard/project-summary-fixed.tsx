import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  Settings,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  PieChart,
  BarChart,
  LineChart,
  Users,
  Filter,
  Info,
  CircleCheck,
  AlertCircle,
  Gauge
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Componente principal de resumen de proyecto, versión final optimizada
 * Soluciona todos los problemas de espaciado y superposición
 */
interface ProjectSummaryFixedProps {
  project: any;
  costSummary: any;
  timeEntries: any[];
  personnel: any[];
  roles: any[];
  deliverableData: any;
  dashboardState: any;
  setDashboardState: (state: any) => void;
  timeByPersonnelData: any[];
  billableDistributionData: any[];
  projectMetrics: any;
  riskIndicators: any;
  handleTimeFilterChange: (filter: any) => void;
  handleViewModeChange: (mode: any) => void;
  handleSectionToggle: (section: any) => void;
  handleExpandChart: (chart: any) => void;
  handleHelpDialog: (dialog: any) => void;
  handleGoBack: () => void;
  isLoading: boolean;
}

const ProjectSummaryFixed = ({
  project,
  costSummary,
  timeEntries,
  personnel,
  roles,
  deliverableData,
  dashboardState,
  setDashboardState,
  timeByPersonnelData,
  billableDistributionData,
  projectMetrics,
  riskIndicators,
  handleTimeFilterChange,
  handleViewModeChange,
  handleSectionToggle,
  handleExpandChart,
  handleHelpDialog,
  handleGoBack,
  isLoading,
}: ProjectSummaryFixedProps) => {
  
  // Cálculos de estadísticas clave
  const totalHours = timeEntries?.reduce((sum: number, entry: any) => sum + entry.hours, 0) || 0;
  const billableHours = timeEntries?.filter((entry: any) => entry.billable).reduce((sum: number, entry: any) => sum + entry.hours, 0) || 0;
  const nonBillableHours = totalHours - billableHours;
  const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  // Formatear fechas
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "No definida";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  // Formatear números con separador de miles
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR', { 
      maximumFractionDigits: 1 
    }).format(num);
  };

  // Pantalla de carga
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mb-4"></div>
          <h2 className="text-xl font-semibold">Cargando información del proyecto...</h2>
          <p className="text-muted-foreground">Esto tomará solo un momento</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100vh-6rem)] bg-background">
        {/* Header con información principal del proyecto */}
        <div className="px-4 py-4 bg-card border-b">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center space-x-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mx-2">|</span>
                <span className="text-sm text-muted-foreground">Proyectos</span>
                <ChevronLeft className="h-3 w-3 rotate-180 mx-1 text-muted-foreground" />
                <span className="text-sm font-medium">Resumen de Proyecto</span>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold project-name line-clamp-2">
                  {project?.quotation?.projectName || "Proyecto sin nombre"}
                </h1>
                <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>Inicio: {formatDate(project?.startDate)}</span>
                  <span>Fin estimado: {formatDate(project?.expectedEndDate)}</span>
                  <span>Estado: <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">{project?.status}</span></span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                {/* Controles de vista y filtros */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtrar Periodo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Periodo de tiempo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleTimeFilterChange("all")} className={dashboardState.timeFilter === "all" ? "bg-primary/10" : ""}>
                      Todo el proyecto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTimeFilterChange("month")} className={dashboardState.timeFilter === "month" ? "bg-primary/10" : ""}>
                      Último mes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTimeFilterChange("week")} className={dashboardState.timeFilter === "week" ? "bg-primary/10" : ""}>
                      Última semana
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Settings className="h-4 w-4 mr-2" />
                      Personalizar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Modo de visualización</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleViewModeChange("detailed")} className={dashboardState.viewMode === "detailed" ? "bg-primary/10" : ""}>
                      Detallado
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleViewModeChange("compact")} className={dashboardState.viewMode === "compact" ? "bg-primary/10" : ""}>
                      Compacto
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Panel de métricas principales */}
          {dashboardState.showSections.kpi && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Indicadores Clave de Rendimiento</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* KPI: Horas Registradas */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base font-medium text-blue-800">
                        Horas Registradas
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleHelpDialog('hoursHelp')}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-60 text-xs">Las horas registradas indican el tiempo total dedicado al proyecto.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="mb-2">
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-2xl font-bold text-blue-700">{formatNumber(totalHours)}</h3>
                        <span className="text-sm text-muted-foreground">horas totales</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Facturables</span>
                        <span className="font-medium text-blue-700">{formatNumber(billableHours)} h</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">No facturables</span>
                        <span className="font-medium text-blue-700">{formatNumber(nonBillableHours)} h</span>
                      </div>
                      <div>
                        <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${billablePercentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Distribución</span>
                          <span className="font-medium text-blue-700">{billablePercentage.toFixed(0)}% facturables</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* KPI: Costo vs Presupuesto */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-white pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base font-medium text-green-800">
                        Costo vs Presupuesto
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-green-50"
                            onClick={() => handleHelpDialog('costHelp')}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-60 text-xs">Muestra los gastos acumulados en relación al presupuesto total asignado.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="mb-2">
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-2xl font-bold text-green-700">{formatCurrency(costSummary?.actualCost || 0)}</h3>
                        <span className="text-sm text-muted-foreground">de {formatCurrency(costSummary?.estimatedCost || 0)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Porcentaje de consumo</span>
                        <span className="font-medium text-green-700">{(costSummary?.percentageUsed || 0).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Varianza</span>
                        <span className={`font-medium ${(costSummary?.variance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(costSummary?.variance || 0) > 0 ? '+' : ''}{(costSummary?.variance || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <div className="h-2 w-full bg-green-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              (costSummary?.percentageUsed || 0) > 90 ? "bg-red-500" :
                              (costSummary?.percentageUsed || 0) > 70 ? "bg-amber-500" :
                              "bg-green-500"
                            }`}
                            style={{ width: `${costSummary?.percentageUsed || 0}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Estado</span>
                          <span className={`font-medium ${
                            (costSummary?.percentageUsed || 0) > 90 ? "text-red-600" :
                            (costSummary?.percentageUsed || 0) > 70 ? "text-amber-600" :
                            "text-green-600"
                          }`}>
                            {(costSummary?.percentageUsed || 0) > 90 ? "Crítico" :
                             (costSummary?.percentageUsed || 0) > 70 ? "Alerta" :
                             "Normal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* KPI: Tiempo Restante */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-white pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base font-medium text-amber-800">
                        Tiempo del Proyecto
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                            onClick={() => handleHelpDialog('timeHelp')}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-60 text-xs">Muestra los días que quedan hasta la fecha de finalización estimada.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="mb-2">
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-2xl font-bold text-amber-700">
                          {formatNumber(projectMetrics?.daysTotal - projectMetrics?.daysElapsed)}
                        </h3>
                        <span className="text-sm text-muted-foreground">días restantes</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Duración total</span>
                        <span className="font-medium text-amber-700">{formatNumber(projectMetrics?.daysTotal || 0)} días</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Días transcurridos</span>
                        <span className="font-medium text-amber-700">{formatNumber(projectMetrics?.daysElapsed || 0)} días</span>
                      </div>
                      <div>
                        <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${projectMetrics?.progressPercentage || 0}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Progreso</span>
                          <span className="font-medium text-amber-700">{(projectMetrics?.progressPercentage || 0).toFixed(0)}% completado</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          {/* Tabs para el análisis detallado */}
          <Tabs defaultValue="overview" className="mb-8">
            {/* La barra de pestañas fija en la parte superior */}
            <div className="mb-6 border-b">
              <TabsList className="bg-transparent h-auto p-0 justify-start">
                <TabsTrigger value="overview" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none h-10 px-4">
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="riesgos" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none h-10 px-4">
                  Riesgos
                </TabsTrigger>
                <TabsTrigger value="entregables" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none h-10 px-4">
                  Entregables
                </TabsTrigger>
                <TabsTrigger value="equipo" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none h-10 px-4">
                  Equipo
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Tab de resumen general */}
            <TabsContent value="overview" className="mt-0 p-0">
              <div className="grid grid-cols-1 gap-6">
                {/* Gráfico de tendencia de tiempo y costo */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 bg-slate-50 border-b">
                    <CardTitle className="text-base font-medium flex items-center">
                      <LineChart className="h-4 w-4 mr-2 text-slate-500" />
                      Evolución de Tiempo y Costo
                    </CardTitle>
                    <CardDescription>
                      Seguimiento acumulado a lo largo del proyecto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="h-72 rounded">
                      {/* Aquí iría el gráfico de líneas */}
                      <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground">
                        <LineChart className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-sm">Gráfico de evolución acumulada</p>
                        <p className="text-xs text-muted-foreground mt-1">Seguimiento de horas y costos del proyecto</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Distribución de horas por persona */}
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 bg-slate-50 border-b">
                      <CardTitle className="text-base font-medium flex items-center">
                        <BarChart className="h-4 w-4 mr-2 text-slate-500" />
                        Distribución de Horas por Personal
                      </CardTitle>
                      <CardDescription>
                        Horas trabajadas por cada miembro del equipo
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="h-60 rounded">
                        {/* Aquí iría el gráfico de barras horizontal */}
                        <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground">
                          <BarChart className="h-16 w-16 mb-4 opacity-20" />
                          <p className="text-sm">Gráfico de distribución de horas por integrante</p>
                          <p className="text-xs text-muted-foreground mt-1">Muestra el tiempo total dedicado por cada persona</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Gráfico de distribución facturable vs no facturable */}
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 bg-slate-50 border-b">
                      <CardTitle className="text-base font-medium flex items-center">
                        <PieChart className="h-4 w-4 mr-2 text-slate-500" />
                        Horas Facturables vs No Facturables
                      </CardTitle>
                      <CardDescription>
                        Distribución según tipo de facturación
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="h-60 rounded">
                        {/* Aquí iría el gráfico de pie */}
                        <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground">
                          <PieChart className="h-16 w-16 mb-4 opacity-20" />
                          <p className="text-sm">Gráfico de distribución de horas por facturación</p>
                          <p className="text-xs text-muted-foreground mt-1">Proporción entre horas facturables y no facturables</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            
            {/* Tab de riesgos y desviaciones */}
            <TabsContent value="riesgos" className="mt-0 p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Panel de desviaciones */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 bg-slate-50 border-b">
                    <CardTitle className="text-base font-medium flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2 text-slate-500" />
                      Monitor de Desviaciones
                    </CardTitle>
                    <CardDescription>
                      Análisis de varianzas respecto a lo planificado
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Desviación de costo */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                              (costSummary?.variance || 0) > 10 ? "bg-red-100" : 
                              (costSummary?.variance || 0) > 0 ? "bg-amber-100" : "bg-green-100"
                            }`}>
                              <TrendingUp className={`h-4 w-4 ${
                                (costSummary?.variance || 0) > 10 ? "text-red-500" : 
                                (costSummary?.variance || 0) > 0 ? "text-amber-500" : "text-green-500"
                              }`} />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium">Desviación de Costo</div>
                              <div className="text-xs text-muted-foreground">Comparado con lo presupuestado</div>
                            </div>
                          </div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${
                            (costSummary?.variance || 0) > 10 ? "text-red-500" : 
                            (costSummary?.variance || 0) > 0 ? "text-amber-500" : "text-green-500"
                          }`}>
                            {(costSummary?.variance || 0) > 0 ? (
                              <>
                                <TrendingUp className="h-4 w-4" />
                                <span>+{(costSummary?.variance || 0).toFixed(1)}%</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-4 w-4" />
                                <span>{(costSummary?.variance || 0).toFixed(1)}%</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">Impacto en proyecto</span>
                            <span className={`font-medium ${
                              (costSummary?.variance || 0) > 10 ? "text-red-500" : 
                              (costSummary?.variance || 0) > 0 ? "text-amber-500" : "text-green-500"
                            }`}>
                              {(costSummary?.variance || 0) > 10 ? "Alto" : 
                               (costSummary?.variance || 0) > 0 ? "Medio" : "Bajo"}
                            </span>
                          </div>
                          <Progress 
                            value={Math.abs(costSummary?.variance || 0)} 
                            max={15}
                            className={`h-2 ${
                              (costSummary?.variance || 0) > 10 ? "bg-red-100" : 
                              (costSummary?.variance || 0) > 0 ? "bg-amber-100" : "bg-green-100"
                            }`}
                          />
                        </div>
                      </div>
                      
                      {/* Desviación de tiempo */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                              (riskIndicators?.scheduleRisk || 0) > 70 ? "bg-red-100" : 
                              (riskIndicators?.scheduleRisk || 0) > 30 ? "bg-amber-100" : "bg-green-100"
                            }`}>
                              <TrendingUp className={`h-4 w-4 ${
                                (riskIndicators?.scheduleRisk || 0) > 70 ? "text-red-500" : 
                                (riskIndicators?.scheduleRisk || 0) > 30 ? "text-amber-500" : "text-green-500"
                              }`} />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium">Desviación de Tiempo</div>
                              <div className="text-xs text-muted-foreground">Comparado con lo planificado</div>
                            </div>
                          </div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${
                            (riskIndicators?.scheduleRisk || 0) > 70 ? "text-red-500" : 
                            (riskIndicators?.scheduleRisk || 0) > 30 ? "text-amber-500" : "text-green-500"
                          }`}>
                            {(riskIndicators?.scheduleRisk || 0) > 50 ? (
                              <>
                                <TrendingUp className="h-4 w-4" />
                                <span>En riesgo</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-4 w-4" />
                                <span>En tiempo</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">Probabilidad de retraso</span>
                            <span className={`font-medium ${
                              (riskIndicators?.scheduleRisk || 0) > 70 ? "text-red-500" : 
                              (riskIndicators?.scheduleRisk || 0) > 30 ? "text-amber-500" : "text-green-500"
                            }`}>
                              {(riskIndicators?.scheduleRisk || 0)}%
                            </span>
                          </div>
                          <Progress 
                            value={(riskIndicators?.scheduleRisk || 0)} 
                            max={100}
                            className={`h-2 ${
                              (riskIndicators?.scheduleRisk || 0) > 70 ? "bg-red-100" : 
                              (riskIndicators?.scheduleRisk || 0) > 30 ? "bg-amber-100" : "bg-green-100"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Panel de análisis de riesgos */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 bg-slate-50 border-b">
                    <CardTitle className="text-base font-medium flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-slate-500" />
                      Análisis de Riesgos
                    </CardTitle>
                    <CardDescription>
                      Indicadores predictivos basados en tendencias actuales
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Medidor de riesgo de presupuesto */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                              (riskIndicators?.budgetRisk || 0) > 70 ? "bg-red-100" : 
                              (riskIndicators?.budgetRisk || 0) > 30 ? "bg-amber-100" : "bg-green-100"
                            }`}>
                              <Gauge className={`h-4 w-4 ${
                                (riskIndicators?.budgetRisk || 0) > 70 ? "text-red-500" : 
                                (riskIndicators?.budgetRisk || 0) > 30 ? "text-amber-500" : "text-green-500"
                              }`} />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium">Riesgo de Presupuesto</div>
                              <div className="text-xs text-muted-foreground">Probabilidad de exceder presupuesto</div>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-semibold ${
                            (riskIndicators?.budgetRisk || 0) > 70 ? "bg-red-100 text-red-700" : 
                            (riskIndicators?.budgetRisk || 0) > 30 ? "bg-amber-100 text-amber-700" : 
                            "bg-green-100 text-green-700"
                          }`}>
                            {(riskIndicators?.budgetRisk || 0)}%
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <div className="flex text-xs text-muted-foreground justify-between mb-1">
                            <span>Bajo</span>
                            <span>Medio</span>
                            <span>Alto</span>
                          </div>
                          <div className="h-2 w-full bg-gradient-to-r from-green-100 via-amber-100 to-red-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                (riskIndicators?.budgetRisk || 0) > 70 ? "bg-red-500" : 
                                (riskIndicators?.budgetRisk || 0) > 30 ? "bg-amber-500" : "bg-green-500"
                              }`}
                              style={{ width: `${riskIndicators?.budgetRisk || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Alertas activas */}
                      {(riskIndicators?.activeAlerts || 0) > 0 && (
                        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-red-700">
                                  {riskIndicators?.activeAlerts} alerta{(riskIndicators?.activeAlerts || 0) !== 1 ? 's' : ''} activa{(riskIndicators?.activeAlerts || 0) !== 1 ? 's' : ''}
                                </div>
                                <div className="text-xs text-red-600">
                                  Requiere atención inmediata
                                </div>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-red-200 text-red-700 hover:bg-red-100"
                            >
                              Ver detalles
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Factores de riesgo */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3">Principales Factores de Riesgo</h4>
                        <div className="space-y-2">
                          {(costSummary?.percentageUsed || 0) > 80 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                              <div className="mt-0.5 flex-shrink-0">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                              <p className="text-amber-800 text-xs">
                                El presupuesto consumido ({(costSummary?.percentageUsed || 0).toFixed(1)}%) es elevado en relación al progreso del proyecto ({(projectMetrics?.progressPercentage || 0).toFixed(1)}%).
                              </p>
                            </div>
                          )}
                          
                          {(projectMetrics?.hoursPerDay || 0) < 4 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                              <div className="mt-0.5 flex-shrink-0">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                              <p className="text-amber-800 text-xs">
                                El ritmo diario de trabajo ({(projectMetrics?.hoursPerDay || 0).toFixed(1)} h/día) podría ser insuficiente para completar el proyecto a tiempo.
                              </p>
                            </div>
                          )}
                          
                          {billablePercentage < 50 && totalHours > 20 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                              <div className="mt-0.5 flex-shrink-0">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                              <p className="text-amber-800 text-xs">
                                Baja proporción de horas facturables ({billablePercentage.toFixed(0)}%). Esto puede reducir la rentabilidad del proyecto.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Tab de entregables */}
            <TabsContent value="entregables" className="mt-0 p-0">
              <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="py-3 bg-slate-50 border-b">
                    <CardTitle className="text-base font-medium flex items-center">
                      <CircleCheck className="h-4 w-4 mr-2 text-slate-500" />
                      Entregables del Proyecto
                    </CardTitle>
                    <CardDescription>
                      Gestión de los entregables y su estado actual
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    {deliverableData ? (
                      <div className="bg-white rounded-lg border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">{deliverableData.title || "Entregable MODO"}</h3>
                          <div className="text-sm text-muted-foreground mt-1">Tipo: {deliverableData.type || "No especificado"}</div>
                        </div>
                        
                        <div className="flex flex-col md:items-end">
                          <div className={`px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center ${
                            deliverableData.status === "completed" ? "bg-green-100 text-green-700" : 
                            deliverableData.status === "in_progress" ? "bg-blue-100 text-blue-700" : 
                            "bg-amber-100 text-amber-700"
                          }`}>
                            <CircleCheck className="h-3 w-3 mr-1" />
                            {deliverableData.status === "completed" ? "Completado" : 
                             deliverableData.status === "in_progress" ? "En progreso" : 
                             "Pendiente"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {deliverableData.due_date ? 
                              `Fecha límite: ${formatDate(deliverableData.due_date)}` : 
                              "Sin fecha límite especificada"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border p-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                        <p className="text-muted-foreground">No hay entregables definidos para este proyecto</p>
                        <Button className="mt-4" variant="outline" size="sm">Definir entregable</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Tab de equipo */}
            <TabsContent value="equipo" className="mt-0 p-0">
              <div className="grid grid-cols-1 gap-6">
                {/* Sección de Equipo */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 bg-slate-50 border-b">
                    <CardTitle className="text-base font-medium flex items-center">
                      <Users className="h-4 w-4 mr-2 text-slate-500" />
                      Equipo Asignado
                    </CardTitle>
                    <CardDescription>
                      Personal asignado al proyecto y su dedicación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {timeByPersonnelData && timeByPersonnelData.length > 0 ? (
                        timeByPersonnelData.slice(0, 6).map((person: any, index: number) => (
                          <div key={index} className="bg-white rounded-lg border p-4 flex items-start space-x-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-lg flex-shrink-0">
                              {person.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{person.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">{person.role}</div>
                                </div>
                                <div className="text-right ml-2">
                                  <div className="font-semibold text-primary whitespace-nowrap">{person.hours.toFixed(1)}h</div>
                                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                                    {totalHours > 0 
                                      ? Math.round((person.hours / totalHours) * 100) 
                                      : 0}% del total
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ 
                                      width: `${totalHours > 0 ? (person.hours / totalHours) * 100 : 0}%` 
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          No hay datos de dedicación de personal disponibles
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ProjectSummaryFixed;