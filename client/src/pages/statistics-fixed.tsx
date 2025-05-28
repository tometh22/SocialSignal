import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { Search, TrendingUp, DollarSign, FileText } from "lucide-react";
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
          matchesAnalysisType = quote.complexity === analysisType;
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
      { name: "Análisis Básico", value: counts.basic || 0 },
      { name: "Análisis Estándar", value: counts.standard || 0 },
      { name: "Análisis Profundo", value: counts.deep || 0 },
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
    <div className="page-container">
      <div className="flex-between mb-6">
        <h1 className="heading-page">Estadísticas y Análisis</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
          <Input
            placeholder="Buscar proyectos..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={timeFrame} onValueChange={setTimeFrame}>
          <SelectTrigger>
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
          <SelectTrigger>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="standard-card">
          <CardHeader>
            <CardTitle className="heading-card">Distribución por Tipo</CardTitle>
            <CardDescription>Tipos de análisis más solicitados</CardDescription>
          </CardHeader>
          <CardContent className="card-content">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse">Cargando...</div>
              </div>
            ) : getAnalysisTypeData().length > 0 ? (
              <div className="h-64">
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
              <div className="h-64 flex items-center justify-center text-muted">
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
                    <span>{`$${filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                  }
                </p>
              </div>
              
              <div className="p-4 rounded-md">
                <p className="text-label mb-1">Promedio por Cotización</p>
                <p className="text-stat">
                  {isLoading ? 
                    <span className="animate-pulse">...</span> : 
                    <span>{filteredQuotations.length > 0 ? `$${(filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0) / filteredQuotations.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}</span>
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="standard-card">
        <CardHeader>
          <CardTitle className="heading-card">Tendencia Mensual</CardTitle>
          <CardDescription>Evolución de cotizaciones y valores a lo largo del tiempo</CardDescription>
        </CardHeader>
        <CardContent className="card-content">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse">Cargando...</div>
            </div>
          ) : getMonthlyData().length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getMonthlyData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} name="Cantidad" />
                  <Line type="monotone" dataKey="value" stroke="#ff6d00" strokeWidth={2} name="Valor ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted">
              No hay datos disponibles para mostrar la tendencia
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}