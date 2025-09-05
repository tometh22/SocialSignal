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

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Total Registrado */}
          <Card className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
            cards.totalRegistrado.porcentajeRegistrado >= 100 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-t-4 border-t-red-500'
              : cards.totalRegistrado.porcentajeRegistrado >= 85
                ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-t-4 border-t-amber-500'
                : cards.totalRegistrado.porcentajeRegistrado >= 70
                  ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-t-4 border-t-emerald-500'
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 border-t-4 border-t-blue-500'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    cards.totalRegistrado.porcentajeRegistrado >= 100 
                      ? 'bg-red-100'
                      : cards.totalRegistrado.porcentajeRegistrado >= 85
                        ? 'bg-amber-100'
                        : cards.totalRegistrado.porcentajeRegistrado >= 70
                          ? 'bg-emerald-100'
                          : 'bg-blue-100'
                  }`}>
                    <BarChart3 className={`w-5 h-5 ${
                      cards.totalRegistrado.porcentajeRegistrado >= 100 
                        ? 'text-red-600'
                        : cards.totalRegistrado.porcentajeRegistrado >= 85
                          ? 'text-amber-600'
                          : cards.totalRegistrado.porcentajeRegistrado >= 70
                            ? 'text-emerald-600'
                            : 'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Total Registrado</h3>
                    <p className="text-xs text-gray-500">vs objetivo</p>
                  </div>
                </div>
                {cards.totalRegistrado.porcentajeRegistrado >= 100 && (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="space-y-3">
                <div className={`text-3xl font-bold ${
                  cards.totalRegistrado.porcentajeRegistrado >= 100 
                    ? 'text-red-600'
                    : cards.totalRegistrado.porcentajeRegistrado >= 85
                      ? 'text-amber-600'
                      : cards.totalRegistrado.porcentajeRegistrado >= 70
                        ? 'text-emerald-600'
                        : 'text-blue-600'
                }`}>
                  {cards.totalRegistrado.porcentajeRegistrado}%
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {cards.totalRegistrado.horasRegistradas}h de {cards.totalRegistrado.horasObjetivo}h
                </div>
                <Progress 
                  value={Math.min(cards.totalRegistrado.porcentajeRegistrado, 100)} 
                  className={`h-2 bg-gray-200 ${
                    cards.totalRegistrado.porcentajeRegistrado >= 100 
                      ? '[&>div]:bg-red-500'
                      : cards.totalRegistrado.porcentajeRegistrado >= 85
                        ? '[&>div]:bg-amber-500'
                        : cards.totalRegistrado.porcentajeRegistrado >= 70
                          ? '[&>div]:bg-emerald-500'
                          : '[&>div]:bg-blue-500'
                  }`}
                />
                {cards.totalRegistrado.porcentajeRegistrado >= 100 && (
                  <div className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded">
                    ⚠️ Exceso: +{(cards.totalRegistrado.porcentajeRegistrado - 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Miembros Activos */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-emerald-50 to-emerald-100 border-t-4 border-t-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Miembros Activos</h3>
                    <p className="text-xs text-gray-500">del equipo</p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold">
                  {Math.round((cards.miembrosActivos.activos / cards.miembrosActivos.asignados) * 100)}%
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="text-3xl font-bold text-emerald-600">
                  {cards.miembrosActivos.activos}
                </div>
                <div className="text-sm font-medium text-gray-700">
                  de {cards.miembrosActivos.asignados} asignados
                </div>
                <Progress 
                  value={(cards.miembrosActivos.activos / cards.miembrosActivos.asignados) * 100} 
                  className="h-2 bg-gray-200 [&>div]:bg-emerald-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Promedio Diario */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100 border-t-4 border-t-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Promedio Diario</h3>
                    <p className="text-xs text-gray-500">por miembro</p>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modo {configuracion.modoPromedio}: h_trab / (miembros_activos × días_transcurridos)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-3">
                <div className="text-3xl font-bold text-purple-600">
                  {cards.promedioDiario.promedio}h
                </div>
                <div className="text-sm font-medium text-gray-700">
                  en {configuracion.diasTranscurridos} días hábiles
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horas Trabajadas */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-50 to-orange-100 border-t-4 border-t-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-100">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Horas Trabajadas</h3>
                  <p className="text-xs text-gray-500">total del equipo</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-3xl font-bold text-orange-600">
                  {cards.horasTrabajadas.horas}
                </div>
                <div className="text-sm font-medium text-gray-700">
                  de {cards.horasTrabajadas.estimadas} estimadas
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eficiencia de Tiempo */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-indigo-50 to-indigo-100 border-t-4 border-t-indigo-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Gauge className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Eficiencia Promedio</h3>
                  <p className="text-xs text-gray-500">del equipo</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-3xl font-bold text-indigo-600">
                  {Math.round(miembros.reduce((acc, m) => acc + m.porcentaje_progreso, 0) / miembros.length || 0)}%
                </div>
                <div className="text-sm font-medium text-gray-700">
                  eficiencia general
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel de configuración */}
        <div className="mb-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Configuración de Tiempo</h4>
                <p className="text-sm text-gray-500">Parámetros del análisis</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="bg-white hover:bg-gray-50 border-gray-300"
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Registro por Miembro</h3>
            <p className="text-sm text-gray-500 mt-1">{miembros.length} miembros del equipo</p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="sort-mode" className="text-sm font-medium text-gray-700">Ordenar por:</Label>
            <select
              id="sort-mode"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'brecha' | 'porcentaje')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="brecha">Brecha a objetivo</option>
              <option value="porcentaje">Porcentaje completado</option>
            </select>
          </div>
        </div>

        {/* Lista de miembros */}
        <div className="space-y-4">
          {miembrosOrdenados.map((miembro, index) => {
            const isOverBudget = miembro.porcentaje_progreso >= 100;
            const isAtRisk = miembro.porcentaje_progreso >= 85 && miembro.porcentaje_progreso < 100;
            const isOnTrack = miembro.porcentaje_progreso >= 70 && miembro.porcentaje_progreso < 85;
            const isUnderPerforming = miembro.porcentaje_progreso < 70;
            
            return (
              <div
                key={`${miembro.persona}-${index}`}
                className={`flex items-center justify-between p-6 rounded-xl border transition-all hover:shadow-lg hover:scale-[1.02] duration-300 ${
                  isOverBudget 
                    ? 'bg-gradient-to-r from-red-50 via-red-25 to-white border-red-200 shadow-red-100'
                    : isAtRisk
                      ? 'bg-gradient-to-r from-amber-50 via-amber-25 to-white border-amber-200 shadow-amber-100'
                      : isOnTrack
                        ? 'bg-gradient-to-r from-emerald-50 via-emerald-25 to-white border-emerald-200 shadow-emerald-100'
                        : 'bg-gradient-to-r from-blue-50 via-blue-25 to-white border-blue-200 shadow-blue-100'
                } shadow-lg`}
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