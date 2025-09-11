
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Calendar,
  ArrowUpIcon,
  ArrowDownIcon,
  AlertTriangle,
  Info,
  PieChart,
  BarChart3,
  Zap,
  Calculator,
  Building2,
  Users,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

interface IncomeData {
  totalIncome: number;
  targetIncome: number;
  variance: number;
  projects: ProjectIncomeData[];
  monthlyTrend: MonthlyIncomeData[];
  clientBreakdown: ClientIncomeData[];
  bySource: IncomeBySource[];
  summary: IncomeSummary;
}

interface ProjectIncomeData {
  id: number;
  name: string;
  clientName: string;
  income: number;
  target: number;
  variance: number;
  status: 'on_track' | 'over_target' | 'under_target';
  percentage: number;
}

interface MonthlyIncomeData {
  month: string;
  income: number;
  target: number;
  cumulative: number;
}

interface ClientIncomeData {
  clientName: string;
  income: number;
  percentage: number;
  projectCount: number;
}

interface IncomeBySource {
  source: 'quotations' | 'direct_sales' | 'recurring';
  income: number;
  percentage: number;
}

interface IncomeSummary {
  totalProjects: number;
  activeProjects: number;
  averageProjectValue: number;
  topPerformingClient: string;
}

interface IncomeDashboardProps {
  timeFilter?: string;
  viewMode?: 'executive' | 'detailed';
}

const timeFilterOptions = [
  { value: 'current_month', label: 'Mes Actual' },
  { value: 'last_month', label: 'Mes Anterior' },
  { value: 'current_quarter', label: 'Trimestre Actual' },
  { value: 'last_quarter', label: 'Trimestre Anterior' },
  { value: 'current_year', label: 'Año Actual' },
  { value: 'last_year', label: 'Año Anterior' },
  { value: 'all', label: 'Todo el Período' }
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getVarianceColor = (variance: number) => {
  if (variance > 10) return 'text-green-600 bg-green-50';
  if (variance > 0) return 'text-blue-600 bg-blue-50';
  if (variance > -10) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'on_track':
      return <Badge className="bg-green-100 text-green-800 border-green-200">En Meta</Badge>;
    case 'over_target':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Sobre Meta</Badge>;
    case 'under_target':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Bajo Meta</Badge>;
    default:
      return <Badge variant="secondary">N/A</Badge>;
  }
};

