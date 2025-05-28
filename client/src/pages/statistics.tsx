import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronDown, Calendar, Layers, ArrowUpDown, BarChart2, LineChart } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Statistics() {
  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [timeFrame, setTimeFrame] = useState("all");
  const [analysisType, setAnalysisType] = useState("all");

  // Filter quotations based on search, time frame, and analysis type
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
        
        const matchesAnalysisType = analysisType === "all" || quote.analysisType === analysisType;
        
        return matchesSearch && matchesTimeFrame && matchesAnalysisType;
      })
    : [];

  // Prepare data for charts
  const getStatusData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      inNegotiation: 0,
    };
    
    filteredQuotations.forEach((quote) => {
      if (quote.status === "pending") counts.pending += 1;
      else if (quote.status === "approved") counts.approved += 1;
      else if (quote.status === "rejected") counts.rejected += 1;
      else if (quote.status === "in-negotiation") counts.inNegotiation += 1;
    });
    
    return [
      { name: "Pendientes", value: counts.pending },
      { name: "Aprobadas", value: counts.approved },
      { name: "Rechazadas", value: counts.rejected },
      { name: "En Negociación", value: counts.inNegotiation },
    ].filter(item => item.value > 0);
  };

  const getAnalysisTypeData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts: Record<string, number> = {
      basic: 0,
      standard: 0,
      deep: 0,
    };
    
    filteredQuotations.forEach((quote) => {
      if (quote.analysisType === "basic") counts.basic += 1;
      else if (quote.analysisType === "standard") counts.standard += 1;
      else if (quote.analysisType === "deep") counts.deep += 1;
    });
    
    return [
      { name: "Análisis Básico", value: counts.basic },
      { name: "Análisis Estándar", value: counts.standard },
      { name: "Análisis Profundo", value: counts.deep },
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

  const COLORS = ['#1976d2', '#ff6d00', '#4caf50', '#f44336'];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-subheading text-neutral-900">Estadísticas y Análisis</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="container-xl fade-in">
          <div className="section-sm">
            <div className="flex-between mb-6">
              <h1 className="heading-page">Estadísticas y Análisis</h1>
            </div>
            
            <div className="mb-section">
              <Card className="standard-card">
                <CardHeader>
                  <CardTitle className="heading-card">Filtros de Análisis</CardTitle>
                  <CardDescription>Ajusta los parámetros para analizar métricas específicas</CardDescription>
                </CardHeader>
                <CardContent className="card-content">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
                        <Input
                          placeholder="Buscar por nombre de proyecto..."
                          className="pl-10"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="w-full md:w-48">
                      <Select value={timeFrame} onValueChange={setTimeFrame}>
                        <SelectTrigger className="hover-lift shadow-soft">
                          <Calendar className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Período de tiempo" />
                        </SelectTrigger>
                        <SelectContent className="glass-light backdrop-blur-md border border-white/20">
                          <SelectItem value="all">Todo el tiempo</SelectItem>
                          <SelectItem value="7days">Últimos 7 días</SelectItem>
                          <SelectItem value="30days">Últimos 30 días</SelectItem>
                          <SelectItem value="90days">Últimos 90 días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="w-full md:w-48">
                      <Select value={analysisType} onValueChange={setAnalysisType}>
                        <SelectTrigger className="hover-lift shadow-soft">
                          <Layers className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Tipo de análisis" />
                        </SelectTrigger>
                        <SelectContent className="glass-light backdrop-blur-md border border-white/20">
                          <SelectItem value="all">Todos los tipos</SelectItem>
                          <SelectItem value="basic">Análisis Básico</SelectItem>
                          <SelectItem value="standard">Análisis Estándar</SelectItem>
                          <SelectItem value="deep">Análisis Profundo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <Card className="glass-card shadow-medium hover-lift scale-in">
                  <CardHeader className="pb-2 border-b border-white/10">
                    <CardTitle className="text-heading flex items-center">
                      <span className="bg-primary/20 p-2 rounded-full mr-2">
                        <ArrowUpDown className="h-5 w-5 text-primary" />
                      </span>
                      Cotizaciones por Estado
                    </CardTitle>
                    <CardDescription>Distribución de estados de las cotizaciones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="h-64 flex items-center justify-center scale-in">
                        <div className="glass-pill p-6 rounded-xl shadow-medium flex flex-col items-center">
                          <div className="bg-primary/10 p-3 rounded-full mb-3">
                            <BarChart2 className="h-10 w-10 animate-pulse text-primary" />
                          </div>
                          <h3 className="text-heading text-lg mb-1">Cargando datos</h3>
                          <p className="text-neutral-500 text-sm">Procesando información...</p>
                        </div>
                      </div>
                    ) : getStatusData().length > 0 ? (
                      <div className="h-64 fade-in">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getStatusData()}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {getStatusData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-neutral-500">
                        No hay datos disponibles
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card shadow-medium hover-lift scale-in">
                  <CardHeader className="pb-2 border-b border-white/10">
                    <CardTitle className="text-heading flex items-center">
                      <span className="bg-accent/20 p-2 rounded-full mr-2">
                        <Layers className="h-5 w-5 text-accent" />
                      </span>
                      Tipos de Análisis
                    </CardTitle>
                    <CardDescription>Desglose por complejidad de análisis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="h-64 flex items-center justify-center scale-in">
                        <div className="glass-pill p-6 rounded-xl shadow-medium flex flex-col items-center">
                          <div className="bg-accent/10 p-3 rounded-full mb-3">
                            <Layers className="h-10 w-10 animate-pulse text-accent" />
                          </div>
                          <h3 className="text-heading text-lg mb-1">Cargando datos</h3>
                          <p className="text-neutral-500 text-sm">Procesando información...</p>
                        </div>
                      </div>
                    ) : getAnalysisTypeData().length > 0 ? (
                      <div className="h-64 fade-in">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getAnalysisTypeData()}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {getAnalysisTypeData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-neutral-500">
                        No hay datos disponibles
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="standard-card">
                  <CardHeader>
                    <CardTitle className="heading-card">Resumen Financiero</CardTitle>
                    <CardDescription>Métricas financieras agregadas</CardDescription>
                  </CardHeader>
                  <CardContent className="card-content">
                    <div className="space-y-6 py-4">
                      <div className="p-4 rounded-md">
                        <p className="text-label mb-1">Total de Cotizaciones</p>
                        <p className="text-stat">
                          {isLoading ? 
                            <span className="animate-pulse">...</span> : 
                            <span>{filteredQuotations.length}</span>
                          }
                        </p>
                      </div>
                      
                      <div className="p-4 rounded-md">
                        <p className="text-label mb-1">Valor Total</p>
                        <p className="text-stat">
                          {isLoading ? 
                            <span className="animate-pulse">...</span> : 
                            <span className="fade-in">{`$${filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                          }
                        </p>
                      </div>
                      
                      <div className="glass-pill p-4 rounded-md shadow-soft slide-in" style={{animationDelay: '0.3s'}}>
                        <p className="text-sm text-neutral-500 font-medium mb-1">Valor Promedio</p>
                        <p className="text-2xl font-semibold text-neutral-900">
                          {isLoading ? 
                            <span className="animate-pulse">...</span> : 
                            <span className="fade-in">
                              {filteredQuotations.length > 0 
                                ? `$${(filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0) / filteredQuotations.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "$0.00"
                              }
                            </span>
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card shadow-medium hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-primary/20 p-2 rounded-full mr-2">
                      <BarChart2 className="h-5 w-5 text-primary" />
                    </span>
                    Tendencias Mensuales
                  </CardTitle>
                  <CardDescription>Actividad de cotizaciones a lo largo del tiempo</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-80 flex items-center justify-center scale-in">
                      <div className="glass-pill p-6 rounded-xl shadow-medium flex flex-col items-center">
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                          <BarChart2 className="h-10 w-10 animate-pulse text-primary" />
                        </div>
                        <h3 className="text-heading text-lg mb-1">Cargando tendencias</h3>
                        <p className="text-neutral-500 text-sm">Analizando datos temporales...</p>
                      </div>
                    </div>
                  ) : getMonthlyData().length > 0 ? (
                    <div className="h-80 fade-in">
                      <Tabs defaultValue="count">
                        <TabsList className="mb-4">
                          <TabsTrigger value="count" className="hover-lift">Cantidad de Cotizaciones</TabsTrigger>
                          <TabsTrigger value="value" className="hover-lift">Valor de Cotizaciones</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="count" className="mt-2 slide-in">
                          <div className="glass-panel p-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={getMonthlyData()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip 
                                  contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(8px)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                  }}
                                />
                                <Legend />
                                <Bar dataKey="count" name="Número de Cotizaciones" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="value" className="mt-2 slide-in">
                          <div className="glass-panel p-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={getMonthlyData()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip 
                                  formatter={(value) => [`$${value.toLocaleString()}`, "Valor Total"]} 
                                  contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(8px)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                  }}
                                />
                                <Legend />
                                <Bar dataKey="value" name="Valor Total de Cotizaciones" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-neutral-500">
                      No hay datos de tendencias disponibles
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}