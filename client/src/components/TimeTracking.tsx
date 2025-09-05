import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Clock, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  BarChart3
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
  const [sortMode, setSortMode] = useState<'brecha' | 'costo'>('brecha');

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
      return b.costo_usd - a.costo_usd; // Por costo descendente
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
          Datos de tiempo trabajado y objetivos según Excel MAESTRO y Asana
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
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Total Registrado</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {cards.totalRegistrado.porcentajeRegistrado}%
                </div>
                <div className="text-xs text-gray-600">
                  {cards.totalRegistrado.horasRegistradas}h / {cards.totalRegistrado.horasObjetivo}h
                </div>
                <Progress 
                  value={cards.totalRegistrado.porcentajeRegistrado} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Miembros Activos */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Miembros Activos</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {cards.miembrosActivos.activos}
                </div>
                <div className="text-xs text-gray-600">
                  de {cards.miembrosActivos.asignados} asignados
                </div>
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

          {/* Costo Real */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium">Costo Real</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  ${cards.costoReal.real.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  de ${cards.costoReal.estimado.toLocaleString()} estimado
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
              onChange={(e) => setSortMode(e.target.value as 'brecha' | 'costo')}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="brecha">Brecha a objetivo</option>
              <option value="costo">Costo USD</option>
            </select>
          </div>
        </div>

        {/* Lista de miembros */}
        <div className="space-y-3">
          {miembrosOrdenados.map((miembro, index) => (
            <div
              key={`${miembro.persona}-${index}`}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(miembro.estado)}
                  <div>
                    <h4 className="font-medium text-gray-900">{miembro.persona}</h4>
                    {miembro.rol && (
                      <p className="text-sm text-gray-500">{miembro.rol}</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 max-w-xs">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>{miembro.hrs_real}h / {miembro.hrs_obj}h</span>
                    <span>{miembro.porcentaje_progreso}%</span>
                  </div>
                  <Progress 
                    value={Math.min(miembro.porcentaje_progreso, 100)}
                    className="h-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-lg">
                    ${miembro.costo_usd.toLocaleString()}
                  </div>
                  {configuracion.mostrarRate && miembro.rate_usd > 0 && (
                    <div className="text-xs text-gray-500">
                      ${miembro.rate_usd.toFixed(2)}/h
                    </div>
                  )}
                </div>
                
                <Badge variant={getBadgeVariantByStatus(miembro.estado)}>
                  {miembro.estado === 'completo' && 'Completo'}
                  {miembro.estado === 'parcial' && 'Parcial'}
                  {miembro.estado === 'sin_registro' && 'Sin registro'}
                </Badge>
              </div>
            </div>
          ))}
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
              <span className={validaciones.conciliacionCosto ? 'text-green-600' : 'text-red-600'}>
                ✓ Conciliación costos: {validaciones.conciliacionCosto ? 'OK' : 'Error'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}