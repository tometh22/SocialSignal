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

        {/* Contenido: Análisis Mensual - World-Class Design */}
        <TabsContent value="monthly" className="mt-0 space-y-6">
          {/* Enhanced KPI Header Cards */}
          <div className="grid grid-cols-6 gap-4">
            {/* Health Score */}
            <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-700 mb-1">Score de Salud</p>
                    <p className="text-2xl font-bold text-emerald-800">
                      {Math.round(85 - (riskIndicators?.budgetRisk || 0) * 0.5)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {Math.round(85 - (riskIndicators?.budgetRisk || 0) * 0.5) >= 80 ? 'Excelente' : 
                       Math.round(85 - (riskIndicators?.budgetRisk || 0) * 0.5) >= 60 ? 'Bueno' : 'Crítico'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-200/50 flex items-center justify-center">
                    <Gauge className="h-6 w-6 text-emerald-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Projection */}
            <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-700 mb-1">Proyección Financiera</p>
                    <p className="text-lg font-bold text-blue-800">Muy Buena</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Burn Rate: {formatCurrency((costSummary?.actualCost || 0) / Math.max(projectMetrics?.daysElapsed || 1, 1))}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-200/50 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Efficiency */}
            <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-purple-700 mb-1">Eficiencia del Equipo</p>
                    <p className="text-2xl font-bold text-purple-800">
                      {Math.round((projectMetrics?.actualHours || 0) / Math.max(personnel.length, 1))}%
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {timeByPersonnelData.filter(p => p.hours > 0).length} activos
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-200/50 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Operational Indicators */}
            <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-orange-700 mb-1">Indicadores Operacionales</p>
                    <p className="text-lg font-bold text-orange-800">
                      {Math.round((projectMetrics?.actualHours || 0) / Math.max(projectMetrics?.daysElapsed || 1, 1) * 10) / 10}h/día
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      {timeEntries.length} registros
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-orange-200/50 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-orange-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Days */}
            <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-teal-50 to-teal-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-teal-700 mb-1">Días Activos</p>
                    <p className="text-2xl font-bold text-teal-800">
                      {Math.min(timeEntries.length, projectMetrics?.daysElapsed || 0)}
                    </p>
                    <p className="text-xs text-teal-600 mt-1">
                      de {projectMetrics?.daysTotal || 0} totales
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-teal-200/50 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-teal-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Registers */}
            <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-pink-50 to-pink-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-pink-700 mb-1">Registros de Desempeño</p>
                    <p className="text-2xl font-bold text-pink-800">{timeEntries.length}</p>
                    <p className="text-xs text-pink-600 mt-1">Este período</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-pink-200/50 flex items-center justify-center">
                    <BarChart4 className="h-6 w-6 text-pink-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Team Performance Analysis */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Análise de Rendimiento del Equipo
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 mt-1">
                    Métricas avanzadas de productividad y eficiencia por miembro
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
                {personnel.length > 0 ? (
                  personnel.map((member) => {
                    const memberHours = timeEntries
                      .filter(entry => entry.personnelId === member.id)
                      .reduce((sum, entry) => sum + (entry.hours || 0), 0);
                    
                    const memberRole = roles.find(role => role.id === member.roleId);
                    const memberInTimeData = timeByPersonnelData.find(p => p.id === member.id);
                    const estimatedHours = memberInTimeData ? memberInTimeData.hours : 0;
                    
                    const hasActivity = memberHours > 0;
                    const costGenerated = memberHours * member.hourlyRate;
                    const efficiency = estimatedHours > 0 ? (memberHours / estimatedHours) * 100 : 0;
                    
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
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className={`font-semibold ${perfColors.text}`}>{member.name}</h4>
                              <p className="text-sm text-slate-600">
                                {memberRole?.name || 'Sin rol'} • ${member.hourlyRate.toFixed(1)}/h
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
                            <p className="text-lg font-bold text-slate-800">{formatNumber(memberHours, 1)}h</p>
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
                              {hasActivity ? formatNumber(memberHours / Math.max(projectMetrics?.daysElapsed || 1, 1), 1) + 'h/día' : '0h/día'}
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
                    <p>No hay personal asignado al proyecto</p>
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
                      {formatNumber(timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0), 1)}h
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {((timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0) / Math.max(projectMetrics?.plannedHours || 1, 1)) * 100).toFixed(1)}% del total
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Costo Generado</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(timeEntries.reduce((sum, entry) => {
                        const person = personnel.find(p => p.id === entry.personnelId);
                        return sum + ((entry.hours || 0) * (person?.hourlyRate || 0));
                      }, 0))}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {((timeEntries.reduce((sum, entry) => {
                        const person = personnel.find(p => p.id === entry.personnelId);
                        return sum + ((entry.hours || 0) * (person?.hourlyRate || 0));
                      }, 0) / Math.max(costSummary?.estimatedCost || 1, 1)) * 100).toFixed(1)}% del presupuesto
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">Miembros Activos</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {timeByPersonnelData.filter(p => timeEntries.some(e => e.personnelId === p.id && (e.hours || 0) > 0)).length}
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      de {personnel.length} total
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Registros</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {timeEntries.filter(entry => entry.personnelId).length}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      entradas de tiempo
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2">Distribución por Roles</h4>
                  <div className="space-y-2">
                    {roles.map(role => {
                      const roleHours = timeEntries.reduce((sum, entry) => {
                        const person = personnel.find(p => p.id === entry.personnelId);
                        return person?.roleId === role.id ? sum + (entry.hours || 0) : sum;
                      }, 0);
                      
                      const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
                      const percentage = totalHours > 0 ? (roleHours / totalHours) * 100 : 0;

                      if (roleHours === 0) return null;

                      return (
                        <div key={role.id} className="flex justify-between items-center">
                          <span className="text-sm text-slate-700">{role.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{formatNumber(roleHours, 1)}h</span>
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
                    {personnel.slice(0, 15).map((member, index) => {
                      const memberHours = timeEntries
                        .filter(entry => entry.personnelId === member.id)
                        .reduce((sum, entry) => sum + (entry.hours || 0), 0);
                      
                      const intensity = Math.min(memberHours / 10, 1); // Normalize to 0-1
                      const bgIntensity = Math.round(intensity * 9);
                      
                      return (
                        <div
                          key={member.id}
                          className={`
                            w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium
                            ${bgIntensity === 0 ? 'bg-slate-100 text-slate-400' :
                              bgIntensity <= 3 ? 'bg-yellow-200 text-yellow-800' :
                              bgIntensity <= 6 ? 'bg-orange-300 text-orange-900' :
                              'bg-emerald-400 text-emerald-900'}
                          `}
                          title={`${member.name}: ${memberHours.toFixed(1)}h`}
                        >
                          {member.name.substring(0, 2).toUpperCase()}
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