const IncomeDashboard: React.FC<IncomeDashboardProps> = ({ 
  timeFilter = 'current_month',
  viewMode = 'executive'
}) => {
  const [selectedTimeFilter, setSelectedTimeFilter] = useState(timeFilter);
  const [selectedViewMode, setSelectedViewMode] = useState(viewMode);

  const { data: incomeData, isLoading, error } = useQuery({
    queryKey: ['income-analysis', selectedTimeFilter],
    queryFn: async (): Promise<IncomeData> => {
      const response = await fetch(`/api/income-dashboard?timeFilter=${selectedTimeFilter}`);
      if (!response.ok) {
        throw new Error('Error al cargar datos de ingresos');
      }
      return response.json();
    }
  });

  const executiveSummaryCards = useMemo(() => {
    if (!incomeData) return [];

    return [
      {
        title: 'Ingresos Totales',
        value: formatCurrency(incomeData.totalIncome),
        target: formatCurrency(incomeData.targetIncome),
        variance: incomeData.variance,
        icon: DollarSign,
        tooltip: 'Total de ingresos generados en el período seleccionado comparado con la meta establecida.'
      },
      {
        title: 'Proyectos Activos',
        value: incomeData.summary.activeProjects.toString(),
        target: incomeData.summary.totalProjects.toString(),
        variance: ((incomeData.summary.activeProjects / incomeData.summary.totalProjects) * 100) - 100,
        icon: Building2,
        tooltip: 'Número de proyectos activos generando ingresos vs total de proyectos en cartera.'
      },
      {
        title: 'Valor Promedio por Proyecto',
        value: formatCurrency(incomeData.summary.averageProjectValue),
        target: 'N/A',
        variance: 0,
        icon: Calculator,
        tooltip: 'Valor promedio de ingresos por proyecto activo en el período.'
      },
      {
        title: 'Cliente Principal',
        value: incomeData.summary.topPerformingClient || 'N/A',
        target: 'Performance',
        variance: 0,
        icon: Users,
        tooltip: 'Cliente que genera mayor volumen de ingresos en el período analizado.'
      }
    ];
  }, [incomeData]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          <p>Error al cargar los datos de ingresos. Inténtalo de nuevo.</p>
        </div>
      </Card>
    );
  }

  if (!incomeData) return null;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-600" />
              Análisis Financiero
            </h1>
            <p className="text-gray-600 mt-1">Métricas avanzadas y proyecciones financieras</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedTimeFilter} onValueChange={setSelectedTimeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedViewMode} onValueChange={(value) => setSelectedViewMode(value as 'executive' | 'detailed')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive">Ejecutivo</SelectItem>
                <SelectItem value="detailed">Detallado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumen Ejecutivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {executiveSummaryCards.map((card, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 cursor-help">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <card.icon className="h-6 w-6 text-white" />
                      </div>
                      {card.variance !== 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getVarianceColor(card.variance)}`}>
                          {card.variance > 0 ? (
                            <ArrowUpIcon className="h-3 w-3" />
                          ) : (
                            <ArrowDownIcon className="h-3 w-3" />
                          )}
                          {Math.abs(card.variance).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">{card.title}</h3>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{card.value}</p>
                    {card.target !== 'N/A' && card.target !== 'Performance' && (
                      <p className="text-xs text-gray-500">Meta: {card.target}</p>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{card.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Contenido Principal */}
        <Tabs value={selectedViewMode} onValueChange={(value) => setSelectedViewMode(value as 'executive' | 'detailed')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="executive" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Vista Ejecutiva
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Vista Detallada
            </TabsTrigger>
          </TabsList>

          <TabsContent value="executive" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución por Cliente */}
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                    Distribución por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <RechartsPieChart 
                          data={incomeData.clientBreakdown} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
                          dataKey="income"
                        >
                          {incomeData.clientBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </RechartsPieChart>
                        <RechartsTooltip formatter={(value: any) => [formatCurrency(value), 'Ingresos']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    {incomeData.clientBreakdown.slice(0, 5).map((client, index) => (
                      <div key={client.clientName} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium">{client.clientName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatCurrency(client.income)}</div>
                          <div className="text-xs text-gray-500">{client.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tendencia Mensual */}
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Tendencia de Ingresos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={incomeData.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                        <RechartsTooltip formatter={(value: any) => [formatCurrency(value), 'Ingresos']} />
                        <Area 
                          type="monotone" 
                          dataKey="income" 
                          stroke="#3b82f6" 
                          fill="url(#incomeGradient)" 
                          strokeWidth={3}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="target" 
                          stroke="#10b981" 
                          fill="transparent" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                        <defs>
                          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-6">
            {/* Listado Detallado de Proyectos */}
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  Rendimiento por Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {incomeData.projects.map((project) => (
                      <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{project.name}</h4>
                            <p className="text-sm text-gray-600">{project.clientName}</p>
                          </div>
                          {getStatusBadge(project.status)}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Ingresos Actuales</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(project.income)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Meta</p>
                            <p className="text-lg font-semibold text-gray-700">{formatCurrency(project.target)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Varianza</p>
                            <p className={`text-lg font-bold ${project.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {project.variance >= 0 ? '+' : ''}{project.variance.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progreso hacia la meta</span>
                            <span>{project.percentage.toFixed(1)}%</span>
                          </div>
                          <Progress 
                            value={Math.min(project.percentage, 100)} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Fuentes de Ingresos */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-orange-600" />
              Fuentes de Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {incomeData.bySource.map((source, index) => (
                <div key={source.source} className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke={COLORS[index]}
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={`${source.percentage * 2.51} 251`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">{source.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  <h4 className="font-semibold text-gray-900 capitalize mb-1">
                    {source.source.replace('_', ' ')}
                  </h4>
                  <p className="text-sm font-medium text-gray-600">{formatCurrency(source.income)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default IncomeDashboard;
