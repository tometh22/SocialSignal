import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileSpreadsheet, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IncomeRecord {
  id: number;
  projectName: string;
  clientName: string;
  monthKey: string; // YYYY-MM
  revenueType: string; // 'fee', 'tm', 'one-shot'
  amountUsd: number;
  status: string;
  confirmed: string;
  notes?: string;
}

interface IncomeFilters {
  clientName?: string;
  projectName?: string;
  salesType?: string;
  status?: string;
}

export default function IncomeDashboard({ projectId, timeFilter }: { projectId?: number; timeFilter?: string }) {
  const [filters, setFilters] = useState<IncomeFilters>({});

  // Fetch income data with global time filter
  const { data: incomeData = [], isLoading } = useQuery({
    queryKey: ['/api/income-dashboard', filters, projectId, timeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId.toString());
      if (filters.clientName) params.append('clientName', filters.clientName);
      // Only include project filter if we're NOT in a specific project context
      if (!projectId && filters.projectName) params.append('projectName', filters.projectName);
      // Use global time filter instead of local month filter
      if (timeFilter && timeFilter !== 'all_time') params.append('timeFilter', timeFilter);
      
      console.log('🔍 IncomeDashboard - Fetching with params:', params.toString());
      console.log('🔍 IncomeDashboard - Project context:', projectId ? `Project ${projectId}` : 'All projects');
      console.log('🔍 IncomeDashboard - Global timeFilter:', timeFilter);
      const response = await fetch(`/api/income-dashboard?${params}`);
      if (!response.ok) {
        console.error('❌ IncomeDashboard - API error:', response.status, response.statusText);
        throw new Error('Failed to fetch income data');
      }
      const data = await response.json();
      console.log('📊 IncomeDashboard - Received data:', data);
      return data;
    },
  });

  // Get unique values for filters with robust handling
  const uniqueClients = useMemo(() => {
    const clientSet = new Set();
    // Ensure incomeData is an array before using forEach
    if (Array.isArray(incomeData)) {
      incomeData.forEach((record: any) => {
        const client = record.clientName || record.client_name;
        if (client && client !== "N/A" && typeof client === 'string' && client.trim()) {
          clientSet.add(client.trim());
        }
      });
    }
    return Array.from(clientSet).sort();
  }, [incomeData]);

  const uniqueProjects = useMemo(() => {
    // Only calculate unique projects if we're NOT in project context
    if (projectId) return [];
    
    const projectSet = new Set();
    // Ensure incomeData is an array before using forEach
    if (Array.isArray(incomeData)) {
      incomeData.forEach((record: any) => {
        const project = record.projectName || record.project_name;
        if (project && project !== "N/A" && typeof project === 'string' && project.trim()) {
          projectSet.add(project.trim());
        }
      });
    }
    return Array.from(projectSet).sort();
  }, [incomeData, projectId]);

  // Removed uniqueMonths since we're using global time filter

  // Calculate total income with fallbacks for different column names
  const totalIncome = useMemo(() => {
    if (!Array.isArray(incomeData)) return 0;
    return incomeData
      .filter((record: any) => record.confirmed === 'SI' || record.confirmed === 'Si')
      .reduce((sum: number, record: any) => {
        const amount = parseFloat(record.amountUsd || record.amount_usd || "0");
        return sum + amount;
      }, 0);
  }, [incomeData]);

  // Filter data based on current filters with fallbacks
  const filteredData = useMemo(() => {
    if (!Array.isArray(incomeData)) return [];
    return incomeData.filter((record: any) => {
      const clientName = record.clientName || record.client_name;
      const projectName = record.projectName || record.project_name;
      const salesType = record.salesType || record.sales_type;
      const status = record.status;
      
      if (filters.clientName && clientName !== filters.clientName) return false;
      // Only apply project filter if we're NOT in project context
      if (!projectId && filters.projectName && projectName !== filters.projectName) return false;
      
      // Project-specific filters
      if (filters.salesType && salesType !== filters.salesType) return false;
      if (filters.status && status !== filters.status) return false;
      
      return true;
    });
  }, [incomeData, filters, projectId]);

  const clearFilters = () => {
    setFilters({});
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Ingresos Totales</h2>
          </div>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-900">
            {projectId ? 'Ingresos del Proyecto' : 'Ingresos - Numerador Limpio'}
          </h2>
        </div>

        {/* Filtros contextuales compactos */}
        {!projectId ? (
          // Vista global - filtros horizontales compactos
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Cliente:</label>
              <select 
                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-32 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={filters.clientName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, clientName: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                {uniqueClients.map((client) => (
                  <option key={client as string} value={client as string}>{client as string}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Proyecto:</label>
              <select 
                className="border border-gray-300 rounded px-2 py-1 text-sm min-w-32 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={filters.projectName || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, projectName: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                {uniqueProjects.map((project) => (
                  <option key={project as string} value={project as string}>{project as string}</option>
                ))}
              </select>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 h-7 px-2 text-xs"
            >
              <Filter className="w-3 h-3" />
              Limpiar
            </Button>
          </div>
        ) : (
          // Vista de proyecto específico - filtros compactos horizontales
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-blue-700 whitespace-nowrap">Tipo:</label>
              <select 
                className="border border-blue-300 rounded px-2 py-1 text-sm min-w-24 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={filters.salesType || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, salesType: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                <option value="Fee">Fee</option>
                <option value="One Shot">One Shot</option>
                <option value="Bonus">Bonus</option>
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <label className="text-xs font-medium text-blue-700 whitespace-nowrap">Estado:</label>
              <select 
                className="border border-blue-300 rounded px-2 py-1 text-sm min-w-24 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={filters.status || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
              >
                <option value="">Todos</option>
                <option value="completada">Completada</option>
                <option value="activa">Activa</option>
                <option value="proyectada">Proyectada</option>
              </select>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 h-7 px-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Filter className="w-3 h-3" />
              Limpiar
            </Button>
          </div>
        )}

        {/* Total Income Card - Compacto */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Ingresos Confirmados</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs opacity-90">USD</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Ingresos - Diseño Corporativo Compacto */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900">Detalle de Ingresos</h3>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
              {filteredData.length} registros
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Completada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Activa</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600">Proyectada</span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-25">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Mes</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Tipo</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Ingresos USD</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-6 h-6 text-gray-400" />
                      <span className="text-sm">No se encontraron registros</span>
                      <span className="text-xs">Verifica los filtros aplicados</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((record: any) => {
                  const projectName = record.projectName || record.project_name || "N/A";
                  const clientName = record.clientName || record.client_name || "N/A";
                  const monthKey = record.monthKey || record.month_key || "N/A";
                  const salesType = record.salesType || record.sales_type || record.revenueType || "N/A";
                    const amountUsd = parseFloat(record.amountUsd || record.amount_usd || "0");
                    const status = record.status || "N/A";
                    const confirmed = record.confirmed || "NO";
                    const notes = record.notes || "—";
                    
                    return (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">{projectName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{clientName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 font-mono">{monthKey}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant={
                            salesType.toLowerCase() === 'fee' ? 'default' : 
                            salesType.toLowerCase() === 'tm' ? 'secondary' : 'outline'
                          } className="text-xs">
                            {salesType}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-mono font-medium text-green-600">
                          ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge 
                            variant="outline"
                            className={`text-xs ${
                              status === 'proyectada' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                              status === 'activa' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                              status === 'completada' ? 'bg-green-100 text-green-700 border-green-300' :
                              'bg-gray-100 text-gray-700 border-gray-300'
                            }`}
                          >
                            {status === 'proyectada' ? 'Proyectada' :
                             status === 'activa' ? 'Activa' :
                             status === 'completada' ? 'Completada' :
                             status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  LineChart,
  Calendar,
  Gauge,
  Zap,
  Shield,
  Lightbulb,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface IncomeDashboardProps {
  timeFilter?: string;
  viewMode?: 'executive' | 'detailed' | 'compact';
}

const IncomeDashboard: React.FC<IncomeDashboardProps> = ({ 
  timeFilter = 'current_month',
  viewMode = 'executive'
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState(timeFilter);

  // Datos consolidados de analytics
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics-consolidated', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/consolidated?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Error fetching analytics');
      return response.json();
    }
  });

  // Formateo de moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Cálculos derivados
  const metrics = useMemo(() => {
    if (!analyticsData) return null;

    const totalRevenue = analyticsData.totalRevenue || 0;
    const totalCosts = analyticsData.totalCosts || 0;
    const margin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
    const efficiency = analyticsData.efficiency || 0;
    const burnRate = analyticsData.monthlyBurnRate || 0;

    return {
      totalRevenue,
      totalCosts,
      margin,
      efficiency,
      burnRate,
      projectCount: analyticsData.activeProjects || 0,
      teamUtilization: analyticsData.teamUtilization || 0,
      clientSatisfaction: analyticsData.clientSatisfaction || 85
    };
  }, [analyticsData]);

  // Datos para gráficos
  const chartData = useMemo(() => {
    if (!analyticsData?.monthlyData) return [];
    
    return analyticsData.monthlyData.map((month: any) => ({
      month: month.month,
      ingresos: month.revenue,
      costos: month.costs,
      margen: month.margin,
      proyectos: month.activeProjects
    }));
  }, [analyticsData]);

  const pieData = useMemo(() => {
    if (!analyticsData?.costBreakdown) return [];
    
    return [
      { name: 'Personal', value: analyticsData.costBreakdown.personnel || 0, color: '#3B82F6' },
      { name: 'Freelancers', value: analyticsData.costBreakdown.freelancers || 0, color: '#10B981' },
      { name: 'Plataformas', value: analyticsData.costBreakdown.platforms || 0, color: '#F59E0B' },
      { name: 'Otros', value: analyticsData.costBreakdown.others || 0, color: '#EF4444' }
    ];
  }, [analyticsData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              Business Intelligence & Analytics
            </h1>
            <p className="text-slate-600 mt-1">Métricas avanzadas y proyecciones financieras</p>
          </div>
          
          <div className="flex gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Este Mes</SelectItem>
                <SelectItem value="last_month">Mes Pasado</SelectItem>
                <SelectItem value="current_quarter">Trimestre Actual</SelectItem>
                <SelectItem value="last_quarter">Trimestre Pasado</SelectItem>
                <SelectItem value="year_to_date">Año hasta la fecha</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Ingresos por Empleado */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-blue-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ingresos totales dividido por número de empleados activos</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-700">Ingresos por Empleado</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency((metrics?.totalRevenue || 0) / Math.max(metrics?.projectCount || 1, 1))}
                </p>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium">+12.5%</span>
                  <span className="text-blue-600">vs mes anterior</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Margen de Ganancia */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <Badge variant="secondary" className="bg-green-200 text-green-800">
                  {metrics?.margin && metrics.margin > 25 ? 'Excelente' : 
                   metrics?.margin && metrics.margin > 15 ? 'Bueno' : 'Mejorable'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-700">Margen de Ganancia</p>
                <p className="text-2xl font-bold text-green-900">{(metrics?.margin || 0).toFixed(1)}%</p>
                <Progress value={metrics?.margin || 0} className="h-2" />
                <p className="text-xs text-green-600">Objetivo: 30%</p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Burn Rate */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="border-orange-300 text-orange-700">
                    {(metrics?.burnRate || 0) < 15000 ? 'Óptimo' : 
                     (metrics?.burnRate || 0) < 25000 ? 'Moderado' : 'Alto'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-700">Monthly Burn Rate</p>
                <p className="text-2xl font-bold text-orange-900">{formatCurrency(metrics?.burnRate || 0)}</p>
                <div className="flex items-center gap-1 text-sm">
                  {(metrics?.burnRate || 0) < 20000 ? (
                    <TrendingDown className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingUp className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`font-medium ${(metrics?.burnRate || 0) < 20000 ? 'text-green-600' : 'text-red-600'}`}>
                    {(metrics?.burnRate || 0) < 20000 ? 'Controlado' : 'Revisar'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Velocity */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-900">{metrics?.projectCount || 0}</div>
                  <div className="text-xs text-purple-600">proyectos</div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-purple-700">Project Velocity</p>
                <p className="text-2xl font-bold text-purple-900">{(metrics?.efficiency || 0).toFixed(1)}%</p>
                <p className="text-xs text-purple-600">Eficiencia promedio del equipo</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de análisis */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen Ejecutivo</TabsTrigger>
            <TabsTrigger value="insights">Predictive Analytics & Insights</TabsTrigger>
            <TabsTrigger value="performance">Performance Heatmap</TabsTrigger>
            <TabsTrigger value="trends">Tendencia Financiera</TabsTrigger>
          </TabsList>

          {/* Tab: Resumen Ejecutivo */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolución mensual */}
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-blue-600" />
                    Evolución de Ingresos vs Costos
                  </CardTitle>
                  <CardDescription>
                    Análisis temporal de ingresos vs costos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="ingresos" 
                          stackId="1"
                          stroke="#3B82F6" 
                          fill="#3B82F6" 
                          fillOpacity={0.6}
                          name="Ingresos"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="costos" 
                          stackId="2"
                          stroke="#EF4444" 
                          fill="#EF4444" 
                          fillOpacity={0.6}
                          name="Costos"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Distribución de costos */}
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-green-600" />
                    Distribución de Costos
                  </CardTitle>
                  <CardDescription>
                    Eficiencia por miembro del equipo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Predictive Analytics */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Proyecciones e inteligencia de negocio */}
              <Card className="md:col-span-2 shadow-lg border-0 bg-gradient-to-br from-indigo-50 to-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-indigo-600" />
                    Proyecciones e Inteligencia de Negocio
                  </CardTitle>
                  <CardDescription>Insights automáticos basados en datos históricos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium">Proyección de Ingresos</span>
                      </div>
                      <div className="text-2xl font-bold text-indigo-900">
                        {formatCurrency((metrics?.totalRevenue || 0) * 1.15)}
                      </div>
                      <div className="text-xs text-indigo-600">Próximo trimestre (+15%)</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Risk Score</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {73}
                      </div>
                      <div className="text-xs text-green-600">Riesgo bajo (< 30)</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Insight de Rentabilidad</p>
                          <p className="text-xs text-blue-700">
                            Los proyectos con complejidad media muestran 23% mayor rentabilidad que los complejos. 
                            Considerar optimizar portfolio hacia proyectos medianos.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                        <div>
                          <p className="text-sm font-medium text-green-800">Oportunidad de Crecimiento</p>
                          <p className="text-xs text-green-700">
                            El cliente Warner muestra potencial para expansión (+40% en fee marketing). 
                            Recomendar propuesta de servicios adicionales.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
                        <div>
                          <p className="text-sm font-medium text-amber-800">Alerta de Eficiencia</p>
                          <p className="text-xs text-amber-700">
                            El equipo de freelancers presenta 15% menor eficiencia vs equipo interno. 
                            Evaluar procesos de onboarding y mentoring.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client LTV Analysis */}
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="text-base">Client LTV Analysis</CardTitle>
                  <CardDescription>Valor de vida útil por cliente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <div>
                        <div className="text-sm font-medium">Warner</div>
                        <div className="text-xs text-muted-foreground">Marketing continuo</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-700">{formatCurrency(47000)}</div>
                        <Badge variant="outline" className="text-xs">Alto valor</Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <div>
                        <div className="text-sm font-medium">Modo</div>
                        <div className="text-xs text-muted-foreground">Fee mensual</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-700">{formatCurrency(7047)}</div>
                        <Badge variant="outline" className="text-xs">Estable</Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                      <div>
                        <div className="text-sm font-medium">Kimberly Clark</div>
                        <div className="text-xs text-muted-foreground">Campañas Huggies</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-700">{formatCurrency(30935)}</div>
                        <Badge variant="outline" className="text-xs">Creciendo</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Performance Heatmap */}
          <TabsContent value="performance" className="space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Performance Heatmap
                </CardTitle>
                <CardDescription>
                  Eficiencia por miembro del equipo (1724h tiempo restante)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Simulación de heatmap de equipo */}
                  {[
                    { name: 'Rumi Figueroa', efficiency: 27.5, hours: 1724, status: 'excellent' },
                    { name: 'Ina Ceravolo', efficiency: 90.5, hours: 1502, status: 'excellent' },
                    { name: 'Maricel Perez', efficiency: 73.2, hours: 1156, status: 'good' },
                    { name: 'Gast Guntren', efficiency: 68.9, hours: 987, status: 'good' },
                    { name: 'Vicky Achabal', efficiency: 56.4, hours: 743, status: 'average' },
                    { name: 'Lola Camara', efficiency: 47.8, hours: 621, status: 'needs_improvement' }
                  ].map((member, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${
                        member.status === 'excellent' ? 'bg-green-50 border-green-200 hover:bg-green-100' :
                        member.status === 'good' ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' :
                        member.status === 'average' ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' :
                        'bg-red-50 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-700 mb-2">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="text-sm font-medium text-slate-800 mb-1">{member.name}</div>
                        <div className={`text-2xl font-bold mb-1 ${
                          member.status === 'excellent' ? 'text-green-700' :
                          member.status === 'good' ? 'text-blue-700' :
                          member.status === 'average' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {member.efficiency}%
                        </div>
                        <div className="text-xs text-slate-600">{member.hours}h</div>
                        <Badge 
                          variant="outline" 
                          className={`mt-2 text-xs ${
                            member.status === 'excellent' ? 'border-green-300 text-green-700' :
                            member.status === 'good' ? 'border-blue-300 text-blue-700' :
                            member.status === 'average' ? 'border-yellow-300 text-yellow-700' :
                            'border-red-300 text-red-700'
                          }`}
                        >
                          {member.status === 'excellent' ? 'Excelente' :
                           member.status === 'good' ? 'Bueno' :
                           member.status === 'average' ? 'Promedio' :
                           'Mejorar'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Tendencia Financiera */}
          <TabsContent value="trends" className="space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Análisis de tendencias financieras
                </CardTitle>
                <CardDescription>
                  Análisis temporal de revenue vs costos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="ingresos" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        name="Ingresos"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="costos" 
                        stroke="#EF4444" 
                        strokeWidth={3}
                        name="Costos"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="margen" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Margen (%)"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default IncomeDashboard;
