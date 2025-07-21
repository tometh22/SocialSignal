import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, BarChart3, DollarSign, Clock } from "lucide-react";
import { RankingType, PersonnelMetrics } from "@shared/ranking-config";
import { sortByRankingType } from "@shared/ranking-utils";

interface EconomicRankingsProps {
  rankings: PersonnelMetrics[];
  loading?: boolean;
}

export function EconomicRankings({ rankings, loading = false }: EconomicRankingsProps) {
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

  // Preparar los tres rankings diferentes
  const efficiencyRanking = sortByRankingType(rankings, 'efficiency');
  const impactRanking = sortByRankingType(rankings, 'impact');
  const unifiedRanking = sortByRankingType(rankings, 'unified');

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

  const RankingColumn = ({ 
    title, 
    description, 
    rankings, 
    scoreKey, 
    rankKey, 
    icon: IconComponent,
    color 
  }: { 
    title: string; 
    description: string; 
    rankings: PersonnelMetrics[]; 
    scoreKey: keyof PersonnelMetrics; 
    rankKey: keyof PersonnelMetrics;
    icon: any;
    color: string;
  }) => (
    <div className="flex-1">
      <div className={`p-4 rounded-lg ${color} mb-4`}>
        <div className="flex items-center gap-2 mb-1">
          <IconComponent className="w-5 h-5" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      
      <div className="space-y-2">
        {rankings.slice(0, 8).map((member) => {
          const score = member[scoreKey] as number;
          const rank = member[rankKey] as number;
          // Intentar múltiples campos para obtener el nombre
          const memberName = member.name || member.personnelName || member.personnelName || `Miembro ${member.personnelId}`;
          
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
                      {(member.pricePercentage * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-lg text-gray-900">
                  {score.toFixed(1)}
                </div>
                <Badge variant="outline" className={getScoreBadge(score)}>
                  {score >= 70 ? 'Excelente' : score >= 40 ? 'Bueno' : 'Crítico'}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RankingColumn
            title="Eficiencia"
            description="Cumplimiento del plan individual"
            rankings={efficiencyRanking}
            scoreKey="efficiencyScore"
            rankKey="efficiencyRank"
            icon={Target}
            color="bg-blue-50 border border-blue-200"
          />
          
          <RankingColumn
            title="Impacto"
            description="Eficiencia ponderada por valor económico"
            rankings={impactRanking}
            scoreKey="impactScore"
            rankKey="impactRank"
            icon={DollarSign}
            color="bg-green-50 border border-green-200"
          />
          
          <RankingColumn
            title="Unificado"
            description="Balance entre eficiencia e impacto"
            rankings={unifiedRanking}
            scoreKey="unifiedScore"
            rankKey="unifiedRank"
            icon={BarChart3}
            color="bg-purple-50 border border-purple-200"
          />
        </div>
        
        {/* Leyenda */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Interpretación de Scores</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-200">Excelente</Badge>
              <span className="text-gray-600">70+ puntos</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Bueno</Badge>
              <span className="text-gray-600">40-69 puntos</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-800 border-red-200">Crítico</Badge>
              <span className="text-gray-600">Menos de 40 puntos</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}