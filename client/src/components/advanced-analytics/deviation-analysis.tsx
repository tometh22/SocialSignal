import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, TrendingDown, Users, DollarSign, Target, Zap, CheckCircle2, AlertCircle } from "lucide-react";

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
          <div className={`p-5 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${
            deviationData.totalVariance.variance > 0 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' 
              : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${
                deviationData.totalVariance.variance > 0 ? 'bg-red-200' : 'bg-green-200'
              }`}>
                {deviationData.totalVariance.variance > 0 ? (
                  <AlertCircle className="h-5 w-5 text-red-700" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                )}
              </div>
              <Badge 
                variant={deviationData.totalVariance.variance > 0 ? "destructive" : "secondary"}
                className={`text-xs ${
                  deviationData.totalVariance.variance > 0 
                    ? 'bg-red-500 text-white' 
                    : 'bg-green-500 text-white'
                }`}
              >
                {deviationData.totalVariance.variance > 0 ? 'Sobrecosto' : 'Ahorro'}
              </Badge>
            </div>
            <div>
              <h3 className={`text-sm font-medium mb-1 ${
                deviationData.totalVariance.variance > 0 ? 'text-red-800' : 'text-green-800'
              }`}>
                {deviationData.totalVariance.variance > 0 ? 'Sobrecosto Total' : 'Ahorro Total'}
              </h3>
              <p className={`text-2xl font-bold mb-1 ${
                deviationData.totalVariance.variance > 0 ? 'text-red-900' : 'text-green-900'
              }`}>
                ${Math.abs(deviationData.totalVariance.variance).toLocaleString()}
              </p>
              <p className={`text-xs ${
                deviationData.totalVariance.variance > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                vs. presupuesto planificado
              </p>
            </div>
          </div>

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

        {/* Indicador de Salud del Proyecto */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">Estado General del Proyecto</h3>
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
              <div className="text-2xl font-bold text-gray-800 mb-1">
                {Math.round((deviationData.summary.membersUnderBudget / deviationData.deviationByRole.length) * 100)}%
              </div>
              <div className="text-sm text-gray-600">Eficiencia del Equipo</div>
              <Progress 
                value={(deviationData.summary.membersUnderBudget / deviationData.deviationByRole.length) * 100} 
                className="mt-2 h-2"
              />
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800 mb-1">
                {deviationData.deviationByRole.filter(d => d.actualHours > 0).length}
              </div>
              <div className="text-sm text-gray-600">Miembros Activos</div>
              <Progress 
                value={(deviationData.deviationByRole.filter(d => d.actualHours > 0).length / deviationData.deviationByRole.length) * 100} 
                className="mt-2 h-2"
              />
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800 mb-1">
                {Math.round(Math.abs(deviationData.totalVariance.variance / 1000))}K
              </div>
              <div className="text-sm text-gray-600">Variación Total (USD)</div>
              <div className={`mt-2 h-2 rounded-full ${
                deviationData.totalVariance.variance > 0 ? 'bg-red-200' : 'bg-green-200'
              }`}>
                <div className={`h-full rounded-full ${
                  deviationData.totalVariance.variance > 0 ? 'bg-red-500' : 'bg-green-500'
                } w-full`}></div>
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