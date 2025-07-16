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
                <CardTitle className="text-xs font-medium text-muted-foreground">Costo Actual</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatCurrency(costSummary?.actualCost || 0)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(costSummary?.plannedCost || 0)} planificado
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

        {/* Contenido: Equipo y Recursos */}
        <TabsContent value="team" className="mt-0 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              {renderChartPlaceholder(
                "Distribución de Horas por Persona", 
                "Tiempo dedicado por cada miembro del equipo", 
                <Users className="h-4 w-4 text-primary" />, 
                "personnelBar",
                "h-72"
              )}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Asignación por Rol
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribución de horas según rol
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {timeByPersonnelData.length > 0 ? (
                  <div className="space-y-3 mt-2">
                    {roles.map(role => {
                      const personelInRole = timeByPersonnelData.filter(
                        p => personnel.find(per => per.id === p.id)?.roleId === role.id
                      );
                      const totalHoursInRole = personelInRole.reduce((sum, p) => sum + p.hours, 0);

                      if (totalHoursInRole <= 0) return null;

                      return (
                        <div key={role.id} className="p-2 rounded-md bg-muted/10">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm font-medium">{role.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {personelInRole.length} persona{personelInRole.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-lg font-semibold">{formatNumber(totalHoursInRole, 1)}h</span>
                            <span className="text-xs">
                              {(totalHoursInRole / (projectMetrics?.actualHours || 1) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={totalHoursInRole} 
                            max={projectMetrics?.actualHours || 0} 
                            className="h-1.5" 
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    No hay datos disponibles
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
                  Equipo del Proyecto
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Actualizar
                </Button>
              </div>
              <CardDescription className="text-xs">
                Detalle de asignación y carga de trabajo
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {timeByPersonnelData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/20 text-xs font-medium">
                    <div className="col-span-3">Nombre</div>
                    <div className="col-span-2">Rol</div>
                    <div className="col-span-2">Horas</div>
                    <div className="col-span-2">% del Total</div>
                    <div className="col-span-3">Distribución</div>
                  </div>

                  <div className="divide-y">
                    {timeByPersonnelData.map((person, index) => {
                      const personDetails = personnel.find(p => p.id === person.id);
                      const roleDetails = roles.find(r => r.id === personDetails?.roleId);
                      const percentOfTotal = ((person.hours / (projectMetrics?.actualHours || 1)) * 100).toFixed(1);

                      return (
                        <div key={index} className="grid grid-cols-12 gap-2 p-3 text-sm border-b last:border-b-0">
                          <div className="col-span-3 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {person.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{person.name}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="text-muted-foreground">{roleDetails?.name || 'Sin rol'}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="font-medium">{formatNumber(person.hours, 1)}h</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="text-muted-foreground">{percentOfTotal}%</span>
                          </div>
                          <div className="col-span-3 flex items-center">
                            <Progress 
                              value={person.hours} 
                              max={Math.max(...timeByPersonnelData.map(p => p.hours))} 
                              className="h-2 flex-1" 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contenido: Análisis Mensual */}
        <TabsContent value="monthly" className="mt-0 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {renderChartPlaceholder(
              "Horas por Mes", 
              "Progreso mensual del proyecto", 
              <TrendingUp className="h-4 w-4 text-primary" />, 
              "monthlyArea",
              "h-64"
            )}

            {renderChartPlaceholder(
              "Costos por Mes", 
              "Evolución de costos mensual", 
              <DollarSign className="h-4 w-4 text-primary" />, 
              "costMonthly",
              "h-64"
            )}
          </div>

          {/* Análisis de Eficiencia por Miembro */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Eficiencia por Miembro
              </CardTitle>
              <CardDescription className="text-xs">
                Top performers vs underperformers del equipo
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-700">
                    Período: {timeFilter === "current_month" ? "Este mes" : 
                             timeFilter === "last_month" ? "Mes pasado (junio 2025)" :
                             timeFilter === "current_quarter" ? "Este trimestre" :
                             timeFilter === "last_quarter" ? "Trimestre pasado" :
                             "Todo el proyecto"}
                  </span>
                  <span className="text-blue-600">
                    {timeEntries.length} registros filtrados • {personnel.length} miembros en el equipo
                  </span>
                </div>
                {timeFilter === "last_month" && (
                  <div className="text-xs text-blue-600 mt-1">
                    DEBUG: Buscando registros de junio 2025 (mes 5, año 2025)
                  </div>
                )}
              </div>

              {/* Lista de eficiencia del equipo */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Equipo del Proyecto {timeEntries.length > 0 ? "" : "(Sin actividad en este período)"}
                </div>
                
                {timeFilter === "last_month" && (
                  <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                    <strong>DEBUG:</strong> Filtrando {timeEntries.length} registros para junio 2025
                    {timeEntries.length > 0 && (
                      <div className="mt-1">
                        Muestra: {timeEntries.slice(0, 2).map(e => 
                          `ID:${e.id} Fecha:${new Date(e.date || e.createdAt).toLocaleDateString('es-ES')} Horas:${e.hours} Personal:${e.personnelId}`
                        ).join(' | ')}
                      </div>
                    )}
                  </div>
                )}
                
                {personnel.length > 0 ? (
                  <div className="space-y-2">
                    {personnel.map((member) => {
                      // Calcular horas trabajadas por este miembro en el período actual
                      const memberHours = timeEntries
                        .filter(entry => entry.personnelId === member.id)
                        .reduce((sum, entry) => sum + (entry.hours || 0), 0);
                      
                      // Obtener rol del miembro
                      const memberRole = roles.find(role => role.id === member.roleId);
                      
                      // Calcular horas estimadas para este miembro (basado en timeByPersonnelData)
                      const memberInTimeData = timeByPersonnelData.find(p => p.id === member.id);
                      const estimatedHours = memberInTimeData ? memberInTimeData.hours : 0;
                      
                      const hasActivity = memberHours > 0;
                      const costGenerated = memberHours * member.hourlyRate;
                      
                      // Debug específico para miembros que deberían tener datos
                      const memberEntriesInPeriod = timeEntries.filter(entry => entry.personnelId === member.id);

                      return (
                        <div 
                          key={member.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            hasActivity ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{member.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {memberRole?.name || 'Sin rol'} • ${member.hourlyRate.toFixed(1)}/h
                                {timeFilter === "last_month" && (
                                  <span className="ml-2 text-yellow-600">
                                    (ID:{member.id}, Entradas:{memberEntriesInPeriod.length})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {hasActivity ? (
                              <>
                                <div className="font-medium text-sm">{formatNumber(memberHours, 1)}h trabajadas</div>
                                <div className="text-xs text-muted-foreground">
                                  ${formatNumber(costGenerated, 0)} generados
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-sm text-gray-500">Sin registros</div>
                                <div className="text-xs text-gray-400">En este período</div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No hay personal asignado al proyecto
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Análisis Mensual Detallado
              </CardTitle>
              <CardDescription className="text-xs">
                Distribución mensual de actividades y costos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-blue-700">
                    {formatNumber(timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0), 1)}h
                  </div>
                  <div className="text-xs text-blue-600">Horas Trabajadas</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-green-700">
                    {timeEntries.filter(entry => entry.personnelId).length}
                  </div>
                  <div className="text-xs text-green-600">Registros de Tiempo</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-purple-700">
                    {timeByPersonnelData.filter(p => p.hours > 0).length}
                  </div>
                  <div className="text-xs text-purple-600">Miembros Activos</div>
                </div>
              </div>
              
              {timeEntries.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="text-sm text-yellow-800">
                    <strong>Información:</strong> No hay registros de tiempo para el período seleccionado.
                    {timeFilter !== "all" && " Prueba seleccionar 'Todo el proyecto' para ver la actividad completa."}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectAnalytics;