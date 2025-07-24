import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, TrendingUp, TrendingDown, Users, DollarSign, Target, Zap, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface DeviationAnalysisProps {
  projectId: number;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
  timeFilter?: string;
  onNavigateToTab?: (tabValue: string) => void;
}

interface Deviation {
  personnelId: number;
  budgetedHours: number;
  actualHours: number;
  budgetedCost: number;
  actualCost: number;
  hourDeviation: number;
  costDeviation: number;
  deviationPercentage: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

interface DeviationAnalysisData {
  deviationByRole: Deviation[];
  totalVariance: {
    variance: number;
  };
  summary: {
    membersOverBudget: number;
    membersUnderBudget: number;
  };
  majorDeviations: Deviation[];
  analysis: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
}

export function DeviationAnalysis({ projectId, dateFilter, timeFilter, onNavigateToTab }: DeviationAnalysisProps) {
  
  // Preferir timeFilter sobre dateFilter para consistencia con el sistema
  const queryParams = timeFilter 
    ? `?timeFilter=${timeFilter}`
    : dateFilter 
    ? `?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
    : '';

  console.log(`🔍🔍🔍 DeviationAnalysis - ProjectId: ${projectId}, TimeFilter: ${timeFilter}, DateFilter:`, dateFilter, `URL: /api/projects/${projectId}/deviation-analysis${queryParams}`);
    
  const { data: deviationData, isLoading, error } = useQuery<DeviationAnalysisData>({
    queryKey: [`/api/projects/${projectId}/deviation-analysis`, timeFilter || dateFilter],
    queryFn: async () => {
      console.log(`🌐 Making request to: /api/projects/${projectId}/deviation-analysis${queryParams}`);
      const response = await fetch(`/api/projects/${projectId}/deviation-analysis${queryParams}`);
      console.log(`🔥 Response status:`, response.status);
      const data = await response.json();
      console.log(`📊 Response data:`, data);
      return data;
    },
    enabled: !!projectId
  });

  // Función para determinar a qué pestaña navegar según el tipo de alerta
  const getNavigationTab = (alertType: string) => {
    switch (alertType) {
      case 'critical_deviations':
      case 'high_variance':
      case 'team_efficiency':
        return 'team-analysis'; // Navegar a Análisis de Equipo
      case 'budget_overrun':
      case 'efficiency_opportunity':
        return 'details'; // Navegar a Análisis Mensual
      case 'scope_change':
        return 'time-management'; // Navegar a Registro de Tiempo
      default:
        return 'team-analysis'; // Por defecto ir a Análisis de Equipo
    }
  };

  const handleAlertClick = (alertType: string) => {
    if (onNavigateToTab) {
      const targetTab = getNavigationTab(alertType);
      onNavigateToTab(targetTab);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Análisis de Desviaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Verificar si no hay datos o si los datos están vacíos
  // Debug logs para verificar datos
  console.log('🔍 DeviationAnalysis - Datos recibidos:', deviationData);
  if (deviationData?.deviationByRole) {
    // Usar la misma lógica inteligente del backend: desviación >50% Y horas significativas trabajadas
    const criticalCount = deviationData.deviationByRole.filter(d => {
      const absDeviation = Math.abs(d.deviationPercentage);
      const minHoursThreshold = d.budgetedHours * 0.3;
      return absDeviation > 50 && d.actualHours > minHoursThreshold;
    }).length;
    console.log('🚨 DeviationAnalysis - Críticas calculadas (lógica inteligente):', criticalCount);
    console.log('🚨 DeviationAnalysis - Miembros con horas:', deviationData.deviationByRole.filter(d => d.actualHours > 0));
  }

  if (!deviationData || !deviationData.deviationByRole || deviationData.deviationByRole.length === 0) {
    return (
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Análisis Detallado de Desviaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No hay registros de tiempo para el período seleccionado</p>
            <p className="text-sm text-gray-400 mt-1">
              El análisis aparecerá cuando haya entradas de tiempo en el rango de fechas elegido
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getVarianceColor = (percentage: number) => {
    if (Math.abs(percentage) < 10) return "text-green-600";
    if (Math.abs(percentage) < 25) return "text-yellow-600";
    return "text-red-600";
  };

  const getVarianceBadge = (percentage: number, actualHours: number, budgetedHours: number) => {
    // Si no hay horas registradas, mostrar estado especial
    if (actualHours === 0) {
      return { 
        variant: 'secondary' as const, 
        label: 'Sin Actividad',
        className: 'bg-gray-400 text-white'
      };
    }

    const absPercentage = Math.abs(percentage);
    const minHoursThreshold = budgetedHours * 0.3;
    
    // Lógica clara y descriptiva de clasificación - igual que en team-deviation-analysis
    if (absPercentage > 50 && actualHours > minHoursThreshold) {
      // Sobrecosto crítico: trabajó mucho Y excedió presupuesto significativamente
      return { 
        variant: "destructive" as const, 
        label: "Sobrecosto Crítico",
        className: "bg-red-500 text-white border-red-600 hover:bg-red-600"
      };
    } else if (absPercentage > 50 && actualHours <= minHoursThreshold) {
      // Subrendimiento: gran desviación pero por trabajar muy poco
      return { 
        variant: 'secondary' as const, 
        label: 'Subrendimiento',
        className: 'bg-purple-500 text-white border-purple-600 hover:bg-purple-600'
      };
    } else if (absPercentage >= 25) {
      // Alto riesgo: desviación considerable
      return { 
        variant: "outline" as const, 
        label: "Alto Riesgo",
        className: "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
      };
    } else if (absPercentage >= 10) {
      return { 
        variant: "secondary" as const, 
        label: "Atención",
        className: "bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-600"
      };
    } else {
      return { 
        variant: "default" as const, 
        label: "Normal",
        className: "bg-green-500 text-white border-green-600 hover:bg-green-600"
      };
    }
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Análisis Detallado de Desviaciones
          </div>
          <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">
            {(() => {
              // Usar la misma lógica inteligente del backend: desviación >50% Y horas significativas trabajadas
              const criticalCount = deviationData.deviationByRole.filter(d => {
                const absDeviation = Math.abs(d.deviationPercentage);
                const minHoursThreshold = d.budgetedHours * 0.3;
                return absDeviation > 50 && d.actualHours > minHoursThreshold;
              }).length;
              console.log('🎯 BADGE DeviationAnalysis - Críticas en badge (lógica inteligente):', criticalCount);
              return criticalCount;
            })()} Desviaciones Críticas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Métricas Claras y Comprensibles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sobrecosto Total */}
          {(() => {
            // Calcular el porcentaje de desviación para determinar severidad
            const variancePercentage = deviationData.totalVariance.adjustedBudget > 0 
              ? (deviationData.totalVariance.variance / deviationData.totalVariance.adjustedBudget) * 100
              : 0;
            
            // Usar los mismos umbrales que el dashboard principal
            let bgColor = 'bg-gradient-to-br from-green-50 to-green-100 border-green-200';
            let iconBgColor = 'bg-green-200';
            let iconColor = 'text-green-700';
            let textColor = 'text-green-800';
            let badgeClass = 'bg-green-500 text-white';
            let statusText = 'Ahorro';
            
            if (deviationData.totalVariance.variance > 0) {
              // Es sobrecosto - evaluar severidad según porcentaje
              if (variancePercentage <= 10) {
                // Regular (≤10% sobrecosto)
                bgColor = 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200';
                iconBgColor = 'bg-yellow-200';
                iconColor = 'text-yellow-700';
                textColor = 'text-yellow-800';
                badgeClass = 'bg-yellow-500 text-white';
                statusText = 'Regular';
              } else {
                // Crítico (>10% sobrecosto)
                bgColor = 'bg-gradient-to-br from-red-50 to-red-100 border-red-200';
                iconBgColor = 'bg-red-200';
                iconColor = 'text-red-700';
                textColor = 'text-red-800';
                badgeClass = 'bg-red-500 text-white';
                statusText = 'Crítico';
              }
            }
            
            return (
              <div className={`p-5 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${bgColor}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${iconBgColor}`}>
                    {deviationData.totalVariance.variance > 0 ? (
                      <AlertCircle className={`h-5 w-5 ${iconColor}`} />
                    ) : (
                      <CheckCircle2 className={`h-5 w-5 ${iconColor}`} />
                    )}
                  </div>
                  <Badge className={`text-xs ${badgeClass}`}>
                    {statusText}
                  </Badge>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-medium ${textColor}`}>
                      {deviationData.totalVariance.variance > 0 ? 'Sobrecosto Total' : 'Ahorro Total'}
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2">
                            <p className="text-sm">
                              La varianza es la diferencia entre el costo real y el presupuesto estimado.
                            </p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p>• <span className="text-green-600">Negativo: Ahorro</span></p>
                              <p>• <span className="text-yellow-600">0-10%: Regular</span></p>
                              <p>• <span className="text-red-600">&gt;10%: Crítico</span></p>
                            </div>
                            <p className="text-xs text-gray-500 pt-1">
                              Varianza actual: {variancePercentage.toFixed(1)}%
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className={`text-2xl font-bold mb-1 ${textColor}`}>
                    ${Math.abs(deviationData.totalVariance.variance).toLocaleString('es-AR', { 
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    })}
                  </p>
                  <p className={`text-xs ${textColor.replace('800', '600')}`}>
                    vs. presupuesto planificado ({variancePercentage > 0 ? '+' : ''}{variancePercentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Miembros con Sobrecosto */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-orange-200 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-700" />
              </div>
              <Badge variant="outline" className="bg-orange-500 text-white text-xs">
                Riesgo
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-orange-800 mb-1">
                Miembros con Sobrecosto
              </h3>
              <p className="text-2xl font-bold text-orange-900 mb-1">
                {deviationData.summary.membersOverBudget}
              </p>
              <p className="text-xs text-orange-600">
                de {deviationData.deviationByRole.length} miembros totales
              </p>
            </div>
          </div>

          {/* Miembros Eficientes */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-200 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-emerald-700" />
              </div>
              <Badge variant="secondary" className="bg-emerald-500 text-white text-xs">
                Eficiente
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-emerald-800 mb-1">
                Miembros Eficientes
              </h3>
              <p className="text-2xl font-bold text-emerald-900 mb-1">
                {deviationData.summary.membersUnderBudget}
              </p>
              <p className="text-xs text-emerald-600">
                por debajo del presupuesto
              </p>
            </div>
          </div>

          {/* Críticos que Requieren Atención */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-red-200 p-2 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <Badge variant="destructive" className="bg-red-600 text-white text-xs">
                Urgente
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800 mb-1">
                Casos Críticos
              </h3>
              <p className="text-2xl font-bold text-red-900 mb-1">
                {(() => {
                  const criticalCount = deviationData.deviationByRole.filter(d => {
                    const absDeviation = Math.abs(d.deviationPercentage);
                    const minHoursThreshold = d.budgetedHours * 0.3;
                    return absDeviation > 50 && d.actualHours > minHoursThreshold;
                  }).length;
                  return criticalCount;
                })()}
              </p>
              <p className="text-xs text-red-600">
                requieren acción inmediata
              </p>
            </div>
          </div>
        </div>

        {/* Métricas de Desempeño del Equipo */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">Métricas de Desempeño del Equipo</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Resumen del rendimiento del equipo basado en el uso del presupuesto y las desviaciones detectadas.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {(() => {
              const efficiency = ((deviationData.summary.membersUnderBudget / deviationData.deviationByRole.length) * 100);
              const criticalCount = deviationData.deviationByRole.filter(d => {
                const absDeviation = Math.abs(d.deviationPercentage);
                const minHoursThreshold = d.budgetedHours * 0.3;
                return absDeviation > 50 && d.actualHours > minHoursThreshold;
              }).length;
              
              let status = 'Saludable';
              let statusColor = 'bg-green-500';
              let textColor = 'text-green-800';
              
              if (criticalCount > 2 || deviationData.totalVariance.variance > 5000) {
                status = 'Crítico';
                statusColor = 'bg-red-500';
                textColor = 'text-red-800';
              } else if (criticalCount > 0 || deviationData.summary.membersOverBudget > deviationData.summary.membersUnderBudget) {
                status = 'Requiere Atención';
                statusColor = 'bg-yellow-500';
                textColor = 'text-yellow-800';
              }
              
              return (
                <Badge className={`${statusColor} text-white px-3 py-1 text-sm font-medium`}>
                  {status}
                </Badge>
              );
            })()}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="text-2xl font-bold text-gray-800">
                  {(() => {
                    const totalBudgetedHours = deviationData.deviationByRole.reduce((sum, d) => sum + d.budgetedHours, 0);
                    const totalActualHours = deviationData.deviationByRole.reduce((sum, d) => sum + d.actualHours, 0);
                    return totalBudgetedHours > 0 ? Math.round((totalActualHours / totalBudgetedHours) * 100) : 0;
                  })()}%
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        Porcentaje de horas trabajadas vs horas presupuestadas totales del equipo
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-sm text-gray-600">Avance en Horas</div>
              <Progress 
                value={(() => {
                  const totalBudgetedHours = deviationData.deviationByRole.reduce((sum, d) => sum + d.budgetedHours, 0);
                  const totalActualHours = deviationData.deviationByRole.reduce((sum, d) => sum + d.actualHours, 0);
                  return totalBudgetedHours > 0 ? (totalActualHours / totalBudgetedHours) * 100 : 0;
                })()} 
                className="mt-2 h-2"
              />
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="text-2xl font-bold text-gray-800">
                  {(() => {
                    const avgDeviation = deviationData.deviationByRole
                      .filter(d => d.actualHours > 0)
                      .reduce((sum, d) => sum + Math.abs(d.deviationPercentage), 0) / 
                      deviationData.deviationByRole.filter(d => d.actualHours > 0).length;
                    return Math.round(avgDeviation) || 0;
                  })()}%
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        Promedio de desviación del presupuesto por persona (sin importar si es positiva o negativa)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-sm text-gray-600">Desviación Promedio</div>
              <div className={`mt-2 h-2 rounded-full bg-gray-200`}>
                <div className={`h-full rounded-full ${
                  (() => {
                    const avgDev = deviationData.deviationByRole
                      .filter(d => d.actualHours > 0)
                      .reduce((sum, d) => sum + Math.abs(d.deviationPercentage), 0) / 
                      deviationData.deviationByRole.filter(d => d.actualHours > 0).length;
                    return avgDev < 25 ? 'bg-green-500' : avgDev < 50 ? 'bg-yellow-500' : 'bg-red-500';
                  })()
                }`} style={{width: `${Math.min(100, (() => {
                  const avgDev = deviationData.deviationByRole
                    .filter(d => d.actualHours > 0)
                    .reduce((sum, d) => sum + Math.abs(d.deviationPercentage), 0) / 
                    deviationData.deviationByRole.filter(d => d.actualHours > 0).length;
                  return avgDev || 0;
                })())}%`}}></div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="text-xl font-bold text-red-600">
                  {(() => {
                    // Encontrar la persona con mayor sobrecosto crítico
                    const criticalPeople = deviationData.deviationByRole
                      .filter(d => {
                        const absDeviation = Math.abs(d.deviationPercentage);
                        const minHoursThreshold = d.budgetedHours * 0.3;
                        return absDeviation > 50 && d.actualHours > minHoursThreshold && d.costDeviation > 0;
                      })
                      .sort((a, b) => b.costDeviation - a.costDeviation);
                    
                    if (criticalPeople.length > 0) {
                      const mostCritical = criticalPeople[0];
                      return mostCritical.personnelName;
                    }
                    return 'Sin casos críticos';
                  })()}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Persona con el mayor sobrecosto en términos absolutos que requiere atención inmediata
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-sm text-gray-600">Caso Más Crítico</div>
              <div className="mt-2 text-xs text-red-500">
                {(() => {
                  const criticalPeople = deviationData.deviationByRole
                    .filter(d => {
                      const absDeviation = Math.abs(d.deviationPercentage);
                      const minHoursThreshold = d.budgetedHours * 0.3;
                      return absDeviation > 50 && d.actualHours > minHoursThreshold && d.costDeviation > 0;
                    })
                    .sort((a, b) => b.costDeviation - a.costDeviation);
                  
                  if (criticalPeople.length > 0) {
                    const mostCritical = criticalPeople[0];
                    return `+$${Math.round(mostCritical.costDeviation).toLocaleString()} de sobrecosto`;
                  }
                  return 'Equipo bajo control';
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Recomendaciones y Análisis Inteligente */}
        {deviationData.analysis && deviationData.analysis.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Recomendaciones del Sistema</h3>
            </div>
            
            <div className="space-y-3">
              {deviationData.analysis
                .sort((a, b) => {
                  const severityOrder: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
                  return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
                })
                .map((item, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
                    item.severity === 'high' 
                      ? 'bg-red-50 border-l-red-500 hover:bg-red-100' 
                      : item.severity === 'medium' 
                      ? 'bg-yellow-50 border-l-yellow-500 hover:bg-yellow-100'
                      : 'bg-green-50 border-l-green-500 hover:bg-green-100'
                  }`}
                  onClick={() => handleAlertClick(item.type)}
                  title="Haz clic para ver más detalles"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          item.severity === 'high' ? 'bg-red-500' : 
                          item.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}>
                          {item.severity === 'high' ? '!' : item.severity === 'medium' ? '⚠' : '✓'}
                        </div>
                        <h4 className={`font-semibold ${
                          item.severity === 'high' ? 'text-red-800' : 
                          item.severity === 'medium' ? 'text-yellow-800' : 'text-green-800'
                        }`}>
                          {item.type === 'budget_overrun' ? 'Sobrecosto Detectado' : 
                           item.type === 'team_efficiency' ? 'Revisar Eficiencia del Equipo' : 
                           item.type === 'critical_deviations' ? 'Miembros Requieren Atención Urgente' :
                           item.type === 'efficiency_opportunity' ? 'Oportunidad de Optimización' :
                           item.type === 'high_variance' ? 'Variabilidad Alta en Costos' :
                           item.type === 'scope_change' ? 'Posible Cambio de Alcance' : 'Análisis'}
                        </h4>
                      </div>
                      <p className={`text-sm leading-relaxed ${
                        item.severity === 'high' ? 'text-red-700' : 
                        item.severity === 'medium' ? 'text-yellow-700' : 'text-green-700'
                      }`}>
                        {item.message}
                      </p>
                      <div className="mt-2 text-xs text-gray-600">
                        <span>💡 Haz clic para navegar a los detalles</span>
                      </div>
                    </div>
                    <Badge 
                      variant={item.severity === 'high' ? 'destructive' : item.severity === 'medium' ? 'outline' : 'secondary'} 
                      className={`text-xs px-3 py-1 font-medium ${
                        item.severity === 'high' ? 'bg-red-500 text-white' : 
                        item.severity === 'medium' ? 'bg-yellow-500 text-white' : 
                        'bg-green-500 text-white'
                      }`}
                    >
                      {item.severity === 'high' ? 'Urgente' : item.severity === 'medium' ? 'Importante' : 'Informativo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Resumen de acciones */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Siguiente paso recomendado:</strong> Revisar los casos críticos en la pestaña de análisis de equipo para tomar acciones correctivas.
              </p>
            </div>
          </div>
        )}





      </CardContent>
    </Card>
  );
}