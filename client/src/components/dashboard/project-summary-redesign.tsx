import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  ExternalLink,
  Clock,
  DollarSign,
  Timer,
  ChevronLeft,
  Settings,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  PieChart,
  BarChart,
  LineChart,
  Users,
  Calendar,
  Filter,
  Maximize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Componente principal de resumen de proyecto rediseñado
const ProjectSummaryRedesign = ({
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
}) => {
  
  // Definición de una paleta de colores consistente
  const colors = {
    primary: {
      main: 'rgba(var(--primary))',
      light: 'rgba(var(--primary), 0.1)',
      border: 'rgba(var(--primary), 0.2)',
    },
    blue: {
      main: '#3b82f6',
      light: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
    },
    green: {
      main: '#10b981',
      light: '#ecfdf5',
      border: '#a7f3d0',
      text: '#047857',
    },
    amber: {
      main: '#f59e0b',
      light: '#fffbeb',
      border: '#fde68a',
      text: '#b45309',
    },
    red: {
      main: '#ef4444',
      light: '#fef2f2',
      border: '#fecaca',
      text: '#b91c1c',
    },
  };

  // Cálculo de estadísticas clave
  const totalHours = timeEntries?.reduce((sum, entry) => sum + entry.hours, 0) || 0;
  const billableHours = timeEntries?.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0) || 0;
  const nonBillableHours = totalHours - billableHours;
  const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  // Formatear fechas
  const formatDate = (dateString) => {
    if (!dateString) return "No definida";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

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
    <ScrollArea className="h-[calc(100vh-64px)]">
      <div className="px-4 py-6">
        {/* Header con información principal del proyecto */}
        <div className="bg-card rounded-xl shadow-lg border mb-8 overflow-hidden">
          <div className="bg-primary/5 border-b border-primary/20 p-5">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleGoBack}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">Proyectos</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold project-name">
                  {project?.quotation?.projectName || "Proyecto sin nombre"}
                </h1>
                <div className="mt-1 text-sm md:text-base text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>Inicio: {formatDate(project?.startDate)}</span>
                  <span>Fin estimado: {formatDate(project?.expectedEndDate)}</span>
                  <span>Estado: <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">{project?.status}</span></span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Controles de vista y filtros */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtrar
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
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Secciones</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleSectionToggle("kpi")} className="flex justify-between">
                      Indicadores clave
                      {dashboardState.showSections.kpi ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSectionToggle("deviations")} className="flex justify-between">
                      Desviaciones
                      {dashboardState.showSections.deviations ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSectionToggle("charts")} className="flex justify-between">
                      Gráficos
                      {dashboardState.showSections.charts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSectionToggle("team")} className="flex justify-between">
                      Equipo
                      {dashboardState.showSections.team ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          
          {/* Panel de métricas principales */}
          {dashboardState.showSections.kpi && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KPI: Horas Registradas */}
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-medium text-blue-800 flex items-center">
                      <Clock className="h-4 w-4 mr-1.5 text-blue-500" />
                      Horas Registradas
                    </div>
                    <h3 className="text-2xl font-bold text-blue-700 mt-1">{totalHours.toFixed(1)}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    onClick={() => handleHelpDialog('hoursHelp')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Facturables</span>
                    <span className="font-medium text-blue-700">{billableHours.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">No facturables</span>
                    <span className="font-medium text-blue-700">{nonBillableHours.toFixed(1)} h</span>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${billablePercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Distribución</span>
                      <span className="font-medium text-blue-700">{billablePercentage.toFixed(0)}% facturables</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* KPI: Costo vs Presupuesto */}
              <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-medium text-green-800 flex items-center">
                      <DollarSign className="h-4 w-4 mr-1.5 text-green-500" />
                      Costo vs Presupuesto
                    </div>
                    <h3 className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(costSummary?.actualCost || 0)}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-green-50"
                    onClick={() => handleHelpDialog('costHelp')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Presupuesto total</span>
                    <span className="font-medium text-green-700">{formatCurrency(costSummary?.estimatedCost || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Varianza</span>
                    <span className={`font-medium ${costSummary?.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {costSummary?.variance > 0 ? '+' : ''}{costSummary?.variance?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full bg-green-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          (costSummary?.percentageUsed || 0) > 90 ? "bg-red-500" :
                          (costSummary?.percentageUsed || 0) > 70 ? "bg-amber-500" :
                          "bg-green-500"
                        }`}
                        style={{ width: `${costSummary?.percentageUsed || 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Consumido</span>
                      <span className="font-medium text-green-700">{costSummary?.percentageUsed?.toFixed(1) || 0}% del presupuesto</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* KPI: Tiempo Restante */}
              <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg border border-amber-100 p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-medium text-amber-800 flex items-center">
                      <Timer className="h-4 w-4 mr-1.5 text-amber-500" />
                      Tiempo Restante
                    </div>
                    <h3 className="text-2xl font-bold text-amber-700 mt-1">
                      {projectMetrics?.daysTotal - projectMetrics?.daysElapsed} días
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                    onClick={() => handleHelpDialog('timeHelp')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Duración total</span>
                    <span className="font-medium text-amber-700">{projectMetrics?.daysTotal || 0} días</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tiempo transcurrido</span>
                    <span className="font-medium text-amber-700">{projectMetrics?.daysElapsed || 0} días ({projectMetrics?.progressPercentage?.toFixed(0) || 0}%)</span>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${projectMetrics?.progressPercentage || 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium text-amber-700">{projectMetrics?.progressPercentage?.toFixed(0) || 0}% completado</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Tabs para el análisis detallado */}
        <Tabs defaultValue="overview" className="mb-8">
          <TabsList className="mb-6 grid grid-cols-4 md:w-auto w-full">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="resources">Recursos</TabsTrigger>
            <TabsTrigger value="deliverables">Entregables</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-8">
            {/* Secciones del Dashboard: Desviaciones y Riesgos */}
            {dashboardState.showSections.deviations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Panel de desviaciones */}
                <Card className="border shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-medium flex items-center">
                        <TrendingUp className="h-5 w-5 mr-2 text-slate-500" />
                        Desviaciones del Proyecto
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleHelpDialog('deviationHelp')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Análisis de varianzas respecto a lo planificado
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      {/* Desviación de costo */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                              costSummary?.variance > 10 ? "bg-red-100" : 
                              costSummary?.variance > 0 ? "bg-amber-100" : "bg-green-100"
                            }`}>
                              <DollarSign className={`h-5 w-5 ${
                                costSummary?.variance > 10 ? "text-red-500" : 
                                costSummary?.variance > 0 ? "text-amber-500" : "text-green-500"
                              }`} />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium">Desviación de Costo</div>
                              <div className="text-xs text-muted-foreground">Comparado con lo presupuestado</div>
                            </div>
                          </div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${
                            costSummary?.variance > 10 ? "text-red-500" : 
                            costSummary?.variance > 0 ? "text-amber-500" : "text-green-500"
                          }`}>
                            {costSummary?.variance > 0 ? (
                              <>
                                <TrendingUp className="h-5 w-5" />
                                <span>+{costSummary?.variance?.toFixed(1) || 0}%</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-5 w-5" />
                                <span>{costSummary?.variance?.toFixed(1) || 0}%</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">Impacto en proyecto</span>
                            <span className={`font-medium ${
                              costSummary?.variance > 10 ? "text-red-500" : 
                              costSummary?.variance > 0 ? "text-amber-500" : "text-green-500"
                            }`}>
                              {costSummary?.variance > 10 ? "Alto" : 
                               costSummary?.variance > 0 ? "Medio" : "Bajo"}
                            </span>
                          </div>
                          <Progress 
                            value={Math.abs(costSummary?.variance || 0)} 
                            max={15}
                            className={`h-2 ${
                              costSummary?.variance > 10 ? "bg-red-100" : 
                              costSummary?.variance > 0 ? "bg-amber-100" : "bg-green-100"
                            }`}
                            indicatorClassName={`${
                              costSummary?.variance > 10 ? "bg-red-500" : 
                              costSummary?.variance > 0 ? "bg-amber-500" : "bg-green-500"
                            }`}
                          />
                        </div>
                      </div>
                      
                      {/* Desviación de tiempo */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                              riskIndicators?.scheduleRisk > 70 ? "bg-red-100" : 
                              riskIndicators?.scheduleRisk > 30 ? "bg-amber-100" : "bg-green-100"
                            }`}>
                              <Calendar className={`h-5 w-5 ${
                                riskIndicators?.scheduleRisk > 70 ? "text-red-500" : 
                                riskIndicators?.scheduleRisk > 30 ? "text-amber-500" : "text-green-500"
                              }`} />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium">Desviación de Tiempo</div>
                              <div className="text-xs text-muted-foreground">Comparado con lo planificado</div>
                            </div>
                          </div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${
                            riskIndicators?.scheduleRisk > 70 ? "text-red-500" : 
                            riskIndicators?.scheduleRisk > 30 ? "text-amber-500" : "text-green-500"
                          }`}>
                            {riskIndicators?.scheduleRisk > 50 ? (
                              <>
                                <TrendingUp className="h-5 w-5" />
                                <span>En riesgo</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-5 w-5" />
                                <span>En tiempo</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">Probabilidad de retraso</span>
                            <span className={`font-medium ${
                              riskIndicators?.scheduleRisk > 70 ? "text-red-500" : 
                              riskIndicators?.scheduleRisk > 30 ? "text-amber-500" : "text-green-500"
                            }`}>
                              {riskIndicators?.scheduleRisk || 0}%
                            </span>
                          </div>
                          <Progress 
                            value={riskIndicators?.scheduleRisk || 0} 
                            max={100}
                            className={`h-2 ${
                              riskIndicators?.scheduleRisk > 70 ? "bg-red-100" : 
                              riskIndicators?.scheduleRisk > 30 ? "bg-amber-100" : "bg-green-100"
                            }`}
                            indicatorClassName={`${
                              riskIndicators?.scheduleRisk > 70 ? "bg-red-500" : 
                              riskIndicators?.scheduleRisk > 30 ? "bg-amber-500" : "bg-green-500"
                            }`}
                          />
                        </div>
                      </div>
                      
                      {/* Alertas activas */}
                      {riskIndicators?.activeAlerts > 0 && (
                        <div className="bg-red-50 rounded-lg border border-red-200 p-4 mt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-red-700">
                                  {riskIndicators.activeAlerts} alerta{riskIndicators.activeAlerts !== 1 ? 's' : ''} activa{riskIndicators.activeAlerts !== 1 ? 's' : ''}
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
                    </div>
                  </CardContent>
                </Card>
                
                {/* Panel de análisis de riesgos */}
                <Card className="border shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-medium flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-slate-500" />
                        Análisis de Riesgos
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleHelpDialog('riskHelp')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Indicadores predictivos basados en tendencias actuales
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      {/* Medidor de riesgo de presupuesto */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-sm font-medium">Riesgo de Presupuesto</div>
                            <div className="text-xs text-muted-foreground">Probabilidad de exceder presupuesto</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-semibold ${
                            riskIndicators?.budgetRisk > 70 ? "bg-red-100 text-red-700" : 
                            riskIndicators?.budgetRisk > 30 ? "bg-amber-100 text-amber-700" : 
                            "bg-green-100 text-green-700"
                          }`}>
                            {riskIndicators?.budgetRisk > 70 ? "Alto" : 
                             riskIndicators?.budgetRisk > 30 ? "Medio" : "Bajo"}
                          </div>
                        </div>
                        
                        <div className="mt-1">
                          <div className="mb-1 flex justify-between text-xs">
                            <span>Bajo</span>
                            <span>Medio</span>
                            <span>Alto</span>
                          </div>
                          <div className="h-2 w-full bg-gradient-to-r from-green-100 via-amber-100 to-red-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                riskIndicators?.budgetRisk > 70 ? "bg-red-500" : 
                                riskIndicators?.budgetRisk > 30 ? "bg-amber-500" : "bg-green-500"
                              }`}
                              style={{ width: `${riskIndicators?.budgetRisk || 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-right mt-1 text-muted-foreground">
                            {riskIndicators?.budgetRisk || 0}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Medidor de riesgo de cronograma */}
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-sm font-medium">Riesgo de Cronograma</div>
                            <div className="text-xs text-muted-foreground">Probabilidad de retraso</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-semibold ${
                            riskIndicators?.scheduleRisk > 70 ? "bg-red-100 text-red-700" : 
                            riskIndicators?.scheduleRisk > 30 ? "bg-amber-100 text-amber-700" : 
                            "bg-green-100 text-green-700"
                          }`}>
                            {riskIndicators?.scheduleRisk > 70 ? "Alto" : 
                             riskIndicators?.scheduleRisk > 30 ? "Medio" : "Bajo"}
                          </div>
                        </div>
                        
                        <div className="mt-1">
                          <div className="mb-1 flex justify-between text-xs">
                            <span>Bajo</span>
                            <span>Medio</span>
                            <span>Alto</span>
                          </div>
                          <div className="h-2 w-full bg-gradient-to-r from-green-100 via-amber-100 to-red-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                riskIndicators?.scheduleRisk > 70 ? "bg-red-500" : 
                                riskIndicators?.scheduleRisk > 30 ? "bg-amber-500" : "bg-green-500"
                              }`}
                              style={{ width: `${riskIndicators?.scheduleRisk || 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-right mt-1 text-muted-foreground">
                            {riskIndicators?.scheduleRisk || 0}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Factores de riesgo */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3">Principales Factores de Riesgo</h4>
                        <div className="space-y-2 text-sm">
                          {costSummary?.percentageUsed > 80 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                              <div className="mt-0.5">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                              <p className="text-amber-800 text-xs">
                                El presupuesto consumido ({costSummary.percentageUsed.toFixed(1)}%) es elevado en relación al progreso del proyecto ({projectMetrics?.progressPercentage?.toFixed(1) || 0}%).
                              </p>
                            </div>
                          )}
                          
                          {(projectMetrics?.hoursPerDay || 0) < 4 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                              <div className="mt-0.5">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                              <p className="text-amber-800 text-xs">
                                El ritmo diario de trabajo ({projectMetrics?.hoursPerDay?.toFixed(1) || 0} h/día) podría ser insuficiente para completar el proyecto a tiempo.
                              </p>
                            </div>
                          )}
                          
                          {billablePercentage < 50 && totalHours > 20 && (
                            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                              <div className="mt-0.5">
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
            )}
            
            {/* Sección de Gráficos */}
            {dashboardState.showSections.charts && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Gráfico de distribución de tiempo por persona */}
                <Card className="border shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-medium flex items-center">
                        <BarChart className="h-5 w-5 mr-2 text-slate-500" />
                        Tiempo por Integrante
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleExpandChart('personnelBar', 'Distribución de Tiempo por Integrante')}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      Distribución de horas trabajadas por cada integrante
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="h-64">
                      {/* Aquí iría el gráfico de barras horizontal */}
                      <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground">
                        <BarChart className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-sm">Visualización del gráfico de tiempo por integrante</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Gráfico de distribución facturable vs no facturable */}
                <Card className="border shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-medium flex items-center">
                        <PieChart className="h-5 w-5 mr-2 text-slate-500" />
                        Distribución Facturable
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleExpandChart('billablePie', 'Distribución de Horas Facturables')}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      Proporción entre horas facturables y no facturables
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="h-64">
                      {/* Aquí iría el gráfico de pie */}
                      <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground">
                        <PieChart className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-sm">Visualización del gráfico de distribución facturable</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Gráfico de tendencia de tiempo y costo */}
                <Card className="border shadow-md overflow-hidden lg:col-span-2">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-medium flex items-center">
                        <LineChart className="h-5 w-5 mr-2 text-slate-500" />
                        Tendencias de Tiempo y Costo
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleExpandChart('timeTrend', 'Tendencias de Tiempo y Costo')}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      Evolución acumulada de horas y costos a lo largo del tiempo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="h-72">
                      {/* Aquí iría el gráfico de líneas */}
                      <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground">
                        <LineChart className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-sm">Visualización del gráfico de tendencias de tiempo y costo</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Sección de Equipo */}
            {dashboardState.showSections.team && (
              <div className="mt-6">
                <Card className="border shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-medium flex items-center">
                        <Users className="h-5 w-5 mr-2 text-slate-500" />
                        Equipo Asignado
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleHelpDialog('teamHelp')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Personal asignado al proyecto y su dedicación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {timeByPersonnelData && timeByPersonnelData.length > 0 ? (
                        timeByPersonnelData.slice(0, 6).map((person, index) => (
                          <div key={index} className="bg-white rounded-lg border p-4 flex items-start space-x-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-lg">
                              {person.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{person.name}</div>
                                  <div className="text-xs text-muted-foreground">{person.role}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-primary">{person.hours.toFixed(1)}h</div>
                                  <div className="text-xs text-muted-foreground">
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
                    
                    {timeByPersonnelData && timeByPersonnelData.length > 6 && (
                      <div className="mt-4 text-center">
                        <Button variant="outline" size="sm">
                          Ver todos los integrantes ({timeByPersonnelData.length})
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="resources">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recursos del Proyecto</CardTitle>
                  <CardDescription>
                    Gestión de los recursos humanos y materiales asignados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Contenido de recursos del proyecto</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="deliverables">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Entregables del Proyecto</CardTitle>
                  <CardDescription>
                    Gestión de los entregables y su estado actual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {deliverableData ? (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Entregable MODO</h3>
                      <div className="grid gap-4">
                        {/* Aquí irían los detalles del entregable MODO */}
                        <p>Tipo: {deliverableData.type}</p>
                        <p>Título: {deliverableData.title}</p>
                        <p>Estado: {deliverableData.status}</p>
                      </div>
                    </div>
                  ) : (
                    <p>No hay entregables definidos para este proyecto</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="analytics">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Análisis Avanzado</CardTitle>
                  <CardDescription>
                    Métricas detalladas y análisis de tendencias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Contenido de analytics</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
};

export default ProjectSummaryRedesign;