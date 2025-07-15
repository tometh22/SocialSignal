import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

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

type SortField = 'deviation' | 'cost' | 'hours';
type SortDirection = 'asc' | 'desc';

export function TeamDeviationAnalysis({ projectId, dateFilter }: TeamDeviationAnalysisProps) {
  const [sortField, setSortField] = useState<SortField>('deviation');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Always start with desc (mayor a menor)
    }
  };

  const getSeverityScore = (deviation: Deviation) => {
    // Si no hay horas registradas, dar la puntuación más baja
    if (deviation.actualHours === 0) return -1;
    
    const absPercentage = Math.abs(deviation.deviationPercentage);
    if (absPercentage >= 100) return 4; // Crítico
    if (absPercentage >= 50) return 3;  // Alto
    if (absPercentage >= 20) return 2;  // Atención
    return 1; // Normal
  };

  const getSortedData = () => {
    if (!deviationData?.deviationByRole) return [];
    
    const data = [...deviationData.deviationByRole];
    
    return data.sort((a, b) => {
      let valueA: number, valueB: number;
      
      switch (sortField) {
        case 'deviation':
          // Primero ordenar por severidad, luego por porcentaje absoluto
          const severityA = getSeverityScore(a);
          const severityB = getSeverityScore(b);
          
          if (severityA !== severityB) {
            return sortDirection === 'desc' ? severityB - severityA : severityA - severityB;
          }
          
          // Si tienen la misma severidad, ordenar por porcentaje absoluto
          valueA = Math.abs(a.deviationPercentage);
          valueB = Math.abs(b.deviationPercentage);
          break;
        case 'cost':
          valueA = a.actualCost || 0;
          valueB = b.actualCost || 0;
          break;
        case 'hours':
          valueA = a.actualHours;
          valueB = b.actualHours;
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
    });
  };

  const getVarianceBadge = (percentage: number, actualHours: number, budgetedHours: number) => {
    // Si no hay horas registradas, mostrar estado especial
    if (actualHours === 0) {
      return { 
        variant: 'secondary' as const, 
        label: 'Sin Actividad',
        className: 'bg-gray-400 text-white'
      };
    }

    const absPercentage = Math.abs(percentage);
    const minHoursThreshold = budgetedHours * 0.3;
    
    // Lógica clara y descriptiva de clasificación
    if (absPercentage > 50 && actualHours > minHoursThreshold) {
      // Sobrecosto crítico: trabajó mucho Y excedió presupuesto significativamente
      return { variant: 'destructive' as const, label: 'Sobrecosto Crítico', className: 'bg-red-600 text-white' };
    } else if (absPercentage > 50 && actualHours <= minHoursThreshold) {
      // Subrendimiento: gran desviación pero por trabajar muy poco
      return { variant: 'secondary' as const, label: 'Subrendimiento', className: 'bg-purple-500 text-white' };
    } else if (absPercentage >= 25) {
      // Alto riesgo: desviación considerable
      return { variant: 'destructive' as const, label: 'Alto Riesgo', className: 'bg-orange-500 text-white' };
    } else if (absPercentage >= 10) {
      return { variant: 'outline' as const, label: 'Atención', className: 'bg-yellow-500 text-white' };
    } else {
      return { variant: 'secondary' as const, label: 'Normal', className: 'bg-green-500 text-white' };
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

  // Debug logs para verificar datos
  console.log('🔍 TeamDeviationAnalysis - Datos recibidos:', deviationData);
  if (deviationData?.deviationByRole) {
    // Usar la misma lógica inteligente del backend: desviación >50% Y horas significativas trabajadas
    const criticalCount = deviationData.deviationByRole.filter(d => {
      const absDeviation = Math.abs(d.deviationPercentage);
      const minHoursThreshold = d.budgetedHours * 0.3;
      return absDeviation > 50 && d.actualHours > minHoursThreshold;
    }).length;
    console.log('🚨 TeamDeviationAnalysis - Críticas calculadas (lógica inteligente):', criticalCount);
    console.log('🚨 TeamDeviationAnalysis - Miembros con horas:', deviationData.deviationByRole.filter(d => d.actualHours > 0));
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
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Críticas</span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {(() => {
              // Usar la misma lógica inteligente del backend: desviación >50% Y horas significativas trabajadas
              const criticalCount = deviationData.deviationByRole.filter(d => {
                const absDeviation = Math.abs(d.deviationPercentage);
                const minHoursThreshold = d.budgetedHours * 0.3;
                return absDeviation > 50 && d.actualHours > minHoursThreshold;
              }).length;
              console.log('🎯 TEAM TeamDeviationAnalysis - Críticas en resumen (lógica inteligente):', criticalCount);
              return criticalCount;
            })()}
          </div>
          <div className="text-xs text-red-600">desviaciones &gt;50%</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Altas</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) >= 25 && Math.abs(d.deviationPercentage) <= 50).length}
          </div>
          <div className="text-xs text-orange-600">desviaciones 25-50%</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Normales</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {deviationData.deviationByRole.filter(d => d.actualHours > 0 && Math.abs(d.deviationPercentage) < 10).length}
          </div>
          <div className="text-xs text-green-600">desviaciones &lt;10%</div>
        </div>
      </div>

      {/* Tabla de Análisis Detallado */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Análisis Detallado por Miembro</h3>
              <p className="text-sm text-gray-600 mt-1">
                Ordenado por {sortField === 'deviation' ? 'Criticidad' : sortField === 'cost' ? 'Costo' : 'Horas'} 
                ({sortDirection === 'desc' ? 'Mayor a Menor' : 'Menor a Mayor'})
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortField === 'deviation' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSort('deviation')}
                className="flex items-center gap-1"
              >
                Criticidad
                {sortField === 'deviation' && (
                  sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant={sortField === 'cost' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSort('cost')}
                className="flex items-center gap-1"
              >
                Costo
                {sortField === 'cost' && (
                  sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant={sortField === 'hours' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSort('hours')}
                className="flex items-center gap-1"
              >
                Horas
                {sortField === 'hours' && (
                  sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Miembro</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Desviación</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getSortedData()
                .map((deviation, index) => {
                  const badge = getVarianceBadge(deviation.deviationPercentage, deviation.actualHours, deviation.budgetedHours);
                  const progressPercentage = deviation.budgetedHours > 0 ? (deviation.actualHours / deviation.budgetedHours) * 100 : 0;
                  
                  return (
                    <tr key={index} className={`hover:bg-gray-50 transition-colors ${
                      (() => {
                        const absDeviation = Math.abs(deviation.deviationPercentage);
                        const minHoursThreshold = deviation.budgetedHours * 0.3;
                        if (absDeviation > 50 && deviation.actualHours > minHoursThreshold) return 'bg-red-25';
                        if (absDeviation > 50 && deviation.actualHours <= minHoursThreshold) return 'bg-purple-25';
                        if (absDeviation >= 25) return 'bg-orange-25';
                        return '';
                      })()
                    }`}>
                      {/* Miembro */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={`text-xs text-white font-semibold ${
                              (() => {
                                const absDeviation = Math.abs(deviation.deviationPercentage);
                                const minHoursThreshold = deviation.budgetedHours * 0.3;
                                if (absDeviation > 50 && deviation.actualHours > minHoursThreshold) return 'bg-red-500';
                                if (absDeviation > 50 && deviation.actualHours <= minHoursThreshold) return 'bg-purple-500';
                                if (absDeviation >= 25) return 'bg-orange-500';
                                if (absDeviation >= 10) return 'bg-yellow-500';
                                return 'bg-green-500';
                              })()
                            }`}>
                              {(deviation.personnelName || `P${deviation.personnelId}`).split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {deviation.personnelName || `Personal #${deviation.personnelId}`}
                            </div>
                            <div className="text-xs text-gray-500">ID: {deviation.personnelId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Horas */}
                      <td className="px-6 py-4 text-center">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">{deviation.actualHours}h</span>
                            <span className="text-gray-500"> / {deviation.budgetedHours}h</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                progressPercentage > 100 ? 'bg-red-500' :
                                progressPercentage > 80 ? 'bg-orange-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, progressPercentage)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">{progressPercentage.toFixed(0)}% progreso</div>
                        </div>
                      </td>

                      {/* Costo */}
                      <td className="px-6 py-4 text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">
                            ${deviation.actualCost?.toLocaleString() || '0'}
                          </div>
                          <div className="text-xs text-gray-500">
                            Presup: ${deviation.budgetedCost.toLocaleString()}
                          </div>
                          <div className={`text-xs font-semibold ${getVarianceColor(deviation.deviationPercentage)}`}>
                            {deviation.deviationPercentage > 0 ? '+' : ''}{deviation.deviationPercentage?.toFixed(1) || '0'}%
                          </div>
                        </div>
                      </td>

                      {/* Desviación */}
                      <td className="px-6 py-4 text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${getVarianceColor(deviation.deviationPercentage)}`}>
                            {deviation.deviationPercentage > 0 ? '+' : ''}{Math.abs(deviation.deviationPercentage)?.toFixed(1) || '0'}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {deviation.hourDeviation > 0 ? '+' : ''}{deviation.hourDeviation.toFixed(1)}h diferencia
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4 text-center">
                        <Badge variant={badge.variant} className={`px-3 py-1 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}