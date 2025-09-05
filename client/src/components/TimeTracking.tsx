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
  Gauge
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
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Cargando datos de tiempo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !timeData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Error al cargar datos de tiempo del proyecto
          </div>
        </CardContent>
      </Card>
    );
  }

  const { cards, miembros, configuracion, validaciones } = timeData;

  // Función para obtener color de badge según estado
  const getBadgeVariantByStatus = (estado: string) => {
    switch (estado) {
      case 'completo':
        return 'default'; // Verde
      case 'parcial':
        return 'secondary'; // Amarillo
      case 'sin_registro':
        return 'destructive'; // Rojo
      default:
        return 'outline';
    }
  };

  // Función para obtener ícono según estado
  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'completo':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'parcial':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'sin_registro':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  // Ordenar miembros según modo seleccionado
  const miembrosOrdenados = [...miembros].sort((a, b) => {
    if (sortMode === 'brecha') {
      return b.brecha_objetivo - a.brecha_objetivo; // Por brecha descendente
    } else {
      return b.porcentaje_progreso - a.porcentaje_progreso; // Por porcentaje descendente
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Registro de Tiempo - {timeFilter.replace('_', ' ').toUpperCase()}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Análisis exclusivo de tiempo trabajado vs objetivos (sin costos)
        </p>
      </CardHeader>

      <CardContent>
        {/* Validaciones y alertas */}
        {validaciones.noDataForPeriod && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Sin datos de tiempo para el período seleccionado</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              No se encontraron registros de tiempo para el período {timeFilter}. 
              Verifica que el Excel MAESTRO tenga datos para este período.
            </p>
          </div>
        )}

        {(!validaciones.conciliacionCosto || !validaciones.conciliacionHoras) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Advertencia de conciliación</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              {!validaciones.conciliacionHoras && "Las horas totales no coinciden entre cards y lista. "}
              {!validaciones.conciliacionCosto && "Los costos totales no coinciden entre cards y lista. "}
              Revisa los datos del Excel MAESTRO.
            </p>
          </div>
        )}

        {/* Cards superiores según data contract */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Total Registrado */}
          <Card className={`border-l-4 ${
            cards.totalRegistrado.porcentajeRegistrado >= 100 
              ? 'border-l-red-500 bg-gradient-to-br from-red-50 to-red-25'
              : cards.totalRegistrado.porcentajeRegistrado >= 85
                ? 'border-l-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-25'
                : cards.totalRegistrado.porcentajeRegistrado >= 70
                  ? 'border-l-green-500 bg-gradient-to-br from-green-50 to-green-25'
                  : 'border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-25'
          } shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className={`w-4 h-4 ${
                    cards.totalRegistrado.porcentajeRegistrado >= 100 
                      ? 'text-red-600'
                      : cards.totalRegistrado.porcentajeRegistrado >= 85
                        ? 'text-yellow-600'
                        : cards.totalRegistrado.porcentajeRegistrado >= 70
                          ? 'text-green-600'
                          : 'text-blue-600'
                  }`} />
                  <span className="text-sm font-medium">Total Registrado</span>
                </div>
                {cards.totalRegistrado.porcentajeRegistrado >= 100 && (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${
                  cards.totalRegistrado.porcentajeRegistrado >= 100 
                    ? 'text-red-700'
                    : cards.totalRegistrado.porcentajeRegistrado >= 85
                      ? 'text-yellow-700'
                      : cards.totalRegistrado.porcentajeRegistrado >= 70
                        ? 'text-green-700'
                        : 'text-blue-700'
                }`}>
                  {cards.totalRegistrado.porcentajeRegistrado}%
                </div>
                <div className="text-xs text-gray-600">
                  {cards.totalRegistrado.horasRegistradas}h / {cards.totalRegistrado.horasObjetivo}h
                </div>
                <Progress 
                  value={Math.min(cards.totalRegistrado.porcentajeRegistrado, 100)} 
                  className={`h-3 ${
                    cards.totalRegistrado.porcentajeRegistrado >= 100 
                      ? '[&>div]:bg-red-500'
                      : cards.totalRegistrado.porcentajeRegistrado >= 85
                        ? '[&>div]:bg-yellow-500'
                        : cards.totalRegistrado.porcentajeRegistrado >= 70
                          ? '[&>div]:bg-green-500'
                          : '[&>div]:bg-blue-500'
                  }`}
                />
                {cards.totalRegistrado.porcentajeRegistrado >= 100 && (
                  <div className="text-xs text-red-600 font-medium">
                    ⚠️ Exceso de {(cards.totalRegistrado.porcentajeRegistrado - 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Miembros Activos */}
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-green-25 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Miembros Activos</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {Math.round((cards.miembrosActivos.activos / cards.miembrosActivos.asignados) * 100)}%
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-green-700">
                  {cards.miembrosActivos.activos}
                </div>
                <div className="text-xs text-gray-600">
                  de {cards.miembrosActivos.asignados} asignados
                </div>
                <Progress 
                  value={(cards.miembrosActivos.activos / cards.miembrosActivos.asignados) * 100} 
                  className="h-2 [&>div]:bg-green-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Promedio Diario */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">Promedio Diario</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modo {configuracion.modoPromedio}: h_trab / (miembros_activos × días_transcurridos)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {cards.promedioDiario.promedio}h
                </div>
                <div className="text-xs text-gray-600">
                  por miembro ({configuracion.diasTranscurridos}d hábiles)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horas Trabajadas */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium">Horas Trabajadas</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {cards.horasTrabajadas.horas}
                </div>
                <div className="text-xs text-gray-600">
                  de {cards.horasTrabajadas.estimadas} estimadas
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eficiencia de Tiempo */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium">Eficiencia Promedio</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-indigo-700">
                  {Math.round(miembros.reduce((acc, m) => acc + m.porcentaje_progreso, 0) / miembros.length || 0)}%
                </div>
                <div className="text-xs text-gray-600">
                  promedio del equipo
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel de configuración */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuración de Tiempo
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? 'Ocultar' : 'Configurar'}
            </Button>
          </div>

          {showConfig && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="modo-promedio">Modo Promedio Diario</Label>
                <div className="text-sm text-gray-600">
                  Actual: {configuracion.modoPromedio}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="umbral-completo">Umbral "Completo"</Label>
                <div className="text-sm text-gray-600">
                  {configuracion.umbralCompleto}% de objetivo
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="mostrar-rate" 
                  checked={configuracion.mostrarRate}
                  disabled
                />
                <Label htmlFor="mostrar-rate">Mostrar $/h</Label>
              </div>
            </div>
          )}
        </div>

        {/* Controles de lista */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Registro por Miembro</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort-mode" className="text-sm">Ordenar por:</Label>
            <select
              id="sort-mode"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'brecha' | 'porcentaje')}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="brecha">Brecha a objetivo</option>
              <option value="porcentaje">Porcentaje completado</option>
            </select>
          </div>
        </div>

        {/* Lista de miembros */}
        <div className="space-y-3">
          {miembrosOrdenados.map((miembro, index) => {
            const isOverBudget = miembro.porcentaje_progreso >= 100;
            const isAtRisk = miembro.porcentaje_progreso >= 85 && miembro.porcentaje_progreso < 100;
            const isOnTrack = miembro.porcentaje_progreso >= 70 && miembro.porcentaje_progreso < 85;
            const isUnderPerforming = miembro.porcentaje_progreso < 70;
            
            return (
              <div
                key={`${miembro.persona}-${index}`}
                className={`flex items-center justify-between p-4 border-l-4 rounded-lg transition-all hover:shadow-md ${
                  isOverBudget 
                    ? 'border-l-red-500 bg-gradient-to-r from-red-50 to-white border border-red-200'
                    : isAtRisk
                      ? 'border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-white border border-yellow-200'
                      : isOnTrack
                        ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-white border border-green-200'
                        : 'border-l-blue-500 bg-gradient-to-r from-blue-50 to-white border border-blue-200'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      isOverBudget 
                        ? 'bg-red-100'
                        : isAtRisk
                          ? 'bg-yellow-100'
                          : isOnTrack
                            ? 'bg-green-100'
                            : 'bg-blue-100'
                    }`}>
                      {getStatusIcon(miembro.estado)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        {miembro.persona}
                        {isOverBudget && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        {isAtRisk && <Clock className="w-4 h-4 text-yellow-600" />}
                      </h4>
                      {miembro.rol && (
                        <p className="text-sm text-gray-500">{miembro.rol}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 max-w-xs">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={`font-medium ${
                        isOverBudget 
                          ? 'text-red-700'
                          : isAtRisk
                            ? 'text-yellow-700'
                            : isOnTrack
                              ? 'text-green-700'
                              : 'text-blue-700'
                      }`}>
                        {miembro.hrs_real}h / {miembro.hrs_obj}h
                      </span>
                      <span className={`font-bold ${
                        isOverBudget 
                          ? 'text-red-700'
                          : isAtRisk
                            ? 'text-yellow-700'
                            : isOnTrack
                              ? 'text-green-700'
                              : 'text-blue-700'
                      }`}>
                        {miembro.porcentaje_progreso}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(miembro.porcentaje_progreso, 100)}
                      className={`h-3 ${
                        isOverBudget 
                          ? '[&>div]:bg-red-500'
                          : isAtRisk
                            ? '[&>div]:bg-yellow-500'
                            : isOnTrack
                              ? '[&>div]:bg-green-500'
                              : '[&>div]:bg-blue-500'
                      }`}
                    />
                    {/* Indicador de exceso */}
                    {isOverBudget && (
                      <div className="text-xs text-red-600 font-medium mt-1">
                        ⚠️ Exceso: +{(miembro.porcentaje_progreso - 100).toFixed(1)}%
                      </div>
                    )}
                    {/* Indicador de brecha */}
                    {miembro.brecha_objetivo !== 0 && (
                      <div className={`text-xs mt-1 font-medium ${
                        miembro.brecha_objetivo > 0 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {miembro.brecha_objetivo > 0 ? '↗️' : '↙️'} Brecha: {miembro.brecha_objetivo > 0 ? '+' : ''}{miembro.brecha_objetivo}h
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-bold text-lg text-gray-700">
                      {miembro.hrs_real}h
                    </div>
                    <div className="text-xs text-gray-500">
                      trabajadas
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Badge 
                      variant={getBadgeVariantByStatus(miembro.estado)}
                      className={`${
                        miembro.estado === 'completo' 
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : miembro.estado === 'parcial'
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                      }`}
                    >
                      {miembro.estado === 'completo' && '✅ Completo'}
                      {miembro.estado === 'parcial' && '⏳ Parcial'}
                      {miembro.estado === 'sin_registro' && '❌ Sin registro'}
                    </Badge>
                    {/* Badge adicional para alertas de tiempo */}
                    {isOverBudget && (
                      <Badge variant="destructive" className="text-xs">
                        🚨 Exceso tiempo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {miembros.length === 0 && !validaciones.noDataForPeriod && (
          <div className="text-center py-8 text-gray-500">
            No se encontraron registros de tiempo para este período
          </div>
        )}

        {/* Footer con información de conciliación */}
        <div className="mt-6 pt-4 border-t text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>
              Generado: {new Date(timeData.generatedAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-4">
              <span className={validaciones.conciliacionHoras ? 'text-green-600' : 'text-red-600'}>
                ✓ Conciliación horas: {validaciones.conciliacionHoras ? 'OK' : 'Error'}
              </span>
              <span className="text-blue-600">
                📊 Análisis solo tiempo
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}