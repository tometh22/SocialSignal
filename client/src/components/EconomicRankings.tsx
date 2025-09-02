import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Trophy, Target, BarChart3, DollarSign, Clock, Info, Settings } from "lucide-react";
import { RankingType, PersonnelMetrics, RANKING_CONFIG } from "@shared/ranking-config";
import { sortByRankingType, calculateTeamRankings, getPerformanceColor } from "@shared/ranking-utils";
import { useState, useMemo } from "react";

interface EconomicRankingsProps {
  rankings: PersonnelMetrics[];
  loading?: boolean;
  projectTotalPrice?: number; // Necesario para recalcular rankings dinámicamente
  timeFilter?: string; // Para identificar el período seleccionado
}

export function EconomicRankings({ 
  rankings, 
  loading = false, 
  projectTotalPrice = 100000, 
  timeFilter = 'current_month'
}: EconomicRankingsProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [impactWeight, setImpactWeight] = useState(50); // Por defecto 50% impacto, 50% eficiencia
  
  // Helper function to get score label based on type-specific thresholds
  const getScoreLabel = (score: number, type: RankingType): string => {
    const thresholds = RANKING_CONFIG.thresholds[type];
    if (score >= thresholds.excellent) return 'Excelente';
    if (score >= thresholds.good) return 'Bueno';
    return 'Crítico';
  };
  
  // Recalcular rankings dinámicamente cuando cambia el slider
  const dynamicRankings = useMemo(() => {
    if (!rankings || rankings.length === 0) return [];
    
    // Crear datos base para recalcular
    const teamData = rankings.map(member => ({
      personnelId: member.personnelId,
      name: member.personnelName,
      personnelName: member.personnelName,
      estimatedHours: member.estimatedHours,
      actualHours: member.actualHours,
      estimatedCost: member.estimatedCost,
      actualCost: member.actualCost
    }));
    
    // Usar la nueva configuración de peso
    const customConfig = {
      impact: impactWeight / 100,
      efficiency: (100 - impactWeight) / 100
    };
    
    try {
      // Recalcular con nueva configuración
      return calculateTeamRankings(teamData, projectTotalPrice, customConfig);
    } catch (error) {
      console.warn('Error recalculando rankings:', error);
      return rankings; // Fallback a rankings originales
    }
  }, [rankings, impactWeight, projectTotalPrice]);
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Rankings Económicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500 mt-2">Calculando rankings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Rankings Económicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No hay datos suficientes para calcular rankings</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar los tres rankings diferentes usando rankings dinámicos
  const efficiencyRanking = sortByRankingType(dynamicRankings, 'efficiency');
  const impactRanking = sortByRankingType(dynamicRankings, 'impact');
  const unifiedRanking = sortByRankingType(dynamicRankings, 'unified');
  
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

  const getScoreBadge = (score: number) => {
    if (score >= 70) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
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

  const RankingColumn = ({ 
    title, 
    description, 
    rankings, 
    scoreKey, 
    rankKey, 
    icon: IconComponent,
    color,
    tooltipType,
    rankingType = 'efficiency'
  }: { 
    title: string; 
    description: string; 
    rankings: PersonnelMetrics[]; 
    scoreKey: keyof PersonnelMetrics; 
    rankKey: keyof PersonnelMetrics;
    icon: any;
    color: string;
    tooltipType: string;
    rankingType?: RankingType;
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
                <p>{getTooltipContent(tooltipType)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      
      <div className="space-y-2">
        {rankings.slice(0, 8).map((member) => {
          const score = member[scoreKey] as number;
          const rank = member[rankKey] as number;
          // Obtener el nombre del miembro
          const memberName = member.personnelName || `Miembro ${member.personnelId}`;
          
          return (
            <div
              key={`${scoreKey}-${member.personnelId}`}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8">
                  {getRankingIcon(rank)}
                </div>
                
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-900 truncate">{memberName}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {member.actualHours.toFixed(0)}h / {member.estimatedHours.toFixed(0)}h
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {member.pricePercentage < 0.001 && member.pricePercentage > 0 
                        ? (member.pricePercentage * 100).toFixed(3) + '%'
                        : (member.pricePercentage * 100).toFixed(1) + '%'
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-lg text-gray-900">
                  {score < 0.1 && score > 0 ? score.toFixed(3) : score.toFixed(1)}
                </div>
                <Badge variant="outline" className={getScoreBadge(score)}>
                  {getScoreLabel(score, rankingType)}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RankingColumn
            title="Eficiencia"
            description="Cumplimiento del plan individual"
            rankings={efficiencyRanking}
            scoreKey="efficiencyScore"
            rankKey="efficiencyRank"
            icon={Target}
            rankingType="efficiency"
            color="bg-blue-50 border border-blue-200"
            tooltipType="efficiency"
          />
          
          <RankingColumn
            title="Impacto"
            description="Eficiencia ponderada por valor económico"
            rankings={impactRanking}
            scoreKey="impactScore"
            rankKey="impactRank"
            icon={DollarSign}
            rankingType="impact"
            color="bg-green-50 border border-green-200"
            tooltipType="impact"
          />
          
          <RankingColumn
            title="Unificado"
            description="Balance entre eficiencia e impacto"
            rankings={unifiedRanking}
            scoreKey="unifiedScore"
            rankKey="unifiedRank"
            icon={BarChart3}
            rankingType="unified"
            color="bg-purple-50 border border-purple-200"
            tooltipType="unified"
          />
        </div>
      </CardContent>
    </Card>
  );
}