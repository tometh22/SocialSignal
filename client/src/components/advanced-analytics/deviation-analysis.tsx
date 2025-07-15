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
  const [criticalOpen, setCriticalOpen] = useState(false);
  
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
    const absPercentage = Math.abs(percentage);
    if (absPercentage < 20) return { 
      variant: "default" as const, 
      label: "Normal",
      className: "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
    };
    if (absPercentage < 50) return { 
      variant: "secondary" as const, 
      label: "Atención",
      className: "bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-600"
    };
    if (absPercentage < 100) return { 
      variant: "outline" as const, 
      label: "Alto",
      className: "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
    };
    return { 
      variant: "destructive" as const, 
      label: "Crítico",
      className: "bg-red-500 text-white border-red-600 hover:bg-red-600"
    };
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
            {deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) >= 100).length} Desviaciones Críticas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Resumen General Mejorado */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow h-32 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-200 p-2 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-700" />
              </div>
              <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                Diferencia vs Presupuesto
              </span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-800 mb-1">
                ${Math.abs(deviationData.totalVariance.variance).toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                {deviationData.totalVariance.variance > 0 ? "Por encima del presupuesto" : "Por debajo del presupuesto"}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-shadow h-32 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-red-200 p-2 rounded-lg">
                <TrendingUp className="h-4 w-4 text-red-700" />
              </div>
              <span className="text-xs text-red-600 font-semibold uppercase tracking-wide">
                Exceden Presupuesto
              </span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-800 mb-1">
                {deviationData.summary.membersOverBudget}
              </p>
              <p className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
                miembros del equipo
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow h-32 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-200 p-2 rounded-lg">
                <TrendingDown className="h-4 w-4 text-green-700" />
              </div>
              <span className="text-xs text-green-600 font-semibold uppercase tracking-wide">
                Bajo Presupuesto
              </span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-800 mb-1">
                {deviationData.summary.membersUnderBudget}
              </p>
              <p className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                miembros del equipo
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow h-32 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-purple-200 p-2 rounded-lg">
                <Users className="h-4 w-4 text-purple-700" />
              </div>
              <span className="text-xs text-purple-600 font-semibold uppercase tracking-wide">
                Total Miembros
              </span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-800 mb-1">
                {deviationData.deviationByRole.length}
              </p>
              <p className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                analizados
              </p>
            </div>
          </div>
        </div>

        {/* Análisis Automático */}
        {deviationData.analysis && deviationData.analysis.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 text-gray-700">Análisis Automático del Sistema</h4>
            <div className="space-y-2">
              {deviationData.analysis
                .sort((a, b) => {
                  const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                  return severityOrder[b.severity] - severityOrder[a.severity];
                })
                .map((item, index) => (
                <div key={index} className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                  item.severity === 'high' ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300 shadow-md' : 
                  item.severity === 'medium' ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300' :
                  'bg-gradient-to-r from-green-50 to-green-100 border-green-300'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      item.severity === 'high' ? 'bg-red-600' : 
                      item.severity === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <span className={`font-semibold text-sm ${
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
                    </div>
                    <Badge variant={item.severity === 'high' ? 'destructive' : item.severity === 'medium' ? 'outline' : 'secondary'} 
                           className={`text-xs px-2 py-1 ${
                             item.severity === 'high' ? 'bg-red-600 text-white border-red-700' : 
                             item.severity === 'medium' ? 'bg-yellow-500 text-white border-yellow-600' : 
                             'bg-green-500 text-white border-green-600'
                           }`}>
                      {item.severity === 'high' ? 'Alto' : item.severity === 'medium' ? 'Medio' : 'Bajo'}
                    </Badge>
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    item.severity === 'high' ? 'text-red-700' : 
                    item.severity === 'medium' ? 'text-yellow-700' : 'text-green-700'
                  }`}>
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desviaciones Críticas Detalladas */}
        {deviationData.deviationByRole && deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) >= 100).length > 0 && (
          <Collapsible open={criticalOpen} onOpenChange={setCriticalOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200 hover:from-red-100 hover:to-red-150 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="bg-red-200 p-2 rounded-lg group-hover:bg-red-300 transition-colors">
                  <AlertTriangle className="h-5 w-5 text-red-700" />
                </div>
                <div>
                  <span className="font-semibold text-base text-red-800">
                    Desviaciones Críticas
                  </span>
                  <p className="text-xs text-red-600">
                    {deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) >= 100).length} miembros requieren atención inmediata
                  </p>
                </div>
              </div>
              <div className="bg-red-200 p-2 rounded-lg group-hover:bg-red-300 transition-colors">
                {criticalOpen ? <ChevronDown className="h-4 w-4 text-red-700" /> : <ChevronRight className="h-4 w-4 text-red-700" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {deviationData.deviationByRole
                  .filter(deviation => deviation.actualHours > 0 && Math.abs(deviation.deviationPercentage) >= 100)
                  .sort((a, b) => Math.abs(b.deviationPercentage) - Math.abs(a.deviationPercentage))
                  .map((deviation, index) => (
                    <div key={index} className="bg-white border border-red-200 rounded-lg p-2.5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="flex-shrink-0 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">
                            {deviation.personnelName || `Personal #${deviation.personnelId}`}
                          </h4>
                          <p className="text-xs text-red-600 font-medium">
                            +{deviation.deviationPercentage?.toFixed(1)}% desviación
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs px-1.5 py-0.5">CRÍTICO</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-1.5 rounded">
                        <div>
                          <p className="text-gray-700 font-medium mb-0.5">Horas</p>
                          <div className="flex justify-between text-gray-600 text-xs">
                            <span>{deviation.budgetedHours}h</span>
                            <span className="text-red-600 font-medium">+{deviation.hourDeviation?.toFixed(1)}h</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-700 font-medium mb-0.5">Costo</p>
                          <div className="flex justify-between text-gray-600 text-xs">
                            <span>${deviation.budgetedCost?.toLocaleString()}</span>
                            <span className="text-red-600 font-medium">+${Math.abs(deviation.costDeviation || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}



      </CardContent>
    </Card>
  );
}