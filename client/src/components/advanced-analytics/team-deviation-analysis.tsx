import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TeamDeviationAnalysisProps {
  projectId: number;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
}

interface Deviation {
  personnelId: number;
  personnelName: string;
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

export function TeamDeviationAnalysis({ projectId, dateFilter }: TeamDeviationAnalysisProps) {
  const queryParams = dateFilter 
    ? `?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
    : '';

  const { data: deviationData, isLoading, error } = useQuery<DeviationAnalysisData>({
    queryKey: [`/api/projects/${projectId}/deviation-analysis`, dateFilter],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/deviation-analysis${queryParams}`);
      const data = await response.json();
      return data;
    },
    enabled: !!projectId,
  });

  const getVarianceBadge = (percentage: number) => {
    const absPercentage = Math.abs(percentage);
    if (absPercentage >= 100) {
      return { variant: 'destructive' as const, label: 'Crítico', className: 'bg-red-600 text-white' };
    } else if (absPercentage >= 50) {
      return { variant: 'destructive' as const, label: 'Alto', className: 'bg-orange-500 text-white' };
    } else if (absPercentage >= 20) {
      return { variant: 'outline' as const, label: 'Atención', className: 'bg-yellow-500 text-white' };
    } else {
      return { variant: 'secondary' as const, label: 'Normal', className: 'bg-blue-500 text-white' };
    }
  };

  const getVarianceColor = (percentage: number) => {
    return percentage > 0 ? 'text-red-600' : 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !deviationData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Error al cargar el análisis de desviaciones</p>
      </div>
    );
  }

  if (!deviationData.deviationByRole || deviationData.deviationByRole.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No hay datos de desviación para el período seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deviationData.deviationByRole
        .sort((a, b) => Math.abs(b.deviationPercentage) - Math.abs(a.deviationPercentage))
        .map((deviation, index) => {
          const badge = getVarianceBadge(deviation.deviationPercentage);
          return (
            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={`text-xs text-white font-semibold ${
                        deviation.severity === 'critical' ? 'bg-red-500' : 
                        deviation.severity === 'high' ? 'bg-orange-500' : 
                        deviation.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}>
                        {(deviation.personnelName || `P${deviation.personnelId}`).split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      {deviation.personnelName || `Personal #${deviation.personnelId}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      Desviación: {deviation.deviationPercentage > 0 ? '+' : ''}{deviation.deviationPercentage?.toFixed(1) || '0'}%
                    </p>
                  </div>
                </div>
                <Badge variant={badge.variant} className={`px-2 py-1 text-xs ${badge.className}`}>{badge.label}</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-2 rounded">
                <div className="space-y-1">
                  <p className="text-gray-700 font-medium">Horas</p>
                  <div className="flex justify-between text-gray-600">
                    <span>Presup: {deviation.budgetedHours}h</span>
                    <span>Real: {deviation.actualHours}h</span>
                  </div>
                  <Progress 
                    value={Math.min(100, deviation.budgetedHours > 0 ? (deviation.actualHours / deviation.budgetedHours) * 100 : 0)} 
                    className="h-1 mt-1"
                  />
                  <p className={`text-xs font-semibold ${getVarianceColor((deviation.hourDeviation / Math.max(deviation.budgetedHours, 1)) * 100)}`}>
                    Diferencia: {deviation.hourDeviation > 0 ? '+' : ''}{deviation.hourDeviation.toFixed(1)}h
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-gray-700 font-medium">Costo</p>
                  <div className="flex justify-between text-gray-600">
                    <span>Presup: ${deviation.budgetedCost.toLocaleString()}</span>
                    <span>Real: ${deviation.actualCost?.toLocaleString() || '0'}</span>
                  </div>
                  <p className={`text-xs font-semibold ${getVarianceColor(deviation.deviationPercentage)}`}>
                    Desviación: {deviation.deviationPercentage > 0 ? '+' : ''}{deviation.deviationPercentage?.toFixed(1) || '0'}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}