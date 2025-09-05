import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  timeFilter: string;
  cards: {
    totalRegistrado: {
      horasRegistradas: number;
      horasObjetivo: number;
      porcentajeRegistrado: number;
    };
    miembrosActivos: {
      activos: number;
      asignados: number;
    };
    promedioDiario: {
      promedio: number;
      modo: string;
    };
    horasTrabajadas: {
      horas: number;
      estimadas: number;
    };
    costoReal: {
      real: number;
      estimado: number;
    };
  };
  miembros: Array<{
    persona: string;
    rol: string;
    hrs_real: number;
    hrs_obj: number;
    porcentaje_progreso: number;
    estado: 'completo' | 'parcial' | 'sin_registro';
    costo_usd: number;
    rate_usd: number;
    brecha_objetivo: number;
  }>;
  configuracion: {
    modoPromedio: string;
    umbralCompleto: number;
    diasHabilesMes: number;
    diasTranscurridos: number;
    mostrarRate: boolean;
  };
  validaciones: {
    noDataForPeriod: boolean;
    conciliacionCosto: boolean;
    conciliacionHoras: boolean;
  };
  generatedAt: string;
}

export default function TimeTracking({ projectId, timeFilter }: TimeTrackingProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [sortMode, setSortMode] = useState<'brecha' | 'porcentaje'>('brecha');

  const { data: timeData, isLoading, error } = useQuery<TimeTrackingData>({
    queryKey: [`/api/projects/${projectId}/time-tracking?timeFilter=${timeFilter}`, timeFilter],
    enabled: !!projectId
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

  const { cards, miembros, configuracion, validaciones } = timeData;

  // Función para obtener estado del miembro
  const getMemberStatus = (porcentaje: number) => {
    if (porcentaje > 100) return { status: 'exceso', color: 'red', icon: AlertTriangle };
    if (porcentaje === 100) return { status: 'perfecto', color: 'emerald', icon: CheckCircle };
    if (porcentaje >= 85) return { status: 'riesgo', color: 'amber', icon: Clock };
    if (porcentaje >= 70) return { status: 'bien', color: 'emerald', icon: CheckCircle };
    return { status: 'bajo', color: 'blue', icon: Info };
  };

  // Ordenar miembros
  const miembrosOrdenados = [...miembros].sort((a, b) => {
    if (sortMode === 'brecha') {
      return b.brecha_objetivo - a.brecha_objetivo;
    } else {
      return b.porcentaje_progreso - a.porcentaje_progreso;
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
              Período: <span className="font-medium">{timeFilter.replace('_', ' ').toUpperCase()}</span> • 
              Solo datos de tiempo (sin información financiera)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {showConfig ? 'Ocultar Config' : 'Configurar'}
            </Button>
          </div>
        </div>

        {/* Panel de configuración */}
        {showConfig && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-700">Modo Promedio Diario</Label>
                <p className="text-sm text-gray-500 mt-1">{configuracion.modoPromedio}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Umbral "Completo"</Label>
                <p className="text-sm text-gray-500 mt-1">{configuracion.umbralCompleto}% del objetivo</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Período Analizado</Label>
                <p className="text-sm text-gray-500 mt-1">{configuracion.diasTranscurridos} días hábiles</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alertas */}
      {validaciones.noDataForPeriod && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Sin datos para el período</h4>
              <p className="text-sm text-red-700 mt-1">
                No se encontraron registros de tiempo para {timeFilter}. Verifica los datos del Excel MAESTRO.
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
                {cards.totalRegistrado.porcentajeRegistrado}%
              </div>
              <div className="text-xs text-gray-700">
                {cards.totalRegistrado.horasRegistradas}h de {cards.totalRegistrado.horasObjetivo}h
              </div>
              <Progress 
                value={Math.min(cards.totalRegistrado.porcentajeRegistrado, 100)} 
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
                {cards.miembrosActivos.activos}
              </div>
              <div className="text-xs text-gray-700">
                de {cards.miembrosActivos.asignados} asignados
              </div>
              <Progress 
                value={(cards.miembrosActivos.activos / cards.miembrosActivos.asignados) * 100} 
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
                {cards.horasTrabajadas.horas}h
              </div>
              <div className="text-xs text-gray-700">
                de {cards.horasTrabajadas.estimadas}h estimadas
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
                {cards.promedioDiario.promedio}h
              </div>
              <div className="text-xs text-gray-700">
                en {configuracion.diasTranscurridos} días hábiles
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
              <p className="text-sm text-gray-500 mt-1">{miembros.length} miembros en el equipo</p>
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
            {miembrosOrdenados.map((miembro, index) => {
              const memberStatus = getMemberStatus(miembro.porcentaje_progreso);
              const StatusIcon = memberStatus.icon;
              
              return (
                <div
                  key={`${miembro.persona}-${index}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    {/* Información del miembro */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-full bg-${memberStatus.color}-100`}>
                        <StatusIcon className={`w-4 h-4 text-${memberStatus.color}-600`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-base">{miembro.persona}</h4>
                            {miembro.rol && (
                              <p className="text-sm text-gray-600">{miembro.rol}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900">{miembro.hrs_real}h</div>
                            <div className="text-xs text-gray-500">trabajadas</div>
                          </div>
                        </div>
                        
                        {/* Barra de progreso */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                              {miembro.hrs_real}h de {miembro.hrs_obj}h objetivo
                            </span>
                            <span className={`font-bold text-${memberStatus.color}-600`}>
                              {miembro.porcentaje_progreso}%
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(miembro.porcentaje_progreso, 100)}
                            className={`h-2 bg-gray-200 [&>div]:bg-${memberStatus.color}-500`}
                          />
                          
                          {/* Indicadores adicionales */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge 
                                className={`bg-${memberStatus.color}-100 text-${memberStatus.color}-800 border-${memberStatus.color}-300`}
                              >
                                {miembro.estado === 'completo' && '✅ Completo'}
                                {miembro.estado === 'parcial' && '⏳ Parcial'}
                                {miembro.estado === 'sin_registro' && '❌ Sin registro'}
                              </Badge>
                              {miembro.porcentaje_progreso > 100 && (
                                <Badge className="bg-red-500 text-white">
                                  🚨 Exceso tiempo
                                </Badge>
                              )}
                              {miembro.porcentaje_progreso === 100 && (
                                <Badge className="bg-emerald-500 text-white">
                                  ✅ Objetivo cumplido
                                </Badge>
                              )}
                            </div>
                            
                            {/* Brecha */}
                            {miembro.brecha_objetivo !== 0 && (
                              <div className={`text-sm font-medium ${
                                miembro.brecha_objetivo > 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}>
                                {miembro.brecha_objetivo > 0 ? '↗️' : '↙️'} 
                                Brecha: {miembro.brecha_objetivo > 0 ? '+' : ''}{miembro.brecha_objetivo}h
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

          {miembros.length === 0 && (
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
          <span>Generado: {new Date(timeData.generatedAt).toLocaleString()}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Análisis exclusivo de tiempo
          </span>
        </div>
      </div>
    </div>
  );
}