import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, TrendingUp, TrendingDown, Users, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface DeviationAnalysisProps {
  projectId: number;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
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

export function DeviationAnalysis({ projectId, dateFilter }: DeviationAnalysisProps) {
  const [criticalOpen, setCriticalOpen] = useState(true);
  const [teamAnalysisOpen, setTeamAnalysisOpen] = useState(false);
  
  const queryParams = dateFilter 
    ? `?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
    : '';

  console.log(`🔍🔍🔍 DeviationAnalysis - ProjectId: ${projectId}, DateFilter:`, dateFilter, `URL: /api/projects/${projectId}/deviation-analysis${queryParams}`);
    
  const { data: deviationData, isLoading, error } = useQuery<DeviationAnalysisData>({
    queryKey: [`/api/projects/${projectId}/deviation-analysis`, dateFilter],
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

  const getVarianceBadge = (percentage: number) => {
    if (Math.abs(percentage) < 10) return { variant: "default" as const, label: "Normal" };
    if (Math.abs(percentage) < 25) return { variant: "secondary" as const, label: "Atención" };
    return { variant: "destructive" as const, label: "Crítico" };
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
            {deviationData.majorDeviations.filter(d => d.severity === 'critical').length} Desviaciones Críticas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Resumen General */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Diferencia vs Presupuesto</span>
            </div>
            <p className="text-xl font-bold text-blue-600">
              ${Math.abs(deviationData.totalVariance.variance).toLocaleString()}
            </p>
            <p className="text-xs text-blue-600">
              {deviationData.totalVariance.variance > 0 ? "Por encima del presupuesto" : "Por debajo del presupuesto"}
            </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Exceden Presupuesto</span>
            </div>
            <p className="text-xl font-bold text-red-600">
              {deviationData.summary.membersOverBudget}
            </p>
            <p className="text-xs text-red-600">miembros del equipo</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Bajo Presupuesto</span>
            </div>
            <p className="text-xl font-bold text-green-600">
              {deviationData.summary.membersUnderBudget}
            </p>
            <p className="text-xs text-green-600">miembros del equipo</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Total Miembros</span>
            </div>
            <p className="text-xl font-bold text-purple-600">
              {deviationData.deviationByRole.length}
            </p>
            <p className="text-xs text-purple-600">analizados</p>
          </div>
        </div>

        {/* Análisis Automático */}
        {deviationData.analysis && deviationData.analysis.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 text-gray-700">Análisis Automático del Sistema</h4>
            <div className="space-y-2">
              {deviationData.analysis.map((item, index) => (
                <div key={index} className={`p-3 rounded-lg border ${
                  item.severity === 'high' ? 'bg-red-50 border-red-200' : 
                  item.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium text-sm ${
                      item.severity === 'high' ? 'text-red-800' : 
                      item.severity === 'medium' ? 'text-yellow-800' : 'text-green-800'
                    }`}>
                      {item.type === 'budget_overrun' ? 'Sobrecosto del Proyecto' : 
                       item.type === 'team_efficiency' ? 'Eficiencia del Equipo' : 
                       item.type === 'critical_deviations' ? 'Desviaciones Críticas' :
                       item.type === 'efficiency_opportunity' ? 'Oportunidad de Eficiencia' :
                       item.type === 'high_variance' ? 'Alta Variabilidad' :
                       item.type === 'scope_change' ? 'Cambio de Alcance' : item.type}
                    </span>
                    <Badge variant={item.severity === 'high' ? 'destructive' : 'secondary'}>
                      {item.severity === 'high' ? 'Alto' : item.severity === 'medium' ? 'Medio' : 'Bajo'}
                    </Badge>
                  </div>
                  <p className={`text-xs ${
                    item.severity === 'high' ? 'text-red-600' : 
                    item.severity === 'medium' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desviaciones Críticas Detalladas */}
        {deviationData.majorDeviations && deviationData.majorDeviations.filter(d => d.severity === 'critical').length > 0 && (
          <Collapsible open={criticalOpen} onOpenChange={setCriticalOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-sm text-red-700">
                  Desviaciones Críticas ({deviationData.majorDeviations.filter(d => d.severity === 'critical').length})
                </span>
              </div>
              {criticalOpen ? <ChevronDown className="h-4 w-4 text-red-600" /> : <ChevronRight className="h-4 w-4 text-red-600" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {deviationData.majorDeviations
                  .filter(deviation => deviation.severity === 'critical')
                  .map((deviation, index) => (
                    <div key={index} className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm text-red-800">
                            {deviation.personnelName || `Personal #${deviation.personnelId}`}
                          </p>
                          <p className="text-xs text-red-600">
                            Desviación crítica: +{deviation.deviationPercentage?.toFixed(1)}%
                          </p>
                        </div>
                        <Badge variant="destructive">CRÍTICO</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-600 mb-1">Horas</p>
                          <div className="flex justify-between">
                            <span>Presup: {deviation.budgetedHours}h</span>
                            <span>Real: {deviation.actualHours}h</span>
                          </div>
                          <p className="text-red-600 font-medium mt-1">
                            Exceso: +{deviation.hourDeviation?.toFixed(1)}h
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-gray-600 mb-1">Costo</p>
                          <div className="flex justify-between">
                            <span>Presup: ${deviation.budgetedCost?.toLocaleString()}</span>
                            <span>Real: ${deviation.actualCost?.toLocaleString()}</span>
                          </div>
                          <p className="text-red-600 font-medium mt-1">
                            Sobrecosto: ${Math.abs(deviation.costDeviation || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Análisis Detallado por Miembro */}
        <Collapsible open={teamAnalysisOpen} onOpenChange={setTeamAnalysisOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-sm text-gray-700">
                Análisis por Miembro del Equipo ({deviationData.deviationByRole.length})
              </span>
            </div>
            {teamAnalysisOpen ? <ChevronDown className="h-4 w-4 text-gray-600" /> : <ChevronRight className="h-4 w-4 text-gray-600" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-3">
              {deviationData.deviationByRole
                .sort((a, b) => Math.abs(b.deviationPercentage) - Math.abs(a.deviationPercentage))
                .slice(0, 8)
                .map((deviation, index) => {
                const badge = getVarianceBadge(deviation.deviationPercentage);
                return (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">
                          {deviation.personnelName || `Personal #${deviation.personnelId}`}
                        </p>
                        {deviation.severity && (
                          <p className="text-xs text-gray-500">
                            Prioridad: {deviation.severity === 'critical' ? 'Crítica' : 
                                      deviation.severity === 'high' ? 'Alta' : 
                                      deviation.severity === 'medium' ? 'Media' : 'Baja'}
                          </p>
                        )}
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-600 mb-1">Horas</p>
                        <div className="flex justify-between">
                          <span>Presup: {deviation.budgetedHours}h</span>
                          <span>Real: {deviation.actualHours}h</span>
                        </div>
                        <Progress 
                          value={Math.min(100, deviation.budgetedHours > 0 ? (deviation.actualHours / deviation.budgetedHours) * 100 : 0)} 
                          className="h-1 mt-1"
                        />
                        <p className={`text-xs font-medium mt-1 ${getVarianceColor((deviation.hourDeviation / Math.max(deviation.budgetedHours, 1)) * 100)}`}>
                          Diferencia: {deviation.hourDeviation > 0 ? '+' : ''}{deviation.hourDeviation.toFixed(1)}h
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Costo</p>
                        <div className="flex justify-between">
                          <span>Presup: ${deviation.budgetedCost.toLocaleString()}</span>
                          <span>Real: ${deviation.actualCost?.toLocaleString() || '0'}</span>
                        </div>
                        <p className={`text-xs font-medium mt-1 ${getVarianceColor(deviation.deviationPercentage)}`}>
                          Desviación: {deviation.deviationPercentage > 0 ? '+' : ''}{deviation.deviationPercentage?.toFixed(1) || '0'}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
    </Card>
  );
}