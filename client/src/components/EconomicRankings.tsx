import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, BarChart3, TrendingUp, DollarSign, Clock } from "lucide-react";
import { RankingType, PersonnelMetrics } from "@shared/ranking-config";
import { sortByRankingType } from "@shared/ranking-utils";

interface EconomicRankingsProps {
  rankings: PersonnelMetrics[];
  loading?: boolean;
}

export function EconomicRankings({ rankings, loading = false }: EconomicRankingsProps) {
  const [selectedRanking, setSelectedRanking] = useState<RankingType>('efficiency');

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

  const sortedRankings = sortByRankingType(rankings, selectedRanking);

  const getRankingIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Target className="w-4 h-4 text-gray-400" />;
    if (rank === 3) return <TrendingUp className="w-4 h-4 text-orange-500" />;
    return <span className="w-4 h-4 flex items-center justify-center text-xs font-medium text-gray-500">#{rank}</span>;
  };

  const getPerformanceBadge = (color: 'green' | 'yellow' | 'red') => {
    const variants = {
      green: 'bg-green-100 text-green-800 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      red: 'bg-red-100 text-red-800 border-red-200'
    };
    
    const labels = {
      green: 'Excelente',
      yellow: 'Bueno',
      red: 'Crítico'
    };

    return (
      <Badge variant="outline" className={variants[color]}>
        {labels[color]}
      </Badge>
    );
  };

  const getCurrentScore = (metrics: PersonnelMetrics) => {
    switch (selectedRanking) {
      case 'efficiency': return metrics.efficiencyScore;
      case 'impact': return metrics.impactScore;
      case 'unified': return metrics.unifiedScore;
    }
  };

  const getCurrentRank = (metrics: PersonnelMetrics) => {
    switch (selectedRanking) {
      case 'efficiency': return metrics.efficiencyRank;
      case 'impact': return metrics.impactRank;
      case 'unified': return metrics.unifiedRank;
    }
  };

  const rankingTypes = [
    {
      key: 'efficiency' as RankingType,
      label: 'Eficiencia',
      description: 'Cumplimiento del plan individual',
      icon: Target
    },
    {
      key: 'impact' as RankingType,
      label: 'Impacto',
      description: 'Eficiencia ponderada por valor económico',
      icon: DollarSign
    },
    {
      key: 'unified' as RankingType,
      label: 'Unificado',
      description: 'Balance entre eficiencia e impacto',
      icon: BarChart3
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Rankings Económicos
        </CardTitle>
        
        {/* Selector de tipo de ranking */}
        <div className="flex gap-2 mt-4">
          {rankingTypes.map(({ key, label, description, icon: Icon }) => (
            <Button
              key={key}
              variant={selectedRanking === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRanking(key)}
              className="flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>
        
        {/* Descripción del ranking actual */}
        <p className="text-sm text-gray-600 mt-2">
          {rankingTypes.find(r => r.key === selectedRanking)?.description}
        </p>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {sortedRankings.map((member) => {
            const currentRank = getCurrentRank(member);
            const currentScore = getCurrentScore(member);
            
            return (
              <div
                key={member.personnelId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Posición en ranking */}
                  <div className="flex items-center justify-center w-8 h-8">
                    {getRankingIcon(currentRank)}
                  </div>
                  
                  {/* Información del miembro */}
                  <div>
                    <h4 className="font-medium text-gray-900">{member.personnelName}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {member.actualHours.toFixed(1)}h / {member.estimatedHours.toFixed(1)}h
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${member.actualCost.toFixed(0)} / ${member.estimatedCost.toFixed(0)}
                      </span>
                      <span>
                        {(member.pricePercentage * 100).toFixed(1)}% del proyecto
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Puntaje */}
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {currentScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">puntos</div>
                  </div>
                  
                  {/* Badge de performance */}
                  {getPerformanceBadge(member.performanceColor)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen de métricas adicionales */}
        {selectedRanking === 'efficiency' && (
          <div className="mt-6 pt-4 border-t">
            <h5 className="font-medium text-gray-900 mb-3">Métricas Detalladas</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {sortedRankings.slice(0, 3).map(member => (
                <div key={member.personnelId} className="space-y-1">
                  <div className="font-medium">{member.personnelName}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Desv. Costo: {(member.costDeviation * 100).toFixed(1)}%</div>
                    <div>Desv. Horas: {(member.hoursDeviation * 100).toFixed(1)}%</div>
                    <div>Margen/Hora: ${member.marginPerHour.toFixed(1)}</div>
                    <div>Efic. Fact.: {member.billingEfficiency.toFixed(1)}x</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}