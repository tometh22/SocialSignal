
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from "recharts";
import { Search, TrendingUp, DollarSign, FileText, BarChart3, Calendar, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Quotation } from "@shared/schema";

export default function Statistics() {
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFrame, setTimeFrame] = useState("all");
  const [analysisType, setAnalysisType] = useState("all");

  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const filteredQuotations = quotations
    ? quotations.filter((quote) => {
        const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesTimeFrame = true;
        if (timeFrame !== "all") {
          const quoteDate = new Date(quote.createdAt);
          const now = new Date();
          
          if (timeFrame === "7days") {
            const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
            matchesTimeFrame = quoteDate >= sevenDaysAgo;
          } else if (timeFrame === "30days") {
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
            matchesTimeFrame = quoteDate >= thirtyDaysAgo;
          } else if (timeFrame === "90days") {
            const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));
            matchesTimeFrame = quoteDate >= ninetyDaysAgo;
          }
        }
        
        let matchesAnalysisType = true;
        if (analysisType !== "all") {
          matchesAnalysisType = (quote as any).complexity === analysisType;
        }
        
        return matchesSearch && matchesTimeFrame && matchesAnalysisType;
      })
    : [];

  const getAnalysisTypeData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts = filteredQuotations.reduce((acc, quote) => {
      const type = quote.analysisType || 'standard';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return [
      { name: "Análisis Básico", value: counts.basic || 0, color: "#3b82f6" },
      { name: "Análisis Estándar", value: counts.standard || 0, color: "#06b6d4" },
      { name: "Análisis Profundo", value: counts.deep || 0, color: "#10b981" },
    ].filter(item => item.value > 0);
  };

  const getMonthlyData = () => {
    if (!filteredQuotations.length) return [];
    
    const monthlyData: Record<string, { month: string; count: number; value: number }> = {};
    
    filteredQuotations.forEach((quote) => {
      const date = new Date(quote.createdAt);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      const key = `${month} ${year}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          month: key,
          count: 0,
          value: 0,
        };
      }
      
      monthlyData[key].count += 1;
      monthlyData[key].value += quote.totalAmount;
    });
    
    return Object.values(monthlyData).sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const totalQuotations = filteredQuotations.length;
  const totalValue = filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0);
  const averageValue = totalQuotations > 0 ? totalValue / totalQuotations : 0;

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
              <p className="text-gray-600 mt-1">Análisis detallado de cotizaciones y tendencias</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <SelectValue placeholder="Período de tiempo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los períodos</SelectItem>
                  <SelectItem value="7days">Últimos 7 días</SelectItem>
                  <SelectItem value="30days">Últimos 30 días</SelectItem>
                  <SelectItem value="90days">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <Filter className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Tipo de análisis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="basic">Análisis Básico</SelectItem>
                  <SelectItem value="standard">Análisis Estándar</SelectItem>
                  <SelectItem value="deep">Análisis Profundo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Cotizaciones</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {isLoading ? (
                      <span className="animate-pulse bg-gray-200 h-8 w-16 rounded"></span>
                    ) : (
                      totalQuotations
                    )}
                  </p>
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
                  <p className="text-sm font-medium text-gray-600">Promedio por Cotización</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {isLoading ? (
                      <span className="animate-pulse bg-gray-200 h-8 w-24 rounded"></span>
                    ) : (
                      `$${averageValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    )}
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution Chart */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Distribución por Tipo</CardTitle>
                  <CardDescription className="text-gray-600">Tipos de análisis más solicitados</CardDescription>
                </div>
                <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
              </div>
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
                          formatter={(value: any) => [value, 'Cantidad']}
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
                          {entry.value}
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

          {/* Monthly Trend */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Tendencia Mensual</CardTitle>
                  <CardDescription className="text-gray-600">Evolución de cotizaciones a lo largo del tiempo</CardDescription>
                </div>
                <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
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
              ) : getMonthlyData().length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getMonthlyData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="month" 
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
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        name="Cantidad" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                  <TrendingUp className="h-12 w-12 mb-4 text-gray-300" />
                  <p className="text-center">No hay datos de tendencia disponibles</p>
                  <p className="text-sm text-center mt-1">Se necesitan datos de múltiples períodos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
