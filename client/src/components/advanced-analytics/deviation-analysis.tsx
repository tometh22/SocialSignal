import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, TrendingDown, Users, DollarSign } from "lucide-react";

interface DeviationAnalysisProps {
  projectId: number;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
}

interface Deviation {
  personnelId: number;
  personnelName: string;
  roleName: string;
  estimated: {
    hours: number;
    cost: number;
  };
  actual: {
    hours: number;
    cost: number;
  };
  variance: {
    hours: number;
    cost: number;
    hoursPercentage: number;
    costPercentage: number;
  };
}

interface DeviationAnalysisData {
  projectId: number;
  projectName: string;
  totalVariance: {
    estimatedCost: number;
    actualCost: number;
    variance: number;
  };
  deviationByRole: Deviation[];
  majorDeviations: Deviation[];
  causes: Array<{
    type: string;
    severity: string;
    description: string;
    affectedMembers?: string[];
    affectedRoles?: string[];
  }>;
  summary: {
    membersOverBudget: number;
    membersUnderBudget: number;
    averageVariancePercentage: number;
  };
}

export function DeviationAnalysis({ projectId, dateFilter }: DeviationAnalysisProps) {
  const queryParams = dateFilter 
    ? `?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
    : '';
    
  const { data: deviationData, isLoading } = useQuery<DeviationAnalysisData>({
    queryKey: [`/api/projects/${projectId}/deviation-analysis`, dateFilter],
    queryFn: () => fetch(`/api/projects/${projectId}/deviation-analysis${queryParams}`).then(res => res.json()),
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

  if (!deviationData) return null;

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
            {deviationData.majorDeviations.length} Desviaciones Críticas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Resumen General */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Varianza Total</span>
            </div>
            <p className="text-xl font-bold text-blue-600">
              ${Math.abs(deviationData.totalVariance.variance).toLocaleString()}
            </p>
            <p className="text-xs text-blue-600">
              {deviationData.totalVariance.variance > 0 ? "Sobrecosto" : "Bajo presupuesto"}
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
              <span className="text-sm font-medium text-purple-800">Varianza Promedio</span>
            </div>
            <p className="text-xl font-bold text-purple-600">
              {deviationData.summary.averageVariancePercentage.toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600">del presupuesto</p>
          </div>
        </div>

        {/* Principales Causas */}
        {deviationData.causes.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 text-gray-700">Principales Causas Identificadas</h4>
            <div className="space-y-2">
              {deviationData.causes.map((cause, index) => (
                <div key={index} className={`p-3 rounded-lg border ${
                  cause.severity === 'high' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium text-sm ${
                      cause.severity === 'high' ? 'text-red-800' : 'text-yellow-800'
                    }`}>
                      {cause.type === 'cost_overrun' ? 'Sobrecosto Generalizado' : 'Cambio de Alcance'}
                    </span>
                    <Badge variant={cause.severity === 'high' ? 'destructive' : 'secondary'}>
                      {cause.severity === 'high' ? 'Alto' : 'Medio'}
                    </Badge>
                  </div>
                  <p className={`text-xs ${
                    cause.severity === 'high' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {cause.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Análisis Detallado por Miembro */}
        <div>
          <h4 className="font-semibold text-sm mb-3 text-gray-700">Análisis por Miembro del Equipo</h4>
          <div className="space-y-3">
            {deviationData.deviationByRole
              .sort((a, b) => Math.abs(b.variance.costPercentage) - Math.abs(a.variance.costPercentage))
              .slice(0, 8)
              .map((deviation, index) => {
                const badge = getVarianceBadge(deviation.variance.costPercentage);
                return (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{deviation.personnelName}</p>
                        <p className="text-xs text-gray-500">{deviation.roleName}</p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-600 mb-1">Horas</p>
                        <div className="flex justify-between">
                          <span>Estimado: {deviation.estimated.hours}h</span>
                          <span>Real: {deviation.actual.hours}h</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (deviation.actual.hours / deviation.estimated.hours) * 100)} 
                          className="h-1 mt-1"
                        />
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">Costo</p>
                        <div className="flex justify-between">
                          <span>Est: ${deviation.estimated.cost.toLocaleString()}</span>
                          <span>Real: ${deviation.actual.cost.toLocaleString()}</span>
                        </div>
                        <p className={`text-xs font-medium mt-1 ${getVarianceColor(deviation.variance.costPercentage)}`}>
                          {deviation.variance.costPercentage > 0 ? '+' : ''}{deviation.variance.costPercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}