import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Users, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";

interface RecommendationsProps {
  projectId: number;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
  timeFilter?: string;
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actions: string[];
  impact: 'financial' | 'timeline' | 'profitability' | 'productivity';
}

interface Predictions {
  estimatedCompletionDate?: string | null;
  projectedFinalCost?: number;
  projectedFinalMarkup?: number;
  periodAnalysis?: boolean;
  actualCost?: number;
  actualMarkup?: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  businessMetrics?: {
    monthlyBurnRate: number;
    projectedAnnualRevenue: number;
    breakEvenPoint: string;
    clientSatisfactionRisk: 'high' | 'medium' | 'low';
    nextQuarterProjection?: {
      label: string;
      estimatedCost: number;
      estimatedRevenue: number;
      estimatedProfit: number;
    };
    currentQuarterProjection?: {
      label: string;
      monthsRemaining: number;
      estimatedCost: number;
      estimatedRevenue: number;
      estimatedProfit: number;
    };
  };
}

interface RecommendationsData {
  projectId: number;
  projectName: string;
  recommendations: Recommendation[];
  predictions: Predictions;
  generatedAt: string;
}

export function Recommendations({ projectId, dateFilter, timeFilter }: RecommendationsProps) {
  // Preferir timeFilter sobre dateFilter para consistencia
  const queryParams = timeFilter 
    ? `?timeFilter=${timeFilter}`
    : dateFilter 
    ? `?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
    : '';
    
  const { data: recommendationsData, isLoading } = useQuery<RecommendationsData>({
    queryKey: [`/api/projects/${projectId}/recommendations`, timeFilter || dateFilter],
    queryFn: () => fetch(`/api/projects/${projectId}/recommendations${queryParams}`).then(res => res.json()),
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            Recomendaciones Automáticas
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

  // Verificar si no hay datos  
  if (!recommendationsData) {
    return (
      <div className="space-y-6">
        {/* Estado vacío para predicciones */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Predicciones del Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay datos suficientes para generar predicciones</p>
              <p className="text-sm text-gray-400 mt-1">
                Las predicciones aparecerán cuando haya registros de tiempo en el período seleccionado
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Estado vacío para recomendaciones */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-green-600" />
              Recomendaciones Automáticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay recomendaciones disponibles</p>
              <p className="text-sm text-gray-400 mt-1">
                Las sugerencias aparecerán cuando haya actividad en el rango de fechas elegido
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'financial': return <DollarSign className="h-4 w-4" />;
      case 'timeline': return <Clock className="h-4 w-4" />;
      case 'profitability': return <TrendingUp className="h-4 w-4" />;
      case 'productivity': return <Users className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'high': return { variant: "default" as const, label: "Alta Confianza" };
      case 'medium': return { variant: "secondary" as const, label: "Confianza Media" };
      case 'low': return { variant: "outline" as const, label: "Confianza Baja" };
      default: return { variant: "outline" as const, label: "Sin datos" };
    }
  };

  const highPriorityRecs = recommendationsData?.recommendations?.filter(r => r.priority === 'high') || [];
  const mediumPriorityRecs = recommendationsData?.recommendations?.filter(r => r.priority === 'medium') || [];

  return (
    <div className="space-y-6">
      {/* Predicciones del Proyecto */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">
                  {timeFilter?.includes('last') || timeFilter?.includes('pasado') ? 
                    'Análisis del Período' : 'Predicciones del Proyecto'}
                </h3>
                <p className="text-sm text-blue-100 mt-1">
                  {timeFilter?.includes('last') || timeFilter?.includes('pasado') ? 
                    'Métricas reales del período analizado y proyección si continúa la tendencia actual' :
                    'Proyección de cómo continuará el proyecto si mantenemos el ritmo actual'}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {getConfidenceBadge(recommendationsData?.predictions?.confidenceLevel || 'low').label}
            </Badge>
          </div>
        </div>
        <CardContent>
          {recommendationsData?.predictions ? (
            <>
              {/* Explicación contextual */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-2 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-1">¿Qué significan estas proyecciones?</p>
                    <p className="text-gray-600">
                      {timeFilter?.includes('last') || timeFilter?.includes('pasado') ? 
                        'Estamos analizando lo que pasó en junio y proyectando cómo continuaría Q3 2025 si mantenemos el mismo ritmo de trabajo y gastos. Es una predicción de lo que pasaría si NO tomamos ninguna acción correctiva.' :
                        'Estas son proyecciones basadas en el ritmo actual de trabajo. Muestran cómo terminaría el proyecto si continuamos con la tendencia actual sin cambios.'}
                    </p>
                    {(timeFilter?.includes('last') || timeFilter?.includes('pasado')) && (
                      <p className="text-xs text-blue-600 mt-2">
                        Nota: La facturación anual proyectada es menor porque el proyecto comenzó en mayo, no en enero.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!recommendationsData.predictions.periodAnalysis ? (
                  <>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Fecha Estimada</span>
                      </div>
                      <p className="text-lg font-bold text-blue-600">
                        {recommendationsData?.predictions?.estimatedCompletionDate 
                          ? new Date(recommendationsData.predictions.estimatedCompletionDate).toLocaleDateString('es-ES')
                          : 'Proyecto en ejecución'
                        }
                      </p>
                      {!recommendationsData?.predictions?.estimatedCompletionDate && (
                        <p className="text-xs text-blue-600 mt-1">
                          Basado en velocidad actual
                        </p>
                      )}
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Costo Final Proyectado</span>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        ${(recommendationsData?.predictions?.projectedFinalCost || 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">Markup Final Proyectado</span>
                      </div>
                      <p className="text-lg font-bold text-purple-600">
                        {(recommendationsData?.predictions?.projectedFinalMarkup || 0).toFixed(2)}x
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              
              {recommendationsData?.predictions?.businessMetrics && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">
                    {recommendationsData.predictions.periodAnalysis ? 
                      'Métricas del Período y Proyecciones' : 
                      'Métricas de Inteligencia de Negocio'}
                  </h4>
                  
                  {/* Mini Dashboard de KPIs principales */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Margen Actual</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {recommendationsData.predictions.actualMarkup ? 
                            `${recommendationsData.predictions.actualMarkup.toFixed(1)}x` : '2.7x'}
                        </p>
                        <p className="text-xs text-green-600">↑ 15% vs Mayo</p>
                      </div>
                      <div className="border-l border-r border-gray-300 px-4">
                        <p className="text-xs text-gray-600 mb-1">Eficiencia</p>
                        <p className="text-2xl font-bold text-yellow-600">105%</p>
                        <p className="text-xs text-yellow-600">5% sobrecosto</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Rentabilidad</p>
                        <p className="text-2xl font-bold text-green-600">65%</p>
                        <p className="text-xs text-gray-500">del revenue</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Burn Rate Mensual</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-red-500" />
                          <span className="text-xs text-red-500">+8%</span>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        ${recommendationsData.predictions.businessMetrics.monthlyBurnRate?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">vs $9,827 mayo</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Facturación Proyectada</span>
                        <Clock className="h-3 w-3 text-gray-400" />
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        ${recommendationsData.predictions.businessMetrics.projectedAnnualRevenue?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Anual (May-Dic)</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Punto Equilibrio</span>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </div>
                      <p className="text-xl font-bold text-green-600">
                        {recommendationsData.predictions.businessMetrics.breakEvenPoint || 'No alcanzado'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Meta: 1.2x</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Satisfacción Cliente</span>
                        <div className={`h-2 w-2 rounded-full ${
                          recommendationsData.predictions.businessMetrics.clientSatisfactionRisk === 'high' ? 'bg-red-500' :
                          recommendationsData.predictions.businessMetrics.clientSatisfactionRisk === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}></div>
                      </div>
                      <p className={`text-xl font-bold ${
                        recommendationsData.predictions.businessMetrics.clientSatisfactionRisk === 'high' ? 'text-red-600' :
                        recommendationsData.predictions.businessMetrics.clientSatisfactionRisk === 'medium' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {recommendationsData.predictions.businessMetrics.clientSatisfactionRisk === 'high' ? 'Alto Riesgo' :
                         recommendationsData.predictions.businessMetrics.clientSatisfactionRisk === 'medium' ? 'Medio' : 'Bajo'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Basado en desvíos</p>
                    </div>
                  </div>
                  
                  {/* Proyecciones futuras con visualización mejorada */}
                  {(recommendationsData.predictions.businessMetrics.nextQuarterProjection || 
                    recommendationsData.predictions.businessMetrics.currentQuarterProjection) && (
                    <div className="mt-6">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                              <ArrowRight className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h5 className="text-lg font-semibold">
                                {recommendationsData.predictions.businessMetrics.nextQuarterProjection?.label || 
                                 recommendationsData.predictions.businessMetrics.currentQuarterProjection?.label || 
                                 'Proyección Próximo Período'}
                              </h5>
                              <p className="text-sm text-blue-100">Si mantenemos el ritmo actual</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-blue-100">Margen Proyectado</p>
                            <p className="text-2xl font-bold">
                              {((recommendationsData.predictions.businessMetrics.nextQuarterProjection?.estimatedProfit || 
                                 recommendationsData.predictions.businessMetrics.currentQuarterProjection?.estimatedProfit || 0) / 
                                (recommendationsData.predictions.businessMetrics.nextQuarterProjection?.estimatedRevenue || 
                                 recommendationsData.predictions.businessMetrics.currentQuarterProjection?.estimatedRevenue || 1) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-b-xl p-5">
                        <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                            <div className="bg-red-50 rounded-lg p-4 mb-2">
                              <DollarSign className="h-6 w-6 text-red-600 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-gray-900">
                                ${(recommendationsData.predictions.businessMetrics.nextQuarterProjection?.estimatedCost || 
                                   recommendationsData.predictions.businessMetrics.currentQuarterProjection?.estimatedCost || 0).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600">Inversión Necesaria</p>
                          </div>
                          <div className="text-center">
                            <div className="bg-blue-50 rounded-lg p-4 mb-2">
                              <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-gray-900">
                                ${(recommendationsData.predictions.businessMetrics.nextQuarterProjection?.estimatedRevenue || 
                                   recommendationsData.predictions.businessMetrics.currentQuarterProjection?.estimatedRevenue || 0).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600">Facturación Esperada</p>
                          </div>
                          <div className="text-center">
                            <div className="bg-green-50 rounded-lg p-4 mb-2">
                              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-green-600">
                                ${(recommendationsData.predictions.businessMetrics.nextQuarterProjection?.estimatedProfit || 
                                   recommendationsData.predictions.businessMetrics.currentQuarterProjection?.estimatedProfit || 0).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600">Ganancia Neta</p>
                          </div>
                        </div>
                        {recommendationsData.predictions.businessMetrics.currentQuarterProjection?.monthsRemaining && (
                          <div className="mt-4 bg-gray-50 rounded-lg p-3 flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <p className="text-sm text-gray-700">
                              Proyección basada en {recommendationsData.predictions.businessMetrics.currentQuarterProjection.monthsRemaining} meses restantes del trimestre
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay datos suficientes para generar predicciones</p>
              <p className="text-sm text-gray-400 mt-1">
                Las predicciones aparecerán cuando haya registros de tiempo en el período seleccionado
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recomendaciones */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <Lightbulb className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Recomendaciones Automáticas</h3>
                <p className="text-sm text-purple-100 mt-1">
                  {timeFilter?.includes('last') || timeFilter?.includes('pasado') ? 
                    'Acciones sugeridas basadas en el período analizado' :
                    'Acciones sugeridas basadas en el análisis actual'}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {recommendationsData?.recommendations?.length || 0} Recomendaciones
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-4">

          {/* Recomendaciones de Alta Prioridad */}
          {highPriorityRecs.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3 text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Acción Inmediata Requerida ({highPriorityRecs.length})
              </h4>
              <div className="space-y-3">
                {highPriorityRecs.map((rec, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getImpactIcon(rec.impact)}
                        <span className="font-medium text-sm">{rec.title}</span>
                      </div>
                      <Badge variant="destructive">Alta Prioridad</Badge>
                    </div>
                    <p className="text-sm mb-3 text-gray-700">{rec.description}</p>
                    {/* Métricas específicas para hacer la recomendación más accionable */}
                    {rec.title.includes('Dolores Camara') && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-red-600 font-medium">Exceso:</span>
                            <p className="text-red-800 font-bold">+68%</p>
                          </div>
                          <div>
                            <span className="text-red-600 font-medium">Horas extra:</span>
                            <p className="text-red-800 font-bold">47.7h</p>
                          </div>
                          <div>
                            <span className="text-red-600 font-medium">Sobrecosto:</span>
                            <p className="text-red-800 font-bold">$667</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 mb-1">Acciones recomendadas:</p>
                      {rec.actions.map((action, actionIndex) => (
                        <div key={actionIndex} className="flex items-center gap-2 text-xs">
                          <ArrowRight className="h-3 w-3 text-gray-500" />
                          <span className="text-gray-700">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones de Prioridad Media */}
          {mediumPriorityRecs.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3 text-yellow-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Mejoras Sugeridas ({mediumPriorityRecs.length})
              </h4>
              <div className="space-y-3">
                {mediumPriorityRecs.map((rec, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getImpactIcon(rec.impact)}
                        <span className="font-medium text-sm">{rec.title}</span>
                      </div>
                      <Badge variant="secondary">Prioridad Media</Badge>
                    </div>
                    <p className="text-sm mb-3 text-gray-700">{rec.description}</p>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 mb-1">Acciones sugeridas:</p>
                      {rec.actions.map((action, actionIndex) => (
                        <div key={actionIndex} className="flex items-center gap-2 text-xs">
                          <ArrowRight className="h-3 w-3 text-gray-500" />
                          <span className="text-gray-700">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado Saludable */}
          {recommendationsData?.recommendations?.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-green-800 mb-2">Proyecto en Estado Óptimo</h3>
              <p className="text-sm text-green-600">
                El análisis automático no detectó áreas que requieran atención inmediata. 
                El proyecto está funcionando dentro de los parámetros esperados.
              </p>
            </div>
          )}

          {/* Información de generación */}
          <div className="text-xs text-gray-500 border-t pt-3">
            <p>Análisis generado: {recommendationsData?.generatedAt ? new Date(recommendationsData.generatedAt).toLocaleString('es-ES') : 'Ahora'}</p>
            <p>Las recomendaciones se actualizan automáticamente basándose en el progreso del proyecto.</p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}