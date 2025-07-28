import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/ui/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, TrendingUp, Users, DollarSign, Clock, Building2, Target, Calendar,
  ArrowUpRight, ArrowDownRight, Activity, Briefcase, FileText, AlertCircle,
  ChevronRight, Download, Filter, PieChart, LineChart, Zap, Shield,
  TrendingDown, CheckCircle2, XCircle, Info, Globe, Layers,
  Calendar as CalendarIconLucide
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Area,
  AreaChart
} from "recharts";

// Tipos para datos de analytics
interface AnalyticsData {
  projects: any[];
  clients: any[];
  timeEntries: any[];
  quotations: any[];
  deliverables: any[];
}

// Colores corporativos para gráficos
const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  tertiary: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  indigo: "#6366f1",
  pink: "#ec4899",
  teal: "#14b8a6"
};

// Date filter options similar to other sections
const dateFilterOptions = [
  { value: "all", label: "Todos los períodos", group: "General" },
  { value: "this-month", label: "Este mes", group: "General" },
  { value: "last-month", label: "Mes pasado", group: "General" },
  { value: "this-quarter", label: "Este trimestre", group: "General" },
  { value: "last-quarter", label: "Trimestre pasado", group: "General" },
  { value: "this-semester", label: "Este semestre", group: "General" },
  { value: "last-semester", label: "Semestre pasado", group: "General" },
  { value: "this-year", label: "Este año", group: "General" },
  { value: "q1", label: "Q1 (Ene-Mar)", group: "Trimestres" },
  { value: "q2", label: "Q2 (Abr-Jun)", group: "Trimestres" },
  { value: "q3", label: "Q3 (Jul-Sep)", group: "Trimestres" },
  { value: "q4", label: "Q4 (Oct-Dic)", group: "Trimestres" },
  { value: "january", label: "Enero", group: "Meses" },
  { value: "february", label: "Febrero", group: "Meses" },
  { value: "march", label: "Marzo", group: "Meses" },
  { value: "april", label: "Abril", group: "Meses" },
  { value: "may", label: "Mayo", group: "Meses" },
  { value: "june", label: "Junio", group: "Meses" },
  { value: "july", label: "Julio", group: "Meses" },
  { value: "august", label: "Agosto", group: "Meses" },
  { value: "september", label: "Septiembre", group: "Meses" },
  { value: "october", label: "Octubre", group: "Meses" },
  { value: "november", label: "Noviembre", group: "Meses" },
  { value: "december", label: "Diciembre", group: "Meses" }
];

