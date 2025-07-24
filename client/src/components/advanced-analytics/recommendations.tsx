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
  estimatedCompletionDate: string | null;
  projectedFinalCost: number;
  projectedFinalMarkup: number;
  confidenceLevel: 'high' | 'medium' | 'low';
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

  // Verificar si no hay datos o si las recomendaciones están vacías  
  if (!recommendationsData || !recommendationsData.recommendations || recommendationsData.recommendations.length === 0) {
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

  const highPriorityRecs = recommendationsData.recommendations.filter(r => r.priority === 'high');
  const mediumPriorityRecs = recommendationsData.recommendations.filter(r => r.priority === 'medium');

  return (
    <div className="space-y-6">
      {/* Predicciones del Proyecto */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Predicciones del Proyecto
            </div>
            <Badge variant={getConfidenceBadge(recommendationsData.predictions.confidenceLevel).variant}>
              {getConfidenceBadge(recommendationsData.predictions.confidenceLevel).label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Fecha Estimada</span>
              </div>
              <p className="text-lg font-bold text-blue-600">
                {recommendationsData.predictions.estimatedCompletionDate 
                  ? new Date(recommendationsData.predictions.estimatedCompletionDate).toLocaleDateString('es-ES')
                  : 'No estimada'
                }
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Costo Final Proyectado</span>
              </div>
              <p className="text-lg font-bold text-green-600">
                ${recommendationsData.predictions.projectedFinalCost.toLocaleString()}
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Markup Final Proyectado</span>
              </div>
              <p className="text-lg font-bold text-purple-600">
                {recommendationsData.predictions.projectedFinalMarkup.toFixed(2)}x
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recomendaciones */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-green-600" />
              Recomendaciones Automáticas
            </div>
            <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
              {recommendationsData.recommendations.length} Recomendaciones
            </Badge>
          </CardTitle>
        </CardHeader>
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
          {recommendationsData.recommendations.length === 0 && (
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
            <p>Análisis generado: {new Date(recommendationsData.generatedAt).toLocaleString('es-ES')}</p>
            <p>Las recomendaciones se actualizan automáticamente basándose en el progreso del proyecto.</p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}