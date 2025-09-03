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
  timeFilter?: string;
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

export function TeamDeviationAnalysis({ projectId, dateFilter, timeFilter }: TeamDeviationAnalysisProps) {
  const [sortField, setSortField] = useState<SortField>('deviation');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Preferir timeFilter sobre dateFilter para consistencia con el sistema
  const queryParams = timeFilter 
    ? `?timeFilter=${timeFilter}`
    : dateFilter 
    ? `?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
    : '';

  const { data: deviationData, isLoading, error } = useQuery<DeviationAnalysisData>({
    queryKey: [`/api/projects/${projectId}/deviation-analysis`, timeFilter || dateFilter],
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
    // Si no hay actividad, excluir del análisis (ya filtrado en getSortedData)
    if ((deviation.actualHours || 0) === 0 && (deviation.actualCost || 0) === 0) return -1;
    
    // 🏢 CRITERIOS CORPORATIVOS DE SEVERIDAD
    const { severity, alertType, deviationType } = deviation;
    
    // Usar los criterios del backend si están disponibles
    if (alertType === 'budget_overrun' || alertType === 'estimation_issue') return 5; // Crítico
    if (alertType === 'efficiency_review') return 4; // Para revisión
    if (alertType === 'healthy_savings') return 3; // Subcosto saludable
    if (alertType === 'on_target') return 2; // Óptimo
    if (alertType === 'within_tolerance') return 1; // Tolerado
    
    // Fallback a lógica anterior si no hay criterios del backend
    const absPercentage = Math.abs(deviation.deviationPercentage || 0);
    if (absPercentage >= 100) return 5; // Crítico
    if (absPercentage >= 50) return 4;  // Alto
    if (absPercentage >= 25) return 3;  // Medio
    if (absPercentage >= 10) return 2;  // Atención
    return 1; // Normal
  };

  const getSortedData = () => {
    if (!deviationData?.deviationByRole) return [];
    
    // 🔍 FILTRAR SOLO MIEMBROS CON ACTIVIDAD REAL
    const filteredData = deviationData.deviationByRole.filter(member => {
      // Solo mostrar miembros que tengan horas trabajadas O costo real
      return member.actualHours > 0 || member.actualCost > 0;
    });
    
    console.log('🎯 FILTRO DEBUG:', {
      totalMembers: deviationData.deviationByRole.length,
      membersWithActivity: filteredData.length,
      filtered: deviationData.deviationByRole.filter(m => m.actualHours === 0 && m.actualCost === 0).map(m => m.personnelName)
    });
    
    return filteredData.sort((a, b) => {
      let valueA: number, valueB: number;
      
      switch (sortField) {
        case 'deviation':
          // Ordenar por criticidad corporativa primero
          const severityA = getSeverityScore(a);
          const severityB = getSeverityScore(b);
          
          if (severityA !== severityB) {
            return sortDirection === 'desc' ? severityB - severityA : severityA - severityB;
          }
          
          // Si tienen la misma severidad, ordenar por porcentaje absoluto
          valueA = Math.abs(a.deviationPercentage || 0);
          valueB = Math.abs(b.deviationPercentage || 0);
          break;
        case 'cost':
          valueA = a.actualCost || 0;
          valueB = b.actualCost || 0;
          break;
        case 'hours':
          valueA = a.actualHours || 0;
          valueB = b.actualHours || 0;
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
    });
  };

  // Helper function to get corporate badge for variance analysis
  const getCorporateBadge = (deviation: any) => {
    const { deviationType, alertType, severity, deviationPercentage, actualHours } = deviation;
    
    // Si no hay horas registradas, mostrar estado especial
    if (actualHours === 0) {
      return { 
        variant: 'secondary' as const, 
        label: 'Sin Actividad',
        className: 'bg-gray-400 text-white'
      };
    }
    
    // 🏢 CRITERIOS CORPORATIVOS
    if (alertType === 'budget_overrun' || (deviationType === 'sobrecosto' && severity === 'critical')) {
      return { variant: 'destructive' as const, label: 'Sobrecosto Crítico', className: 'bg-red-600 text-white' };
    } else if (alertType === 'estimation_issue' || deviationType === 'subutilizacion_critica') {
      return { variant: 'destructive' as const, label: 'Subutilización Crítica', className: 'bg-red-600 text-white' };
    } else if (alertType === 'efficiency_review' || deviationType === 'eficiencia_alta') {
      return { variant: 'secondary' as const, label: 'Eficiencia Alta', className: 'bg-blue-500 text-white' };
    } else if (alertType === 'healthy_savings' || deviationType === 'subcosto_saludable') {
      return { variant: 'secondary' as const, label: 'Subcosto Saludable', className: 'bg-green-500 text-white' };
    } else if (alertType === 'on_target' || deviationType === 'ejecucion_optima') {
      return { variant: 'secondary' as const, label: 'Ejecución Óptima', className: 'bg-purple-500 text-white' };
    } else if (alertType === 'within_tolerance' || deviationType === 'sobrecosto_tolerado') {
      return { variant: 'outline' as const, label: 'Sobrecosto Tolerado', className: 'bg-yellow-500 text-white' };
    } else {
      // Fallback para compatibilidad
      const absVariance = Math.abs(deviationPercentage || 0);
      if (absVariance > 50) {
        return { variant: 'destructive' as const, label: 'Desviación Alta', className: 'bg-orange-500 text-white' };
      } else {
        return { variant: 'secondary' as const, label: 'Normal', className: 'bg-gray-500 text-white' };
      }
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
      {/* Resumen General - Criterios Corporativos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Requieren Atención</span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {deviationData.deviationByRole.filter(d => 
              (d.actualHours > 0 || d.actualCost > 0) && 
              (d.severity === 'critical' || d.alertType === 'budget_overrun' || d.alertType === 'estimation_issue')
            ).length}
          </div>
          <div className="text-xs text-red-600">sobrecosto crítico/subutilización</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Para Revisión</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {deviationData.deviationByRole.filter(d => 
              (d.actualHours > 0 || d.actualCost > 0) && 
              (d.alertType === 'efficiency_review' || d.deviationType === 'eficiencia_alta')
            ).length}
          </div>
          <div className="text-xs text-blue-600">alta eficiencia/análisis procesos</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Subcostos Saludables</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {deviationData.deviationByRole.filter(d => 
              (d.actualHours > 0 || d.actualCost > 0) && 
              (d.deviationType === 'subcosto_saludable' || d.alertType === 'healthy_savings')
            ).length}
          </div>
          <div className="text-xs text-green-600">ahorros dentro del rango</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Ejecución Óptima</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {deviationData.deviationByRole.filter(d => 
              (d.actualHours > 0 || d.actualCost > 0) && 
              (d.deviationType === 'ejecucion_optima' || d.alertType === 'on_target')
            ).length}
          </div>
          <div className="text-xs text-purple-600">±15% del objetivo</div>
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
                  const badge = getCorporateBadge(deviation);
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
                            <span className="font-medium">{(deviation.actualHours || 0).toFixed(1)}h</span>
                            <span className="text-gray-500"> / {(deviation.budgetedHours || 0).toFixed(1)}h</span>
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
                            ${(deviation.actualCost || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </div>
                          <div className="text-xs text-gray-500">
                            Presup: ${(deviation.budgetedCost || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </div>
                          <div className={`text-xs font-semibold ${getVarianceColor(deviation.deviationPercentage)}`}>
                            {deviation.deviationPercentage > 0 ? '+' : ''}{(deviation.deviationPercentage || 0).toFixed(1)}%
                          </div>
                        </div>
                      </td>

                      {/* Desviación */}
                      <td className="px-6 py-4 text-center">
                        <div className="space-y-1">
                          <div className={`text-lg font-bold ${getVarianceColor(deviation.deviationPercentage)}`}>
                            {deviation.deviationPercentage > 0 ? '+' : ''}{Math.abs(deviation.deviationPercentage || 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {deviation.hourDeviation > 0 ? '+' : ''}{(deviation.hourDeviation || 0).toFixed(1)}h diferencia
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