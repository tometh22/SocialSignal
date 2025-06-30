
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, AreaChart, Area, ComposedChart } from "recharts";
import { Search, TrendingUp, DollarSign, FileText, BarChart3, Calendar, Filter, Download, Users, Clock, Target, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import type { Quotation, Client, ActiveProject, TimeEntry } from "@shared/schema";

export default function Statistics() {
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFrame, setTimeFrame] = useState("all");
  const [analysisType, setAnalysisType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");

  // Consultas de datos
  const { data: quotations, isLoading: quotationsLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: activeProjects, isLoading: projectsLoading } = useQuery<ActiveProject[]>({
    queryKey: ["/api/active-projects"],
  });

  const { data: timeEntries, isLoading: timeEntriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
  });

  const isLoading = quotationsLoading || clientsLoading || projectsLoading || timeEntriesLoading;

  // Función mejorada de filtrado
  const filteredQuotations = quotations
    ? quotations.filter((quote) => {
        // Filtro de búsqueda
        const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Filtro de tiempo
        let matchesTimeFrame = true;
        if (timeFrame !== "all") {
          const quoteDate = new Date(quote.createdAt);
          const now = new Date();
          
          switch (timeFrame) {
            case "7days":
              const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              matchesTimeFrame = quoteDate >= sevenDaysAgo;
              break;
            case "30days":
              const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              matchesTimeFrame = quoteDate >= thirtyDaysAgo;
              break;
            case "90days":
              const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
              matchesTimeFrame = quoteDate >= ninetyDaysAgo;
              break;
            case "6months":
              const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
              matchesTimeFrame = quoteDate >= sixMonthsAgo;
              break;
            case "1year":
              const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
              matchesTimeFrame = quoteDate >= oneYearAgo;
              break;
          }
        }
        
        // Filtro de tipo de análisis
        const matchesAnalysisType = analysisType === "all" || quote.analysisType === analysisType;
        
        // Filtro de estado
        const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
        
        // Filtro de cliente
        const matchesClient = clientFilter === "all" || quote.clientId.toString() === clientFilter;
        
        // Filtro de tipo de proyecto
        const matchesProjectType = projectTypeFilter === "all" || quote.projectType === projectTypeFilter;
        
        return matchesSearch && matchesTimeFrame && matchesAnalysisType && matchesStatus && matchesClient && matchesProjectType;
      })
    : [];

  // Análisis de datos mejorados
  const getAnalysisTypeData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts = filteredQuotations.reduce((acc, quote) => {
      const type = quote.analysisType || 'standard';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return [
      { name: "Análisis Básico", value: counts.basic || 0, color: "#3b82f6", percentage: ((counts.basic || 0) / filteredQuotations.length * 100).toFixed(1) },
      { name: "Análisis Estándar", value: counts.standard || 0, color: "#06b6d4", percentage: ((counts.standard || 0) / filteredQuotations.length * 100).toFixed(1) },
      { name: "Análisis Profundo", value: counts.deep || 0, color: "#10b981", percentage: ((counts.deep || 0) / filteredQuotations.length * 100).toFixed(1) },
    ].filter(item => item.value > 0);
  };

  const getStatusData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts = filteredQuotations.reduce((acc, quote) => {
      acc[quote.status] = (acc[quote.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return [
      { name: "Pendiente", value: counts.pending || 0, color: "#f59e0b" },
      { name: "Aprobado", value: counts.approved || 0, color: "#10b981" },
      { name: "Rechazado", value: counts.rejected || 0, color: "#ef4444" },
      { name: "En Negociación", value: counts["in-negotiation"] || 0, color: "#8b5cf6" },
    ].filter(item => item.value > 0);
  };

  const getMonthlyTrendData = () => {
    if (!filteredQuotations.length) return [];
    
    const monthlyData: Record<string, { month: string; count: number; value: number; avgValue: number }> = {};
    
    filteredQuotations.forEach((quote) => {
      const date = new Date(quote.createdAt);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('es', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = {
          month: monthName,
          count: 0,
          value: 0,
          avgValue: 0,
        };
      }
      
      monthlyData[monthYear].count += 1;
      monthlyData[monthYear].value += quote.totalAmount;
    });
    
    // Calcular promedio
    Object.keys(monthlyData).forEach(key => {
      monthlyData[key].avgValue = monthlyData[key].value / monthlyData[key].count;
    });
    
    return Object.values(monthlyData).sort((a, b) => {
      return a.month.localeCompare(b.month);
    });
  };

  const getClientPerformanceData = () => {
    if (!filteredQuotations.length || !clients?.length) return [];
    
    const clientData = clients.map(client => {
      const clientQuotes = filteredQuotations.filter(q => q.clientId === client.id);
      const totalValue = clientQuotes.reduce((sum, q) => sum + q.totalAmount, 0);
      const approvedQuotes = clientQuotes.filter(q => q.status === 'approved').length;
      const conversionRate = clientQuotes.length > 0 ? (approvedQuotes / clientQuotes.length) * 100 : 0;
      
      return {
        name: client.name,
        totalQuotes: clientQuotes.length,
        totalValue,
        avgValue: clientQuotes.length > 0 ? totalValue / clientQuotes.length : 0,
        conversionRate,
        approvedQuotes,
      };
    }).filter(data => data.totalQuotes > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
    
    return clientData;
  };

  const getProjectTypeDistribution = () => {
    if (!filteredQuotations.length) return [];
    
    const counts = filteredQuotations.reduce((acc, quote) => {
      const type = quote.projectType || 'on-demand';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return [
      { name: "On Demand", value: counts['on-demand'] || 0, color: "#3b82f6" },
      { name: "Fee Mensual", value: counts['fee-mensual'] || 0, color: "#10b981" },
    ].filter(item => item.value > 0);
  };

  // Métricas clave
  const totalQuotations = filteredQuotations.length;
  const totalValue = filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0);
  const averageValue = totalQuotations > 0 ? totalValue / totalQuotations : 0;
  const approvedQuotes = filteredQuotations.filter(q => q.status === 'approved').length;
  const conversionRate = totalQuotations > 0 ? (approvedQuotes / totalQuotations) * 100 : 0;
  const pendingQuotes = filteredQuotations.filter(q => q.status === 'pending').length;
  const rejectedQuotes = filteredQuotations.filter(q => q.status === 'rejected').length;

  // Análisis de tendencias
  const monthlyTrend = getMonthlyTrendData();
  const currentMonth = monthlyTrend[monthlyTrend.length - 1];
  const previousMonth = monthlyTrend[monthlyTrend.length - 2];
  const monthlyGrowth = currentMonth && previousMonth 
    ? ((currentMonth.count - previousMonth.count) / previousMonth.count * 100)
    : 0;

  const exportData = () => {
    const dataToExport = {
      resumen: {
        totalCotizaciones: totalQuotations,
        valorTotal: totalValue,
        valorPromedio: averageValue,
        tasaConversion: conversionRate,
      },
      cotizacionesFiltradas: filteredQuotations.map(q => ({
        proyecto: q.projectName,
        cliente: clients?.find(c => c.id === q.clientId)?.name || 'Desconocido',
        tipoAnalisis: q.analysisType,
        tipoProyecto: q.projectType,
        estado: q.status,
        valorTotal: q.totalAmount,
        fechaCreacion: q.createdAt,
      })),
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estadisticas-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Estadísticas y Análisis</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Estadísticas y Análisis</h1>
              <p className="text-gray-600 mt-1">Análisis profesional completo de cotizaciones y tendencias</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Datos
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros Mejorados */}
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="Buscar proyectos..."
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={timeFrame} onValueChange={setTimeFrame}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los períodos</SelectItem>
                  <SelectItem value="7days">Últimos 7 días</SelectItem>
                  <SelectItem value="30days">Últimos 30 días</SelectItem>
                  <SelectItem value="90days">Últimos 90 días</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="1year">Último año</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <Filter className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Tipo análisis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="basic">Análisis Básico</SelectItem>
                  <SelectItem value="standard">Análisis Estándar</SelectItem>
                  <SelectItem value="deep">Análisis Profundo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                  <SelectItem value="in-negotiation">En Negociación</SelectItem>
                </SelectContent>
              </Select>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={projectTypeFilter} onValueChange={setProjectTypeFilter}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Tipo proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="on-demand">On Demand</SelectItem>
                  <SelectItem value="fee-mensual">Fee Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Cotizaciones</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {isLoading ? (
                      <span className="animate-pulse bg-gray-200 h-8 w-16 rounded"></span>
                    ) : (
                      totalQuotations
                    )}
                  </p>
                  {monthlyGrowth !== 0 && (
                    <div className="flex items-center mt-2">
                      {monthlyGrowth > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span className={`text-sm ${monthlyGrowth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {Math.abs(monthlyGrowth).toFixed(1)}% vs mes anterior
                      </span>
                    </div>
                  )}
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {isLoading ? (
                      <span className="animate-pulse bg-gray-200 h-8 w-24 rounded"></span>
                    ) : (
                      `$${totalValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Promedio: ${averageValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasa de Conversión</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {isLoading ? (
                      <span className="animate-pulse bg-gray-200 h-8 w-16 rounded"></span>
                    ) : (
                      `${conversionRate.toFixed(1)}%`
                    )}
                  </p>
                  <div className="mt-2">
                    <Progress value={conversionRate} className="h-2" />
                  </div>
                </div>
                <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Estados</p>
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600">Aprobadas:</span>
                      <span className="font-medium">{approvedQuotes}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-yellow-600">Pendientes:</span>
                      <span className="font-medium">{pendingQuotes}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-red-600">Rechazadas:</span>
                      <span className="font-medium">{rejectedQuotes}</span>
                    </div>
                  </div>
                </div>
                <div className="h-12 w-12 bg-orange-50 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs para diferentes análisis */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen General</TabsTrigger>
            <TabsTrigger value="trends">Tendencias</TabsTrigger>
            <TabsTrigger value="clients">Análisis por Cliente</TabsTrigger>
            <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución por Tipo */}
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Distribución por Tipo de Análisis</CardTitle>
                  <CardDescription className="text-gray-600">Tipos de análisis más solicitados</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-pulse flex space-x-4">
                        <div className="rounded-full bg-gray-200 h-12 w-12"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-4 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  ) : getAnalysisTypeData().length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getAnalysisTypeData()}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {getAnalysisTypeData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any, name: any, props: any) => [
                                `${value} (${props.payload.percentage}%)`, 
                                'Cantidad'
                              ]}
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getAnalysisTypeData().map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: entry.color }}
                            ></div>
                            <span className="text-sm text-gray-600">{entry.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {entry.value} ({entry.percentage}%)
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                      <BarChart3 className="h-12 w-12 mb-4 text-gray-300" />
                      <p className="text-center">No hay datos disponibles</p>
                      <p className="text-sm text-center mt-1">Ajusta los filtros para ver resultados</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Estados de Cotizaciones */}
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Estados de Cotizaciones</CardTitle>
                  <CardDescription className="text-gray-600">Distribución actual por estado</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-pulse space-y-4 w-full">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-32 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ) : getStatusData().length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getStatusData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {getStatusData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                      <BarChart3 className="h-12 w-12 mb-4 text-gray-300" />
                      <p className="text-center">No hay datos de estado disponibles</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card className="border border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">Tendencia Mensual</CardTitle>
                <CardDescription className="text-gray-600">Evolución de cotizaciones y valores a lo largo del tiempo</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading ? (
                  <div className="h-80 flex items-center justify-center">
                    <div className="animate-pulse space-y-4 w-full">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-64 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ) : getMonthlyTrendData().length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={getMonthlyTrendData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Legend />
                        <Bar 
                          yAxisId="left"
                          dataKey="count" 
                          fill="#3b82f6" 
                          name="Cantidad"
                          radius={[4, 4, 0, 0]}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="avgValue" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                          name="Valor Promedio" 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-gray-500">
                    <TrendingUp className="h-12 w-12 mb-4 text-gray-300" />
                    <p className="text-center">No hay datos de tendencia disponibles</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="space-y-6">
            <Card className="border border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">Análisis por Cliente</CardTitle>
                <CardDescription className="text-gray-600">Top 10 clientes por valor total</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading ? (
                  <div className="h-80 flex items-center justify-center">
                    <div className="animate-pulse space-y-4 w-full">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-64 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ) : getClientPerformanceData().length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getClientPerformanceData()} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis type="number" />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            width={100}
                          />
                          <Tooltip 
                            formatter={(value: any, name: any) => {
                              if (name === 'totalValue') return [`$${Number(value).toLocaleString()}`, 'Valor Total'];
                              if (name === 'conversionRate') return [`${Number(value).toFixed(1)}%`, 'Tasa Conversión'];
                              return [value, name];
                            }}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Bar dataKey="totalValue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getClientPerformanceData().slice(0, 6).map((client, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <h4 className="font-medium text-gray-900">{client.name}</h4>
                          <div className="mt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Cotizaciones:</span>
                              <span className="font-medium">{client.totalQuotes}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Valor Total:</span>
                              <span className="font-medium">${client.totalValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Conversión:</span>
                              <span className="font-medium">{client.conversionRate.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-80 flex flex-col items-center justify-center text-gray-500">
                    <Users className="h-12 w-12 mb-4 text-gray-300" />
                    <p className="text-center">No hay datos de clientes disponibles</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución por Tipo de Proyecto */}
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Tipos de Proyecto</CardTitle>
                  <CardDescription className="text-gray-600">Distribución por modalidad de negocio</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {getProjectTypeDistribution().length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getProjectTypeDistribution()}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {getProjectTypeDistribution().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {getProjectTypeDistribution().map((entry, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: entry.color }}
                              ></div>
                              <span className="text-sm text-gray-600">{entry.name}</span>
                            </div>
                            <Badge variant="secondary">{entry.value}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-gray-500">
                      <BarChart3 className="h-8 w-8 mb-2 text-gray-300" />
                      <p className="text-center text-sm">No hay datos disponibles</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Métricas de Rendimiento */}
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Métricas de Rendimiento</CardTitle>
                  <CardDescription className="text-gray-600">Indicadores clave de performance</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Tasa de Conversión</span>
                        <span className="text-sm font-semibold text-gray-900">{conversionRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={conversionRate} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        {approvedQuotes} de {totalQuotations} cotizaciones aprobadas
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Valor Promedio</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ${averageValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Basado en {totalQuotations} cotizaciones
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{approvedQuotes}</div>
                        <div className="text-xs text-gray-500">Aprobadas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{pendingQuotes}</div>
                        <div className="text-xs text-gray-500">Pendientes</div>
                      </div>
                    </div>

                    {monthlyGrowth !== 0 && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Crecimiento Mensual</span>
                          <div className="flex items-center">
                            {monthlyGrowth > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <span className={`text-sm font-semibold ${monthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Math.abs(monthlyGrowth).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
