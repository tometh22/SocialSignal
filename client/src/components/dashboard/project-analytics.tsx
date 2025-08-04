import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  BarChart4,
  Calendar,
  Clock,
  DollarSign,
  Gauge,
  LineChart,
  PieChart,
  RefreshCw,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCompleteProjectData } from '@/hooks/useCompleteProjectData';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProjectAnalyticsProps {
  project: any;
  costSummary: any;
  timeEntries: any[];
  personnel: any[];
  roles: any[];
  deliverableData: any;
  projectMetrics: {
    hoursPerDay: number;
    progressPercentage: number;
    plannedHours: number;
    actualHours: number;
    daysElapsed: number;
    daysTotal: number;
  };
  riskIndicators: {
    budgetRisk: number;
    scheduleRisk: number;
    activeAlerts: number;
  };
  timeByPersonnelData: any[];
  billableDistributionData: any[];
  onHelpRequest: (topic: string) => void;
  onExpandChart: (type: string, title: string) => void;
  onTimeFilterChange: (filter: string) => void;
  isLoading: boolean;
  timeFilter: string;
}

const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({
  project,
  costSummary,
  timeEntries,
  personnel,
  roles,
  deliverableData,
  projectMetrics,
  riskIndicators,
  timeByPersonnelData,
  billableDistributionData,
  onHelpRequest,
  onExpandChart,
  onTimeFilterChange,
  isLoading,
  timeFilter
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Single source of truth for project data with temporal filtering
  const { data: completeData, isLoading: isCompleteDataLoading } = useCompleteProjectData(project?.id, timeFilter);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const formatNumber = (num: number, digits = 1) => {
    return num.toLocaleString('es-AR', { 
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 80) return "text-red-600";
    if (risk >= 60) return "text-yellow-600";
    return "text-green-600";
  };

  const renderChartPlaceholder = (title: string, description: string, icon: React.ReactNode, type: string, height = "h-64") => {
    return (
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription className="text-xs">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className={`${height} border-2 border-dashed border-muted rounded-lg flex items-center justify-center`}>
            <div className="text-center text-muted-foreground">
              <div className="text-sm font-medium">Gráfico: {title}</div>
              <div className="text-xs mt-1">Datos en tiempo real</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen Ejecutivo</TabsTrigger>
          <TabsTrigger value="team">Gestión del Equipo</TabsTrigger>
          <TabsTrigger value="monthly">Análisis Mensual</TabsTrigger>
        </TabsList>

        {/* Contenido: Resumen Ejecutivo */}
        <TabsContent value="overview" className="mt-0 space-y-6">
          {/* KPIs principales */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Progreso General</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatNumber(projectMetrics?.progressPercentage || 0, 1)}%</div>
                <Progress value={projectMetrics?.progressPercentage || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Horas Trabajadas</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatNumber(projectMetrics?.actualHours || 0, 1)}h</div>
                <div className="text-xs text-muted-foreground mt-1">
                  de {formatNumber(projectMetrics?.plannedHours || 0, 0)}h planificadas
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Costos del Proyecto</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  <div>
                    <div className="text-lg font-bold text-green-600">{formatCurrency(costSummary?.actualCost || 0)}</div>
                    <div className="text-xs text-muted-foreground">Costo Real (freelancers)</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">{formatCurrency(costSummary?.operationalCost || 0)}</div>
                    <div className="text-xs text-muted-foreground">Costo Operacional (total)</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                    vs {formatCurrency(costSummary?.plannedCost || 0)} planificado
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Riesgo General</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className={`text-2xl font-bold ${getRiskColor(riskIndicators?.budgetRisk || 0)}`}>
                  {formatNumber(riskIndicators?.budgetRisk || 0, 0)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {riskIndicators?.activeAlerts || 0} alertas activas
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos principales */}
          <div className="grid grid-cols-2 gap-4">
            {renderChartPlaceholder(
              "Evolución del Progreso", 
              "Progreso del proyecto a lo largo del tiempo", 
              <TrendingUp className="h-4 w-4 text-primary" />, 
              "progressArea"
            )}

            {renderChartPlaceholder(
              "Distribución de Costos", 
              "Desglose de costos por categoría", 
              <PieChart className="h-4 w-4 text-primary" />, 
              "costPie"
            )}
          </div>
        </TabsContent>

        {/* Contenido: Equipo y Recursos - USING UNIFIED DATA SOURCE */}
        <TabsContent value="team" className="mt-0 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              {renderChartPlaceholder(
                "Distribución de Horas por Persona", 
                "Tiempo dedicado por cada miembro del equipo del período seleccionado", 
                <Users className="h-4 w-4 text-primary" />, 
                "personnelBar",
                "h-72"
              )}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Equipo del Proyecto
                </CardTitle>
                <CardDescription className="text-xs">
                  Datos del período: {timeFilter === "last_month" ? "Mes pasado" : "Período seleccionado"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {completeData?.quotation?.team?.length > 0 ? (
                  <div className="space-y-3 mt-2">
                    {completeData.quotation.team.map(member => {
                      const estimatedHours = member.hours || 0;
                      const memberCost = member.cost || 0;
                      const percentOfTeam = completeData.quotation?.estimatedHours > 0 
                        ? ((estimatedHours / completeData.quotation.estimatedHours) * 100).toFixed(1)
                        : '0';

                      return (
                        <div key={member.id} className="p-3 rounded-md bg-muted/10 border">
                          <div className="flex justify-between items-baseline mb-2">
                            <span className="text-sm font-medium">{member.personnelName || 'Sin nombre'}</span>
                            <span className="text-xs text-muted-foreground">
                              {percentOfTeam}% del equipo
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline mb-2">
                            <span className="text-lg font-semibold">{formatNumber(estimatedHours, 1)}h</span>
                            <span className="text-xs">
                              ${memberCost.toLocaleString()}
                            </span>
                          </div>
                          <Progress 
                            value={estimatedHours} 
                            max={Math.max(...completeData.quotation.team.map(m => m.hours || 0))} 
                            className="h-1.5" 
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    No hay equipo en la cotización
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Detalle del Equipo
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {completeData?.quotation?.team?.length || 0} miembros
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Información de la cotización y estimaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {completeData?.quotation?.team?.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/20 text-xs font-medium">
                    <div className="col-span-4">Nombre</div>
                    <div className="col-span-2">Horas Est.</div>
                    <div className="col-span-2">Tarifa</div>
                    <div className="col-span-2">Costo</div>
                    <div className="col-span-2">% Equipo</div>
                  </div>

                  <div className="divide-y">
                    {completeData.quotation.team.map((member, index) => {
                      const estimatedHours = member.hours || 0;
                      const hourlyRate = member.rate || 0;
                      const memberCost = member.cost || 0;
                      const percentOfTeam = completeData.quotation?.estimatedHours > 0 
                        ? ((estimatedHours / completeData.quotation.estimatedHours) * 100).toFixed(1)
                        : '0';

                      return (
                        <div key={index} className="grid grid-cols-12 gap-2 p-3 text-sm border-b last:border-b-0">
                          <div className="col-span-4 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {(member.personnelName || 'NN').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{member.personnelName || 'Sin nombre'}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="font-medium">{formatNumber(estimatedHours, 1)}h</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="text-muted-foreground">${hourlyRate.toFixed(1)}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="font-medium">${memberCost.toLocaleString()}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="text-muted-foreground">{percentOfTeam}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  No hay datos del equipo disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contenido: Análisis Mensual - World-Class Design */}
        <TabsContent value="monthly" className="mt-0 space-y-6">
          {isCompleteDataLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Enhanced KPI Header Cards */}
              <div className="grid grid-cols-6 gap-4">
                {/* Health Score */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 cursor-help">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-emerald-700 mb-1">Score de Salud</p>
                              <p className="text-2xl font-bold text-emerald-800">
                                {completeData?.metrics?.efficiency ? Math.round(100 - Math.max(0, completeData.metrics.efficiency - 100)) : 85}
                              </p>
                              <p className="text-xs text-emerald-600 mt-1">
                                {completeData?.metrics?.efficiency ? (
                                  completeData.metrics.efficiency <= 100 ? 'Excelente' : 
                                  completeData.metrics.efficiency <= 150 ? 'Bueno' : 'Crítico'
                                ) : 'Calculando...'}
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-emerald-200/50 flex items-center justify-center">
                              <Gauge className="h-6 w-6 text-emerald-700" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="w-48 p-3">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Score de Salud del Proyecto</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Indicador general del rendimiento del proyecto basado en desviaciones horarias
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Horas estimadas:</span>
                            <span className="font-medium">{completeData?.quotation?.estimatedHours || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Horas trabajadas:</span>
                            <span className="font-medium">{completeData?.actuals?.totalWorkedHours?.toFixed(1) || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Eficiencia:</span>
                            <span className="font-medium">{completeData?.metrics?.efficiency?.toFixed(1) || 0}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Verde: ≤100%, Amarillo: ≤150%, Rojo: &gt;150%
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Financial Projection */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 cursor-help">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-blue-700 mb-1">Proyección Financiera</p>
                              <p className="text-lg font-bold text-blue-800">
                                {completeData?.metrics?.markup ? (
                                  completeData.metrics.markup >= 2.5 ? 'Excelente' :
                                  completeData.metrics.markup >= 1.8 ? 'Muy Buena' :
                                  completeData.metrics.markup >= 1.2 ? 'Buena' : 'Crítica'
                                ) : 'Calculando...'}
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                Markup: {completeData?.metrics?.markup?.toFixed(2) || 0}x
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-200/50 flex items-center justify-center">
                              <TrendingUp className="h-6 w-6 text-blue-700" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="w-48 p-3">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Proyección Financiera</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Análisis de rentabilidad basado en precio vs costo real
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Precio cotizado:</span>
                            <span className="font-medium">${completeData?.quotation?.totalAmount?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Costo real:</span>
                            <span className="font-medium">${completeData?.actuals?.totalWorkedCost?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Markup:</span>
                            <span className="font-medium">{completeData?.metrics?.markup?.toFixed(2) || 0}x</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Verde: ≥2.5x, Azul: ≥1.8x, Amarillo: ≥1.2x, Rojo: &lt;1.2x
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Team Efficiency */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 cursor-help">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-purple-700 mb-1">Eficiencia del Equipo</p>
                              <p className="text-2xl font-bold text-purple-800">
                                {completeData?.metrics?.efficiency?.toFixed(1) || 0}%
                              </p>
                              <p className="text-xs text-purple-600 mt-1">
                                {completeData?.quotation?.team?.length || 0} miembros
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-purple-200/50 flex items-center justify-center">
                              <Users className="h-6 w-6 text-purple-700" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="w-48 p-3">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Eficiencia del Equipo</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Porcentaje de horas trabajadas vs horas estimadas del equipo
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Horas estimadas:</span>
                            <span className="font-medium">{completeData?.quotation?.estimatedHours || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Horas trabajadas:</span>
                            <span className="font-medium">{completeData?.actuals?.totalWorkedHours?.toFixed(1) || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Eficiencia:</span>
                            <span className="font-medium">{completeData?.metrics?.efficiency?.toFixed(1) || 0}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          100% = perfecto, &gt;100% = sobrecosto, &lt;100% = subcosto
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Operational Indicators */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 cursor-help">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-orange-700 mb-1">Indicadores Operacionales</p>
                              <p className="text-lg font-bold text-orange-800">
                                {completeData?.actuals?.totalEntries || 0}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">
                                registros activos
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-orange-200/50 flex items-center justify-center">
                              <Clock className="h-6 w-6 text-orange-700" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="w-48 p-3">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Indicadores Operacionales</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Métricas operacionales del proyecto
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Registros totales:</span>
                            <span className="font-medium">{completeData?.actuals?.totalEntries || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Desviación horas:</span>
                            <span className="font-medium">{completeData?.metrics?.hoursDeviation?.toFixed(1) || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Desviación costo:</span>
                            <span className="font-medium">${completeData?.metrics?.costDeviation?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Valores positivos = sobrecosto, negativos = subcosto
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Quality Score */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-teal-50 to-teal-100 cursor-help">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-teal-700 mb-1">Score de Calidad</p>
                              <p className="text-2xl font-bold text-teal-800">
                                {completeData?.metrics?.budgetUtilization ? Math.round(100 - Math.abs(completeData.metrics.budgetUtilization - 100)) : 90}
                              </p>
                              <p className="text-xs text-teal-600 mt-1">
                                {completeData?.metrics?.budgetUtilization ? (
                                  Math.abs(completeData.metrics.budgetUtilization - 100) <= 10 ? 'Excelente' :
                                  Math.abs(completeData.metrics.budgetUtilization - 100) <= 25 ? 'Bueno' : 'Necesita mejora'
                                ) : 'Evaluando...'}
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-teal-200/50 flex items-center justify-center">
                              <Calendar className="h-6 w-6 text-teal-700" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="w-48 p-3">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Score de Calidad</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Evaluación de la calidad del entregable basada en utilización de presupuesto
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Presupuesto base:</span>
                            <span className="font-medium">${completeData?.quotation?.baseCost?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Costo trabajado:</span>
                            <span className="font-medium">${completeData?.actuals?.totalWorkedCost?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Utilización:</span>
                            <span className="font-medium">{completeData?.metrics?.budgetUtilization?.toFixed(1) || 0}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Diferencia respecto al presupuesto planificado
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Performance Registers */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-pink-50 to-pink-100 cursor-help">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-pink-700 mb-1">Progreso vs Estimado</p>
                              <p className="text-2xl font-bold text-pink-800">
                                {completeData?.quotation?.estimatedHours && completeData?.actuals?.totalWorkedHours 
                                  ? `${Math.round((completeData.actuals.totalWorkedHours / completeData.quotation.estimatedHours) * 100)}%`
                                  : '0%'}
                              </p>
                              <p className="text-xs text-pink-600 mt-1">
                                {completeData?.actuals?.totalWorkedHours?.toFixed(1) || 0}h de {completeData?.quotation?.estimatedHours || 0}h
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-pink-200/50 flex items-center justify-center">
                              <BarChart4 className="h-6 w-6 text-pink-700" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="w-48 p-3">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Progreso vs Estimado</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Comparación directa entre horas trabajadas y cotizadas
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Horas cotizadas:</span>
                            <span className="font-medium">{completeData?.quotation?.estimatedHours || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Horas trabajadas:</span>
                            <span className="font-medium">{completeData?.actuals?.totalWorkedHours?.toFixed(1) || 0}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Progreso:</span>
                            <span className="font-medium">{completeData?.metrics?.efficiency?.toFixed(1) || 0}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Verde: ≤100%, Amarillo: ≤150%, Rojo: &gt;150%
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
        </TabsContent>

        {/* Enhanced Team Performance Analysis - USING UNIFIED DATA SOURCE */}
        <TabsContent value="performance" className="mt-0 space-y-6">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Análise de Rendimiento del Equipo
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 mt-1">
                    Métricas basadas en datos reales del período seleccionado
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
                  {timeFilter === "current_month" ? "Este mes" : 
                   timeFilter === "last_month" ? "Mes pasado" :
                   timeFilter === "current_quarter" ? "Este trimestre" :
                   timeFilter === "last_quarter" ? "Trimestre pasado" :
                   "Período completo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {completeData?.quotation?.team?.length > 0 ? (
                  completeData.quotation.team.map((member) => {
                    // Usar datos únicamente de la fuente consolidada
                    const estimatedHours = member.hours || 0;
                    const memberHourlyRate = member.rate || 0;
                    // Para datos trabajados reales, buscar en los datos consolidados si están disponibles
                    const memberWorkedHours = completeData?.actuals?.totalWorkedHours 
                      ? (completeData.actuals.totalWorkedHours * (estimatedHours / (completeData.quotation?.estimatedHours || 1)))
                      : 0;
                    
                    const hasActivity = memberWorkedHours > 0;
                    const costGenerated = memberWorkedHours * memberHourlyRate;
                    const efficiency = estimatedHours > 0 ? (memberWorkedHours / estimatedHours) * 100 : 0;
                    
                    // Performance classification
                    const getPerformanceColor = (eff: number) => {
                      if (eff >= 90) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' };
                      if (eff >= 70) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' };
                      if (eff >= 50) return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' };
                      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' };
                    };

                    const perfColors = getPerformanceColor(efficiency);

                    return (
                      <div 
                        key={member.id}
                        className={`${perfColors.bg} ${perfColors.border} border rounded-xl p-4 transition-all duration-200 hover:shadow-md`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-semibold text-slate-700">
                              {(member.personnelName || 'NN').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className={`font-semibold ${perfColors.text}`}>{member.personnelName || 'Sin nombre'}</h4>
                              <p className="text-sm text-slate-600">
                                Cotizado • ${memberHourlyRate.toFixed(1)}/h
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={perfColors.badge}>
                              {efficiency.toFixed(0)}% eficiencia
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-800">{formatNumber(memberWorkedHours, 1)}h</p>
                            <p className="text-xs text-slate-600">Trabajadas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-800">{formatNumber(estimatedHours, 1)}h</p>
                            <p className="text-xs text-slate-600">Estimadas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-800">${formatNumber(costGenerated, 0)}</p>
                            <p className="text-xs text-slate-600">Generados</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-lg font-bold ${perfColors.text}`}>
                              {hasActivity ? formatNumber(memberWorkedHours / 30, 1) + 'h/día' : '0h/día'}
                            </p>
                            <p className="text-xs text-slate-600">Promedio</p>
                          </div>
                        </div>

                        {hasActivity && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Progreso vs Estimado</span>
                              <span className={perfColors.text}>{efficiency.toFixed(1)}%</span>
                            </div>
                            <Progress 
                              value={Math.min(efficiency, 100)} 
                              className="h-2"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay personal asignado al proyecto en la cotización</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Monthly Detailed Analysis */}
          <div className="grid grid-cols-2 gap-6">
            {/* Comprehensive Metrics Panel */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart4 className="h-5 w-5 text-purple-600" />
                  Métricas Operacionales
                </CardTitle>
                <CardDescription className="text-sm text-slate-600">
                  Indicadores clave de rendimiento del período
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Horas Trabajadas</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatNumber(completeData?.actuals?.totalWorkedHours || 0, 1)}h
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {((completeData?.actuals?.totalWorkedHours || 0) / Math.max(completeData?.quotation?.estimatedHours || 1, 1) * 100).toFixed(1)}% del total
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Costo Generado</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(completeData?.actuals?.totalWorkedCost || 0)}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {((completeData?.actuals?.totalWorkedCost || 0) / Math.max(completeData?.quotation?.baseCost || 1, 1) * 100).toFixed(1)}% del presupuesto
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">Miembros Activos</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {completeData?.actuals?.teamBreakdown?.filter(member => (member.hours || 0) > 0).length || 0}
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      de {completeData?.quotation?.team?.length || 0} total
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Registros</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {completeData?.actuals?.totalEntries || 0}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      entradas de tiempo
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2">Distribución por Roles</h4>
                  <div className="space-y-2">
                    {completeData?.actuals?.teamBreakdown?.map(member => {
                      const memberHours = member.hours || 0;
                      const totalHours = completeData?.actuals?.totalWorkedHours || 0;
                      const percentage = totalHours > 0 ? (memberHours / totalHours) * 100 : 0;

                      if (memberHours === 0) return null;

                      return (
                        <div key={member.personnelId} className="flex justify-between items-center">
                          <span className="text-sm text-slate-700">{member.personnelName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{formatNumber(memberHours, 1)}h</span>
                            <span className="text-xs text-slate-600">({percentage.toFixed(1)}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Charts Section */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-emerald-600" />
                  Análisis Visual
                </CardTitle>
                <CardDescription className="text-sm text-slate-600">
                  Representación gráfica de tendencias y patrones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Performance Heatmap Simulation */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg">
                  <h4 className="font-semibold text-emerald-800 mb-3">Mapa de Rendimiento del Equipo</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {completeData?.actuals?.teamBreakdown?.slice(0, 15).map((member, index) => {
                      const memberHours = member.hours || 0;
                      const maxHours = Math.max(...(completeData?.actuals?.teamBreakdown?.map(m => m.hours || 0) || [1]));
                      const intensity = Math.min(memberHours / maxHours, 1); // Normalize to 0-1
                      const bgIntensity = Math.round(intensity * 9);
                      
                      return (
                        <div
                          key={member.personnelId}
                          className={`
                            w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium
                            ${bgIntensity === 0 ? 'bg-slate-100 text-slate-400' :
                              bgIntensity <= 3 ? 'bg-yellow-200 text-yellow-800' :
                              bgIntensity <= 6 ? 'bg-orange-300 text-orange-900' :
                              'bg-emerald-400 text-emerald-900'}
                          `}
                          title={`${member.personnelName}: ${memberHours.toFixed(1)}h`}
                        >
                          {member.personnelName.substring(0, 2).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center mt-3 text-xs text-emerald-700">
                    <span>Menos activo</span>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-sm
                            ${i === 0 ? 'bg-slate-200' :
                              i === 1 ? 'bg-yellow-200' :
                              i === 2 ? 'bg-orange-300' :
                              i === 3 ? 'bg-emerald-300' :
                              'bg-emerald-400'}
                          `}
                        />
                      ))}
                    </div>
                    <span>Más activo</span>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-3">Línea de Tiempo del Progreso</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Inicio del proyecto', progress: 0, color: 'bg-slate-300' },
                      { label: 'Primera semana', progress: 25, color: 'bg-yellow-400' },
                      { label: 'Mes actual', progress: Math.min((projectMetrics?.progressPercentage || 0), 100), color: 'bg-blue-500' },
                      { label: 'Objetivo final', progress: 100, color: 'bg-emerald-500' }
                    ].map((phase, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${phase.color}`} />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-800">{phase.label}</span>
                            <span className="text-blue-700">{phase.progress.toFixed(0)}%</span>
                          </div>
                          <Progress value={phase.progress} className="h-1.5 mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality Indicators */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-3">Indicadores de Calidad</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {Math.round(85 - (riskIndicators?.budgetRisk || 0) * 0.3)}%
                      </div>
                      <div className="text-xs text-purple-700">Satisfacción</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {Math.round(90 - (riskIndicators?.scheduleRisk || 0) * 0.2)}%
                      </div>
                      <div className="text-xs text-purple-700">Calidad</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default ProjectAnalytics;