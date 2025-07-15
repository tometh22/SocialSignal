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

export function DeviationAnalysis({ projectId, dateFilter, onNavigateToTab }: DeviationAnalysisProps) {
  
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
    const criticalCount = deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) > 50).length;
    console.log('🚨 DeviationAnalysis - Críticas calculadas (>50%):', criticalCount);
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
            {(() => {
              const criticalCount = deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) > 50).length;
              console.log('🎯 BADGE DeviationAnalysis - Críticas en badge (>50%):', criticalCount);
              return criticalCount;
            })()} Desviaciones Críticas
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
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer hover:scale-[1.02] ${
                    item.severity === 'high' ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300 shadow-md hover:border-red-400' : 
                    item.severity === 'medium' ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300 hover:border-yellow-400' :
                    'bg-gradient-to-r from-green-50 to-green-100 border-green-300 hover:border-green-400'
                  }`}
                  onClick={() => handleAlertClick(item.type)}
                  title="Haz clic para navegar a la sección relevante"
                >
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





      </CardContent>
    </Card>
  );
}