export default function AnalyticsConsolidated() {
  const [dateFilter, setDateFilter] = useState("this-month");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedMetric, setSelectedMetric] = useState("revenue");

  // Cargar todos los datos necesarios
  const { data: projects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: timeEntries = [] } = useQuery({ queryKey: ['/api/time-entries'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: deliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });

  // Calcular métricas consolidadas avanzadas
  const analytics = useMemo(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Filtrar Always-On vs Únicos
    const alwaysOnProjects = projects.filter(p => 
      p.isAlwaysOnMacro || 
      p.quotation?.projectName?.toLowerCase().includes('always-on') ||
      p.quotation?.projectName?.toLowerCase().includes('modo') ||
      p.quotation?.projectName?.toLowerCase().includes('contrato') || // Contratos son Always-On
      p.macroMonthlyBudget > 0 ||
      p.quotation?.projectType === 'always-on'
    );

    const uniqueProjects = projects.filter(p => !alwaysOnProjects.includes(p));

    // Calcular ingresos mensuales vs totales
    const monthlyRevenue = alwaysOnProjects.reduce((sum, p) => sum + (p.macroMonthlyBudget || 0), 0);
    const totalRevenue = uniqueProjects.reduce((sum, p) => sum + (p.quotation?.totalAmount || 0), 0);

    // Function to get date range based on filter
    const getDateRange = (filter: string) => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let startDate = new Date();
      let endDate = new Date();

      switch (filter) {
        case 'all':
          return null; // No filtering
        case 'this-month':
          startDate = new Date(currentYear, currentMonth, 1);
          endDate = new Date(currentYear, currentMonth + 1, 0);
          break;
        case 'last-month':
          startDate = new Date(currentYear, currentMonth - 1, 1);
          endDate = new Date(currentYear, currentMonth, 0);
          break;
        case 'this-quarter':
          const currentQuarter = Math.floor(currentMonth / 3);
          startDate = new Date(currentYear, currentQuarter * 3, 1);
          endDate = new Date(currentYear, currentQuarter * 3 + 3, 0);
          break;
        case 'last-quarter':
          const lastQuarter = Math.floor(currentMonth / 3) - 1;
          const qYear = lastQuarter < 0 ? currentYear - 1 : currentYear;
          const qNum = lastQuarter < 0 ? 3 : lastQuarter;
          startDate = new Date(qYear, qNum * 3, 1);
          endDate = new Date(qYear, qNum * 3 + 3, 0);
          break;
        case 'this-semester':
          const currentSemester = currentMonth < 6 ? 0 : 1;
          startDate = new Date(currentYear, currentSemester * 6, 1);
          endDate = new Date(currentYear, currentSemester * 6 + 6, 0);
          break;
        case 'last-semester':
          const lastSemester = currentMonth < 6 ? 1 : 0;
          const sYear = lastSemester === 1 && currentMonth < 6 ? currentYear - 1 : currentYear;
          startDate = new Date(sYear, lastSemester * 6, 1);
          endDate = new Date(sYear, lastSemester * 6 + 6, 0);
          break;
        case 'this-year':
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31);
          break;
        case 'q1':
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 2, 31);
          break;
        case 'q2':
          startDate = new Date(currentYear, 3, 1);
          endDate = new Date(currentYear, 5, 30);
          break;
        case 'q3':
          startDate = new Date(currentYear, 6, 1);
          endDate = new Date(currentYear, 8, 30);
          break;
        case 'q4':
          startDate = new Date(currentYear, 9, 1);
          endDate = new Date(currentYear, 11, 31);
          break;
        default:
          // Handle month names
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                            'july', 'august', 'september', 'october', 'november', 'december'];
          const monthIndex = monthNames.indexOf(filter);
          if (monthIndex !== -1) {
            startDate = new Date(currentYear, monthIndex, 1);
            endDate = new Date(currentYear, monthIndex + 1, 0);
          }
      }

      return { startDate, endDate };
    };

    // Filtrar time entries por período
    const dateRange = getDateRange(dateFilter);
    const periodEntries = dateRange 
      ? timeEntries.filter((entry: any) => {
          const entryDate = new Date(entry.date);
          return entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
        })
      : timeEntries;

    // Métricas de tiempo y costos
    const totalHours = periodEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
    const totalCost = periodEntries.reduce((sum: number, entry: any) => sum + (entry.totalCost || 0), 0);

    // Análisis por proyecto
    const projectMetrics = projects.map(project => {
      const projectEntries = periodEntries.filter((e: any) => e.projectId === project.id);
      const hours = projectEntries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
      const cost = projectEntries.reduce((sum: number, e: any) => sum + (e.totalCost || 0), 0);
      
      // Determinar si es Always-On
      const isAlwaysOn = alwaysOnProjects.includes(project);
      
      // Para Always-On, el budget es mensual. Para únicos, es el total
      let budget = 0;
      let periodBudget = 0;
      
      if (isAlwaysOn) {
        // Para Always-On, usar presupuesto mensual
        const monthlyBudget = project.macroMonthlyBudget || project.quotation?.totalAmount || 0;
        
        // Calcular cuántos meses abarca el período seleccionado
        if (dateFilter === 'this-month' || dateFilter === 'last-month' || 
            ['january', 'february', 'march', 'april', 'may', 'june', 
             'july', 'august', 'september', 'october', 'november', 'december'].includes(dateFilter)) {
          periodBudget = monthlyBudget;
        } else if (dateFilter === 'this-quarter' || dateFilter === 'last-quarter' ||
                   dateFilter === 'q1' || dateFilter === 'q2' || dateFilter === 'q3' || dateFilter === 'q4') {
          periodBudget = monthlyBudget * 3;
        } else if (dateFilter === 'this-semester' || dateFilter === 'last-semester') {
          periodBudget = monthlyBudget * 6;
        } else if (dateFilter === 'this-year') {
          periodBudget = monthlyBudget * 12;
        } else {
          // Para histórico completo, usar el total de meses con datos
          const uniqueMonths = new Set(
            projectEntries.map((e: any) => {
              const date = new Date(e.date);
              return `${date.getFullYear()}-${date.getMonth()}`;
            })
          );
          periodBudget = monthlyBudget * (uniqueMonths.size || 1);
        }
        budget = periodBudget;
      } else {
        // Para proyectos únicos, usar el presupuesto total
        budget = project.quotation?.totalAmount || 0;
        periodBudget = budget;
      }
      
      // Calcular eficiencia: qué porcentaje del presupuesto del período se ha usado
      const efficiency = periodBudget > 0 && cost > 0 ? (cost / periodBudget) * 100 : 0;
      
      // Calcular rentabilidad: margen de ganancia sobre el costo
      const revenue = periodBudget; // Lo que se cobra al cliente en el período
      const profitMargin = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
      
      return {
        id: project.id,
        name: project.quotation?.projectName || `Proyecto ${project.id}`,
        hours,
        cost,
        budget,
        efficiency: Math.min(100, efficiency), // Limitar a 100% máximo
        profitMargin: profitMargin,
        type: alwaysOnProjects.includes(project) ? 'always-on' : 'unique'
      };
    });

    // Tendencias mensuales (últimos 6 meses)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthEntries = timeEntries.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === year && entryDate.getMonth() === month;
      });
      
      const hours = monthEntries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
      const cost = monthEntries.reduce((sum: number, e: any) => sum + (e.totalCost || 0), 0);
      
      monthlyTrends.push({
        month: format(date, 'MMM', { locale: es }),
        hours,
        cost,
        revenue: monthlyRevenue // Simplificado para el ejemplo
      });
    }

    return {
      // Métricas básicas
      alwaysOnProjects: alwaysOnProjects.length,
      uniqueProjects: uniqueProjects.length,
      totalProjects: projects.length,
      activeClients: clients.length,
      monthlyRevenue,
      totalRevenue,
      combinedRevenue: monthlyRevenue + totalRevenue,
      
      // Métricas de tiempo y costos
      totalHours,
      totalCost,
      avgHourlyRate: totalHours > 0 ? totalCost / totalHours : 0,
      revenuePerHour: totalHours > 0 ? (monthlyRevenue + totalRevenue) / totalHours : 0,
      
      // Métricas de eficiencia
      avgEfficiency: projectMetrics.length > 0 
        ? projectMetrics.reduce((sum, p) => sum + p.efficiency, 0) / projectMetrics.length 
        : 0,
      avgProfitMargin: projectMetrics.length > 0 
        ? projectMetrics.reduce((sum, p) => sum + p.profitMargin, 0) / projectMetrics.length 
        : 0,
      
      // Estados
      completedDeliverables: deliverables.filter((d: any) => d.status === 'completed').length,
      pendingQuotations: quotations.filter((q: any) => q.status === 'pending').length,
      approvedQuotations: quotations.filter((q: any) => q.status === 'approved').length,
      
      // Datos para gráficos
      projectMetrics,
      monthlyTrends,
      
      // Comparaciones período anterior
      previousPeriodRevenue: 0, // Implementar según lógica de período
      revenueGrowth: 15.5, // Ejemplo, calcular real
      hoursGrowth: -5.2, // Ejemplo, calcular real
      costReduction: 8.3 // Ejemplo, calcular real
    };
  }, [projects, clients, timeEntries, quotations, deliverables, dateFilter]);

  return (
    <PageLayout
      title="Business Intelligence Dashboard"
      description="Centro de análisis corporativo avanzado con métricas en tiempo real"
      breadcrumbs={[
        { label: "Analytics & Reportes", current: true }
      ]}
    >
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header con métricas clave */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue Total</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">
                  ${analytics.combinedRevenue.toLocaleString()}
                </div>
                <div className="flex items-center text-xs mt-2">
                  {analytics.revenueGrowth > 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className={cn(
                    "font-medium",
                    analytics.revenueGrowth > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {Math.abs(analytics.revenueGrowth)}%
                  </span>
                  <span className="text-muted-foreground ml-1">vs período anterior</span>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/10" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eficiencia Promedio</CardTitle>
                <Activity className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">
                  {analytics.avgEfficiency.toFixed(1)}%
                </div>
                <Progress 
                  value={analytics.avgEfficiency} 
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/10" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Margen de Ganancia</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">
                  {analytics.avgProfitMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${analytics.revenuePerHour.toFixed(0)}/hora
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/10" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Horas Totales</CardTitle>
                <Clock className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">
                  {analytics.totalHours.toLocaleString()}h
                </div>
                <div className="flex items-center text-xs mt-2">
                  {analytics.hoursGrowth < 0 ? (
                    <ArrowDownRight className="h-3 w-3 text-green-600 mr-1" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className={cn(
                    "font-medium",
                    analytics.hoursGrowth < 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {Math.abs(analytics.hoursGrowth)}%
                  </span>
                  <span className="text-muted-foreground ml-1">optimización</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtro temporal único */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-64 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <CalendarIconLucide className="mr-2 h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  {/* Agrupar opciones por categoría */}
                  {["General", "Trimestres", "Meses"].map(group => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                        {group}
                      </div>
                      {dateFilterOptions
                        .filter(option => option.group === group)
                        .map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-48">
                  <Building2 className="mr-2 h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Clientes</SelectItem>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>



        {/* Tabs de análisis detallado */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Resumen General</TabsTrigger>
            <TabsTrigger value="projects">Análisis de Proyectos</TabsTrigger>
            <TabsTrigger value="clients">Análisis de Clientes</TabsTrigger>
            <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de distribución de proyectos */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Distribución de Portfolio</CardTitle>
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Always-On', value: analytics.alwaysOnProjects, revenue: analytics.monthlyRevenue },
                          { name: 'Únicos', value: analytics.uniqueProjects, revenue: analytics.totalRevenue }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill={CHART_COLORS.primary} />
                        <Cell fill={CHART_COLORS.secondary} />
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any, name: any, props: any) => [
                          `${value} proyectos`,
                          `Revenue: $${props.payload.revenue.toLocaleString()}`
                        ]}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.primary }}></div>
                        Always-On
                      </span>
                      <span className="font-medium">${analytics.monthlyRevenue.toLocaleString()}/mes</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.secondary }}></div>
                        Únicos
                      </span>
                      <span className="font-medium">${analytics.totalRevenue.toLocaleString()} total</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico de tendencias mensuales */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Tendencia de Ingresos (6 meses)</CardTitle>
                    <LineChart className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analytics.monthlyTrends}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.danger} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={CHART_COLORS.danger} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip 
                        formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={CHART_COLORS.primary} 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                        name="Ingresos"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="cost" 
                        stroke={CHART_COLORS.danger} 
                        fillOpacity={1} 
                        fill="url(#colorCost)" 
                        name="Costos"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Análisis de eficiencia por proyecto */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Análisis de Eficiencia por Proyecto</CardTitle>
                    <CardDescription>
                      Comparación de presupuesto vs costo real para proyectos activos
                    </CardDescription>
                  </div>
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.projectMetrics.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: any, name: any) => {
                        if (name === 'Presupuesto' || name === 'Costo') {
                          return `$${Number(value).toLocaleString()}`;
                        }
                        return `${Number(value).toFixed(1)}%`;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="budget" fill={CHART_COLORS.primary} name="Presupuesto" />
                    <Bar dataKey="cost" fill={CHART_COLORS.tertiary} name="Costo" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4">
              {projects.map((project: any) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {project.quotation?.projectName || `Proyecto ${project.id}`}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={project.isAlwaysOnMacro ? "default" : "secondary"}>
                          {project.isAlwaysOnMacro ? "Always-On" : "Único"}
                        </Badge>
                        <Badge variant="outline">{project.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Presupuesto</span>
                        <p className="font-semibold">
                          ${(project.macroMonthlyBudget || project.quotation?.totalAmount || 0).toLocaleString()}
                          {project.macroMonthlyBudget && "/mes"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cliente</span>
                        <p className="font-semibold">
                          {clients.find((c: any) => c.id === project.quotation?.clientId)?.name || "Sin asignar"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Inicio</span>
                        <p className="font-semibold">
                          {project.startDate ? format(new Date(project.startDate), "dd/MM/yyyy") : "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/active-projects/${project.id}`}>
                          <Button size="sm" variant="outline">Ver Detalles</Button>
                        </Link>
                        <Link href={`/project-analytics/${project.id}`}>
                          <Button size="sm" variant="outline">Analytics</Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <div className="grid gap-4">
              {clients.map((client: any) => {
                const clientProjects = projects.filter((p: any) => p.quotation?.clientId === client.id);
                const clientRevenue = clientProjects.reduce((sum, p) => 
                  sum + (p.macroMonthlyBudget || p.quotation?.totalAmount || 0), 0
                );

                return (
                  <Card key={client.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{client.name}</CardTitle>
                        <Badge>{clientProjects.length} proyecto{clientProjects.length !== 1 ? 's' : ''}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ingresos Totales</span>
                          <p className="font-semibold">${clientRevenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Proyectos Activos</span>
                          <p className="font-semibold">{clientProjects.filter(p => p.status === 'active').length}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contacto</span>
                          <p className="font-semibold">{client.email || "No especificado"}</p>
                        </div>
                        <div>
                          <Link href={`/client-summary/${client.id}`}>
                            <Button size="sm" variant="outline">Ver Resumen</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* KPIs de Performance */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">ROI Promedio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {((analytics.combinedRevenue / analytics.totalCost - 1) * 100).toFixed(1)}%
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {analytics.revenueGrowth > 0 ? '+' : ''}{analytics.revenueGrowth}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Productividad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      ${analytics.revenuePerHour.toFixed(0)}/h
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {analytics.totalHours.toFixed(0)}h totales
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {((analytics.approvedQuotations / (analytics.approvedQuotations + analytics.pendingQuotations)) * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {analytics.approvedQuotations} aprobadas
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Eficiencia Operativa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {analytics.avgEfficiency.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      vs presupuesto
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Análisis detallado de performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Top 5 Proyectos por Rentabilidad</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.projectMetrics
                      .sort((a, b) => b.profitMargin - a.profitMargin)
                      .slice(0, 5)
                      .map((project, index) => (
                        <div key={project.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {index + 1}. {project.name}
                              </span>
                              <Badge variant={project.type === 'always-on' ? 'default' : 'secondary'} className="text-xs">
                                {project.type === 'always-on' ? 'Always-On' : 'Único'}
                              </Badge>
                            </div>
                            <span className={cn(
                              "text-sm font-bold",
                              project.profitMargin > 50 ? "text-green-600" : 
                              project.profitMargin > 20 ? "text-blue-600" : "text-amber-600"
                            )}>
                              {project.profitMargin.toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={Math.max(0, Math.min(100, project.profitMargin))} 
                            className="h-2"
                          />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Distribución de Horas por Tipo</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { 
                            name: 'Always-On', 
                            value: analytics.projectMetrics
                              .filter(p => p.type === 'always-on')
                              .reduce((sum, p) => sum + p.hours, 0)
                          },
                          { 
                            name: 'Únicos', 
                            value: analytics.projectMetrics
                              .filter(p => p.type === 'unique')
                              .reduce((sum, p) => sum + p.hours, 0)
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill={CHART_COLORS.indigo} />
                        <Cell fill={CHART_COLORS.teal} />
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any) => `${Number(value).toFixed(0)}h`}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.indigo }}></div>
                      <span className="text-sm">Always-On</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.teal }}></div>
                      <span className="text-sm">Únicos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Matriz de Eficiencia */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Matriz de Eficiencia vs Rentabilidad</CardTitle>
                    <CardDescription>
                      Análisis comparativo de todos los proyectos activos
                    </CardDescription>
                  </div>
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <h4 className="font-medium text-sm mb-1">Zona Crítica</h4>
                    <p className="text-xs text-muted-foreground">Baja eficiencia y rentabilidad</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <h4 className="font-medium text-sm mb-1">Zona Óptima</h4>
                    <p className="text-xs text-muted-foreground">Alta eficiencia y rentabilidad</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Proyecto</th>
                        <th className="text-center p-2">Tipo</th>
                        <th className="text-center p-2">
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center gap-1 cursor-help">
                              Eficiencia
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Eficiencia Presupuestaria</p>
                              <p className="text-sm">Porcentaje del presupuesto utilizado hasta ahora.</p>
                              <p className="text-sm mt-1">Ej: Si tienes 75%, has usado el 75% del presupuesto asignado.</p>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                        <th className="text-center p-2">
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center gap-1 cursor-help">
                              Rentabilidad
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Margen de Ganancia</p>
                              <p className="text-sm">Porcentaje de ganancia sobre el costo.</p>
                              <p className="text-sm mt-1">Fórmula: (Precio Cliente - Costo) / Costo × 100</p>
                              <p className="text-sm mt-1">Ej: Si cobras $100 y gastas $75, tu rentabilidad es 33%.</p>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                        <th className="text-center p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.projectMetrics.slice(0, 10).map((project) => (
                        <tr key={project.id} className="border-b">
                          <td className="p-2 font-medium text-sm">{project.name}</td>
                          <td className="p-2 text-center">
                            <Badge variant={project.type === 'always-on' ? 'default' : 'secondary'} className="text-xs">
                              {project.type === 'always-on' ? 'Always-On' : 'Único'}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <span className={cn(
                              "text-sm font-medium",
                              project.efficiency > 80 ? "text-green-600" : 
                              project.efficiency > 50 ? "text-blue-600" : "text-red-600"
                            )}>
                              {project.efficiency.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={cn(
                              "text-sm font-medium",
                              project.profitMargin > 50 ? "text-green-600" : 
                              project.profitMargin > 20 ? "text-blue-600" : "text-red-600"
                            )}>
                              {project.profitMargin.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {project.efficiency > 80 && project.profitMargin > 50 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : project.efficiency < 50 || project.profitMargin < 20 ? (
                              <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-600 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </TooltipProvider>
    </PageLayout>
  );
}