import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, Award, Target, AlertTriangle } from 'lucide-react';
import { usePerformanceRankings } from '@/contexts/ProjectDataProvider';

// 🎯 PERFORMANCE TAB - usa /performance-rankings endpoint según handoff
export default function PerformanceTab() {
  const { data: performanceData, isLoading } = usePerformanceRankings();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!performanceData?.rankings) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron datos de rankings de performance para el período seleccionado.
        </AlertDescription>
      </Alert>
    );
  }

  const { rankings = [] } = performanceData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Rankings de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rankings.map((member: any, index: number) => (
              <div
                key={member.personnelId || index}
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`row-performance-${member.personnelId}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium" data-testid={`text-performance-name-${member.personnelId}`}>
                        {member.personnelName}
                      </div>
                      <div className="text-sm text-gray-500">
                        Performance Score
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Score</div>
                    <div className="font-medium" data-testid={`text-performance-score-${member.personnelId}`}>
                      {member.performanceScore?.toFixed(1) || 'N/A'}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm text-gray-500">Horas</div>
                    <div className="font-medium" data-testid={`text-performance-hours-${member.personnelId}`}>
                      {member.totalHours?.toFixed(1) || 0}h
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm text-gray-500">Eficiencia</div>
                    <Badge variant="secondary" data-testid={`badge-performance-efficiency-${member.personnelId}`}>
                      {member.efficiency?.toFixed(1) || 0}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rankings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay datos de performance para el período seleccionado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}