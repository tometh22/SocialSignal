import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from "recharts";
import { TrendingUp, BarChart3, Activity, Calendar } from "lucide-react";
import { useState } from "react";

interface TrendChartsProps {
  projectId: number;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
}

interface TrendDataPoint {
  period: string;
  hours: number;
  cost: number;
  entries: number;
  uniqueMembers: number;
  cumulativeHours: number;
  cumulativeCost: number;
  progressPercentage: number;
  budgetUtilization: number;
  currentMarkup: number;
  averageHoursPerMember: number;
}

interface VelocityAnalysis {
  trend: string;
  velocityChange: number;
  recentAverage: number;
  historicalAverage: number;
}

interface FutureProjections {
  available: boolean;
  estimatedPeriodsToComplete?: number;
  projectedFinalCost?: number;
  projectedCompletionDate?: string;
  confidence?: string;
}

interface TrendData {
  projectId: number;
  period: string;
  trendData: TrendDataPoint[];
  velocityAnalysis: VelocityAnalysis;
  futureProjections: FutureProjections;
  summary: {
    totalPeriods: number;
    averageHoursPerPeriod: number;
    averageCostPerPeriod: number;
    peakActivity: TrendDataPoint;
  };
}

export function TrendCharts({ projectId, dateFilter }: TrendChartsProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  const queryParams = new URLSearchParams({ period });
  if (dateFilter) {
    queryParams.set('startDate', dateFilter.startDate);
    queryParams.set('endDate', dateFilter.endDate);
  }

  const { data: trendData, isLoading } = useQuery<TrendData>({
    queryKey: [`/api/projects/${projectId}/trend-data`, period, dateFilter],
    queryFn: () => fetch(`/api/projects/${projectId}/trend-data?${queryParams.toString()}`).then(res => res.json()),
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Análisis de Tendencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trendData || !trendData.trendData || trendData.trendData.length === 0 || !trendData.velocityAnalysis || !trendData.summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Análisis de Tendencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Activity className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-base font-medium text-gray-700 mb-1">Sin datos de tendencias</p>
            <p className="text-sm text-gray-500">No hay suficientes registros de tiempo para generar gráficos</p>
            <p className="text-xs text-gray-400 mt-2">Se necesitan múltiples períodos con actividad para análisis de tendencias</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatPeriodLabel = (period: string) => {
    if (trendData?.period === 'weekly') {
      return new Date(period).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    } else {
      const [year, month] = period.split('-');
      return `${month}/${year}`;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'accelerating': return 'text-green-600 bg-green-50 border-green-200';
      case 'decelerating': return 'text-red-600 bg-red-50 border-red-200';
      case 'stable': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'accelerating': return 'Acelerando';
      case 'decelerating': return 'Desacelerando';
      case 'stable': return 'Estable';
      default: return 'Insuficientes datos';
    }
  };

  // Preparar datos para los gráficos
  const chartData = trendData?.trendData?.map(point => ({
    ...point,
    periodLabel: formatPeriodLabel(point.period),
    formattedCost: point.cost / 1000 // Para mostrar en miles
  })) || [];

  return (
    <div className="space-y-6">
      
      {/* Controles y Resumen */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Análisis de Tendencias del Proyecto
            </div>
            <div className="flex items-center gap-3">
              <Select value={period} onValueChange={(value: 'weekly' | 'monthly') => setPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          
          {/* Resumen de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Períodos Totales</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{trendData.summary.totalPeriods}</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Prom. Horas/Período</span>
              </div>
              <p className="text-xl font-bold text-green-600">
                {trendData.summary.averageHoursPerPeriod.toFixed(1)}h
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Velocidad</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-purple-600">
                  {getTrendLabel(trendData.velocityAnalysis.trend)}
                </p>
                <Badge variant="outline" className={getTrendColor(trendData.velocityAnalysis.trend)}>
                  {trendData.velocityAnalysis.velocityChange > 0 ? '+' : ''}
                  {trendData.velocityAnalysis.velocityChange.toFixed(1)}%
                </Badge>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Pico de Actividad</span>
              </div>
              <p className="text-lg font-bold text-orange-600">
                {trendData.summary.peakActivity?.hours || 0}h
              </p>
              {trendData.summary.peakActivity?.period && (
                <p className="text-xs text-orange-600">
                  {formatPeriodLabel(trendData.summary.peakActivity.period)}
                </p>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Gráficos de Tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Progreso Acumulativo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progreso Acumulativo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="periodLabel" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'cumulativeHours') return [`${value}h`, 'Horas Acumuladas'];
                    if (name === 'progressPercentage') return [`${value.toFixed(1)}%`, 'Progreso'];
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="cumulativeHours" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Line type="monotone" dataKey="progressPercentage" stroke="#ef4444" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Actividad por Período */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividad por Período</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="periodLabel" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'hours') return [`${value}h`, 'Horas'];
                    if (name === 'uniqueMembers') return [`${value}`, 'Miembros Activos'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="hours" fill="#10b981" />
                <Bar dataKey="uniqueMembers" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Utilización de Presupuesto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Utilización de Presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="periodLabel" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis fontSize={12} domain={[0, 100]} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Utilización']}
                />
                <Line type="monotone" dataKey="budgetUtilization" stroke="#ef4444" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolución del Markup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolución del Markup</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="periodLabel" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(2)}x`, 'Markup']}
                />
                <Line type="monotone" dataKey="currentMarkup" stroke="#8b5cf6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Proyecciones Futuras */}
      {trendData.futureProjections.available && (
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Proyecciones Futuras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <p className="text-sm font-medium text-indigo-800 mb-1">Períodos Restantes</p>
                <p className="text-xl font-bold text-indigo-600">
                  {trendData.futureProjections.estimatedPeriodsToComplete || 'N/A'}
                </p>
                <p className="text-xs text-indigo-600">
                  {period === 'weekly' ? 'semanas' : 'meses'} estimados
                </p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <p className="text-sm font-medium text-indigo-800 mb-1">Fecha Estimada</p>
                <p className="text-lg font-bold text-indigo-600">
                  {trendData.futureProjections.projectedCompletionDate 
                    ? new Date(trendData.futureProjections.projectedCompletionDate).toLocaleDateString('es-ES')
                    : 'N/A'
                  }
                </p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <p className="text-sm font-medium text-indigo-800 mb-1">Confianza</p>
                <Badge variant={
                  trendData.futureProjections.confidence === 'high' ? 'default' : 
                  trendData.futureProjections.confidence === 'medium' ? 'secondary' : 'outline'
                }>
                  {trendData.futureProjections.confidence === 'high' ? 'Alta' :
                   trendData.futureProjections.confidence === 'medium' ? 'Media' : 'Baja'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}