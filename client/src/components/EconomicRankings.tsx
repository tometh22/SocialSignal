import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Trophy, Target, BarChart3, DollarSign, Clock, Info, Settings, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface EconomicRankingsProps {
  projectId: number;
  timeFilter?: string;
  loading?: boolean;
}

export function EconomicRankings({ 
  projectId,
  timeFilter = 'august_2025',
  loading = false
}: EconomicRankingsProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [impactWeight, setImpactWeight] = useState(50); // Por defecto 50% impacto, 50% eficiencia

  // Fetch performance rankings data
  const { data: performanceData, isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId, 'performance-rankings', timeFilter],
    queryFn: async () => {
      console.log(`🔍 RANKINGS: Fetching data for project ${projectId} with filter ${timeFilter}`);
      const response = await fetch(`/api/projects/${projectId}/performance-rankings?timeFilter=${timeFilter}`);
      if (!response.ok) throw new Error('Failed to fetch performance rankings');
      const data = await response.json();
      console.log(`📊 RANKINGS: Received ${data.rankings?.length || 0} rankings for ${timeFilter}`);
      return data;
    },
    enabled: !!projectId,
    staleTime: 0, // Always refetch when timeFilter changes
    gcTime: 1000 * 60 * 2, // Keep in cache for 2 minutes only (renamed from cacheTime in v5)
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false // Don't refetch on window focus
  });
  
  // Consolidate loading state
  const isLoadingData = loading || isLoading;
  
  // Get team members from API response
  const teamMembers = performanceData?.rankings || [];
  const validaciones = performanceData?.validaciones || {};
  const configuracion = performanceData?.configuracion || {};
  
  // Helper function to get performance badge color
  const getPerformanceBadgeColor = (clasificacion: any) => {
    if (!clasificacion) return 'bg-gray-100 text-gray-800';
    
    switch(clasificacion.color) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'red': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  if (isLoadingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Performance Rankings - Vista Completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500 mt-2">Calculando rankings de performance...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Error en Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500">Error cargando datos de performance</p>
            <p className="text-sm text-gray-500 mt-1">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!teamMembers || teamMembers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Performance Rankings - Vista Completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No hay datos suficientes para calcular rankings de performance</p>
            <p className="text-sm text-gray-400 mt-1">Período: {timeFilter}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar los tres rankings diferentes usando los datos del nuevo API
  const efficiencyRanking = [...teamMembers].sort((a, b) => b.eficiencia.score - a.eficiencia.score);
  const impactRanking = [...teamMembers].sort((a, b) => b.impacto.score - a.impacto.score);
  const unifiedRanking = [...teamMembers].sort((a, b) => b.unificado.score - a.unificado.score);
  
  // Función para obtener la configuración actual
  const getCurrentConfig = () => {
    const efficiency = 100 - impactWeight;
    if (impactWeight <= 35) return { name: "Conservativo", desc: `Eficiencia ${efficiency}% + Impacto ${impactWeight}%` };
    if (impactWeight >= 65) return { name: "Estratégico", desc: `Eficiencia ${efficiency}% + Impacto ${impactWeight}%` };
    return { name: "Balanceado", desc: `Eficiencia ${efficiency}% + Impacto ${impactWeight}%` };
  };

  const getRankingIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Target className="w-4 h-4 text-gray-400" />;
    if (rank === 3) return <BarChart3 className="w-4 h-4 text-orange-500" />;
    return <span className="w-4 h-4 flex items-center justify-center text-xs font-medium text-gray-500">#{rank}</span>;
  };

  // Función para obtener tooltip según tipo de métrica
  const getMetricTooltip = (type: string) => {
    switch (type) {
      case 'efficiency':
        return "Eficiencia individual: cumplimiento del plan (hrs_real/hrs_objetivo). Score 70-100 = Excelente, 50-69 = Bueno, <50 = Crítico. Sin objetivo = 70 pts (neutro).";
      case 'impact':
        return "Impacto económico: eficiencia ponderada por participación en ingresos del proyecto. Rango típico 8-30 puntos. ≥15 = Excelente, 8-14 = Bueno, <8 = Crítico.";
      case 'unified':
        return "Score unificado: 50% Eficiencia + 50% Impacto (escalado). Balance configurable entre cumplimiento individual y valor económico del equipo.";
      default:
        return "";
    }
  };

  const getTooltipContent = (type: string) => {
    switch (type) {
      case 'efficiency':
        return "Mide qué tan bien cumple cada persona sus objetivos individuales. Se calcula considerando: desviación de costos, desviación de horas, margen por hora y eficiencia de facturación.";
      case 'impact':
        return "Combina la eficiencia personal con el valor económico del proyecto que gestiona. Las personas que manejan mayor porcentaje del presupesto tienen mayor impacto potencial.";
      case 'unified':
        return "Balance 50/50 entre eficiencia individual e impacto económico. Con esta configuración, Matías puede estar #1 por su eficiencia perfecta (100%) aunque maneje solo 4.6% del presupuesto. Un enfoque más estratégico (70% impacto) priorizaría a quienes gestionan mayor valor económico.";
      default:
        return "";
    }
  };

  // Nuevo componente para las columnas usando la estructura del nuevo API
  const NewRankingColumn = ({ 
    title, 
    description, 
    rankings, 
    metricType,
    icon: IconComponent,
    color,
    tooltipType
  }: { 
    title: string; 
    description: string; 
    rankings: any[]; 
    metricType: 'eficiencia' | 'impacto' | 'unificado';
    icon: any;
    color: string;
    tooltipType: string;
  }) => (
    <div className="flex-1">
      <div className={`p-4 rounded-lg ${color} mb-4`}>
        <div className="flex items-center gap-2 mb-1">
          <IconComponent className="w-5 h-5" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>{getMetricTooltip(tooltipType)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      
      <div className="space-y-2">
        {rankings.slice(0, 8).map((member, index) => {
          const metric = member[metricType];
          const rank = index + 1;
          
          return (
            <div
              key={`${metricType}-${member.persona}`}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8">
                  {getRankingIcon(rank)}
                </div>
                
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-900 truncate">{member.persona}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {member.horas.real}h / {member.horas.objetivo}h
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {member.economia.participacion_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {metric.display}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-lg text-gray-900">
                  {metric.score}
                </div>
                <Badge variant="outline" className={getPerformanceBadgeColor(metric.clasificacion)}>
                  {metric.clasificacion.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Rankings Económicos - Vista Completa
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Comparación de los tres tipos de ranking calculados con datos reales del período seleccionado
        </p>
      </CardHeader>

      <CardContent>
        {/* Interpretación de Scores - Movida arriba */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Interpretación de Scores
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Eficiencia:</div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">Excelente</Badge>
                <span className="text-gray-600">70+ puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>
                <span className="text-gray-600">50-69 puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800">Crítico</Badge>
                <span className="text-gray-600">&lt;50 puntos</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Impacto:</div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">Excelente</Badge>
                <span className="text-gray-600">15+ puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>
                <span className="text-gray-600">8-14 puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800">Crítico</Badge>
                <span className="text-gray-600">&lt;8 puntos</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Unificado:</div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">Excelente</Badge>
                <span className="text-gray-600">20+ puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>
                <span className="text-gray-600">12-19 puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800">Crítico</Badge>
                <span className="text-gray-600">&lt;12 puntos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Control Dinámico del Ranking Unificado */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Balance Dinámico Ranking Unificado
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? 'Ocultar' : 'Configurar'}
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-blue-600">Configuración: {getCurrentConfig().name}</span>
              <span className="text-gray-600">{getCurrentConfig().desc}</span>
            </div>
            
            {showConfig && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Eficiencia Individual</span>
                    <span>Impacto Económico</span>
                  </div>
                  <Slider
                    value={[impactWeight]}
                    onValueChange={([value]) => setImpactWeight(value)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>100% - 0%</span>
                    <span>Actual: {100 - impactWeight}% - {impactWeight}%</span>
                    <span>0% - 100%</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button 
                    className={`p-2 rounded ${impactWeight <= 35 ? 'bg-blue-100 border border-blue-300' : 'bg-white border'}`}
                    onClick={() => setImpactWeight(30)}
                  >
                    <div className="font-medium">Conservativo</div>
                    <div className="text-gray-500">70% - 30%</div>
                  </button>
                  <button 
                    className={`p-2 rounded ${impactWeight >= 45 && impactWeight <= 55 ? 'bg-blue-100 border border-blue-300' : 'bg-white border'}`}
                    onClick={() => setImpactWeight(50)}
                  >
                    <div className="font-medium">Balanceado</div>
                    <div className="text-gray-500">50% - 50%</div>
                  </button>
                  <button 
                    className={`p-2 rounded ${impactWeight >= 65 ? 'bg-blue-100 border border-blue-300' : 'bg-white border'}`}
                    onClick={() => setImpactWeight(70)}
                  >
                    <div className="font-medium">Estratégico</div>
                    <div className="text-gray-500">30% - 70%</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validaciones y alertas */}
        {validaciones.noDataForPeriod && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Sin datos para el período seleccionado</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              No se encontraron datos de costos o horas para el período {timeFilter}. 
              Verifica que el Excel MAESTRO tenga datos para este período.
            </p>
          </div>
        )}

        {validaciones.sinIngresos && !validaciones.noDataForPeriod && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Sin ingresos detectados para el período</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Los scores de Impacto serán cero. Verifica datos del período {timeFilter}.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <NewRankingColumn
            title="Eficiencia"
            description="Cumplimiento del plan individual"
            rankings={efficiencyRanking}
            metricType="eficiencia"
            icon={Target}
            color="bg-blue-50 border border-blue-200"
            tooltipType="efficiency"
          />
          
          <NewRankingColumn
            title="Impacto"
            description="Eficiencia ponderada por valor económico"
            rankings={impactRanking}
            metricType="impacto"
            icon={DollarSign}
            color="bg-green-50 border border-green-200"
            tooltipType="impact"
          />
          
          <NewRankingColumn
            title="Unificado"
            description="Balance entre eficiencia e impacto"
            rankings={unifiedRanking}
            metricType="unificado"
            icon={Trophy}
            color="bg-purple-50 border border-purple-200"
            tooltipType="unified"
          />
        </div>

        {/* Información de validación */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Información del período</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Miembros con datos:</span>
              <div className="font-medium">{validaciones.datosCompletos || 0}</div>
            </div>
            <div>
              <span className="text-gray-600">Sin objetivo:</span>
              <div className="font-medium">{validaciones.sinObjetivo || 0}</div>
            </div>
            <div>
              <span className="text-gray-600">Participación total:</span>
              <div className="font-medium">{validaciones.participacionTotal}%</div>
            </div>
            <div>
              <span className="text-gray-600">Período:</span>
              <div className="font-medium">{timeFilter}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}