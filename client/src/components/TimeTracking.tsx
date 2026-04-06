import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/queryClient';
import { 
  Clock, 
  Users, 
  TrendingUp, 
  Calendar,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  BarChart3,
  Gauge,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TimeTrackingProps {
  projectId: number;
  timeFilter: string;
}

interface TimeTrackingData {
  projectId: number;
  period: string;
  summary: {
    membersActive: number;
    totalAsanaHours: number;
    estimatedHours: number;
    progressPct: number;
    avgDailyHoursPerMember: number;
  };
  members: Array<{
    personId: string | number;
    name: string;
    roleName: string;
    targetHours: number;
    hoursAsana: number;
    hoursBilling: number;
    status: 'exceso' | 'cumplido' | 'pendiente';
    badges: string[];
  }>;
}

// Convertir timeFilter a period (e.g. "august_2025" → "2025-08")
function convertTimeFilterToPeriod(timeFilter: string): string {
  const monthMap: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  };
  
  const match = timeFilter.match(/^(\w+)_(\d+)$/);
  if (match) {
    const [, month, year] = match;
    return `${year}-${monthMap[month.toLowerCase()] || '01'}`;
  }
  return timeFilter;
}

export default function TimeTracking({ projectId, timeFilter }: TimeTrackingProps) {
  const [sortMode, setSortMode] = useState<'brecha' | 'porcentaje'>('brecha');

  // Convertir timeFilter a period
  const period = convertTimeFilterToPeriod(timeFilter);

  const { data: timeData, isLoading, error } = useQuery<TimeTrackingData>({
    queryKey: [`/api/projects/${projectId}/time-tracking`, period],
    queryFn: () => authFetch(`/api/projects/${projectId}/time-tracking?period=${period}`).then(res => res.json()),
    enabled: !!projectId && !!period
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="text-lg font-medium text-gray-600">Cargando análisis de tiempo...</span>
        </div>
      </div>
    );
  }

  if (error || !timeData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
          <p className="text-gray-600">No se pudieron cargar los datos de tiempo del proyecto</p>
        </div>
      </div>
    );
  }

  // Guards defensivos para evitar spreads sobre undefined/null
  const summary = timeData?.summary ?? {
    totalAsanaHours: 0,
    estimatedHours: 0,
    progressPct: 0,
    membersActive: 0,
    avgDailyHoursPerMember: 0
  };
  
  const members = Array.isArray(timeData?.members) ? timeData.members : [];

  // Función para obtener color según status
  const statusColorMap: Record<string, { bg100: string; text600: string; text800: string; progressBg: string }> = {
    red: { bg100: 'bg-red-100', text600: 'text-red-600', text800: 'text-red-800', progressBg: '[&>div]:bg-red-500' },
    emerald: { bg100: 'bg-emerald-100', text600: 'text-emerald-600', text800: 'text-emerald-800', progressBg: '[&>div]:bg-emerald-500' },
    blue: { bg100: 'bg-blue-100', text600: 'text-blue-600', text800: 'text-blue-800', progressBg: '[&>div]:bg-blue-500' },
  };

  const getStatusColor = (status: string) => {
    if (status === 'exceso') return { color: 'red', icon: AlertTriangle };
    if (status === 'cumplido') return { color: 'emerald', icon: CheckCircle };
    return { color: 'blue', icon: Clock };
  };

  // Ordenar miembros
  const miembrosOrdenados = [...members].sort((a, b) => {
    const brechaA = a.hoursAsana - a.targetHours;
    const brechaB = b.hoursAsana - b.targetHours;
    
    if (sortMode === 'brecha') {
      return brechaB - brechaA;
    } else {
      const pctA = a.targetHours > 0 ? (a.hoursAsana / a.targetHours) * 100 : 0;
      const pctB = b.targetHours > 0 ? (b.hoursAsana / b.targetHours) * 100 : 0;
      return pctB - pctA;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              Análisis de Tiempo
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              Período: <span className="font-medium">{period}</span> • 
              Datos del Excel MAESTRO
            </p>
          </div>
        </div>
      </div>

      {/* Alerta si no hay datos */}
      {summary.totalAsanaHours === 0 && members.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Sin datos para el período</h4>
              <p className="text-sm text-red-700 mt-1">
                No se encontraron registros de tiempo para {period}. Verifica los datos del Excel MAESTRO.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progreso General */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-md">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Progreso Total</h3>
                  <p className="text-xs text-gray-600">vs objetivo</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-blue-600">
                {(summary.progressPct * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-700">
                {summary.totalAsanaHours}h de {summary.estimatedHours}h
              </div>
              <Progress 
                value={Math.min(summary.progressPct * 100, 100)} 
                className="h-1.5 bg-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Equipo Activo */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 rounded-md">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Equipo Activo</h3>
                  <p className="text-xs text-gray-600">miembros trabajando</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-emerald-600">
                {summary.membersActive}
              </div>
              <div className="text-xs text-gray-700">
                de {members.length} asignados
              </div>
              <Progress 
                value={(summary.membersActive / Math.max(members.length, 1)) * 100} 
                className="h-1.5 bg-gray-200 [&>div]:bg-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Horas Totales */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-600 rounded-md">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Horas Trabajadas</h3>
                  <p className="text-xs text-gray-600">total del período</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-orange-600">
                {summary.totalAsanaHours}h
              </div>
              <div className="text-xs text-gray-700">
                de {summary.estimatedHours}h estimadas
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Promedio Diario */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-600 rounded-md">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Promedio Diario</h3>
                  <p className="text-xs text-gray-600">por miembro activo</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-purple-600">
                {summary.avgDailyHoursPerMember}h
              </div>
              <div className="text-xs text-gray-700">
                promedio del período
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de miembros */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-gray-900">Detalle por Miembro</CardTitle>
              <p className="text-sm text-gray-500 mt-1">{members.length} miembros en el equipo</p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-gray-700">Ordenar por:</Label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'brecha' | 'porcentaje')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="brecha">Brecha a objetivo</option>
                <option value="porcentaje">Porcentaje completado</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {miembrosOrdenados.map((m, index) => {
              const statusInfo = getStatusColor(m.status);
              const StatusIcon = statusInfo.icon;
              const sc = statusColorMap[statusInfo.color] || statusColorMap.blue;
              const porcentaje = m.targetHours > 0 ? (m.hoursAsana / m.targetHours) * 100 : 0;
              const brecha = m.hoursAsana - m.targetHours;

              return (
                <div
                  key={`${m.personId}-${index}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-full ${sc.bg100}`}>
                        <StatusIcon className={`w-4 h-4 ${sc.text600}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-base">{m.name}</h4>
                            {m.roleName && m.roleName !== 'N/A' && (
                              <p className="text-sm text-gray-600">{m.roleName}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900">{m.hoursAsana}h</div>
                            <div className="text-xs text-gray-500">trabajadas</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                              {m.hoursAsana}h de {m.targetHours}h objetivo
                            </span>
                            <span className={`font-bold ${sc.text600}`}>
                              {porcentaje.toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(porcentaje, 100)}
                            className={`h-2 bg-gray-200 ${sc.progressBg}`}
                          />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {m.badges.map((badge, i) => (
                                <Badge
                                  key={i}
                                  className={`${sc.bg100} ${sc.text800}`}
                                >
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                            
                            {brecha !== 0 && (
                              <div className={`text-sm font-medium ${
                                brecha > 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}>
                                {brecha > 0 ? '↗️' : '↙️'} 
                                Brecha: {brecha > 0 ? '+' : ''}{brecha.toFixed(2)}h
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {members.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 mb-2">Sin registros de tiempo</h3>
              <p className="text-sm text-gray-500">No se encontraron registros para este período</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 py-3">
        <div className="flex items-center justify-center gap-3">
          <span>Período: {period}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Datos del Excel MAESTRO
          </span>
        </div>
      </div>
    </div>
  );
}